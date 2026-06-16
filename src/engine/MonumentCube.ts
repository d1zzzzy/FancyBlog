import * as THREE from "three";
import type { CategoryConfig, Post, Tweaks } from "../types";
import { beaconGeo } from "./builders";
import {
  monumentGeometry,
  monumentMaterials,
  cellPlinthGeometry,
  plinthMaterial,
} from "./cellMonument";
import { SKIES } from "./skies";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createStarfield, type Starfield } from "./starfield";

/* ============================================================
   MonumentCube — a "specimen cube" layout.

   Each category becomes a horizontal layer (slab). Posts in a layer are
   packed into a square-ish grid of glass cells, each holding a glowing
   specimen. You orbit the whole cube and click a cell to fly the camera
   inside it; the existing reader panel then slides in.

   Shares the same callback contract as MonumentWorld so the reader /
   about / index / tweaks UI plug in unchanged.
   ============================================================ */

export interface Cell {
  root: THREE.Group;
  /** full monument — scaled 0→1 by the proximity LOD */
  monument: THREE.Mesh;
  /** glowing category beacon (the constant "light" at every LOD) */
  beacon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  hit: THREE.Mesh;
  post: Post;
  index: number;
  layer: number;
  worldPos: THREE.Vector3;
  phase: number;
  /** 0 = unselected gem … 1 = risen monument (only the focused cell) */
  lod: number;
}

export interface CubeLayer {
  cat: string;
  name: string;
  index: number;
  count: number;
  y: number;
}

export interface CubeState {
  focusIndex: number | null;
  overlayOpen: boolean;
  activeLayer: number;
}

export interface MonumentCubeOptions {
  posts: Post[];
  categories: CategoryConfig[];
  onOpenReader: (post: Post) => void;
  onState?: (state: CubeState) => void;
}

const CELL = 8; // grid spacing per cell (and layer height) — gap = CELL - BOX
const BOX = 5.2; // cell footprint (drives grid math, hit target + hover highlight)
const FOCUS_DIST = BOX * 2.3; // fly-in framing tracks the cell, not the spacing
const RIGHT_SHIFT = BOX * 0.9;
const FLOOR_Y = -BOX * 0.5 + 0.4; // plinth top — monuments rise from here
const FIT = BOX * 0.82; // monument height after scaling to the cell
const BEACON_Y = Math.min(BOX * 0.5 - 0.5, FLOOR_Y + FIT + 0.3); // beacon at full LOD
const GEM_Y = FLOOR_Y + 1.1; // beacon hovers low over the plinth when unselected

/** easeOutBack — overshoots slightly past 1 so the rise feels like it "lands". */
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class MonumentCube {
  readonly cells: Cell[] = [];
  readonly layers: CubeLayer[] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly atmosphere: Atmosphere;
  private readonly opts: MonumentCubeOptions;
  private readonly monByPost = new Map<string, Cell>();

  /* orbit + focus state */
  private targetAzimuth = 0.6;
  private targetElevation = 0.5;
  private targetDistance: number;
  private readonly targetLook = new THREE.Vector3(0, 0, 0);
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3(0, 0, 0);
  private readonly focusDir = new THREE.Vector3(0, 0, 1);
  private focused: Cell | null = null;
  private hovered: Cell | null = null;
  private overlayOpen = false;
  private activeLayer = 0;

  private dragging = false;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private startAz = 0;
  private startEl = 0;

  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), CELL);
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private readonly tmpRight = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private highlight!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

  /* tweakable */
  private floatAmp = 1.0;
  private autoRotate = false;
  private sunAngle = 0;
  private readonly SUN_BASE = new THREE.Vector3(-8, 16, 10);
  private extent = 1;
  private starfield?: Starfield;

  private readonly frameListeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, opts: MonumentCubeOptions) {
    this.canvas = canvas;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 2000);

    /* lights (no shadow map — a dense lattice of shadows is muddy + costly) */
    this.hemi = new THREE.HemisphereLight(0xfff3e6, 0xd9b9c4, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.35);
    this.sun.position.copy(this.SUN_BASE);
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight(0xd9e6ff, 0.4);
    rim.position.set(-6, 4, -8);
    this.scene.add(rim);

    this.targetDistance = 60;
    this.buildCube(opts.posts, opts.categories);
    this.targetDistance = this.extent * 1.7 + 8;

    this.atmosphere = createAtmosphere(this.scene, this.extent * 1.6, this.extent * 1.6);
    this.starfield = createStarfield(this.scene, {
      shell: { inner: this.extent * 0.85, outer: this.extent * 2.2, yScale: 0.75 },
      size: this.extent * 0.018,
      opacity: 0.5,
    });

    /* shared highlight box (moved onto the hovered / focused cell) */
    this.highlight = new THREE.Mesh(
      new THREE.BoxGeometry(BOX, BOX, BOX),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.highlight.renderOrder = 2;
    this.scene.add(this.highlight);

    /* seed camera so the first frame isn't a jump from origin */
    this.camPos.copy(this.orbitDesired());
    this.bindEvents();
    this.emitState();
    this.frame();
  }

  /* ---------- build ---------- */
  private buildCube(posts: Post[], categories: CategoryConfig[]): void {
    const L = categories.length;
    const counts = categories.map((c) => posts.filter((p) => p.cat === c.id).length);
    const maxCount = Math.max(1, ...counts);
    const cols = Math.ceil(Math.sqrt(maxCount));
    const rowsMax = Math.ceil(maxCount / cols);

    categories.forEach((cat, d) => {
      const layerY = (d - (L - 1) / 2) * CELL;
      this.layers.push({ cat: cat.id, name: cat.districtName, index: d, count: counts[d], y: layerY });

      const specGeo = beaconGeo(cat.beacon);
      const plinthGeo = cellPlinthGeometry(FLOOR_Y);

      const inLayer = posts.filter((p) => p.cat === cat.id);
      inLayer.forEach((post, i) => {
        const gx = i % cols;
        const gz = Math.floor(i / cols);
        const x = (gx - (cols - 1) / 2) * CELL;
        const z = (gz - (rowsMax - 1) / 2) * CELL;

        const root = new THREE.Group();
        root.position.set(x, layerY, z);

        // small pedestal — always present, gives the lattice its order
        const color = cat.palette[i % cat.palette.length];
        root.add(new THREE.Mesh(plinthGeo, plinthMaterial(color)));

        // real Monument-Valley structure — rises from the plinth at near LOD
        const baked = monumentGeometry(i + d, FIT);
        const monument = new THREE.Mesh(baked.geometry, monumentMaterials(color, baked.order));
        monument.position.y = FLOOR_Y;
        monument.scale.setScalar(0.0001);
        monument.visible = false;
        root.add(monument);

        // glowing category beacon — the constant light at every LOD
        const beacon = new THREE.Mesh(
          specGeo,
          new THREE.MeshStandardMaterial({
            color: cat.color,
            emissive: cat.color,
            emissiveIntensity: 0.5,
            flatShading: true,
            roughness: 0.5,
          }),
        );
        beacon.scale.setScalar(0.95);
        beacon.position.y = GEM_Y;
        root.add(beacon);

        const gi = this.cells.length;
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(BOX, BOX, BOX),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.userData.index = gi;
        root.add(hit);

        this.scene.add(root);
        const cell: Cell = {
          root,
          monument,
          beacon,
          hit,
          post,
          index: gi,
          layer: d,
          worldPos: new THREE.Vector3(x, layerY, z),
          phase: Math.random() * Math.PI * 2,
          lod: 0,
        };
        this.cells.push(cell);
        this.monByPost.set(post.id, cell);
      });
    });

    this.extent = Math.max(cols * CELL, rowsMax * CELL, L * CELL);
  }

  /* ---------- camera ---------- */
  private orbitDir(): THREE.Vector3 {
    const az = this.targetAzimuth;
    const el = this.targetElevation;
    return new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    );
  }
  private orbitDesired(): THREE.Vector3 {
    return this.targetLook.clone().addScaledVector(this.orbitDir(), this.targetDistance);
  }

  /* ---------- public API (mirrors MonumentWorld where the UI needs it) ---------- */
  focus(post: Post): void {
    const cell = this.monByPost.get(post.id);
    if (cell) this.focusOn(cell);
  }

  blur(): void {
    this.focused = null;
    this.emitState();
  }

  setOverlay(open: boolean): void {
    this.overlayOpen = open;
    if (open) this.hovered = null;
    this.emitState();
  }

  /** Re-frame the whole cube. */
  resetView(): void {
    this.focused = null;
    this.targetLook.set(0, 0, 0);
    this.targetDistance = this.extent * 1.7 + 8;
    this.emitState();
  }

  /** Glide the orbit to look at a category layer. */
  spinToLayer(d: number): void {
    this.focused = null;
    this.activeLayer = d;
    this.targetLook.set(0, this.layers[d]?.y ?? 0, 0);
    this.targetDistance = this.extent * 1.5 + 6;
    this.emitState();
  }

  applyTweaks(tw: Partial<Tweaks>): void {
    if (tw.sky && SKIES[tw.sky]) {
      const s = SKIES[tw.sky];
      document.body.style.background = s.body;
      document.documentElement.style.background = s.body;
      this.hemi.color.setHex(s.hemiSky);
      this.hemi.groundColor.setHex(s.hemiGround);
      this.sun.color.setHex(s.sun);
      const l = document.getElementById("loader");
      if (l) l.style.background = s.body;
    }
    if (typeof tw.sunAngle === "number") this.sunAngle = tw.sunAngle;
    if (typeof tw.float === "number") this.floatAmp = tw.float;
    if (typeof tw.autoRotate === "boolean") this.autoRotate = tw.autoRotate;
  }

  onFrame(cb: () => void): void {
    this.frameListeners.push(cb);
  }

  state(): CubeState {
    return {
      focusIndex: this.focused ? this.focused.index : null,
      overlayOpen: this.overlayOpen,
      activeLayer: this.activeLayer,
    };
  }

  private emitState(): void {
    this.opts.onState?.(this.state());
  }

  private get gated(): boolean {
    return !!this.focused || this.overlayOpen;
  }

  private focusOn(cell: Cell): void {
    this.focused = cell;
    this.activeLayer = cell.layer;
    // approach from the current viewing direction so it reads as "flying in"
    this.focusDir.copy(this.camPos).sub(this.camLook).normalize();
    this.opts.onOpenReader(cell.post);
    this.emitState();
  }

  /* ---------- input ---------- */
  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.gated) return;
      this.dragging = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downTime = performance.now();
      this.startAz = this.targetAzimuth;
      this.startEl = this.targetElevation;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (this.dragging && !this.gated) {
        this.targetAzimuth = this.startAz - (e.clientX - this.downX) * 0.006;
        this.targetElevation = this.startEl + (e.clientY - this.downY) * 0.006;
        this.targetElevation = Math.max(-0.2, Math.min(1.35, this.targetElevation));
      }
    });
    const end = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      const dt = performance.now() - this.downTime;
      if (dist < 6 && dt < 350 && this.hovered) this.focusOn(this.hovered);
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", () => (this.dragging = false));

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.gated) return;
        const k = 1 + (e.deltaY > 0 ? 0.08 : -0.08);
        this.targetDistance = Math.max(CELL * 1.2, Math.min(this.extent * 3, this.targetDistance * k));
      },
      { passive: true },
    );

    window.addEventListener("keydown", (e) => {
      if (this.gated) return;
      if (e.key === "[") this.spinToLayer((this.activeLayer - 1 + this.layers.length) % this.layers.length);
      if (e.key === "]") this.spinToLayer((this.activeLayer + 1) % this.layers.length);
    });

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ---------- render loop ---------- */
  private frame = (): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const k = Math.min(1, dt * 4);

    // the cube always drifts gently; the tweak speeds it up
    if (!this.gated && !this.dragging) this.targetAzimuth += dt * (this.autoRotate ? 0.12 : 0.02);

    if (this.focused) {
      this.tmpRight.crossVectors(this.UP, this.focusDir).normalize();
      this.desiredLook.copy(this.focused.worldPos).addScaledVector(this.tmpRight, RIGHT_SHIFT);
      this.desiredPos.copy(this.desiredLook).addScaledVector(this.focusDir, FOCUS_DIST);
    } else {
      this.desiredLook.copy(this.targetLook);
      this.desiredPos.copy(this.orbitDesired());
    }
    this.camPos.lerp(this.desiredPos, k);
    this.camLook.lerp(this.desiredLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();

    const so = this.SUN_BASE.clone().applyAxisAngle(this.UP, this.sunAngle);
    this.sun.position.copy(so);

    /* frustum cull: only animate / raycast cells in view */
    this.projScreen.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    const visibleHits: THREE.Object3D[] = [];
    for (const cell of this.cells) {
      this.sphere.center.copy(cell.worldPos);
      const inView = this.frustum.intersectsSphere(this.sphere);
      cell.root.visible = inView;
      if (!inView) continue;
      visibleHits.push(cell.hit);
      const focused = this.focused === cell;

      // reveal is selection-driven ONLY: just the focused cell rises into its
      // full monument. Orbiting, zooming or hovering never expand other cells,
      // so sweeping the mouse can't trigger a cascade of animations.
      const target = focused ? 1 : 0;
      cell.lod += (target - cell.lod) * Math.min(1, dt * 4); // a touch slower = more deliberate
      const e = cell.lod * cell.lod * (3 - 2 * cell.lod); // smooth ease
      cell.monument.visible = cell.lod > 0.02;
      if (cell.monument.visible) {
        cell.monument.scale.setScalar(Math.max(0.001, easeOutBack(cell.lod))); // rises with a slight overshoot
        cell.monument.rotation.y = (1 - e) * -0.6; // turns to face front as it lands
      }

      const flare = e * (1 - e) * 4; // 0..1, peaks mid-reveal
      const bob = Math.sin(t * 1.3 + cell.phase) * 0.14 * this.floatAmp;
      const b = cell.beacon;
      const beaconY = GEM_Y + (BEACON_Y - GEM_Y) * e; // rides up with the monument
      b.position.y = beaconY + bob;
      b.rotation.y += dt * 0.8;
      b.rotation.x += dt * 0.45;
      b.material.emissiveIntensity = 0.5 + (focused ? 0.9 : 0) + flare * 0.9; // flares during the rise
      b.scale.setScalar(0.95 * (1 + (1 - e) * 0.18 + flare * 0.2)); // a touch bigger as a lone gem + a pop mid-rise
    }

    /* hover raycast (visible cells only) */
    if (!this.gated && !this.dragging) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(visibleHits, false)[0];
      const nh = hit ? this.cells[hit.object.userData.index as number] : null;
      if (nh !== this.hovered) {
        this.hovered = nh;
        this.canvas.style.cursor = nh ? "pointer" : "grab";
      }
    } else if (this.hovered && this.gated) {
      this.hovered = null;
    }
    if (!this.hovered) this.canvas.style.cursor = this.dragging ? "grabbing" : "grab";

    /* highlight box follows the focused / hovered cell */
    const lit = this.focused || this.hovered;
    const want = lit ? (this.focused ? 0.16 : 0.09) : 0;
    if (lit) this.highlight.position.copy(lit.worldPos);
    this.highlight.material.opacity += (want - this.highlight.material.opacity) * Math.min(1, dt * 8);
    this.highlight.visible = this.highlight.material.opacity > 0.005;

    this.atmosphere.update(dt, t);
    this.starfield?.update(dt, t);
    for (const cb of this.frameListeners) cb();
    this.renderer.render(this.scene, this.camera);
  };
}
