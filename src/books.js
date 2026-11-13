/* Bookcase carpentry, tactile PBR book geometry (spine cloth weave + paper
   striations + cover clearcoat), Open Library + `./covers/` loader, shelf
   decor props, brass wall lever, and 4-row Cover Exhibition arc animation. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM, CASE, SHELF_Y, damp } from './constants.js';
import { runtime, interactables, books, track } from './state.js';
import {
  WOOD,
  WOOD_DARK,
  BRASS,
  CERAMIC,
  TERRACOTTA,
  CLAY_SAGE,
  GLASS,
  makePlaque
} from './materials.js';
import {
  makeSucculent,
  makePotPlant,
  makeCandle,
  makeVase,
  makeFlatStack,
  makeFramedPrint,
  makePictureLight
} from './props.js';

export const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export function shelfTime(b) {
  const fin = String(b.fin || '');
  const yearMatch = fin.match(/\b(\d{4})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : (b.y || 9999);
  const monthMatch = fin.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
  const month = monthMatch ? (MONTHS[monthMatch[1]] + 1) : 0;
  return year * 100 + month;
}

function fictionRow(list) {
  const potter = list.filter((b) => HP_RE.test(b.t));
  const rest = list.filter((b) => !HP_RE.test(b.t)).sort((a, b) => shelfTime(a) - shelfTime(b));
  const before = rest.filter((b) => shelfTime(b) < 200100);
  const after = rest.filter((b) => shelfTime(b) >= 200100);
  return [...before, ...potter, ...after];
}

/* Shared subtle paper-edge striation texture for realistic page blocks */
function makePageBlockTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#EAE0CC';
  x.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    x.fillStyle = y % 4 === 0 ? 'rgba(90,70,45,0.08)' : 'rgba(255,252,245,0.09)';
    x.fillRect(0, y, 128, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PAGE_BLOCK_MAT = new THREE.MeshStandardMaterial({
  map: makePageBlockTexture(),
  roughness: 0.86,
  metalness: 0.0
});

export function makeSpineTexture(b, maxAnisotropy = 8) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 1024;
  const x = c.getContext('2d');

  // Rich cloth-grain spine fill
  x.fillStyle = b.c;
  x.fillRect(0, 0, 128, 1024);

  // Subtle woven bookcloth grain + spine crease highlights
  const grad = x.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0.0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.14, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  grad.addColorStop(0.86, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.24)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 1024);

  x.fillStyle = b.f;
  x.globalAlpha = 0.3;
  x.fillRect(16, 40, 96, 3);
  x.fillRect(16, 981, 96, 3);
  x.globalAlpha = 1;

  const shortA = (b.a || '').split('&')[0].trim().split(' ').slice(-1)[0];
  const maxW = 860;
  let size = 50;
  const fit = () => {
    x.font = `600 ${size}px Georgia, "Times New Roman", serif`;
    return x.measureText(b.t).width;
  };
  while (size > 30 && fit() > maxW) size -= 2;

  let lines = [b.t];
  if (fit() > maxW) {
    const words = b.t.split(' ');
    let l1 = '', l2 = '';
    for (const w of words) {
      const try1 = l1 ? `${l1} ${w}` : w;
      if (!l2 && x.measureText(try1).width <= maxW) l1 = try1;
      else l2 = l2 ? `${l2} ${w}` : w;
    }
    while (l2 && x.measureText(`${l2}…`).width > maxW) l2 = l2.slice(0, -1).trimEnd();
    if (x.measureText(l2).width > maxW) l2 = `${l2.slice(0, -2)}…`;
    lines = l2 ? [l1, l2] : [l1];
  }

  x.save();
  x.translate(64, 480);
  x.rotate(-Math.PI / 2);
  x.fillStyle = b.f;
  x.font = `600 ${size}px Georgia, "Times New Roman", serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (lines.length === 1) {
    x.fillText(lines[0], 0, 0);
  } else {
    const gap = size * 0.56;
    x.fillText(lines[0], 0, -gap);
    x.fillText(lines[1], 0, gap);
  }
  x.restore();

  x.save();
  x.translate(64, 948);
  x.rotate(-Math.PI / 2);
  x.fillStyle = b.f;
  x.globalAlpha = 0.78;
  x.font = '500 26px ui-sans-serif, system-ui, sans-serif';
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.fillText(shortA, 0, 0);
  x.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function makeCoverTexture(b, maxAnisotropy = 8) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  const x = c.getContext('2d');
  x.fillStyle = b.c;
  x.fillRect(0, 0, 512, 768);

  // Subtle jacket sheen gradient + spine hinge groove
  const grad = x.createLinearGradient(0, 0, 512, 768);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 512, 768);
  x.fillStyle = 'rgba(0,0,0,0.18)';
  x.fillRect(14, 0, 4, 768);

  x.strokeStyle = b.f;
  x.globalAlpha = 0.28;
  x.lineWidth = 3;
  x.strokeRect(36, 36, 440, 696);
  x.globalAlpha = 1;

  x.fillStyle = b.f;
  x.textAlign = 'center';
  x.font = '600 44px Georgia, serif';
  const words = b.t.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (x.measureText(t).width > 380 && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  const startY = 300 - (lines.length - 1) * 28;
  lines.forEach((l, idx) => x.fillText(l, 256, startY + idx * 56));

  x.globalAlpha = 0.78;
  x.font = '500 26px ui-sans-serif, system-ui, sans-serif';
  x.fillText(b.a || '', 256, 660);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function makeBookMaterials(b, maxAnisotropy = 8) {
  const spineMat = new THREE.MeshStandardMaterial({
    map: makeSpineTexture({ ...b, c: b.spineC || b.c, f: b.spineF || b.f }, maxAnisotropy),
    roughness: 0.68,
    metalness: 0.02
  });
  const coverMat = new THREE.MeshPhysicalMaterial({
    map: makeCoverTexture(b, maxAnisotropy),
    roughness: 0.44,
    metalness: 0.01,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: b.spineC || b.c,
    roughness: 0.64,
    metalness: 0.02
  });
  // BoxGeometry(th, h, depth) face order:
  // +x (front cover), -x (back cover), +y (top pages), -y (bottom pages), +z (spine), -z (fore-edge pages)
  return [coverMat, backMat, PAGE_BLOCK_MAT, PAGE_BLOCK_MAT, spineMat, PAGE_BLOCK_MAT];
}

function dominantSpineColor(img) {
  const s = document.createElement('canvas');
  s.width = s.height = 32;
  const g = s.getContext('2d');
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i], gr = d[i + 1], bl = d[i + 2];
    const mx = Math.max(r, gr, bl), mn = Math.min(r, gr, bl);
    if (mx > 242 && mn > 225) continue;
    if (mx < 22) continue;
    const key = ((r >> 4) << 8) | ((gr >> 4) << 4) | (bl >> 4);
    const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, sat: 0 };
    cur.n++; cur.r += r; cur.g += gr; cur.b += bl;
    cur.sat += (mx - mn) / (mx || 1);
    buckets.set(key, cur);
  }
  let best = null, bestScore = -1;
  for (const v of buckets.values()) {
    const score = v.n * (1 + 1.6 * (v.sat / v.n));
    if (score > bestScore) { bestScore = score; best = v; }
  }
  if (!best) return null;
  const r = Math.round(best.r / best.n);
  const gr = Math.round(best.g / best.n);
  const bl = Math.round(best.b / best.n);
  const lum = (0.2126 * r + 0.7152 * gr + 0.0722 * bl) / 255;
  return {
    bg: `rgb(${r},${gr},${bl})`,
    fg: lum > 0.54 ? '#1E1A16' : '#F6EFE4'
  };
}

/* Detail-drawer jacket. A reused <img> keeps painting the previous book's
   cover until the new src decodes, so stay hidden (swatch colour shows)
   until this exact URL has loaded. */
export function showDetailCover(url) {
  const el = document.getElementById('d-cover');
  if (!el) return;
  el.onload = null;
  el.style.display = 'none';
  if (!url) { el.removeAttribute('src'); return; }
  const want = new URL(url, location.href).href;
  el.onload = () => { if (el.src === want) el.style.display = 'block'; };
  // Same CORS mode as the 3D texture request, so the browser reuses that
  // cached download instead of fetching the jacket from Open Library again.
  if (/^https?:/i.test(url)) el.crossOrigin = 'anonymous';
  else el.removeAttribute('crossorigin');
  el.src = url;
  if (el.complete && el.naturalWidth > 0) el.style.display = 'block';
}

export function loadCover(b, mesh, maxAnisotropy = 8) {
  const src = b.cover || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg` : '');
  if (!src) return;
  const url = b.cover ? src : `${src}?default=false`;
  const img = new Image();
  // Remote `cover` URLs (guest Open Library ids) need CORS too, or WebGL
  // rejects the tainted image and the jacket renders black.
  if (!b.cover || /^https?:/i.test(b.cover)) img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (img.naturalWidth < 10 || img.naturalHeight < 10) return;
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;

    const mats = mesh.material;
    mats[0] = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.38,
      metalness: 0.01,
      clearcoat: 0.28,
      clearcoatRoughness: 0.32
    });
    if (!b.spineC) {
      try {
        const col = dominantSpineColor(img);
        if (col) {
          mats[4].map.dispose();
          mats[4].map = makeSpineTexture({ ...b, c: col.bg, f: col.fg }, maxAnisotropy);
          mats[4].needsUpdate = true;
          mats[1].color.set(col.bg);
          console.info(`[spine] ${JSON.stringify(b.t)} -> spineC: '${col.bg}', spineF: '${col.fg}'`);
        }
      } catch { /* canvas tainted if no CORS */ }
    }
    b.coverUrl = url;
    if (runtime.opened && runtime.opened.userData.book === b) showDetailCover(url);
  };
  img.src = url;
}

/* Cover Exhibition Arc Layout (People -> Non-Fiction -> Fiction -> Harry Potter) */
const COVER_ARC = { r: 3.15, span: 1.08, centerZ: 0.9 };
const COVER_GAP_PREF = 0.055;
const COVER_GAP_MIN = 0.014;
const COVER_V_GAP = 0.065;
const COVER_ROW_GAP = 0.095;
const COVER_FLOOR = 0.22;
const COVER_CEIL = 2.04;
const HP_RE = /^Harry Potter\b/i;

function layoutCoverRow(row, scale, span) {
  const maxArc = COVER_ARC.r * scale * span;
  const sumW = (arr) => arr.reduce((s, m) => s + m.userData.depth * scale, 0);
  const natural = sumW(row) + COVER_GAP_PREF * Math.max(0, row.length - 1);
  if (row.length <= 1 || natural <= maxArc) return [{ items: row, gap: COVER_GAP_PREF }];
  const minFit = sumW(row) + COVER_GAP_MIN * (row.length - 1);
  if (minFit <= maxArc) {
    return [{ items: row, gap: (maxArc - sumW(row)) / (row.length - 1) }];
  }
  const ranks = Math.ceil(minFit / maxArc);
  const per = Math.ceil(row.length / ranks);
  const out = [];
  for (let i = 0; i < row.length; i += per) {
    const slice = row.slice(i, i + per);
    const w = sumW(slice);
    const gap = slice.length > 1
      ? THREE.MathUtils.clamp((maxArc - w) / (slice.length - 1), COVER_GAP_MIN, COVER_GAP_PREF)
      : 0;
    out.push({ items: slice, gap });
  }
  return out;
}

export function computeCoverTargets(bookcase) {
  const shelfBooks = books.filter((m) => !m.userData.onTable);
  const people = [], other = [], fiction = [], potter = [];
  for (const m of shelfBooks) {
    const b = m.userData.book;
    if (b.row === 'people') people.push(m);
    else if (b.row === 'other') other.push(m);
    else if (HP_RE.test(b.t)) potter.push(m);
    else fiction.push(m);
  }
  const groups = [people, other, fiction, potter].filter((g) => g.length);
  if (!groups.length) return;

  const usableH = COVER_CEIL - COVER_FLOOR;
  let scale = 1, span = COVER_ARC.span, blocks, totalH;
  for (let pass = 0; pass < 4; pass++) {
    blocks = groups.map((g) => layoutCoverRow(g, scale, span));
    const rankHeights = blocks.map((ranks) =>
      ranks.map((rk) => Math.max(...rk.items.map((m) => m.userData.book.h * scale)))
    );
    const groupHeights = rankHeights.map((hs) =>
      hs.reduce((s, h) => s + h, 0) + COVER_V_GAP * (hs.length - 1)
    );
    totalH = groupHeights.reduce((s, h) => s + h, 0) + COVER_ROW_GAP * (groups.length - 1);
    if (totalH <= usableH) { blocks._heights = rankHeights; break; }
    if (pass === 0 && span < 1.3) { span = 1.3; continue; }
    scale *= (usableH / totalH) * 0.98;
    blocks._heights = rankHeights;
  }

  let yTop = (COVER_FLOOR + COVER_CEIL + totalH) / 2;
  const r = COVER_ARC.r;
  blocks.forEach((ranks, gi) => {
    ranks.forEach((rk, ri) => {
      const h = blocks._heights[gi][ri];
      const yCenter = yTop - h / 2;
      const widths = rk.items.map((m) => m.userData.depth * scale);
      const total = widths.reduce((s, w) => s + w, 0) + rk.gap * Math.max(0, rk.items.length - 1);
      let cursor = -total / 2;
      rk.items.forEach((m, idx) => {
        const s = cursor + widths[idx] / 2;
        cursor += widths[idx] + rk.gap;
        const theta = s / (r * scale);
        const worldPos = new THREE.Vector3(
          Math.sin(theta) * r,
          yCenter,
          COVER_ARC.centerZ - Math.cos(theta) * r
        );
        m.userData.coverPos = bookcase.worldToLocal(worldPos);
        m.userData.coverRotY = -Math.PI / 2 - theta;
        m.userData.coverScale = scale;
      });
      yTop -= h + COVER_V_GAP;
    });
    yTop += COVER_V_GAP - COVER_ROW_GAP;
  });
}

export function buildBookcaseAndBooks(scene, BOOKS, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* Dedicated clone of wood materials on the bookcase so Cover Exhibition Mode
     smoothly dims the case behind floating jackets without dimming other furniture. */
  const caseWood = WOOD.clone();
  const caseWoodDark = WOOD_DARK.clone();
  const caseWoodBase = caseWood.color.clone();
  const caseWoodDarkBase = caseWoodDark.color.clone();
  const caseWoodDim = caseWoodBase.clone().multiplyScalar(0.32);
  const caseWoodDarkDim = caseWoodDarkBase.clone().multiplyScalar(0.32);

  const bookcase = new THREE.Group();
  bookcase.position.set(0, 0, -ROOM.d / 2 + CASE.d / 2 + 0.03);
  scene.add(bookcase);

  const T = 0.028;
  function part(w, h, d, mat, x, y, z, bevel = 0.004) {
    const geo = bevel > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * 0.25, h * 0.25, d * 0.25))
      : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    bookcase.add(m);
    return m;
  }

  part(CASE.w, CASE.h, 0.016, caseWoodDark, 0, CASE.h / 2, -CASE.d / 2 + 0.008, 0);
  part(T, CASE.h, CASE.d, caseWood, -CASE.w / 2 + T / 2, CASE.h / 2, 0);
  part(T, CASE.h, CASE.d, caseWood, CASE.w / 2 - T / 2, CASE.h / 2, 0);
  part(CASE.w + 0.04, T * 1.2, CASE.d + 0.03, caseWood, 0, CASE.h + T * 0.6, 0.01);
  // Library picture light on the top front edge: the visible source of shelfGlow.
  const caseLight = makePictureLight(CASE.w * 0.55);
  caseLight.position.set(0, CASE.h - 0.05, CASE.d / 2 + 0.02);
  bookcase.add(caseLight);
  part(CASE.w - T * 2, 0.06, 0.02, caseWoodDark, 0, 0.03, CASE.d / 2 - 0.02);
  SHELF_Y.forEach((y) => part(CASE.w - T * 2, T, CASE.d - 0.016, caseWood, 0, y, 0.004));

  /* ---- Place Finished Books on Lower Three Shelves ---- */
  const innerW = CASE.w - T * 2 - 0.02;
  const rows = [
    { y: SHELF_Y[2], list: [] }, // people
    { y: SHELF_Y[1], list: [] }, // non-fiction
    { y: SHELF_Y[0], list: [] }  // fiction + HP
  ];
  const rowIndex = { people: 0, other: 1, fiction: 2 };
  const finished = BOOKS.filter((b) => !b.reading);
  rows[0].list = finished.filter((b) => b.row === 'people').sort((a, b) => shelfTime(a) - shelfTime(b));
  rows[1].list = finished.filter((b) => b.row === 'other').sort((a, b) => shelfTime(a) - shelfTime(b));
  rows[2].list = fictionRow(finished.filter((b) => b.row === 'fiction' || !(b.row in rowIndex)));

  const shelfRightX = [0, 0, 0];
  rows.forEach((row, sIdx) => {
    let x = -innerW / 2 + 0.025;
    row.list.forEach((b, i) => {
      const depth = 0.148 + ((i * 37) % 10) * 0.002;
      // Local +x is front cover, +z is spine:
      // - On shelf: rotation.y = 0 -> +z (spine) faces room (+Z)
      // - In cover mode: rotation.y = -Math.PI/2 - theta -> +x (front cover) faces room (+Z)!
      const geo = new RoundedBoxGeometry(b.th, b.h, depth, 2, Math.min(0.0025, b.th * 0.14));
      const mesh = new THREE.Mesh(geo, makeBookMaterials(b, maxAniso));
      mesh.rotation.y = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const bx = x + b.th / 2;
      const by = row.y + 0.014 + b.h / 2;
      const bz = CASE.d / 2 - depth / 2 - 0.018 + ((i * 53) % 7) * 0.0015;
      mesh.position.set(bx, by, bz);

      mesh.userData = {
        book: b,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        baseRotZ: ((i * 29) % 5 - 2) * 0.006,
        depth,
        pull: 0,
        targetPull: 0
      };
      bookcase.add(mesh);
      books.push(mesh);
      interactables.push(mesh);
      loadCover(b, mesh, maxAniso);
      x += b.th + 0.0025;
    });
    shelfRightX[sIdx] = x;
  });

  computeCoverTargets(bookcase);

  /* ---- Shelf Decor Props (Top Shelf + Right-Side Rests of Book Rows) ---- */
  const decorGroup = new THREE.Group();
  bookcase.add(decorGroup);
  const shelfTop = (idx) => SHELF_Y[idx] + 0.014;

  // Shelf 0 (bottom): succulent + candle pair
  {
    const y = shelfTop(0);
    const suc = makeSucculent(1.0, TERRACOTTA);
    suc.position.set(0.3, y, 0.03);
    decorGroup.add(suc);
    const c1 = makeCandle(0.095, 0.026);
    c1.position.set(0.49, y, 0.02);
    const c2 = makeCandle(0.065, 0.022);
    c2.position.set(0.56, y, 0.05);
    decorGroup.add(c1, c2);
  }

  // Shelf 1 (middle): flat stack + framed print + tinted glass bud vase
  {
    const y = shelfTop(1);
    const stack = makeFlatStack([
      { c: '#A68A6D', th: 0.026, w: 0.21, d: 0.15 },
      { c: '#3F5248', th: 0.022, w: 0.195, d: 0.145 },
      { c: '#C7B8A1', th: 0.018, w: 0.18, d: 0.14 }
    ]);
    stack.position.set(0.24, y, 0.02);
    decorGroup.add(stack);

    const frame = makeFramedPrint(0.16, 0.2, 'collect\nmoments');
    frame.position.set(0.47, y, -0.02);
    decorGroup.add(frame);

    const bud = makeVase({ h: 0.13, r: 0.034, mat: GLASS, stems: true });
    bud.position.set(0.58, y, 0.06);
    decorGroup.add(bud);
  }

  // Shelf 2 (people row): ceramic vase + small succulent
  {
    const y = shelfTop(2);
    const vase = makeVase({ h: 0.22, r: 0.052, mat: CERAMIC, stems: true });
    vase.position.set(0.32, y, 0.01);
    decorGroup.add(vase);

    const suc = makeSucculent(0.85, CERAMIC);
    suc.position.set(0.52, y, 0.04);
    decorGroup.add(suc);
  }

  // Shelf 3 (top display shelf): potted plant, flat stack + candle, print, terracotta vase
  {
    const y = shelfTop(3);
    const plant = makePotPlant(1.15, TERRACOTTA);
    plant.position.set(-0.5, y, 0.02);
    decorGroup.add(plant);

    const stack = makeFlatStack([
      { c: '#6E4E3A', th: 0.028, w: 0.22, d: 0.155 },
      { c: '#D8CBB6', th: 0.022, w: 0.205, d: 0.15 }
    ]);
    stack.position.set(-0.2, y, 0.02);
    decorGroup.add(stack);

    const topCandle = makeCandle(0.08, 0.024);
    topCandle.position.set(-0.2, y + 0.05, 0.02);
    decorGroup.add(topCandle);

    const frame = makeFramedPrint(0.19, 0.23, 'romanticize\nyour life');
    frame.position.set(0.12, y, -0.03);
    decorGroup.add(frame);

    const vase = makeVase({ h: 0.24, r: 0.058, mat: TERRACOTTA, stems: false });
    vase.position.set(0.42, y, 0.01);
    decorGroup.add(vase);

    const mini = makeSucculent(0.78, CLAY_SAGE);
    mini.position.set(0.58, y, 0.05);
    decorGroup.add(mini);
  }

  /* ---- Wall Lever + Plaque Left of Bookcase ---- */
  const wallSwitch = new THREE.Group();
  wallSwitch.position.set(-CASE.w / 2 - 0.32, 0, -ROOM.d / 2 + 0.014);
  scene.add(wallSwitch);

  const leverPlaque = makePlaque(
    [{ text: 'Float the books', heavy: true }, 'to view', '(press C)'],
    { w: 0.42, h: 0.3, depth: 0.022, font: 44 }
  );
  leverPlaque.position.set(0, 1.56, 0.011);
  wallSwitch.add(leverPlaque);

  const leverRig = new THREE.Group();
  leverRig.position.set(0, 1.18, 0);
  wallSwitch.add(leverRig);

  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.19, 0.016, 2, 0.003), WOOD_DARK);
  plate.position.z = 0.008;
  plate.castShadow = true;
  leverRig.add(plate);

  const trim = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.155, 0.006, 2, 0.002), BRASS);
  trim.position.z = 0.019;
  leverRig.add(trim);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.095, 0.008), caseWoodDark);
  slot.position.z = 0.022;
  leverRig.add(slot);

  const clevis = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 14), BRASS);
  clevis.rotation.z = Math.PI / 2;
  clevis.position.z = 0.028;
  leverRig.add(clevis);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0, 0, 0.028);
  leverPivot.rotation.x = 0.55;
  leverRig.add(leverPivot);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.008, 0.14, 12), BRASS);
  shaft.position.y = 0.07;
  shaft.castShadow = true;
  leverPivot.add(shaft);

  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), WOOD);
  grip.scale.set(1, 1.25, 1);
  grip.position.y = 0.145;
  grip.castShadow = true;
  leverPivot.add(grip);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), BRASS);
  cap.position.y = 0.168;
  leverPivot.add(cap);

  const leverHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.34, 0.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  leverHit.position.set(0, 0.02, 0.09);
  leverHit.userData.lever = true;
  leverRig.add(leverHit);
  interactables.push(leverHit);

  function toggleCoverMode(source = 'key', onCloseBook, onPlaySfx) {
    if (runtime.opened) onCloseBook?.();
    runtime.coverMode = !runtime.coverMode;
    runtime.shadowsDirty = true;
    onPlaySfx?.('lever');
    track('cover_mode_toggle', { enabled: runtime.coverMode, source });
  }

  function update(dt) {
    const prevCoverT = runtime.coverT;
    runtime.coverT = damp(runtime.coverT, runtime.coverMode ? 1 : 0, 5.5, dt);
    if (Math.abs(runtime.coverT - prevCoverT) > 0.004) {
      runtime.shadowsDirty = true;
    }

    leverPivot.rotation.x = THREE.MathUtils.lerp(0.55, 2.35, runtime.coverT);
    caseWood.color.lerpColors(caseWoodBase, caseWoodDim, runtime.coverT);
    caseWoodDark.color.lerpColors(caseWoodDarkBase, caseWoodDarkDim, runtime.coverT);
    decorGroup.visible = runtime.coverT < 0.85;
  }

  return {
    bookcase,
    wallSwitch,
    toggleCoverMode,
    update
  };
}
