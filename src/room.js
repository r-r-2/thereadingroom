/* Room architectural shell:
   - Wide-plank oak PBR floor (albedo + normal + per-plank roughness)
   - Textured woven wool area rug anchoring the center of the room
   - Limewash plaster walls & ceiling with window cutout on the left wall
   - Architectural baseboards + crown molding around the room perimeter
   - Closed 4-panel wooden door on the front wall (+Z) with brass lever
     hardware, keyhole escutcheon, casing, and warm hallway light sliver */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM, DOOR, NOOK } from './constants.js';
import {
  makeFloorTextures,
  WALL_MAT,
  CEIL_MAT,
  TRIM_MAT,
  DOOR_WOOD,
  DOOR_RECESS,
  DOOR_TRIM,
  BRASS
} from './materials.js';

function makeRugTexture(maxAnisotropy = 8) {
  const W = 512, H = 768;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');

  // Warm oatmeal-terracotta woven base
  x.fillStyle = '#ddd0bc';
  x.fillRect(0, 0, W, H);

  // Subtle woven warp/weft grain
  for (let y = 0; y < H; y += 3) {
    x.fillStyle = y % 6 === 0 ? 'rgba(95,72,50,0.06)' : 'rgba(255,250,242,0.06)';
    x.fillRect(0, y, W, 1.5);
  }
  for (let i = 0; i < W; i += 4) {
    x.fillStyle = 'rgba(110,82,58,0.045)';
    x.fillRect(i, 0, 1.5, H);
  }

  // Double geometric border in muted rust & sage
  x.strokeStyle = 'rgba(154,90,64,0.42)';
  x.lineWidth = 14;
  x.strokeRect(28, 32, W - 56, H - 64);

  x.strokeStyle = 'rgba(104,120,98,0.34)';
  x.lineWidth = 5;
  x.strokeRect(48, 52, W - 96, H - 104);

  // Subtle diamond medallion motif in the center
  x.strokeStyle = 'rgba(138,88,62,0.22)';
  x.lineWidth = 4;
  const cx = W / 2, cy = H / 2;
  [90, 145].forEach((r) => {
    x.beginPath();
    x.moveTo(cx, cy - r * 1.25);
    x.lineTo(cx + r, cy);
    x.lineTo(cx, cy + r * 1.25);
    x.lineTo(cx - r, cy);
    x.closePath();
    x.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const RUG_BOUNDS = {
  minX: -1.35,
  maxX: 1.35,
  minZ: -1.85,
  maxZ: 1.45
};

export function buildRoom(scene, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ---- Wide-plank oak PBR floor ---- */
  const floorMaps = makeFloorTextures(maxAniso);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMaps.map,
    normalMap: floorMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: floorMaps.roughnessMap,
    roughness: 0.72,
    metalness: 0.0
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---- Woven center wool area rug ---- */
  const rugW = RUG_BOUNDS.maxX - RUG_BOUNDS.minX;
  const rugD = RUG_BOUNDS.maxZ - RUG_BOUNDS.minZ;
  const rugMat = new THREE.MeshPhysicalMaterial({
    map: makeRugTexture(maxAniso),
    roughness: 0.92,
    sheen: 0.55,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xf6ecdc)
  });
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(rugW, 0.01, rugD, 2, 0.004),
    rugMat
  );
  rug.position.set(
    (RUG_BOUNDS.minX + RUG_BOUNDS.maxX) / 2,
    0.004,
    (RUG_BOUNDS.minZ + RUG_BOUNDS.maxZ) / 2
  );
  rug.receiveShadow = true;
  scene.add(rug);

  /* ---- Ceiling ---- */
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), CEIL_MAT);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  scene.add(ceiling);

  /* ---- Walls ---- */
  function addWall(w, h, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), WALL_MAT);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // Back wall (-Z, behind bookcase)
  addWall(ROOM.w, ROOM.h, 0, ROOM.h / 2, -ROOM.d / 2, 0);
  // Front wall (+Z, with door & guest table)
  addWall(ROOM.w, ROOM.h, 0, ROOM.h / 2, ROOM.d / 2, Math.PI);
  // Right wall (+X, behind turntable & gallery salon)
  addWall(ROOM.d, ROOM.h, ROOM.w / 2, ROOM.h / 2, 0, -Math.PI / 2);

  /* Left wall (-X) around the book-nook landscape window opening so the
     3D exterior pocket world is visible through real window glass, and the
     wall surround casts true window-aperture shadows across the room. */
  const winMinZ = NOOK.worldZ - NOOK.winW / 2;
  const winMaxZ = NOOK.worldZ + NOOK.winW / 2;
  const winTopY = NOOK.sill + NOOK.winH;
  const wallT = 0.08;

  const leftWallPieces = [
    // Below sill
    { w: wallT, h: NOOK.sill, d: ROOM.d, x: -ROOM.w / 2 - wallT / 2, y: NOOK.sill / 2, z: 0 },
    // Above window header
    { w: wallT, h: ROOM.h - winTopY, d: ROOM.d, x: -ROOM.w / 2 - wallT / 2, y: winTopY + (ROOM.h - winTopY) / 2, z: 0 },
    // North pier (-Z of window)
    { w: wallT, h: NOOK.winH, d: winMinZ - (-ROOM.d / 2), x: -ROOM.w / 2 - wallT / 2, y: NOOK.sill + NOOK.winH / 2, z: (-ROOM.d / 2 + winMinZ) / 2 },
    // South pier (+Z of window)
    { w: wallT, h: NOOK.winH, d: ROOM.d / 2 - winMaxZ, x: -ROOM.w / 2 - wallT / 2, y: NOOK.sill + NOOK.winH / 2, z: (winMaxZ + ROOM.d / 2) / 2 }
  ];
  for (const p of leftWallPieces) {
    if (p.h <= 0.005 || p.d <= 0.005) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), WALL_MAT);
    m.position.set(p.x, p.y, p.z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  /* ---- Architectural Baseboards & Crown Molding ---- */
  const baseH = 0.095;
  const baseT = 0.016;
  const crownH = 0.065;
  const crownT = 0.022;

  function addTrimStrip(w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), TRIM_MAT);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  }

  // Baseboards (skipping the door opening on +Z)
  addTrimStrip(ROOM.w, baseH, baseT, 0, baseH / 2, -ROOM.d / 2 + baseT / 2);
  addTrimStrip(baseT, baseH, ROOM.d, ROOM.w / 2 - baseT / 2, baseH / 2, 0);
  addTrimStrip(baseT, baseH, ROOM.d, -ROOM.w / 2 + baseT / 2, baseH / 2, 0);

  // Front wall (+Z) baseboard split either side of the door at world x = -1.9
  const doorCenterWorldX = -1.9;
  const doorHalfSpan = DOOR.w / 2 + 0.075;
  const leftSpan = (doorCenterWorldX - doorHalfSpan) - (-ROOM.w / 2);
  if (leftSpan > 0.05) {
    addTrimStrip(leftSpan, baseH, baseT, -ROOM.w / 2 + leftSpan / 2, baseH / 2, ROOM.d / 2 - baseT / 2);
  }
  const rightStart = doorCenterWorldX + doorHalfSpan;
  const rightSpan = ROOM.w / 2 - rightStart;
  if (rightSpan > 0.05) {
    addTrimStrip(rightSpan, baseH, baseT, rightStart + rightSpan / 2, baseH / 2, ROOM.d / 2 - baseT / 2);
  }

  // Crown molding all four walls
  addTrimStrip(ROOM.w, crownH, crownT, 0, ROOM.h - crownH / 2, -ROOM.d / 2 + crownT / 2);
  addTrimStrip(ROOM.w, crownH, crownT, 0, ROOM.h - crownH / 2, ROOM.d / 2 - crownT / 2);
  addTrimStrip(crownT, crownH, ROOM.d, ROOM.w / 2 - crownT / 2, ROOM.h - crownH / 2, 0);
  addTrimStrip(crownT, crownH, ROOM.d, -ROOM.w / 2 + crownT / 2, ROOM.h - crownH / 2, 0);

  /* ---- Closed 4-Panel Wooden Door (front wall +Z, left side) ---- */
  const doorGroup = new THREE.Group();
  doorGroup.position.set(doorCenterWorldX, 0, ROOM.d / 2 - 0.01);
  doorGroup.rotation.y = Math.PI;
  scene.add(doorGroup);

  const casingW = 0.075;
  const casingD = 0.028;

  function doorPart(w, h, d, mat, x, y, z, bevel = 0.004) {
    const geo = bevel > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * 0.2, h * 0.2, d * 0.2))
      : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    doorGroup.add(m);
    return m;
  }

  // Door casing (left/right jambs + header lintel)
  doorPart(casingW, DOOR.h + casingW, casingD, DOOR_TRIM, -DOOR.w / 2 - casingW / 2, (DOOR.h + casingW) / 2, casingD / 2);
  doorPart(casingW, DOOR.h + casingW, casingD, DOOR_TRIM, DOOR.w / 2 + casingW / 2, (DOOR.h + casingW) / 2, casingD / 2);
  doorPart(DOOR.w + casingW * 2 + 0.02, casingW * 1.15, casingD + 0.008, DOOR_TRIM, 0, DOOR.h + casingW / 2, casingD / 2 + 0.003);

  // Main door leaf
  doorPart(DOOR.w, DOOR.h - 0.008, 0.02, DOOR_WOOD, 0, DOOR.h / 2 + 0.004, 0.01, 0.003);

  // Four recessed stile-and-rail panels with raised inner bolection molding
  const panelW = (DOOR.w - 0.24) / 2;
  const upperH = 0.78, lowerH = 0.64;
  for (const sx of [-1, 1]) {
    const px = sx * (panelW / 2 + 0.04);
    doorPart(panelW, upperH, 0.008, DOOR_RECESS, px, 1.48, 0.022, 0.002);
    doorPart(panelW - 0.05, upperH - 0.06, 0.006, DOOR_WOOD, px, 1.48, 0.026, 0.002);

    doorPart(panelW, lowerH, 0.008, DOOR_RECESS, px, 0.56, 0.022, 0.002);
    doorPart(panelW - 0.05, lowerH - 0.06, 0.006, DOOR_WOOD, px, 0.56, 0.026, 0.002);
  }

  // Brushed brass escutcheon plate, keyhole, and tactile lever handle
  const handleX = DOOR.w / 2 - 0.095;
  doorPart(0.042, 0.16, 0.006, BRASS, handleX, 0.99, 0.023, 0.002);
  const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16), BRASS);
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(handleX, 1.02, 0.03);
  doorGroup.add(rosette);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.038, 12), BRASS);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(handleX, 1.02, 0.046);
  doorGroup.add(neck);

  const lever = new THREE.Mesh(new RoundedBoxGeometry(0.105, 0.016, 0.014, 2, 0.004), BRASS);
  lever.position.set(handleX - 0.042, 1.02, 0.062);
  lever.castShadow = true;
  doorGroup.add(lever);

  // Subtle brass hinges on the opposite jamb
  for (const hy of [0.36, 1.06, 1.78]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.075, 10), BRASS);
    hinge.position.set(-DOOR.w / 2 + 0.004, hy, 0.024);
    doorGroup.add(hinge);
  }

  // Warm hallway light sliver under the door threshold
  const thresholdGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR.w - 0.04, 0.06),
    new THREE.MeshBasicMaterial({
      color: 0xffd296,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
  );
  thresholdGlow.rotation.x = -Math.PI / 2;
  thresholdGlow.position.set(0, 0.002, 0.04);
  doorGroup.add(thresholdGlow);

  return { floor, rug, doorGroup, thresholdGlow };
}
