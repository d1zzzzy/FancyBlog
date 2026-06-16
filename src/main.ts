import "highlight.js/styles/atom-one-light.css";
import "./styles/styles.css";
import type { Post, Tweaks } from "./types";
import { SITE, LAYOUT } from "./content/site.config";
import { loadPosts } from "./content/loader";
import { MonumentWorld } from "./engine/MonumentWorld";
import { MonumentCube } from "./engine/MonumentCube";
import { MonumentIslands } from "./engine/MonumentIslands";
import { SKY_NAMES } from "./engine/skies";
import { createReader } from "./ui/reader";
import { createAbout, type About } from "./ui/about";
import { createIndexSidebar, type IndexSidebar } from "./ui/indexSidebar";
import { createHud } from "./ui/hud";
import { createCubeHud } from "./ui/cubeHud";
import { createHoverLabel } from "./ui/hoverLabel";
import { createTweaksPanel } from "./ui/tweaksPanel";
import { createRouter, type Router } from "./ui/router";
import { byId } from "./ui/util";

/* ============================================================
   Composition root — load content, pick a layout, wire the UI.
   The engine (skyline or cube) is the single source of truth for
   navigation; overlays drive it through a small common interface
   and react via onState.
   ============================================================ */

/** The slice of an engine the shared UI depends on — both layouts satisfy it. */
interface BlogEngine {
  focus(post: Post): void;
  blur(): void;
  setOverlay(open: boolean): void;
  applyTweaks(tw: Partial<Tweaks>): void;
  state(): { focusIndex: number | null; overlayOpen: boolean };
}

const posts = loadPosts();
const canvas = byId<HTMLCanvasElement>("scene");

/* brand text from config */
document.querySelectorAll<HTMLElement>("[data-site-name]").forEach((e) => (e.textContent = SITE.name));
const tagEl = document.querySelector<HTMLElement>("[data-site-tagline]");
if (tagEl) tagEl.innerHTML = SITE.tagline;
document.title = `${SITE.name} — a blog you wander through`;

/* forward references so callbacks can reach peers created later */
let world: BlogEngine;
let about: About;
let idx: IndexSidebar;
let router: Router | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let syncHud: ((s: any) => void) | undefined;
let setLabels: (visible: boolean) => void = () => {};
let resetView: () => void = () => {};

const refreshOverlay = () => world.setOverlay((about?.isOpen() ?? false) || (idx?.isOpen() ?? false));

const reader = createReader({
  posts,
  categories: SITE.categories,
  siteName: SITE.name,
  onSelect: (p) => world.focus(p),
  onClose: () => world.blur(),
});

/** open the reader and reflect the post in the URL */
const openReader = (p: Post) => {
  reader.open(p);
  router?.setPost(p);
};

const onState = (s: { focusIndex: number | null }) => {
  syncHud?.(s);
  if (s.focusIndex === null) {
    reader.close();
    router?.setPost(null);
  }
};

/* ---- pick the layout ---- */
if (LAYOUT === "islands") {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const islands = new MonumentIslands(canvas, {
    posts,
    categories: SITE.categories,
    onOpenReader: openReader,
    onState,
    // recency ranking: newer posts sit nearer the centre and grow a little
    weightOf: (p) => p.year * 12 + Math.max(0, months.findIndex((m) => p.date.toLowerCase().includes(m))),
  });
  const hud = createCubeHud({ world: islands, categories: SITE.categories, resetLabel: "All" });
  hud.sync(islands.state());
  createHoverLabel({ world: islands, categories: SITE.categories });
  world = islands;
  syncHud = hud.sync;
  setLabels = hud.setLabelsVisible;
  resetView = () => islands.resetView();
  setHint("drag to turn · scroll to zoom · click an island to enter · tap a category to filter · or search the Index");
} else if (LAYOUT === "cube") {
  const cube = new MonumentCube(canvas, {
    posts,
    categories: SITE.categories,
    onOpenReader: openReader,
    onState,
  });
  const hud = createCubeHud({ world: cube, categories: SITE.categories, resetLabel: "Cube" });
  hud.sync(cube.state());
  world = cube;
  syncHud = hud.sync;
  setLabels = hud.setLabelsVisible;
  resetView = () => cube.resetView();
  setHint("drag to turn the cube · scroll to zoom · click a cell to step inside");
} else {
  const skyline = new MonumentWorld(canvas, {
    posts,
    categories: SITE.categories,
    onOpenReader: openReader,
    onState,
  });
  const hud = createHud({ world: skyline, categories: SITE.categories });
  hud.sync(skyline.state());
  world = skyline;
  syncHud = hud.sync;
  setLabels = hud.setLabelsVisible;
  resetView = () => skyline.enterOverview();
  setHint("scroll / arrows to wander · Home · End · PgUp · PgDn to jump · drag to turn · click to read");
}

/* debug handle (mirrors the original window.__mv) */
(window as unknown as { __engine: BlogEngine; __posts: Post[] }).__engine = world;
(window as unknown as { __engine: BlogEngine; __posts: Post[] }).__posts = posts;

about = createAbout(SITE.about, refreshOverlay);
idx = createIndexSidebar({
  posts,
  categories: SITE.categories,
  onSelect: (p) => world.focus(p),
  onToggle: refreshOverlay,
});

createTweaksPanel({
  skies: SKY_NAMES,
  onChange: (tw: Tweaks) => {
    world.applyTweaks(tw);
    setLabels(tw.labels);
  },
});

/* hash routing: shareable / bookmarkable article URLs + browser back/forward */
router = createRouter({
  posts,
  siteName: SITE.name,
  onPost: (p) => world.focus(p),
  onHome: () => world.blur(),
});
router.start();

/* brand → reset */
byId("brand").addEventListener("click", () => {
  about.close();
  idx.close();
  world.blur();
  resetView();
});

/* global Escape: peel back the deepest open layer */
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const s = world.state();
  if (s.focusIndex !== null) world.blur();
  else if (about.isOpen()) about.close();
  else if (idx.isOpen()) idx.close();
  else resetView();
});

function setHint(text: string): void {
  const h = document.getElementById("hint");
  if (h) h.textContent = text;
}

/* hide the loader once fonts settle */
function hideLoader(): void {
  const l = document.getElementById("loader");
  if (!l) return;
  setTimeout(() => {
    l.classList.add("hidden");
    setTimeout(() => (l.style.display = "none"), 900);
  }, 400);
}
if (document.fonts?.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(hideLoader);
} else {
  hideLoader();
}
