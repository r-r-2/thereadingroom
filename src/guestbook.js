/* Guest recommendations table (front wall +Z, right of the entry door):
   - Beveled oak table + two wall-mounted picture ledges above it
   - Embossed leather ledger with animated page-opening blocks (`ledgerOpenT`)
   - Refractive dark-glass inkwell + brass collar + animated writing quill
   - Standing framed sign ("Recommend a book for me / Click the quill")
   - Dashed ghost book slot ("your book goes here")
   - Pending approval floating tags + Swaa always-on-table priority rule
   - Cloudflare Worker POST + GitHub Issues pending fetch + Open Library ISBN lookup
   - Cream two-page open-book overlay UI (Form mode & Ledger/Waiting mode) */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  HOST_NAME,
  GUEST_RELAY_URL,
  GUEST_REPO,
  GUEST_MAX_PER_IP,
  GUEST_MAX_ON_TABLE,
  GUEST_ON_TABLE,
  GUEST_ALWAYS_ON_TABLE,
  GUEST_PENDING_ON_TABLE,
  GUEST_LS_KEY,
  GUEST_SEEN_KEY,
  GUEST_TABLE,
  GUEST_LEDGE,
  damp
, GUEST_LAMP, LAMP_SCALE } from './constants.js';
import { runtime, interactables, books, track } from './state.js';
import { WOOD, WOOD_DARK, BRASS, LEATHER, PAGE_MAT, GLASS, makePlaque } from './materials.js';
import { makeTableLamp } from './props.js';
import { makeBookMaterials, loadCover } from './books.js';

const RELAY_LIVE = Boolean(GUEST_RELAY_URL) && !GUEST_RELAY_URL.includes('YOUR-SUBDOMAIN');

export function buildGuestbookSystem(scene, GUESTS, renderer, hooks) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const guestTable = new THREE.Group();
  guestTable.position.set(GUEST_TABLE.x, 0, GUEST_TABLE.z);
  guestTable.rotation.y = Math.PI;
  scene.add(guestTable);

  // Small lamp at the free end: the visible source of the guest-table glow.
  const guestLamp = makeTableLamp(LAMP_SCALE);
  guestLamp.position.set(GUEST_LAMP.x, GUEST_TABLE.h, GUEST_LAMP.z);
  guestLamp.rotation.y = -0.3;
  guestTable.add(guestLamp);

  /* ---- 1. Beveled Oak Table & Stretcher ---- */
  const topT = 0.034;
  const top = new THREE.Mesh(
    new RoundedBoxGeometry(GUEST_TABLE.w, topT, GUEST_TABLE.d, 3, 0.006),
    WOOD
  );
  top.position.y = GUEST_TABLE.h - topT / 2;
  top.castShadow = true;
  top.receiveShadow = true;
  top.userData.guestAdd = true;
  guestTable.add(top);
  interactables.push(top);

  const apronH = 0.06, apronT = 0.022, inset = 0.06;
  const apronY = GUEST_TABLE.h - topT - apronH / 2;
  for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(GUEST_TABLE.w - inset * 2, apronH, apronT), WOOD_DARK);
    a.position.set(0, apronY, sz * (GUEST_TABLE.d / 2 - inset));
    a.castShadow = true;
    guestTable.add(a);
  }
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(apronT, apronH, GUEST_TABLE.d - inset * 2), WOOD_DARK);
    a.position.set(sx * (GUEST_TABLE.w / 2 - inset), apronY, 0);
    a.castShadow = true;
    guestTable.add(a);
  }
  const legH = GUEST_TABLE.h - topT;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, legH, 14), WOOD_DARK);
      leg.position.set(sx * (GUEST_TABLE.w / 2 - inset), legH / 2, sz * (GUEST_TABLE.d / 2 - inset));
      leg.castShadow = true;
      leg.receiveShadow = true;
      guestTable.add(leg);
    }
  }
  const stretcher = new THREE.Mesh(new THREE.BoxGeometry(GUEST_TABLE.w - inset * 2, 0.022, 0.04), WOOD_DARK);
  stretcher.position.set(0, 0.18, 0);
  guestTable.add(stretcher);

  /* ---- 2. Two Wall-Mounted Picture Ledges Above Guest Table ---- */
  const guestLedge = new THREE.Group();
  guestLedge.visible = false;
  guestTable.add(guestLedge);
  {
    const { w, d, t, y: ys, wallZ } = GUEST_LEDGE;
    const lipH = 0.028, backH = 0.055;
    for (const ry of ys) {
      const rail = new THREE.Group();
      rail.position.set(0, ry, wallZ);
      const back = new THREE.Mesh(new RoundedBoxGeometry(w, backH, t * 0.7, 2, 0.003), WOOD_DARK);
      back.position.set(0, backH / 2 - t / 2, t * 0.35);
      const base = new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 2, 0.003), WOOD);
      base.position.set(0, 0, d / 2);
      base.castShadow = true;
      base.receiveShadow = true;
      const lip = new THREE.Mesh(new RoundedBoxGeometry(w, lipH, t * 0.7, 2, 0.003), WOOD_DARK);
      lip.position.set(0, lipH / 2 - t / 2, d - t * 0.35);
      rail.add(back, base, lip);
      guestLedge.add(rail);
    }
  }

  /* ---- 3. Embossed Open Leather Ledger ---- */
  const ledger = new THREE.Group();
  ledger.position.set(0.62, GUEST_TABLE.h, 0.04);
  ledger.rotation.y = -0.16;
  guestTable.add(ledger);

  const pageTexL = makeLedgerPageTex('Guestbook', []);
  const pageTexR = makeLedgerPageTex('Waiting', []);
  const pageFaceL = new THREE.MeshStandardMaterial({ map: pageTexL, roughness: 0.8 });
  const pageFaceR = new THREE.MeshStandardMaterial({ map: pageTexR, roughness: 0.8 });

  const pw = 0.165, pd = 0.225, pth = 0.014;
  const ledgerBlocks = [];
  for (const s of [-1, 1]) {
    const board = new THREE.Mesh(new RoundedBoxGeometry(pw + 0.014, 0.005, pd + 0.016, 2, 0.002), LEATHER);
    board.position.set(s * (pw / 2 + 0.004), 0.0025, 0);
    board.rotation.z = s * -0.045;
    board.castShadow = true;
    ledger.add(board);

    const mats = [PAGE_MAT, PAGE_MAT, s < 0 ? pageFaceL : pageFaceR, PAGE_MAT, PAGE_MAT, PAGE_MAT];
    const block = new THREE.Mesh(new THREE.BoxGeometry(pw, pth, pd), mats);
    block.position.set(s * (pw / 2 + 0.003), 0.005 + pth / 2, 0);
    block.rotation.z = s * -0.045;
    block.castShadow = true;
    ledger.add(block);
    ledgerBlocks.push({ board, block, s });
  }

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, pd + 0.016, 12), LEATHER);
  spine.rotation.x = Math.PI / 2;
  spine.position.y = 0.008;
  ledger.add(spine);

  const gutter = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.003, pd - 0.008),
    new THREE.MeshStandardMaterial({ color: 0xb9aa92, roughness: 0.9 })
  );
  gutter.position.y = 0.006 + pth;
  ledger.add(gutter);

  const ledgerHit = new THREE.Mesh(
    new THREE.BoxGeometry(pw * 2 + 0.05, 0.05, pd + 0.04),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ledgerHit.position.y = 0.02;
  ledgerHit.userData.guestbook = true;
  ledger.add(ledgerHit);
  interactables.push(ledgerHit);

  /* ---- 4. Refractive Dark-Glass Inkwell + Brass Collar + Animated Quill ---- */
  const inkMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e2430,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    transmission: 0.35,
    ior: 1.52
  });
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.032, 16), inkMat);
  well.position.set(0.84, GUEST_TABLE.h + 0.016, -0.09);
  well.castShadow = true;
  guestTable.add(well);

  const wellRim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.004, 8, 18), BRASS);
  wellRim.rotation.x = Math.PI / 2;
  wellRim.position.set(0.84, GUEST_TABLE.h + 0.033, -0.09);
  guestTable.add(wellRim);

  const quill = new THREE.Group();
  quill.position.set(0.84, GUEST_TABLE.h + 0.03, -0.09);
  quill.rotation.set(-0.35, 0.4, -0.55);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0018, 0.004, 0.19, 8),
    new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.65 })
  );
  shaft.position.y = 0.095;
  const vane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.032, 0.13),
    new THREE.MeshPhysicalMaterial({
      color: 0xf7efe0,
      roughness: 0.72,
      sheen: 0.6,
      side: THREE.DoubleSide
    })
  );
  vane.position.set(0.008, 0.125, 0);
  vane.rotation.z = -0.08;
  quill.add(shaft, vane);
  guestTable.add(quill);

  const quillHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  quillHit.position.set(0.84, GUEST_TABLE.h + 0.1, -0.09);
  quillHit.userData.guestAdd = true;
  guestTable.add(quillHit);
  interactables.push(quillHit);

  /* ---- 5. Standing Framed Sign & Ghost Slot ---- */
  const guestSign = makePlaque(
    [{ text: 'Recommend a book for me', heavy: true }, 'Click the quill'],
    { w: 0.44, h: 0.17, depth: 0.014, font: 30, frameMat: WOOD_DARK }
  );
  guestSign.position.set(0.62, GUEST_TABLE.h + 0.085, -0.22);
  guestSign.rotation.x = -0.22;
  guestSign.userData.guestAdd = true;
  guestSign.traverse((o) => { o.userData.guestAdd = true; });
  guestTable.add(guestSign);
  interactables.push(guestSign);

  const easelFoot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.012), WOOD_DARK);
  easelFoot.position.set(0.62, GUEST_TABLE.h + 0.05, -0.255);
  easelFoot.rotation.x = 0.42;
  guestTable.add(easelFoot);

  const ghostSlot = new THREE.Group();
  ghostSlot.position.set(-0.66, GUEST_TABLE.h + 0.002, 0.06);
  ghostSlot.rotation.y = 0.09;
  guestTable.add(ghostSlot);
  {
    const gw = 0.16, gh = 0.215;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 344;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(245,232,208,.78)';
    x.lineWidth = 5;
    x.setLineDash([14, 10]);
    x.strokeRect(10, 10, 236, 324);
    x.setLineDash([]);
    x.fillStyle = 'rgba(245,232,208,.92)';
    x.textAlign = 'center';
    x.font = '600 58px Georgia, serif';
    x.fillText('+', 128, 152);
    x.font = 'italic 22px Georgia, serif';
    x.fillText('your book', 128, 210);
    x.fillText('goes here', 128, 238);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(gw, gh),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    card.rotation.x = -Math.PI / 2;
    ghostSlot.add(card);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(gw + 0.04, 0.05, gh + 0.04),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.02;
    hit.userData.guestAdd = true;
    ghostSlot.add(hit);
    interactables.push(hit);
  }

  /* ---- 6. Guest Data, Local Pending Storage & Slot Placement ---- */
  function makeLedgerPageTex(heading, lines) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 680;
    const x = c.getContext('2d');
    x.fillStyle = '#F5ECDA';
    x.fillRect(0, 0, 512, 680);
    x.strokeStyle = 'rgba(120,92,60,.18)';
    x.lineWidth = 1;
    for (let y = 130; y < 640; y += 34) {
      x.beginPath(); x.moveTo(44, y); x.lineTo(468, y); x.stroke();
    }
    x.fillStyle = '#4A3828';
    x.font = 'italic 600 34px Georgia, serif';
    x.fillText(heading, 48, 82);
    x.strokeStyle = 'rgba(90,64,40,.35)';
    x.beginPath(); x.moveTo(48, 96); x.lineTo(464, 96); x.stroke();
    x.font = '22px Georgia, serif';
    lines.slice(0, 14).forEach((ln, i) => {
      x.fillStyle = ln.pending ? 'rgba(90,70,50,.55)' : '#3E2F20';
      const txt = `${ln.t}  — ${ln.by}`;
      x.fillText(txt.length > 34 ? `${txt.slice(0, 33)}…` : txt, 48, 126 + i * 34);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const GUEST_SLOTS = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      GUEST_SLOTS.push({
        x: -0.42 + col * 0.34 + (row ? 0.05 : 0),
        z: -0.13 + row * 0.25,
        yaw: ((col * 3 + row * 5) % 7 - 3) * 0.045
      });
    }
  }
  const guestMeshes = [];
  const guestStackTop = new Array(GUEST_SLOTS.length).fill(GUEST_TABLE.h);
  const pendingTags = [];
  let remotePending = [];

  function guestPalette(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    const Sw = [
      ['#2C3E4F', '#F2E9DC'], ['#5B3A2E', '#F5EADB'], ['#3D4F3E', '#EFE8D8'],
      ['#6B4E71', '#F6EEF2'], ['#7A4B2A', '#F7ECDC'], ['#2F4F4F', '#EDE6D6'],
      ['#4A3728', '#F2E6D4'], ['#8C3B32', '#F9EFE6']
    ];
    return Sw[Math.abs(h) % Sw.length];
  }

  function loadMine() {
    try { return JSON.parse(localStorage.getItem(GUEST_LS_KEY) || '[]'); }
    catch { return []; }
  }
  function saveMine(arr) {
    try { localStorage.setItem(GUEST_LS_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  }
  function normKey(t, by) {
    return `${(t || '').toLowerCase().trim()}|${(by || '').toLowerCase().trim()}`;
  }

  function addPendingTag(wrap, th) {
    const tag = makePlaque(['awaiting', 'approval'], {
      w: 0.115, h: 0.058, depth: 0.005, font: 58, ink: '#6B5334', frameMat: BRASS
    });
    const baseY = th / 2 + 0.055;
    tag.position.set(0, baseY, 0);
    tag.rotation.x = -0.35;
    wrap.add(tag);
    pendingTags.push({ mesh: tag, baseY, phase: pendingTags.length * 1.7 });
  }

  function toGuestBook(g, pending) {
    const [c, f] = guestPalette((g.t || '') + (g.by || ''));
    return {
      t: g.t, a: g.a || '', c: g.c || c, f: g.f || f,
      th: g.th || 0.024, h: g.h || 0.212,
      isbn: g.isbn || '', cover: g.cover || '',
      spineC: g.spineC, spineF: g.spineF,
      guest: true, pending,
      guestBy: g.by || 'Anonymous',
      guestAt: g.at || '',
      note: pending
        ? `Left by ${g.by || 'a visitor'} · awaiting ${HOST_NAME}'s approval`
        : `Recommended by ${g.by || 'a visitor'}`,
      review: g.why || ''
    };
  }

  function layBookOnTable(g, { pending = false } = {}) {
    const idx = guestMeshes.length;
    if (idx >= GUEST_MAX_ON_TABLE) return null;
    const b = toGuestBook(g, pending);
    const depth = 0.152;
    const geo = new RoundedBoxGeometry(b.th, b.h, depth, 2, Math.min(0.0025, b.th * 0.14));
    const mats = makeBookMaterials(b, maxAniso);
    const mesh = new THREE.Mesh(geo, mats);
    // +π/2 lays the +x front cover face-up (spine on the left); the wrap yaw
    // of -π/2 then turns the book's top away from the viewer so it reads upright.
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const sIdx = idx % GUEST_SLOTS.length;
    const slot = GUEST_SLOTS[sIdx];
    const baseY = guestStackTop[sIdx] + b.th / 2;
    guestStackTop[sIdx] = baseY + b.th / 2;
    const stacked = idx >= GUEST_SLOTS.length;
    const yaw = -Math.PI / 2 + slot.yaw + (stacked ? (idx % 2 ? -0.16 : 0.13) : 0);

    const wrap = new THREE.Group();
    wrap.position.set(slot.x, baseY, slot.z);
    wrap.rotation.y = yaw;
    wrap.add(mesh);
    if (pending) addPendingTag(wrap, b.th);

    mesh.userData = {
      book: b,
      onTable: true,
      onGuestTable: true,
      tableRoot: wrap,
      baseX: slot.x, baseY, baseZ: slot.z, baseYaw: yaw,
      depth, pull: 0, targetPull: 0
    };
    guestTable.add(wrap);
    books.push(mesh);
    interactables.push(mesh);
    guestMeshes.push(mesh);
    loadCover(b, mesh, maxAniso);
    return mesh;
  }

  function trimForLedge(list, cap) {
    if (list.length <= cap) return list;
    const drop = new Set();
    while (list.length - drop.size > cap) {
      const counts = new Map();
      let max = 0;
      list.forEach((g, i) => {
        if (drop.has(i)) return;
        const k = (g.by || '').toLowerCase().trim();
        const n = (counts.get(k) || 0) + 1;
        counts.set(k, n);
        if (n > max) max = n;
      });
      const victim = list.findIndex((g, i) =>
        !drop.has(i) && counts.get((g.by || '').toLowerCase().trim()) === max
      );
      drop.add(victim);
    }
    return list.filter((_, i) => !drop.has(i));
  }

  function standBooksOnLedge(entries) {
    const { w, d, t, y: ys, perRail, gap, lean, wallZ } = GUEST_LEDGE;
    const usable = w - 0.1;
    const list = trimForLedge(entries, perRail * ys.length);
    guestLedge.visible = list.length > 0;
    for (let r = 0; r < ys.length; r++) {
      const row = list.slice(r * perRail, (r + 1) * perRail);
      if (!row.length) continue;
      const depth = 0.15;
      const step = Math.min(depth + gap, usable / row.length);
      const startX = -((row.length - 1) * step) / 2;
      const jitter = row.length * (depth + gap) > usable;
      row.forEach((g, i) => {
        const b = toGuestBook(g, false);
        const geo = new RoundedBoxGeometry(b.th, b.h, depth, 2, Math.min(0.0025, b.th * 0.14));
        const mesh = new THREE.Mesh(geo, makeBookMaterials(b, maxAniso));
        mesh.rotation.y = -Math.PI / 2;
        mesh.rotation.z = lean;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const x = startX + i * step;
        const baseY = ys[r] + t / 2 + (b.h / 2) * Math.cos(lean);
        const zJit = jitter ? (i % 2) * (b.th + 0.004) : 0;
        const baseZ = wallZ + d - 0.022 - b.th / 2 - (b.h / 2) * Math.sin(lean) - zJit;
        const baseYaw = ((i * 5 + r * 3) % 5 - 2) * 0.025;

        const wrap = new THREE.Group();
        wrap.position.set(x, baseY, baseZ);
        wrap.rotation.y = baseYaw;
        wrap.add(mesh);

        mesh.userData = {
          book: b,
          onTable: true,
          onGuestLedge: true,
          tableRoot: wrap,
          baseX: x, baseY, baseZ, baseYaw,
          depth, pull: 0, targetPull: 0
        };
        guestTable.add(wrap);
        books.push(mesh);
        interactables.push(mesh);
        guestMeshes.push(mesh);
        loadCover(b, mesh, maxAniso);
      });
    }
  }

  function clearGuestMeshes() {
    if (runtime.opened && guestMeshes.includes(runtime.opened)) hooks.closeBook?.();
    for (const m of guestMeshes) {
      guestTable.remove(m.userData.tableRoot);
      const bi = books.indexOf(m); if (bi >= 0) books.splice(bi, 1);
      const ii = interactables.indexOf(m); if (ii >= 0) interactables.splice(ii, 1);
    }
    guestMeshes.length = 0;
    pendingTags.length = 0;
    guestStackTop.fill(GUEST_TABLE.h);
  }

  function allWaiting() {
    const shelved = new Set(GUESTS.map((g) => normKey(g.t, g.by)));
    const seen = new Set();
    const out = [];
    for (const m of [...loadMine(), ...remotePending]) {
      const k = normKey(m.t, m.by);
      if (shelved.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
    return out;
  }

  function redrawLedger() {
    pageFaceL.map.dispose();
    pageFaceR.map.dispose();
    pageFaceL.map = makeLedgerPageTex('Guestbook', GUESTS.slice().reverse());
    const waiting = allWaiting().map((m) => ({ ...m, pending: true }));
    pageFaceR.map = makeLedgerPageTex(
      waiting.length ? 'Waiting' : 'Leave yours →',
      waiting.length ? waiting : [{ t: 'Click the quill to add a book', by: HOST_NAME, pending: true }]
    );
    pageFaceL.needsUpdate = pageFaceR.needsUpdate = true;
  }

  function rebuildGuestBooks() {
    clearGuestMeshes();
    const shelvedKeys = new Set(GUESTS.map((g) => normKey(g.t, g.by)));
    const mine = loadMine().filter((m) => !shelvedKeys.has(normKey(m.t, m.by)));
    saveMine(mine);

    const pinned = new Set();
    for (const who of GUEST_ALWAYS_ON_TABLE) {
      const w = who.toLowerCase();
      for (let i = GUESTS.length - 1; i >= 0; i--) {
        if ((GUESTS[i].by || '').toLowerCase().trim() === w) { pinned.add(i); break; }
      }
    }
    const onTableSet = new Set(pinned);
    for (let i = GUESTS.length - 1; i >= 0 && onTableSet.size < GUEST_ON_TABLE; i--) {
      onTableSet.add(i);
    }
    const ledgeEntries = GUESTS.filter((_, i) => !onTableSet.has(i));
    const tableEntries = GUESTS.filter((_, i) => onTableSet.has(i));

    standBooksOnLedge(ledgeEntries);
    for (const g of tableEntries) layBookOnTable(g, { pending: false });
    for (const m of mine) layBookOnTable(m, { pending: true });

    if (GUEST_PENDING_ON_TABLE) {
      const mineKeys = new Set(mine.map((m) => normKey(m.t, m.by)));
      for (const p of remotePending) {
        if (!shelvedKeys.has(normKey(p.t, p.by)) && !mineKeys.has(normKey(p.t, p.by))) {
          layBookOnTable(p, { pending: true });
        }
      }
    }
    ghostSlot.visible = guestMeshes.length < GUEST_MAX_ON_TABLE;
    redrawLedger();
    runtime.shadowsDirty = true;
  }

  rebuildGuestBooks();

  /* ---- 7. Deferred Network Sync (GitHub Issues Pending + Worker Health) ---- */
  function parseIssueBody(issue) {
    const body = issue?.body || '';
    const jsonMatch = body.match(/<!-- rr-guest -->\s*```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const j = JSON.parse(jsonMatch[1]);
        if (j.t) {
          return {
            id: issue.number,
            t: String(j.t),
            a: String(j.a || ''),
            isbn: String(j.isbn || '').replace(/[^0-9Xx]/g, ''),
            by: String(j.by || 'Anonymous'),
            why: String(j.why || ''),
            cover: String(j.cover || '')
          };
        }
      } catch { /* fallback below */ }
    }
    const grab = (label) => {
      const m = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`).exec(body);
      return m ? m[1].trim() : '';
    };
    const whyM = /\n\n([\s\S]+?)\n\n---/.exec(body);
    return {
      id: issue.number,
      t: grab('Title'),
      a: grab('Author'),
      isbn: grab('ISBN').replace(/[^0-9Xx]/g, ''),
      by: grab('From') || 'Anonymous',
      why: whyM ? whyM[1].trim() : ''
    };
  }

  async function fetchRemotePending() {
    try {
      const url = `https://api.github.com/repos/${GUEST_REPO}/issues?labels=recommendation&state=open&per_page=30`;
      const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) return;
      const issues = await r.json();
      const openNumbers = new Set();
      remotePending = issues
        .filter((it) => !it.pull_request && !it.labels.some((l) => l.name === 'approved'))
        .map((it) => {
          openNumbers.add(it.number);
          return { ...parseIssueBody(it), issue: it.number, at: (it.created_at || '').slice(0, 10) };
        })
        .filter((x) => x.t);

      const shelved = new Set(GUESTS.map((g) => normKey(g.t, g.by)));
      const shelvedIds = new Set(GUESTS.map((g) => g.id).filter(Boolean));
      const before = loadMine();
      const after = before.filter((m) => {
        const num = m.issue || m.id;
        return !num || openNumbers.has(num) || shelvedIds.has(num) || shelved.has(normKey(m.t, m.by));
      });
      if (after.length !== before.length) saveMine(after);

      if (GUEST_PENDING_ON_TABLE || after.length !== before.length) rebuildGuestBooks();
      else redrawLedger();
    } catch { /* offline / rate-limited */ }
  }

  let serverRemaining = null;
  async function refreshRemaining() {
    if (!RELAY_LIVE) return;
    try {
      const r = await fetch(GUEST_RELAY_URL);
      if (r.ok) {
        const j = await r.json();
        if (typeof j.remaining === 'number') serverRemaining = j.remaining;
      }
    } catch { /* ignore */ }
  }

  function startNetworkSync() {
    fetchRemotePending();
    refreshRemaining();
  }

  /* ---- 8. Two-Page Cream Overlay UI (Ledger Mode & Form Mode) ---- */
  const gbOverlay = document.getElementById('gb-overlay');
  const gbForm = document.getElementById('gb-form');
  const gbBookView = document.getElementById('gb-book-view');
  const gbFormMode = document.getElementById('gb-form-mode');
  const gbMsg = document.getElementById('gb-msg');
  const gbQuota = document.getElementById('gb-quota');
  const gbSubmit = document.getElementById('gb-submit');
  const gbToast = document.getElementById('gb-toast');

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function renderEntries(el, items, emptyHtml) {
    if (!el) return;
    if (!items.length) { el.innerHTML = `<p class="gb-empty">${emptyHtml}</p>`; return; }
    el.innerHTML = items.map((g) => `
      <div class="gb-entry${g.pending ? ' pending' : ''}">
        <div class="gb-et">${escHtml(g.t)}${g.a ? ` <span style="font-weight:400;color:#6E5840">· ${escHtml(g.a)}</span>` : ''}</div>
        <div class="gb-em">from ${escHtml(g.by || 'Anonymous')}${g.at ? ` · ${escHtml(g.at)}` : ''}${g.pending ? ' · <em>awaiting approval</em>' : ''}</div>
        ${g.why ? `<div class="gb-ew">“${escHtml(g.why)}”</div>` : ''}
      </div>`).join('');
  }

  function quotaText() {
    const left = serverRemaining ?? Math.max(0, GUEST_MAX_PER_IP - loadMine().length);
    if (!RELAY_LIVE) return 'Preview mode — saves in this browser until the relay is deployed.';
    return left > 0
      ? `You can leave ${left} more ${left === 1 ? 'book' : 'books'}.`
      : `You've reached the ${GUEST_MAX_PER_IP}-book limit for this connection.`;
  }

  function setGuestbookMode(mode) {
    const isForm = mode === 'form';
    gbBookView.style.display = isForm ? 'none' : 'grid';
    gbFormMode.style.display = isForm ? 'grid' : 'none';
    if (isForm) {
      gbMsg.textContent = '';
      gbMsg.className = 'gb-msg';
      gbQuota.textContent = quotaText();
      gbSubmit.disabled = serverRemaining === 0;
      setTimeout(() => document.getElementById('gb-title')?.focus(), 40);
    } else {
      renderEntries(
        document.getElementById('gb-shelved'),
        GUESTS.slice().reverse(),
        `Nothing shelved yet — yours could be the first.`
      );
      renderEntries(
        document.getElementById('gb-waiting'),
        allWaiting().map((m) => ({ ...m, pending: true })),
        `No books waiting right now.`
      );
    }
  }

  function openGuestbook(mode = 'form', source = 'room') {
    if (runtime.opened) hooks.closeBook?.();
    runtime.guestbookOpen = true;
    try { localStorage.setItem(GUEST_SEEN_KEY, '1'); } catch { /* ignore */ }
    gbToast?.classList.remove('show');
    setGuestbookMode(mode);
    gbOverlay.classList.add('open');
    hooks.unlockPointer?.();
    if (runtime.useTouch) hooks.setTouchUiVisible?.(false);
    track('guestbook_open', { mode, source });
  }

  function closeGuestbook(relock = true) {
    if (!runtime.guestbookOpen) return;
    runtime.guestbookOpen = false;
    gbOverlay.classList.remove('open');
    if (runtime.useTouch) {
      if (runtime.inRoom) hooks.setTouchUiVisible?.(true);
    } else if (relock && !hooks.isPointerLocked?.()) {
      hooks.lockPointer?.();
    }
  }

  document.getElementById('gb-open-form')?.addEventListener('click', () => setGuestbookMode('form'));
  document.getElementById('gb-view-ledger')?.addEventListener('click', () => setGuestbookMode('book'));
  document.getElementById('gb-close-1')?.addEventListener('click', () => closeGuestbook(true));
  document.getElementById('gb-close-2')?.addEventListener('click', () => closeGuestbook(true));
  gbOverlay?.addEventListener('click', (e) => { if (e.target === gbOverlay) closeGuestbook(true); });
  document.getElementById('hud-leave-book')?.addEventListener('click', () => openGuestbook('form', 'hud'));

  // Open Library live cover lookup when ISBN is typed
  const isbnInput = document.getElementById('gb-isbn');
  const titleInput = document.getElementById('gb-title');
  const authorInput = document.getElementById('gb-author');
  const pvImg = document.getElementById('gb-pv-img');
  const pvText = document.getElementById('gb-pv-text');
  let isbnTimer = 0;
  isbnInput?.addEventListener('input', () => {
    clearTimeout(isbnTimer);
    const clean = isbnInput.value.replace(/[^0-9Xx]/g, '');
    if (clean.length !== 10 && clean.length !== 13) {
      if (pvImg) pvImg.style.display = 'none';
      if (pvText) pvText.textContent = 'Optional — add an ISBN and we’ll fetch the cover & fill in anything blank.';
      return;
    }
    isbnTimer = setTimeout(async () => {
      if (pvImg) {
        pvImg.src = `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg?default=false`;
        pvImg.onload = () => { pvImg.style.display = 'block'; };
        pvImg.onerror = () => { pvImg.style.display = 'none'; };
      }
      try {
        const r = await fetch(`https://openlibrary.org/isbn/${clean}.json`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.title && !titleInput.value.trim()) titleInput.value = j.title;
        if (pvText) pvText.textContent = j.title ? `Found “${j.title}”.` : 'ISBN recognized.';
        if (!authorInput.value.trim() && j.authors?.[0]?.key) {
          const ar = await fetch(`https://openlibrary.org${j.authors[0].key}.json`);
          if (ar.ok) {
            const aj = await ar.json();
            if (aj.name) authorInput.value = aj.name;
          }
        }
      } catch { /* offline */ }
    }, 380);
  });

  async function addGuestBook(raw) {
    const entry = {
      t: (raw.title || raw.t || '').trim().slice(0, 120),
      a: (raw.author || raw.a || '').trim().slice(0, 80),
      isbn: (raw.isbn || '').replace(/[^0-9Xx]/g, '').slice(0, 13),
      by: (raw.name || raw.by || '').trim().slice(0, 40),
      why: (raw.why || '').trim().slice(0, 400),
      at: new Date().toISOString().slice(0, 10)
    };
    if (!entry.t) throw new Error('Please add a book title.');
    if (!entry.a) throw new Error('Please add the author.');
    if (!entry.by) throw new Error('Please add your name so Rahul knows who to thank.');
    if (/https?:\/\/|www\./i.test(entry.t + entry.a + entry.by + entry.why)) {
      throw new Error('No links, please — just the book and a quick note.');
    }
    const key = normKey(entry.t, entry.by);
    const all = [...GUESTS, ...loadMine(), ...remotePending];
    if (all.some((x) => normKey(x.t, x.by) === key)) {
      throw new Error('That one is already on the table.');
    }
    if (!RELAY_LIVE && loadMine().length >= GUEST_MAX_PER_IP) {
      throw new Error(`You've already left ${GUEST_MAX_PER_IP} books from this browser.`);
    }

    if (RELAY_LIVE) {
      const payload = {
        t: entry.t,
        a: entry.a,
        by: entry.by,
        why: entry.why,
        isbn: entry.isbn,
        cover: entry.isbn ? `https://covers.openlibrary.org/b/isbn/${entry.isbn}-L.jpg` : ''
      };
      const r = await fetch(GUEST_RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || j.error || `Couldn't reach the desk (${r.status}).`);
      const issueNum = j.number || j.issue;
      if (issueNum) { entry.id = issueNum; entry.issue = issueNum; }
      if (typeof j.remaining === 'number') serverRemaining = j.remaining;
    }

    const mine = loadMine();
    mine.push(entry);
    saveMine(mine);
    rebuildGuestBooks();
    track('guestbook_submit', {
      has_isbn: Boolean(entry.isbn),
      has_note: Boolean(entry.why),
      named: entry.by !== 'Anonymous',
      relay: RELAY_LIVE
    });
    return entry;
  }

  gbForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    gbSubmit.disabled = true;
    gbMsg.className = 'gb-msg';
    gbMsg.textContent = RELAY_LIVE ? 'Leaving it on the table…' : 'Placing it on the table…';
    try {
      await addGuestBook({
        title: titleInput.value,
        author: authorInput.value,
        isbn: isbnInput.value,
        name: document.getElementById('gb-name').value,
        why: document.getElementById('gb-why').value
      });
      gbForm.reset();
      if (pvImg) pvImg.style.display = 'none';
      gbQuota.textContent = quotaText();
      gbMsg.className = 'gb-msg ok';
      gbMsg.textContent = `On the table! Tagged “awaiting approval” until ${HOST_NAME} shelves it.`;
      setTimeout(() => closeGuestbook(true), 1300);
    } catch (err) {
      gbMsg.className = 'gb-msg err';
      gbMsg.textContent = err.message || String(err);
    } finally {
      gbSubmit.disabled = serverRemaining === 0;
    }
  });

  function showFirstVisitToast() {
    try {
      if (!localStorage.getItem(GUEST_SEEN_KEY) && gbToast) {
        gbToast.classList.add('show');
        setTimeout(() => gbToast.classList.remove('show'), 6500);
      }
    } catch { /* ignore */ }
  }

  /* ---- 9. Per-Frame Ledger Page Opening, Quill Bob & Pending Tag Float ---- */
  let ledgerOpenT = 0;

  function update(t, dt) {
    const ledgerTarget = (runtime.guestbookOpen || runtime.looked?.userData?.guestbook) ? 1 : 0;
    ledgerOpenT = damp(ledgerOpenT, ledgerTarget, 7, dt);
    const ang = THREE.MathUtils.lerp(0.045, 0.13, ledgerOpenT);
    for (const { board, block, s } of ledgerBlocks) {
      board.rotation.z = s * -ang;
      block.rotation.z = s * -ang;
    }
    quill.rotation.z = -0.55 + Math.sin(t * 1.4) * 0.025 + ledgerOpenT * 0.12;

    for (let i = 0; i < pendingTags.length; i++) {
      const pt = pendingTags[i];
      pt.mesh.position.y = pt.baseY + Math.sin(t * 2.1 + pt.phase) * 0.006;
    }
  }

  return {
    guestTable,
    openGuestbook,
    closeGuestbook,
    addGuestBook,
    redrawLedger,
    startNetworkSync,
    showFirstVisitToast,
    update
  };
}
