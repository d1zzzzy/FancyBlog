import type { CategoryConfig, Post } from "../types";
import { byId, el } from "./util";

/* The searchable "Index" sidebar that slides in from the left. */

export interface IndexSidebar {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export interface IndexOptions {
  posts: Post[];
  categories: CategoryConfig[];
  onSelect: (post: Post) => void;
  onToggle: (open: boolean) => void;
}

export function createIndexSidebar(opts: IndexOptions): IndexSidebar {
  const { posts, categories } = opts;
  const catOf = (id: string) => categories.find((c) => c.id === id);

  /* nav button */
  const indexBtn = el("button", "link-btn");
  indexBtn.id = "indexBtn";
  indexBtn.textContent = "Index";
  const navRight = document.querySelector(".nav-right")!;
  navRight.insertBefore(indexBtn, byId("aboutBtn"));

  /* sidebar */
  const aside = el("aside", "index");
  aside.id = "index";
  aside.innerHTML = `
    <div class="index-scrim"></div>
    <div class="index-panel">
      <header class="index-head">
        <div>
          <div class="index-title">Index</div>
          <div class="index-sub" id="indexCount"></div>
        </div>
        <button class="close" id="indexClose" aria-label="Close">✕</button>
      </header>
      <div class="index-search">
        <input id="indexSearch" type="text" placeholder="Search titles, words, categories…" autocomplete="off" />
        <button class="random-link" id="randomBtn">Random ⤳</button>
      </div>
      <div class="index-filters" id="indexFilters"></div>
      <div class="index-list" id="indexList"></div>
    </div>`;
  document.body.appendChild(aside);

  const listEl = byId<HTMLDivElement>("indexList");
  const countEl = byId<HTMLDivElement>("indexCount");
  const searchEl = byId<HTMLInputElement>("indexSearch");
  const filtersEl = byId<HTMLDivElement>("indexFilters");
  let filter = "all";
  let open = false;

  /* filter chips */
  [{ k: "all", label: "All" }, ...categories.map((c) => ({ k: c.id, label: c.districtName }))].forEach((f) => {
    const b = el("button", "ifilter" + (f.k === "all" ? " active" : ""));
    b.dataset.k = f.k;
    b.textContent = f.label;
    b.addEventListener("click", () => {
      filter = f.k;
      filtersEl.querySelectorAll(".ifilter").forEach((x) => x.classList.toggle("active", (x as HTMLElement).dataset.k === f.k));
      render();
    });
    filtersEl.appendChild(b);
  });

  function render(): void {
    const q = searchEl.value.trim().toLowerCase();
    const list = posts.filter((p) => {
      if (filter !== "all" && p.cat !== filter) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.excerpt} ${catOf(p.cat)?.label ?? ""} ${p.date}`.toLowerCase();
      return hay.includes(q);
    });
    const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);
    countEl.textContent = `${list.length} of ${posts.length} pieces`;
    listEl.innerHTML =
      years
        .map((y) => {
          const items = list.filter((p) => p.year === y).sort((a, b) => Number(a.n) - Number(b.n));
          return (
            `<div class="index-year">${y}</div>` +
            items
              .map(
                (p) => `
        <button class="index-item" data-id="${p.id}">
          <span class="ii-glyph ${p.cat}" style="background:${catOf(p.cat)?.css ?? ""}"></span>
          <span class="ii-main"><span class="ii-title">${p.title}</span><span class="ii-meta">${catOf(p.cat)?.label ?? p.cat} · ${p.date} · ${p.read}</span></span>
          <span class="ii-go">→</span>
        </button>`,
              )
              .join("")
          );
        })
        .join("") || `<div class="index-empty">Nothing matches “${q}”.</div>`;
    listEl.querySelectorAll<HTMLElement>(".index-item").forEach((it) => {
      it.addEventListener("click", () => {
        const p = posts.find((x) => x.id === it.dataset.id);
        api.close();
        if (p) opts.onSelect(p);
      });
    });
  }

  const api: IndexSidebar = {
    open() {
      open = true;
      aside.classList.add("open");
      render();
      opts.onToggle(true);
      setTimeout(() => searchEl.focus(), 80);
    },
    close() {
      open = false;
      aside.classList.remove("open");
      opts.onToggle(false);
    },
    isOpen: () => open,
  };

  indexBtn.addEventListener("click", () => (open ? api.close() : api.open()));
  aside.querySelector("#indexClose")!.addEventListener("click", () => api.close());
  aside.querySelector(".index-scrim")!.addEventListener("click", () => api.close());
  searchEl.addEventListener("input", render);
  aside.querySelector("#randomBtn")!.addEventListener("click", () => {
    const p = posts[Math.floor(Math.random() * posts.length)];
    api.close();
    opts.onSelect(p);
  });

  return api;
}
