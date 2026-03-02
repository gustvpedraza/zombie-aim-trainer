import { GUN } from './config.js';

export const gs = {
  score: 0, hp: 100, ammo: GUN.maxAmmo,
  reloading: false, paused: false, over: false, started: false,
  kills: 0, shots: 0, hits: 0, diff: 2, lastShot: 0,
  combo: 0, comboTimer: 0, maxCombo: 0,
  spawnId: null, groanId: null,
};

// Camera state — shared between input.js, loop.js and game.js
export const camState = { yaw: 0, pitch: 0, px: 0, pz: 0 };

// Movement keys — written by input.js, read by loop.js
export const keys = { w: false, a: false, s: false, d: false };
