/* Shared contracts between the content layer, the 3D engine and the UI.
   The engine is content-agnostic: it only knows about Post + CategoryConfig,
   never about "essays" or "photos" specifically. */

export type BeaconShape = "cone" | "icosahedron" | "box" | "octahedron";

/** One blog category = one "district" in the 3D world. */
export interface CategoryConfig {
  /** machine id, must match the post `category` frontmatter and the CSS glyph class */
  id: string;
  /** singular label shown on placards / reader, e.g. "Essay" */
  label: string;
  /** plural district name shown in overview / HUD, e.g. "Essays" */
  districtName: string;
  /** beacon + accent colour as a THREE hex number */
  color: number;
  /** same colour as a CSS string, for DOM glyphs */
  css: string;
  /** floating beacon shape that encodes the category */
  beacon: BeaconShape;
  /** monument base hues cycled through within this district */
  palette: number[];
}

/** A single article. `bodyHtml` is already rendered from Markdown. */
export interface Post {
  id: string;
  /** display number, e.g. "03" */
  n: string;
  /** category id */
  cat: string;
  title: string;
  /** human date string, e.g. "Feb 2026" */
  date: string;
  year: number;
  /** reading time, e.g. "5 min" */
  read: string;
  excerpt: string;
  /** rendered HTML body */
  bodyHtml: string;
  /** optional hero image url (resolved by the bundler) */
  image?: string;
  /** index within its own district — assigned by the loader */
  local: number;
}

export interface AboutConfig {
  title: string;
  lead: string;
  body: string[];
  contact: string[];
}

export interface SiteConfig {
  name: string;
  tagline: string;
  about: AboutConfig;
  categories: CategoryConfig[];
}

/** Atmosphere / motion settings persisted by the tweaks panel. */
export interface Tweaks {
  sky: string;
  sunAngle: number;
  float: number;
  autoRotate: boolean;
  labels: boolean;
}
