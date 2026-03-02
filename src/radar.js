import { vc } from './vfx.js';
import { zombies } from './zombie.js';
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

    // Vector from player TO zombie
    const dx   = z.mesh.position.x - camRig.position.x;
    const dz   = z.mesh.position.z - camRig.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.5) return;

    // Relative angle: 0 = in front, +π/2 = right, ±π = behind, -π/2 = left
    const dot      = dx * fwdX + dz * fwdZ;
    const cross    = fwdX * dz - fwdZ * dx;
    const relAngle = Math.atan2(cross, dot);

    // Skip zombies inside the visible FOV
    if (Math.abs(relAngle) < DEAD_ZONE) return;

    // Opacity: 1.0 at dist ≤ 5, fades to 0.2 at dist ≥ 25
    const alpha = Math.min(1.0, Math.max(0.2, 1 - (dist - 5) / 20));

    // Arrow size: larger when very close (< 8 units away = danger)
    const size = dist < 8 ? 22 : 16;

    // Position on ring
    const ix = cx + Math.sin(relAngle) * ringR;
    const iy = cy - Math.cos(relAngle) * ringR;

    drawArrow(vx, ix, iy, relAngle, alpha, size);
  });
}

function drawArrow(ctx, x, y, angle, alpha, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  // Glow layer (larger, transparent shape underneath)
  ctx.fillStyle = 'rgba(255, 80, 0, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.7);
  ctx.lineTo( size * 0.9, size * 1.0);
  ctx.lineTo(-size * 0.9, size * 1.0);
  ctx.closePath();
  ctx.fill();

  // Solid arrow (tip points outward = toward the zombie)
  ctx.fillStyle = '#ff3300';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo( size * 0.55, size * 0.6);
  ctx.lineTo(-size * 0.55, size * 0.6);
  ctx.closePath();
  ctx.fill();

  // Small bright highlight on the tip
  ctx.fillStyle = 'rgba(255, 200, 150, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.9);
  ctx.lineTo( size * 0.22, -size * 0.2);
  ctx.lineTo(-size * 0.22, -size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // restores globalAlpha, transform, etc.
}
