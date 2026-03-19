export const vc = document.getElementById('vc');
const vx = vc.getContext('2d');

export function resizeOverlay(w, h) {
  vc.width = w;
  vc.height = h;
}

const MAX_BLOOD = 100;

export const vfx = {
  muzzle: 0, red: 0, blood: [],

  addBlood(x, y) {
    const count = Math.min(20, MAX_BLOOD - this.blood.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 5 + Math.random() * 16;
      const r = 80 + Math.random() * 50 | 0;
      const g = 16 + Math.random() * 16 | 0;
      const b = 12 + Math.random() * 16 | 0;
      this.blood.push({
        x, y,
        vx: Math.cos(a) * s * (0.5 + Math.random()),
        vy: Math.sin(a) * s * (0.5 + Math.random()) - 6,
        sz: 4 + Math.random() * 14, life: 1, decay: 0.03 + Math.random() * 0.035,
        color: `rgb(${r},${g},${b})`,
      });
    }
  },

  draw(dt) {
    const W = vc.width, H = vc.height;
    vx.clearRect(0, 0, W, H);

    if (this.muzzle > 0) {
      const cx = W / 2 + 175, cy = H - 55, r = 95 * this.muzzle;
      const g = vx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   `rgba(255,252,200,${this.muzzle})`);
      g.addColorStop(0.3, `rgba(255,160,50,${this.muzzle * 0.8})`);
      g.addColorStop(1,   'rgba(255,80,0,0)');
      vx.fillStyle = g; vx.beginPath(); vx.arc(cx, cy, r, 0, Math.PI * 2); vx.fill();
      vx.fillStyle = `rgba(255,210,110,${this.muzzle * 0.12})`; vx.fillRect(0, 0, W, H);
      this.muzzle -= dt * 10; if (this.muzzle < 0) this.muzzle = 0;
    }

    // Blood particles — swap-remove avoids splice overhead
    let bi = this.blood.length;
    while (bi-- > 0) {
      const p = this.blood[bi];
      p.x += p.vx * dt * 55; p.y += p.vy * dt * 55; p.vy += 0.38;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.blood[bi] = this.blood[this.blood.length - 1];
        this.blood.pop();
        continue;
      }
      vx.globalAlpha = p.life;
      vx.fillStyle = p.color;
      const s = p.sz * p.life;
      vx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
    vx.globalAlpha = 1;

    // Oscuridad de linterna — negro total fuera del haz
    const cx = W / 2, cy = H / 2;
    const beamR = Math.min(W, H) * 0.43;

    // Capa principal: transición rápida a negro total
    const dark = vx.createRadialGradient(cx, cy, 0, cx, cy, beamR);
    dark.addColorStop(0,    'rgba(0,0,0,0)');
    dark.addColorStop(0.45, 'rgba(0,0,0,0.15)');
    dark.addColorStop(0.70, 'rgba(0,0,0,0.85)');
    dark.addColorStop(0.85, 'rgba(0,0,0,0.97)');
    dark.addColorStop(1.0,  'rgba(0,0,0,1)');
    vx.fillStyle = dark; vx.fillRect(0, 0, W, H);

    // Capas desplazadas para bordes irregulares
    const offsets = [
      { ox: -0.06, oy:  0.04, r: 0.90 },
      { ox:  0.05, oy: -0.04, r: 1.06 },
      { ox: -0.03, oy: -0.05, r: 0.95 },
    ];
    for (let l = 0; l < offsets.length; l++) {
      const { ox, oy, r } = offsets[l];
      const lx = cx + ox * beamR, ly = cy + oy * beamR, lr = beamR * r;
      const g = vx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0,    'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(0.78, 'rgba(0,0,0,0.35)');
      g.addColorStop(1.0,  'rgba(0,0,0,0.55)');
      vx.fillStyle = g; vx.fillRect(0, 0, W, H);
    }

    // ── Damage red overlay (sobre todo, incluida la linterna) ──
    if (this.red > 0) {
      vx.fillStyle = `rgba(255,0,0,${this.red * 0.18})`; vx.fillRect(0, 0, W, H);
      const vg = vx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(180,0,0,${this.red * 0.6})`);
      vx.fillStyle = vg; vx.fillRect(0, 0, W, H);
      this.red -= dt * 1.5; if (this.red < 0) this.red = 0;
    }

  },

};
