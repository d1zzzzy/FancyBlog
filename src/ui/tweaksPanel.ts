import type { Tweaks } from "../types";

/* The "Tweaks" panel (atmosphere / motion). Persists to localStorage and
   applies via the onChange callback. It stays hidden until a host editor
   activates it through the postMessage edit-mode protocol, so embedding the
   blog in an editor still works; standalone, it silently applies saved
   settings on load. */

const KEY = "mv_tweaks";
const DEFAULTS: Tweaks = {
  sky: "Peach Dusk",
  sunAngle: 0,
  float: 1,
  autoRotate: false,
  labels: true,
};

export interface TweaksPanelOptions {
  skies: string[];
  onChange: (tweaks: Tweaks) => void;
}

export function createTweaksPanel(opts: TweaksPanelOptions): void {
  const values: Tweaks = { ...DEFAULTS };
  try {
    Object.assign(values, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    /* ignore malformed storage */
  }

  // apply persisted settings immediately
  opts.onChange({ ...values });

  function setTweak<K extends keyof Tweaks>(key: K, val: Tweaks[K]): void {
    values[key] = val;
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      /* ignore */
    }
    opts.onChange({ ...values });
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*");
    } catch {
      /* not embedded */
    }
  }

  /* ---------- styles ---------- */
  const css = `
  .mvtweaks{position:fixed;top:84px;right:16px;z-index:2147483646;width:268px;
    background:var(--card,#faf3e9);border:1px solid var(--line,#e6d8cf);border-radius:14px;
    box-shadow:0 24px 60px rgba(120,80,90,.22);font-family:var(--body,sans-serif);
    color:var(--ink,#4b3f4a);overflow:hidden;transform:translateY(8px);opacity:0;
    transition:opacity .25s ease, transform .25s ease;pointer-events:none;}
  .mvtweaks.show{opacity:1;transform:none;pointer-events:auto;}
  .mvt-head{display:flex;align-items:center;justify-content:space-between;
    padding:14px 16px;border-bottom:1px solid var(--line,#e6d8cf);}
  .mvt-head b{font-family:var(--display,sans-serif);font-weight:700;font-size:15px;letter-spacing:-.01em;}
  .mvt-close{width:26px;height:26px;border-radius:50%;border:1px solid var(--line,#e6d8cf);
    background:none;color:var(--ink,#4b3f4a);cursor:pointer;font-size:12px;display:grid;place-items:center;}
  .mvt-close:hover{border-color:var(--accent,#e8654a);color:var(--accent-ink,#c4452f);}
  .mvt-body{padding:6px 16px 16px;}
  .mvt-sec{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--sub,#9c8b93);margin:16px 0 9px;}
  .mvt-row{margin:11px 0;}
  .mvt-row .lab{display:flex;justify-content:space-between;align-items:baseline;
    font-size:12.5px;margin-bottom:7px;}
  .mvt-row .lab span:last-child{font-family:var(--mono,monospace);font-size:11px;color:var(--sub,#9c8b93);}
  .mvt-row input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:3px;border-radius:3px;
    background:var(--line,#e6d8cf);outline:none;}
  .mvt-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
    background:var(--accent,#e8654a);cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2);}
  .mvt-row input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--accent,#e8654a);
    cursor:pointer;border:2px solid #fff;}
  .mvt-seg{display:flex;background:#f1e8db;border-radius:9px;padding:3px;gap:3px;flex-wrap:wrap;}
  .mvt-seg button{flex:1;min-width:46%;font-family:var(--body,sans-serif);font-size:11.5px;border:0;background:none;
    color:var(--sub,#9c8b93);padding:7px 6px;border-radius:7px;cursor:pointer;transition:background .2s,color .2s;}
  .mvt-seg button.on{background:#fff;color:var(--ink,#4b3f4a);box-shadow:0 1px 4px rgba(120,80,90,.12);}
  .mvt-toggle{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;cursor:pointer;}
  .mvt-sw{width:38px;height:22px;border-radius:999px;background:var(--line,#e6d8cf);position:relative;transition:background .2s;flex:none;}
  .mvt-sw::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;
    transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
  .mvt-sw.on{background:var(--accent,#e8654a);}
  .mvt-sw.on::after{transform:translateX(16px);}
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- build panel ---------- */
  const panel = document.createElement("div");
  panel.className = "mvtweaks";
  panel.innerHTML = `
    <div class="mvt-head"><b>Tweaks</b><button class="mvt-close" aria-label="Close">✕</button></div>
    <div class="mvt-body"></div>`;
  const body = panel.querySelector(".mvt-body") as HTMLDivElement;
  document.body.appendChild(panel);

  function addSection(label: string): void {
    const d = document.createElement("div");
    d.className = "mvt-sec";
    d.textContent = label;
    body.appendChild(d);
  }
  function addSlider(label: string, key: keyof Tweaks, min: number, max: number, step: number, unit?: string): void {
    const row = document.createElement("div");
    row.className = "mvt-row";
    const fmt = (v: number) => (step < 1 ? Number(v).toFixed(step < 0.1 ? 2 : 1) : String(v)) + (unit || "");
    row.innerHTML = `<div class="lab"><span>${label}</span><span class="val">${fmt(values[key] as number)}</span></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${values[key]}">`;
    const input = row.querySelector("input") as HTMLInputElement;
    const val = row.querySelector(".val") as HTMLSpanElement;
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      setTweak(key, v as Tweaks[typeof key]);
    });
    body.appendChild(row);
  }
  function addSegment(label: string, key: keyof Tweaks, options: string[]): void {
    const row = document.createElement("div");
    row.className = "mvt-row";
    row.innerHTML = `<div class="lab"><span>${label}</span><span></span></div><div class="mvt-seg"></div>`;
    const seg = row.querySelector(".mvt-seg") as HTMLDivElement;
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.textContent = opt;
      b.className = values[key] === opt ? "on" : "";
      b.addEventListener("click", () => {
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        setTweak(key, opt as Tweaks[typeof key]);
      });
      seg.appendChild(b);
    });
    body.appendChild(row);
  }
  function addToggle(label: string, key: keyof Tweaks): void {
    const row = document.createElement("div");
    row.className = "mvt-row";
    row.innerHTML = `<div class="mvt-toggle"><span>${label}</span><span class="mvt-sw ${values[key] ? "on" : ""}"></span></div>`;
    const sw = row.querySelector(".mvt-sw") as HTMLSpanElement;
    (row.querySelector(".mvt-toggle") as HTMLElement).addEventListener("click", () => {
      const v = !sw.classList.contains("on");
      sw.classList.toggle("on", v);
      setTweak(key, v as Tweaks[typeof key]);
    });
    body.appendChild(row);
  }

  addSection("Atmosphere");
  addSegment("Sky", "sky", opts.skies);
  addSlider("Sun angle", "sunAngle", -1.2, 1.2, 0.05, "");
  addSection("Motion");
  addSlider("Float", "float", 0, 2, 0.1, "×");
  addToggle("Auto-wander", "autoRotate");
  addSection("Wayfinding");
  addToggle("Show placards", "labels");

  /* ---------- host edit-mode protocol ---------- */
  const show = () => panel.classList.add("show");
  const hide = () => panel.classList.remove("show");
  (panel.querySelector(".mvt-close") as HTMLElement).addEventListener("click", () => {
    hide();
    try {
      window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
    } catch {
      /* not embedded */
    }
  });
  window.addEventListener("message", (e: MessageEvent) => {
    const t = e?.data?.type;
    if (t === "__activate_edit_mode") show();
    else if (t === "__deactivate_edit_mode") hide();
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch {
    /* not embedded */
  }
}
