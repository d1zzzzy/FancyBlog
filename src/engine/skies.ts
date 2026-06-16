import * as THREE from "three";

/* Sky themes — each drives the CSS page background, the scene lighting
   (hemisphere + sun colour), and (for post-processed layouts) an in-scene
   gradient background so bloom / DOF composite over an opaque sky.
   Keyed by the label shown in the tweaks panel. */

export interface Sky {
  /** CSS gradient applied to <body> / <html> / loader. */
  body: string;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  /** vertical gradient stops (top → bottom) for the in-scene sky texture */
  bg: number[];
}

export const SKIES: Record<string, Sky> = {
  "Peach Dusk": {
    body: "radial-gradient(120% 90% at 78% 8%, #fbe8cf 0%, rgba(251,232,207,0) 55%), linear-gradient(176deg, #f6ddc6 0%, #f1d4ce 42%, #e7cdd9 74%, #ddc6dd 100%)",
    hemiSky: 0xfff3e6,
    hemiGround: 0xd9b9c4,
    sun: 0xfff0dc,
    bg: [0xfbe8cf, 0xf6ddc6, 0xf1d4ce, 0xe7cdd9, 0xddc6dd],
  },
  "Mint Morning": {
    body: "radial-gradient(120% 90% at 76% 8%, #eaf6ec 0%, rgba(234,246,236,0) 55%), linear-gradient(176deg, #e6f1e6 0%, #dcebe4 42%, #d4e6e4 74%, #cfe0e2 100%)",
    hemiSky: 0xf0fbf0,
    hemiGround: 0xc3d6cf,
    sun: 0xf3ffe9,
    bg: [0xeaf6ec, 0xe6f1e6, 0xdcebe4, 0xd4e6e4, 0xcfe0e2],
  },
  "Lavender Haze": {
    body: "radial-gradient(120% 90% at 78% 8%, #efe6f7 0%, rgba(239,230,247,0) 55%), linear-gradient(176deg, #e9e1f3 0%, #e2d6ec 42%, #ddd0e6 74%, #d6c9e0 100%)",
    hemiSky: 0xf3ecff,
    hemiGround: 0xc9bcd6,
    sun: 0xfff0fb,
    bg: [0xefe6f7, 0xe9e1f3, 0xe2d6ec, 0xddd0e6, 0xd6c9e0],
  },
  "Slate Dawn": {
    body: "radial-gradient(120% 90% at 78% 8%, #e7edf3 0%, rgba(231,237,243,0) 55%), linear-gradient(176deg, #dfe6ee 0%, #d8dfe8 42%, #d4dae3 74%, #d0d2df 100%)",
    hemiSky: 0xeef4ff,
    hemiGround: 0xbcc4d2,
    sun: 0xfdf6ec,
    bg: [0xe7edf3, 0xdfe6ee, 0xd8dfe8, 0xd4dae3, 0xd0d2df],
  },
};

export const SKY_NAMES = Object.keys(SKIES);

/** Build a vertical gradient CanvasTexture for use as scene.background. */
export function makeSkyTexture(stops: number[]): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 4;
  cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  stops.forEach((hex, i) => g.addColorStop(i / (stops.length - 1), `#${hex.toString(16).padStart(6, "0")}`));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
