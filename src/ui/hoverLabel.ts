import type { CategoryConfig, Post } from "../types";
import { el } from "./util";

/* A single floating title label that follows the hovered island, so the
   field isn't anonymous before you click. One DOM node (not per-island),
   positioned each frame from the engine's hoverInfo(). */

interface LabelEngine {
  onFrame(cb: () => void): void;
  hoverInfo(): { post: Post; sx: number; sy: number } | null;
}

export function createHoverLabel(opts: { world: LabelEngine; categories: CategoryConfig[] }): void {
  const node = el(
    "div",
    "island-label",
    `<span class="il-chip"><span class="il-dot"></span><span class="il-cat"></span></span><span class="il-title"></span>`,
  );
  document.body.appendChild(node);
  const dot = node.querySelector<HTMLElement>(".il-dot")!;
  const catEl = node.querySelector<HTMLElement>(".il-cat")!;
  const titleEl = node.querySelector<HTMLElement>(".il-title")!;
  let curId = "";

  opts.world.onFrame(() => {
    const info = opts.world.hoverInfo();
    if (!info) {
      if (curId) {
        node.classList.remove("show");
        curId = "";
      }
      return;
    }
    if (info.post.id !== curId) {
      curId = info.post.id;
      const cat = opts.categories.find((c) => c.id === info.post.cat);
      dot.style.background = cat?.css ?? "";
      catEl.textContent = cat?.label ?? info.post.cat;
      titleEl.textContent = info.post.title;
      node.classList.add("show");
    }
    node.style.transform = `translate(${info.sx}px, ${info.sy}px) translate(-50%, -100%)`;
  });
}
