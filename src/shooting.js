import * as THREE from 'three';
import { gs, camState } from './state.js';
import { GUN, DIFF } from './config.js';
import { sndShot, sndHit, sndDeath, sndEmpty, sndReload, stopZombieAtk } from './audio.js';
import { vfx } from './vfx.js';
import { camera, shake, w2s } from './scene.js';
import { zombies } from './zombie.js';
import { bats } from './bat.js';
import {
  updateAmmoUI, updateComboUI, updateScoreUI, updateKillsUI, showPopup, addKillMsg,
} from './ui.js';

const raycaster = new THREE.Raycaster();
const _center = new THREE.Vector2(0, 0);
const _tgt = new THREE.Vector3();
const _toE = new THREE.Vector3();
const _cl = new THREE.Vector3();

// Gun spritesheet setup
const GUN_FRAMES = 11;
const GUN_FPS = 40;
const GUN_COLS = 4;
const gunSheet = new Image();
gunSheet.src = '/sprites/gun-fire.webp';
const gunCanvas = document.getElementById('gun-canvas');
const gunCtx = gunCanvas.getContext('2d');
gunCanvas.width = 640;
gunCanvas.height = 640;
let gunAnimId = null;

function drawGunFrame(frameIdx) {
  if (!gunSheet.naturalWidth) return;
  const fw = gunSheet.naturalWidth / GUN_COLS;
  const rows = Math.round(gunSheet.naturalHeight / fw);
  const fh = gunSheet.naturalHeight / rows;
  const col = frameIdx % GUN_COLS;
  const row = Math.floor(frameIdx / GUN_COLS);
  const W = gunCanvas.width, H = gunCanvas.height;
  gunCtx.clearRect(0, 0, W, H);
  gunCtx.drawImage(gunSheet, col * fw, row * fh, fw, fh, 0, 0, W, H);
  gunCtx.globalCompositeOperation = 'source-atop';
  const darkness = frameIdx > 0 ? Math.min(1, frameIdx / GUN_FRAMES) : 1;
  const g = gunCtx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0,   `rgba(0,0,0,${0.95 * darkness})`);
  g.addColorStop(0.5, `rgba(0,0,0,${0.7 * darkness})`);
  g.addColorStop(1,   `rgba(0,0,0,${0.38 * darkness})`);
  gunCtx.fillStyle = g;
  gunCtx.fillRect(0, 0, W, H);
  gunCtx.globalCompositeOperation = 'source-over';
}

// Draw idle frame once loaded
gunSheet.addEventListener('load', () => { drawGunFrame(0); });

function triggerGunAnim() {
  if (!gunCanvas) return;
  // Recoil CSS animation
  gunCanvas.classList.remove('recoil');
  gunCanvas.getBoundingClientRect();
  gunCanvas.classList.add('recoil');

  // Cancel any running animation
  if (gunAnimId !== null) cancelAnimationFrame(gunAnimId);
  let frame = 0;
  let lastT = performance.now();
  const interval = 1000 / GUN_FPS;

  function step(now) {
    const elapsed = now - lastT;
    if (elapsed >= interval) {
      lastT = now - (elapsed % interval);
      drawGunFrame(frame);
      frame++;
    }
    if (frame < GUN_FRAMES) {
      gunAnimId = requestAnimationFrame(step);
    } else {
      drawGunFrame(0);
      gunCanvas.classList.remove('recoil');
      gunAnimId = null;
    }
  }
  gunAnimId = requestAnimationFrame(step);
}

export function shoot() {
  if (!gs.started || gs.paused || gs.over) return;
  if (gs.reloading) { sndEmpty(); return; }
  if (gs.ammo <= 0) { sndEmpty(); autoReload(); return; }
  const now = performance.now();
  if (now - gs.lastShot < GUN.rate) return;
  gs.lastShot = now;
  gs.ammo--; gs.shots++;
  sndShot();
  vfx.muzzle = 1;
  triggerGunAnim();
  shake(0.13);
  updateAmmoUI();

  raycaster.setFromCamera(_center, camera);
  let best = null, bestD = Infinity;
  const orig = raycaster.ray.origin, dir = raycaster.ray.direction;

  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z.alive || z.dying) continue;
    _tgt.set(z.mesh.position.x, 1.72, z.mesh.position.z);
    _toE.subVectors(_tgt, orig);
    const dot = _toE.dot(dir); if (dot < 0) continue;
    _cl.copy(dir).multiplyScalar(dot).add(orig);
    const pd = _cl.distanceTo(_tgt);
    const dist = _toE.length();
    const hr = 0.48;
    if (pd < hr && dist < bestD) { bestD = dist; best = z; }
  }

  // Bats — smaller hit radius
  for (let i = 0; i < bats.length; i++) {
    const b = bats[i];
    if (!b.alive || b.dying) continue;
    _tgt.copy(b.mesh.position);
    _toE.subVectors(_tgt, orig);
    const dot = _toE.dot(dir); if (dot < 0) continue;
    _cl.copy(dir).multiplyScalar(dot).add(orig);
    const pd = _cl.distanceTo(_tgt);
    const dist = _toE.length();
    const hr = 0.55;
    if (pd < hr && dist < bestD) { bestD = dist; best = b; }
  }

  if (best) {
    gs.hits++;
    const dmg = bestD > 5 ? 30 : GUN.dmg;
    best.hp -= dmg; best.hitFlash = 0.18;
    if (best.slowTimer !== undefined) best.slowTimer = 0.5;
    // Trigger stagger animation
    if (best.state !== undefined && best.state !== 'dead') {
      if (best.state === 'attacking' || best.state === 'walking_back') best.nearDeath = true;
      best.prevState = best.state === 'stagger' ? best.prevState : best.state;
      best.state = 'stagger';
      best.staggerFrameTime = 0;
    }
    sndHit();
    const sp = w2s(best.mesh.position.clone().setY(best.mesh.position.y + 0.2));
    vfx.addBlood(sp.x, sp.y);
    gs.combo++; gs.comboTimer = 2.5;
    if (gs.combo > gs.maxCombo) gs.maxCombo = gs.combo;
    const mul = gs.combo > 1 ? gs.combo : 1;
    const earned = best.pts * mul;
    const ox = (Math.random() - 0.5) * 60, oy = (Math.random() - 0.5) * 40 - 35;
    showPopup(sp.x + ox, sp.y + oy, gs.combo > 1 ? `+${earned} x${gs.combo}!` : `+${earned}`);
    if (best.hp <= 0) killEnemy(best, earned);
  } else {
    gs.combo = 0;
    updateComboUI();
  }

  // ── Camera recoil (buffered, applied smoothly in loop) ──
  camState.recoilPitch += 0.012 + Math.random() * 0.006;
  camState.recoilYaw += (Math.random() - 0.5) * 0.008;

  if (gs.ammo === 0) autoReload();
  checkLowAmmo();
}

function killEnemy(e, score) {
  if (!e.nearDeath) e.nearDeath = (e.state === 'attacking' || e.state === 'walking_back' || e.prevState === 'attacking' || e.prevState === 'walking_back');
  stopZombieAtk(e._atkSnd); e._atkSnd = null;
  e.alive = false;
  e.state = 'dead';
  e.deadFrameTime = 0;
  gs.score += score; gs.kills++;
  sndDeath();
  const kp = w2s(e.mesh.position.clone().setY(e.mesh.position.y + 0.2));
  addKillMsg(kp.x, kp.y);
  updateScoreUI(); updateKillsUI(); updateComboUI();
}

export function autoReload() {
  if (gs.reloading || gs.ammo >= DIFF[gs.diff].ammo) return;
  gs.reloading = true;
  document.getElementById('reload-txt').style.display = 'block';
  document.getElementById('low-ammo').style.display = 'none';
  sndReload();

  // Gun slides down
  gunCanvas.classList.remove('recoil', 'reload-up');
  gunCanvas.classList.add('reloading');

  // Gun slides back up before reload finishes
  setTimeout(() => {
    if (!gs.started) return;
    gunCanvas.classList.remove('reloading');
    gunCanvas.classList.add('reload-up');
  }, GUN.reload - 400);

  setTimeout(() => {
    if (!gs.started) return;
    gs.ammo = DIFF[gs.diff].ammo; gs.reloading = false;
    gunCanvas.classList.remove('reload-up');
    document.getElementById('reload-txt').style.display = 'none';
    updateAmmoUI(); checkLowAmmo();
  }, GUN.reload);
}

export function checkLowAmmo() {
  document.getElementById('low-ammo').style.display =
    (!gs.reloading && gs.ammo > 0 && gs.ammo <= 8) ? 'block' : 'none';
}
