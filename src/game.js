import { gs, camState } from './state.js';
import { GUN, DIFF } from './config.js';
import { sndDamage, startMusic, stopMusic, pauseMusic, resumeMusic } from './audio.js';
import { camRig, camera, shake, rc } from './scene.js';
import { vfx } from './vfx.js';
import { updateScoreUI, updateKillsUI, updateAmmoUI, updateHpUI, updateComboUI } from './ui.js';
import { startSpawn, stopSpawn, startGroans, clearZombies } from './zombie.js';
import { startBatSpawn, stopBatSpawn, clearBats } from './bat.js';

export function startGame() {
  Object.assign(gs, {
    score: 0, hp: 100, ammo: DIFF[gs.diff].ammo,
    reloading: false, paused: false, over: false, started: true,
    kills: 0, shots: 0, hits: 0, lastShot: 0,
    combo: 0, comboTimer: 0, maxCombo: 0,
  });
  clearZombies(); clearBats();
  camState.yaw = 0; camState.pitch = 0; camState.px = 0; camState.pz = 0;
  camRig.position.set(0, 1.72, 0); camRig.rotation.set(0, 0, 0); camera.rotation.set(0, 0, 0);

  document.getElementById('hud').style.display = 'block';
  ['scr-start', 'scr-pause', 'scr-over'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('diff-hud').textContent = DIFF[gs.diff].name;
  document.getElementById('reload-txt').style.display = 'none';
  document.getElementById('low-ammo').style.display = 'none';
  document.getElementById('ammo-max').textContent = ` / ${DIFF[gs.diff].ammo}`;

  updateScoreUI(); updateKillsUI(); updateAmmoUI(); updateHpUI(); updateComboUI();
  rc.requestPointerLock();
  startSpawn(); startGroans(); startBatSpawn();
  startMusic();
}

export function endGame() {
  gs.over = true; gs.started = false;
  stopSpawn(); stopBatSpawn();
  stopMusic();
  if (document.pointerLockElement) document.exitPointerLock();
  const acc = gs.shots > 0 ? Math.round(gs.hits / gs.shots * 100) : 0;
  document.getElementById('final-score').textContent = gs.score;
  document.getElementById('stat-kills').textContent = gs.kills;
  document.getElementById('stat-acc').textContent = acc + '%';
  document.getElementById('stat-combo').textContent = gs.maxCombo;
  const overScr = document.getElementById('scr-over');
  overScr.style.display = 'flex';
  overScr.style.pointerEvents = 'none';
  setTimeout(() => { overScr.style.pointerEvents = 'auto'; }, 2000);
  document.getElementById('hud').style.display = 'none';
}

export function togglePause() {
  gs.paused = !gs.paused;
  if (gs.paused) {
    document.getElementById('scr-pause').style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    stopSpawn(); stopBatSpawn(); pauseMusic();
  } else {
    document.getElementById('scr-pause').style.display = 'none';
    rc.requestPointerLock(); startSpawn(); startGroans(); startBatSpawn(); resumeMusic();
  }
}

export function goMenu() {
  gs.started = false; gs.over = false; gs.paused = false;
  stopSpawn(); stopBatSpawn();
  stopMusic();
  clearZombies(); clearBats();
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  ['scr-pause', 'scr-over'].forEach(id => { document.getElementById(id).style.display = 'none'; });
  document.getElementById('scr-start').style.display = 'flex';
}

export function takeDmg(amt) {
  gs.hp = Math.max(0, gs.hp - amt);
  vfx.red = 1; shake(0.18); sndDamage();
  updateHpUI();
  if (gs.hp <= 0) endGame();
}
