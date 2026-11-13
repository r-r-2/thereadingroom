/* Shared Physically Based Rendering (PBR) material library for v2.
   Generates lightweight procedural micro-surface textures (plaster stipple,
   oak grain & plank seams, linen weave, brushed brass) once at startup so
   every surface responds realistically to HDRI IBL, soft shadows, and
   indoor practical lamps — with zero external texture network blocking. */

import * as THREE from 'three';

function heightToNormal(heightCanvas, strength = 1.6, repeatX = 1, repeatY = 1) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const dst = img.data;

  const sample = (x, y) => {
    const sx = ((x % w) + w) % w;
    const sy = ((y % h) + h) % h;
    return src[(sy * w + sx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function makePlasterMaps() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const v = 112 + Math.random() * 32;
    x.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  for (let i = 0; i < 90; i++) {
    const v = 120 + Math.random() * 18;
    x.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.18)`;
    x.beginPath();
    x.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 20, 0, Math.PI * 2);
    x.fill();
  }
  const normal = heightToNormal(c, 0.85, 5, 3);
  const rough = new THREE.CanvasTexture(c);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(5, 3);
  return { normal, rough };
}

function makeWoodGrainMaps(repeatX = 2, repeatY = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = 118 + Math.sin(y * 0.22) * 8 + (Math.random() - 0.5) * 14;
    x.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    x.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 160; i++) {
    const v = 104 + Math.random() * 36;
    x.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.35)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 36 + Math.random() * 80, 1.2);
  }
  const normal = heightToNormal(c, 0.7, repeatX, repeatY);

  // Colour grain: near-white base with long wavy darker streaks, a few dark
  // lines and soft tone bands. Multiplied by each wood material's colour, so
  // one texture serves oak, walnut, door and trim alike.
  const a = document.createElement('canvas');
  a.width = a.height = 256;
  const ax = a.getContext('2d');
  ax.fillStyle = 'rgb(238,236,232)';
  ax.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const band = Math.sin(y * 0.045) * 7 + Math.sin(y * 0.17 + 1.3) * 4;
    if (band < 0) {
      ax.fillStyle = `rgba(120,96,70,${(-band / 11) * 0.14})`;
      ax.fillRect(0, y, 256, 1);
    }
  }
  for (let i = 0; i < 70; i++) {
    const y0 = Math.random() * 256;
    const amp = 1 + Math.random() * 3;
    const freq = 0.01 + Math.random() * 0.02;
    const dark = Math.random() < 0.18;
    ax.strokeStyle = dark ? 'rgba(80,58,38,0.32)' : 'rgba(120,94,66,0.16)';
    ax.lineWidth = dark ? 0.9 : 0.6 + Math.random() * 1.4;
    ax.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const yy = y0 + Math.sin(x * freq + i) * amp;
      if (x === 0) ax.moveTo(x, yy); else ax.lineTo(x, yy);
    }
    ax.stroke();
  }
  const map = new THREE.CanvasTexture(a);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { normal, map };
}

function makeFabricNormal(repeatX = 6, repeatY = 6) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#7c7c7c';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 4) {
    x.fillStyle = 'rgba(255,255,255,0.16)';
    x.fillRect(i, 0, 2, 128);
    x.fillStyle = 'rgba(0,0,0,0.14)';
    x.fillRect(0, i, 128, 2);
  }
  return heightToNormal(c, 1.1, repeatX, repeatY);
}

export function makeFloorTextures(maxAnisotropy = 8) {
  const W = 1024, H = 1024;
  const albedoC = document.createElement('canvas');
  albedoC.width = W; albedoC.height = H;
  const ax = albedoC.getContext('2d');

  const heightC = document.createElement('canvas');
  heightC.width = W; heightC.height = H;
  const hx = heightC.getContext('2d');

  const roughC = document.createElement('canvas');
  roughC.width = W; roughC.height = H;
  const rx = roughC.getContext('2d');

  ax.fillStyle = '#c89b6d';
  ax.fillRect(0, 0, W, H);
  hx.fillStyle = '#888888';
  hx.fillRect(0, 0, W, H);
  rx.fillStyle = '#9e9e9e';
  rx.fillRect(0, 0, W, H);

  const planks = 8;
  const ph = H / planks;
  for (let i = 0; i < planks; i++) {
    const shade = (i % 3 - 1) * 8 + (Math.random() - 0.5) * 6;
    const r = Math.min(255, Math.max(0, 186 + shade));
    const g = Math.min(255, Math.max(0, 136 + shade * 0.82));
    const b = Math.min(255, Math.max(0, 88 + shade * 0.65));
    ax.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ax.fillRect(0, i * ph, W, ph - 2);

    const rVal = 142 + (i % 2) * 14 + (Math.random() - 0.5) * 12;
    rx.fillStyle = `rgb(${rVal | 0},${rVal | 0},${rVal | 0})`;
    rx.fillRect(0, i * ph, W, ph - 2);

    // Subtle longitudinal wood grain
    for (let k = 0; k < 55; k++) {
      const gy = i * ph + Math.random() * (ph - 4);
      const gw = 90 + Math.random() * 280;
      const gx = Math.random() * W;
      ax.fillStyle = k % 2 ? 'rgba(85,52,24,0.055)' : 'rgba(255,232,205,0.045)';
      ax.fillRect(gx, gy, gw, 1.5);
      hx.fillStyle = k % 2 ? 'rgba(115,115,115,0.35)' : 'rgba(150,150,150,0.35)';
      hx.fillRect(gx, gy, gw, 1.5);
    }

    // Plank bevel groove
    ax.fillStyle = 'rgba(72,44,20,0.38)';
    ax.fillRect(0, (i + 1) * ph - 2, W, 2);
    hx.fillStyle = '#363636';
    hx.fillRect(0, (i + 1) * ph - 3, W, 3);
    rx.fillStyle = '#dcdcdc';
    rx.fillRect(0, (i + 1) * ph - 3, W, 3);

    // Cross-butt joint per plank
    const jointX = ((i * 317 + 140) % (W - 120)) + 60;
    ax.fillStyle = 'rgba(72,44,20,0.28)';
    ax.fillRect(jointX, i * ph, 2, ph);
    hx.fillStyle = '#484848';
    hx.fillRect(jointX, i * ph, 2, ph);
  }

  const map = new THREE.CanvasTexture(albedoC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.5, 3.5);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.5, 3.5);

  const normalMap = heightToNormal(heightC, 1.45, 3.5, 3.5);

  return { map, normalMap, roughnessMap };
}

const plaster = makePlasterMaps();
const woodGrain = makeWoodGrainMaps(2, 2);
const fabricNormal = makeFabricNormal(8, 8);

export const WALL_MAT = new THREE.MeshStandardMaterial({
  color: 0xf4ece1,
  roughness: 0.9,
  metalness: 0.0,
  normalMap: plaster.normal,
  normalScale: new THREE.Vector2(0.18, 0.18)
});

export const CEIL_MAT = new THREE.MeshStandardMaterial({
  color: 0xfaf5ee,
  roughness: 0.94,
  metalness: 0.0,
  normalMap: plaster.normal,
  normalScale: new THREE.Vector2(0.1, 0.1)
});

export const TRIM_MAT = new THREE.MeshStandardMaterial({
  color: 0xefe5d6,
  roughness: 0.62,
  metalness: 0.0
});

export const WOOD = new THREE.MeshStandardMaterial({
  color: 0xb27a46,   // warm medium oak (x grain map)
  map: woodGrain.map,
  roughness: 0.56,
  metalness: 0.02,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.22, 0.22)
});

export const WOOD_DARK = new THREE.MeshStandardMaterial({
  color: 0x86593a,   // walnut accents
  map: woodGrain.map,
  roughness: 0.6,
  metalness: 0.02,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.24, 0.24)
});

export const DOOR_WOOD = new THREE.MeshStandardMaterial({
  color: 0x96673f,
  map: woodGrain.map,
  roughness: 0.52,
  metalness: 0.02,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.22, 0.22)
});

export const DOOR_RECESS = new THREE.MeshStandardMaterial({
  color: 0x744d30,
  map: woodGrain.map,
  roughness: 0.62,
  metalness: 0.02,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.22, 0.22)
});

export const DOOR_TRIM = new THREE.MeshStandardMaterial({
  color: 0xa2744a,
  map: woodGrain.map,
  roughness: 0.5,
  metalness: 0.02
});

export const BRASS = new THREE.MeshStandardMaterial({
  color: 0xd1ad6e,
  roughness: 0.28,
  metalness: 0.86
});

export const METAL = new THREE.MeshStandardMaterial({
  color: 0xb8b4ae,
  roughness: 0.3,
  metalness: 0.85
});

export const FELT = new THREE.MeshStandardMaterial({
  color: 0x28272b,
  roughness: 0.92,
  metalness: 0.0
});

export const PLINTH = new THREE.MeshStandardMaterial({
  color: 0xa06f44,
  roughness: 0.44,
  metalness: 0.04,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.2, 0.2)
});

export const CERAMIC = new THREE.MeshPhysicalMaterial({
  color: 0xede3d3,
  roughness: 0.32,
  metalness: 0.0,
  clearcoat: 0.55,
  clearcoatRoughness: 0.22
});

export const TERRACOTTA = new THREE.MeshStandardMaterial({
  color: 0xc27b56,
  roughness: 0.78,
  metalness: 0.0
});

export const CLAY_SAGE = new THREE.MeshPhysicalMaterial({
  color: 0x9aa893,
  roughness: 0.42,
  clearcoat: 0.35,
  clearcoatRoughness: 0.3
});

export const CLAY_OCHRE = new THREE.MeshStandardMaterial({
  color: 0xc99c62,
  roughness: 0.68,
  metalness: 0.0
});

export const STONE_DARK = new THREE.MeshStandardMaterial({
  color: 0x4a463f,
  roughness: 0.74,
  metalness: 0.06
});

export const GLASS = new THREE.MeshPhysicalMaterial({
  color: 0xe6eff0,
  roughness: 0.08,
  metalness: 0.0,
  transmission: 0.78,
  ior: 1.5,
  thickness: 0.02,
  transparent: true,
  opacity: 0.88
});

export const WINDOW_GLASS = new THREE.MeshPhysicalMaterial({
  color: 0xf4f9fc,
  roughness: 0.06,
  metalness: 0.0,
  reflectivity: 0.65,
  clearcoat: 0.9,
  clearcoatRoughness: 0.06,
  transparent: true,
  opacity: 0.14,
  depthWrite: false
});

export const LINEN = new THREE.MeshPhysicalMaterial({
  color: 0xd8cab4,
  roughness: 0.86,
  sheen: 0.65,
  sheenRoughness: 0.75,
  sheenColor: new THREE.Color(0xf5ecde),
  normalMap: fabricNormal,
  normalScale: new THREE.Vector2(0.22, 0.22)
});

export const PILLOW_RUST = new THREE.MeshPhysicalMaterial({
  color: 0xb06a4c,
  roughness: 0.82,
  sheen: 0.75,
  sheenRoughness: 0.65,
  sheenColor: new THREE.Color(0xe0a286),
  normalMap: fabricNormal,
  normalScale: new THREE.Vector2(0.24, 0.24)
});

export const PILLOW_SAGE = new THREE.MeshPhysicalMaterial({
  color: 0x7e8f76,
  roughness: 0.82,
  sheen: 0.7,
  sheenRoughness: 0.68,
  sheenColor: new THREE.Color(0xb8c8b0),
  normalMap: fabricNormal,
  normalScale: new THREE.Vector2(0.24, 0.24)
});

export const PILLOW_CREAM = new THREE.MeshPhysicalMaterial({
  color: 0xe8ddca,
  roughness: 0.84,
  sheen: 0.65,
  sheenRoughness: 0.72,
  sheenColor: new THREE.Color(0xfff8ec),
  normalMap: fabricNormal,
  normalScale: new THREE.Vector2(0.2, 0.2)
});

export const SHADE_MAT = new THREE.MeshStandardMaterial({
  color: 0xf4dcb2,
  emissive: new THREE.Color(0xffb86b),
  emissiveIntensity: 0.06,
  roughness: 0.72,
  side: THREE.DoubleSide
});

export const WAX = new THREE.MeshPhysicalMaterial({
  color: 0xf4ead8,
  roughness: 0.48,
  transmission: 0.15,
  thickness: 0.04,
  emissive: new THREE.Color(0xff9e44),
  emissiveIntensity: 0.0
});

export const PAGE_MAT = new THREE.MeshStandardMaterial({
  color: 0xe8dec8,
  roughness: 0.86,
  metalness: 0.0
});

export const LEATHER = new THREE.MeshStandardMaterial({
  color: 0x5a3a2a,
  roughness: 0.55,
  metalness: 0.04
});

export const BOOKMARK_MAT = new THREE.MeshPhysicalMaterial({
  color: 0x8b3a3a,
  roughness: 0.52,
  sheen: 0.8,
  sheenRoughness: 0.4,
  sheenColor: new THREE.Color(0xd46a6a)
});

export const GALLERY_FRAME = new THREE.MeshStandardMaterial({
  color: 0xc9b48a,
  roughness: 0.52,
  metalness: 0.02,
  normalMap: woodGrain.normal,
  normalScale: new THREE.Vector2(0.18, 0.18)
});

export const GALLERY_REBATE = new THREE.MeshStandardMaterial({
  color: 0xefe7d8,
  roughness: 0.82,
  metalness: 0.0
});

export const PLANT_A = new THREE.MeshStandardMaterial({ color: 0x6b8f6b, roughness: 0.64 });
export const PLANT_B = new THREE.MeshStandardMaterial({ color: 0x88a87e, roughness: 0.62 });
export const PLANT_C = new THREE.MeshStandardMaterial({ color: 0x527256, roughness: 0.66 });
export const SOIL = new THREE.MeshStandardMaterial({ color: 0x5c4636, roughness: 0.94 });

/* Reusable framed cream plaque with centred typography (used for wall lever
   plaque, guest-table standing sign, ghost card, and pending approval tags). */
export function makePlaque(lines, {
  w = 0.36,
  h = 0.26,
  depth = 0.02,
  font = 42,
  ink = '#5C4E40',
  frameMat = WOOD
} = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const x = c.getContext('2d');
  x.fillStyle = '#F7F1E7';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = ink;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const lineH = font * 1.38;
  const y0 = c.height / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    const heavy = typeof line !== 'string';
    const text = heavy ? line.text : line;
    x.font = `${heavy ? 700 : 600} ${heavy ? Math.round(font * 1.12) : font}px ui-sans-serif, system-ui, sans-serif`;
    x.fillText(text, c.width / 2, y0 + i * lineH);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), frameMat);
  frame.castShadow = depth >= 0.015;
  frame.receiveShadow = true;
  const margin = Math.min(0.02, w * 0.06);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w - margin * 2, h - margin * 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.0 })
  );
  art.position.z = depth / 2 + 0.001;
  frame.add(art);
  return frame;
}
