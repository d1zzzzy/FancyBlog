import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mat, lighten } from "./geometry";
import { BUILDERS } from "./builders";

/* ============================================================
   Bake a real Monument-Valley monument (from BUILDERS) into a single,
   cheap, shareable mesh so it can sit inside a cube cell without the
   per-cell cost of ~10 separate meshes.

   - Geometry is merged into ONE BufferGeometry with up to two material
     groups (base tone + lightened accent), pre-scaled to fit a cell and
     translated to stand on the cell floor.
   - Geometry depends only on the archetype (shape), so it is cached and
     shared across every cell that uses that archetype (9 total).
   - Materials depend only on colour and are cached per colour.

   Trade-off vs the skyline: rotating mechanisms (spiral steps, dome ring)
   are baked static. The floating beacon keeps the cell alive.
   ============================================================ */

const REF = 0x808080; // sentinel base colour used only to classify parts

interface BakedGeo {
  geometry: THREE.BufferGeometry;
  /** material slot order matching the geometry's groups */
  order: Array<"base" | "accent">;
}

const geoCache = new Map<number, BakedGeo>();
const matCache = new Map<number, [THREE.Material, THREE.Material]>();
const plinthMatCache = new Map<number, THREE.Material>();
let plinthGeo: THREE.BufferGeometry | null = null;

/**
 * Merged, cell-sized geometry for a builder archetype (cached). The monument's
 * base sits at local y = 0 so the cell mesh can be positioned on the plinth and
 * scaled 0→1 to "rise" out of it as the camera approaches.
 */
export function monumentGeometry(builderIndex: number, fit: number): BakedGeo {
  const key = builderIndex % BUILDERS.length;
  const cached = geoCache.get(key);
  if (cached) return cached;

  const built = BUILDERS[key](REF);
  built.group.updateMatrixWorld(true);

  const baseGeos: THREE.BufferGeometry[] = [];
  const accentGeos: THREE.BufferGeometry[] = [];
  built.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
    const g = (m.geometry as THREE.BufferGeometry).clone().applyMatrix4(m.matrixWorld);
    const isBase = (m.material as THREE.MeshStandardMaterial).color.getHex() === REF;
    (isBase ? baseGeos : accentGeos).push(g);
  });

  const parts: THREE.BufferGeometry[] = [];
  const order: Array<"base" | "accent"> = [];
  if (baseGeos.length) {
    parts.push(mergeGeometries(baseGeos, false)!);
    order.push("base");
  }
  if (accentGeos.length) {
    parts.push(mergeGeometries(accentGeos, false)!);
    order.push("accent");
  }

  const geometry = mergeGeometries(parts, true)!; // groups follow `order`
  const s = fit / built.height;
  geometry.scale(s, s, s); // base stays at local y = 0

  const baked: BakedGeo = { geometry, order };
  geoCache.set(key, baked);
  return baked;
}

/** Small stepped pedestal every cell stands on (cached, shared geometry). */
export function cellPlinthGeometry(topY: number): THREE.BufferGeometry {
  if (plinthGeo) return plinthGeo;
  const a = new THREE.BoxGeometry(2.4, 0.4, 2.4).translate(0, topY - 0.2, 0);
  const b = new THREE.BoxGeometry(1.7, 0.5, 1.7).translate(0, topY - 0.62, 0);
  plinthGeo = mergeGeometries([a, b], false)!;
  return plinthGeo;
}

/** Lightened plinth material for a colour (cached). */
export function plinthMaterial(colorHex: number): THREE.Material {
  let m = plinthMatCache.get(colorHex);
  if (!m) {
    m = mat(lighten(colorHex, 0.34));
    plinthMatCache.set(colorHex, m);
  }
  return m;
}

/** Add a subtle fresnel rim light so the low-poly forms read like jewels. */
function addRim(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(0xfff1e6) };
    shader.uniforms.rimPower = { value: 2.6 };
    shader.uniforms.rimStrength = { value: 0.3 };
    shader.fragmentShader =
      "uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;\n" +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "float _rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), rimPower);\n" +
          "outgoingLight += rimColor * _rim * rimStrength;\n" +
          "#include <opaque_fragment>",
      );
  };
  return m;
}

/** Flat-shaded base + accent materials for a colour (cached). */
export function monumentMaterials(colorHex: number, order: Array<"base" | "accent">): THREE.Material | THREE.Material[] {
  let pair = matCache.get(colorHex);
  if (!pair) {
    pair = [addRim(mat(colorHex)), addRim(mat(lighten(colorHex, 0.16)))];
    matCache.set(colorHex, pair);
  }
  const mats = order.map((o) => (o === "base" ? pair![0] : pair![1]));
  return mats.length === 1 ? mats[0] : mats;
}
