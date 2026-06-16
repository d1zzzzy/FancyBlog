/* Greyroom/Monuments — offline build: uses the global THREE from three.min.js (UMD) */

/* ============================================================
   Monuments — a Monument-Valley-style spatial blog.
   Orthographic isometric world, pastel low-poly monuments,
   soft long shadows. Each monument is an article.
   ============================================================ */

const DATA = window.BLOG_DATA;
const POSTS = DATA.posts;

/* pastel base hues — lighting splits each face into 3 tones */
const PALETTE = [
  0xe8927c, // coral
  0xe9b44c, // marigold
  0x8fb7a6, // sage
  0xa68bc4, // lavender
  0xd98e73, // terracotta
  0x6fa8a0, // teal
  0xce8fa9, // mauve
  0xe0c27e, // sand
  0x89a7c4, // dusty blue
];
const ACCENT = 0xe8654a;        // warm beacon
/* category language: each type gets a consistent colour, glyph & beacon shape */
const CAT = {
  essay:   { label: "Essay",      color: 0xd9714f, css: "#cf6a4a", glyph: "essay" },
  photo:   { label: "Photograph", color: 0x5e8fb0, css: "#5784a6", glyph: "photo" },
  note:    { label: "Note",       color: 0xcf9a36, css: "#bf8e2f", glyph: "note" },
  project: { label: "Project",    color: 0x5e9e8a, css: "#4f9482", glyph: "project" },
};
const CAT_LABEL = { essay: CAT.essay.label, photo: CAT.photo.label, note: CAT.note.label, project: CAT.project.label };
function beaconGeo(cat) {
  if (cat === "essay") return new THREE.ConeGeometry(0.44, 0.82, 4);
  if (cat === "photo") return new THREE.IcosahedronGeometry(0.44, 0);
  if (cat === "note")  return new THREE.BoxGeometry(0.6, 0.6, 0.6);
  return new THREE.OctahedronGeometry(0.5, 0); // project
}

/* ---------- renderer ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

/* ---------- orthographic isometric camera ---------- */
const isoDir = new THREE.Vector3(1, 0.86, 1).normalize();   // view direction (toward origin)
const CAM_DIST = 90;
let viewSize = 9.4;                                          // half-height in world units
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 600);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3().crossVectors(isoDir, UP).normalize(); // screen-right in world

function updateOrtho() {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -viewSize * a; camera.right = viewSize * a;
  camera.top = viewSize; camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
}
updateOrtho();

/* ---------- lights (soft three-tone faces + long shadow) ---------- */
const hemi = new THREE.HemisphereLight(0xfff3e6, 0xd9b9c4, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
sun.shadow.bias = -0.0008;
sun.shadow.radius = 5;
scene.add(sun);
scene.add(sun.target);
const rim = new THREE.DirectionalLight(0xd9e6ff, 0.35);
rim.position.set(-6, 3, -5);
scene.add(rim);

/* ============================================================
   Geometry helpers
   ============================================================ */
function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, metalness: 0 });
}
function lighten(hex, t) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t).getHex();
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/* ============================================================
   Monument builders — each returns { group, height }.
   Structures are built upward from y = 0 (the plinth top).
   ============================================================ */
function bZiggurat(c) {
  const g = new THREE.Group(); const m = mat(c);
  let y = 0; const lv = 4;
  for (let i = 0; i < lv; i++) {
    const s = 5.2 - i * 1.05, h = 0.85;
    g.add(box(s, h, s, m, 0, y + h / 2, 0));
    y += h;
  }
  const md = mat(lighten(c, 0.18));
  g.add(box(1.5, 1.5, 1.5, md, 0, y + 0.75, 0));
  return { group: g, height: y + 1.5 };
}

function bArch(c) {
  const g = new THREE.Group(); const m = mat(c);
  const ph = 4.4, pw = 1.2;
  g.add(box(pw, ph, 1.6, m, -1.9, ph / 2, 0));
  g.add(box(pw, ph, 1.6, m, 1.9, ph / 2, 0));
  g.add(box(5.2, 1.1, 1.6, m, 0, ph + 0.55, 0));   // lintel
  const md = mat(lighten(c, 0.16));
  g.add(box(2.0, 0.7, 2.0, md, 0, ph + 1.45, 0));
  return { group: g, height: ph + 1.8 };
}

function bTower(c) {
  const g = new THREE.Group(); const m = mat(c);
  g.add(box(3.2, 5.4, 3.2, m, 0, 2.7, 0));
  g.add(box(3.8, 0.5, 3.8, m, 0, 5.6, 0));           // cornice
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.4, 4), mat(lighten(c, 0.14)));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 5.85 + 1.2; roof.castShadow = true;
  g.add(roof);
  // little window notch
  g.add(box(0.9, 1.3, 0.4, mat(lighten(c, -0.0)), 0, 3.4, 1.65));
  return { group: g, height: 8.6 };
}

function bStairs(c) {
  const g = new THREE.Group(); const m = mat(c);
  const n = 6, sw = 3.4, sh = 0.62, sd = 0.95;
  for (let i = 0; i < n; i++) {
    g.add(box(sw, sh * (i + 1), sd, m, 0, sh * (i + 1) / 2, 2.4 - i * sd));
  }
  g.add(box(sw, 0.8, sd, mat(lighten(c, 0.16)), 0, sh * n + 0.4, 2.4 - n * sd + sd));
  g.add(box(sw + 0.6, 1.0, 1.1, m, 0, 0.5, 2.9));     // base lip
  return { group: g, height: sh * n + 0.9 };
}

function bTemple(c) {
  const g = new THREE.Group(); const m = mat(c);
  g.add(box(5.4, 0.7, 5.4, m, 0, 0.35, 0));           // stylobate
  const ph = 3.4, pp = 1.9;
  [[-pp, -pp], [pp, -pp], [-pp, pp], [pp, pp]].forEach(([x, z]) =>
    g.add(box(0.7, ph, 0.7, m, x, 0.7 + ph / 2, z)));
  g.add(box(5.6, 0.9, 5.6, m, 0, 0.7 + ph + 0.45, 0)); // entablature
  g.add(box(2.0, 1.4, 2.0, mat(lighten(c, 0.16)), 0, 0.7 + ph + 0.9 + 0.7, 0));
  return { group: g, height: 0.7 + ph + 0.9 + 1.4 };
}

function bMonolith(c) {
  const g = new THREE.Group(); const m = mat(c);
  g.add(box(2.0, 6.2, 2.0, m, 0, 3.1, 0));
  g.add(box(3.0, 0.7, 3.0, m, 0, 0.35, 0));           // base
  // floating block above (impossible float) — handled as part of structure
  g.add(box(2.6, 0.8, 2.6, mat(lighten(c, 0.14)), 0, 7.6, 0));
  return { group: g, height: 8.0, floatBlock: true };
}

function bSpiral(c) {
  const g = new THREE.Group(); const m = mat(c);
  g.add(box(1.6, 6.0, 1.6, m, 0, 3.0, 0));            // core
  const md = mat(lighten(c, 0.12));
  const wind = new THREE.Group();                     // rotating mechanism
  const steps = 11, R = 1.9;
  for (let i = 0; i < steps; i++) {
    const a = i * 0.62, y = 0.4 + i * 0.5;
    const s = box(1.7, 0.42, 1.0, md, Math.cos(a) * R, y, Math.sin(a) * R);
    s.rotation.y = -a;
    wind.add(s);
  }
  g.add(wind);
  return { group: g, height: 6.2, spinners: [{ obj: wind, speed: 0.16 }] };
}

function bDome(c) {
  const g = new THREE.Group(); const m = mat(c);
  g.add(box(4.0, 3.6, 4.0, m, 0, 1.8, 0));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(lighten(c, 0.13))
  );
  dome.position.y = 3.6; dome.castShadow = true; dome.receiveShadow = true;
  g.add(dome);
  // slowly turning ring of pylons around the drum (mechanism)
  const ring = new THREE.Group();
  const md = mat(lighten(c, 0.2));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.add(box(0.5, 1.0, 0.5, md, Math.cos(a) * 2.6, 0.5, Math.sin(a) * 2.6));
  }
  g.add(ring);
  g.add(box(0.5, 1.2, 0.5, mat(lighten(c, 0.16)), 0, 5.9 + 0.6, 0)); // spire stub
  return { group: g, height: 7.0, spinners: [{ obj: ring, speed: -0.1 }] };
}

function bTwin(c) {
  const g = new THREE.Group(); const m = mat(c);
  const h1 = 5.0, h2 = 3.6;
  g.add(box(2.2, h1, 2.2, m, -2.6, h1 / 2, 0));
  g.add(box(2.2, h2, 2.2, m, 2.6, h2 / 2, 0));
  g.add(box(5.0, 0.6, 1.2, mat(lighten(c, 0.14)), 0, h2 - 0.3, 0)); // bridge
  g.add(box(2.6, 0.7, 2.6, m, -2.6, h1 + 0.35, 0));
  return { group: g, height: h1 + 0.7 };
}

const BUILDERS = [bZiggurat, bArch, bTower, bStairs, bTemple, bMonolith, bSpiral, bDome, bTwin];

/* ============================================================
   Place monuments in four category districts (rows stacked in depth)
   ============================================================ */
const DX = 15;                  // spacing within a district row
const DZ = 18;                  // depth between district rows
const DISTRICT_NAME = { essay: "Essays", photo: "Photographs", note: "Notes", project: "Projects" };
const DISTRICT_PALETTE = {
  essay:   [0xe8927c, 0xd98e73, 0xe0a98b, 0xcf7e63, 0xe7b59c],
  photo:   [0x89a7c4, 0x6fa8a0, 0x7f9fc0, 0x5e9aa8, 0x9ab6cf],
  note:    [0xe9b44c, 0xe0c27e, 0xceaf6a, 0xd9a94f, 0xeac98a],
  project: [0x8fb7a6, 0x6fa8a0, 0x7faa8e, 0x5e9e8a, 0xa3c1b2],
};
const CATEGORIES = DATA.categories || ["essay", "photo", "note", "project"];

const monuments = [];
const clickMeshes = [];
const districts = CATEGORIES.map((cat, d) => ({
  cat, name: DISTRICT_NAME[cat] || cat, index: d, z: -d * DZ, list: [], count: 0, centerX: 0,
}));

CATEGORIES.forEach((cat, d) => {
  const dz = -d * DZ;
  const list = POSTS.filter((p) => p.cat === cat);
  districts[d].count = list.length;
  districts[d].centerX = ((list.length - 1) * DX) / 2;

  list.forEach((post, local) => {
    const pal = DISTRICT_PALETTE[cat];
    const color = pal[local % pal.length];
    const root = new THREE.Group();
    root.position.set(local * DX, 0, dz);

    // plinth (floating island)
    const plinth = new THREE.Group();
    plinth.add(box(8.4, 1.1, 8.4, mat(lighten(color, 0.42)), 0, -0.55, 0));
    plinth.add(box(7.0, 1.4, 7.0, mat(lighten(color, 0.3)), 0, -1.7, 0));
    plinth.add(box(5.2, 1.8, 5.2, mat(lighten(color, 0.18)), 0, -3.1, 0));
    root.add(plinth);

    // structure (vary archetype by position so each district has rhythm)
    const built = BUILDERS[(local + d) % BUILDERS.length](color);
    const group = built.group, height = built.height, floatBlock = built.floatBlock;
    const spinners = built.spinners || [];
    root.add(group);

    // beacon — shape + colour encode the category
    const beacon = new THREE.Mesh(
      beaconGeo(cat),
      new THREE.MeshStandardMaterial({ color: CAT[cat].color, emissive: CAT[cat].color, emissiveIntensity: 0.55, flatShading: true, roughness: 0.55 })
    );
    if (cat === "essay") beacon.rotation.y = Math.PI / 4;
    beacon.position.set(0, height + 1.7, 0);
    root.add(beacon);

    // invisible click target
    const gi = monuments.length;
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, height + 5.5, 8.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = (height + 1) / 2 - 2;
    hit.userData.index = gi;
    root.add(hit);
    clickMeshes.push(hit);

    scene.add(root);
    const mon = {
      root, group, beacon, post, index: gi, district: d, local, color, height, cat, spinners,
      phase: Math.random() * Math.PI * 2, hover: 0, beaconBaseY: height + 1.7, floatBlock,
    };
    monuments.push(mon);
    districts[d].list.push(mon);
    post._mon = mon;   // back-reference for the index sidebar
  });
});

const MAX_COUNT = Math.max(...districts.map((d) => d.count));
const WORLD_W = (MAX_COUNT - 1) * DX;
const WORLD_Z = (CATEGORIES.length - 1) * DZ;

/* ============================================================
   Clouds + birds (atmosphere)
   ============================================================ */
function softCircleTexture() {
  const s = 128, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.6, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cloudTex = softCircleTexture();
const clouds = [];
const TOTAL_W = WORLD_W;
for (let i = 0; i < 14; i++) {
  const m = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, opacity: 0.5, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(m);
  const sc = 8 + Math.random() * 9;
  sp.scale.set(sc, sc * 0.62, 1);
  sp.position.set(Math.random() * (TOTAL_W + 60) - 30, 10 + Math.random() * 8, 6 - Math.random() * (WORLD_Z + 24));
  sp.renderOrder = -1;
  scene.add(sp);
  clouds.push({ sp, speed: 0.18 + Math.random() * 0.22 });
}

function birdTexture() {
  const s = 64, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  ctx.strokeStyle = "rgba(90,70,80,0.8)";
  ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, 40); ctx.quadraticCurveTo(32, 22, 32, 34);
  ctx.quadraticCurveTo(32, 22, 54, 40);
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const birdTex = birdTexture();
const birds = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.SpriteMaterial({ map: birdTex, transparent: true, opacity: 0.7, depthWrite: false });
  const sp = new THREE.Sprite(m);
  const sc = 1.1 + Math.random() * 0.5;
  sp.scale.set(sc, sc, 1);
  sp.position.set(Math.random() * (TOTAL_W + 40) - 20, 12 + Math.random() * 6, 4 - Math.random() * (WORLD_Z + 16));
  scene.add(sp);
  birds.push({ sp, speed: 1.0 + Math.random() * 0.8, phase: Math.random() * 6.28 });
}

/* ============================================================
   Interaction state
   ============================================================ */
let pos = 0, targetPos = 0;             // float index within the active district
let azimuth = 0, targetAzimuth = 0;     // drag-orbit offset (radians)
let mode = "street";                    // "street" | "overview"
let activeDistrict = 0;
let districtLabelEls = [];
const mouse = new THREE.Vector2(0, 0);
const mouseTarget = new THREE.Vector2(0, 0);
let focus = null;                       // focused monument
let hovered = null;
const camTarget = new THREE.Vector3(0, 3.0, 0);
const desired = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tmp = new THREE.Vector3();

function clampPos(v) { return Math.max(0, Math.min(districts[activeDistrict].count - 1, v)); }

function enterDistrict(d, local) {
  mode = "street";
  activeDistrict = d;
  targetPos = clampPos(local || 0);
  pos = targetPos;
  camTarget.x = targetPos * DX;
  camTarget.z = districts[d].z;
  hintHidden = true; if (hintEl) hintEl.style.opacity = 0;
  updateDistrictHUD();
}
function enterOverview() {
  mode = "overview";
  focus = null; targetAzimuth = 0;
  if (readerOpen) closeReader();
  updateDistrictHUD();
}

/* wheel → wander within the active district */
window.addEventListener("wheel", (e) => {
  if (focus || readerOpen || aboutOpen || indexOpen) return;
  if (mode === "overview") {
    // wheel in overview does nothing (use district plazas / chips to enter)
    return;
  }
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  targetPos = clampPos(targetPos + d * 0.0018);
}, { passive: true });

/* drag → turn the world (orbit azimuth); short tap → focus */
let dragging = false, downX = 0, downY = 0, downTime = 0, startAz = 0, lastX = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (focus) return;
  dragging = true;
  downX = lastX = e.clientX; downY = e.clientY; downTime = performance.now();
  startAz = targetAzimuth;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
  pointer.x = mouseTarget.x;
  pointer.y = -mouseTarget.y;
  if (dragging && !focus) {
    targetAzimuth = startAz + (e.clientX - downX) * 0.005;
    targetAzimuth = Math.max(-0.7, Math.min(0.7, targetAzimuth));
    lastX = e.clientX;
  }
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
  const dt = performance.now() - downTime;
  if (dist < 6 && dt < 350 && hovered) focusOn(hovered);
  else targetAzimuth = 0;   // spring the world back upright
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", () => { dragging = false; targetAzimuth = 0; });

/* keyboard */
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (focus) closeReader();
    else if (aboutOpen) closeAbout();
    else if (indexOpen) closeIndex();
    else if (mode === "street") enterOverview();
    return;
  }
  if (focus || readerOpen || aboutOpen || indexOpen) return;
  if (mode === "overview") {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Enter") enterDistrict(activeDistrict, 0);
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") targetPos = clampPos(Math.round(targetPos) + 1);
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") targetPos = clampPos(Math.round(targetPos) - 1);
  if (e.key === "[") enterDistrict((activeDistrict - 1 + districts.length) % districts.length, 0);
  if (e.key === "]") enterDistrict((activeDistrict + 1) % districts.length, 0);
});

function focusOn(mon) {
  const switching = activeDistrict !== mon.district || mode === "overview";
  mode = "street";
  activeDistrict = mon.district;
  focus = mon;
  targetPos = mon.local;
  if (switching) { pos = mon.local; camTarget.x = mon.local * DX; camTarget.z = districts[mon.district].z; }
  targetAzimuth = 0;
  openReader(mon.post);
  hintHidden = true; hintEl.style.opacity = 0;
  updateDistrictHUD();
}

/* ============================================================
   DOM overlays
   ============================================================ */
const readerEl = document.getElementById("reader");
const readerInner = document.getElementById("readerInner");
const aboutEl = document.getElementById("about");
let readerOpen = false, aboutOpen = false;

function hexCss(h) { return "#" + new THREE.Color(h).getHexString(); }
function postFigure(post) {
  if (post.cat === "photo") return `<div class="r-figure"><span>▦ Photograph · drop image here</span></div>`;
  if (post.cat === "project") return `<div class="r-figure"><span>▦ Project shot · drop image here</span></div>`;
  return "";
}
function openReader(post) {
  const idx = POSTS.indexOf(post);
  const mon = monuments[idx];
  const next = POSTS[(idx + 1) % POSTS.length];
  const cssColor = CAT[post.cat].css;
  readerInner.style.setProperty("--mcolor", cssColor);
  readerInner.innerHTML = `
    <div class="r-cat">${CAT_LABEL[post.cat]}</div>
    <div class="r-meta">${post.date} · ${post.read} · No.${post.n}</div>
    <h1 class="r-title">${post.title}</h1>
    ${postFigure(post)}
    <div class="r-body">${post.body.map((p) => `<p>${p}</p>`).join("")}</div>
    <div class="r-footer">
      <span>${DATA.site.name} — No.${post.n}</span>
      <span class="nextlink" data-next="${next.id}">Next: ${next.title} →</span>
    </div>`;
  readerEl.classList.add("open");
  readerOpen = true;
  readerInner.parentElement.scrollTop = 0;
  const nl = readerInner.querySelector(".nextlink");
  if (nl) nl.addEventListener("click", () => {
    const np = POSTS.find((x) => x.id === nl.dataset.next);
    const m = monuments.find((mm) => mm.post === np);
    if (m) focusOn(m);
  });
}
function closeReader() {
  readerEl.classList.remove("open");
  readerOpen = false; focus = null;
  hintEl.style.opacity = hintHidden ? 0 : 1;
}
document.getElementById("readerClose").addEventListener("click", closeReader);
document.getElementById("scrim").addEventListener("click", closeReader);

function openAbout() {
  const a = DATA.about;
  document.getElementById("aboutInner").innerHTML = `
    <div class="about-portrait"><span>▦ Portrait · drop image here</span></div>
    <div class="r-cat">${a.title}</div>
    <h1 class="r-title" style="font-size:29px;margin-top:14px;">${a.lead}</h1>
    <div class="r-body" style="margin-top:22px;">${a.body.map((p) => `<p>${p}</p>`).join("")}</div>
    <div class="about-contact">${a.contact.map((c) => `<span>${c}</span>`).join("")}</div>`;
  aboutEl.classList.add("open"); aboutOpen = true;
}
function closeAbout() { aboutEl.classList.remove("open"); aboutOpen = false; }
document.getElementById("aboutBtn").addEventListener("click", openAbout);
document.getElementById("aboutClose").addEventListener("click", closeAbout);
document.getElementById("aboutScrim").addEventListener("click", closeAbout);
document.getElementById("brand").addEventListener("click", () => { closeReader(); closeAbout(); closeIndex(); enterOverview(); });

/* ============================================================
   HUD: district chips, overview, dynamic dots, Index sidebar
   ============================================================ */
const dotsEl = document.getElementById("dots");
const railLabel = document.getElementById("railLabel");
let dotEls = [];

/* big floating district labels (shown in overview) */
const districtLabelsWrap = document.createElement("div");
districtLabelsWrap.id = "district-labels";
document.body.appendChild(districtLabelsWrap);
districtLabelEls = districts.map((d) => {
  const el = document.createElement("button");
  el.className = "district-label";
  el.innerHTML = `<span class="dl-name">${d.name}</span><span class="dl-count">${d.count} ${d.count === 1 ? "piece" : "pieces"}</span>`;
  el.addEventListener("click", () => enterDistrict(d.index, 0));
  districtLabelsWrap.appendChild(el);
  return el;
});

/* bottom district switcher */
const bar = document.createElement("div");
bar.className = "districts-bar";
const ovBtn = document.createElement("button");
ovBtn.className = "dchip overview-chip";
ovBtn.innerHTML = `<span class="ov-glyph"></span>Overview`;
ovBtn.addEventListener("click", () => (mode === "overview" ? enterDistrict(activeDistrict, Math.round(pos)) : enterOverview()));
bar.appendChild(ovBtn);
const chipEls = districts.map((d) => {
  const c = document.createElement("button");
  c.className = "dchip";
  c.innerHTML = `<span class="dc-glyph ${d.cat}" style="background:${CAT[d.cat].css}"></span>${d.name}<span class="dc-n">${d.count}</span>`;
  c.addEventListener("click", () => enterDistrict(d.index, 0));
  bar.appendChild(c);
  return c;
});
document.body.appendChild(bar);

/* Index button in the top nav */
const indexBtn = document.createElement("button");
indexBtn.className = "link-btn";
indexBtn.id = "indexBtn";
indexBtn.textContent = "Index";
document.querySelector(".nav-right").insertBefore(indexBtn, document.getElementById("aboutBtn"));

/* Index sidebar */
const indexAside = document.createElement("aside");
indexAside.id = "index";
indexAside.className = "index";
indexAside.innerHTML = `
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
document.body.appendChild(indexAside);

const indexListEl = indexAside.querySelector("#indexList");
const indexCountEl = indexAside.querySelector("#indexCount");
const indexSearchEl = indexAside.querySelector("#indexSearch");
const indexFiltersEl = indexAside.querySelector("#indexFilters");
let indexFilter = "all";

/* category filter chips inside the index */
[{ k: "all", label: "All" }].concat(districts.map((d) => ({ k: d.cat, label: d.name })))
  .forEach((f) => {
    const b = document.createElement("button");
    b.className = "ifilter" + (f.k === "all" ? " active" : "");
    b.dataset.k = f.k;
    b.textContent = f.label;
    b.addEventListener("click", () => {
      indexFilter = f.k;
      indexFiltersEl.querySelectorAll(".ifilter").forEach((x) => x.classList.toggle("active", x.dataset.k === f.k));
      renderIndex();
    });
    indexFiltersEl.appendChild(b);
  });

function renderIndex() {
  const q = indexSearchEl.value.trim().toLowerCase();
  let list = POSTS.filter((p) => {
    if (indexFilter !== "all" && p.cat !== indexFilter) return false;
    if (!q) return true;
    return (p.title + " " + p.excerpt + " " + CAT[p.cat].label + " " + p.date).toLowerCase().includes(q);
  });
  // group by year, newest first
  const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);
  indexCountEl.textContent = `${list.length} of ${POSTS.length} pieces`;
  indexListEl.innerHTML = years.map((y) => {
    const items = list.filter((p) => p.year === y).sort((a, b) => Number(a.n) - Number(b.n));
    return `<div class="index-year">${y}</div>` + items.map((p) => `
      <button class="index-item" data-id="${p.id}">
        <span class="ii-glyph ${p.cat}" style="background:${CAT[p.cat].css}"></span>
        <span class="ii-main"><span class="ii-title">${p.title}</span><span class="ii-meta">${CAT[p.cat].label} · ${p.date} · ${p.read}</span></span>
        <span class="ii-go">→</span>
      </button>`).join("");
  }).join("") || `<div class="index-empty">Nothing matches “${q}”.</div>`;
  indexListEl.querySelectorAll(".index-item").forEach((it) => {
    it.addEventListener("click", () => {
      const p = POSTS.find((x) => x.id === it.dataset.id);
      closeIndex();
      if (p && p._mon) focusOn(p._mon);
    });
  });
}

function openIndex() {
  if (aboutOpen) closeAbout();
  indexOpen = true;
  indexAside.classList.add("open");
  renderIndex();
  setTimeout(() => indexSearchEl.focus(), 80);
}
function closeIndex() {
  indexOpen = false;
  indexAside.classList.remove("open");
}
indexBtn.addEventListener("click", () => (indexOpen ? closeIndex() : openIndex()));
indexAside.querySelector("#indexClose").addEventListener("click", closeIndex);
indexAside.querySelector(".index-scrim").addEventListener("click", closeIndex);
indexSearchEl.addEventListener("input", renderIndex);
indexAside.querySelector("#randomBtn").addEventListener("click", () => {
  const p = POSTS[Math.floor(Math.random() * POSTS.length)];
  closeIndex();
  if (p._mon) focusOn(p._mon);
});

/* rebuild the dot rail for the active district + sync chips */
function updateDistrictHUD() {
  const d = districts[activeDistrict];
  dotsEl.innerHTML = "";
  dotEls = d.list.map((mon, i) => {
    const b = document.createElement("button");
    b.className = "dot"; b.title = mon.post.title;
    b.addEventListener("click", () => { if (focus) closeReader(); mode = "street"; targetPos = clampPos(i); });
    dotsEl.appendChild(b);
    return b;
  });
  chipEls.forEach((c, i) => c.classList.toggle("active", i === activeDistrict && mode === "street"));
  ovBtn.classList.toggle("active", mode === "overview");
}

const hintEl = document.getElementById("hint");
let hintHidden = false;

/* ---------- floating category placards (DOM, tracked to each monument) ---------- */
const labelsEl = document.createElement("div");
labelsEl.id = "labels";
document.body.appendChild(labelsEl);
let hoverLabel = -1;
const placards = monuments.map((mon) => {
  const el = document.createElement("div");
  el.className = "placard";
  el.innerHTML = `
    <div class="chip"><span class="g ${mon.cat}" style="background:${CAT[mon.cat].css}"></span><span class="cat">${CAT[mon.cat].label}</span></div>
    <div class="title">${mon.post.title}</div>
    <div class="meta">No.${mon.post.n} · ${mon.post.read}</div>`;
  el.addEventListener("click", () => { if (!focus) focusOn(mon); });
  el.addEventListener("pointerenter", () => { hoverLabel = mon.index; canvas.style.cursor = "pointer"; });
  el.addEventListener("pointerleave", () => { if (hoverLabel === mon.index) hoverLabel = -1; });
  labelsEl.appendChild(el);
  return el;
});

/* ---------- tweakable state ---------- */
let floatAmp = 1.0;          // bob amplitude multiplier
let autoRotate = false;      // slow world turntable
let autoSpin = 0;            // accumulated auto-rotate azimuth
let sunAngle = 0;            // sun azimuth offset (radians)
const SUN_BASE = new THREE.Vector3(-7, 17, 9);
const projV = new THREE.Vector3();
let indexOpen = false;
const OV_TARGET = new THREE.Vector3(12, 4.5, -WORLD_Z / 2);
const OV_VIEW = Math.max(17, WORLD_Z * 0.42);

function updateDistrictLabels(hide) {
  const show = mode === "overview" && !hide;
  const W = window.innerWidth, H = window.innerHeight;
  for (const d of districts) {
    const el = districtLabelEls[d.index];
    if (!el) continue;
    if (!show) { el.style.opacity = 0; el.style.pointerEvents = "none"; continue; }
    projV.set(4 + d.index * 3.5, 7.4, d.z + 1).project(camera);
    const sx = (projV.x * 0.5 + 0.5) * W;
    const sy = (-projV.y * 0.5 + 0.5) * H;
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    el.style.opacity = 1;
    el.style.pointerEvents = "auto";
    el.classList.toggle("active", d.index === activeDistrict);
  }
}

function updateLabels() {
  const W = window.innerWidth, H = window.innerHeight;
  const overlayOpen = focus || readerOpen || aboutOpen || indexOpen;
  labelsEl.classList.toggle("hidden", !!overlayOpen);
  updateDistrictLabels(overlayOpen);
  if (overlayOpen || mode === "overview") {
    for (const mon of monuments) {
      const el = placards[mon.index];
      el.style.opacity = "0"; el.style.pointerEvents = "none";
    }
    return;
  }
  const center = Math.round(pos);
  for (const mon of monuments) {
    const el = placards[mon.index];
    if (mon.district !== activeDistrict) { el.style.opacity = "0"; el.style.pointerEvents = "none"; continue; }
    projV.set(mon.local * DX, mon.height + 2.7 + mon.group.position.y, districts[mon.district].z).project(camera);
    const sx = (projV.x * 0.5 + 0.5) * W;
    const sy = (-projV.y * 0.5 + 0.5) * H;
    const far = Math.abs(mon.local - pos);
    const op = far > 2.3 ? 0 : (far > 1.6 ? (2.3 - far) / 0.7 : 1);
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    el.style.opacity = op.toFixed(2);
    el.style.pointerEvents = op > 0.4 ? "auto" : "none";
    const expanded = mon.local === center || hoverLabel === mon.index || hovered === mon;
    el.classList.toggle("expanded", expanded && op > 0.4);
    el.classList.toggle("dim", !expanded);
  }
}

/* ============================================================
   Render loop
   ============================================================ */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  pos += (targetPos - pos) * Math.min(1, dt * 5);
  azimuth += (targetAzimuth - azimuth) * Math.min(1, dt * 6);
  if (autoRotate && !focus && !dragging) autoSpin += dt * 0.05;
  mouse.x += (mouseTarget.x - mouse.x) * Math.min(1, dt * 4);
  mouse.y += (mouseTarget.y - mouse.y) * Math.min(1, dt * 4);

  if (!hintHidden && (pos > 0.04 || azimuth !== 0 || focus)) { hintHidden = true; hintEl.style.opacity = 0; }

  // focus / overview zoom
  const wantView = mode === "overview" ? OV_VIEW : (focus ? 7.2 : 9.4);
  viewSize += (wantView - viewSize) * Math.min(1, dt * 4);
  updateOrtho();

  // camera target
  if (mode === "overview") {
    desired.copy(OV_TARGET);
  } else if (focus) {
    desired.set(focus.local * DX, focus.height * 0.42 + 0.6, districts[focus.district].z);
    desired.addScaledVector(RIGHT, 4.6);   // push monument left, clear of reader panel
  } else {
    desired.set(pos * DX, 3.0, districts[activeDistrict].z);
  }
  camTarget.lerp(desired, Math.min(1, dt * 4));

  // camera position (iso + drag-orbit azimuth + auto-rotate + subtle mouse parallax)
  const az = azimuth + autoSpin + (focus ? 0 : mouse.x * 0.12);
  const dir = isoDir.clone().applyAxisAngle(UP, az);
  camera.position.copy(camTarget).addScaledVector(dir, CAM_DIST);
  camera.up.set(0, 1, 0);
  camera.lookAt(camTarget);

  // sun follows the view for crisp local shadows; angle is tweakable
  const so = SUN_BASE.clone().applyAxisAngle(UP, sunAngle);
  sun.position.copy(camTarget).add(so);
  sun.target.position.copy(camTarget);

  // monuments: idle bob, hover lift, beacon, mechanisms
  for (const mon of monuments) {
    const isHover = (hovered === mon || hoverLabel === mon.index) && !focus && !readerOpen && !aboutOpen && !indexOpen;
    mon.hover += ((isHover ? 1 : 0) - mon.hover) * Math.min(1, dt * 8);
    const bob = Math.sin(t * 0.55 + mon.phase) * 0.12 * floatAmp;
    const focused = focus === mon;
    mon.group.position.y = bob + mon.hover * 0.45 + (focused ? 0.2 : 0);
    mon.group.rotation.y = mon.hover * 0.04 * Math.sin(t * 2);
    // rotating mechanisms (spiral steps, dome ring, …)
    for (const sp of mon.spinners) sp.obj.rotation.y += dt * sp.speed;
    // beacon hover/bob
    const bb = Math.sin(t * 1.6 + mon.phase) * 0.18 * floatAmp;
    mon.beacon.position.y = mon.beaconBaseY + bb + mon.group.position.y;
    mon.beacon.rotation.y += dt * 0.8;
    mon.beacon.rotation.x += dt * 0.5;
    const flare = 0.55 + mon.hover * 1.4 + (focused ? 0.8 : 0);
    mon.beacon.material.emissiveIntensity = flare;
    mon.beacon.scale.setScalar(1 + mon.hover * 0.5);
  }

  // hover raycast
  if (!focus && !readerOpen && !aboutOpen && !indexOpen && !dragging) {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickMeshes, false)[0];
    const nh = hit ? monuments[hit.object.userData.index] : null;
    if (nh !== hovered) { hovered = nh; canvas.style.cursor = nh ? "pointer" : (dragging ? "grabbing" : "grab"); }
  } else if (hovered && (focus || readerOpen || aboutOpen || indexOpen)) {
    hovered = null;
  }
  if (!hovered && !focus) canvas.style.cursor = dragging ? "grabbing" : "grab";

  // clouds drift
  for (const c of clouds) {
    c.sp.position.x += c.speed * dt;
    if (c.sp.position.x > TOTAL_W + 34) c.sp.position.x = -34;
  }
  // birds drift + gentle bob
  for (const b of birds) {
    b.sp.position.x += b.speed * dt;
    b.sp.position.y += Math.sin(t * 1.2 + b.phase) * dt * 0.25;
    if (b.sp.position.x > TOTAL_W + 24) b.sp.position.x = -24;
  }

  // category placards
  updateLabels();

  // UI
  if (mode === "overview") {
    dotEls.forEach((d) => d.classList.remove("active"));
    railLabel.textContent = `Overview · ${districts.length} districts`;
  } else {
    const idx = clampPos(Math.round(pos));
    dotEls.forEach((d, i) => d.classList.toggle("active", i === idx));
    const dd = districts[activeDistrict];
    railLabel.textContent = `${dd.name} · ${String(idx + 1).padStart(2, "0")} / ${String(dd.count).padStart(2, "0")}`;
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  updateOrtho();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- sky themes + tweak application ---------- */
const SKIES = {
  "Peach Dusk": {
    body: "radial-gradient(120% 90% at 78% 8%, #fbe8cf 0%, rgba(251,232,207,0) 55%), linear-gradient(176deg, #f6ddc6 0%, #f1d4ce 42%, #e7cdd9 74%, #ddc6dd 100%)",
    hemiSky: 0xfff3e6, hemiGround: 0xd9b9c4, sun: 0xfff0dc,
  },
  "Mint Morning": {
    body: "radial-gradient(120% 90% at 76% 8%, #eaf6ec 0%, rgba(234,246,236,0) 55%), linear-gradient(176deg, #e6f1e6 0%, #dcebe4 42%, #d4e6e4 74%, #cfe0e2 100%)",
    hemiSky: 0xf0fbf0, hemiGround: 0xc3d6cf, sun: 0xf3ffe9,
  },
  "Lavender Haze": {
    body: "radial-gradient(120% 90% at 78% 8%, #efe6f7 0%, rgba(239,230,247,0) 55%), linear-gradient(176deg, #e9e1f3 0%, #e2d6ec 42%, #ddd0e6 74%, #d6c9e0 100%)",
    hemiSky: 0xf3ecff, hemiGround: 0xc9bcd6, sun: 0xfff0fb,
  },
  "Slate Dawn": {
    body: "radial-gradient(120% 90% at 78% 8%, #e7edf3 0%, rgba(231,237,243,0) 55%), linear-gradient(176deg, #dfe6ee 0%, #d8dfe8 42%, #d4dae3 74%, #d0d2df 100%)",
    hemiSky: 0xeef4ff, hemiGround: 0xbcc4d2, sun: 0xfdf6ec,
  },
};
function applyTweaks(tw) {
  if (tw.sky && SKIES[tw.sky]) {
    const s = SKIES[tw.sky];
    document.body.style.background = s.body;
    document.documentElement.style.background = s.body;
    hemi.color.setHex(s.hemiSky);
    hemi.groundColor.setHex(s.hemiGround);
    sun.color.setHex(s.sun);
    const l = document.getElementById("loader");
    if (l) l.style.background = s.body;
  }
  if (typeof tw.sunAngle === "number") sunAngle = tw.sunAngle;
  if (typeof tw.float === "number") floatAmp = tw.float;
  if (typeof tw.autoRotate === "boolean") { autoRotate = tw.autoRotate; if (!autoRotate) autoSpin *= 1; }
  if (typeof tw.labels === "boolean") labelsEl.style.display = tw.labels ? "" : "none";
}
window.applyMonumentTweaks = applyTweaks;

/* ---------- boot ---------- */
function boot() {
  activeDistrict = 0; mode = "street"; pos = targetPos = 0;
  camTarget.set(0, 3.0, districts[0].z);
  updateDistrictHUD();
  window.__mv = {
    monuments, districts, camera, scene, renderer,
    enterDistrict, enterOverview, focusIdx(i) { focusOn(monuments[i]); },
    openIndex, render() { renderer.render(scene, camera); },
    // snapshot helper (for offline screenshots; the live loop drives everything)
    view(gi, withFocus) {
      const mon = monuments[gi];
      activeDistrict = mon.district; mode = "street";
      pos = targetPos = mon.local;
      let vs = withFocus ? 7.2 : 9.4;
      const z = districts[mon.district].z;
      if (withFocus) {
        desired.set(mon.local * DX, mon.height * 0.42 + 0.6, z);
        desired.addScaledVector(RIGHT, 4.6);
      } else {
        desired.set(mon.local * DX, 3.0, z);
      }
      camTarget.copy(desired);
      viewSize = vs; updateOrtho();
      camera.position.copy(camTarget).addScaledVector(isoDir, CAM_DIST);
      camera.up.set(0, 1, 0); camera.lookAt(camTarget);
      sun.position.copy(camTarget).add(SUN_BASE);
      sun.target.position.copy(camTarget); sun.target.updateMatrixWorld();
      monuments.forEach((m) => { m.group.position.y = 0; m.beacon.position.y = m.beaconBaseY; });
      updateDistrictHUD(); updateLabels();
      renderer.render(scene, camera);
    },
    overview() {
      mode = "overview"; focus = null;
      camTarget.copy(OV_TARGET); viewSize = OV_VIEW; updateOrtho();
      camera.position.copy(camTarget).addScaledVector(isoDir, CAM_DIST);
      camera.up.set(0, 1, 0); camera.lookAt(camTarget);
      sun.position.copy(camTarget).add(SUN_BASE);
      sun.target.position.copy(camTarget); sun.target.updateMatrixWorld();
      updateDistrictHUD(); updateLabels();
      renderer.render(scene, camera);
    },
  };
  frame();
  setTimeout(() => {
    const l = document.getElementById("loader");
    l.classList.add("hidden");
    setTimeout(() => { l.style.display = "none"; }, 900);
  }, 400);
}

if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(boot);
} else {
  boot();
}
