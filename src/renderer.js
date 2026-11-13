/* WebGLRenderer + Scene + Camera + merged `pmndrs/postprocessing` pipeline:
   - RenderPass
   - N8AOPostPass (half-res contact ambient occlusion in book shelves & trim)
   - DepthOfFieldEffect (smooth rack-focus when inspecting a pulled-out book)
   - EffectPass merging Mipmap Bloom + AgX Tone Mapping + Vignette + SMAA
   Also manages cached soft shadow updates (`renderer.shadowMap.autoUpdate = false`)
   so realtime soft shadows cost ~0 ms per frame while walking. */

import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  DepthOfFieldEffect
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { EYE, damp } from './constants.js';
import { SETTINGS, runtime } from './state.js';
import { currentTier, pixelRatio } from './quality.js';

export function createEngine() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1e6d6);
  scene.fog = new THREE.Fog(0xf1e6d6, SETTINGS.fogNear, SETTINGS.fogFar);

  const camera = new THREE.PerspectiveCamera(SETTINGS.fov, window.innerWidth / window.innerHeight, 0.08, 42);
  camera.position.set(0, EYE, 2.6);

  /* With pmndrs/postprocessing, WebGLRenderer disables built-in AA & toneMapping
     when EffectComposer is active (handled by ToneMappingEffect + SMAAEffect),
     and switches cleanly to AgX tone mapping when raw rendering (`effects: false`). */
  const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: false,
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = SETTINGS.exposure;

  /* Cached soft shadows: rendered once on scene build, mood shifts, or book
     cover-mode animations instead of re-rasterizing the room every frame. */
  renderer.shadowMap.enabled = currentTier().shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  document.body.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType
  });

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const n8aoPass = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
  n8aoPass.configuration.aoRadius = SETTINGS.aoRadius;
  n8aoPass.configuration.distanceFalloff = 0.85;
  n8aoPass.configuration.intensity = SETTINGS.aoIntensity;
  n8aoPass.configuration.color = new THREE.Color(0x2a1d12);
  n8aoPass.configuration.halfRes = true;
  n8aoPass.setQualityMode('Medium');
  composer.addPass(n8aoPass);

  const dofEffect = new DepthOfFieldEffect(camera, {
    focusDistance: 0.02,
    focalLength: 0.035,
    bokehScale: 0.0,
    resolutionScale: 0.5
  });

  const dofPass = new EffectPass(camera, dofEffect);
  dofPass.enabled = false;
  composer.addPass(dofPass);

  const bloomEffect = new BloomEffect({
    mipmapBlur: true,
    intensity: SETTINGS.bloomStrength,
    luminanceThreshold: SETTINGS.bloomThreshold,
    luminanceSmoothing: 0.22,
    radius: SETTINGS.bloomRadius
  });

  const vignetteEffect = new VignetteEffect({
    offset: SETTINGS.vignetteOffset,
    darkness: SETTINGS.vignetteDarkness
  });

  const toneMappingEffect = new ToneMappingEffect({
    mode: ToneMappingMode.AGX
  });

  const smaaEffect = new SMAAEffect();

  const mainEffectPass = new EffectPass(
    camera,
    bloomEffect,
    vignetteEffect,
    toneMappingEffect,
    smaaEffect
  );
  composer.addPass(mainEffectPass);

  let dofBokeh = 0;

  function syncQuality() {
    const tier = currentTier();
    const dpr = pixelRatio();
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = tier.shadows;

    n8aoPass.enabled = Boolean(SETTINGS.effects && SETTINGS.aoEnabled && tier.ao);
    n8aoPass.configuration.halfRes = tier.aoHalfRes;
    n8aoPass.configuration.intensity = SETTINGS.aoIntensity;
    n8aoPass.configuration.aoRadius = SETTINGS.aoRadius;

    composer.setSize(window.innerWidth, window.innerHeight);
    runtime.shadowsDirty = true;
  }

  function syncSettings() {
    renderer.toneMappingExposure = SETTINGS.exposure;
    scene.fog.near = SETTINGS.fogNear;
    scene.fog.far = SETTINGS.fogFar;
    bloomEffect.intensity = SETTINGS.bloomStrength;
    bloomEffect.mipmapBlurPass.radius = SETTINGS.bloomRadius;
    bloomEffect.luminanceMaterial.threshold = SETTINGS.bloomThreshold;
    vignetteEffect.offset = SETTINGS.vignetteOffset;
    vignetteEffect.darkness = SETTINGS.vignetteDarkness;
    n8aoPass.enabled = Boolean(SETTINGS.effects && SETTINGS.aoEnabled && currentTier().ao);
    n8aoPass.configuration.intensity = SETTINGS.aoIntensity;
    n8aoPass.configuration.aoRadius = SETTINGS.aoRadius;
    if (camera.fov !== SETTINGS.fov) {
      camera.fov = SETTINGS.fov;
      camera.updateProjectionMatrix();
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const dpr = pixelRatio();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }

  function updateDoF(dt) {
    const wantDoF = Boolean(runtime.opened && SETTINGS.effects && currentTier().ao);
    const targetBokeh = wantDoF ? 2.4 : 0;
    dofBokeh = damp(dofBokeh, targetBokeh, 8, dt);

    if (dofBokeh > 0.05) {
      dofPass.enabled = true;
      dofEffect.bokehScale = dofBokeh;
      // Compute world distance from camera to the inspected book for crisp focus
      // The inspected book itself sits in front of the camera now (not at its table).
      const targetObj = runtime.opened;
      if (targetObj) {
        const wp = _tmpVec.setFromMatrixPosition(targetObj.matrixWorld);
        const dist = camera.position.distanceTo(wp);
        dofEffect.circleOfConfusionMaterial.focusDistance = THREE.MathUtils.clamp(
          (dist - camera.near) / (camera.far - camera.near),
          0.005,
          0.25
        );
      }
    } else {
      dofPass.enabled = false;
    }
  }

  function renderFrame(dt) {
    updateDoF(dt);

    if (runtime.shadowsDirty && renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true;
      runtime.shadowsDirty = false;
    }

    if (SETTINGS.effects) {
      renderer.toneMapping = THREE.NoToneMapping;
      composer.render(dt);
    } else {
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.render(scene, camera);
    }
  }

  syncQuality();

  return {
    scene,
    camera,
    renderer,
    composer,
    n8aoPass,
    bloomEffect,
    vignetteEffect,
    syncQuality,
    syncSettings,
    resize,
    renderFrame
  };
}

const _tmpVec = new THREE.Vector3();
