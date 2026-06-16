import * as THREE from "three";
import type { BeaconShape } from "../types";
import { mat, lighten, box } from "./geometry";

/* ============================================================
   Monument builders — each returns { group, height, ... }.
   Structures are built upward from y = 0 (the plinth top).
   These are purely geometric and know nothing about blog content.
   ============================================================ */

export interface Spinner {
  obj: THREE.Object3D;
  speed: number;
}

export interface Built {
  group: THREE.Group;
  height: number;
  spinners?: Spinner[];
  floatBlock?: boolean;
}

function bZiggurat(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  let y = 0;
  const lv = 4;
  for (let i = 0; i < lv; i++) {
    const s = 5.2 - i * 1.05;
    const h = 0.85;
    g.add(box(s, h, s, m, 0, y + h / 2, 0));
    y += h;
  }
  const md = mat(lighten(c, 0.18));
  g.add(box(1.5, 1.5, 1.5, md, 0, y + 0.75, 0));
  return { group: g, height: y + 1.5 };
}

function bArch(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  const ph = 4.4;
  const pw = 1.2;
  g.add(box(pw, ph, 1.6, m, -1.9, ph / 2, 0));
  g.add(box(pw, ph, 1.6, m, 1.9, ph / 2, 0));
  g.add(box(5.2, 1.1, 1.6, m, 0, ph + 0.55, 0)); // lintel
  const md = mat(lighten(c, 0.16));
  g.add(box(2.0, 0.7, 2.0, md, 0, ph + 1.45, 0));
  return { group: g, height: ph + 1.8 };
}

function bTower(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  g.add(box(3.2, 5.4, 3.2, m, 0, 2.7, 0));
  g.add(box(3.8, 0.5, 3.8, m, 0, 5.6, 0)); // cornice
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.4, 4), mat(lighten(c, 0.14)));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 5.85 + 1.2;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(0.9, 1.3, 0.4, mat(lighten(c, -0.0)), 0, 3.4, 1.65)); // window notch
  return { group: g, height: 8.6 };
}

function bStairs(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  const n = 6;
  const sw = 3.4;
  const sh = 0.62;
  const sd = 0.95;
  for (let i = 0; i < n; i++) {
    g.add(box(sw, sh * (i + 1), sd, m, 0, (sh * (i + 1)) / 2, 2.4 - i * sd));
  }
  g.add(box(sw, 0.8, sd, mat(lighten(c, 0.16)), 0, sh * n + 0.4, 2.4 - n * sd + sd));
  g.add(box(sw + 0.6, 1.0, 1.1, m, 0, 0.5, 2.9)); // base lip
  return { group: g, height: sh * n + 0.9 };
}

function bTemple(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  g.add(box(5.4, 0.7, 5.4, m, 0, 0.35, 0)); // stylobate
  const ph = 3.4;
  const pp = 1.9;
  ([[-pp, -pp], [pp, -pp], [-pp, pp], [pp, pp]] as const).forEach(([x, z]) =>
    g.add(box(0.7, ph, 0.7, m, x, 0.7 + ph / 2, z)),
  );
  g.add(box(5.6, 0.9, 5.6, m, 0, 0.7 + ph + 0.45, 0)); // entablature
  g.add(box(2.0, 1.4, 2.0, mat(lighten(c, 0.16)), 0, 0.7 + ph + 0.9 + 0.7, 0));
  return { group: g, height: 0.7 + ph + 0.9 + 1.4 };
}

function bMonolith(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  g.add(box(2.0, 6.2, 2.0, m, 0, 3.1, 0));
  g.add(box(3.0, 0.7, 3.0, m, 0, 0.35, 0)); // base
  g.add(box(2.6, 0.8, 2.6, mat(lighten(c, 0.14)), 0, 7.6, 0)); // floating block
  return { group: g, height: 8.0, floatBlock: true };
}

function bSpiral(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  g.add(box(1.6, 6.0, 1.6, m, 0, 3.0, 0)); // core
  const md = mat(lighten(c, 0.12));
  const wind = new THREE.Group(); // rotating mechanism
  const steps = 11;
  const R = 1.9;
  for (let i = 0; i < steps; i++) {
    const a = i * 0.62;
    const y = 0.4 + i * 0.5;
    const s = box(1.7, 0.42, 1.0, md, Math.cos(a) * R, y, Math.sin(a) * R);
    s.rotation.y = -a;
    wind.add(s);
  }
  g.add(wind);
  return { group: g, height: 6.2, spinners: [{ obj: wind, speed: 0.16 }] };
}

function bDome(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  g.add(box(4.0, 3.6, 4.0, m, 0, 1.8, 0));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(lighten(c, 0.13)),
  );
  dome.position.y = 3.6;
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);
  const ring = new THREE.Group();
  const md = mat(lighten(c, 0.2));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.add(box(0.5, 1.0, 0.5, md, Math.cos(a) * 2.6, 0.5, Math.sin(a) * 2.6));
  }
  g.add(ring);
  g.add(box(0.5, 1.2, 0.5, mat(lighten(c, 0.16)), 0, 5.9 + 0.6, 0)); // spire stub
  return { group: g, height: 7.0, spinners: [{ obj: ring, speed: -0.1 }] };
}

function bTwin(c: number): Built {
  const g = new THREE.Group();
  const m = mat(c);
  const h1 = 5.0;
  const h2 = 3.6;
  g.add(box(2.2, h1, 2.2, m, -2.6, h1 / 2, 0));
  g.add(box(2.2, h2, 2.2, m, 2.6, h2 / 2, 0));
  g.add(box(5.0, 0.6, 1.2, mat(lighten(c, 0.14)), 0, h2 - 0.3, 0)); // bridge
  g.add(box(2.6, 0.7, 2.6, m, -2.6, h1 + 0.35, 0));
  return { group: g, height: h1 + 0.7 };
}

/** Archetypes cycled through so each district has rhythm. */
export const BUILDERS: Array<(c: number) => Built> = [
  bZiggurat, bArch, bTower, bStairs, bTemple, bMonolith, bSpiral, bDome, bTwin,
];

/** Beacon geometry per category — shape encodes the category. */
export function beaconGeo(shape: BeaconShape): THREE.BufferGeometry {
  switch (shape) {
    case "cone":
      return new THREE.ConeGeometry(0.44, 0.82, 4);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(0.44, 0);
    case "box":
      return new THREE.BoxGeometry(0.6, 0.6, 0.6);
    case "octahedron":
    default:
      return new THREE.OctahedronGeometry(0.5, 0);
  }
}
