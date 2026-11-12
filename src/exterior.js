/* 3D Parallax Exterior Pocket World (replaces v1's per-frame 2D CPU canvas):
   Sits outside the left-wall book-nook window (-X) so stepping left/right
   or closer to the bench yields true 3D depth parallax at ~0 CPU cost:
   - Inside-facing GLSL sky dome (r = 28 m) blending Golden Hour ↔ Rainy Dusk
   - 4 mountain ridges + valley mist as arcs (±78°) around the window, 4.6–18.5 m out
   - Instanced pine forest (1 draw call) sitting on the ridge silhouettes
   - Drifting 3D bird flock (Golden Hour) & GPU rain streaks + glass droplets (Rainy Dusk)
   - Volumetric sunbeam shafts inside the room */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, NOOK, EYE } from './constants.js';
import { runtime } from './state.js';

export function buildExterior(scene) {
  const extGroup = new THREE.Group();
  extGroup.position.set(-ROOM.w / 2 - 0.1, 0, NOOK.worldZ);
  scene.add(extGroup);

  // Raw sRGB components (no colour management) for shaders that linearise themselves.
  const srgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  // Low sun slightly toward +z (azimuth measured from -X, the window's outward axis)
  const SUN_DIR = new THREE.Vector3(-22, 2.58, 3.8).normalize();
  const SUN_AZ = Math.atan2(SUN_DIR.z, -SUN_DIR.x);

  /* ---- 1. Atmospheric Sky Dome (GLSL shader: Golden Hour ↔ Rainy Dusk) ---- */
  // An inside-facing sphere centred at eye height just outside the window, so
  // every oblique angle through the glass still lands on sky. Radius + the
  // farthest camera spot in the room (~9.5 m) must stay under camera.far (42 m).
  const skyUniforms = {
    uTime: { value: 0 },
    uMood: { value: runtime.moodT },
    uSunDir: { value: SUN_DIR }
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uMood;
      uniform vec3 uSunDir;
      varying vec3 vDir;

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
        vec3 dir = normalize(vDir);
        // Elevation -> the old plane's vertical uv (0.45 sits just above the horizon)
        float h = 0.38 + dir.y * 1.1;
        // Azimuth around the window's outward (-X) axis, ~0 straight out
        float az = atan(dir.z, -dir.x);

        // Golden hour gradient
        vec3 gTop = vec3(0.47, 0.62, 0.78);
        vec3 gMid = vec3(0.96, 0.76, 0.52);
        vec3 gBot = vec3(1.00, 0.83, 0.56);
        vec3 golden = h > 0.45
          ? mix(gMid, gTop, smoothstep(0.45, 1.0, h))
          : mix(gBot, gMid, smoothstep(0.0, 0.45, h));

        // Warm low sun disc + halo, by angular distance (radians)
        float dSun = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
        golden += vec3(1.0, 0.80, 0.50) * exp(-dSun * 3.6) * 0.55;   // wide warm glow
        golden += vec3(1.0, 0.90, 0.70) * exp(-dSun * 14.0) * 0.6;   // tight halo
        golden += vec3(1.0, 0.95, 0.82) * smoothstep(0.04, 0.026, dSun) * 1.6; // disc, added on top: brighter than its glow

        // Cozy rainy dusk gradient
        vec3 rTop = vec3(0.16, 0.20, 0.29);
        vec3 rMid = vec3(0.27, 0.32, 0.42);
        vec3 rBot = vec3(0.40, 0.44, 0.52);
        vec3 rainy = h > 0.45
          ? mix(rMid, rTop, smoothstep(0.45, 1.0, h))
          : mix(rBot, rMid, smoothstep(0.0, 0.45, h));

        // Soft drifting clouds
        vec2 cUv = vec2(az * 2.0 + uTime * 0.008, h * 5.0);
        float c = noise(cUv) * 0.6 + noise(cUv * 2.1 + 3.1) * 0.4;
        float cloudMask = smoothstep(0.48, 0.78, c) * smoothstep(0.22, 0.55, h);
        vec3 cloudCol = mix(vec3(1.0, 0.95, 0.88), vec3(0.24, 0.29, 0.39), uMood);

        vec3 col = mix(golden, rainy, uMood);
        col = mix(col, cloudCol, cloudMask * mix(0.42, 0.65, uMood));

        // Colours above are authored in sRGB; the HDR pipeline expects linear.
        // Without this the sky reads pale grey instead of golden.
        gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), 1.0);
      }
    `
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(28, 48, 24), skyMat);
  skyDome.position.set(0, EYE, 0);
  skyDome.renderOrder = -1;
  extGroup.add(skyDome);

  /* ---- 2. Layered 3D Mountain Ridges (arcs curving around the window) ---- */
  // Each layer is a strip of bottom/top vertices along an arc of radius `r`
  // (its old distance), so oblique views never reach a ridge end. `w` is the
  // old strip width: the profile is sampled by arc length s with t = s / w,
  // which keeps the centre identical to the old flat ridges.
  const ARC_SPAN = THREE.MathUtils.degToRad(78);
  const ARC_SEGS = 140;
  const ridgeLayers = [
    // Golden colours step toward the warm horizon haze with distance (aerial perspective)
    { r: 18.5, y: -1.2, w: 34, h: 6.2, golden: 0xc9b9a0, rain: 0x3a4456, seed: 1.2, haze: 0.38 },
    { r: 13.0, y: -1.4, w: 28, h: 4.8, golden: 0xa3a58c, rain: 0x2b3546, seed: 3.7, haze: 0.24 },
    { r: 8.2,  y: -1.5, w: 22, h: 3.6, golden: 0x788a68, rain: 0x1d2735, seed: 6.4, haze: 0.11 },
    { r: 4.6,  y: -1.5, w: 16, h: 2.5, golden: 0x56704c, rain: 0x131b25, seed: 9.1, haze: 0.0 }
  ];
  const RIDGE_BASE = -3; // local bottom of every ridge strip (below the sill line)

  // Ridge-top height (extGroup local y) at arc angle `a` (0 = straight out the window).
  function ridgeTop(L, a) {
    const t = 0.5 + (a * L.r) / L.w;
    return L.y + L.h * (
      0.52
      + 0.24 * Math.sin(t * 6.2 + L.seed)
      + 0.14 * Math.sin(t * 13.5 + L.seed * 1.9)
      + 0.06 * Math.cos(t * 23.0 + L.seed)
    );
  }
  // Point on a layer's arc (extGroup local x/z).
  const arcX = (r, a) => -r * Math.cos(a);
  const arcZ = (r, a) => r * Math.sin(a);

  function buildRidgeGeometry(L) {
    const pos = [];
    const uv = [];
    const side = [];
    const idx = [];
    for (let i = 0; i <= ARC_SEGS; i++) {
      const u = i / ARC_SEGS;
      const a = -ARC_SPAN + u * 2 * ARC_SPAN;
      const x = arcX(L.r, a);
      const z = arcZ(L.r, a);
      pos.push(x, L.y + RIDGE_BASE, z, x, ridgeTop(L, a), z);
      uv.push(u, 0, u, 1);
      // Profile normal (lateral, up) dotted with the sun's lateral side:
      // +1 = slope turned toward the low sun, -1 = turned away.
      const slope = (ridgeTop(L, a + 0.002) - ridgeTop(L, a - 0.002)) / (0.004 * L.r);
      const nx = -slope / Math.hypot(slope, 1);
      const toSun = THREE.MathUtils.clamp((SUN_AZ - a) * 3, -1, 1);
      const f = THREE.MathUtils.clamp((nx / 0.55) * toSun, -1, 1);
      side.push(f, f);
      if (i < ARC_SEGS) {
        const b = i * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setIndex(idx);
    return geo;
  }

  // Painterly ridge shader: low-sun light on crests and sun-facing slopes,
  // shadow toward the base, soft brush noise, and aerial perspective (far
  // layers drift toward the horizon haze). Colours are sRGB, linearised at output.
  const ridgeShared = {
    uMood: { value: runtime.moodT },
    uSpan: { value: ARC_SPAN },
    uSunAz: { value: SUN_AZ },
    uHazeGolden: { value: srgb(0xf3c995) },
    uHazeRain: { value: srgb(0x56627a) }
  };
  const ridgeVert = /* glsl */ `
    attribute float aSide;
    varying vec2 vUv;
    varying float vSide;
    void main() {
      vUv = uv;
      vSide = aSide;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const ridgeFrag = /* glsl */ `
    uniform float uMood;
    uniform float uSpan;
    uniform float uSunAz;
    uniform float uHaze;
    uniform vec2 uScale;
    uniform vec3 uGolden;
    uniform vec3 uRain;
    uniform vec3 uHazeGolden;
    uniform vec3 uHazeRain;
    varying vec2 vUv;
    varying float vSide;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
      vec2 p = vUv * uScale;               // metres along the arc / up the ridge
      float crest = smoothstep(0.45, 1.0, vUv.y);
      float a = (vUv.x * 2.0 - 1.0) * uSpan;
      float nearSun = exp(-abs(a - uSunAz) * 1.6);

      vec3 base = mix(uGolden, uRain, uMood);
      // Warm key from the low sun vs cool violet shadow; flatter in the rain
      vec3 litTint = mix(vec3(1.16, 1.05, 0.88), vec3(1.04, 1.04, 1.06), uMood);
      vec3 shdTint = mix(vec3(0.66, 0.66, 0.76), vec3(0.80, 0.80, 0.84), uMood);
      float light = clamp(0.15 + 0.6 * crest + 0.35 * vSide * (0.4 + 0.6 * crest), 0.0, 1.0);
      vec3 col = base * mix(shdTint, litTint, light);

      // Thin warm rim on crests near the sun (Golden Hour only)
      float rim = smoothstep(0.965, 1.0, vUv.y) * (0.35 + 0.65 * nearSun) * (1.0 - uMood);
      col += vec3(1.0, 0.80, 0.52) * rim * 0.22;

      // Soft painterly texture: horizontal brush strokes + a broad mottling
      float n = noise(p * vec2(0.55, 2.4)) * 0.6 + noise(p * vec2(1.7, 0.9) + 7.3) * 0.4;
      col *= 0.93 + 0.14 * n;

      // Aerial perspective: far layers and valley floors drift to the horizon haze
      vec3 haze = mix(uHazeGolden, uHazeRain, uMood);
      float h = uHaze * (0.75 + 0.45 * (1.0 - crest)) + (1.0 - crest) * 0.08 * (1.0 - uMood);
      col = mix(col, haze, clamp(h, 0.0, 1.0));

      gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), 1.0);
    }
  `;

  const ridgeMeshes = ridgeLayers.map((L) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...ridgeShared,
        uHaze: { value: L.haze },
        uScale: { value: new THREE.Vector2(2 * ARC_SPAN * L.r, L.h - RIDGE_BASE) },
        uGolden: { value: srgb(L.golden) },
        uRain: { value: srgb(L.rain) }
      },
      vertexShader: ridgeVert,
      fragmentShader: ridgeFrag,
      side: THREE.DoubleSide,
      fog: false
    });
    const mesh = new THREE.Mesh(buildRidgeGeometry(L), mat);
    extGroup.add(mesh);
    return mesh;
  });

  /* ---- 3. Soft Valley Mist Ribbon (open cylinder arc) ---- */
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
    side: THREE.BackSide, // seen from inside the cylinder
    depthWrite: false,
    fog: false
  });
  // CylinderGeometry puts theta = 3π/2 on -X (straight out of the window).
  const mistArc = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 9.5, 2.2, 64, 1, true, 1.5 * Math.PI - ARC_SPAN, 2 * ARC_SPAN),
    mistMat
  );
  mistArc.position.set(0, 0.75, 0);
  extGroup.add(mistArc);

  /* ---- 4. Instanced Pine Forest Along the Ridge Lines ---- */
  // One merged low-poly pine (unit height, base at y = 0) drawn as a single
  // InstancedMesh. Trees are scaled to the forced-perspective ridges, not to
  // real metres, and planted on each crest via the same ridgeTop() profile.
  function buildPineGeometry() {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.03, 0.045, 0.28, 5);
    trunk.translate(0, 0.14, 0);
    parts.push([trunk, 0.32]);
    for (let k = 0; k < 3; k++) {
      const h = 0.5 - k * 0.09;
      const cone = new THREE.ConeGeometry(0.25 - k * 0.06, h, 7);
      cone.translate(0, 0.24 + k * 0.21 + h / 2, 0);
      parts.push([cone, 0.9 + k * 0.08]);
    }
    for (const [g, tone] of parts) {
      // Baked tone: dark trunk, upper tiers a touch lighter, sun side (+z, up) brighter
      const n = g.attributes.normal;
      const col = new Float32Array(n.count * 3);
      for (let i = 0; i < n.count; i++) {
        const lit = tone * (0.82 + 0.3 * Math.max(0, n.getZ(i) * 0.7 + n.getY(i) * 0.3));
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = lit;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    return mergeGeometries(parts.map(([g]) => g));
  }

  // Seeded RNG so the forest is identical on every load
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Per layer (far -> near): candidate count, clustering threshold, size range
  // and how far the band reaches down from the crest (fraction of tree height).
  const forestPlan = [
    { count: 120, keep: 0.62, size: [0.85, 1.25], band: 0.15, dark: 0.0 },
    { count: 170, keep: 0.5,  size: [0.7, 1.05],  band: 0.25, dark: 0.1 },
    { count: 230, keep: 0.4,  size: [0.55, 0.9],  band: 0.4,  dark: 0.2 },
    { count: 340, keep: 0.12, size: [0.45, 0.8],  band: 0.55, dark: 0.45 } // dense near treeline
  ];
  const pineGolden = new THREE.Color(0x3d5a3a);
  const pineDarkGolden = new THREE.Color(0x24382a);
  const pineRain = new THREE.Color(0x141e26);
  const pineDarkRain = new THREE.Color(0x0a1016);
  const hazeGolden = new THREE.Color(0xf3c995);
  const hazeRain = new THREE.Color(0x56627a);

  const treeData = []; // { x, y, z, s, w, golden: Color, rain: Color }
  ridgeLayers.forEach((L, li) => {
    const plan = forestPlan[li];
    const ridgeGolden = new THREE.Color(L.golden);
    const ridgeRain = new THREE.Color(L.rain);
    for (let i = 0; i < plan.count; i++) {
      const a = (rand() * 2 - 1) * (ARC_SPAN - 0.04);
      // Clumps: low-frequency waves along the arc decide where woods grow
      const s = a * L.r;
      const clump = 0.5 + 0.3 * Math.sin(s * 0.45 + L.seed * 3.1) + 0.2 * Math.sin(s * 1.3 + L.seed);
      if (clump < plan.keep + rand() * 0.15) continue;
      const size = THREE.MathUtils.lerp(plan.size[0], plan.size[1], rand());
      // Root just below the crest so trunks hide behind the silhouette line
      const drop = size * (0.12 + rand() * plan.band);
      const r = L.r - 0.04 - rand() * 0.05;
      const shade = 0.9 + rand() * 0.2;
      const dark = Math.min(1, plan.dark + rand() * 0.25);
      // Aerial perspective: the pine colour leans toward its ridge, then the haze
      const golden = pineGolden.clone().lerp(pineDarkGolden, dark)
        .lerp(ridgeGolden, li === 0 ? 0.3 : 0.12).lerp(hazeGolden, L.haze * 1.1)
        .multiplyScalar(shade);
      const rain = pineRain.clone().lerp(pineDarkRain, dark)
        .lerp(ridgeRain, 0.25).lerp(hazeRain, L.haze * 0.9)
        .multiplyScalar(shade);
      treeData.push({
        x: arcX(r, a), y: ridgeTop(L, a) - drop, z: arcZ(r, a),
        s: size, w: 0.8 + rand() * 0.45, golden, rain
      });
    }
  });

  const forestMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const forest = new THREE.InstancedMesh(buildPineGeometry(), forestMat, treeData.length);
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  treeData.forEach((d, i) => {
    _p.set(d.x, d.y, d.z);
    _s.set(d.s * d.w, d.s, d.s * d.w);
    forest.setMatrixAt(i, _m.compose(_p, _q, _s));
    forest.setColorAt(i, d.golden);
  });
  forest.instanceMatrix.needsUpdate = true;
  forest.computeBoundingSphere();
  extGroup.add(forest);

  let forestMood = -1;
  const _c = new THREE.Color();
  function updateForestTint(m) {
    if (Math.abs(m - forestMood) < 1e-4) return; // only when moodT changes
    forestMood = m;
    for (let i = 0; i < treeData.length; i++) {
      forest.setColorAt(i, _c.lerpColors(treeData[i].golden, treeData[i].rain, m));
    }
    forest.instanceColor.needsUpdate = true;
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
    ridgeShared.uMood.value = m;
    updateForestTint(m);
    mistMat.color.lerpColors(mistGolden, mistRain, m);
    mistMat.opacity = THREE.MathUtils.lerp(0.24, 0.36, m);

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
