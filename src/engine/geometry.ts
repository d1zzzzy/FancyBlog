import * as THREE from "three";

/* Low-level geometry helpers shared by the monument builders. */

/** Flat-shaded matte standard material — the pastel low-poly look. */
export function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });
}

/** Lerp a hex colour toward white by `t` (use negative t to keep as-is). */
export function lighten(hex: number, t: number): number {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t).getHex();
}

/** A shadow-casting/receiving box at (x,y,z). */
export function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
