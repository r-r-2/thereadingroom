/* Reusable PBR prop builders shared across bookcase shelves, reading table,
   and book-nook curio towers:
   - Succulents & leafy potted plants (glazed ceramic / terracotta pots)
   - Subsurface-scattering wax candles with animated Rainy Dusk flames
   - Glazed ceramic & tinted refractive glass vases with botanical stems
   - Beveled flat decorative book stacks
   - Framed minimalist art & typography prints
   - Curio sculptures (arch, stone sphere on brass ring, brass bowl, mug) */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { candleFlames } from './state.js';
import {
  WOOD,
  WOOD_DARK,
  BRASS,
  CERAMIC,
  TERRACOTTA,
  CLAY_SAGE,
  CLAY_OCHRE,
  STONE_DARK,
  GLASS,
  WAX,
  PAGE_MAT,
  PLANT_A,
  PLANT_B,
  PLANT_C,
  SOIL,
  SHADE_MAT
} from './materials.js';

export function makeSucculent(scale = 1, potMat = TERRACOTTA) {
  const g = new THREE.Group();
  const potH = 0.08 * scale;
  const potR = 0.055 * scale;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(potR, potR * 0.76, potH, 18), potMat);
  pot.position.y = potH / 2;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(potR * 0.98, 0.005 * scale, 8, 20), potMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = potH;
  g.add(rim);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(potR * 0.92, potR * 0.92, 0.012, 16), SOIL);
  soil.position.y = potH - 0.004;
  g.add(soil);

  // Rosette of fleshy PBR leaves
  for (let ring = 0; ring < 2; ring++) {
    const n = ring === 0 ? 6 : 9;
    const r = (ring === 0 ? 0.018 : 0.034) * scale;
    const tilt = ring === 0 ? 0.42 : 0.88;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.4;
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.022 * scale, 10, 8),
        ring === 0 ? PLANT_B : PLANT_A
      );
      leaf.scale.set(0.62, 1.35, 0.44);
      leaf.position.set(
        Math.cos(a) * r,
        potH + (ring === 0 ? 0.026 : 0.018) * scale,
        Math.sin(a) * r
      );
      leaf.rotation.y = -a + Math.PI / 2;
      leaf.rotation.x = tilt;
      leaf.castShadow = true;
      g.add(leaf);
    }
  }
  return g;
}

export function makePotPlant(scale = 1, potMat = CERAMIC) {
  const g = new THREE.Group();
  const potH = 0.1 * scale;
  const potR = 0.065 * scale;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(potR, potR * 0.78, potH, 18), potMat);
  pot.position.y = potH / 2;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(potR * 0.92, potR * 0.92, 0.012, 14), SOIL);
  soil.position.y = potH - 0.004;
  g.add(soil);

  const mats = [PLANT_A, PLANT_B, PLANT_C];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.25;
    const h = (0.075 + (i % 3) * 0.026) * scale;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003 * scale, 0.004 * scale, h, 6), PLANT_C);
    stem.position.set(Math.cos(a) * 0.015 * scale, potH + h / 2, Math.sin(a) * 0.015 * scale);
    stem.rotation.z = Math.cos(a) * 0.25;
    stem.rotation.x = Math.sin(a) * 0.25;
    g.add(stem);

    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03 * scale, 10, 8), mats[i % 3]);
    leaf.scale.set(1.15, 0.36, 0.78);
    leaf.position.set(Math.cos(a) * 0.038 * scale, potH + h, Math.sin(a) * 0.038 * scale);
    leaf.rotation.y = a;
    leaf.rotation.z = 0.35;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export function makeCandle(h = 0.1, r = 0.028) {
  const g = new THREE.Group();

  // Small brass saucer
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.05, 0.008, 18), BRASS);
  dish.position.y = 0.004;
  dish.receiveShadow = true;
  g.add(dish);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r, h, 18), WAX);
  body.position.y = 0.008 + h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0018, 0.0018, 0.012, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.9 })
  );
  wick.position.y = 0.008 + h + 0.006;
  g.add(wick);

  // Warm flame teardrop — lights up automatically in Cozy Rainy Dusk mode
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcf78 })
  );
  flame.scale.set(0.75, 1.65, 0.75);
  flame.position.y = 0.008 + h + 0.018;
  flame.visible = false;
  g.add(flame);
  candleFlames.push(flame);

  return g;
}

export function makeVase({ h = 0.2, r = 0.052, mat = CERAMIC, stems = true } = {}) {
  const g = new THREE.Group();
  const belly = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
  belly.scale.set(1, (h * 0.65) / (r * 2), 1);
  belly.position.y = h * 0.34;
  belly.castShadow = true;
  belly.receiveShadow = true;
  g.add(belly);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.55, h * 0.42, 16), mat);
  neck.position.y = h * 0.74;
  neck.castShadow = true;
  g.add(neck);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.4, 0.005, 8, 18), mat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = h * 0.95;
  g.add(lip);

  if (stems) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const sh = h * 0.55 + i * 0.025;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, sh, 6), PLANT_C);
      stem.position.set(Math.cos(a) * 0.008, h * 0.8 + sh / 2, Math.sin(a) * 0.008);
      stem.rotation.z = Math.cos(a) * 0.18;
      stem.rotation.x = Math.sin(a) * 0.18;
      g.add(stem);

      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 7), i % 2 ? PLANT_B : CLAY_OCHRE);
      bud.scale.set(0.7, 1.35, 0.7);
      bud.position.set(Math.cos(a) * (0.008 + sh * 0.16), h * 0.8 + sh, Math.sin(a) * (0.008 + sh * 0.16));
      g.add(bud);
    }
  }
  return g;
}

export function makeFlatStack(items) {
  const g = new THREE.Group();
  let y = 0;
  items.forEach((it, i) => {
    const w = it.w || 0.2;
    const d = it.d || 0.15;
    const covMat = new THREE.MeshStandardMaterial({
      color: it.c,
      roughness: 0.62,
      metalness: 0.02
    });
    const book = new THREE.Group();
    const coverBot = new THREE.Mesh(new RoundedBoxGeometry(w, 0.003, d, 2, 0.001), covMat);
    coverBot.position.y = 0.0015;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.008, it.th - 0.006, d - 0.006), PAGE_MAT);
    pages.position.set(0.002, it.th / 2, 0);
    const coverTop = new THREE.Mesh(new RoundedBoxGeometry(w, 0.003, d, 2, 0.001), covMat);
    coverTop.position.y = it.th - 0.0015;
    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.005, it.th, d, 2, 0.0015), covMat);
    spine.position.set(-w / 2 + 0.0025, it.th / 2, 0);
    book.add(coverBot, pages, coverTop, spine);
    book.position.y = y;
    book.rotation.y = (i % 2 ? 1 : -1) * 0.05;
    book.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    g.add(book);
    y += it.th;
  });
  return g;
}

export function makeFramedPrint(w, h, text) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.016, 2, 0.003), WOOD_DARK);
  frame.position.y = h / 2;
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  const x = c.getContext('2d');
  x.fillStyle = '#F7F1E7';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#D2C2AE';
  x.lineWidth = 4;
  x.strokeRect(18, 18, c.width - 36, c.height - 36);
  x.fillStyle = '#5C4E40';
  x.font = 'italic 26px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    x.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * 34);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.024, h - 0.024),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
  );
  art.position.set(0, h / 2, 0.009);
  g.add(art);

  // Subtle museum-glass sheen pane
  const glassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.022, h - 0.022),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.08,
      reflectivity: 0.5,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    })
  );
  glassPane.position.set(0, h / 2, 0.01);
  g.add(glassPane);

  g.rotation.x = -0.14;
  return g;
}

export function makeArtPrint(w, h, motif = 'arch', frameMat = WOOD_DARK) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.018, 2, 0.003), frameMat);
  frame.position.y = h / 2;
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  const x = c.getContext('2d');
  const W = c.width, H = c.height;
  x.fillStyle = '#F6EFE3';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#DED2BE';
  x.lineWidth = 3;
  x.strokeRect(18, 18, W - 36, H - 36);

  if (motif === 'arch') {
    x.fillStyle = '#C27B56';
    x.beginPath();
    x.arc(W * 0.5, H * 0.56, W * 0.24, Math.PI, 0);
    x.lineTo(W * 0.74, H * 0.78);
    x.lineTo(W * 0.26, H * 0.78);
    x.closePath();
    x.fill();
    x.fillStyle = '#D9AE6E';
    x.beginPath();
    x.arc(W * 0.62, H * 0.34, W * 0.09, 0, Math.PI * 2);
    x.fill();
  } else if (motif === 'hills') {
    x.fillStyle = '#E6CFA8';
    x.beginPath();
    x.arc(W * 0.36, H * 0.36, W * 0.11, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#8FA089';
    x.beginPath();
    x.moveTo(26, H * 0.74);
    x.quadraticCurveTo(W * 0.38, H * 0.46, W - 26, H * 0.68);
    x.lineTo(W - 26, H - 26);
    x.lineTo(26, H - 26);
    x.closePath();
    x.fill();
    x.fillStyle = '#5D7059';
    x.beginPath();
    x.moveTo(26, H * 0.8);
    x.quadraticCurveTo(W * 0.66, H * 0.56, W - 26, H * 0.78);
    x.lineTo(W - 26, H - 26);
    x.lineTo(26, H - 26);
    x.closePath();
    x.fill();
  } else if (motif === 'botanical') {
    x.strokeStyle = '#556B52';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(W * 0.48, H * 0.8);
    x.quadraticCurveTo(W * 0.54, H * 0.5, W * 0.52, H * 0.24);
    x.stroke();
    x.fillStyle = '#6F8B69';
    [[-1, 0.66], [1, 0.58], [-1, 0.48], [1, 0.4], [-1, 0.32]].forEach(([s, ty]) => {
      x.save();
      x.translate(W * 0.51 + s * 22, H * ty);
      x.rotate(s * 0.55);
      x.beginPath();
      x.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    });
  } else {
    x.fillStyle = '#4A463F';
    x.beginPath();
    x.arc(W * 0.46, H * 0.48, W * 0.2, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#C27B56';
    x.lineWidth = 6;
    x.beginPath();
    x.arc(W * 0.58, H * 0.58, W * 0.16, 0, Math.PI * 2);
    x.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.026, h - 0.026),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.74 })
  );
  art.position.set(0, h / 2, 0.01);
  g.add(art);
  g.rotation.x = -0.13;
  return g;
}

export function makeArchSculpture() {
  const g = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 14, 28, Math.PI), TERRACOTTA);
  arch.position.y = 0.07;
  arch.castShadow = true;
  g.add(arch);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 14), TERRACOTTA);
    leg.position.set(sx * 0.068, 0.035, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

export function makeSphereStand() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 10, 24), BRASS);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.008;
  g.add(ring);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 22, 18), STONE_DARK);
  orb.position.y = 0.056;
  orb.castShadow = true;
  g.add(orb);
  return g;
}

export function makeCeramicBowl() {
  const g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.014, 18), CLAY_SAGE);
  foot.position.y = 0.007;
  g.add(foot);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 22, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    CLAY_SAGE
  );
  body.position.y = 0.088;
  body.castShadow = true;
  g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.005, 8, 24), CLAY_SAGE);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.075;
  g.add(rim);
  return g;
}

export function makeMugAndCoaster() {
  const g = new THREE.Group();
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.006, 18), WOOD_DARK);
  coaster.position.y = 0.003;
  g.add(coaster);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.078, 18), CERAMIC);
  body.position.y = 0.006 + 0.039;
  body.castShadow = true;
  g.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 8, 16, Math.PI), CERAMIC);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.035, 0.046, 0);
  g.add(handle);
  return g;
}

export function makeGlassBottle(h = 0.19, r = 0.042) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h * 0.62, 18), GLASS);
  body.position.y = h * 0.31;
  g.add(body);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), GLASS);
  shoulder.scale.y = 0.55;
  shoulder.position.y = h * 0.62;
  g.add(shoulder);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, h * 0.26, 14), GLASS);
  neck.position.y = h * 0.8;
  g.add(neck);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.26, r * 0.23, 0.022, 12), WOOD_DARK);
  cork.position.y = h * 0.95;
  g.add(cork);
  return g;
}

/* Brass table lamp with a SHADE_MAT cone (glows in Rainy Dusk). Base at y = 0;
   `LAMP_LIGHT_Y * scale` is where its PointLight belongs (inside the shade). */
export const LAMP_LIGHT_Y = 0.3;
export function makeTableLamp(scale = 1) {
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.018, 22), BRASS);
  base.position.y = 0.009;
  base.castShadow = true;
  lamp.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.27, 14), BRASS);
  stem.position.y = 0.018 + 0.135;
  stem.castShadow = true;
  lamp.add(stem);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8 })
  );
  bulb.position.y = 0.28;
  lamp.add(bulb);

  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.145, 24, 1, true), SHADE_MAT);
  shade.position.y = 0.018 + 0.27 + 0.04;
  shade.castShadow = true;
  lamp.add(shade);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), BRASS);
  finial.position.y = 0.398;
  lamp.add(finial);

  lamp.scale.setScalar(scale);
  return lamp;
}

/* Brass library picture light: a shaded bar on a short arm, mounted on the
   top front edge of a case and washing light down over the shelves. */
export function makePictureLight(width = 0.5) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.012), BRASS);
  g.add(plate);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 10), BRASS);
  arm.rotation.x = Math.PI / 2 - 0.35;
  arm.position.set(0, 0.02, 0.055);
  g.add(arm);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, width, 18, 1, true, 0, Math.PI), BRASS);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.045, 0.11);
  g.add(bar);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.006, 0.026), SHADE_MAT);
  glow.position.set(0, 0.032, 0.11);
  g.add(glow);
  return g;
}
