/* Left-wall built-in Book Nook:
   - Beveled oak window casing & 3-pane mullions casting cached soft shadows
   - Physical window glass + procedural GLSL animated rain-droplet layer in Rainy Dusk
   - Gently breathing sheer linen curtains framing the view
   - Built-in bench with drawers, physical-sheen linen seat cushion & throw pillows
   - Interactive brass Window-Sill Mood Switch (`golden` ↔ `rain`)
   - Flanking curio towers with sconce lights, ceramics, sculptures, art & plants */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM, NOOK, damp } from './constants.js';
import { runtime, interactables } from './state.js';
import {
  WOOD,
  WOOD_DARK,
  BRASS,
  CERAMIC,
  TERRACOTTA,
  CLAY_SAGE,
  CLAY_OCHRE,
  WINDOW_GLASS,
  LINEN,
  PILLOW_RUST,
  PILLOW_SAGE,
  PILLOW_CREAM,
  SHADE_MAT
} from './materials.js';
import {
  makeSucculent,
  makePotPlant,
  makeCandle,
  makeVase,
  makeFlatStack,
  makeArtPrint,
  makeArchSculpture,
  makeSphereStand,
  makeCeramicBowl,
  makeMugAndCoaster,
  makeGlassBottle
} from './props.js';

export function buildWindowNook(scene) {
  const nookGroup = new THREE.Group();
  nookGroup.position.set(-ROOM.w / 2, 0, NOOK.worldZ);
  nookGroup.rotation.y = Math.PI / 2;
  scene.add(nookGroup);

  function nookBox(w, h, d, mat, x, y, z, bevel = 0.004) {
    const geo = bevel > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * 0.25, h * 0.25, d * 0.25))
      : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    nookGroup.add(m);
    return m;
  }

  /* ---- 1. Physical Window Glass + Animated Rain-Droplet Shader Overlay ---- */
  const winCenterY = NOOK.sill + NOOK.winH / 2;
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(NOOK.winW, NOOK.winH), WINDOW_GLASS);
  glassPane.position.set(0, winCenterY, 0.012);
  nookGroup.add(glassPane);

  const rainGlassUniforms = {
    uTime: { value: 0 },
    uMood: { value: runtime.moodT }
  };
  const rainGlassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: rainGlassUniforms,
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

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float dropLayer(vec2 uv, float t, float scale) {
        vec2 aspect = vec2(2.2, 1.0);
        vec2 st = uv * scale * aspect;
        st.y += t * 0.28;
        vec2 id = floor(st);
        vec2 gv = fract(st) - 0.5;
        float n = hash21(id);
        if (n < 0.68) return 0.0;              // most cells stay dry
        float x = (n - 0.5) * 0.55;
        float y = -sin(t * (0.8 + n) + n * 6.28) * 0.32;
        x += sin((uv.y + n) * 18.0) * 0.05;
        vec2 dropPos = (gv - vec2(x, y)) / aspect;
        float r = length(dropPos);
        // Clear bead: faint body, brighter rim, not a solid white dot
        float drop = smoothstep(0.034, 0.024, r) * 0.35 + smoothstep(0.036, 0.03, r) * smoothstep(0.02, 0.03, r) * 0.65;

        vec2 trailPos = (gv - vec2(x, t * 0.0)) / aspect;
        trailPos.y = (fract(trailPos.y * 4.0) - 0.5) / 4.0;
        float trail = smoothstep(0.012, 0.003, length(trailPos)) * smoothstep(-0.02, 0.35, gv.y - y);
        trail *= step(0.86, n);                // only some drops leave a trail
        return max(drop, trail * 0.45);
      }

      void main() {
        if (uMood < 0.02) discard;
        float d1 = dropLayer(vUv, uTime, 9.0);
        float d2 = dropLayer(vUv + 0.37, uTime * 1.25 + 4.1, 16.0);
        float d = clamp(d1 + d2 * 0.75, 0.0, 1.0);
        // Subtle cool condensation near corners
        vec2 edge = abs(vUv - 0.5) * 2.0;
        float mist = smoothstep(0.65, 1.05, max(edge.x, edge.y)) * 0.16;
        vec3 col = mix(vec3(0.68, 0.78, 0.90), vec3(0.90, 0.95, 1.0), d);
        float alpha = (d * 0.32 + mist) * uMood;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const rainGlass = new THREE.Mesh(new THREE.PlaneGeometry(NOOK.winW, NOOK.winH), rainGlassMat);
  rainGlass.position.set(0, winCenterY, 0.016);
  nookGroup.add(rainGlass);

  /* ---- 2. Beveled Oak Window Frame, Mullions & Deep Sill ---- */
  const ft = NOOK.frameT, fd = NOOK.frameD;
  nookBox(NOOK.winW + ft * 2, ft, fd, WOOD_DARK, 0, NOOK.sill + NOOK.winH + ft / 2, fd / 2);
  nookBox(NOOK.winW + ft * 2 + 0.04, 0.038, fd + 0.06, WOOD, 0, NOOK.sill - 0.019, (fd + 0.06) / 2);
  nookBox(ft, NOOK.winH, fd, WOOD_DARK, -NOOK.winW / 2 - ft / 2, winCenterY, fd / 2);
  nookBox(ft, NOOK.winH, fd, WOOD_DARK, NOOK.winW / 2 + ft / 2, winCenterY, fd / 2);

  for (const mx of [-NOOK.winW / 6, NOOK.winW / 6]) {
    nookBox(0.028, NOOK.winH, 0.042, WOOD_DARK, mx, winCenterY, 0.028, 0.003);
  }
  nookBox(NOOK.winW, 0.024, 0.038, WOOD_DARK, 0, NOOK.sill + NOOK.winH * 0.66, 0.026, 0.003);

  /* ---- 3. Sheer Breathing Linen Curtains Framing Window Edges ---- */
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: 0xf6efe2,
    roughness: 0.88,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xfffaf0),
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, NOOK.winW + 0.24, 14), BRASS);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, NOOK.sill + NOOK.winH + ft + 0.035, fd + 0.035);
  nookGroup.add(rod);

  const curtains = [];
  for (const side of [-1, 1]) {
    const cGroup = new THREE.Group();
    cGroup.position.set(side * (NOOK.winW / 2 - 0.06), NOOK.sill + NOOK.winH + ft + 0.02, fd + 0.03);
    for (let pleat = 0; pleat < 4; pleat++) {
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, NOOK.winH + 0.08, 10, 1, true), curtainMat);
      strip.scale.z = 0.55;
      strip.position.set(side * (pleat * 0.036 - 0.05), -(NOOK.winH + 0.08) / 2, (pleat % 2) * 0.012);
      cGroup.add(strip);
    }
    nookGroup.add(cGroup);
    curtains.push({ group: cGroup, side });
  }

  /* ---- 4. Interactive Brass Window-Sill Mood Switch (`golden` ↔ `rain`) ---- */
  const moodSwitch = new THREE.Group();
  moodSwitch.position.set(NOOK.winW / 2 - 0.26, NOOK.sill, fd + 0.032);
  nookGroup.add(moodSwitch);

  const swBase = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.016, 0.065, 2, 0.004), WOOD_DARK);
  swBase.position.y = 0.008;
  swBase.castShadow = true;
  moodSwitch.add(swBase);

  const swPlate = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.006, 0.044, 2, 0.002), BRASS);
  swPlate.position.y = 0.018;
  moodSwitch.add(swPlate);

  const moodTogglePivot = new THREE.Group();
  moodTogglePivot.position.set(0, 0.021, 0);
  moodSwitch.add(moodTogglePivot);

  const swToggle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.034, 12), BRASS);
  swToggle.position.y = 0.015;
  moodTogglePivot.add(swToggle);
  const swTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), BRASS);
  swTip.position.y = 0.032;
  moodTogglePivot.add(swTip);

  const swHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  swHit.position.y = 0.05;
  swHit.userData.moodSwitch = true;
  moodSwitch.add(swHit);
  interactables.push(swHit);

  /* ---- 5. Built-In Window Bench, Drawers, Linen Cushion & Throw Pillows ---- */
  nookBox(NOOK.seatW, 0.036, NOOK.seatD, WOOD, 0, NOOK.seatH - 0.018, NOOK.seatD / 2, 0.005);
  nookBox(NOOK.seatW, NOOK.seatH - 0.09, 0.025, WOOD_DARK, 0, 0.054 + (NOOK.seatH - 0.09) / 2, NOOK.seatD - 0.02);
  nookBox(NOOK.seatW - 0.04, 0.054, 0.025, WOOD_DARK, 0, 0.027, NOOK.seatD - 0.045);

  const drawerW = (NOOK.seatW - 0.18) / 3;
  for (let i = -1; i <= 1; i++) {
    const dx = i * (drawerW + 0.045);
    const dy = 0.054 + (NOOK.seatH - 0.09) / 2;
    nookBox(drawerW, NOOK.seatH - 0.14, 0.018, WOOD, dx, dy, NOOK.seatD - 0.004, 0.003);
    const pull = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.014, 0.02, 2, 0.004), BRASS);
    pull.position.set(dx, dy, NOOK.seatD + 0.012);
    nookGroup.add(pull);
  }

  // Tufted linen bench cushion with rounded physical fabric edges
  const cushW = NOOK.seatW - 0.06, cushD = NOOK.seatD - 0.07;
  const cushion = new THREE.Mesh(
    new RoundedBoxGeometry(cushW, NOOK.cushionH, cushD, 4, 0.026),
    LINEN
  );
  cushion.position.set(0, NOOK.seatH + NOOK.cushionH / 2, NOOK.seatD / 2 + 0.01);
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  nookGroup.add(cushion);

  for (const bx of [-0.78, -0.26, 0.26, 0.78]) {
    for (const bz of [-0.11, 0.11]) {
      const tuft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), WOOD_DARK);
      tuft.position.set(bx, NOOK.seatH + NOOK.cushionH + 0.001, NOOK.seatD / 2 + 0.01 + bz);
      nookGroup.add(tuft);
    }
  }

  function makeThrowPillow(w, h, mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), mat);
    body.scale.set(w, h, 0.15);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    return g;
  }

  const cushionTopY = NOOK.seatH + NOOK.cushionH;
  const pL1 = makeThrowPillow(0.4, 0.36, PILLOW_RUST);
  pL1.position.set(-NOOK.seatW / 2 + 0.23, cushionTopY + 0.15, 0.2);
  pL1.rotation.set(-0.22, 0.38, 0.1);
  nookGroup.add(pL1);

  const pL2 = makeThrowPillow(0.34, 0.32, PILLOW_CREAM);
  pL2.position.set(-NOOK.seatW / 2 + 0.44, cushionTopY + 0.13, 0.25);
  pL2.rotation.set(-0.28, 0.2, 0.05);
  nookGroup.add(pL2);

  const pR1 = makeThrowPillow(0.4, 0.36, PILLOW_SAGE);
  pR1.position.set(NOOK.seatW / 2 - 0.23, cushionTopY + 0.15, 0.2);
  pR1.rotation.set(-0.22, -0.38, -0.1);
  nookGroup.add(pR1);

  const pR2 = makeThrowPillow(0.32, 0.3, PILLOW_CREAM);
  pR2.position.set(NOOK.seatW / 2 - 0.44, cushionTopY + 0.12, 0.26);
  pR2.rotation.set(-0.3, -0.18, -0.04);
  nookGroup.add(pR2);

  const mugOnSeat = makeMugAndCoaster();
  mugOnSeat.position.set(0.32, cushionTopY, NOOK.seatD - 0.16);
  nookGroup.add(mugOnSeat);

  /* ---- 6. Flanking Built-In Curio Towers + Brass Sconces ---- */
  const towerInnerX = NOOK.winW / 2 + ft;
  const towerCenterX = towerInnerX + NOOK.towerW / 2;
  const towerShelfY = [NOOK.cabH, 1.24, 1.7, 2.16];
  const wallT = 0.028;

  for (const side of [-1, 1]) {
    const cx = side * towerCenterX;
    nookBox(NOOK.towerW, NOOK.towerH, 0.018, WOOD_DARK, cx, NOOK.towerH / 2, 0.009);
    nookBox(wallT, NOOK.towerH, NOOK.towerD, WOOD, cx - (NOOK.towerW / 2 - wallT / 2), NOOK.towerH / 2, NOOK.towerD / 2);
    nookBox(wallT, NOOK.towerH, NOOK.towerD, WOOD, cx + (NOOK.towerW / 2 - wallT / 2), NOOK.towerH / 2, NOOK.towerD / 2);
    nookBox(NOOK.towerW + 0.03, 0.036, NOOK.towerD + 0.03, WOOD, cx, NOOK.towerH + 0.018, (NOOK.towerD + 0.03) / 2);
    nookBox(NOOK.towerW - wallT * 2, 0.06, 0.022, WOOD_DARK, cx, 0.03, NOOK.towerD - 0.025);

    const doorH = NOOK.cabH - 0.09, doorW = (NOOK.towerW - wallT * 2 - 0.016) / 2;
    for (const ds of [-1, 1]) {
      const dx = cx + ds * (doorW / 2 + 0.004);
      const dy = 0.06 + doorH / 2;
      nookBox(doorW, doorH, 0.018, WOOD, dx, dy, NOOK.towerD - 0.01, 0.003);
      nookBox(doorW - 0.06, doorH - 0.08, 0.008, WOOD_DARK, dx, dy, NOOK.towerD + 0.001, 0.002);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), BRASS);
      knob.position.set(cx + ds * 0.03, dy + 0.04, NOOK.towerD + 0.014);
      nookGroup.add(knob);
    }

    towerShelfY.forEach((sy) => {
      nookBox(NOOK.towerW - wallT * 2, 0.024, NOOK.towerD - 0.02, WOOD, cx, sy, (NOOK.towerD - 0.02) / 2 + 0.018);
    });

    // Brass wall sconce above each tower (glows brightly in Rainy Dusk via SHADE_MAT)
    const sconce = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 18), BRASS);
    plate.rotation.x = Math.PI / 2;
    sconce.add(plate);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 10), BRASS);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, 0, 0.055);
    sconce.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.11, 18, 1, true), SHADE_MAT);
    shade.position.set(0, 0.04, 0.105);
    sconce.add(shade);
    sconce.position.set(cx, 2.38, NOOK.towerD + 0.005);
    nookGroup.add(sconce);
  }

  // Crown bridge uniting both towers above the landscape window
  const crownSpan = (towerInnerX + NOOK.towerW) * 2 + 0.04;
  nookBox(crownSpan, 0.05, NOOK.towerD + 0.04, WOOD, 0, NOOK.towerH + 0.045, (NOOK.towerD + 0.04) / 2);

  /* ---- 7. Curated Objects in Both Curio Towers ---- */
  function placeInTower(side, shelfIdx, obj, xOff = 0, zOff = 0, ry = 0) {
    obj.position.set(
      side * towerCenterX + xOff,
      towerShelfY[shelfIdx] + 0.012,
      NOOK.towerD / 2 + zOff
    );
    obj.rotation.y += ry;
    nookGroup.add(obj);
    return obj;
  }

  // North tower (side = -1)
  placeInTower(-1, 0, makeCeramicBowl(), -0.14, 0.02);
  placeInTower(-1, 0, makeCandle(0.11, 0.03), 0.12, 0.04);
  placeInTower(-1, 0, makeCandle(0.075, 0.025), 0.2, -0.02);
  placeInTower(-1, 1, makeArtPrint(0.24, 0.3, 'arch'), -0.11, -0.05, 0.08);
  placeInTower(-1, 1, makeVase({ h: 0.22, r: 0.055, mat: TERRACOTTA, stems: true }), 0.16, 0.02);
  placeInTower(-1, 2, makeArchSculpture(), -0.13, 0.01, 0.2);
  placeInTower(-1, 2, makeFlatStack([
    { c: '#B9A58D', th: 0.024, w: 0.2, d: 0.15 },
    { c: '#5B6B57', th: 0.02, w: 0.19, d: 0.14 }
  ]), 0.13, 0.01);
  const orbTop = makeSphereStand();
  orbTop.position.set(-towerCenterX + 0.13, towerShelfY[2] + 0.012 + 0.044, NOOK.towerD / 2 + 0.01);
  nookGroup.add(orbTop);
  placeInTower(-1, 3, makePotPlant(1.05, CERAMIC), -0.14, 0.02);
  placeInTower(-1, 3, makeGlassBottle(0.2, 0.044), 0.1, 0.0);
  placeInTower(-1, 3, makeGlassBottle(0.14, 0.034), 0.2, 0.03);

  // South tower (side = +1)
  placeInTower(1, 0, makePotPlant(1.1, TERRACOTTA), 0.13, 0.02);
  placeInTower(1, 0, makeSphereStand(), -0.15, 0.02);
  placeInTower(1, 1, makeArtPrint(0.26, 0.28, 'hills'), 0.1, -0.05, -0.07);
  placeInTower(1, 1, makeSucculent(1.0, CLAY_SAGE), -0.17, 0.03);
  placeInTower(1, 2, makeVase({ h: 0.24, r: 0.058, mat: CERAMIC, stems: true }), -0.14, 0.01);
  placeInTower(1, 2, makeArtPrint(0.19, 0.24, 'botanical', WOOD), 0.13, -0.04, -0.1);
  placeInTower(1, 3, makeVase({ h: 0.17, r: 0.05, mat: CLAY_OCHRE, stems: false }), -0.16, 0.01);
  placeInTower(1, 3, makeArtPrint(0.2, 0.22, 'circles'), 0.04, -0.05, 0.05);
  placeInTower(1, 3, makeSucculent(0.85, CERAMIC), 0.21, 0.04);

  function update(t, dt) {
    rainGlassUniforms.uTime.value = t;
    rainGlassUniforms.uMood.value = runtime.moodT;
    rainGlass.visible = runtime.moodT > 0.02;

    // Gentle breeze breathing on sheer curtains
    const sway = Math.sin(t * 0.75) * 0.018;
    for (const c of curtains) {
      c.group.rotation.z = c.side * (0.02 + sway * 0.6);
      c.group.rotation.x = Math.cos(t * 0.55 + c.side) * 0.012;
    }

    // Mood switch physical toggle throw
    const targetRot = runtime.mood === 'rain' ? 0.42 : -0.42;
    moodTogglePivot.rotation.x = damp(moodTogglePivot.rotation.x, targetRot, 12, dt);
  }

  return { nookGroup, moodSwitch, update };
}
