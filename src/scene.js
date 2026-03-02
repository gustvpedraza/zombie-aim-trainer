import * as THREE from 'three';

export const rc = document.getElementById('rc');

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04040e, 0.048);
scene.background = new THREE.Color(0x02020a);

export const renderer = new THREE.WebGLRenderer({ canvas: rc, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Camera rig: camRig handles yaw + shake, camera handles pitch only
export const camRig = new THREE.Group();
camRig.rotation.order = 'YXZ';
camRig.position.set(0, 1.72, 0);
scene.add(camRig);

export const camera = new THREE.PerspectiveCamera(85, 1, 0.05, 80);
camera.rotation.order = 'YXZ';
camRig.add(camera);

export function resize(w, h) {
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Lighting — moonlit night: tiny blue ambient + faint directional moonlight
scene.add(new THREE.AmbientLight(0x08091a, 0.35));

const moonLight = new THREE.DirectionalLight(0x5566aa, 0.05);
moonLight.position.set(-18, 35, -12);
scene.add(moonLight);

export const keyLight = new THREE.PointLight(0xff1a00, 0.3, 28);
keyLight.position.set(0, 4, 0);
scene.add(keyLight);

// Linterna (SpotLight pegada a la cámara)
export const flashlight = new THREE.SpotLight(0xfffff0, 5.5, 45, 0.35, 0.45, 1.5);
flashlight.position.set(-0.25, -0.1, 0); // desplazada a la izquierda (mano izquierda)
camera.add(flashlight);
scene.add(flashlight.target); // el target vive en la escena para que Three.js lo resuelva

flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.camera.near = 0.1;
flashlight.shadow.camera.far = 45;

// Vectores pre-alocados para updateFlashlight (evita GC pressure a 60fps)
const _flPos  = new THREE.Vector3();
const _flDir  = new THREE.Vector3();
const _flQuat = new THREE.Quaternion();

export function updateFlashlight() {
  camera.getWorldPosition(_flPos);
  camera.getWorldQuaternion(_flQuat);
  _flDir.set(0, 0, -1).applyQuaternion(_flQuat);
  flashlight.target.position.copy(_flPos).addScaledVector(_flDir, 10);
}

// Volumetric flashlight beam — cone attached to camera
// Tip at camera origin, base opens forward along -Z
(function addBeamCone() {
  const coneH = 22;
  const coneR = Math.tan(0.35) * coneH; // 0.35 rad matches flashlight angle
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(coneR, coneH, 20, 1, true), // openEnded=true (no base cap)
    new THREE.MeshBasicMaterial({
      color: 0xfffff0,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  // rotation.x = π/2 → cone tip moves to +Z, base to -Z (camera looks -Z)
  // position.z = -coneH/2 → tip sits exactly at camera origin
  cone.rotation.x = Math.PI / 2;
  cone.position.set(-0.25, -0.1, -coneH / 2); // match flashlight offset (left hand)
  camera.add(cone);
})();

// Procedural starry-night sky texture with city skyline
function buildSkyTex() {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');

  // Night sky gradient
  const grad = cx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0.0, '#01010e');
  grad.addColorStop(0.55, '#02020f');
  grad.addColorStop(1.0, '#08071f');
  cx.fillStyle = grad; cx.fillRect(0, 0, S, S);

  // Subtle nebula tint near horizon
  const nebG = cx.createLinearGradient(0, S * 0.35, 0, S * 0.52);
  nebG.addColorStop(0, 'rgba(20,10,50,0)');
  nebG.addColorStop(1, 'rgba(30,15,60,0.18)');
  cx.fillStyle = nebG; cx.fillRect(0, S * 0.35, S, S * 0.17);

  // Stars — sparse
  for (let i = 0; i < 420; i++) {
    const sx = Math.random() * S, sy = Math.random() * S * 0.82;
    const sz = 0.5 + Math.random() * 0.8;
    const br = 0.4 + Math.random() * 0.5;
    cx.fillStyle = Math.random() < 0.25
      ? `rgba(180,200,255,${br})`
      : `rgba(255,252,225,${br})`;
    cx.beginPath(); cx.arc(sx, sy, sz, 0, Math.PI * 2); cx.fill();
  }

  // Bright star glints
  for (let i = 0; i < 8; i++) {
    const sx = Math.random() * S, sy = Math.random() * S * 0.7;
    cx.fillStyle = 'rgba(255,255,255,0.92)';
    cx.beginPath(); cx.arc(sx, sy, 1.3, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = 'rgba(200,220,255,0.25)';
    cx.lineWidth = 0.5;
    cx.beginPath(); cx.moveTo(sx - 5, sy); cx.lineTo(sx + 5, sy); cx.stroke();
    cx.beginPath(); cx.moveTo(sx, sy - 5); cx.lineTo(sx, sy + 5); cx.stroke();
  }

  // ── Forest treeline ───────────────────────────────────────────
  const horizonY = S * 0.49;

  // Pine tree: 3 stacked triangles + trunk
  function drawPine(x, base, h) {
    const w = h * 0.48;
    [[1, 0.56, 0.28], [0.68, 0.28, 0.50], [0.42, 0.06, 0.68]].forEach(([tip, bot, wf]) => {
      cx.beginPath();
      cx.moveTo(x, base - h * tip);
      cx.lineTo(x + w * wf, base - h * bot);
      cx.lineTo(x - w * wf, base - h * bot);
      cx.fill();
    });
    cx.fillRect(x - w * 0.055, base - h * 0.06, w * 0.11, h * 0.07);
  }

  // Bare dead tree: trunk + recursive branches
  function drawBare(x, base, h) {
    function branch(bx, by, len, angle, d) {
      if (d < 0 || len < 2) return;
      const ex = bx + Math.cos(angle) * len, ey = by + Math.sin(angle) * len;
      cx.lineWidth = Math.max(0.4, d * 0.7);
      cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(ex, ey); cx.stroke();
      branch(ex, ey, len * 0.62, angle - 0.38 - Math.random() * 0.2, d - 1);
      branch(ex, ey, len * 0.62, angle + 0.38 + Math.random() * 0.2, d - 1);
    }
    cx.strokeStyle = '#010109';
    cx.lineWidth = h / 22;
    cx.beginPath(); cx.moveTo(x, base); cx.lineTo(x, base - h * 0.48); cx.stroke();
    branch(x, base - h * 0.40, h * 0.30, -Math.PI / 2 - 0.50, 4);
    branch(x, base - h * 0.40, h * 0.30, -Math.PI / 2 + 0.50, 4);
    branch(x, base - h * 0.60, h * 0.22, -Math.PI / 2 - 0.42, 3);
    branch(x, base - h * 0.60, h * 0.22, -Math.PI / 2 + 0.42, 3);
  }

  // Layer 1 — distant dense pines (slightly lighter = farther away)
  cx.fillStyle = '#030311';
  let tx = -20;
  while (tx < S + 20) {
    const h = 28 + Math.random() * 52;
    drawPine(tx, horizonY + 4, h);
    tx += h * 0.30 + Math.random() * 6;
  }

  // Layer 2 — foreground larger trees, darkest
  cx.fillStyle = '#01010a';
  tx = -35;
  while (tx < S + 35) {
    const h = 60 + Math.random() * 115;
    if (Math.random() < 0.18) drawBare(tx, horizonY + 8, h);
    else drawPine(tx, horizonY + 8, h);
    tx += h * 0.26 + Math.random() * 14;
  }

  // Solid ground fill below horizon
  cx.fillStyle = '#01010a';
  cx.fillRect(0, horizonY + 6, S, S - horizonY);

  // Ground mist curling at tree roots
  const mistG = cx.createLinearGradient(0, horizonY - 25, 0, horizonY + 35);
  mistG.addColorStop(0,   'rgba(18,12,32,0)');
  mistG.addColorStop(0.5, 'rgba(14,10,26,0.32)');
  mistG.addColorStop(1,   'rgba(8,6,18,0)');
  cx.fillStyle = mistG; cx.fillRect(0, horizonY - 25, S, 60);

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Procedural floor texture — dark night grass
function buildFloorTex() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');

  // Base dark grass
  cx.fillStyle = '#0b1508';
  cx.fillRect(0, 0, S, S);

  // Color variation patches (lighter/darker areas)
  for (let k = 0; k < 28; k++) {
    const px = Math.random() * S, py = Math.random() * S;
    const pr = 25 + Math.random() * 65;
    const g = cx.createRadialGradient(px, py, 0, px, py, pr);
    const darker = Math.random() < 0.55;
    g.addColorStop(0, darker ? 'rgba(4,8,2,0.35)' : 'rgba(22,38,10,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  // Grass blades — short strokes at random angles
  for (let i = 0; i < 11000; i++) {
    const gx = Math.random() * S, gy = Math.random() * S;
    const len = 2 + Math.random() * 6;
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
    const r = (6  + Math.random() * 16) | 0;
    const g = (22 + Math.random() * 38) | 0;
    const b = (4  + Math.random() * 10) | 0;
    cx.strokeStyle = `rgba(${r},${g},${b},${0.45 + Math.random() * 0.45})`;
    cx.lineWidth = 0.5 + Math.random() * 0.7;
    cx.beginPath();
    cx.moveTo(gx, gy);
    cx.lineTo(gx + Math.cos(angle) * len, gy + Math.sin(angle) * len);
    cx.stroke();
  }

  // Sparse dirt / bare patches
  for (let k = 0; k < 8; k++) {
    const px = Math.random() * S, py = Math.random() * S;
    const pr = 8 + Math.random() * 20;
    const g = cx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, 'rgba(28,18,8,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  // Small stones
  for (let k = 0; k < 35; k++) {
    const px = Math.random() * S, py = Math.random() * S;
    const pr = 0.8 + Math.random() * 2.2;
    const v = (28 + Math.random() * 22) | 0;
    cx.fillStyle = `rgba(${v},${v - 4},${v - 8},0.65)`;
    cx.beginPath(); cx.arc(px, py, pr, 0, Math.PI * 2); cx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

// Environment
(function buildMap() {
  const add = (m, g) => { const mesh = new THREE.Mesh(g, m); scene.add(mesh); return mesh; };

  const floorTex = buildFloorTex();
  const floor = add(
    new THREE.MeshLambertMaterial({ map: floorTex }),
    new THREE.PlaneGeometry(70, 70)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  // Sky dome — BackSide renders from inside; fog:false so it never fogs out
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(58, 48, 24),
    new THREE.MeshBasicMaterial({ map: buildSkyTex(), side: THREE.BackSide, fog: false })
  );
  skyDome.position.y = 4;
  scene.add(skyDome);

  const wallM = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  [[0, 2.25, -35, 0], [0, 2.25, 35, Math.PI], [-35, 2.25, 0, Math.PI / 2], [35, 2.25, 0, -Math.PI / 2]]
    .forEach(([x, y, z, ry]) => {
      const w = add(wallM, new THREE.PlaneGeometry(70, 4.5));
      w.position.set(x, y, z); w.rotation.y = ry;
      w.receiveShadow = true;
    });


  const bM = new THREE.MeshBasicMaterial({ color: 0x2a0000, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 30; i++) {
    const d = add(bM, new THREE.CircleGeometry(0.3 + Math.random() * 1.8, 8));
    d.rotation.x = -Math.PI / 2;
    d.position.set((Math.random() - 0.5) * 60, 0.01, (Math.random() - 0.5) * 60);
  }
})();

// Camera shake
let shk = 0;
export function shake(v) { shk = Math.max(shk, v); }
export function applyShake(dt, baseX = 0, baseZ = 0) {
  if (shk > 0) {
    camRig.position.x = baseX + (Math.random() - 0.5) * shk * 0.3;
    camRig.position.z = baseZ + (Math.random() - 0.5) * shk * 0.3;
    camRig.position.y = 1.72 + (Math.random() - 0.5) * shk * 0.12;
    shk -= dt * 4;
    if (shk < 0) { shk = 0; camRig.position.set(baseX, 1.72, baseZ); }
  }
}

// World-to-screen (uses innerWidth/innerHeight to avoid importing vfx)
export function w2s(v3) {
  const p = v3.project(camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (-p.y + 1) / 2 * innerHeight };
}
