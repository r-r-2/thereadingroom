/* Right-wall Hero Turntable & Vinyl Credenza:
   - Beveled walnut/oak credenza with slotted lower shelf & vinyl sleeve stack
   - Brushed aluminum platter & spindle + dark felt slipmat
   - Anisotropic radial micro-groove vinyl LP (`MeshPhysicalMaterial` + groove bump)
   - Precision S-shaped metallic tonearm, counterweight, headshell & stylus
   - Warm status LED + acrylic dust-cover rear hinges */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM, STAND, ARM_PARK, ARM_OUTER, ARM_INNER, CREDENZA_LAMP, LAMP_SCALE, damp } from './constants.js';
import { interactables } from './state.js';
import { WOOD, WOOD_DARK, PLINTH, METAL, BRASS, FELT } from './materials.js';
import { makeTableLamp } from './props.js';

function makeVinylGrooveTextures() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#141417';
  x.fillRect(0, 0, 512, 512);

  // Radial micro-grooves + subtle track-band spacing
  const cx = 256, cy = 256;
  for (let r = 82; r < 246; r += 1.6) {
    const band = (Math.floor(r / 38) % 2 === 0) ? 0.14 : 0.06;
    x.strokeStyle = r % 3.2 < 1.6
      ? `rgba(255,255,255,${band})`
      : 'rgba(0,0,0,0.35)';
    x.lineWidth = 0.9;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeLabelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#D96B43';
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#F5EDE0';
  g.beginPath(); g.arc(128, 128, 108, 0, Math.PI); g.fill();
  g.fillStyle = '#241F1C';
  g.font = '600 20px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('AFTERNOON STUDY', 128, 78);
  g.font = '500 15px ui-sans-serif, sans-serif';
  g.fillText('SIDE A  ·  33⅓ RPM', 128, 168);
  g.fillStyle = '#1A191B';
  g.beginPath(); g.arc(128, 128, 10, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTurntable(scene) {
  const playerUnit = new THREE.Group();
  playerUnit.position.set(ROOM.w / 2 - STAND.d / 2 - 0.06, 0, -0.4);
  playerUnit.rotation.y = -Math.PI / 2;
  scene.add(playerUnit);

  // Small lamp on the free end of the credenza: the visible source of the
  // corner glow (lighting.js places its PointLight in this shade).
  const creLamp = makeTableLamp(LAMP_SCALE);
  creLamp.position.set(CREDENZA_LAMP.x, STAND.h, CREDENZA_LAMP.z);
  creLamp.rotation.y = 0.4;
  playerUnit.add(creLamp);

  function sPart(w, h, d, mat, x, y, z, bevel = 0.004) {
    const geo = bevel > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * 0.25, h * 0.25, d * 0.25))
      : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    playerUnit.add(m);
    return m;
  }

  const legH = 0.2;
  const bodyH = STAND.h - legH;
  sPart(STAND.w, 0.026, STAND.d, WOOD, 0, STAND.h - 0.013, 0, 0.005);
  sPart(STAND.w, 0.024, STAND.d, WOOD, 0, legH + 0.012, 0, 0.004);
  sPart(0.024, bodyH, STAND.d, WOOD, -STAND.w / 2 + 0.012, legH + bodyH / 2, 0);
  sPart(0.024, bodyH, STAND.d, WOOD, STAND.w / 2 - 0.012, legH + bodyH / 2, 0);
  sPart(0.02, bodyH - 0.05, STAND.d - 0.03, WOOD_DARK, 0.08, legH + bodyH / 2, 0);
  sPart(STAND.w - 0.04, bodyH - 0.04, 0.014, WOOD_DARK, 0, legH + bodyH / 2, -STAND.d / 2 + 0.01, 0);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.013, legH, 12), WOOD_DARK);
      leg.position.set(sx * (STAND.w / 2 - 0.07), legH / 2, sz * (STAND.d / 2 - 0.07));
      leg.rotation.z = sx * -0.08;
      leg.castShadow = true;
      playerUnit.add(leg);
    }
  }

  // Leaning vinyl LP jacket sleeves in the left cubby
  const sleeveColors = [
    '#C96B4B', '#2F4858', '#D8B26E', '#5E7461', '#3B2F2F',
    '#B85D43', '#7B8FA1', '#E2C9A0', '#465362', '#8C5E58', '#6B705C', '#C2A878'
  ];
  sleeveColors.forEach((col, i) => {
    const sl = new THREE.Mesh(
      new RoundedBoxGeometry(0.006, 0.31, 0.31, 1, 0.0015),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.48, clearcoat: 0.25 })
    );
    sl.position.set(-STAND.w / 2 + 0.09 + i * 0.022, legH + 0.024 + 0.155, 0.01);
    sl.rotation.z = -0.08 + (i % 3) * 0.012;
    sl.castShadow = true;
    playerUnit.add(sl);
  });

  /* ---- Hero Turntable Assembly ---- */
  const tt = new THREE.Group();
  tt.position.set(-0.08, STAND.h, 0.01);
  playerUnit.add(tt);

  const plinthH = 0.052;
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.45, plinthH, 0.36, 3, 0.006), PLINTH);
  plinth.position.y = plinthH / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  tt.add(plinth);

  // Subtle vibration-isolation brass feet
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.008, 16), BRASS);
      foot.position.set(sx * 0.185, 0.004, sz * 0.14);
      tt.add(foot);
    }
  }

  const platterR = 0.148;
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(platterR, platterR, 0.016, 56), METAL);
  platter.position.set(-0.045, plinthH + 0.009, 0);
  platter.castShadow = true;
  tt.add(platter);

  const mat = new THREE.Mesh(new THREE.CylinderGeometry(platterR - 0.004, platterR - 0.004, 0.003, 56), FELT);
  mat.position.set(-0.045, plinthH + 0.0185, 0);
  tt.add(mat);

  const vinylGrooves = makeVinylGrooveTextures();
  const vinylMat = new THREE.MeshPhysicalMaterial({
    map: vinylGrooves,
    bumpMap: vinylGrooves,
    bumpScale: 0.0015,
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.88,
    clearcoatRoughness: 0.16,
    anisotropy: 0.75
  });

  const recordGroup = new THREE.Group();
  recordGroup.position.set(-0.045, plinthH + 0.022, 0);
  tt.add(recordGroup);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.144, 0.0028, 64), vinylMat);
  recordGroup.add(disc);

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.0032, 40),
    new THREE.MeshStandardMaterial({ map: makeLabelTexture(), roughness: 0.55 })
  );
  recordGroup.add(label);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.022, 14), METAL);
  spindle.position.set(-0.045, plinthH + 0.028, 0);
  tt.add(spindle);

  // Precision tonearm + gimbal + counterweight + headshell
  const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.024, 24), METAL);
  armBase.position.set(0.155, plinthH + 0.012, -0.105);
  tt.add(armBase);

  const armPivot = new THREE.Group();
  armPivot.position.set(0.155, plinthH + 0.034, -0.105);
  tt.add(armPivot);

  const armLen = 0.22;
  const armRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, armLen, 12), METAL);
  armRod.rotation.x = Math.PI / 2;
  armRod.position.z = armLen / 2 - 0.03;
  armRod.castShadow = true;
  armPivot.add(armRod);

  const counterW = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.024, 20), BRASS);
  counterW.rotation.x = Math.PI / 2;
  counterW.position.z = -0.04;
  armPivot.add(counterW);

  const headshell = new THREE.Mesh(new RoundedBoxGeometry(0.017, 0.006, 0.03, 2, 0.0015), METAL);
  headshell.position.set(-0.005, -0.003, armLen - 0.02);
  headshell.rotation.y = 0.24;
  armPivot.add(headshell);

  const stylus = new THREE.Mesh(new THREE.ConeGeometry(0.0025, 0.008, 8), BRASS);
  stylus.rotation.x = Math.PI;
  stylus.position.set(-0.007, -0.009, armLen - 0.012);
  armPivot.add(stylus);

  // Speed selector knob + warm amber status indicator LED
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 20), BRASS);
  knob.position.set(0.175, plinthH + 0.006, 0.13);
  tt.add(knob);

  const statusLedMat = new THREE.MeshBasicMaterial({ color: 0xffb35c });
  const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8), statusLedMat);
  statusLed.position.set(0.142, plinthH + 0.003, 0.13);
  tt.add(statusLed);

  // Open clear-acrylic dust cover angled back on rear hinges
  const dustCover = new THREE.Mesh(
    new RoundedBoxGeometry(0.445, 0.048, 0.355, 2, 0.005),
    new THREE.MeshPhysicalMaterial({
      color: 0xf5f8fa,
      roughness: 0.06,
      transmission: 0.72,
      ior: 1.49,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  );
  dustCover.position.set(0, plinthH + 0.14, -0.2);
  dustCover.rotation.x = -0.78;
  tt.add(dustCover);

  // Generous invisible raycast hit box covering the turntable deck
  const ttHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ttHit.position.y = 0.08;
  ttHit.userData.turntable = true;
  tt.add(ttHit);
  interactables.push(ttHit);

  armPivot.rotation.y = ARM_OUTER;
  let spinSpeed = 0;

  // World position of the turntable platter for HRTF 3D spatial audio
  const worldPos = new THREE.Vector3();
  tt.updateWorldMatrix(true, false);
  recordGroup.getWorldPosition(worldPos);

  function update(dt, musicPlaying, sideProgress) {
    spinSpeed = damp(spinSpeed, musicPlaying ? 3.49 : 0, 3, dt);
    recordGroup.rotation.y -= spinSpeed * dt;

    const grooveTarget = ARM_OUTER + (ARM_INNER - ARM_OUTER) * sideProgress;
    const armTarget = musicPlaying ? grooveTarget : ARM_PARK;
    armPivot.rotation.y = damp(armPivot.rotation.y, armTarget, 5, dt);
    armPivot.rotation.x = damp(armPivot.rotation.x, musicPlaying ? 0.03 : -0.03, 6, dt);

    statusLedMat.color.setHex(musicPlaying ? 0xffb35c : 0x4b3f36);
  }

  return {
    playerUnit,
    tt,
    worldPos,
    update
  };
}
