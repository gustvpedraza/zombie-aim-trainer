# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (localhost:5173, HMR enabled)
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Architecture

Vite project with ES modules. Three.js is installed as an npm package (`three@^0.128.0`).

### Module dependency graph (no circular deps)

```
main.js
 ├── style.css
 ├── scene.js      ← Three.js setup, environment, camera rig, shake, w2s
 ├── vfx.js        ← 2D canvas overlay (muzzle flash, blood, gun model, vignette)
 ├── game.js       ← startGame / endGame / togglePause / goMenu / takeDmg
 │    ├── state.js / config.js / audio.js / ui.js / scene.js / vfx.js
 │    └── zombie.js
 ├── loop.js       ← requestAnimationFrame loop (zombie AI, lighting pulse)
 │    ├── scene.js / vfx.js / zombie.js
 │    └── game.js (takeDmg)
 └── input.js      ← Pointer Lock, mousemove, mousedown, keydown
      ├── shooting.js  ← shoot / autoReload / checkLowAmmo
      │    └── zombie.js (zombies array, live ES module binding)
      └── game.js (togglePause)
```

Leaf modules (no game deps): `config.js`, `state.js`, `audio.js`.

### Key architectural notes

- **Dual canvas**: `#rc` is the Three.js WebGL canvas; `#vc` is a transparent 2D canvas on top for VFX.
- **Camera rig**: `camRig` (Group, yaw + shake) → `camera` (PerspectiveCamera, pitch only). `camState.yaw/pitch` in `state.js` are shared between `input.js` (writes) and `game.js` (resets).
- **Zombie array**: `export let zombies` in `zombie.js` is a live ES module binding — `loop.js` and `shooting.js` mutate it in-place (`splice`); `clearZombies()` reassigns it and all importers see the new value.
- **Audio**: fully procedural Web Audio API — no audio files. `ensureAC()` must be called from a user gesture before any sound function.
- **Balance**: `DIFF` (per-difficulty: rate, max zombies, speed, hp, pts, damage) and `GUN` constants are the only place to tune gameplay. Both are in `config.js`.
- **Hit detection**: raycaster from camera center with a distance-scaled hit radius: `hr = 0.88 * (1 + 4 / max(dist, 1))`.
