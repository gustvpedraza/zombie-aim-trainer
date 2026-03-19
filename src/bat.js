import * as THREE from 'three';
import { scene, camRig } from './scene.js';
import { gs } from './state.js';
import { BAT } from './config.js';
import { setSpriteFrame, SPRITE_COLS } from './zombie.js';

export let bats = [];

const batLayer = document.getElementById('zombie-layer');

// ── Bat spritesheet config ──────────────────────────────────────
export const BAT_SPRITE_FPS = 18;

export const batFlySheet = new Image();
batFlySheet.src = '/sprites/bat-flying.webp';
export const BAT_FLY_FRAMES = 40;
export const BAT_FLY_ROWS = Math.ceil(BAT_FLY_FRAMES / SPRITE_COLS);

export const batDeadSheet = new Image();
batDeadSheet.src = '/sprites/bat-dead.webp';
export const BAT_STAGGER_FRAMES = 10;
export const BAT_DEAD_START = 10;
export const BAT_DEAD_FRAMES = 30;
export const BAT_DEAD_TOTAL = 40;
export const BAT_DEAD_ROWS = Math.ceil(BAT_DEAD_TOTAL / SPRITE_COLS);

function createBatEl() {
  const div = document.createElement('div');
  div.className = 'bat-el';
  batLayer.appendChild(div);
  return div;
}

const MIN_BAT_DIST = 3.5;

export function spawnBat() {
  if (!gs.started || gs.paused || gs.over) return;
  if (bats.length >= BAT.max) return;
  const grp = new THREE.Group();
  const px = camRig.position.x, pz = camRig.position.z;
  let sx, sz, tries = 0;
  do {
    const angle = Math.random() * Math.PI * 2, r = 12 + Math.random() * 14;
    sx = Math.max(-34, Math.min(34, px + Math.cos(angle) * r));
    sz = Math.max(-34, Math.min(34, pz + Math.sin(angle) * r));
    tries++;
  } while (tries < 10 && bats.some(b => {
    const dx = b.mesh.position.x - sx, dz = b.mesh.position.z - sz;
    return dx * dx + dz * dz < MIN_BAT_DIST * MIN_BAT_DIST;
  }));
  grp.position.set(sx, 1.8 + Math.random() * 0.6, sz);
  scene.add(grp);
  const el = createBatEl();
  const baseSpd = BAT.spd * (0.8 + Math.random() * 0.4);
  bats.push({
    mesh: grp, el,
    hp: BAT.hp[gs.diff], maxHp: BAT.hp[gs.diff],
    spd: baseSpd, baseSpd,
    flyPhase: Math.random() * Math.PI * 2,
    flySpeed: 2.8 + Math.random() * 1.8,
    dyVx: (Math.random() - 0.5) * 3,
    alive: true, dying: false,
    dyT: 0, hitFlash: 0, atkCd: BAT.atkCd,
    pts: BAT.pts,
    slowTimer: 0,
    state: 'flying',
    frameTime: Math.random() * BAT_FLY_FRAMES / BAT_SPRITE_FPS,
    atkFrameTime: 0,
    atkDmgDealt: false,
    staggerFrameTime: 0,
    deadFrameTime: 0,
    prevState: 'flying',
    lastDrawn: -1,
    // Complex movement
    strafePhase: Math.random() * Math.PI * 2,
    strafeFreq: 1.2 + Math.random() * 1.5,
    strafeAmp: 2.5 + Math.random() * 2.5,
    diveTimer: 3 + Math.random() * 4,
    diving: false,
    diveTime: 0,
  });
}

let _spawnId = null;

export function startBatSpawn() {
  stopBatSpawn();
  setTimeout(spawnBat, 4000);
  _spawnId = setInterval(spawnBat, BAT.spawnRate);
}

export function stopBatSpawn() {
  if (_spawnId) { clearInterval(_spawnId); _spawnId = null; }
}

export function clearBats() {
  bats.forEach(b => {
    scene.remove(b.mesh);
    if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
  });
  bats = [];
}
