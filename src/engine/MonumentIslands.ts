import * as THREE from "three";
import type { CategoryConfig, Post, Tweaks } from "../types";
import { beaconGeo } from "./builders";
import {
  monumentGeometry,
  monumentMaterials,
  cellPlinthGeometry,
  plinthMaterial,
} from "./cellMonument";
import { SKIES, makeSkyTexture } from "./skies";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createStarfield, dotTexture, ringTexture, type Starfield } from "./starfield";
import { scatter } from "./scatter";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/* ============================================================
   MonumentIslands — "islands in space".

   Every post is a lone floating island (plinth + full Monument-Valley
   structure + beacon) scattered through a calm volume with breathing
   room around it. You orbit the field and click an island to fly in;
   navigation is meant to lean on the Index / search. Placement comes
   from the deterministic, weightable `scatter()` so ranking (recency,
   popularity, …) can later pull prominent posts toward the centre.

   Shares the engine callback contract + the cube's category-chip HUD.
   ============================================================ */

export interface Island {
  root: THREE.Group;
  /** plinth + monument — the full "island", hidden when filtered out */
  plinth: THREE.Mesh;
  monument: THREE.Mesh;
  beacon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** small glowing dot shown in place of the island when filtered out */
  star: THREE.Sprite;
  hit: THREE.Mesh;
  post: Post;
  index: number;
  worldPos: THREE.Vector3; // static base (cull / focus anchor); the root bobs
  scale: number;
  cullR: number;
  phase: number;
  /** 0 = matches the active filter (full) … 1 = filtered out (collapsed to a star) */
  dim: number;
  /** last applied dim — dirty-check to skip settled islands each frame */
  lastDim: number;
}

export interface IslandLayer {
  cat: string;
  name: string;
  index: number;
  count: number;
  centroid: THREE.Vector3;
}

export interface IslandsState {
  focusIndex: number | null;
  overlayOpen: boolean;
  activeLayer: number;
}

export interface MonumentIslandsOptions {
  posts: Post[];
  categories: CategoryConfig[];
  onOpenReader: (post: Post) => void;
  onState?: (state: IslandsState) => void;
  /** optional ranking hook — higher = more prominent (centre + bigger) */
  weightOf?: (post: Post) => number;
}

const BOX = 5.2; // island footprint (plinth + hit target)
const FIT = BOX * 0.82;
const FLOOR_Y = -BOX * 0.5 + 0.4;
const BEACON_Y = Math.min(BOX * 0.5 - 0.5, FLOOR_Y + FIT + 0.3);
const EL_MIN = -0.5; // elevation (pitch) soft limits
const EL_MAX = 1.35;

export class MonumentIslands {
  readonly islands: Island[] = [];
  readonly layers: IslandLayer[] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly atmosphere: Atmosphere;
  private readonly opts: MonumentIslandsOptions;
  private readonly monByPost = new Map<string, Island>();

  private targetAzimuth = 0.6;
  private targetElevation = 0.5; // a touch higher so the cloud-sea reads
  private targetDistance: number;
  private readonly targetLook = new THREE.Vector3(0, 0, 0);
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3(0, 0, 0);
  private readonly focusDir = new THREE.Vector3(0, 0, 1);
  private focused: Island | null = null;
  private hovered: Island | null = null;
  private overlayOpen = false;
  private activeLayer = -1;
  private filterCat: string | null = null; // category filter; others fade back

  private dragging = false;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private startAz = 0;
  private startEl = 0;
  private azVel = 0; // flick momentum (radians/frame), decays after release
  private elVel = 0;
  private lastMoveX = 0;
  private lastMoveY = 0;

  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1);
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private readonly tmpRight = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly labelV = new THREE.Vector3();
  private highlight!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

  private floatAmp = 1.0;
  private autoRotate = false;
  private sunAngle = 0;
  private readonly SUN_BASE = new THREE.Vector3(-8, 16, 10);
  private radius = 40;
  private starfield?: Starfield;
  private dofAperture = 0.00003; // lerps up only when an island is focused

  /* signature elements + point effects */
  private sea?: Reflector;
  private halo!: THREE.Sprite; // glowing ring around the focused island
  private ripple!: THREE.Sprite; // expanding pulse on click
  private rippleT = 0; // 1 → 0 over the ripple's life
  private constellation!: THREE.LineSegments; // faint links between filtered islands
  private readonly catColorById = new Map<string, number>();

  /* post-processing */
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private bokehPass!: BokehPass;
  private skyTex?: THREE.CanvasTexture;

  private readonly frameListeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, opts: MonumentIslandsOptions) {
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

    // opaque in-scene sky so bloom / DOF composite over a real background
    this.skyTex = makeSkyTexture(SKIES["Peach Dusk"].bg);
    this.scene.background = this.skyTex;

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 4000);

    this.hemi = new THREE.HemisphereLight(0xfff3e6, 0xd9b9c4, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.35);
    this.sun.position.copy(this.SUN_BASE);
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight(0xd9e6ff, 0.4);
    rim.position.set(-6, 4, -8);
    this.scene.add(rim);

    this.targetDistance = 80;
    this.build(opts.posts, opts.categories);
    this.targetDistance = this.radius * 2.4 + 14;

    this.atmosphere = createAtmosphere(this.scene, this.radius * 2, this.radius * 2);
    this.starfield = createStarfield(this.scene, {
      shell: { inner: this.radius * 1.25, outer: this.radius * 3.2, yScale: 0.8 },
      size: this.radius * 0.03,
      opacity: 0.62,
    });

    this.highlight = new THREE.Mesh(
      new THREE.BoxGeometry(BOX, BOX, BOX),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.highlight.renderOrder = 2;
    this.scene.add(this.highlight);

    this.buildSignatureElements();
    this.buildComposer();

    this.camPos.copy(this.orbitDesired());
    this.bindEvents();
    this.emitState();
    this.frame();
  }

  /* ---------- post-processing pipeline ---------- */
  private buildComposer(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    // full-res, multisampled (crisp edges) + half-float (smooth bloom) target,
    // otherwise post-processing renders at 1× and looks low-resolution
    const rt = new THREE.WebGLRenderTarget(window.innerWidth * dpr, window.innerHeight * dpr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // depth-of-field — near-sharp at overview, blurs the background only when
    // you've flown into a single island (aperture is driven each frame)
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: this.targetDistance,
      aperture: 0.00003,
      maxblur: 0.005,
    });
    this.composer.addPass(this.bokehPass);

    // soft bloom — a dreamy haze + glowing beacons, not a washout
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.42, // strength
      0.5, // radius
      0.82, // threshold (only the brightest cores bloom)
    );
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());
  }

  /* ---------- signature elements: cloud-sea + halo/ripple/constellation ---------- */
  private buildSignatureElements(): void {
    // reflective "cloud sea" the islands float above (Monument-Valley water)
    const sea = new Reflector(new THREE.PlaneGeometry(this.radius * 8, this.radius * 8), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0xb6a6c2, // pale tint → misty, not a hard mirror
    });
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -this.radius * 0.7;
    this.scene.add(sea);
    this.sea = sea;

    // glowing halo ring around the focused island (blooms)
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: ringTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.halo.renderOrder = 3;
    this.scene.add(this.halo);

    // expanding pulse on click
    this.ripple = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: ringTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ripple.renderOrder = 3;
    this.ripple.visible = false;
    this.scene.add(this.ripple);

    // faint constellation links between islands of the filtered category
    const cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    this.constellation = new THREE.LineSegments(
      cgeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.constellation.visible = false;
    this.scene.add(this.constellation);
  }

  /* ---------- build ---------- */
  private build(posts: Post[], categories: CategoryConfig[]): void {
    const catIndex = new Map(categories.map((c, i) => [c.id, i]));
    categories.forEach((c) => this.catColorById.set(c.id, c.color));
    categories.forEach((c, i) =>
      this.layers.push({
        cat: c.id,
        name: c.districtName,
        index: i,
        count: posts.filter((p) => p.cat === c.id).length,
        centroid: new THREE.Vector3(),
      }),
    );

    // size the volume to the population, then scatter
    this.radius = Math.max(38, Math.cbrt(Math.max(1, posts.length)) * 13);
    const weights = this.opts.weightOf ? posts.map((p) => this.opts.weightOf!(p)) : undefined;
    const placed = scatter({
      count: posts.length,
      radius: this.radius,
      minDist: BOX * 2.7,
      seed: 20260611,
      weights,
      scaleRange: weights ? [0.85, 1.3] : [1, 1],
    });

    const counts = new Array(categories.length).fill(0);
    posts.forEach((post, i) => {
      const cat = categories[catIndex.get(post.cat) ?? 0];
      const d = catIndex.get(post.cat) ?? 0;
      const color = cat.palette[i % cat.palette.length];
      const { pos, scale } = placed[i];

      const root = new THREE.Group();
      root.position.copy(pos);
      root.scale.setScalar(scale);

      const plinth = new THREE.Mesh(cellPlinthGeometry(FLOOR_Y), plinthMaterial(color));
      root.add(plinth);

      const baked = monumentGeometry(i * 5 + 2, FIT);
      const monument = new THREE.Mesh(baked.geometry, monumentMaterials(color, baked.order));
      monument.position.y = FLOOR_Y;
      root.add(monument);

      // simple glowing dot shown when this island is filtered out
      const star = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTexture(),
          color: cat.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      star.scale.setScalar(1.6);
      star.position.y = BEACON_Y; // sits where the beacon glowed, for a continuous handoff
      star.visible = false;
      root.add(star);

      const beacon = new THREE.Mesh(
        beaconGeo(cat.beacon),
        new THREE.MeshStandardMaterial({
          color: cat.color,
          emissive: cat.color,
          emissiveIntensity: 0.55,
          flatShading: true,
          roughness: 0.5,
        }),
      );
      beacon.scale.setScalar(0.95);
      beacon.position.y = BEACON_Y;
      root.add(beacon);

      const gi = this.islands.length;
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(BOX, BOX + 3, BOX),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.userData.index = gi;
      root.add(hit);

      this.scene.add(root);
      const island: Island = {
        root,
        plinth,
        monument,
        beacon,
        star,
        hit,
        post,
        index: gi,
        worldPos: pos.clone(),
        scale,
        cullR: BOX * scale + 2,
        phase: (i % 17) * 0.61,
        dim: 0,
        lastDim: -1,
      };
      this.islands.push(island);
      this.monByPost.set(post.id, island);

      this.layers[d].centroid.add(pos);
      counts[d]++;
    });

    this.layers.forEach((l, d) => {
      if (counts[d]) l.centroid.multiplyScalar(1 / counts[d]);
    });
  }

  /* ---------- camera ---------- */
  private orbitDir(): THREE.Vector3 {
    const az = this.targetAzimuth;
    const el = this.targetElevation;
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }
  private orbitDesired(): THREE.Vector3 {
    return this.targetLook.clone().addScaledVector(this.orbitDir(), this.targetDistance);
  }

  /* ---------- public API ---------- */
  focus(post: Post): void {
    const island = this.monByPost.get(post.id);
    if (island) this.focusOn(island);
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
  resetView(): void {
    this.focused = null;
    this.activeLayer = -1;
    this.filterCat = null;
    this.targetLook.set(0, 0, 0);
    this.targetDistance = this.radius * 2.4 + 14;
    this.emitState();
  }
  /**
   * Category chips filter rather than navigate: since islands are scattered,
   * "spinToLayer" toggles a category filter — islands of other categories
   * shrink and fade back. Re-clicking the active category clears it.
   */
  spinToLayer(d: number): void {
    const cat = this.layers[d]?.cat ?? null;
    if (this.filterCat === cat) {
      this.filterCat = null;
      this.activeLayer = -1;
    } else {
      this.filterCat = cat;
      this.activeLayer = d;
      this.updateConstellation();
    }
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
      this.skyTex?.dispose();
      this.skyTex = makeSkyTexture(s.bg);
      this.scene.background = this.skyTex;
    }
    if (typeof tw.sunAngle === "number") this.sunAngle = tw.sunAngle;
    if (typeof tw.float === "number") this.floatAmp = tw.float;
    if (typeof tw.autoRotate === "boolean") this.autoRotate = tw.autoRotate;
  }

  onFrame(cb: () => void): void {
    this.frameListeners.push(cb);
  }

  /** Project a world point to screen pixels (for DOM labels). */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    this.labelV.set(x, y, z).project(this.camera);
    return {
      x: (this.labelV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.labelV.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  /** The hovered island's post + screen anchor, for the floating title label. */
  hoverInfo(): { post: Post; sx: number; sy: number } | null {
    const isl = this.hovered;
    if (!isl || this.gated) return null;
    const p = isl.root.position;
    const s = this.screenOf(p.x, p.y + (BEACON_Y + 1.6) * isl.scale, p.z);
    return { post: isl.post, sx: s.x, sy: s.y };
  }

  state(): IslandsState {
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

  private focusOn(island: Island): void {
    this.focused = island;
    this.azVel = this.elVel = 0;
    this.focusDir.copy(this.camPos).sub(this.camLook).normalize();

    // click pulse + halo tint in the island's category colour
    const c = this.catColorById.get(island.post.cat) ?? 0xffffff;
    (this.halo.material as THREE.SpriteMaterial).color.setHex(c);
    (this.ripple.material as THREE.SpriteMaterial).color.setHex(c);
    this.ripple.position.copy(island.root.position);
    this.ripple.visible = true;
    this.rippleT = 1;

    this.opts.onOpenReader(island.post);
    this.emitState();
  }

  private updateConstellation(): void {
    if (!this.filterCat) return; // frame fades it out; geometry left as-is
    const pts = this.islands.filter((i) => i.post.cat === this.filterCat).map((i) => i.worldPos);
    const out: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const near = pts
        .map((b, j) => ({ j, d: i === j ? Infinity : a.distanceToSquared(b) }))
        .sort((x, y) => x.d - y.d);
      for (let k = 0; k < Math.min(2, near.length); k++) {
        const b = pts[near[k].j];
        out.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    this.constellation.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(out), 3));
    (this.constellation.material as THREE.LineBasicMaterial).color.setHex(this.catColorById.get(this.filterCat) ?? 0xffffff);
  }

  /* ---------- input ---------- */
  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.gated) return;
      this.dragging = true;
      this.downX = this.lastMoveX = e.clientX;
      this.downY = this.lastMoveY = e.clientY;
      this.downTime = performance.now();
      this.startAz = this.targetAzimuth;
      this.startEl = this.targetElevation;
      this.azVel = this.elVel = 0; // grab kills any running momentum
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (this.dragging && !this.gated) {
        this.targetAzimuth = this.startAz - (e.clientX - this.downX) * 0.006;
        this.targetElevation = Math.max(EL_MIN, Math.min(EL_MAX, this.startEl + (e.clientY - this.downY) * 0.006));
        // remember the latest per-move delta as the release velocity (a flick)
        this.azVel = -(e.clientX - this.lastMoveX) * 0.006;
        this.elVel = (e.clientY - this.lastMoveY) * 0.006;
        this.lastMoveX = e.clientX;
        this.lastMoveY = e.clientY;
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
        // no hard clamp here — the frame loop rubber-bands at the limits (soft bounds)
        this.targetDistance *= 1 + (e.deltaY > 0 ? 0.08 : -0.08);
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
      this.composer.setSize(window.innerWidth, window.innerHeight);
      this.bloomPass.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ---------- render loop ---------- */
  private frame = (): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const k = Math.min(1, dt * 4);

    if (!this.gated && !this.dragging) {
      // flick momentum, decaying, then a gentle constant drift (floating in space)
      this.targetAzimuth += this.azVel;
      this.targetElevation += this.elVel;
      this.azVel *= 0.9;
      this.elVel *= 0.9;
      if (Math.abs(this.azVel) < 1e-4) this.azVel = 0;
      if (Math.abs(this.elVel) < 1e-4) this.elVel = 0;
      this.targetAzimuth += dt * (this.autoRotate ? 0.08 : 0.02);

      // soft pitch + zoom bounds: rubber-band back instead of hard-stopping
      if (this.targetElevation < EL_MIN) {
        this.targetElevation += (EL_MIN - this.targetElevation) * 0.2;
        this.elVel = 0;
      } else if (this.targetElevation > EL_MAX) {
        this.targetElevation += (EL_MAX - this.targetElevation) * 0.2;
        this.elVel = 0;
      }
    }
    const dMin = BOX * 1.8;
    const dMax = this.radius * 3.5;
    if (this.targetDistance < dMin) this.targetDistance += (dMin - this.targetDistance) * 0.25;
    else if (this.targetDistance > dMax) this.targetDistance += (dMax - this.targetDistance) * 0.25;

    this.starfield?.update(dt, t);

    if (this.focused) {
      const fd = BOX * 2.3 * this.focused.scale;
      const rs = BOX * 0.9 * this.focused.scale;
      this.tmpRight.crossVectors(this.UP, this.focusDir).normalize();
      this.desiredLook.copy(this.focused.worldPos).addScaledVector(this.tmpRight, rs);
      this.desiredPos.copy(this.desiredLook).addScaledVector(this.focusDir, fd);
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

    this.sun.position.copy(this.SUN_BASE).applyAxisAngle(this.UP, this.sunAngle);

    this.projScreen.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    const visibleHits: THREE.Object3D[] = [];
    for (const island of this.islands) {
      this.sphere.center.copy(island.worldPos);
      this.sphere.radius = island.cullR;
      const inView = this.frustum.intersectsSphere(this.sphere);
      if (!inView) {
        island.root.visible = false;
        continue;
      }
      island.root.visible = true;

      const focused = this.focused === island;
      // category filter: non-matching islands melt away, leaving a glowing star
      const matched = this.filterCat === null || island.post.cat === this.filterCat || focused;
      island.dim += ((matched ? 0 : 1) - island.dim) * Math.min(1, dt * 4);
      const e = island.dim;

      // eased, overlapping cross-fade so it never pops:
      //   body shrinks away (gone by ~0.82) while the star fades in (from ~0.2)
      const bt = Math.max(0, Math.min(1, 1 - e / 0.82));
      const bodyScale = bt * bt * (3 - 2 * bt); // smootherstep
      const starT = Math.max(0, Math.min(1, (e - 0.2) / 0.8));
      const bodyVisible = bodyScale > 0.02;

      if (Math.abs(e - island.lastDim) > 6e-4) {
        island.lastDim = e;
        island.plinth.visible = bodyVisible;
        island.monument.visible = bodyVisible;
        island.beacon.visible = bodyVisible;
        if (bodyVisible) {
          island.plinth.scale.setScalar(bodyScale);
          island.monument.scale.setScalar(bodyScale);
        }
        island.star.visible = starT > 0.02;
        (island.star.material as THREE.SpriteMaterial).opacity = starT * 0.92;
      }

      // keep the body alive (bob + beacon) the whole time it's on screen, and
      // dim the beacon as the star takes over at the same spot → smooth handoff
      if (bodyVisible) {
        const bob = Math.sin(t * 0.5 + island.phase) * 0.3 * this.floatAmp;
        island.root.position.set(island.worldPos.x, island.worldPos.y + bob, island.worldPos.z);
        const b = island.beacon;
        b.position.y = BEACON_Y + Math.sin(t * 1.3 + island.phase) * 0.14 * this.floatAmp;
        b.rotation.y += dt * 0.8;
        b.rotation.x += dt * 0.45;
        b.material.emissiveIntensity = (1.4 + (focused ? 1.1 : 0)) * (1 - starT * 0.9); // bright enough to bloom
      }
      if (e < 0.5) visibleHits.push(island.hit);
    }

    if (!this.gated && !this.dragging) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(visibleHits, false)[0];
      const nh = hit ? this.islands[hit.object.userData.index as number] : null;
      if (nh !== this.hovered) {
        this.hovered = nh;
        this.canvas.style.cursor = nh ? "pointer" : "grab";
      }
    } else if (this.hovered && this.gated) {
      this.hovered = null;
    }
    if (!this.hovered) this.canvas.style.cursor = this.dragging ? "grabbing" : "grab";

    const lit = this.focused || this.hovered;
    const want = lit ? (this.focused ? 0.14 : 0.08) : 0;
    if (lit) {
      this.highlight.position.copy(lit.root.position);
      this.highlight.scale.setScalar(lit.scale);
    }
    this.highlight.material.opacity += (want - this.highlight.material.opacity) * Math.min(1, dt * 8);
    this.highlight.visible = this.highlight.material.opacity > 0.005;

    // focus halo (glowing ring around the focused island)
    const haloMat = this.halo.material as THREE.SpriteMaterial;
    if (this.focused) {
      this.halo.position.copy(this.focused.root.position);
      this.halo.scale.setScalar(this.focused.scale * 9 + Math.sin(t * 1.6) * 0.3);
      haloMat.opacity += (0.85 - haloMat.opacity) * Math.min(1, dt * 5);
    } else {
      haloMat.opacity += (0 - haloMat.opacity) * Math.min(1, dt * 6);
    }
    this.halo.visible = haloMat.opacity > 0.01;

    // click ripple (expanding pulse)
    if (this.rippleT > 0) {
      this.rippleT -= dt * 1.5;
      if (this.rippleT <= 0) {
        this.rippleT = 0;
        this.ripple.visible = false;
      } else {
        const e = 1 - this.rippleT;
        this.ripple.scale.setScalar(BOX * (1 + e * 5));
        (this.ripple.material as THREE.SpriteMaterial).opacity = this.rippleT * 0.7;
      }
    }

    // constellation links (fade in while a category filter is active)
    const cMat = this.constellation.material as THREE.LineBasicMaterial;
    cMat.opacity += ((this.filterCat ? 0.24 : 0) - cMat.opacity) * Math.min(1, dt * 4);
    this.constellation.visible = cMat.opacity > 0.005;

    this.atmosphere.update(dt, t);
    for (const cb of this.frameListeners) cb();

    // DOF: sharp at overview, opens up to blur the background only on fly-in
    const apTarget = this.focused ? 0.0006 : 0.00003;
    this.dofAperture += (apTarget - this.dofAperture) * Math.min(1, dt * 3);
    const bu = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
    bu.focus.value = this.camPos.distanceTo(this.camLook);
    bu.aperture.value = this.dofAperture;
    this.composer.render();
  };
}
