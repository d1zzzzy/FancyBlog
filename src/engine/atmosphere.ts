import * as THREE from "three";

/* Drifting clouds + birds. Self-contained: build sprites into the scene
   and return an `update(dt, t)` to advance them each frame. */

function softCircleTexture(): THREE.CanvasTexture {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.6, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function birdTexture(): THREE.CanvasTexture {
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  ctx.strokeStyle = "rgba(90,70,80,0.8)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, 40);
  ctx.quadraticCurveTo(32, 22, 32, 34);
  ctx.quadraticCurveTo(32, 22, 54, 40);
  ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Cloud {
  sp: THREE.Sprite;
  speed: number;
}
interface Bird {
  sp: THREE.Sprite;
  speed: number;
  phase: number;
}

export interface Atmosphere {
  update(dt: number, t: number): void;
}

/**
 * `rand` is injected so the engine controls determinism (the original used
 * Math.random for placement). Pass `Math.random` for a lively scene.
 */
export function createAtmosphere(
  scene: THREE.Scene,
  worldW: number,
  worldZ: number,
  rand: () => number = Math.random,
): Atmosphere {
  const totalW = worldW;

  const cloudTex = softCircleTexture();
  const clouds: Cloud[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0xffffff,
      opacity: 0.5,
      transparent: true,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(m);
    const sc = 8 + rand() * 9;
    sp.scale.set(sc, sc * 0.62, 1);
    sp.position.set(
      rand() * (totalW + 60) - 30,
      10 + rand() * 8,
      6 - rand() * (worldZ + 24),
    );
    sp.renderOrder = -1;
    scene.add(sp);
    clouds.push({ sp, speed: 0.18 + rand() * 0.22 });
  }

  const birdTex = birdTexture();
  const birds: Bird[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.SpriteMaterial({
      map: birdTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(m);
    const sc = 1.1 + rand() * 0.5;
    sp.scale.set(sc, sc, 1);
    sp.position.set(
      rand() * (totalW + 40) - 20,
      12 + rand() * 6,
      4 - rand() * (worldZ + 16),
    );
    scene.add(sp);
    birds.push({ sp, speed: 1.0 + rand() * 0.8, phase: rand() * 6.28 });
  }

  return {
    update(dt: number, t: number) {
      for (const c of clouds) {
        c.sp.position.x += c.speed * dt;
        if (c.sp.position.x > totalW + 34) c.sp.position.x = -34;
      }
      for (const b of birds) {
        b.sp.position.x += b.speed * dt;
        b.sp.position.y += Math.sin(t * 1.2 + b.phase) * dt * 0.25;
        if (b.sp.position.x > totalW + 24) b.sp.position.x = -24;
      }
    },
  };
}
