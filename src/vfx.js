export const vc = document.getElementById('vc');
const vx = vc.getContext('2d');

export function resizeOverlay(w, h) {
  vc.width = w;
  vc.height = h;
}

export const vfx = {
  muzzle: 0, red: 0, blood: [],

  addBlood(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 10;
      this.blood.push({
        x, y,
        vx: Math.cos(a) * s * (0.5 + Math.random()),
        vy: Math.sin(a) * s * (0.5 + Math.random()) - 4.5,
        sz: 3 + Math.random() * 8, life: 1, decay: 0.04 + Math.random() * 0.04,
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

    for (let i = this.blood.length - 1; i >= 0; i--) {
      const p = this.blood[i];
      p.x += p.vx * dt * 55; p.y += p.vy * dt * 55; p.vy += 0.38;
      p.life -= p.decay;
      if (p.life <= 0) { this.blood.splice(i, 1); continue; }
      const r = 150 + Math.random() * 60 | 0;
      vx.globalAlpha = p.life;
      vx.fillStyle = `rgb(${r},${Math.random() * 12 | 0},0)`;
      vx.beginPath(); vx.arc(p.x, p.y, p.sz * p.life, 0, Math.PI * 2); vx.fill();
    }
    vx.globalAlpha = 1;

    if (this.red > 0) {
      vx.fillStyle = `rgba(255,0,0,${this.red * 0.33})`; vx.fillRect(0, 0, W, H);
      const vg = vx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(140,0,0,${this.red * 0.5})`);
      vx.fillStyle = vg; vx.fillRect(0, 0, W, H);
      this.red -= dt * 2.5; if (this.red < 0) this.red = 0;
    }

    // Oscuridad de linterna — reemplaza la viñeta simple
    // Gradiente radial: transparente en el centro (haz), negro casi total en los bordes
    const cx = W / 2, cy = H / 2;
    const beamR = Math.min(W, H) * 0.48;
    const dark = vx.createRadialGradient(cx, cy, 0, cx, cy, beamR);
    dark.addColorStop(0,    'rgba(0,0,0,0)');
    dark.addColorStop(0.38, 'rgba(0,0,0,0.18)');
    dark.addColorStop(0.65, 'rgba(0,0,0,0.86)');
    dark.addColorStop(1.0,  'rgba(0,0,0,0.97)');
    vx.fillStyle = dark; vx.fillRect(0, 0, W, H);

    // Halo cálido sutil en el centro del haz (punto caliente de la linterna)
    const halo = vx.createRadialGradient(cx, cy, 0, cx, cy, beamR * 0.18);
    halo.addColorStop(0,   'rgba(255,255,220,0.06)');
    halo.addColorStop(1.0, 'rgba(0,0,0,0)');
    vx.fillStyle = halo; vx.fillRect(0, 0, W, H);

  },

};
