/* Scene lighting, warm interior PMREM IBL, cached PCFSoftShadowMap sun,
   RectAreaLight window bounce, and live Golden Hour ↔ Cozy Rainy Dusk
   mood interpolation.
   Legacy zombie `intensity: 0` lights from v1 (`shelfWash`, `windowLight`)
   are replaced with physically meaningful area/practical lights. */

import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ROOM, NOOK, TABLE, CASE, STAND, GUEST_TABLE, CREDENZA_LAMP, GUEST_LAMP, LAMP_SCALE } from './constants.js';
import { LAMP_LIGHT_Y } from './props.js';
import { SETTINGS, runtime, candleFlames } from './state.js';
import { currentTier } from './quality.js';
import { SHADE_MAT, WAX } from './materials.js';

RectAreaLightUniformsLib.init();

/* Procedural warm interior environment cube baked once through PMREMGenerator
   so PBR metals (brass, tonearm), glass, ceramic glazes, and book jackets
   pick up realistic soft room reflections with zero external HDR download. */
export function buildWarmEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x2c241d);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(12, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9cf, side: THREE.BackSide })
  );
  envScene.add(sky);

  // Warm floor bounce hemisphere
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0x9c7248 })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.y = -3;
  envScene.add(floorBounce);

  // Bright window card on the -X side matching the left-wall book nook
  const winCard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 4.2),
    new THREE.MeshBasicMaterial({ color: 0xfff3de })
  );
  winCard.position.set(-6, 1.2, 0);
  winCard.lookAt(0, 1.2, 0);
  envScene.add(winCard);

  // Subtle warm practical glow patches on back/right walls
  const lampCard = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.8),
    new THREE.MeshBasicMaterial({ color: 0xffc680 })
  );
  lampCard.position.set(4.5, 1.0, -3.5);
  lampCard.lookAt(0, 1.0, 0);
  envScene.add(lampCard);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(envScene, 0.045);
  pmrem.dispose();
  return envRT.texture;
}

export function createLighting(scene, renderer) {
  const envTex = buildWarmEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = SETTINGS.envIntensity;

  const ambient = new THREE.AmbientLight(SETTINGS.ambientColor, SETTINGS.ambientIntensity);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff5e8, 0xc89a6c, SETTINGS.hemiIntensity);
  hemi.position.set(0, ROOM.h, 0);
  scene.add(hemi);

  /* Main directional sun through the left-wall landscape window.
     Uses cached soft shadow map (`renderer.shadowMap.autoUpdate = false`)
     so window mullions, bench, tables, and bookcase cast crisp-to-soft
     shadows across the oak planks at ~0 ms per-frame cost. */
  const sun = new THREE.DirectionalLight(SETTINGS.sunColor, SETTINGS.sunIntensity);
  sun.position.set(SETTINGS.sunX, SETTINGS.sunY, SETTINGS.sunZ);
  sun.target.position.set(0.7, 0.7, -0.35);
  scene.add(sun, sun.target);

  const tier = currentTier();
  sun.castShadow = tier.shadows;
  sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
  sun.shadow.camera.near = 1.2;
  sun.shadow.camera.far = 15.5;
  sun.shadow.camera.left = -4.6;
  sun.shadow.camera.right = 4.6;
  sun.shadow.camera.top = 3.6;
  sun.shadow.camera.bottom = -2.4;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = 2.6;

  /* Soft interior ceiling fill so shadows stay warm and legible */
  const fill = new THREE.DirectionalLight(SETTINGS.fillColor, SETTINGS.fillIntensity);
  fill.position.set(2.2, 2.7, 2.4);
  fill.target.position.set(-0.5, 0.9, -1.2);
  scene.add(fill, fill.target);

  /* RectAreaLight spanning the landscape window opening: produces true
     broad area speculars across the oak floor planks, leather ledger,
     and vinyl platter. */
  const windowArea = new THREE.RectAreaLight(0xfff0da, SETTINGS.windowBounce, NOOK.winW * 0.92, NOOK.winH * 0.88);
  windowArea.position.set(-ROOM.w / 2 + 0.08, NOOK.sill + NOOK.winH / 2, NOOK.worldZ);
  windowArea.lookAt(0, NOOK.sill + NOOK.winH * 0.42, NOOK.worldZ);
  scene.add(windowArea);

  /* Practical indoor warm lights — subtle in Golden Hour, cosy & glowing
     in Rainy Dusk mode (`moodT` 0 -> 1). */
  const lampLight = new THREE.PointLight(0xffb96e, 0.08, 3.2, 1.8);
  lampLight.position.set(TABLE.x + 0.40, TABLE.h + 0.30, TABLE.z - 0.12);
  scene.add(lampLight);

  /* Every practical light sits inside a visible fixture (no glow from nowhere).
     Credenza unit: origin (ROOM.w/2 - STAND.d/2 - 0.06, 0, -0.4), yaw -π/2,
     so local (x, z) -> world (ox - z, -0.4 + x). */
  const lampY = LAMP_LIGHT_Y * LAMP_SCALE;
  const playerLight = new THREE.PointLight(0xffbe76, 0.06, 3.0, 1.8);
  playerLight.position.set(ROOM.w / 2 - STAND.d / 2 - 0.06 - CREDENZA_LAMP.z, STAND.h + lampY, -0.4 + CREDENZA_LAMP.x);
  scene.add(playerLight);

  const sconceSpan = NOOK.winW / 2 + NOOK.frameT + NOOK.towerW / 2;
  const sconceNorth = new THREE.PointLight(0xffb86b, 0.05, 2.6, 1.9);
  // Inside the sconce shades (window-nook.js: sconce at y 2.38, shade +0.04 up, +0.105 out)
  sconceNorth.position.set(-ROOM.w / 2 + NOOK.towerD + 0.11, 2.37, NOOK.worldZ - sconceSpan);
  const sconceSouth = new THREE.PointLight(0xffb86b, 0.05, 2.6, 1.9);
  sconceSouth.position.set(-ROOM.w / 2 + NOOK.towerD + 0.11, 2.37, NOOK.worldZ + sconceSpan);
  scene.add(sconceNorth, sconceSouth);

  // Just under the brass picture light on the bookcase's top front edge (books.js)
  const shelfGlow = new THREE.PointLight(0xffaa58, 0.0, 2.8, 2.0);
  shelfGlow.position.set(0, CASE.h - 0.07, -ROOM.d / 2 + CASE.d + 0.03 + 0.14);
  scene.add(shelfGlow);

  const guestGlow = new THREE.PointLight(0xffbe76, 0.04, 2.6, 1.9);
  // Guest table is yawed π: local (x, z) -> world (GT.x - x, GT.z - z)
  guestGlow.position.set(GUEST_TABLE.x - GUEST_LAMP.x, GUEST_TABLE.h + lampY, GUEST_TABLE.z - GUEST_LAMP.z);
  scene.add(guestGlow);

  const fogGolden = new THREE.Color(0xf1e6d6);
  const fogRain = new THREE.Color(0x2b3240);
  // Backdrop seen past the edges of the outdoor scene at oblique window angles:
  // match the sky's mid-band per mood instead of the beige fog colour.
  const bgGolden = new THREE.Color(0xf5c285);
  const bgRain = new THREE.Color(0x45526b);
  const ambGolden = new THREE.Color(SETTINGS.ambientColor);
  const ambRain = new THREE.Color(0x8fa4c4);
  const hemiSkyGolden = new THREE.Color(0xfff5e8);
  const hemiSkyRain = new THREE.Color(0x6d84a8);
  const hemiGndGolden = new THREE.Color(0xc89a6c);
  const hemiGndRain = new THREE.Color(0x524034);
  const sunGolden = new THREE.Color(SETTINGS.sunColor);
  const sunRain = new THREE.Color(0x7c96be);
  const winAreaGolden = new THREE.Color(0xfff0da);
  const winAreaRain = new THREE.Color(0x7d97bd);

  function updateMood(elapsedTime) {
    const m = runtime.moodT; // 0 = golden hour, 1 = rainy dusk
    const coverDim = 1 - 0.25 * runtime.coverT;

    ambGolden.set(SETTINGS.ambientColor);
    sunGolden.set(SETTINGS.sunColor);

    ambient.color.lerpColors(ambGolden, ambRain, m * 0.65);
    ambient.intensity = THREE.MathUtils.lerp(SETTINGS.ambientIntensity, SETTINGS.ambientIntensity * 0.62, m);

    hemi.color.lerpColors(hemiSkyGolden, hemiSkyRain, m);
    hemi.groundColor.lerpColors(hemiGndGolden, hemiGndRain, m * 0.7);
    hemi.intensity = THREE.MathUtils.lerp(SETTINGS.hemiIntensity, SETTINGS.hemiIntensity * 0.58, m);

    sun.color.lerpColors(sunGolden, sunRain, m);
    sun.intensity = THREE.MathUtils.lerp(SETTINGS.sunIntensity, 0.36, m);

    fill.color.set(SETTINGS.fillColor);
    fill.intensity = THREE.MathUtils.lerp(SETTINGS.fillIntensity, 0.14, m);

    windowArea.color.lerpColors(winAreaGolden, winAreaRain, m);
    windowArea.intensity = THREE.MathUtils.lerp(SETTINGS.windowBounce, 0.68, m);

    scene.environmentIntensity = THREE.MathUtils.lerp(SETTINGS.envIntensity, SETTINGS.envIntensity * 0.55, m);

    if (scene.fog) {
      scene.fog.color.lerpColors(fogGolden, fogRain, m * 0.72);
      scene.background.lerpColors(bgGolden, bgRain, m);
    }

    // Practical warm indoor lights come alive in Rainy Dusk
    const flicker = Math.sin(elapsedTime * 7.3) * 0.04 + Math.sin(elapsedTime * 13.1) * 0.025;
    lampLight.intensity = THREE.MathUtils.lerp(0.08, 1.95, m);
    playerLight.intensity = THREE.MathUtils.lerp(0.06, 1.45, m);
    sconceNorth.intensity = THREE.MathUtils.lerp(0.05, 1.25, m);
    sconceSouth.intensity = THREE.MathUtils.lerp(0.05, 1.25, m);
    guestGlow.intensity = THREE.MathUtils.lerp(0.04, 1.05, m);
    shelfGlow.intensity = THREE.MathUtils.lerp(0.0, 0.85, m) * coverDim; // steady lamp, no candle flicker

    SHADE_MAT.emissiveIntensity = THREE.MathUtils.lerp(0.06, 0.95, m);
    WAX.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.32 + flicker, m);

    for (let i = 0; i < candleFlames.length; i++) {
      const f = candleFlames[i];
      f.visible = m > 0.08;
      if (f.visible) {
        const s = (0.85 + Math.sin(elapsedTime * 9.0 + i * 2.1) * 0.14) * m;
        f.scale.set(s, s * (1 + Math.sin(elapsedTime * 14.0 + i) * 0.12), s);
      }
    }
  }

  function applyShadowQuality() {
    const t = currentTier();
    sun.castShadow = t.shadows;
    if (t.shadows && sun.shadow.mapSize.x !== t.shadowMapSize) {
      sun.shadow.mapSize.set(t.shadowMapSize, t.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    runtime.shadowsDirty = true;
  }

  return {
    ambient,
    hemi,
    sun,
    fill,
    windowArea,
    lampLight,
    playerLight,
    sconceNorth,
    sconceSouth,
    shelfGlow,
    guestGlow,
    updateMood,
    applyShadowQuality
  };
}
