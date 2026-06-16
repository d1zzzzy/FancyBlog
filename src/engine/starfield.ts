import * as THREE from "three";

/* ============================================================
   Shared "floating dust" atmosphere — soft mid-tone motes that drift
   and twinkle. Used by all three layouts for a consistent feel.
   Two distributions: a radial `shell` (orbit layouts: islands / cube)
   or a `box` (the flat skyline). Mid-tone tints because white motes
   are invisible against the pale pastel sky.
   ============================================================ */

let _dotTex: THREE.CanvasTexture | null = null;
/** Soft round sprite, shared by the dust field and the filtered-out island stars. */
export function dotTexture(): THREE.CanvasTexture {
  if (_dotTex) return _dotTex;
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _dotTex = new THREE.CanvasTexture(cv);
  _dotTex.colorSpace = THREE.SRGBColorSpace;
  return _dotTex;
}

let _ringTex: THREE.CanvasTexture | null = null;
/** Soft glowing ring — for the focus halo and click ripple. */
export function ringTexture(): THREE.CanvasTexture {
  if (_ringTex) return _ringTex;
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.62, "rgba(255,255,255,0)");
  g.addColorStop(0.8, "rgba(255,255,255,1)");
  g.addColorStop(0.92, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _ringTex = new THREE.CanvasTexture(cv);
  _ringTex.colorSpace = THREE.SRGBColorSpace;
  return _ringTex;
}

const TINTS = [0xcf8a6e, 0xb083a4, 0x8fa3c4]; // terracotta · mauve · dusty blue

export interface Starfield {
  update(dt: number, t: number): void;
}

export interface StarfieldOptions {
  count?: number;
  size?: number;
  opacity?: number;
  attenuate?: boolean; // world-unit size (perspective) vs pixel size (ortho)
  spin?: number;
  /** radial shell distribution (orbit layouts) */
  shell?: { inner: number; outer: number; yScale?: number; center?: THREE.Vector3 };
  /** box distribution (the flat skyline) */
  box?: { size: THREE.Vector3; center?: THREE.Vector3 };
}

export function createStarfield(scene: THREE.Scene, o: StarfieldOptions): Starfield {
  const N = o.count ?? 520;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const tints = TINTS.map((h) => new THREE.Color(h));
  const center = o.shell?.center ?? o.box?.center ?? new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    if (o.box) {
      x = (Math.random() - 0.5) * o.box.size.x;
      y = (Math.random() - 0.5) * o.box.size.y;
      z = (Math.random() - 0.5) * o.box.size.z;
    } else {
      const sh = o.shell ?? { inner: 40, outer: 120, yScale: 0.8 };
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.max(0, 1 - u * u));
      const r = sh.inner + Math.random() * (sh.outer - sh.inner);
      x = rr * Math.cos(th) * r;
      y = u * r * (sh.yScale ?? 0.8);
      z = rr * Math.sin(th) * r;
    }
    pos[i * 3] = x; // centred at origin; the Points object carries the offset
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const c = tints[(Math.random() * tints.length) | 0];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const base = o.opacity ?? 0.6;
  const mat = new THREE.PointsMaterial({
    size: o.size ?? 1,
    sizeAttenuation: o.attenuate ?? true,
    map: dotTexture(),
    vertexColors: true,
    transparent: true,
    opacity: base,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.position.copy(center); // rotate about the field centre
  points.renderOrder = -2;
  scene.add(points);

  const spin = o.spin ?? (o.box ? 0 : 0.008);
  return {
    update(dt: number, t: number) {
      if (spin) points.rotation.y += dt * spin;
      mat.opacity = base + Math.sin(t * 0.5) * 0.08; // gentle twinkle
    },
  };
}
