import type { CategoryConfig } from "../types";
import type { EngineState, MonumentWorld } from "../engine/MonumentWorld";
import { byId, el } from "./util";

/* The heads-up display: bottom district switcher, dot rail, floating
   category placards, and the big overview district labels. It reads the
   engine's state every frame and positions DOM over the 3D world; it
   never touches the scene directly. */

export interface Hud {
  /** structural sync (district / mode / focus changed) */
  sync(state: EngineState): void;
  /** show/hide the floating placards (tweaks "labels") */
  setLabelsVisible(visible: boolean): void;
}

export interface HudOptions {
  world: MonumentWorld;
  categories: CategoryConfig[];
}

export function createHud(opts: HudOptions): Hud {
  const { world, categories } = opts;
  const cssOf = (id: string) => categories.find((c) => c.id === id)?.css ?? "";

  const dotsEl = byId<HTMLDivElement>("dots");
  const railLabel = byId<HTMLDivElement>("railLabel");

  /* big floating district labels (overview) */
  const districtLabelsWrap = el("div");
  districtLabelsWrap.id = "district-labels";
  document.body.appendChild(districtLabelsWrap);
  const districtLabelEls = world.districts.map((d) => {
    const node = el(
      "button",
      "district-label",
      `<span class="dl-name">${d.name}</span><span class="dl-count">${d.count} ${d.count === 1 ? "piece" : "pieces"}</span>`,
    );
    node.addEventListener("click", () => world.enterDistrict(d.index, 0));
    districtLabelsWrap.appendChild(node);
    return node;
  });

  /* bottom district switcher */
  const bar = el("div", "districts-bar");
  const ovBtn = el("button", "dchip overview-chip", `<span class="ov-glyph"></span>Overview`);
  ovBtn.addEventListener("click", () => {
    const s = world.state();
    if (s.mode === "overview") world.enterDistrict(s.activeDistrict, s.index);
    else world.enterOverview();
  });
  bar.appendChild(ovBtn);
  const chipEls = world.districts.map((d) => {
    const c = el(
      "button",
      "dchip",
      `<span class="dc-glyph ${d.cat}" style="background:${cssOf(d.cat)}"></span>${d.name}<span class="dc-n">${d.count}</span>`,
    );
    c.addEventListener("click", () => world.enterDistrict(d.index, 0));
    bar.appendChild(c);
    return c;
  });
  document.body.appendChild(bar);

  /* floating category placards (one per monument) */
  const labelsEl = el("div");
  labelsEl.id = "labels";
  document.body.appendChild(labelsEl);
  let hoverLabel = -1;
  const placards = world.monuments.map((mon) => {
    const node = el(
      "div",
      "placard",
      `<div class="chip"><span class="g ${mon.cat}" style="background:${cssOf(mon.cat)}"></span><span class="cat">${categories.find((c) => c.id === mon.cat)?.label ?? mon.cat}</span></div>
       <div class="title">${mon.post.title}</div>
       <div class="meta">No.${mon.post.n} · ${mon.post.read}</div>`,
    );
    node.addEventListener("click", () => {
      if (world.state().focusIndex === null) world.focus(mon.post);
    });
    node.addEventListener("pointerenter", () => {
      hoverLabel = mon.index;
      world.setHoverLabel(mon.index);
    });
    node.addEventListener("pointerleave", () => {
      if (hoverLabel === mon.index) hoverLabel = -1;
      world.clearHoverLabel(mon.index);
    });
    labelsEl.appendChild(node);
    return node;
  });

  /* ---------- structural sync ---------- */
  let dotEls: HTMLButtonElement[] = [];
  function sync(state: EngineState): void {
    const d = world.districts[state.activeDistrict];
    dotsEl.innerHTML = "";
    dotEls = d.list.map((mon, i) => {
      const b = el("button", "dot");
      b.title = mon.post.title;
      b.addEventListener("click", () => world.setPos(i));
      dotsEl.appendChild(b);
      return b as HTMLButtonElement;
    });
    chipEls.forEach((c, i) => c.classList.toggle("active", i === state.activeDistrict && state.mode === "street"));
    ovBtn.classList.toggle("active", state.mode === "overview");
  }

  /* ---------- per-frame positioning ---------- */
  function positionDistrictLabels(state: EngineState, hide: boolean): void {
    const show = state.mode === "overview" && !hide;
    for (const d of world.districts) {
      const node = districtLabelEls[d.index];
      if (!show) {
        node.style.opacity = "0";
        node.style.pointerEvents = "none";
        continue;
      }
      const p = world.screenOf(4 + d.index * 3.5, 7.4, d.z + 1);
      node.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      node.style.opacity = "1";
      node.style.pointerEvents = "auto";
      node.classList.toggle("active", d.index === state.activeDistrict);
    }
  }

  function positionPlacards(state: EngineState): void {
    const overlayOpen = state.focusIndex !== null || state.overlayOpen;
    labelsEl.classList.toggle("hidden", overlayOpen);
    positionDistrictLabels(state, overlayOpen);

    if (overlayOpen || state.mode === "overview") {
      for (const mon of world.monuments) {
        const node = placards[mon.index];
        node.style.opacity = "0";
        node.style.pointerEvents = "none";
      }
      return;
    }

    const center = Math.round(state.pos);
    for (const mon of world.monuments) {
      const node = placards[mon.index];
      if (mon.district !== state.activeDistrict) {
        node.style.opacity = "0";
        node.style.pointerEvents = "none";
        continue;
      }
      const anchorY = mon.height + 2.7 + mon.group.position.y;
      const p = world.screenOf(mon.local * world.DX, anchorY, world.districts[mon.district].z);
      const far = Math.abs(mon.local - state.pos);
      const op = far > 2.3 ? 0 : far > 1.6 ? (2.3 - far) / 0.7 : 1;
      node.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      node.style.opacity = op.toFixed(2);
      node.style.pointerEvents = op > 0.4 ? "auto" : "none";
      const expanded = mon.local === center || state.hoverLabel === mon.index || state.hoveredIndex === mon.index;
      node.classList.toggle("expanded", expanded && op > 0.4);
      node.classList.toggle("dim", !expanded);
    }
  }

  function updateRail(state: EngineState): void {
    if (state.mode === "overview") {
      dotEls.forEach((d) => d.classList.remove("active"));
      railLabel.textContent = `Overview · ${world.districts.length} districts`;
    } else {
      const idx = state.index;
      dotEls.forEach((d, i) => d.classList.toggle("active", i === idx));
      const dd = world.districts[state.activeDistrict];
      railLabel.textContent = `${dd.name} · ${String(idx + 1).padStart(2, "0")} / ${String(dd.count).padStart(2, "0")}`;
    }
  }

  world.onFrame(() => {
    const state = world.state();
    positionPlacards(state);
    updateRail(state);
  });

  return {
    sync,
    setLabelsVisible(visible: boolean) {
      labelsEl.style.display = visible ? "" : "none";
    },
  };
}
