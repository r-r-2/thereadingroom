/* 3D Parallax Exterior Pocket World (replaces v1's per-frame 2D CPU canvas):
   Sits outside the left-wall book-nook window (-X) so stepping left/right
   or closer to the bench yields true 3D depth parallax at ~0 CPU cost:
   - Custom GLSL atmospheric sky dome smoothly blending Golden Hour ↔ Rainy Dusk
   - Layered 3D mountain ridges & valley mist planes at real depths (-4m to -26m)
   - Wind-swaying 3D pine trees
   - Drifting 3D bird flock (Golden Hour) & GPU rain streaks + glass droplets (Rainy Dusk)
   - Volumetric sunbeam shafts inside the room */

import * as THREE from 'three';
import { ROOM, NOOK } from './constants.js';
import { runtime } from './state.js';

export function buildExterior(scene) {
  const extGroup = new THREE.Group();
  extGroup.position.set(-ROOM.w / 2 - 0.1, 0, NOOK.worldZ);
  scene.add(extGroup);

  /* ---- 1. Atmospheric Sky Backdrop (GLSL shader: Golden Hour ↔ Rainy Dusk) ---- */
  const skyUniforms = {
    uTime: { value: 0 },
    uMood: { value: runtime.moodT }
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uMood;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        // Golden hour gradient
        vec3 gTop = vec3(0.47, 0.62, 0.78);
        vec3 gMid = vec3(0.96, 0.76, 0.52);
        vec3 gBot = vec3(1.00, 0.83, 0.56);
        vec3 golden = vUv.y > 0.45
          ? mix(gMid, gTop, smoothstep(0.45, 1.0, vUv.y))
          : mix(gBot, gMid, smoothstep(0.0, 0.45, vUv.y));

        // Warm low sun disc + halo
        vec2 sunPos = vec2(0.40, 0.50);
        float dSun = distance(vUv * vec2(1.4, 1.0), sunPos * vec2(1.4, 1.0));
        golden += vec3(1.0, 0.80, 0.50) * exp(-dSun * 3.6) * 0.55;   // wide warm glow
        golden += vec3(1.0, 0.90, 0.70) * exp(-dSun * 14.0) * 0.6;   // tight halo
        golden += vec3(1.0, 0.95, 0.82) * smoothstep(0.04, 0.026, dSun) * 1.6; // disc, brighter than its glow

        // Cozy rainy dusk gradient
        vec3 rTop = vec3(0.16, 0.20, 0.29);
        vec3 rMid = vec3(0.27, 0.32, 0.42);
        vec3 rBot = vec3(0.40, 0.44, 0.52);
        vec3 rainy = vUv.y > 0.45
          ? mix(rMid, rTop, smoothstep(0.45, 1.0, vUv.y))
          : mix(rBot, rMid, smoothstep(0.0, 0.45, vUv.y));

        // Soft drifting clouds
        vec2 cUv = vec2(vUv.x * 3.5 + uTime * 0.008, vUv.y * 5.0);
        float c = noise(cUv) * 0.6 + noise(cUv * 2.1 + 3.1) * 0.4;
        float cloudMask = smoothstep(0.48, 0.78, c) * smoothstep(0.22, 0.55, vUv.y);
        vec3 cloudCol = mix(vec3(1.0, 0.95, 0.88), vec3(0.24, 0.29, 0.39), uMood);

        vec3 col = mix(golden, rainy, uMood);
        col = mix(col, cloudCol, cloudMask * mix(0.42, 0.65, uMood));

        // Colours above are authored in sRGB; the HDR pipeline expects linear.
        // Without this the sky reads pale grey instead of golden.
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
      }
    `
  });

  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(38, 22), skyMat);
  skyPlane.position.set(-22, 4.2, 0);
  skyPlane.rotation.y = Math.PI / 2;
  extGroup.add(skyPlane);

  /* ---- 2. Layered 3D Mountain Ridges (true spatial depth parallax) ---- */
  const ridgeLayers = [
    // Golden colours step toward the warm horizon haze with distance (aerial perspective)
    { x: -18.5, y: -1.2, w: 34, h: 6.2, golden: 0xc9b9a0, rain: 0x3a4456, seed: 1.2 },
    { x: -13.0, y: -1.4, w: 28, h: 4.8, golden: 0xa3a58c, rain: 0x2b3546, seed: 3.7 },
    { x: -8.2,  y: -1.5, w: 22, h: 3.6, golden: 0x788a68, rain: 0x1d2735, seed: 6.4 },
    { x: -4.6,  y: -1.5, w: 16, h: 2.5, golden: 0x56704c, rain: 0x131b25, seed: 9.1 }
  ];

  const ridgeMeshes = ridgeLayers.map((L) => {
    const shape = new THREE.Shape();
    shape.moveTo(-L.w / 2, -3);
    const segs = 36;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const px = -L.w / 2 + t * L.w;
      const py = L.h * (
        0.52
        + 0.24 * Math.sin(t * 6.2 + L.seed)
        + 0.14 * Math.sin(t * 13.5 + L.seed * 1.9)
        + 0.06 * Math.cos(t * 23.0 + L.seed)
      );
      shape.lineTo(px, py);
    }
    shape.lineTo(L.w / 2, -3);
    shape.closePath();

    const mat = new THREE.MeshBasicMaterial({
      color: L.golden,
      fog: false
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    mesh.position.set(L.x, L.y, 0);
    mesh.rotation.y = Math.PI / 2;
    extGroup.add(mesh);
    return {
      mesh,
      mat,
      goldenCol: new THREE.Color(L.golden),
      rainCol: new THREE.Color(L.rain)
    };
  });

  /* ---- 3. Soft Valley Mist Ribbon ---- */
  // Feathered top/bottom so the mist doesn't draw a hard band across the hills.
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 4; mistCanvas.height = 64;
  const mg = mistCanvas.getContext('2d');
  const grad = mg.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  mg.fillStyle = grad; mg.fillRect(0, 0, 4, 64);
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0xfbe8cc,
    alphaMap: new THREE.CanvasTexture(mistCanvas),
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    fog: false
  });
  const mistPlane = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.2), mistMat);
  mistPlane.position.set(-9.5, 0.75, 0);
  mistPlane.rotation.y = Math.PI / 2;
  extGroup.add(mistPlane);

  /* ---- 4. Wind-Swaying 3D Pine Trees in Midground ---- */
  const pineTrunkMat = new THREE.MeshBasicMaterial({ color: 0x433226, fog: false });
  const pineFoliageGolden = new THREE.Color(0x4b6a48);
  const pineFoliageRain = new THREE.Color(0x162426);
  const pineFoliageMat = new THREE.MeshBasicMaterial({ color: pineFoliageGolden.clone(), fog: false });

  const trees = [];
  const treeSpots = [
    [-4.8, -2.0, 0.92], [-5.6, -1.15, 0.78], [-4.5, 1.35, 0.95],
    [-6.2, 2.05, 0.85], [-5.2, 0.25, 0.68], [-6.8, -0.45, 1.05]
  ];
  for (const [tx, tz, sc] of treeSpots) {
    const g = new THREE.Group();
    g.position.set(tx, -0.65, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * sc, 0.055 * sc, 1.1 * sc, 10), pineTrunkMat);
    trunk.position.y = 0.55 * sc;
    g.add(trunk);
    for (let tier = 0; tier < 4; tier++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((0.42 - tier * 0.075) * sc, (0.72 - tier * 0.09) * sc, 16),
        pineFoliageMat
      );
      cone.position.y = (0.95 + tier * 0.34) * sc;
      g.add(cone);
    }
    extGroup.add(g);
    trees.push({ group: g, phase: tx * 1.7 + tz * 2.3 });
  }

  /* ---- 6. Distant 3D Bird Flock (Golden Hour) ---- */
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.09,  0, 0.02, 0,  -0.02, 0, 0,
    0, 0.02, 0,   0, 0, 0.09,  -0.02, 0, 0
  ], 3));
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2c2623, side: THREE.DoubleSide, fog: false });
  const birds = Array.from({ length: 5 }, (_, i) => {
    const b = new THREE.Mesh(birdGeo, birdMat);
    extGroup.add(b);
    return { mesh: b, offset: i * 0.65, yOff: (i % 3 - 1) * 0.18 };
  });

  /* ---- 7. Falling Rain Streaks Outside Window (Cozy Rainy Dusk) ---- */
  const rainCount = 260;
  const rainPos = new Float32Array(rainCount * 6);
  const rainSeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const rx = -0.35 - Math.random() * 2.4;
    const ry = Math.random() * 3.2;
    const rz = (Math.random() - 0.5) * (NOOK.winW + 1.4);
    rainSeeds[i] = 4.5 + Math.random() * 2.5;
    const idx = i * 6;
    rainPos[idx] = rx;     rainPos[idx + 1] = ry;        rainPos[idx + 2] = rz;
    rainPos[idx + 3] = rx; rainPos[idx + 4] = ry - 0.22; rainPos[idx + 5] = rz + 0.03;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x9cb8dc,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    fog: false
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  extGroup.add(rainLines);

  /* ---- 8. Volumetric Sunbeam Shafts Inside Room ---- */
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.065 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float fadeLong = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.35, 1.0, vUv.x));
        // Clamp: pow() of a negative base is NaN, which bloom smears into black blocks
        float fadeEdge = max(sin(vUv.y * 3.14159265), 0.0);
        float alpha = fadeLong * pow(fadeEdge, 1.6) * uOpacity;
        gl_FragColor = vec4(1.0, 0.90, 0.72, alpha);
      }
    `
  });

  const sunbeams = [];
  for (const zOff of [-0.62, 0.48]) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.15), beamMat);
    beam.position.set(-ROOM.w / 2 + 1.55, 1.32, NOOK.worldZ + zOff);
    beam.rotation.z = -0.36;
    beam.rotation.x = 0.22;
    scene.add(beam);
    sunbeams.push(beam);
  }

  const mistGolden = new THREE.Color(0xfbe8cc);
  const mistRain = new THREE.Color(0x3a485c);

  function update(t, dt) {
    const m = runtime.moodT;
    skyUniforms.uTime.value = t;
    skyUniforms.uMood.value = m;

    // Interpolate 3D ridges, foliage, and valley mist between Golden Hour & Rainy Dusk
    for (const r of ridgeMeshes) {
      r.mat.color.lerpColors(r.goldenCol, r.rainCol, m);
    }
    pineFoliageMat.color.lerpColors(pineFoliageGolden, pineFoliageRain, m);
    mistMat.color.lerpColors(mistGolden, mistRain, m);
    mistMat.opacity = THREE.MathUtils.lerp(0.24, 0.36, m);

    // Gentle wind sway on 3D pines
    const windStrength = THREE.MathUtils.lerp(1.0, 2.1, m);
    for (const tr of trees) {
      tr.group.rotation.z = Math.sin(t * 0.7 + tr.phase) * 0.018 * windStrength;
      tr.group.rotation.x = Math.cos(t * 0.55 + tr.phase) * 0.014 * windStrength;
    }

    // Distant bird flock (visible during Golden Hour)
    const birdCycle = (t * 0.035) % 1.4;
    const showBirds = m < 0.55 && birdCycle < 1.0;
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      b.mesh.visible = showBirds;
      if (showBirds) {
        const bz = -7.5 + birdCycle * 15.0 - b.offset * 0.45;
        const by = 2.05 + b.yOff + Math.sin(t * 5.5 + b.offset * 2.0) * 0.04;
        b.mesh.position.set(-7.5 - i * 0.3, by, bz);
        b.mesh.rotation.z = Math.sin(t * 7.5 + b.offset * 2.4) * 0.35;
      }
    }

    // Rain streaks outside window when mood shifts toward Rainy Dusk
    rainLines.visible = m > 0.04;
    if (rainLines.visible) {
      rainMat.opacity = m * 0.42;
      const arr = rainGeo.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        const idx = i * 6;
        let y = arr[idx + 1] - rainSeeds[i] * dt;
        if (y < -0.3) y += 3.5;
        arr[idx + 1] = y;
        arr[idx + 4] = y - 0.24;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Sunbeams fade out smoothly in Rainy Dusk
    const sunVis = Math.max(0, 1 - m * 1.35);
    beamMat.uniforms.uOpacity.value = 0.058 * sunVis;
    for (const beam of sunbeams) beam.visible = sunVis > 0.02;

  }

  return { extGroup, update };
}
