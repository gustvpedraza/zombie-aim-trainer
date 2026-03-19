import './style.css';
import { gs } from './state.js';
import { ensureAC } from './audio.js';
import { resize } from './scene.js';
import { resizeOverlay } from './vfx.js';
import { initComposer, resizeComposer } from './postfx.js';
import { startGame, goMenu, togglePause } from './game.js';
import { startLoop } from './loop.js';
import { walkSheet, atkSheet, deadSheet, deadNearSheet, walkAfterAtkSheet } from './zombie.js';
import { batFlySheet, batDeadSheet } from './bat.js';
import './input.js'; // registers event listeners

// ── Asset loader ─────────────────────────────────────────────
const ASSETS = [walkSheet, atkSheet, deadSheet, deadNearSheet, walkAfterAtkSheet, batFlySheet, batDeadSheet];
const loadBar = document.getElementById('load-bar-fill');
const loadPct = document.getElementById('load-pct');
const scrLoading = document.getElementById('scr-loading');
const scrStart = document.getElementById('scr-start');

function preloadAssets() {
  let loaded = 0;
  const total = ASSETS.length;

  function tick() {
    loaded++;
    const pct = Math.round(loaded / total * 100);
    loadBar.style.width = pct + '%';
    loadPct.textContent = pct + '%';
    if (loaded >= total) onAllLoaded();
  }

  ASSETS.forEach(img => {
    if (img.complete && img.naturalWidth) { tick(); return; }
    img.addEventListener('load', tick, { once: true });
    img.addEventListener('error', tick, { once: true });
  });
}

function onAllLoaded() {
  scrLoading.style.display = 'none';
  scrStart.style.display = '';
}

preloadAssets();

// Difficulty buttons
document.querySelectorAll('.dbtn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.dbtn').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    gs.diff = +b.dataset.d;
  });
});

document.getElementById('btn-start').addEventListener('click',   () => { ensureAC(); startGame(); });
document.getElementById('btn-restart').addEventListener('click', () => { ensureAC(); startGame(); });
document.getElementById('btn-resume').addEventListener('click',  togglePause);
document.getElementById('btn-pmenu').addEventListener('click',   goMenu);
document.getElementById('btn-omenu').addEventListener('click',   goMenu);

// Resize
function onResize() {
  const w = innerWidth, h = innerHeight;
  resize(w, h);
  resizeOverlay(w, h);
  resizeComposer(w, h);
}
window.addEventListener('resize', onResize);
onResize();

initComposer(innerWidth, innerHeight);

// Start render loop
startLoop();
