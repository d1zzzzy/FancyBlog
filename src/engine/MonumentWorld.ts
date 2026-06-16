import * as THREE from "three";
import type { CategoryConfig, Post, Tweaks } from "../types";
import { mat, lighten, box } from "./geometry";
import { BUILDERS, beaconGeo, type Spinner } from "./builders";
import { SKIES } from "./skies";
import { createAtmosphere, type Atmosphere } from "./atmosphere";
import { createStarfield, type Starfield } from "./starfield";

/* ============================================================
   MonumentWorld — the reusable Monument-Valley-style 3D engine.

   It is content-agnostic: feed it posts + category configs and it
   raises a pastel skyline, one monument per post, grouped into one
   district per category. It owns the scene, camera, lights, controls
   and render loop, and reports state back through callbacks so the
   DOM/UI layer can stay completely separate.
   ============================================================ */

export type Mode = "street" | "overview";

export interface Monument {
  root: THREE.Group;
  group: THREE.Group;
  beacon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  post: Post;
  index: number; // global monument index
  district: number;
  local: number;
  color: number;
  height: number;
  cat: string;
  spinners: Spinner[];
  phase: number;
  hover: number;
  beaconBaseY: number;
  floatBlock?: boolean;
}

export interface District {
  cat: string;
  name: string;
  index: number;
  z: number;
  list: Monument[];
  count: number;
  centerX: number;
}

export interface EngineState {
  mode: Mode;
  activeDistrict: number;
  pos: number;
  index: number;
  focusIndex: number | null;
  hoveredIndex: number | null;
  hoverLabel: number;
  overlayOpen: boolean;
}

export interface MonumentWorldOptions {
  posts: Post[];
  categories: CategoryConfig[];
  /** called when a monument gains focus and its article should open */
  onOpenReader: (post: Post) => void;
  /** called on every structural state change (mode / district / focus) */
  onState?: (state: EngineState) => void;
}

/** Spacing + camera constants. */
const DX = 15; // spacing within a district row
const DZ = 18; // depth between district rows
const CAM_DIST = 90;

export class MonumentWorld {
  readonly DX = DX;
  readonly monuments: Monument[] = [];
  readonly districts: District[] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly atmosphere: Atmosphere;
  private readonly clickMeshes: THREE.Mesh[] = [];
  private readonly catById = new Map<string, CategoryConfig>();
  private readonly monByPost = new Map<string, Monument>();
  private readonly opts: MonumentWorldOptions;

  private readonly isoDir = new THREE.Vector3(1, 0.86, 1).normalize();
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private readonly RIGHT: THREE.Vector3;
  private viewSize = 9.4;

  /* interaction state */
  private pos = 0;
  private targetPos = 0;
  private azimuth = 0;
  private targetAzimuth = 0;
  private mode: Mode = "street";
  private activeDistrict = 0;
  private focused: Monument | null = null;
  private hovered: Monument | null = null;
  private hoverLabel = -1;
  private overlayOpen = false; // about / index sidebars

  private dragging = false;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private startAz = 0;

  private readonly mouse = new THREE.Vector2(0, 0);
  private readonly mouseTarget = new THREE.Vector2(0, 0);
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly camTarget = new THREE.Vector3(0, 3.0, 0);
  private readonly desired = new THREE.Vector3();
  private readonly projV = new THREE.Vector3();
  private readonly clock = new THREE.Clock();

  /* tweakable atmosphere/motion */
  private floatAmp = 1.0;
  private autoRotate = false;
  private autoSpin = 0;
  private sunAngle = 0;
  private readonly SUN_BASE = new THREE.Vector3(-7, 17, 9);

  private worldZ = 0;
  private starfield?: Starfield;
  private readonly OV_TARGET: THREE.Vector3;
  private readonly OV_VIEW: number;

  private readonly frameListeners: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, opts: MonumentWorldOptions) {
    this.canvas = canvas;
    this.opts = opts;
    for (const c of opts.categories) this.catById.set(c.id, c);

    /* renderer */
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* orthographic isometric camera */
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 600);
    this.RIGHT = new THREE.Vector3().crossVectors(this.isoDir, this.UP).normalize();
    this.updateOrtho();

    /* lights */
    this.hemi = new THREE.HemisphereLight(0xfff3e6, 0xd9b9c4, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const rim = new THREE.DirectionalLight(0xd9e6ff, 0.35);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);

    /* build the world from data */
    const maxCount = this.placeMonuments(opts.posts, opts.categories);
    const worldW = (maxCount - 1) * DX;
    this.worldZ = (opts.categories.length - 1) * DZ;
    this.OV_TARGET = new THREE.Vector3(12, 4.5, -this.worldZ / 2);
    this.OV_VIEW = Math.max(17, this.worldZ * 0.42);
    this.atmosphere = createAtmosphere(this.scene, worldW, this.worldZ);
    this.starfield = createStarfield(this.scene, {
      box: {
        size: new THREE.Vector3(worldW + 140, 70, this.worldZ + 140),
        center: new THREE.Vector3(worldW / 2, 16, -this.worldZ / 2),
      },
      attenuate: false,
      size: 3,
      opacity: 0.5,
      count: 360,
    });

    this.bindEvents();

    /* boot */
    this.activeDistrict = 0;
    this.mode = "street";
    this.pos = this.targetPos = 0;
    this.camTarget.set(0, 3.0, this.districts[0]?.z ?? 0);
    this.emitState();
    this.frame();
  }

  /* ---------- world construction ---------- */
  private placeMonuments(posts: Post[], categories: CategoryConfig[]): number {
    categories.forEach((cat, d) => {
      this.districts.push({
        cat: cat.id,
        name: cat.districtName,
        index: d,
        z: -d * DZ,
        list: [],
        count: 0,
        centerX: 0,
      });
    });

    categories.forEach((cat, d) => {
      const dz = -d * DZ;
      const list = posts.filter((p) => p.cat === cat.id);
      this.districts[d].count = list.length;
      this.districts[d].centerX = ((list.length - 1) * DX) / 2;

      list.forEach((post) => {
        const local = post.local;
        const pal = cat.palette;
        const color = pal[local % pal.length];
        const root = new THREE.Group();
        root.position.set(local * DX, 0, dz);

        /* plinth (floating island) */
        const plinth = new THREE.Group();
        plinth.add(box(8.4, 1.1, 8.4, mat(lighten(color, 0.42)), 0, -0.55, 0));
        plinth.add(box(7.0, 1.4, 7.0, mat(lighten(color, 0.3)), 0, -1.7, 0));
        plinth.add(box(5.2, 1.8, 5.2, mat(lighten(color, 0.18)), 0, -3.1, 0));
        root.add(plinth);

        /* structure (vary archetype by position) */
        const built = BUILDERS[(local + d) % BUILDERS.length](color);
        const group = built.group;
        const height = built.height;
        root.add(group);

        /* beacon — shape + colour encode the category */
        const beacon = new THREE.Mesh(
          beaconGeo(cat.beacon),
          new THREE.MeshStandardMaterial({
            color: cat.color,
            emissive: cat.color,
            emissiveIntensity: 0.55,
            flatShading: true,
            roughness: 0.55,
          }),
        );
        if (cat.beacon === "cone") beacon.rotation.y = Math.PI / 4;
        beacon.position.set(0, height + 1.7, 0);
        root.add(beacon);

        /* invisible click target */
        const gi = this.monuments.length;
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(8.4, height + 5.5, 8.4),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.position.y = (height + 1) / 2 - 2;
        hit.userData.index = gi;
        root.add(hit);
        this.clickMeshes.push(hit);

        this.scene.add(root);
        const mon: Monument = {
          root,
          group,
          beacon,
          post,
          index: gi,
          district: d,
          local,
          color,
          height,
          cat: cat.id,
          spinners: built.spinners || [],
          phase: Math.random() * Math.PI * 2,
          hover: 0,
          beaconBaseY: height + 1.7,
          floatBlock: built.floatBlock,
        };
        this.monuments.push(mon);
        this.districts[d].list.push(mon);
        this.monByPost.set(post.id, mon);
      });
    });

    return Math.max(1, ...this.districts.map((d) => d.count));
  }

  /* ---------- camera helpers ---------- */
  private updateOrtho(): void {
    const a = window.innerWidth / window.innerHeight;
    this.camera.left = -this.viewSize * a;
    this.camera.right = this.viewSize * a;
    this.camera.top = this.viewSize;
    this.camera.bottom = -this.viewSize;
    this.camera.updateProjectionMatrix();
  }

  private clampPos(v: number): number {
    return Math.max(0, Math.min(this.districts[this.activeDistrict].count - 1, v));
  }

  /* ---------- public navigation API ---------- */
  enterDistrict(d: number, local = 0): void {
    this.mode = "street";
    this.activeDistrict = d;
    this.targetPos = this.clampPos(local);
    this.pos = this.targetPos;
    this.camTarget.x = this.targetPos * DX;
    this.camTarget.z = this.districts[d].z;
    this.emitState();
  }

  enterOverview(): void {
    this.mode = "overview";
    this.focused = null;
    this.targetAzimuth = 0;
    this.emitState();
  }

  /** Focus a monument by its post (opens the reader). */
  focus(post: Post): void {
    const mon = this.monByPost.get(post.id);
    if (mon) this.doFocus(mon);
  }

  focusByIndex(i: number): void {
    const mon = this.monuments[i];
    if (mon) this.doFocus(mon);
  }

  /** Clear focus (call this when the reader closes). */
  blur(): void {
    this.focused = null;
    this.emitState();
  }

  private doFocus(mon: Monument): void {
    const switching = this.activeDistrict !== mon.district || this.mode === "overview";
    this.mode = "street";
    this.activeDistrict = mon.district;
    this.focused = mon;
    this.targetPos = mon.local;
    if (switching) {
      this.pos = mon.local;
      this.camTarget.x = mon.local * DX;
      this.camTarget.z = this.districts[mon.district].z;
    }
    this.targetAzimuth = 0;
    this.opts.onOpenReader(mon.post);
    this.emitState();
  }

  /** Tell the engine an external overlay (about / index) opened or closed. */
  setOverlay(open: boolean): void {
    this.overlayOpen = open;
    if (open) this.hovered = null;
    this.emitState();
  }

  /** Move within the active district (e.g. clicking a rail dot). */
  setPos(local: number): void {
    if (this.focused) this.blur();
    this.mode = "street";
    this.targetPos = this.clampPos(local);
  }

  setHoverLabel(index: number): void {
    this.hoverLabel = index;
    this.canvas.style.cursor = "pointer";
  }
  clearHoverLabel(index: number): void {
    if (this.hoverLabel === index) this.hoverLabel = -1;
  }

  /* ---------- tweaks (atmosphere + motion) ---------- */
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

  /* ---------- UI bridge ---------- */
  /** Register a per-frame callback (runs after camera update, before render). */
  onFrame(cb: () => void): void {
    this.frameListeners.push(cb);
  }

  /** Project a world point to screen pixels (keeps THREE out of the UI). */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    this.projV.set(x, y, z).project(this.camera);
    return {
      x: (this.projV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.projV.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  state(): EngineState {
    return {
      mode: this.mode,
      activeDistrict: this.activeDistrict,
      pos: this.pos,
      index: this.clampPos(Math.round(this.pos)),
      focusIndex: this.focused ? this.focused.index : null,
      hoveredIndex: this.hovered ? this.hovered.index : null,
      hoverLabel: this.hoverLabel,
      overlayOpen: this.overlayOpen,
    };
  }

  private emitState(): void {
    this.opts.onState?.(this.state());
  }

  private get gated(): boolean {
    return !!this.focused || this.overlayOpen;
  }

  /* ---------- input ---------- */
  private bindEvents(): void {
    window.addEventListener(
      "wheel",
      (e) => {
        if (this.gated || this.mode === "overview") return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.targetPos = this.clampPos(this.targetPos + d * 0.0018);
      },
      { passive: true },
    );

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.focused) return;
      this.dragging = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downTime = performance.now();
      this.startAz = this.targetAzimuth;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      this.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
      this.pointer.x = this.mouseTarget.x;
      this.pointer.y = -this.mouseTarget.y;
      if (this.dragging && !this.focused) {
        this.targetAzimuth = this.startAz + (e.clientX - this.downX) * 0.005;
        this.targetAzimuth = Math.max(-0.7, Math.min(0.7, this.targetAzimuth));
      }
    });
    const endDrag = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      const dt = performance.now() - this.downTime;
      if (dist < 6 && dt < 350 && this.hovered) this.doFocus(this.hovered);
      else this.targetAzimuth = 0;
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", () => {
      this.dragging = false;
      this.targetAzimuth = 0;
    });

    window.addEventListener("keydown", (e) => {
      if (this.gated) return;
      if (this.mode === "overview") {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Enter") {
          this.enterDistrict(this.activeDistrict, 0);
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        this.targetPos = this.clampPos(Math.round(this.targetPos) + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        this.targetPos = this.clampPos(Math.round(this.targetPos) - 1);
      }
      // quick jumps for long streets
      if (e.key === "Home") this.targetPos = 0;
      if (e.key === "End") this.targetPos = Math.max(0, this.districts[this.activeDistrict].count - 1);
      if (e.key === "PageUp") this.targetPos = this.clampPos(Math.round(this.targetPos) - 5);
      if (e.key === "PageDown") this.targetPos = this.clampPos(Math.round(this.targetPos) + 5);
      if (e.key === "[") {
        this.enterDistrict((this.activeDistrict - 1 + this.districts.length) % this.districts.length, 0);
      }
      if (e.key === "]") {
        this.enterDistrict((this.activeDistrict + 1) % this.districts.length, 0);
      }
    });

    window.addEventListener("resize", () => {
      this.updateOrtho();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ---------- render loop ---------- */
  private frame = (): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.pos += (this.targetPos - this.pos) * Math.min(1, dt * 5);
    this.azimuth += (this.targetAzimuth - this.azimuth) * Math.min(1, dt * 6);
    if (this.autoRotate && !this.focused && !this.dragging) this.autoSpin += dt * 0.05;
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * Math.min(1, dt * 4);
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * Math.min(1, dt * 4);

    /* zoom */
    const wantView = this.mode === "overview" ? this.OV_VIEW : this.focused ? 7.2 : 9.4;
    this.viewSize += (wantView - this.viewSize) * Math.min(1, dt * 4);
    this.updateOrtho();

    /* camera target */
    if (this.mode === "overview") {
      this.desired.copy(this.OV_TARGET);
    } else if (this.focused) {
      this.desired.set(
        this.focused.local * DX,
        this.focused.height * 0.42 + 0.6,
        this.districts[this.focused.district].z,
      );
      this.desired.addScaledVector(this.RIGHT, 4.6); // clear of reader panel
    } else {
      this.desired.set(this.pos * DX, 3.0, this.districts[this.activeDistrict].z);
    }
    this.camTarget.lerp(this.desired, Math.min(1, dt * 4));

    /* camera position (iso + orbit + auto-rotate + parallax) */
    const az = this.azimuth + this.autoSpin + (this.focused ? 0 : this.mouse.x * 0.12);
    const dir = this.isoDir.clone().applyAxisAngle(this.UP, az);
    this.camera.position.copy(this.camTarget).addScaledVector(dir, CAM_DIST);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.camTarget);

    /* sun follows the view */
    const so = this.SUN_BASE.clone().applyAxisAngle(this.UP, this.sunAngle);
    this.sun.position.copy(this.camTarget).add(so);
    this.sun.target.position.copy(this.camTarget);

    /* monuments: bob, hover, beacon, mechanisms */
    for (const mon of this.monuments) {
      const isHover =
        (this.hovered === mon || this.hoverLabel === mon.index) && !this.gated;
      mon.hover += ((isHover ? 1 : 0) - mon.hover) * Math.min(1, dt * 8);
      const bob = Math.sin(t * 0.55 + mon.phase) * 0.12 * this.floatAmp;
      const focused = this.focused === mon;
      mon.group.position.y = bob + mon.hover * 0.45 + (focused ? 0.2 : 0);
      mon.group.rotation.y = mon.hover * 0.04 * Math.sin(t * 2);
      for (const sp of mon.spinners) sp.obj.rotation.y += dt * sp.speed;
      const bb = Math.sin(t * 1.6 + mon.phase) * 0.18 * this.floatAmp;
      mon.beacon.position.y = mon.beaconBaseY + bb + mon.group.position.y;
      mon.beacon.rotation.y += dt * 0.8;
      mon.beacon.rotation.x += dt * 0.5;
      const flare = 0.55 + mon.hover * 1.4 + (focused ? 0.8 : 0);
      mon.beacon.material.emissiveIntensity = flare;
      mon.beacon.scale.setScalar(1 + mon.hover * 0.5);
    }

    /* hover raycast */
    if (!this.gated && !this.dragging) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.clickMeshes, false)[0];
      const nh = hit ? this.monuments[hit.object.userData.index as number] : null;
      if (nh !== this.hovered) {
        this.hovered = nh;
        this.canvas.style.cursor = nh ? "pointer" : this.dragging ? "grabbing" : "grab";
      }
    } else if (this.hovered && this.gated) {
      this.hovered = null;
    }
    if (!this.hovered && !this.focused) {
      this.canvas.style.cursor = this.dragging ? "grabbing" : "grab";
    }

    this.atmosphere.update(dt, t);
    this.starfield?.update(dt, t);

    for (const cb of this.frameListeners) cb();

    this.renderer.render(this.scene, this.camera);
  };
}
