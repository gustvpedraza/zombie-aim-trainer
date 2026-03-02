let AC = null;

export function ensureAC() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
}

function noise(dur, gain = 1, freq = 350, q = 0.6) {
  const n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(AC.destination); src.start();
}

function tone(f0, dur, type = 'sine', gain = 0.4, f1 = null) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, AC.currentTime);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur);
  g.gain.setValueAtTime(gain, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}

export function sndShot()   { noise(0.13, 1.6, 420, 0.5); tone(180, 0.10, 'sawtooth', 0.7, 38); }
export function sndHit()    { tone(110, 0.22, 'sawtooth', 0.22, 55); }
export function sndDeath()  { tone(200, 0.55, 'sawtooth', 0.45, 22); noise(0.14, 0.35, 200, 0.4); }
export function sndDamage() { noise(0.28, 0.75, 130, 0.5); tone(75, 0.18, 'sine', 0.5, 38); }
export function sndEmpty()  { tone(200, 0.07, 'square', 0.15); }
export function sndReload() {
  [0, 140, 280].forEach((d, i) => setTimeout(() => tone(600 + i * 250, 0.06, 'square', 0.2), d));
}

// ── Background music ─────────────────────────────────────────
let _bgm = null;

function getBgm() {
  if (!_bgm) {
    _bgm = new Audio('/music/ZombieAimSoundTrack.mp3');
    _bgm.loop = true;
    _bgm.volume = 0.4;
  }
  return _bgm;
}

export function startMusic()  { getBgm().play().catch(() => {}); }
export function stopMusic()   { const m = getBgm(); m.pause(); m.currentTime = 0; }
export function pauseMusic()  { getBgm().pause(); }
export function resumeMusic() { getBgm().play().catch(() => {}); }

// ── SFX ──────────────────────────────────────────────────────
export function sndGroan() {
  const o = AC.createOscillator(), lfo = AC.createOscillator();
  const lg = AC.createGain(), g = AC.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(58, AC.currentTime);
  o.frequency.linearRampToValueAtTime(48, AC.currentTime + 0.5);
  o.frequency.linearRampToValueAtTime(63, AC.currentTime + 0.9);
  lfo.type = 'sine'; lfo.frequency.value = 4; lg.gain.value = 6;
  g.gain.setValueAtTime(0, AC.currentTime);
  g.gain.linearRampToValueAtTime(0.12, AC.currentTime + 0.12);
  g.gain.setValueAtTime(0.12, AC.currentTime + 0.7);
  g.gain.linearRampToValueAtTime(0, AC.currentTime + 1.0);
  const ws = AC.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2 / 255) - 1;
    curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
  }
  ws.curve = curve;
  lfo.connect(lg); lg.connect(o.frequency);
  o.connect(ws); ws.connect(g); g.connect(AC.destination);
  lfo.start(); o.start();
  lfo.stop(AC.currentTime + 1); o.stop(AC.currentTime + 1);
}
