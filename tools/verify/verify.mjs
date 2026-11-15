#!/usr/bin/env node
/* The Reading Room — on-demand verification.

   node verify.mjs check            Assertions on the working copy. Prints only
                                    failures/warnings + one summary line.
   node verify.mjs visual [ref]     Screenshots fixed views of <ref> (default
                                    `main`) and of the working copy, and writes
                                    a side-by-side before/after page for a human.

   Everything heavy (full console log, PNGs, HTML) goes to tools/verify/out/.
   Uses the locally installed Google Chrome via playwright-core, so there is
   nothing to download beyond `npm install` in this folder. */

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const CHROME = process.env.CHROME_PATH
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const VIEWPORT = { width: 1280, height: 800 };
// Real GPU (Metal on macOS); without it headless Chrome falls back to slow software GL.
const LAUNCH = { headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'] };
const T0 = new Date('2026-01-01T17:00:00Z').getTime();

/* ---------------------------------------------------------------- helpers */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon'
};

function serve(root) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        let file = path.join(root, rel);
        if (!file.startsWith(root)) throw new Error('outside root');
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404); res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Seeded Math.random so procedural textures and prop jitter match between
   the before and after builds (and between runs). */
const SEED_SCRIPT = `(() => {
  let a = 0x5eed1234;
  Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

async function openRoom(browser, base, log, { path: pagePath = 'reading-room.html', viewport = VIEWPORT, init = null } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (init) await page.addInitScript(init);
  page.on('console', (m) => {
    // The generic "Failed to load resource" line has no URL; the response hook below logs it with one.
    if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) log.push({ kind: 'console', text: m.text() });
  });
  page.on('response', (r) => { if (r.status() >= 400) log.push({ kind: `http ${r.status()}`, text: r.url() }); });
  page.on('pageerror', (e) => log.push({ kind: 'pageerror', text: e.message }));
  page.on('requestfailed', (r) => log.push({ kind: 'requestfailed', text: `${r.url()} ${r.failure()?.errorText || ''}` }));
  await page.addInitScript(SEED_SCRIPT);
  // Frozen, hand-stepped clock: animations (birds, rain, candles) land on the
  // same frame every run. Network/image loading still runs in real time.
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 1000);
  await page.goto(`${base}/${pagePath}?edit=1`, { waitUntil: 'load' });
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => Boolean(window.__room))) break;
    await page.clock.runFor(50);
    await sleep(100);
  }
  if (!(await page.evaluate(() => Boolean(window.__room)))) throw new Error('window.__room never appeared (is ?edit=1 harness intact?)');
  await page.clock.runFor(500);
  return page;
}

async function enter(page) {
  await page.evaluate(() => {
    try { window.__room.enterRoom?.(); } catch { /* pointer lock unavailable headless */ }
    if (window.__room.runtime) { window.__room.runtime.inRoom = true; window.__room.runtime.headBob = false; }
  });
  await page.clock.runFor(800);
}

/* Wait (real time) for table/guest covers to arrive from Open Library. */
async function waitForCovers(page, maxMs = 20000) {
  const t = Date.now();
  while (Date.now() - t < maxMs) {
    const pending = await page.evaluate(() => (window.__room.interactables || []).filter((m) => {
      const b = m.userData?.book; const u = m.userData || {};
      if (!b || !u.onTable || !(b.isbn || b.cover)) return false;
      const img = Array.isArray(m.material) ? m.material[0]?.map?.image : null;
      return !(img && img.tagName === 'IMG');
    }).length);
    if (pending === 0) return;
    await page.clock.runFor(100);
    await sleep(400);
  }
}

async function look(page, pos, target) {
  await page.evaluate(([p, t]) => {
    const c = window.__room.camera; c.position.set(...p); c.lookAt(...t);
  }, [pos, target]);
  await page.clock.runFor(120);
  await page.evaluate(([p, t]) => {
    const c = window.__room.camera; c.position.set(...p); c.lookAt(...t);
  }, [pos, target]);
  await page.clock.runFor(34);
}

async function toggle(page, which) {
  const fn = which === 'mood' ? 'toggleMood' : 'toggleCoverMode';
  const done = await page.evaluate((f) => {
    if (typeof window.__room[f] === 'function') { window.__room[f]('verify'); return true; }
    return false;
  }, fn);
  if (!done) await page.keyboard.press(which === 'mood' ? 'm' : 'c');
  await page.clock.runFor(3500);
}

/* Fraction of near-black pixels in a screenshot (NaN bloom shows up as black blocks). */
async function blackFraction(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i] < 6 && d[i + 1] < 6 && d[i + 2] < 6) n++;
    return n / (d.length / 16);
  }, png.toString('base64'));
}

const VIEWS = [
  { id: 'overview', label: 'Room from the door', pos: [0, 1.62, 2.6], at: [0, 1.3, -3.2] },
  { id: 'bookcase', label: 'Bookcase (spines)', pos: [0.2, 1.62, -1.3], at: [0.2, 1.15, -3.2] },
  { id: 'covers', label: 'Bookcase (cover mode, C)', pos: [0.2, 1.62, -1.3], at: [0.2, 1.15, -3.2], covers: true },
  { id: 'reading-table', label: 'Reading table', pos: [-1.95, 1.62, -1.6], at: [-1.95, 0.75, -2.52] },
  { id: 'guest-table', label: 'Guest table & ledges', pos: [1.9, 1.62, 1.1], at: [1.9, 1.0, 3.2] },
  { id: 'window-golden', label: 'Window nook — Golden Hour', pos: [0.6, 1.62, -0.15], at: [-3.5, 1.35, -0.15] },
  { id: 'window-rain', label: 'Window nook — Rainy Dusk (M)', pos: [0.6, 1.62, -0.15], at: [-3.5, 1.35, -0.15], rain: true },
  { id: 'right-wall', label: 'Turntable & gallery wall', pos: [-0.6, 1.62, 0.2], at: [3.5, 1.35, 0.2] }
];

/* ------------------------------------------------------------- check mode */

async function check() {
  await mkdir(OUT, { recursive: true });
  const { server, base } = await serve(REPO);
  const browser = await chromium.launch({ executablePath: CHROME, ...LAUNCH });
  const log = [];
  const results = [];
  const pass = (name) => results.push({ s: 'PASS', name });
  const fail = (name, why) => results.push({ s: 'FAIL', name, why });
  const warn = (name, why) => results.push({ s: 'WARN', name, why });

  try {
    const page = await openRoom(browser, base, log);

    // 1. Entry gate copy (v1 voice) + older-v1 link
    const gate = await page.evaluate(() => ({
      text: document.getElementById('gate')?.innerText || '',
      v1: [...document.querySelectorAll('#gate a')].find((a) => a.getAttribute('href') === 'v1.html')?.textContent || ''
    }));
    if (!/A room with my books in it/.test(gate.text)) fail('gate-copy', 'intro no longer uses the v1 wording ("A room with my books in it…")');
    else pass('gate-copy');
    if (!/older v1/i.test(gate.v1)) fail('gate-v1-link', `link to v1.html missing or relabelled (got "${gate.v1.trim()}")`);
    else pass('gate-v1-link');

    await enter(page);
    await waitForCovers(page);
    await page.clock.runFor(300);

    // 2. Table & guest-table books: cover loaded, face up, spine left, upright
    const tableBooks = await page.evaluate(() => {
      const out = [];
      for (const m of window.__room.interactables || []) {
        const u = m.userData || {};
        if (!u.book || !u.onTable || u.onGuestLedge) continue;
        m.updateWorldMatrix(true, false);
        const V = m.position.constructor;
        const q = new m.quaternion.constructor();
        m.getWorldQuaternion(q);
        const wp = new V(); m.getWorldPosition(wp);
        const front = new V(1, 0, 0).applyQuaternion(q);
        const spine = new V(0, 0, 1).applyQuaternion(q);
        const top = new V(0, 1, 0).applyQuaternion(q);
        // Viewer stands toward the room centre, looking at the book.
        const fwd = new V(wp.x, 0, wp.z).normalize();
        const right = new V(-fwd.z, 0, fwd.x);
        const img = Array.isArray(m.material) ? m.material[0]?.map?.image : null;
        // A cross-origin image without CORS loads fine as <img> but WebGL refuses it
        // (renders black). Reading its pixels back exposes the taint directly.
        let tainted = false;
        if (img && img.tagName === 'IMG') {
          try { const c = document.createElement('canvas'); c.width = c.height = 2;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0, 2, 2); g.getImageData(0, 0, 1, 1); }
          catch { tainted = true; }
        }
        out.push({ tainted,
          t: u.book.t, guest: Boolean(u.onGuestTable), hasSrc: Boolean(u.book.isbn || u.book.cover),
          cover: Boolean(img && img.tagName === 'IMG' && img.naturalWidth > 10),
          up: front.y, spineSide: spine.dot(right), topAway: top.dot(fwd)
        });
      }
      return out;
    });
    if (!tableBooks.length) fail('table-books', 'no reading-table or guest-table books found');
    for (const b of tableBooks) {
      const where = b.guest ? 'guest-table' : 'reading-table';
      const tag = `${where} "${b.t}"`;
      if (b.up < 0.9) fail(`${where}-face-up`, `${tag}: front cover not facing up (normal.y=${b.up.toFixed(2)})`);
      else if (b.spineSide > -0.5) fail(`${where}-spine-left`, `${tag}: spine is not on the viewer's left`);
      else if (b.topAway < 0.5) fail(`${where}-upright`, `${tag}: jacket reads upside down from the room`);
      if (b.tainted) fail(`${where}-cover`, `${tag}: cover is cross-origin without CORS — WebGL renders it black`);
      else if (b.hasSrc && !b.cover) warn(`${where}-cover`, `${tag}: cover image did not load (Open Library may have none — check console errors)`);
    }
    if (!results.some((r) => /-(face-up|spine-left|upright)$/.test(r.name))) pass(`table-book-orientation (${tableBooks.length} books)`);
    if (tableBooks.length && !results.some((r) => r.name.endsWith('-cover'))) pass('table-book-covers');
    // Look at both tables so their textures actually upload (GPU errors only fire on draw).
    for (const v of VIEWS.filter((x) => x.id === 'reading-table' || x.id === 'guest-table')) await look(page, v.pos, v.at);

    // 3. Hovering a table book: small lift, stays cover-up (no roll onto the spine)
    const hover = await page.evaluate(() => {
      const m = (window.__room.interactables || []).find((x) => x.userData?.onTable && !x.userData?.onGuestLedge && !x.userData?.onGuestTable);
      if (!m) return null;
      const V = m.position.constructor;
      const p0 = new V(); m.getWorldPosition(p0);
      m.userData.targetPull = 1;
      window.__verifyHover = { m, p0 };
      return true;
    });
    if (hover) {
      await page.clock.runFor(1500);
      const h = await page.evaluate(() => {
        const { m, p0 } = window.__verifyHover;
        m.updateWorldMatrix(true, false);
        const V = m.position.constructor;
        const p1 = new V(); m.getWorldPosition(p1);
        const q = new m.quaternion.constructor(); m.getWorldQuaternion(q);
        const up = new V(1, 0, 0).applyQuaternion(q).y;
        m.userData.targetPull = 0;
        return { lift: p1.y - p0.y, move: p1.distanceTo(p0), up };
      });
      await page.clock.runFor(1500);
      if (h.up < 0.85) fail('table-hover', `hovered table book tilts off its cover (normal.y=${h.up.toFixed(2)})`);
      else if (h.move > 0.15) fail('table-hover', `hovered table book flies ${(h.move * 100).toFixed(0)} cm (v1 lifts ~8 cm)`);
      else pass('table-hover');
    }

    // 4. Shortcuts: Q quality, M mood, C cover mode
    const rt = (k) => page.evaluate((key) => window.__room.runtime?.[key], k);
    for (const [key, field, label] of [['q', 'quality', 'Q quality'], ['m', 'mood', 'M mood'], ['c', 'coverMode', 'C covers']]) {
      const before = await rt(field);
      await page.keyboard.press(key);
      await page.clock.runFor(200);
      const after = await rt(field);
      if (before === after) fail(`key-${key}`, `${label}: pressing ${key.toUpperCase()} did not change runtime.${field}`);
      else pass(`key-${key}`);
      // restore
      for (let i = 0; i < 3 && (await rt(field)) !== before; i++) { await page.keyboard.press(key); await page.clock.runFor(200); }
      await page.clock.runFor(3500);
    }

    // 5. No NaN black blocks (golden hour, looking at the sunbeams + wide view)
    for (const v of VIEWS.filter((x) => x.id === 'window-golden' || x.id === 'overview')) {
      await look(page, v.pos, v.at);
      const png = await page.screenshot();
      const f = await blackFraction(page, png);
      if (f > 0.02) {
        const file = path.join(OUT, `check-black-${v.id}.png`);
        await writeFile(file, png);
        fail('no-black-blocks', `${v.label}: ${(f * 100).toFixed(1)}% pure-black pixels (screenshot: ${path.relative(REPO, file)})`);
      } else pass(`no-black-blocks ${v.id}`);
    }
    await page.close();

    // 6. v1 still loads and links back to v2
    const v1log = [];
    const v1 = await browser.newPage({ viewport: VIEWPORT });
    v1.on('pageerror', (e) => v1log.push(e.message));
    await v1.goto(`${base}/v1.html`, { waitUntil: 'load' });
    await sleep(1500);
    const back = await v1.evaluate(() => Boolean(document.querySelector('a[href="reading-room.html"]')));
    if (v1log.length) fail('v1-loads', `v1.html threw: ${v1log[0].slice(0, 140)}`);
    else if (!back) fail('v1-loads', 'v1.html lost its "Step into v2" link');
    else pass('v1-loads');
    await v1.close();
  } catch (e) {
    fail('harness', e.message.split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }

  // 0. Console errors (deduped; favicon noise ignored)
  // favicon: none shipped. Open Library ?default=false 404 = designed "no cover" fallback.
  const noise = /favicon\.ico|covers\.openlibrary\.org\/.*default=false/;
  const errs = [...new Set(log.filter((l) => !noise.test(l.text)).map((l) => `${l.kind}: ${l.text.split('\n')[0].slice(0, 160)}`))];
  if (errs.length) for (const e of errs.slice(0, 8)) fail('console', e);
  else pass('console-clean');
  if (errs.length > 8) fail('console', `…and ${errs.length - 8} more (see ${path.relative(REPO, path.join(OUT, 'check.log'))})`);

  await writeFile(path.join(OUT, 'check.log'), JSON.stringify({ results, console: log }, null, 2));

  const bad = results.filter((r) => r.s !== 'PASS');
  for (const r of bad) console.log(`${r.s} ${r.name}: ${r.why}`);
  const nPass = results.filter((r) => r.s === 'PASS').length;
  const nFail = results.filter((r) => r.s === 'FAIL').length;
  console.log(`${nFail ? 'FAILED' : 'OK'} — ${nPass} passed, ${nFail} failed, ${bad.length - nFail} warnings (full log: ${path.relative(REPO, path.join(OUT, 'check.log'))})`);
  process.exitCode = nFail ? 1 : 0;
}

/* ------------------------------------------------------------ visual mode */

async function shoot(browser, base, dir, log) {
  await mkdir(dir, { recursive: true });
  const page = await openRoom(browser, base, log);
  await page.screenshot({ path: path.join(dir, 'gate.png') });
  await enter(page);
  await waitForCovers(page);
  // Mood now follows the local clock on load; start every run from Golden Hour.
  if (await page.evaluate(() => window.__room.runtime?.mood === 'rain')) await toggle(page, 'mood');
  await page.clock.runFor(500);
  let covers = false;
  let rain = false;
  for (const v of VIEWS) {
    if (Boolean(v.covers) !== covers) { await toggle(page, 'covers'); covers = !covers; }
    if (Boolean(v.rain) !== rain) { await toggle(page, 'mood'); rain = !rain; }
    await look(page, v.pos, v.at);
    await page.screenshot({ path: path.join(dir, `${v.id}.png`) });
  }
  await page.close();
}

async function visual(ref = 'main') {
  const vis = path.join(OUT, 'visual');
  const src = path.join(OUT, 'before-src');
  await rm(vis, { recursive: true, force: true });
  await rm(src, { recursive: true, force: true });
  await mkdir(src, { recursive: true });
  const sha = execSync(`git rev-parse --short ${ref}`, { cwd: REPO }).toString().trim();
  execSync(`git archive ${ref} | tar -x -C "${src}"`, { cwd: REPO, shell: '/bin/bash' });

  const before = await serve(src);
  const after = await serve(REPO);
  const browser = await chromium.launch({ executablePath: CHROME, ...LAUNCH });
  const logB = [];
  const logA = [];
  const notes = [];
  try {
    try { await shoot(browser, before.base, path.join(vis, 'before'), logB); } catch (e) { notes.push(`before (${ref}): ${e.message.split('\n')[0]}`); }
    try { await shoot(browser, after.base, path.join(vis, 'after'), logA); } catch (e) { notes.push(`after (working copy): ${e.message.split('\n')[0]}`); }
  } finally {
    await browser.close();
    before.server.close();
    after.server.close();
  }

  const rows = [{ id: 'gate', label: 'Entry gate' }, ...VIEWS].map((v) => `
    <section><h2>${v.label}</h2><div class="pair">
      <figure><img src="before/${v.id}.png" loading="lazy" alt=""><figcaption>before · ${ref} (${sha})</figcaption></figure>
      <figure><img src="after/${v.id}.png" loading="lazy" alt=""><figcaption>after · working copy</figcaption></figure>
    </div></section>`).join('');
  const errList = (l) => [...new Set(l.filter((x) => !/favicon\.ico|default=false/.test(x.text)).map((x) => x.text.split('\n')[0]))].slice(0, 10);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Room before/after</title>
<style>
  :root{color-scheme:light dark;--bg:#f6f1ea;--fg:#2a2118;--mut:#7a6a5a;--card:#fffaf3}
  @media (prefers-color-scheme:dark){:root{--bg:#18140f;--fg:#efe5d6;--mut:#a8998a;--card:#221c16}}
  body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
  h1{font:600 24px Georgia,serif;margin:0 0 4px} p.meta{color:var(--mut);margin:0 0 20px}
  section{margin:0 0 28px} h2{font-size:15px;margin:0 0 8px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media (max-width:800px){.pair{grid-template-columns:1fr}}
  figure{margin:0;background:var(--card);border-radius:8px;overflow:hidden}
  img{display:block;width:100%;height:auto;cursor:zoom-in} figcaption{padding:6px 10px;font-size:12.5px;color:var(--mut)}
  .errs{background:var(--card);padding:10px 14px;border-radius:8px;font:12.5px ui-monospace,monospace;white-space:pre-wrap}
</style></head><body>
<h1>The Reading Room — before / after</h1>
<p class="meta">before = <b>${ref}</b> (${sha}) · after = working copy · ${new Date().toLocaleString()} · fixed cameras, frozen clock, seeded randomness</p>
${notes.length ? `<div class="errs">${notes.join('\n')}</div><br>` : ''}
${['before', 'after'].map((k, i) => { const e = errList(i ? logA : logB); return e.length ? `<h2>Console errors — ${k}</h2><div class="errs">${e.map((x) => x.replace(/</g, '&lt;')).join('\n')}</div><br>` : ''; }).join('')}
${rows}
<script>document.querySelectorAll('img').forEach(i=>i.onclick=()=>open(i.src))</script>
</body></html>`;
  await writeFile(path.join(vis, 'index.html'), html);
  await rm(src, { recursive: true, force: true });
  const page = path.join(vis, 'index.html');
  console.log(`${notes.length ? 'PARTIAL' : 'OK'} — before/after page: ${page}`);
  for (const n of notes) console.log(`NOTE ${n}`);
}

/* -------------------------------------------------------------- reel mode */

// Web 4:5 video (1080x1350): "before" (v1) on top, "now" (v2) below, each pane
// 1080x675 (16:10, the aspect the room's shots were framed at). Shots are captured in-browser; ffmpeg only stacks and encodes.
const PANE = { width: 1080, height: 675 };
const OUT_H = PANE.height * 2;
const HIDE_UI = `#hud,.hint,#hint,#crosshair,#prompt,#gb-toast,#toast,#detail,.lil-gui,#touch-ui{display:none!important}`;
const V2_INIT = () => {
  try { localStorage.setItem('rr-v2-prefs', JSON.stringify({ quality: 'ultra', qualityChosen: true, headBob: false })); } catch {}
};

async function openPane(browser, base, log, which) {
  const page = await openRoom(browser, base, log, which === 'v1'
    ? { path: 'v1.html', viewport: PANE }
    : { path: 'reading-room.html', viewport: PANE, init: V2_INIT });
  await page.addStyleTag({ content: HIDE_UI });
  await enter(page);
  await waitForCovers(page);
  if (which === 'v1') {
    // v1 runs walking + furniture collision whenever it is "in the room", even
    // without pointer lock, so it fights a scripted camera (visible stutter).
    // Film it from the left-room state: it still renders and animates books.
    await page.addStyleTag({ content: '#gate{display:none!important}' });
    await page.evaluate(() => window.__room.leaveRoom?.());
  }
  if (which === 'v2' && await page.evaluate(() => window.__room.runtime?.mood === 'rain')) await toggle(page, 'mood');
  await page.clock.runFor(600);
  return page;
}

// Overlay drawn in a plain page: transparent except labels, divider, and (for
// the end card) a full cream card. Same page later stamps every video frame.
// End card mirrors the Reading Room launch video: the room, darkened, with a
// spaced eyebrow, a large cream serif title and the amber URL.
// Labels follow design.rr2.dev (personal v1): Instrument Sans 600 uppercase,
// 0.08em tracking; BEFORE neutral surface pill, NOW raspberry (one emphasis).
const KIT = path.join(OUT, 'reel', 'endcard');
let FONT_CSS = null;
async function brandFontCss() {
  if (FONT_CSS !== null) return FONT_CSS;
  try {
    const b64 = (await readFile(path.join(KIT, 'fonts', 'instrument-sans-600.woff2'))).toString('base64');
    FONT_CSS = `@font-face{font-family:'Instrument Sans';font-weight:600;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  } catch { FONT_CSS = ''; console.log('NOTE brand font missing; run once with network to fetch the end-card kit'); }
  return FONT_CSS;
}

function overlayHtml({ top, bottom, card = false, bg = '', fontCss = '' }) {
  const img = (b64, y) => b64 ? `<img src="data:image/png;base64,${b64}" style="position:absolute;left:0;top:${y}px;width:1080px;height:${PANE.height}px">` : '';
  return `<!doctype html><html><head>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@600;700&display=block" rel="stylesheet">
  <style>
    ${fontCss}
    html,body{margin:0;width:1080px;height:${OUT_H}px;background:transparent;overflow:hidden;font-family:Georgia,'Times New Roman',serif}
    .lbl{position:absolute;left:40px;padding:12px 24px;border-radius:999px;background:#ffffff;color:#1f2329;
      border:1.5px solid rgba(31,35,41,.14);font:600 28px/1 'Instrument Sans',system-ui,sans-serif;
      text-transform:uppercase;letter-spacing:.08em;box-shadow:0 6px 18px rgba(0,0,0,.18)}
    .lbl.now{background:#a8325e;color:#ffffff;border-color:#a8325e}
    .div{position:absolute;left:0;right:0;top:${PANE.height - 2}px;height:4px;background:#ffffff;box-shadow:0 0 10px rgba(0,0,0,.3)}
    .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
      background:#16110c center/cover no-repeat}
    .card::before{content:'';position:absolute;inset:0;background:rgba(18,13,8,.58)}
    .card > *{position:relative}
    .eyebrow{font:700 22px/1 Inter,system-ui,sans-serif;letter-spacing:.32em;color:rgba(245,236,224,.82);margin:0 0 30px}
    .title{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:118px;line-height:1;color:#F5ECDD;margin:0 0 34px;
      text-shadow:0 4px 24px rgba(0,0,0,.35)}
    .url{font:600 40px/1 Inter,system-ui,sans-serif;color:#E5B467}
  </style></head><body>
    ${img(top, 0)}${img(bottom, PANE.height)}
    ${card ? `<div class="card" style="${bg ? `background-image:url(data:image/png;base64,${bg})` : ''}">
      <p class="eyebrow">TELL ME WHAT TO READ NEXT</p><h1 class="title">The Reading Room</h1><p class="url">readingroom.rr2.dev</p></div>` : `
    <div class="div"></div>
    <div class="lbl" style="top:${PANE.height - 80}px">before</div>
    <div class="lbl now" style="top:${PANE.height + 26}px">now</div>`}
  </body></html>`;
}

async function reelFrame() {
  const dir = path.join(OUT, 'reel');
  await mkdir(dir, { recursive: true });
  const { server, base } = await serve(REPO);
  const browser = await chromium.launch({ executablePath: CHROME, ...LAUNCH });
  const log = [];
  try {
    const shot = { pos: [0, 1.62, 2.6], at: [0, 1.3, -3.2] };   // overview from the door, Golden Hour
    const shots = {};
    for (const which of ['v1', 'v2']) {
      const page = await openPane(browser, base, log, which);
      await look(page, shot.pos, shot.at);
      const png = await page.screenshot();
      const black = await blackFraction(page, png);
      if (black > 0.02) console.log(`WARN ${which} pane ${(black * 100).toFixed(1)}% black`);
      shots[which] = png.toString('base64');
      await page.close();
    }
    const comp = await browser.newPage({ viewport: { width: 1080, height: OUT_H }, deviceScaleFactor: 1 });
    await comp.setContent(overlayHtml({ top: shots.v1, bottom: shots.v2, fontCss: await brandFontCss() }));
    await comp.evaluate(() => document.fonts.ready);
    const file = path.join(dir, 'frame-preview.png');
    await comp.screenshot({ path: file });
    const errs = [...new Set(log.filter((l) => !/favicon|default=false/.test(l.text)).map((l) => l.text.split('\n')[0]))];
    console.log(`OK — preview: ${file}`);
    if (errs.length) console.log(`NOTE console: ${errs.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

/* ------------------------------------------------------------ full reel */

const FPS = 30;
const HOOK = 'I rebuilt my reading room.';
// Start offset into the track: 78 s is its fullest, loudest section (measured with ebur128)
const MUSIC_START = +(process.env.REEL_MUSIC_START ?? 78);
const MUSIC = process.env.REEL_MUSIC || path.join(process.env.HOME || '', 'Downloads/prettyjohn1-relax-575306.mp3');
const ease = (k) => k * k * (3 - 2 * k);
const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// Beats in seconds; both panes share coordinates (the rooms share a layout).
// Strongest contrast first for the muted-autoplay hook, slow walk-in last.
const BEATS = [
  { id: 'window', d: 4.2, pos: [[0.6, 1.62, -0.15], [-0.4, 1.62, -0.15]], at: [[-3.5, 1.42, -0.15], [-3.5, 1.38, -0.4]] },
  { id: 'covers', d: 4.2, pos: [[0.25, 1.62, -0.7], [0.15, 1.62, -1.25]], at: [[0.2, 1.2, -3.2], [0.2, 1.15, -3.2]] },
  { id: 'book', d: 3.2, pos: [[0.2, 1.62, -1.3], [0.2, 1.62, -1.3]], at: [[0.2, 1.15, -3.2], [0.2, 1.15, -3.2]] },
  // Record player on the right wall (credenza around x 3.2, z -0.4)
  { id: 'record', d: 3.6, pos: [[1.75, 1.5, 0.55], [2.25, 1.32, 0.15]], at: [[3.2, 0.9, -0.4], [3.25, 0.8, -0.42]],
    // v2's room is wider: same spot leaves the deck tiny under the posters
    v2: { pos: [[2.3, 1.3, 0.35], [2.62, 1.15, 0.0]], at: [[3.22, 0.78, -0.4], [3.24, 0.74, -0.42]] } },
  { id: 'table', d: 3.8, pos: [[-1.05, 1.6, -1.25], [-1.45, 1.52, -1.55]], at: [[-1.95, 0.82, -2.52], [-2.0, 0.8, -2.55]] },
  { id: 'walk', d: 4.2, pos: [[-1.9, 1.62, 2.85], [-0.6, 1.62, 1.6]], at: [[-3.5, 1.35, -0.15], [0, 1.25, -3.2]] }
];
// Timed actions: [seconds, pane or 'both', action]
const EVENTS = [
  [0.15, 'v2', 'mood'], [1.35, 'v2', 'strike'],
  [4.5, 'both', 'covers'], [8.7, 'both', 'openBook'],
  // Close ~0.7 s before the cut: v2's depth-of-field blur fades over ~0.5 s
  // and would otherwise smear the first frames of the record-player shot.
  [10.9, 'both', 'closeBook'], [10.95, 'both', 'covers']
];

async function act(page, which, kind) {
  if (kind === 'covers') {
    const ok = await page.evaluate(() => { const r = window.__room; if (r.toggleCoverMode) { r.toggleCoverMode(); return true; } return false; });
    if (!ok) {
      // v1: its C handler needs "in the room"; enter, press, leave in the same
      // paused-clock instant so no movement/collision frame runs in between.
      await page.evaluate(() => window.__room.enterRoom?.());
      await page.keyboard.press('c');
      await page.evaluate(() => window.__room.leaveRoom?.());
    }
  } else if (kind === 'mood') {
    await page.evaluate(() => window.__room.toggleMood?.('reel'));
  } else if (kind === 'strike') {
    await page.evaluate(() => window.__room.strike?.());
  } else if (kind === 'openBook' || kind === 'closeBook') {
    await page.evaluate((open) => {
      const r = window.__room;
      const ms = (r.interactables || []).filter((m) => m.userData?.book && !m.userData.onTable);
      const m = ms.find((x) => x.userData.book.t === 'Steve Jobs') || ms[Math.floor(ms.length / 2)];
      const isOpen = r.runtime ? r.runtime.opened === m : Boolean(m?.userData?.out);
      if (m && (open ? !isOpen : true)) r.interact(m);
    }, kind === 'openBook');
  }
}

function compHtml(fontCss) {
  return `<!doctype html><html><head><style>
    ${fontCss}
    html,body{margin:0;width:1080px;height:${OUT_H}px;background:#000;overflow:hidden}
    img{position:absolute;left:0;width:1080px;height:${PANE.height}px;display:block}
    #a{top:0} #b{top:${PANE.height}px}
    .div{position:absolute;left:0;right:0;top:${PANE.height - 2}px;height:4px;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.3)}
    .lbl{position:absolute;left:40px;padding:12px 24px;border-radius:999px;background:#fff;color:#1f2329;
      border:1.5px solid rgba(31,35,41,.14);font:600 28px/1 'Instrument Sans',system-ui,sans-serif;
      text-transform:uppercase;letter-spacing:.08em;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0}
    .lbl.now{background:#a8325e;color:#fff;border-color:#a8325e}
    #hook{position:absolute;left:50%;top:${PANE.height}px;transform:translate(-50%,-50%);white-space:nowrap;
      padding:22px 40px;border-radius:999px;background:#fff;color:#1f2329;font:600 60px/1.05 Fraunces,Georgia,serif;
      letter-spacing:-.02em;box-shadow:0 10px 36px rgba(0,0,0,.28)}
  </style></head><body>
    <img id="a"><img id="b"><div class="div"></div>
    <div class="lbl" id="l1" style="top:${PANE.height - 80}px">before</div>
    <div class="lbl now" id="l2" style="top:${PANE.height + 26}px">now</div>
    <div id="hook">${HOOK}</div>
    <script>
      const e = (k) => k * k * (3 - 2 * k), c = (v) => Math.max(0, Math.min(1, v));
      window.frame = async (a, b, t) => {
        const A = document.getElementById('a'), B = document.getElementById('b');
        A.src = 'data:image/jpeg;base64,' + a; B.src = 'data:image/jpeg;base64,' + b;
        await Promise.all([A.decode(), B.decode()]);
        const out = e(c((t - 1.9) / 0.4));                 // hook leaves 1.9-2.3 s
        const h = document.getElementById('hook');
        h.style.opacity = 1 - out; h.style.transform = 'translate(-50%,calc(-50% + ' + (-out * 40) + 'px))';
        const li = e(c((t - 2.1) / 0.5));                  // labels rise 2.1-2.6 s
        for (const id of ['l1', 'l2']) { const l = document.getElementById(id); l.style.opacity = li; l.style.translate = '0 ' + ((1 - li) * 18) + 'px'; }
      };
    </script></body></html>`;
}

async function fontFaces() {
  const face = async (fam, file, w) => {
    const b64 = (await readFile(path.join(KIT, 'fonts', file))).toString('base64');
    return `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  };
  return (await face('Instrument Sans', 'instrument-sans-600.woff2', 600)) + (await face('Fraunces', 'fraunces.woff2', '100 900'));
}

async function reel() {
  const dir = path.join(OUT, 'reel');
  await mkdir(dir, { recursive: true });
  if (!existsSync(path.join(KIT, 'video', 'end-card.html'))) throw new Error(`end-card kit missing in ${KIT}`);
  const { server, base } = await serve(REPO);
  const browser = await chromium.launch({ executablePath: CHROME, ...LAUNCH });
  const log = [];
  const silent = path.join(dir, 'reel-silent.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const push = async (buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); };
  const notes = [];
  let frames = 0;
  try {
    const panes = { v1: await openPane(browser, base, log, 'v1'), v2: await openPane(browser, base, log, 'v2') };
    const comp = await browser.newPage({ viewport: { width: 1080, height: OUT_H }, deviceScaleFactor: 1 });
    await comp.setContent(compHtml(await fontFaces()));
    await comp.evaluate(() => document.fonts.ready);

    const total = BEATS.reduce((s, b) => s + b.d, 0);
    const n = Math.round(total * FPS);
    const fired = new Set();
    let beatStart = 0, bi = 0, lastBi = -1;
    for (let f = 0; f < n; f++) {
      const t = f / FPS;
      while (bi < BEATS.length - 1 && t >= beatStart + BEATS[bi].d) { beatStart += BEATS[bi].d; bi++; }
      const B = BEATS[bi];
      const k = ease(Math.min(1, (t - beatStart) / B.d));
      const camFor = (w) => { const V = B[w] || B; return [lerp3(V.pos[0], V.pos[1], k), lerp3(V.at[0], V.at[1], k)]; };
      for (const [i, ev] of EVENTS.entries()) {
        if (!fired.has(i) && t >= ev[0]) {
          fired.add(i);
          for (const w of ev[1] === 'both' ? ['v1', 'v2'] : [ev[1]]) await act(panes[w], w, ev[2]);
        }
      }
      // At each cut, render a few unrecorded frames at the new pose so v2's
      // screen-space AO has settled (otherwise the first frame pops bright).
      if (bi !== lastBi) {
        lastBi = bi;
        for (const w of ['v1', 'v2']) {
          const [pos, at] = camFor(w);
          for (let i = 0; i < 3; i++) {
            await panes[w].evaluate(([p, a]) => { const c = window.__room.camera; c.position.set(...p); c.lookAt(...a); }, [pos, at]);
            await panes[w].clock.runFor(17);
          }
        }
      }
      const shots = {};
      for (const w of ['v1', 'v2']) {
        const pg = panes[w];
        const [pos, at] = camFor(w);
        await pg.evaluate(([p, a]) => { const c = window.__room.camera; c.position.set(...p); c.lookAt(...a); }, [pos, at]);
        await pg.clock.runFor(1000 / FPS);
        await pg.evaluate(([p, a]) => { const c = window.__room.camera; c.position.set(...p); c.lookAt(...a); }, [pos, at]);
        shots[w] = (await pg.screenshot({ type: 'jpeg', quality: 92 })).toString('base64');
      }
      await comp.evaluate(([a, b, tt]) => window.frame(a, b, tt), [shots.v1, shots.v2, t]);
      const img = await comp.screenshot({ type: 'jpeg', quality: 92 });
      await push(img);
      frames++;
      const mid = beatStart + B.d / 2;
      if (Math.abs(t - mid) < 0.5 / FPS) await writeFile(path.join(dir, `beat-${bi + 1}.jpg`), img);
      if (f === Math.round(1.45 * FPS)) await writeFile(path.join(dir, 'poster.jpg'), img);   // hook + lightning
      if (Math.abs(t - mid) < 0.5 / FPS) {
        for (const w of ['v1', 'v2']) {
          const bf = await blackFraction(panes[w], Buffer.from(await panes[w].screenshot()));
          if (bf > 0.02) notes.push(`${w} ${B.id}: ${(bf * 100).toFixed(1)}% black`);
        }
      }
      if (f % (FPS * 2) === 0) process.stdout.write(`\r${(t).toFixed(0)}s / ${total.toFixed(0)}s`);
    }
    for (const pg of Object.values(panes)) await pg.close();

    // Design-system end card (design.rr2.dev personal v1), filmed frame by frame
    const card = await browser.newPage({ viewport: { width: 1080, height: OUT_H }, deviceScaleFactor: 1 });
    await card.goto(`file://${path.join(KIT, 'video', 'end-card.html')}?film=1&w=1080&h=${OUT_H}&site=readingroom&cta=${encodeURIComponent('Step inside')}`);
    await card.evaluate(() => window.ready);
    // 3.0 s instead of the template's 4.0: every element (incl. blink and the
    // button sweep, done at 2.95 s) plays, and it holds 1.7 s after the button
    // lands, inside design.rr2.dev's ">= 1.5 s after the last element" rule.
    const dur = Math.min(await card.evaluate(() => DURATION), 3.0);
    for (let i = 0; i < Math.round(dur * FPS); i++) {
      await card.evaluate((tt) => window.render(tt), i / FPS);
      const img = await card.screenshot({ type: 'jpeg', quality: 92 });
      await push(img);
      frames++;
      if (i === Math.round(dur * FPS) - 1) await writeFile(path.join(dir, `beat-${BEATS.length + 1}.jpg`), img);
    }
  } finally {
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    await Promise.race([browser.close(), sleep(3000)]);
    server.close();
  }

  // Music: trim to length, fade out across the end card's hold
  const secs = frames / FPS;
  const out = path.join(dir, 'reading-room-before-now.mp4');
  if (existsSync(MUSIC)) {
    execSync(`ffmpeg -v error -y -i "${silent}" -ss ${MUSIC_START} -i "${MUSIC}" -filter_complex "[1:a]atrim=0:${secs.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.25,afade=t=out:st=${(secs - 2.2).toFixed(3)}:d=2.2[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "${out}"`);
  } else {
    notes.push(`music not found at ${MUSIC}; video is silent`);
    execSync(`cp "${silent}" "${out}"`);
  }
  execSync(`ffmpeg -v error -y -i "${dir}/beat-%d.jpg" -vf "scale=300:-1,tile=${BEATS.length + 1}x1:padding=6:color=white" "${dir}/contact-sheet.jpg"`);
  const mb = (await stat(out)).size / 1e6;
  const errs = [...new Set(log.filter((l) => !/favicon|default=false/.test(l.text)).map((l) => l.text.split('\n')[0]))];
  console.log(`\nOK — ${out} (${secs.toFixed(1)} s, ${frames} frames, ${mb.toFixed(1)} MB)`);
  console.log(`OK — poster: ${path.join(dir, 'poster.jpg')}`);
  console.log(`OK — contact sheet: ${path.join(dir, 'contact-sheet.jpg')}`);
  for (const nte of notes) console.log(`NOTE ${nte}`);
  if (errs.length) console.log(`NOTE console: ${errs.slice(0, 3).join(' | ')}`);
}

/* ------------------------------------------------------------------ main */

if (!CHROME) {
  console.error('No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.');
  process.exit(2);
}
const [mode = 'check', arg] = process.argv.slice(2);
if (mode === 'check') await check();
else if (mode === 'visual') await visual(arg);
else if (mode === 'reel' && arg === '--frame') await reelFrame();
else if (mode === 'reel') await reel();
else {
  console.error('usage: node verify.mjs check | visual [git-ref]');
  process.exit(2);
}
