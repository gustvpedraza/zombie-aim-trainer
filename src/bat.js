import * as THREE from 'three';
import { scene, camRig } from './scene.js';
import { gs } from './state.js';
import { BAT } from './config.js';
import batSvgRaw from './bat.svg?raw';

export let bats = [];

const batLayer = document.getElementById('zombie-layer'); // shared layer, z-index handled per element

function createBatEl() {
  const div = document.createElement('div');
  div.className = 'bat-el';
  div.innerHTML = batSvgRaw;
  div.addEventListener('animationend', (e) => {
    if (e.animationName === 'bat-swoop-l') div.classList.remove('swooping');
  });
  batLayer.appendChild(div);
  return div;
}

export function spawnBat() {
  if (!gs.started || gs.paused || gs.over) return;
  if (bats.length >= BAT.max) return;
  const grp = new THREE.Group();
  const angle = Math.random() * Math.PI * 2, r = 12 + Math.random() * 14;
  const px = camRig.position.x, pz = camRig.position.z;
  grp.position.set(
    Math.max(-34, Math.min(34, px + Math.cos(angle) * r)),
    1.8 + Math.random() * 0.6,
    Math.max(-34, Math.min(34, pz + Math.sin(angle) * r))
  );
  scene.add(grp);
  bats.push({
    mesh: grp, el: createBatEl(),
    hp: BAT.hp, maxHp: BAT.hp,
    spd: BAT.spd * (0.8 + Math.random() * 0.4),
    flyPhase: Math.random() * Math.PI * 2,
    flySpeed: 2.8 + Math.random() * 1.8,
    dyVx: (Math.random() - 0.5) * 3,
    alive: true, dying: false,
    dyT: 0, hitFlash: 0, atkCd: BAT.atkCd,
    pts: BAT.pts,
  });
}

let _spawnId = null;

export function startBatSpawn() {
  stopBatSpawn();
  setTimeout(spawnBat, 4000); // first bat 4s into game
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
