import * as THREE from 'three';
import { scene, camRig } from './scene.js';
import { gs } from './state.js';
import { DIFF } from './config.js';
import { sndGroan } from './audio.js';

export let zombies = [];

const zombieLayer = document.getElementById('zombie-layer');

// ── Spritesheet config ──────────────────────────────────────
export const SPRITE_COLS = 4;
export const SPRITE_FPS = 18;

// Walk spritesheet: 37 frames
export const walkSheet = new Image();
walkSheet.src = '/sprites/zombie-walk.webp';
export const WALK_FRAMES = 37;
const WALK_ROWS = Math.ceil(WALK_FRAMES / SPRITE_COLS);

// Attack spritesheet: 49 frames
export const atkSheet = new Image();
atkSheet.src = '/sprites/zombie-attack.webp';
export const ATK_FRAMES = 49;
const ATK_ROWS = Math.ceil(ATK_FRAMES / SPRITE_COLS);

// Dead spritesheet: first 10 = stagger, frames 10-48 = death (49 total)
export const deadSheet = new Image();
deadSheet.src = '/sprites/zombie-dead.webp';
export const STAGGER_FRAMES = 10;
export const DEAD_START = 10;
export const DEAD_FRAMES = 39;
export const DEAD_TOTAL = 49;
const DEAD_ROWS = Math.ceil(DEAD_TOTAL / SPRITE_COLS);

// Dead-near spritesheet: first 14 = stagger, frames 14-63 = death (64 total)
export const deadNearSheet = new Image();
deadNearSheet.src = '/sprites/zombie-dead-near.webp';
export const NEAR_STAGGER_FRAMES = 14;
export const NEAR_DEAD_START = 14;
export const NEAR_DEAD_FRAMES = 50;
export const NEAR_DEAD_TOTAL = 64;
export const NEAR_DEAD_ROWS = Math.ceil(NEAR_DEAD_TOTAL / SPRITE_COLS);

// Walk-after-attack spritesheet: 40 frames
export const walkAfterAtkSheet = new Image();
walkAfterAtkSheet.src = '/sprites/zombie-walk-after-attack.webp';
export const WALK_AFTER_ATK_FRAMES = 40;
export const WALK_AFTER_ATK_ROWS = Math.ceil(WALK_AFTER_ATK_FRAMES / SPRITE_COLS);

// ── CSS sprite helper ───────────────────────────────────────
// Sets background-image + background-position on a div to show a specific frame.
// The GPU compositor handles rendering — no canvas 2D operations needed.
export function setSpriteFrame(el, sheetUrl, frameIdx, cols, rows) {
  const colPct = (frameIdx % cols) * 100 / (cols - 1);
  const rowPct = Math.floor(frameIdx / cols) * 100 / (rows - 1);
  el.style.backgroundPosition = `${colPct}% ${rowPct}%`;
  // Only update background-image if sheet changed
  if (el._sheetUrl !== sheetUrl) {
    el._sheetUrl = sheetUrl;
    el.style.backgroundImage = `url(${sheetUrl})`;
    el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
  }
}

function createZombieEl() {
  const div = document.createElement('div');
  div.className = 'zombie-el';
  zombieLayer.appendChild(div);
  return div;
}

const MIN_SPAWN_DIST = 14;

export function spawnZombie() {
  if (!gs.started || gs.paused || gs.over) return;
  const d = DIFF[gs.diff];
  if (zombies.length >= d.max) return;
  const grp = new THREE.Group();
  const px = camRig.position.x, pz = camRig.position.z;
  let sx, sz, tries = 0;
  do {
    const angle = Math.random() * Math.PI * 2, r = 14 + Math.random() * 13;
    sx = Math.max(-34, Math.min(34, px + Math.cos(angle) * r));
    sz = Math.max(-34, Math.min(34, pz + Math.sin(angle) * r));
    tries++;
  } while (tries < 10 && zombies.some(z => {
    const dx = z.mesh.position.x - sx, dz = z.mesh.position.z - sz;
    return dx * dx + dz * dz < MIN_SPAWN_DIST * MIN_SPAWN_DIST;
  }));
  grp.position.set(sx, 0, sz);
  scene.add(grp);
  const el = createZombieEl();
  const baseSpd = d.spd * (0.72 + Math.random() * 0.56);
  zombies.push({
    mesh: grp, el,
    hp: d.hp, maxHp: d.hp,
    spd: baseSpd, baseSpd,
    alive: true, dying: false,
    dyT: 0, hitFlash: 0, atkCd: 1.8,
    pts: d.pts,
    frameTime: Math.random() * WALK_FRAMES / SPRITE_FPS,
    slowTimer: 0,
    state: 'running',
    atkFrameTime: 0,
    atkDmgDealt: false,
    staggerFrameTime: 0,
    deadFrameTime: 0,
    prevState: 'running',
    lastDrawn: -1,
  });
}

export function startSpawn() {
  stopSpawn();
  spawnZombie();
  gs.spawnId = setInterval(spawnZombie, DIFF[gs.diff].rate);
}

export function stopSpawn() {
  if (gs.spawnId) { clearInterval(gs.spawnId); gs.spawnId = null; }
  if (gs.groanId) { clearInterval(gs.groanId); gs.groanId = null; }
}

export function startGroans() {
  gs.groanId = setInterval(() => {
    if (gs.started && !gs.paused && !gs.over && zombies.some(z => z.alive)) sndGroan();
  }, 3500 + Math.random() * 2000);
}

export function clearZombies() {
  zombies.forEach(z => {
    scene.remove(z.mesh);
    if (z.el && z.el.parentNode) z.el.parentNode.removeChild(z.el);
  });
  zombies = [];
}
