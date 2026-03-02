import './style.css';
import { gs } from './state.js';
import { ensureAC } from './audio.js';
import { resize } from './scene.js';
import { resizeOverlay } from './vfx.js';
import { initComposer, resizeComposer } from './postfx.js';
import { startGame, goMenu, togglePause } from './game.js';
import { startLoop } from './loop.js';
import './input.js'; // registers event listeners

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
