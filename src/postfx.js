import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { renderer, scene, camera } from './scene.js';

// Grain + horror color grade in a single final ShaderPass
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    time:     { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453 + time * 0.1);
    }
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;
      // film grain
      c += (rand(vUv) - 0.5) * 0.065;
      // slight desaturation + horror tint
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(lum), 0.18);
      c.r *= 0.88; c.g *= 1.06; c.b *= 0.80;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
    }
  `,
};

export let composer;

export function initComposer(w, h) {
  const _composer = new EffectComposer(renderer);
  _composer.addPass(new RenderPass(scene, camera));

  // Bloom — hace brillar el cono de la linterna y el muzzle flash
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.8, 0.4, 0.12);
  _composer.addPass(bloom);

  // Grain + color grade
  const final = new ShaderPass(FinalShader);
  final.renderToScreen = true;
  _composer.addPass(final);

  // Wrapper que actualiza el tiempo del grain en cada frame
  // (mantiene la interfaz composer.render(dt) que usa loop.js)
  let _t = 0;
  const _origRender = _composer.render.bind(_composer);
  _composer.render = (dt) => {
    _t += dt ?? 0.016;
    final.uniforms.time.value = _t;
    _origRender(dt);
  };

  composer = _composer;
}

export function resizeComposer(w, h) {
  if (composer) composer.setSize(w, h);
}
