import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  KernelSize,
  NoiseEffect,
  RenderPass,
} from 'postprocessing';
import { renderer, scene, camera } from './scene.js';

// ── Custom color-grade effect (postprocessing v6 Effect API) ──
const colorGradeGLSL = `
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 d = mix(c, vec3(lum), 0.18);   // slight desaturation
    d.r *= 0.88; d.g *= 1.06; d.b *= 0.80; // sickly green-horror tint
    outputColor = vec4(d, inputColor.a);
  }
`;
class ColorGradeEffect extends Effect {
  constructor() {
    super('ColorGradeEffect', colorGradeGLSL, { blendFunction: BlendFunction.NORMAL });
  }
}

export let composer;

export function initComposer(w, h) {
  composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType, // HDR buffer — better bloom quality
  });

  composer.addPass(new RenderPass(scene, camera));

  // Bloom — flashlight cone, zombie eyes, muzzle flash
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    kernelSize: KernelSize.LARGE,
    luminanceThreshold: 0.12,
    luminanceSmoothing: 0.4,
    intensity: 1.8,
  });

  // Film grain
  const noise = new NoiseEffect({ premultiply: false });
  noise.blendMode.blendFunction = BlendFunction.SCREEN;
  noise.blendMode.opacity.value = 0.065;

  composer.addPass(new EffectPass(camera, bloom, noise, new ColorGradeEffect()));
}

export function resizeComposer(w, h) {
  if (composer) composer.setSize(w, h);
}
