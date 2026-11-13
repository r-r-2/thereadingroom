/* Reading table (left of the bookcase):
   - Beveled oak table top, apron, and tapered legs
   - Warm brass reading lamp (illuminates dynamically in Rainy Dusk via SHADE_MAT & lampLight)
   - Glazed ceramic succulent
   - Currently-reading books (`reading: 0..100`) lying cover-up with silk
     burgundy ribbon bookmarks placed at a depth matching reading progress */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TABLE } from './constants.js';
import { interactables, books } from './state.js';
import { WOOD, WOOD_DARK, BRASS, CERAMIC, SHADE_MAT, BOOKMARK_MAT } from './materials.js';
import { makeSucculent, makeTableLamp } from './props.js';
import { makeBookMaterials, loadCover } from './books.js';

export function buildReadingTable(scene, BOOKS, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const readingTable = new THREE.Group();
  readingTable.position.set(TABLE.x, 0, TABLE.z);
  scene.add(readingTable);

  const topT = 0.032;
  const top = new THREE.Mesh(
    new RoundedBoxGeometry(TABLE.w, topT, TABLE.d, 3, 0.006),
    WOOD
  );
  top.position.y = TABLE.h - topT / 2;
  top.castShadow = true;
  top.receiveShadow = true;
  readingTable.add(top);

  const apronH = 0.055, apronT = 0.022, inset = 0.055;
  const apronY = TABLE.h - topT - apronH / 2;
  for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w - inset * 2, apronH, apronT), WOOD_DARK);
    a.position.set(0, apronY, sz * (TABLE.d / 2 - inset));
    a.castShadow = true;
    readingTable.add(a);
  }
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(apronT, apronH, TABLE.d - inset * 2), WOOD_DARK);
    a.position.set(sx * (TABLE.w / 2 - inset), apronY, 0);
    a.castShadow = true;
    readingTable.add(a);
  }

  const legH = TABLE.h - topT;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.017, legH, 14), WOOD_DARK);
      leg.position.set(sx * (TABLE.w / 2 - inset), legH / 2, sz * (TABLE.d / 2 - inset));
      leg.castShadow = true;
      leg.receiveShadow = true;
      readingTable.add(leg);
    }
  }

  /* ---- Brass Reading Lamp ---- */
  const lamp = makeTableLamp();
  lamp.position.set(0.4, TABLE.h, -0.12);
  readingTable.add(lamp);

  /* ---- Ceramic Succulent ---- */
  const tablePlant = makeSucculent(0.95, CERAMIC);
  tablePlant.position.set(0.36, TABLE.h, 0.16);
  readingTable.add(tablePlant);

  /* ---- Currently-Reading Books with Silk Burgundy Ribbon Bookmarks ---- */
  const list = BOOKS.filter((b) => b.reading);
  const slots = [
    { x: -0.38, z: 0.05, yaw: 0.1 },
    { x: -0.15, z: -0.02, yaw: -0.07 },
    { x: 0.08, z: 0.06, yaw: 0.09 },
    { x: 0.22, z: -0.13, yaw: -0.12 }
  ];
  let stackY = TABLE.h;

  list.forEach((b, i) => {
    const depth = 0.156;
    const geo = new RoundedBoxGeometry(b.th, b.h, depth, 2, Math.min(0.0025, b.th * 0.14));
    const mats = makeBookMaterials(b, maxAniso);
    const mesh = new THREE.Mesh(geo, mats);
    // +π/2 lays the +x front cover face-up (spine on the left); the wrap yaw
    // of -π/2 then turns the book's top away from the viewer so it reads upright.
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const slot = slots[Math.min(i, slots.length - 1)];
    const baseY = (i < slots.length ? TABLE.h : stackY) + b.th / 2;
    if (i === 0 || i >= slots.length) stackY = baseY + b.th / 2;
    const yaw = -Math.PI / 2 + slot.yaw + (i >= slots.length ? (i % 2 ? -0.18 : 0.14) : 0);

    const wrap = new THREE.Group();
    wrap.position.set(slot.x, baseY, slot.z);
    wrap.rotation.y = yaw;
    wrap.add(mesh);

    // Silk burgundy ribbon bookmark peeking out from the bottom pages at reading %
    const p = THREE.MathUtils.clamp((+b.reading || 50) / 100, 0.05, 0.95);
    const half = b.th / 2;
    const insetP = 0.002;
    const tab = 0.028;
    const len = 0.06;
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.0022, len, 0.016), BOOKMARK_MAT);
    ribbon.position.set(
      (half - insetP) * (1 - p) + (-half + insetP) * p,
      -b.h / 2 - tab + len / 2,
      depth * 0.2
    );
    mesh.add(ribbon);

    mesh.userData = {
      book: b,
      onTable: true,
      tableRoot: wrap,
      baseX: slot.x,
      baseY,
      baseZ: slot.z,
      baseYaw: yaw,
      depth,
      pull: 0,
      targetPull: 0
    };
    readingTable.add(wrap);
    books.push(mesh);
    interactables.push(mesh);
    loadCover(b, mesh, maxAniso);
  });

  return { readingTable, lamp };
}
