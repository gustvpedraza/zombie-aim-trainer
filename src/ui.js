import { gs } from './state.js';
import { DIFF } from './config.js';

export function updateScoreUI() { document.getElementById('score').textContent = `SCORE: ${gs.score}`; }
export function updateKillsUI() { document.getElementById('kills-hud').textContent = `KILLS: ${gs.kills}`; }
export function updateAmmoUI()  { document.getElementById('ammo-cur').textContent = gs.ammo; }

export function updateComboUI() {
  const el = document.getElementById('combo-hud');
  if (gs.combo > 1) { el.textContent = `COMBO x${gs.combo}`; el.style.opacity = '1'; }
  else { el.style.opacity = '0'; }
}

export function updateHpUI() {
  const pct = gs.hp;
  document.getElementById('hp-fill').style.width = pct + '%';
  document.getElementById('hp-num').textContent = pct;
  const f = document.getElementById('hp-fill');
  if (pct > 60)      f.style.background = 'linear-gradient(90deg,#44ff44,#88ff00)';
  else if (pct > 30) f.style.background = 'linear-gradient(90deg,#ffaa00,#ff6600)';
  else               f.style.background = 'linear-gradient(90deg,#ff4444,#ff0000)';
}

export function showPopup(x, y, txt) {
  const el = document.createElement('div');
  el.className = 'spopup';
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.textContent = txt;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function addKillMsg() {
  const feed = document.getElementById('kill-feed');
  const msgs = ['¡KILL!', '¡HEADSHOT!', 'ELIMINADO', '¡BUEN DISPARO!', '¡MUERTO!'];
  const el = document.createElement('div'); el.className = 'kentry';
  el.textContent = msgs[Math.random() * msgs.length | 0] + `  +${DIFF[gs.diff].pts}`;
  feed.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
