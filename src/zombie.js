import * as THREE from 'three';
import { scene, camRig } from './scene.js';
import { gs } from './state.js';
import { DIFF } from './config.js';
import { sndGroan } from './audio.js';
import zombieSvgRaw from './zombie.svg?raw';

export let zombies = [];

const zombieLayer = document.getElementById('zombie-layer');

function createZombieEl() {
  const div = document.createElement('div');
  div.className = 'zombie-el';
  div.innerHTML = zombieSvgRaw;
  // Remove .attacking class when the main body animation finishes
  div.addEventListener('animationend', (e) => {
    if (e.animationName === 'z-lunge') div.classList.remove('attacking');
  });
  zombieLayer.appendChild(div);
  return div;
}

export function spawnZombie() {
  if (!gs.started || gs.paused || gs.over) return;
  const d = DIFF[gs.diff];
  if (zombies.length >= d.max) return;
  const grp = new THREE.Group();
  const angle = Math.random() * Math.PI * 2, r = 14 + Math.random() * 13;
  const px = camRig.position.x, pz = camRig.position.z;
  grp.position.set(
    Math.max(-34, Math.min(34, px + Math.cos(angle) * r)),
    0,
    Math.max(-34, Math.min(34, pz + Math.sin(angle) * r))
  );
  scene.add(grp);
  const el = createZombieEl();
  zombies.push({
    mesh: grp, el,
    hp: d.hp, maxHp: d.hp,
    spd: d.spd * (0.72 + Math.random() * 0.56),
    alive: true, dying: false,
    dyT: 0, hitFlash: 0, atkCd: 1.8,
    pts: d.pts,
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
