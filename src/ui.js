import { gs } from './state.js';
import { DIFF } from './config.js';

export function updateScoreUI() {
  const el = document.getElementById('score');
  const digits = String(gs.score).split('').map(d => `<span class="sdigit">${d}</span>`).join('');
  el.innerHTML = `SCORE: ${digits}`;
}
export function updateKillsUI() { document.getElementById('kills-hud').textContent = `KILLS: ${gs.kills}`; }
function wrapDigits(str, cls) {
  return String(str).split('').map(c =>
    /\d/.test(c) ? `<span class="${cls}">${c}</span>` : c
  ).join('');
}

export function updateAmmoUI() {
  document.getElementById('ammo-cur').innerHTML = wrapDigits(gs.ammo, 'adigit');
}

export function updateComboUI() {
  const el = document.getElementById('combo-hud');
  if (gs.combo > 1) { el.textContent = `COMBO x${gs.combo}`; el.style.opacity = '1'; }
  else { el.style.opacity = '0'; }
}

export function updateHpUI() {
  const pct = gs.hp;
  document.getElementById('hp-fill').style.width = pct + '%';
  document.getElementById('hp-num').innerHTML = wrapDigits(pct, 'hdigit');
  const f = document.getElementById('hp-fill');
  if (pct > 60)      f.style.background = 'linear-gradient(90deg,#32CD32,#44ee44)';
  else if (pct > 30) f.style.background = 'linear-gradient(90deg,#ffaa00,#ff6600)';
  else               f.style.background = 'linear-gradient(90deg,#B22222,#ff0000)';
}

export function showPopup(x, y, txt) {
  const el = document.createElement('div');
  el.className = 'spopup';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  const rot = (Math.random() - 0.5) * 16;
  el.style.setProperty('--rot', `${rot}deg`);
  el.textContent = txt;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function addKillMsg(x, y) {
  const msgs = ['¡KILL!', '¡HEADSHOT!', 'ELIMINADO', '¡BUEN DISPARO!', '¡MUERTO!'];
  const el = document.createElement('div');
  el.className = 'killpopup';
  const ox = (Math.random() - 0.5) * 80;
  const oy = (Math.random() - 0.5) * 50 - 60;
  el.style.left = (x + ox) + 'px';
  el.style.top = (y + oy) + 'px';
  const rot = (Math.random() - 0.5) * 16;
  el.style.setProperty('--rot', `${rot}deg`);
  el.textContent = msgs[Math.random() * msgs.length | 0];
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
