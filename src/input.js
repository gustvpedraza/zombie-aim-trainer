import { gs, camState, keys } from './state.js';
import { GUN, DIFF } from './config.js';
import { ensureAC } from './audio.js';
import { camRig, camera, rc } from './scene.js';
import { shoot, autoReload } from './shooting.js';
import { togglePause } from './game.js';

let locked = false;

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === rc;
});

document.addEventListener('mousemove', e => {
  if (!locked || gs.paused || !gs.started) return;
  const s = 0.0022;
  camState.yaw -= e.movementX * s;
  camState.pitch -= e.movementY * s;
  camState.pitch = Math.max(-0.44, Math.min(0.44, camState.pitch));
  camRig.rotation.y = camState.yaw;
  camera.rotation.x = camState.pitch;
  // Weapon sway impulse
  camState.swayX += e.movementX * 0.15;
  camState.swayY += e.movementY * 0.15;
});

document.addEventListener('mousedown', e => {
  ensureAC();
  if (e.button === 0) {
    if (locked && gs.started && !gs.paused && !gs.over) shoot();
    else if (!locked && gs.started && !gs.paused && !gs.over) rc.requestPointerLock();
  }
});

const MOVE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };

document.addEventListener('keydown', e => {
  if (MOVE[e.code] !== undefined) { keys[MOVE[e.code]] = true; return; }
  if (e.code === 'KeyR' && gs.started && !gs.reloading && gs.ammo < DIFF[gs.diff].ammo) autoReload();
  if (e.code === 'Escape' && gs.started && !gs.over) togglePause();
});

document.addEventListener('keyup', e => {
  if (MOVE[e.code] !== undefined) keys[MOVE[e.code]] = false;
});
