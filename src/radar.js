import { vc } from './vfx.js';
import { zombies } from './zombie.js';
import { bats } from './bat.js';
import { camRig } from './scene.js';
import { camState, gs } from './state.js';

// getContext('2d') always returns the same object for a given canvas
const vx = vc.getContext('2d');

// Dead zone: don't show indicator if zombie is within ±55° of center.
// The camera vFOV is 85°; on a 16:9 screen the hFOV is ~105°, so ±52.5°
// are actually visible. 55° keeps a small safety margin.
const DEAD_ZONE = Math.PI * 55 / 180;

export function drawIndicators() {
  if (!gs.started || gs.paused || gs.over) return;

  const W = vc.width, H = vc.height;
  const cx = W / 2, cy = H / 2;

  // Ring radius: 78% of the screen's smaller half-dimension
  const ringR = Math.min(cx, cy) * 0.78;

  // Player facing direction in XZ plane (Three.js: camera looks toward -Z at yaw=0)
  const yaw  = camState.yaw;
  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);

  zombies.forEach(z => {
    if (!z.alive || z.dying) return;
    drawEnemyIndicator(z, fwdX, fwdZ, cx, cy, ringR, '#ff3300');
  });

  bats.forEach(b => {
    if (!b.alive || b.dying) return;
    drawEnemyIndicator(b, fwdX, fwdZ, cx, cy, ringR, '#aa44ff');
  });
}

function drawEnemyIndicator(e, fwdX, fwdZ, cx, cy, ringR, color) {
    const dx   = e.mesh.position.x - camRig.position.x;
    const dz   = e.mesh.position.z - camRig.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.5) return;

    const dot      = dx * fwdX + dz * fwdZ;
    const cross    = fwdX * dz - fwdZ * dx;
    const relAngle = Math.atan2(cross, dot);

    if (Math.abs(relAngle) < DEAD_ZONE) return;

    // Bats visible from further away
    const alpha = Math.min(1.0, Math.max(0.25, 1 - (dist - 8) / 30));
    const size = dist < 10 ? 22 : 16;

    const ix = cx + Math.sin(relAngle) * ringR;
    const iy = cy - Math.cos(relAngle) * ringR;

    drawArrow(vx, ix, iy, relAngle, alpha, size, color);
}

function drawArrow(ctx, x, y, angle, alpha, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  // Glow layer
  ctx.fillStyle = color.replace(')', ', 0.35)').replace('rgb', 'rgba').replace('#', '');
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.7);
  ctx.lineTo( size * 0.9, size * 1.0);
  ctx.lineTo(-size * 0.9, size * 1.0);
  ctx.closePath();
  ctx.fill();

  // Solid arrow
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo( size * 0.55, size * 0.6);
  ctx.lineTo(-size * 0.55, size * 0.6);
  ctx.closePath();
  ctx.fill();

  // Highlight on tip
  ctx.fillStyle = 'rgba(255, 200, 150, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.9);
  ctx.lineTo( size * 0.22, -size * 0.2);
  ctx.lineTo(-size * 0.22, -size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
