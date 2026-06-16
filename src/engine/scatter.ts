import * as THREE from "three";

/* ============================================================
   Deterministic "islands in space" scatter.

   Places `count` points in a flattened spherical volume with a minimum
   spacing (rejection sampling), seeded so the field is stable across
   reloads. An optional per-item weight biases prominent items toward the
   centre and makes them larger — that's the hook for ranking later
   (recency, popularity, …): just pass a `weights` array.
   ============================================================ */

export interface Placed {
  pos: THREE.Vector3;
  scale: number;
}

export interface ScatterOptions {
  count: number;
  /** volume radius */
  radius: number;
  /** minimum spacing between islands (relaxed if packing gets tight) */
  minDist: number;
  seed?: number;
  /** vertical squash so the field reads as a drifting belt, not a ball */
  yScale?: number;
  /** per-item weight; higher = nearer centre + bigger. Omit for uniform. */
  weights?: number[];
  /** [min, max] island scale mapped from weight (default [1, 1]) */
  scaleRange?: [number, number];
}

export function scatter(o: ScatterOptions): Placed[] {
  let s = (o.seed ?? 1337) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const yScale = o.yScale ?? 0.62;
  const [smin, smax] = o.scaleRange ?? [1, 1];
  const w = o.weights;
  let wmin = Infinity;
  let wmax = -Infinity;
  if (w) for (const x of w) {
    wmin = Math.min(wmin, x);
    wmax = Math.max(wmax, x);
  }
  const norm = (i: number) => (!w || wmax === wmin ? 0.5 : (w[i] - wmin) / (wmax - wmin));

  const placed: Placed[] = [];
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i < o.count; i++) {
    const nw = norm(i); // 0..1, higher = more prominent
    let minDist = o.minDist;
    let pos: THREE.Vector3 | null = null;

    for (let tries = 0; tries < 48; tries++) {
      // uniform direction on the unit sphere
      const u = rnd() * 2 - 1;
      const theta = rnd() * Math.PI * 2;
      const rr = Math.sqrt(Math.max(0, 1 - u * u));
      // cube-root keeps points uniform through the volume; weight pulls inward
      const radius = o.radius * Math.cbrt(rnd()) * (1 - nw * 0.5);
      const cand = new THREE.Vector3(
        rr * Math.cos(theta) * radius,
        u * radius * yScale,
        rr * Math.sin(theta) * radius,
      );
      let ok = true;
      for (const p of pts) {
        if (p.distanceToSquared(cand) < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        pos = cand;
        break;
      }
      if (tries % 8 === 7) minDist *= 0.85; // relax to guarantee a slot
    }

    if (!pos) {
      pos = new THREE.Vector3(
        (rnd() * 2 - 1) * o.radius,
        (rnd() * 2 - 1) * o.radius * yScale,
        (rnd() * 2 - 1) * o.radius,
      );
    }
    pts.push(pos);
    placed.push({ pos, scale: smin + (smax - smin) * nw });
  }

  return placed;
}
