/* Right-wall 7-Poster Salon Gallery (`./posters/*.jpg` in a 3-over-4 grid):
   Upgraded in v2 with beveled oak frames, recessed cream matboards, subtle
   inner shadow bevels, and reflective museum-glass panes so posters catch
   warm window and lamp speculars as you walk past. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM } from './constants.js';
import { GALLERY_FRAME, GALLERY_REBATE, BRASS } from './materials.js';

const TOP_POSTERS = [
  './posters/books-are-my-therapy.jpg',
  './posters/just-one-more-chapter.jpg',
  './posters/read-more-books.jpg'
];

const BOT_POSTERS = [
  './posters/books-are-my-safe-space.jpg',
  './posters/between-the-pages.jpg',
  './posters/reading-fills-my-soul.jpg',
  './posters/so-many-books.jpg'
];

export function buildGalleryWall(scene, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const galleryGroup = new THREE.Group();
  galleryGroup.position.set(ROOM.w / 2 - 0.014, 0, -0.4);
  galleryGroup.rotation.y = -Math.PI / 2;
  scene.add(galleryGroup);

  const museumGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.0,
    reflectivity: 0.55,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.11,
    depthWrite: false
  });

  const loader = new THREE.TextureLoader();

  function makeFramedPoster(url, w, h) {
    const g = new THREE.Group();
    const border = 0.018;
    const matW = 0.022;
    const depth = 0.018;

    // Beveled oak outer frame
    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(w + border * 2, h + border * 2, depth, 2, 0.003),
      GALLERY_FRAME
    );
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);

    // Cream matboard
    const matBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.002, h + 0.002),
      GALLERY_REBATE
    );
    matBoard.position.z = depth / 2 + 0.0008;
    g.add(matBoard);

    // Poster print inset inside matboard
    const artMat = new THREE.MeshStandardMaterial({
      color: 0xf3ece0,
      roughness: 0.68,
      metalness: 0.0
    });
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(w - matW * 2, h - matW * 2),
      artMat
    );
    art.position.z = depth / 2 + 0.0018;
    g.add(art);

    // Museum-glass front pane for realistic window reflection
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      museumGlassMat
    );
    glass.position.z = depth / 2 + 0.003;
    g.add(glass);

    // Tiny brass picture-rail pin at top
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), BRASS);
    pin.position.set(0, (h + border * 2) / 2 + 0.01, -depth / 4);
    g.add(pin);

    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      artMat.map = tex;
      artMat.color.setHex(0xffffff);
      artMat.needsUpdate = true;
    });

    return g;
  }

  const GAP = 0.075;
  const TOP_W = 0.64;
  const TOP_H = (TOP_W * 4) / 3;
  const TOTAL_W = TOP_W * 3 + GAP * 2;
  const BOT_W = (TOTAL_W - GAP * 3) / 4;
  const BOT_H = (BOT_W * 4) / 3;
  const botY0 = 0.98;
  const topY = botY0 + BOT_H + GAP + TOP_H / 2;
  const botY = botY0 + BOT_H / 2;

  TOP_POSTERS.forEach((url, i) => {
    const f = makeFramedPoster(url, TOP_W, TOP_H);
    f.position.set((i - 1) * (TOP_W + GAP), topY, 0);
    galleryGroup.add(f);
  });

  const botLeft = -TOTAL_W / 2 + BOT_W / 2;
  BOT_POSTERS.forEach((url, i) => {
    const f = makeFramedPoster(url, BOT_W, BOT_H);
    f.position.set(botLeft + i * (BOT_W + GAP), botY, 0);
    galleryGroup.add(f);
  });

  return { galleryGroup };
}
