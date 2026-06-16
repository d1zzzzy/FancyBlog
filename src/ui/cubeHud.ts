import type { CategoryConfig } from "../types";
import { byId, el } from "./util";

/* Minimal HUD shared by the cube + islands layouts: a bottom bar with one
   chip per category ("layer") plus a reset chip, and the rail label. Reuses
   the skyline's .districts-bar / .dchip styles. No placards or dot rail. */

/** The slice of an engine this HUD drives (cube and islands both satisfy it). */
interface ChipHudEngine {
  layers: ReadonlyArray<{ cat: string; name: string; index: number; count: number }>;
  spinToLayer(d: number): void;
  resetView(): void;
}

export interface ChipHudState {
  focusIndex: number | null;
  activeLayer: number;
}

export interface CubeHud {
  sync(state: ChipHudState): void;
  setLabelsVisible(visible: boolean): void;
}

export interface CubeHudOptions {
  world: ChipHudEngine;
  categories: CategoryConfig[];
  /** label for the reset/show-all chip (default "All") */
  resetLabel?: string;
}

export function createCubeHud(opts: CubeHudOptions): CubeHud {
  const { world, categories } = opts;
  const cssOf = (id: string) => categories.find((c) => c.id === id)?.css ?? "";
  const railLabel = byId<HTMLDivElement>("railLabel");

  const bar = el("div", "districts-bar");
  const resetBtn = el("button", "dchip overview-chip", `<span class="ov-glyph"></span>${opts.resetLabel ?? "All"}`);
  resetBtn.addEventListener("click", () => world.resetView());
  bar.appendChild(resetBtn);

  const chipEls = world.layers.map((layer) => {
    const c = el(
      "button",
      "dchip",
      `<span class="dc-glyph ${layer.cat}" style="background:${cssOf(layer.cat)}"></span>${layer.name}<span class="dc-n">${layer.count}</span>`,
    );
    c.addEventListener("click", () => world.spinToLayer(layer.index));
    bar.appendChild(c);
    return c;
  });
  document.body.appendChild(bar);

  function sync(state: ChipHudState): void {
    chipEls.forEach((c, i) => c.classList.toggle("active", i === state.activeLayer && state.focusIndex === null));
    const layer = world.layers[state.activeLayer];
    railLabel.textContent = layer ? `${layer.name} · ${layer.count} pieces` : "";
  }

  return {
    sync,
    setLabelsVisible(visible: boolean) {
      bar.style.display = visible ? "" : "none";
    },
  };
}
