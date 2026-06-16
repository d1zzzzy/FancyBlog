import type { AboutConfig } from "../types";
import { byId } from "./util";

/* The centered "About" card. */

export interface About {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createAbout(about: AboutConfig, onToggle: (open: boolean) => void): About {
  const el = byId<HTMLDivElement>("about");
  const inner = byId<HTMLDivElement>("aboutInner");
  let open = false;

  inner.innerHTML = `
    <div class="about-portrait"><span>▦ Portrait · drop image here</span></div>
    <div class="r-cat">${about.title}</div>
    <h1 class="r-title" style="font-size:29px;margin-top:14px;">${about.lead}</h1>
    <div class="r-body" style="margin-top:22px;">${about.body.map((p) => `<p>${p}</p>`).join("")}</div>
    <div class="about-contact">${about.contact.map((c) => `<span>${c}</span>`).join("")}</div>`;

  const api: About = {
    open() {
      el.classList.add("open");
      open = true;
      onToggle(true);
    },
    close() {
      el.classList.remove("open");
      open = false;
      onToggle(false);
    },
    isOpen: () => open,
  };

  byId("aboutBtn").addEventListener("click", () => (open ? api.close() : api.open()));
  byId("aboutClose").addEventListener("click", () => api.close());
  byId("aboutScrim").addEventListener("click", () => api.close());
  return api;
}
