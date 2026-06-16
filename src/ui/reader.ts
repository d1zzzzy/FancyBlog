import type { CategoryConfig, Post } from "../types";
import { byId, el } from "./util";

/* The sliding article reader on the right. Content-driven; navigation
   (next link) and close are delegated to callbacks so the engine stays
   the single source of truth for focus. Adds reading polish: a progress
   bar, click-to-zoom images, and copy buttons on code blocks. */

export interface ReaderOptions {
  posts: Post[];
  categories: CategoryConfig[];
  siteName: string;
  /** focus another post (next link) */
  onSelect: (post: Post) => void;
  /** user dismissed the reader */
  onClose: () => void;
}

export interface Reader {
  open(post: Post): void;
  close(): void;
  isOpen(): boolean;
}

function figure(post: Post): string {
  if (post.image) {
    return `<div class="r-figure" data-image="${post.image}" style="background-image:url('${post.image}');background-size:cover;background-position:center;"></div>`;
  }
  if (post.cat === "photo") return `<div class="r-figure"><span>▦ Photograph · add an image in frontmatter</span></div>`;
  if (post.cat === "project") return `<div class="r-figure"><span>▦ Project shot · add an image in frontmatter</span></div>`;
  return "";
}

export function createReader(opts: ReaderOptions): Reader {
  const root = byId<HTMLDivElement>("reader");
  const inner = byId<HTMLDivElement>("readerInner");
  const panel = inner.parentElement as HTMLElement; // the scrollable .panel
  const catOf = (id: string) => opts.categories.find((c) => c.id === id);
  let open = false;

  /* reading progress bar (tracks the panel's scroll) */
  const progress = el("div", "r-progress", "<i></i>");
  const progressFill = progress.firstElementChild as HTMLElement;
  panel.insertBefore(progress, panel.firstChild);
  const updateProgress = () => {
    const max = panel.scrollHeight - panel.clientHeight;
    progressFill.style.width = `${max > 0 ? (panel.scrollTop / max) * 100 : 0}%`;
  };
  panel.addEventListener("scroll", updateProgress, { passive: true });

  /* shared image lightbox */
  const lightbox = el("div", "lightbox", `<img alt="" />`);
  const lightImg = lightbox.firstElementChild as HTMLImageElement;
  document.body.appendChild(lightbox);
  lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
  const openLightbox = (src: string) => {
    lightImg.src = src;
    lightbox.classList.add("open");
  };

  /* image clicks anywhere in the body → lightbox */
  inner.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const bodyImg = target.closest<HTMLImageElement>(".r-image img");
    if (bodyImg) return openLightbox(bodyImg.src);
    const hero = target.closest<HTMLElement>(".r-figure[data-image]");
    if (hero?.dataset.image) openLightbox(hero.dataset.image);
  });

  function render(post: Post): void {
    const cat = catOf(post.cat);
    const idx = opts.posts.indexOf(post);
    const next = opts.posts[(idx + 1) % opts.posts.length];
    inner.style.setProperty("--mcolor", cat?.css ?? "");
    inner.innerHTML = `
      <div class="r-cat">${cat?.label ?? post.cat}</div>
      <div class="r-meta">${post.date} · ${post.read} · No.${post.n}</div>
      <h1 class="r-title">${post.title}</h1>
      ${figure(post)}
      <div class="r-body">${post.bodyHtml}</div>
      <div class="r-footer">
        <span>${opts.siteName} — No.${post.n}</span>
        <span class="nextlink" data-next="${next.id}">Next: ${next.title} →</span>
      </div>`;

    const nl = inner.querySelector<HTMLElement>(".nextlink");
    nl?.addEventListener("click", () => {
      const np = opts.posts.find((x) => x.id === nl.dataset.next);
      if (np) opts.onSelect(np);
    });

    // copy button on each code block (wrapped so it stays put while code scrolls)
    inner.querySelectorAll<HTMLPreElement>(".r-body pre").forEach((pre) => {
      const wrap = el("div", "code-wrap");
      pre.parentNode!.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      const btn = el("button", "copy-btn", "Copy");
      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.innerText ?? pre.innerText;
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "Copied";
        } catch {
          btn.textContent = "Press ⌘/Ctrl+C";
        }
        setTimeout(() => (btn.textContent = "Copy"), 1400);
      });
      wrap.appendChild(btn);
    });
  }

  byId("readerClose").addEventListener("click", () => opts.onClose());
  byId("scrim").addEventListener("click", () => opts.onClose());

  return {
    open(post: Post) {
      render(post);
      root.classList.add("open");
      open = true;
      panel.scrollTop = 0;
      updateProgress();
    },
    close() {
      root.classList.remove("open");
      open = false;
    },
    isOpen: () => open,
  };
}
