import * as THREE from 'three';
import { gs, camState, keys } from './state.js';
import { DIFF } from './config.js';
import { scene, renderer, camera, camRig, keyLight, applyShake, updateFlashlight } from './scene.js';
import { composer } from './postfx.js';
import { vfx } from './vfx.js';
import { zombies } from './zombie.js';
import { bats } from './bat.js';
import { BAT } from './config.js';
import { takeDmg } from './game.js';
import { updateComboUI } from './ui.js';
import { drawIndicators } from './radar.js';

let lastT = performance.now();
let animT = 0;

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
          _zpt.set(z.mesh.position.x, baseY + 3.1, z.mesh.position.z);
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
            z.el.style.width   = pixW + 'px';
            z.el.style.height  = pixH + 'px';
            z.el.style.left    = (headX - pixW / 2) + 'px';
            z.el.style.top     = headY + 'px';
            z.el.style.zIndex  = Math.round(1000 / Math.max(dist2d, 0.1));
          }
        }

        // ── Dying ────────────────────────────────────────────────────
        if (z.dying) {
          z.dyT -= dt;
          z.mesh.position.y -= dt * 2.8;
          if (z.el) z.el.style.opacity = Math.max(0, z.dyT / 0.55);
          if (z.dyT <= 0) {
            scene.remove(z.mesh);
            if (z.el && z.el.parentNode) z.el.parentNode.removeChild(z.el);
            zombies.splice(i, 1);
          }
          continue;
        }
        if (!z.alive) continue;

        // ── Move toward player (stop at attack range) ─────────────────
        const dx = pp.x - z.mesh.position.x, dz = pp.z - z.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 1.9 && dist > 0.1) {
          z.mesh.position.x += dx / dist * z.spd;
          z.mesh.position.z += dz / dist * z.spd;
        }

        // ── Hit flash via CSS filter ──────────────────────────────────
        if (z.hitFlash > 0) {
          z.hitFlash -= dt;
          if (z.el) z.el.style.filter = 'brightness(4) sepia(1) saturate(8)';
        } else {
          if (z.el) z.el.style.filter = '';
        }

        // ── Attack ────────────────────────────────────────────────────
        if (dist < 1.9) {
          z.atkCd -= dt;
          if (z.atkCd <= 0) {
            z.atkCd = 1.2;
            takeDmg(DIFF[gs.diff].dmg);
            if (z.el) {
              z.el.classList.remove('attacking');
              z.el.getBoundingClientRect(); // force reflow to restart animation
              z.el.classList.add('attacking');
            }
          }
        }
      }

      // ── Update bats ──────────────────────────────────────────
      for (let i = bats.length - 1; i >= 0; i--) {
        const b = bats[i];

        // Vertical bobbing while alive
        if (b.alive) b.mesh.position.y = 1.8 + Math.sin(animT * b.flySpeed + b.flyPhase) * 0.45;
        const baseY = b.mesh.position.y;

        // DOM position (bat SVG is 160×90, aspect 1.78)
        if (b.el) {
          _zpt.set(b.mesh.position.x, baseY + 0.35, b.mesh.position.z);
          _zpt.project(camera);
          if (_zpt.z > 1) {
            b.el.style.display = 'none';
          } else {
            b.el.style.display = '';
            const headX = (_zpt.x + 1) / 2 * innerWidth;
            const headY = (-_zpt.y + 1) / 2 * innerHeight;
            _zpt.set(b.mesh.position.x, baseY - 0.35, b.mesh.position.z);
            _zpt.project(camera);
            const feetY  = (-_zpt.y + 1) / 2 * innerHeight;
            const pixH   = Math.max(6, feetY - headY);
            const pixW   = pixH * (160 / 90);
            const dist2d = Math.sqrt((b.mesh.position.x - pp.x) ** 2 + (b.mesh.position.z - pp.z) ** 2);
            b.el.style.width  = pixW + 'px';
            b.el.style.height = pixH + 'px';
            b.el.style.left   = (headX - pixW / 2) + 'px';
            b.el.style.top    = headY + 'px';
            b.el.style.zIndex = Math.round(1000 / Math.max(dist2d, 0.1));
          }
        }

        // Dying — tumble and fade
        if (b.dying) {
          b.dyT -= dt;
          b.mesh.position.y -= dt * 3.5;
          b.mesh.position.x += b.dyVx * dt;
          if (b.el) b.el.style.opacity = Math.max(0, b.dyT / 0.45);
          if (b.dyT <= 0) {
            scene.remove(b.mesh);
            if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
            bats.splice(i, 1);
          }
          continue;
        }
        if (!b.alive) continue;

        // Move toward player (stop at attack range)
        const bdx = pp.x - b.mesh.position.x, bdz = pp.z - b.mesh.position.z;
        const bdist = Math.sqrt(bdx * bdx + bdz * bdz);
        if (bdist > BAT.atkRange && bdist > 0.1) {
          b.mesh.position.x += bdx / bdist * b.spd;
          b.mesh.position.z += bdz / bdist * b.spd;
        }

        // Hit flash
        if (b.hitFlash > 0) {
          b.hitFlash -= dt;
          if (b.el) b.el.style.filter = 'brightness(4) sepia(1) saturate(8)';
        } else {
          if (b.el) b.el.style.filter = '';
        }

        // Attack — swoop
        if (bdist < BAT.atkRange) {
          b.atkCd -= dt;
          if (b.atkCd <= 0) {
            b.atkCd = BAT.atkCd;
            takeDmg(BAT.dmg);
            if (b.el) {
              b.el.classList.remove('swooping');
              b.el.getBoundingClientRect();
              b.el.classList.add('swooping');
            }
          }
        }
      }

      // ── Player movement ───────────────────────────────────────
      const fwd    = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
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

      keyLight.intensity = 0.25 + Math.sin(animT * 2.8) * 0.08;
      applyShake(dt, camState.px, camState.pz);
      updateFlashlight();
    }

    vfx.draw(dt);
    drawIndicators();
    composer.render(dt);
  }

  loop(performance.now());
}
