import * as THREE from 'three';
import { gs } from './state.js';
import { GUN } from './config.js';
import { sndShot, sndHit, sndDeath, sndEmpty, sndReload } from './audio.js';
import { vfx } from './vfx.js';
import { camera, shake, w2s } from './scene.js';
import { zombies } from './zombie.js';
import { bats } from './bat.js';
import {
  updateAmmoUI, updateComboUI, updateScoreUI, updateKillsUI, showPopup, addKillMsg,
} from './ui.js';

const raycaster = new THREE.Raycaster();

function triggerGunAnim() {
  const el = document.getElementById('gun-svg');
  if (!el) return;
  el.classList.remove('firing');
  el.getBoundingClientRect(); // fuerza reflow para reiniciar la animación CSS
  el.classList.add('firing');
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

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  let best = null, bestD = Infinity;
  const orig = raycaster.ray.origin, dir = raycaster.ray.direction;

  zombies.forEach(z => {
    if (!z.alive || z.dying) return;
    const tgt = z.mesh.position.clone(); tgt.y = 1.72;
    const toZ = tgt.clone().sub(orig);
    const dot = toZ.dot(dir); if (dot < 0) return;
    const cl = orig.clone().add(dir.clone().multiplyScalar(dot));
    const pd = cl.distanceTo(tgt);
    const dist = toZ.length();
    const hr = 0.88 * (1 + 4 / Math.max(dist, 1));
    if (pd < hr && dist < bestD) { bestD = dist; best = z; }
  });

  // Bats — smaller hit radius
  bats.forEach(b => {
    if (!b.alive || b.dying) return;
    const tgt = b.mesh.position.clone();
    const toB = tgt.clone().sub(orig);
    const dot = toB.dot(dir); if (dot < 0) return;
    const cl = orig.clone().add(dir.clone().multiplyScalar(dot));
    const pd = cl.distanceTo(tgt);
    const dist = toB.length();
    const hr = 0.5 * (1 + 3 / Math.max(dist, 1));
    if (pd < hr && dist < bestD) { bestD = dist; best = b; }
  });

  if (best) {
    gs.hits++;
    best.hp -= GUN.dmg; best.hitFlash = 0.18;
    sndHit();
    const sp = w2s(best.mesh.position.clone().setY(best.mesh.position.y + 0.2));
    vfx.addBlood(sp.x, sp.y);
    gs.combo++; gs.comboTimer = 2.5;
    if (gs.combo > gs.maxCombo) gs.maxCombo = gs.combo;
    const mul = gs.combo > 1 ? gs.combo : 1;
    const earned = best.pts * mul;
    showPopup(sp.x, sp.y - 35, gs.combo > 1 ? `+${earned} x${gs.combo}!` : `+${earned}`);
    if (best.hp <= 0) killEnemy(best, earned);
  } else {
    gs.combo = 0;
    updateComboUI();
  }

  if (gs.ammo === 0) autoReload();
  checkLowAmmo();
}

function killEnemy(e, score) {
  e.alive = false; e.dying = true; e.dyT = 0.55;
  gs.score += score; gs.kills++;
  sndDeath();
  addKillMsg();
  updateScoreUI(); updateKillsUI(); updateComboUI();
}

export function autoReload() {
  if (gs.reloading || gs.ammo >= GUN.maxAmmo) return;
  gs.reloading = true;
  document.getElementById('reload-txt').style.display = 'block';
  document.getElementById('low-ammo').style.display = 'none';
  sndReload();
  setTimeout(() => {
    if (!gs.started) return;
    gs.ammo = GUN.maxAmmo; gs.reloading = false;
    document.getElementById('reload-txt').style.display = 'none';
    updateAmmoUI(); checkLowAmmo();
  }, GUN.reload);
}

export function checkLowAmmo() {
  document.getElementById('low-ammo').style.display =
    (!gs.reloading && gs.ammo > 0 && gs.ammo <= 8) ? 'block' : 'none';
}
