import * as THREE from 'three';
import { gs, camState, keys } from './state.js';
import { DIFF } from './config.js';
import { scene, renderer, camera, camRig, applyShake, updateFlashlight } from './scene.js';
import { composer } from './postfx.js';
import { vfx } from './vfx.js';
import {
  zombies, SPRITE_COLS, SPRITE_FPS, setSpriteFrame,
  WALK_FRAMES, ATK_FRAMES,
  STAGGER_FRAMES, DEAD_START, DEAD_FRAMES,
  NEAR_STAGGER_FRAMES, NEAR_DEAD_START, NEAR_DEAD_FRAMES, NEAR_DEAD_ROWS,
  WALK_AFTER_ATK_FRAMES, WALK_AFTER_ATK_ROWS,
} from './zombie.js';
import {
  bats, BAT_SPRITE_FPS,
  BAT_FLY_FRAMES, BAT_FLY_ROWS,
  BAT_STAGGER_FRAMES, BAT_DEAD_START, BAT_DEAD_FRAMES, BAT_DEAD_ROWS,
} from './bat.js';

// Spritesheet URLs for CSS background-image
const WALK_URL = '/sprites/zombie-walk.webp';
const ATK_URL = '/sprites/zombie-attack.webp';
const DEAD_URL = '/sprites/zombie-dead.webp';
const WALK_ROWS = Math.ceil(WALK_FRAMES / SPRITE_COLS);
const ATK_ROWS = Math.ceil(ATK_FRAMES / SPRITE_COLS);
const DEAD_ROWS = Math.ceil(49 / SPRITE_COLS);
const DEAD_NEAR_URL = '/sprites/zombie-dead-near.webp';
const WALK_AFTER_ATK_URL = '/sprites/zombie-walk-after-attack.webp';
const BAT_FLY_URL = '/sprites/bat-flying.webp';
const BAT_DEAD_URL = '/sprites/bat-dead.webp';
import { BAT } from './config.js';
import { takeDmg } from './game.js';
import { sndZombieAtk, stopZombieAtk } from './audio.js';
import { updateComboUI } from './ui.js';
import { drawIndicators } from './radar.js';

let lastT = performance.now();
let animT = 0;
const _gunEl = document.getElementById('gun-canvas');

// Pre-allocated vector — avoids GC pressure at 60 fps
const _zpt = new THREE.Vector3();

export function startLoop() {
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now; animT += dt;

    if (gs.started && !gs.paused && !gs.over) {
      // Combo decay
      if (gs.combo > 0) {
        gs.comboTimer -= dt;
        if (gs.comboTimer <= 0) { gs.combo = 0; updateComboUI(); }
      }

      // Update zombies
      const pp = camRig.position;
      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        const baseY = z.mesh.position.y;

        // ── Project 3D position → screen for the DOM sprite ──────────
        if (z.el) {
          _zpt.set(z.mesh.position.x, baseY + 2.2, z.mesh.position.z);
          _zpt.project(camera);
          if (_zpt.z > 1) {
            // Behind camera — hide
            z.el.style.display = 'none';
          } else {
            z.el.style.display = '';
            const headX = (_zpt.x + 1) / 2 * innerWidth;
            const headY = (-_zpt.y + 1) / 2 * innerHeight;

            _zpt.set(z.mesh.position.x, baseY + 0.05, z.mesh.position.z);
            _zpt.project(camera);
            const feetY = (-_zpt.y + 1) / 2 * innerHeight;

            const pixH = Math.max(10, feetY - headY);
            const pixW = pixH * (200 / 240);
            const dist2d = Math.sqrt(
              (z.mesh.position.x - pp.x) ** 2 + (z.mesh.position.z - pp.z) ** 2
            );
            const zIdx = Math.round(1000 / Math.max(dist2d, 0.1));
            const s = z.el.style;
            s.display = 'block';
            const pixWr = pixW | 0, pixHr = pixH | 0;
            if (z._pw !== pixWr) { z._pw = pixWr; s.width = pixWr + 'px'; }
            if (z._ph !== pixHr) { z._ph = pixHr; s.height = pixHr + 'px'; }
            s.zIndex = zIdx;
            const wantFilter = z.hitFlash > 0;
            if (wantFilter !== z._lastFilter) {
              z._lastFilter = wantFilter;
              s.filter = wantFilter ? 'brightness(2) sepia(1) saturate(10) hue-rotate(-30deg)' : 'none';
            }
            s.transform = `translate3d(${headX - pixW / 2}px,${headY}px,0)`;
          }
        }

        // ── Hit flash decay (antes de cualquier continue) ────────────
        if (z.hitFlash > 0) z.hitFlash -= dt;

        // ── Dead animation ─────────────────────────────────────────
        if (z.state === 'dead') {
          z.deadFrameTime += dt;
          if (z.nearDeath) {
            // Slow down last 16 frames for shrink effect
            const shrinkStart = NEAR_DEAD_FRAMES - 16;
            const fastPart = Math.floor(z.deadFrameTime * SPRITE_FPS * 1.8);
            let deadIdx;
            if (fastPart < shrinkStart) {
              deadIdx = fastPart;
            } else {
              const slowTime = z.deadFrameTime - shrinkStart / (SPRITE_FPS * 1.8);
              deadIdx = shrinkStart + Math.floor(slowTime * SPRITE_FPS * 0.5);
            }
            if (deadIdx >= NEAR_DEAD_FRAMES) {
              scene.remove(z.mesh);
              if (z.el && z.el.parentNode) z.el.parentNode.removeChild(z.el);
              zombies.splice(i, 1);
            } else {
              const key = 5000 + NEAR_DEAD_START + deadIdx;
              if (z.lastDrawn !== key) {
                z.lastDrawn = key;
                setSpriteFrame(z.el, DEAD_NEAR_URL, NEAR_DEAD_START + deadIdx, SPRITE_COLS, NEAR_DEAD_ROWS);
              }
              // Fade out last 16 frames
              const fadeStart = NEAR_DEAD_FRAMES - 16;
              z.el.style.opacity = deadIdx >= fadeStart ? 1 - (deadIdx - fadeStart) / 16 : 1;
            }
          } else {
            const deadIdx = Math.floor(z.deadFrameTime * SPRITE_FPS * 1.8);
            if (deadIdx >= DEAD_FRAMES) {
              scene.remove(z.mesh);
              if (z.el && z.el.parentNode) z.el.parentNode.removeChild(z.el);
              zombies.splice(i, 1);
            } else {
              const key = 3000 + DEAD_START + deadIdx;
              if (z.lastDrawn !== key) {
                z.lastDrawn = key;
                setSpriteFrame(z.el, DEAD_URL, DEAD_START + deadIdx, SPRITE_COLS, DEAD_ROWS);
              }
              // Fade out last 12 frames
              const fadeStart = DEAD_FRAMES - 12;
              z.el.style.opacity = deadIdx >= fadeStart ? 1 - (deadIdx - fadeStart) / 12 : 1;
            }
          }
          continue;
        }

        if (!z.alive) continue;

        // ── Stagger animation ────────────────────────────────────────
        if (z.state === 'stagger') {
          z.staggerFrameTime += dt;
          if (z.nearDeath) {
            const stgIdx = Math.floor(z.staggerFrameTime * SPRITE_FPS * 2);
            if (stgIdx >= NEAR_STAGGER_FRAMES) {
              z.state = z.prevState;
              z.staggerFrameTime = 0;
              z.lastDrawn = -1;
            } else {
              const key = 4000 + stgIdx;
              if (z.lastDrawn !== key) {
                z.lastDrawn = key;
                setSpriteFrame(z.el, DEAD_NEAR_URL, stgIdx, SPRITE_COLS, NEAR_DEAD_ROWS);
              }
            }
          } else {
            const stgIdx = Math.floor(z.staggerFrameTime * SPRITE_FPS * 2);
            if (stgIdx >= STAGGER_FRAMES) {
              z.state = z.prevState;
              z.staggerFrameTime = 0;
              z.lastDrawn = -1;
            } else {
              const key = 2000 + stgIdx;
              if (z.lastDrawn !== key) {
                z.lastDrawn = key;
                setSpriteFrame(z.el, DEAD_URL, stgIdx, SPRITE_COLS, DEAD_ROWS);
              }
            }
          }
          continue;
        }

        // ── Hit slowdown ────────────────────────────────────────────
        if (z.slowTimer > 0) {
          z.slowTimer -= dt;
          z.spd = z.baseSpd * 0.25;
          if (z.slowTimer <= 0) z.spd = z.baseSpd;
        }

        // ── Move toward player (stop at attack range) ─────────────────
        const dx = pp.x - z.mesh.position.x, dz = pp.z - z.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // State transitions
        if (dist < 1.0 && (z.state === 'running' || z.state === 'walking_back')) {
          z.state = 'attacking';
          z.atkFrameTime = 0;
          z.atkDmgDealt = false;
          z.lastDrawn = -1;
          z._atkSnd = sndZombieAtk();
        } else if (dist > 2.0 && z.state === 'attacking') {
          z.state = 'walking_back';
          z.frameTime = 0;
          z.lastDrawn = -1;
        }

        if ((z.state === 'running' || z.state === 'walking_back') && dist > 1.0 && dist > 0.1) {
          z.mesh.position.x += dx / dist * z.spd;
          z.mesh.position.z += dz / dist * z.spd;
        }

        // ── Spritesheet frame animation (CSS background) ────────────
        if (z.state === 'running') {
          z.frameTime += dt;
          const frameIdx = Math.floor(z.frameTime * SPRITE_FPS) % WALK_FRAMES;
          if (z.lastDrawn !== frameIdx) {
            z.lastDrawn = frameIdx;
            setSpriteFrame(z.el, WALK_URL, frameIdx, SPRITE_COLS, WALK_ROWS);
          }
        } else if (z.state === 'attacking') {
          z.atkFrameTime += dt;
          const rawIdx = Math.floor(z.atkFrameTime * SPRITE_FPS * 2.2);
          const cycle = ATK_FRAMES * 2 - 2; // ping-pong cycle length
          const pos = rawIdx % cycle;
          const atkIdx = pos < ATK_FRAMES ? pos : cycle - pos;
          const key = 1000 + atkIdx;
          if (z.lastDrawn !== key) {
            z.lastDrawn = key;
            setSpriteFrame(z.el, ATK_URL, atkIdx, SPRITE_COLS, ATK_ROWS);
          }
          // Deal damage once at the end of forward pass
          if (pos === ATK_FRAMES - 1 && !z.atkDmgDealt) {
            z.atkDmgDealt = true;
            takeDmg(DIFF[gs.diff].dmg);
          }
          // Reset damage flag at start of new forward pass
          if (pos === 0) {
            z.atkDmgDealt = false;
          }
        } else if (z.state === 'walking_back') {
          z.frameTime += dt;
          const frameIdx = Math.floor(z.frameTime * SPRITE_FPS) % WALK_AFTER_ATK_FRAMES;
          const key = 6000 + frameIdx;
          if (z.lastDrawn !== key) {
            z.lastDrawn = key;
            setSpriteFrame(z.el, WALK_AFTER_ATK_URL, frameIdx, SPRITE_COLS, WALK_AFTER_ATK_ROWS);
          }
        }
      }

      // ── Update bats ──────────────────────────────────────────
      for (let i = bats.length - 1; i >= 0; i--) {
        const b = bats[i];

        // Vertical bobbing while alive and not dead
        if (b.alive && b.state !== 'dead') {
          b.mesh.position.y = 1.8 + Math.sin(animT * b.flySpeed + b.flyPhase) * 0.45;
        }
        const baseY = b.mesh.position.y;

        // ── Project 3D → screen for DOM sprite ──────────────────
        if (b.el) {
          _zpt.set(b.mesh.position.x, baseY + 0.95, b.mesh.position.z);
          _zpt.project(camera);
          if (_zpt.z > 1) {
            b.el.style.display = 'none';
          } else {
            b.el.style.display = '';
            const headX = (_zpt.x + 1) / 2 * innerWidth;
            const headY = (-_zpt.y + 1) / 2 * innerHeight;
            _zpt.set(b.mesh.position.x, baseY - 0.95, b.mesh.position.z);
            _zpt.project(camera);
            const feetY = (-_zpt.y + 1) / 2 * innerHeight;
            const pixH = Math.max(6, feetY - headY);
            const pixW = pixH;
            const dist2d = Math.sqrt((b.mesh.position.x - pp.x) ** 2 + (b.mesh.position.z - pp.z) ** 2);
            const bIdx = Math.round(1000 / Math.max(dist2d, 0.1));
            const bs = b.el.style;
            bs.display = 'block';
            const bpxW = pixW | 0, bpxH = pixH | 0;
            if (b._pw !== bpxW) { b._pw = bpxW; bs.width = bpxW + 'px'; }
            if (b._ph !== bpxH) { b._ph = bpxH; bs.height = bpxH + 'px'; }
            bs.zIndex = bIdx;
            const bWantFilter = b.hitFlash > 0;
            if (bWantFilter !== b._lastFilter) {
              b._lastFilter = bWantFilter;
              bs.filter = bWantFilter ? 'brightness(2) sepia(1) saturate(10) hue-rotate(-30deg)' : 'none';
            }
            bs.transform = `translate3d(${headX - pixW / 2}px,${headY}px,0)`;
          }
        }

        // Hit flash decay (antes de cualquier continue)
        if (b.hitFlash > 0) b.hitFlash -= dt;

        // ── Dead animation ──────────────────────────────────────
        if (b.state === 'dead') {
          b.deadFrameTime += dt;
          b.mesh.position.y -= dt * 2.5;
          const deadIdx = Math.floor(b.deadFrameTime * BAT_SPRITE_FPS * 1.8);
          if (deadIdx >= BAT_DEAD_FRAMES) {
            scene.remove(b.mesh);
            if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
            bats.splice(i, 1);
          } else {
            const key = 3000 + BAT_DEAD_START + deadIdx;
            if (b.lastDrawn !== key) {
              b.lastDrawn = key;
              setSpriteFrame(b.el, BAT_DEAD_URL, BAT_DEAD_START + deadIdx, SPRITE_COLS, BAT_DEAD_ROWS);
            }
          }
          continue;
        }

        if (!b.alive) continue;

        // ── Stagger animation (first 10 frames of dead sheet) ───
        if (b.state === 'stagger') {
          b.staggerFrameTime += dt;
          const stgIdx = Math.floor(b.staggerFrameTime * BAT_SPRITE_FPS * 2);
          if (stgIdx >= BAT_STAGGER_FRAMES) {
            b.state = b.prevState;
            b.staggerFrameTime = 0;
            b.lastDrawn = -1;
          } else {
            const key = 2000 + stgIdx;
            if (b.lastDrawn !== key) {
              b.lastDrawn = key;
              setSpriteFrame(b.el, BAT_DEAD_URL, stgIdx, SPRITE_COLS, BAT_DEAD_ROWS);
            }
          }
          continue;
        }



        // ── Hit slowdown ────────────────────────────────────────
        if (b.slowTimer > 0) {
          b.slowTimer -= dt;
          b.spd = b.baseSpd * 0.25;
          if (b.slowTimer <= 0) b.spd = b.baseSpd;
        }

        // Move toward player with complex patterns
        const bdx = pp.x - b.mesh.position.x, bdz = pp.z - b.mesh.position.z;
        const bdist = Math.sqrt(bdx * bdx + bdz * bdz);

        // State transitions: dive = attack
        if (b.state === 'flying') {
          b.diveTimer -= dt;
          if (b.diveTimer <= 0 && bdist < 10) {
            b.state = 'attacking';
            b.atkFrameTime = 0;
            b.atkDmgDealt = false;
            b.diveTime = 1.0 + Math.random() * 0.5;
            b.lastDrawn = -1;
          }
        }
        if (b.state === 'attacking') {
          b.diveTime -= dt;
          if (b.diveTime <= 0 || bdist < BAT.atkRange) {
            if (bdist < BAT.atkRange && !b.atkDmgDealt) {
              b.atkDmgDealt = true;
              takeDmg(BAT.dmg);
            }
            b.state = 'retreating';
            b.retreatTime = 0.5;
            b.lastDrawn = -1;
          }
        }
        if (b.state === 'retreating') {
          b.retreatTime -= dt;
          if (b.retreatTime <= 0) {
            b.state = 'flying';
            b.diveTimer = 3 + Math.random() * 4;
            b.lastDrawn = -1;
          }
        }

        if (bdist > 0.1) {
          const nx = bdx / bdist, nz = bdz / bdist;
          const px = -nz, pz = nx;
          if (b.state === 'flying') {
            b.strafePhase += b.strafeFreq * dt;
            const strafe = Math.sin(b.strafePhase) * b.strafeAmp * dt;
            if (bdist > 5) {
              b.mesh.position.x += nx * b.spd;
              b.mesh.position.z += nz * b.spd;
            } else if (bdist < 4) {
              // Too close, back off
              b.mesh.position.x -= nx * b.spd * 0.5;
              b.mesh.position.z -= nz * b.spd * 0.5;
            }
            b.mesh.position.x += px * strafe;
            b.mesh.position.z += pz * strafe;
          } else if (b.state === 'attacking') {
            const diveSpd = b.spd * 3;
            b.mesh.position.x += nx * diveSpd;
            b.mesh.position.z += nz * diveSpd;
          } else if (b.state === 'retreating') {
            // Fly away from player
            b.mesh.position.x -= nx * b.spd * 2;
            b.mesh.position.z -= nz * b.spd * 2;
          }
          b.mesh.position.x = Math.max(-34, Math.min(34, b.mesh.position.x));
          b.mesh.position.z = Math.max(-34, Math.min(34, b.mesh.position.z));
        }

        // ── Spritesheet frame animation (CSS background) ────────
        b.frameTime += dt;
        const batFps = b.state === 'attacking' ? BAT_SPRITE_FPS * 2 : BAT_SPRITE_FPS;
        const frameIdx = Math.floor(b.frameTime * batFps) % BAT_FLY_FRAMES;
        if (b.lastDrawn !== frameIdx) {
          b.lastDrawn = frameIdx;
          setSpriteFrame(b.el, BAT_FLY_URL, frameIdx, SPRITE_COLS, BAT_FLY_ROWS);
        }
      }

      // ── Player movement ───────────────────────────────────────
      const fwd = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      const strafe = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      if (fwd !== 0 || strafe !== 0) {
        const yaw = camState.yaw;
        let dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
        let dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len; dz /= len; // normalize diagonals
        const spd = 4.5;
        camState.px = Math.max(-34.2, Math.min(34.2, camState.px + dx * spd * dt));
        camState.pz = Math.max(-34.2, Math.min(34.2, camState.pz + dz * spd * dt));
        camRig.position.x = camState.px;
        camRig.position.z = camState.pz;
      }

      // ── Smooth recoil application ─────────────────────────
      const rSpeed = 8;
      if (Math.abs(camState.recoilPitch) > 0.0001) {
        const applyP = camState.recoilPitch * Math.min(1, rSpeed * dt);
        camState.pitch = Math.min(0.44, camState.pitch + applyP);
        camState.recoilPitch -= applyP;
        camera.rotation.x = camState.pitch;
      }
      if (Math.abs(camState.recoilYaw) > 0.0001) {
        const applyY = camState.recoilYaw * Math.min(1, rSpeed * dt);
        camState.yaw += applyY;
        camState.recoilYaw -= applyY;
        camRig.rotation.y = camState.yaw;
      }

      // ── Weapon sway (includes recoil push) ─────────────
      camState.swayY -= camState.recoilPitch * 120;
      camState.swayX += camState.recoilYaw * 80;
      const maxSway = 22;
      camState.swayX = Math.max(-maxSway, Math.min(maxSway, camState.swayX));
      camState.swayY = Math.max(-maxSway, Math.min(maxSway, camState.swayY));
      camState.swayX *= 1 - Math.min(1, 6 * dt);
      camState.swayY *= 1 - Math.min(1, 6 * dt);
      if (_gunEl) {
        _gunEl.style.marginLeft = camState.swayX + 'px';
        _gunEl.style.marginBottom = -camState.swayY + 'px';
      }

      applyShake(dt, camState.px, camState.pz);
      updateFlashlight();
    }

    vfx.draw(dt);
    drawIndicators();
    composer.render(dt);
  }

  loop(performance.now());
}
