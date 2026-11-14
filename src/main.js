/* Main entry point for The Reading Room v2 (`reading-room.html`).
   Orchestrates:
   1. Engine & merged post-processing (`renderer.js`)
   2. Warm PMREM IBL, cached soft shadows & Golden Hour ↔ Rainy Dusk (`lighting.js`)
   3. PBR room carpentry, woven rug, 4-panel door (`room.js`)
   4. 3D parallax exterior pocket world + sunbeams + rain (`exterior.js`)
   5. Left-wall book nook + rain-droplet glass + mood switch (`window-nook.js`)
   6. Bookcase, tactile books, cover exhibition mode (`books.js`)
   7. Reading table & currently-reading ribbon bookmarks (`tables.js`)
   8. Guestbook table, picture ledges, Worker/Issues sync (`guestbook.js`)
   9. Hero turntable (`turntable.js`), 7-poster salon (`gallery.js`)
   10. HRTF spatial audio + rain + foley (`audio.js`)
   11. Controls, head-bob, HUD quick-pills, `?edit=1` lil-gui & `window.__room` */

import * as THREE from 'three';
import GUI from 'lil-gui';
import BOOKS from '../books.js';
import GUESTS from '../guestbook.js';
import { damp } from './constants.js';
import {
  SETTINGS,
  EDIT,
  REDUCED_MOTION,
  runtime,
  interactables,
  books,
  savePrefs,
  track
} from './state.js';
import {
  currentTier,
  cycleQuality,
  monitorPerformance
} from './quality.js';
import { createEngine } from './renderer.js';
import { createLighting } from './lighting.js';
import { buildRoom } from './room.js';
import { buildExterior } from './exterior.js';
import { buildWindowNook } from './window-nook.js';
import { buildBookcaseAndBooks } from './books.js';
import { buildReadingTable } from './tables.js';
import { buildGuestbookSystem } from './guestbook.js';
import { buildTurntable } from './turntable.js';
import { buildGalleryWall } from './gallery.js';
import { createAudioEngine } from './audio.js';
import { setupControlsAndInteractions } from './controls.js';

const engine = createEngine();
const { scene, camera, renderer } = engine;

const lighting = createLighting(scene, renderer);
buildRoom(scene, renderer);
const exterior = buildExterior(scene);
const windowNook = buildWindowNook(scene);
const bookcaseApi = buildBookcaseAndBooks(scene, BOOKS, renderer);
buildReadingTable(scene, BOOKS, renderer);
const turntable = buildTurntable(scene);
buildGalleryWall(scene, renderer);

const audio = createAudioEngine(turntable.worldPos);

/* ---- `?edit=1` Design Harness GUI (single source of truth with SETTINGS) ---- */
const gui = new GUI({ title: 'Look (v2)', width: 270 });
gui.domElement.style.display = EDIT ? '' : 'none';
if (EDIT) {
  const fPost = gui.addFolder('Post & AO');
  fPost.add(SETTINGS, 'effects').name('Post-processing').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'exposure', 0.4, 2.0, 0.01).name('Exposure').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'aoEnabled').name('Ambient Occlusion').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'aoIntensity', 0, 4, 0.05).name('AO Intensity').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'bloomStrength', 0, 1.2, 0.01).name('Bloom').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'bloomRadius', 0, 1, 0.01).name('Bloom Radius').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'bloomThreshold', 0, 1.5, 0.01).name('Bloom Threshold').onChange(() => engine.syncSettings());
  fPost.add(SETTINGS, 'vignetteDarkness', 0, 1.2, 0.01).name('Vignette').onChange(() => engine.syncSettings());

  const fLight = gui.addFolder('Lights & IBL');
  fLight.add(SETTINGS, 'envIntensity', 0, 1.5, 0.02).name('IBL Reflection');
  fLight.add(SETTINGS, 'sunIntensity', 0, 5, 0.05).name('Sun Intensity');
  fLight.addColor(SETTINGS, 'sunColor').name('Sun Color');
  fLight.add(SETTINGS, 'sunX', -10, 4, 0.1).name('Sun X').onChange((v) => {
    lighting.sun.position.x = v; runtime.shadowsDirty = true;
  });
  fLight.add(SETTINGS, 'sunY', 0.5, 8, 0.1).name('Sun Y').onChange((v) => {
    lighting.sun.position.y = v; runtime.shadowsDirty = true;
  });
  fLight.add(SETTINGS, 'sunZ', -6, 6, 0.1).name('Sun Z').onChange((v) => {
    lighting.sun.position.z = v; runtime.shadowsDirty = true;
  });
  fLight.add(SETTINGS, 'windowBounce', 0, 4, 0.05).name('Window Area');
  fLight.add(SETTINGS, 'ambientIntensity', 0, 2, 0.02).name('Ambient');

  const fRoom = gui.addFolder('Camera & Audio');
  fRoom.add(SETTINGS, 'fov', 45, 90, 1).name('FOV').onChange(() => engine.syncSettings());
  fRoom.add(SETTINGS, 'moveSpeed', 1, 5, 0.1).name('Walk Speed');
  fRoom.add(SETTINGS, 'volume', 0, 0.8, 0.01).name('LP Volume').onChange((v) => audio.setVolume(v));
  gui.close();
}

/* ---- HUD Pills & Mood / Quality / Audio / Head-Bob Controls ---- */
const hudMoodBtn = document.getElementById('hud-mood');
const hudCoversBtn = document.getElementById('hud-covers');
const hudAudioBtn = document.getElementById('hud-audio');
const hudBobBtn = document.getElementById('hud-bob');
const hudQualityBtn = document.getElementById('hud-quality');
const touchMoodBtn = document.getElementById('touch-mood');
const touchCoversBtn = document.getElementById('touch-covers');

function syncHud() {
  const isRain = runtime.mood === 'rain';
  if (hudMoodBtn) {
    hudMoodBtn.textContent = isRain ? '🌧 Rainy Dusk (M)' : '☀ Golden Hour (M)';
    hudMoodBtn.classList.toggle('active', isRain);
  }
  if (touchMoodBtn) {
    touchMoodBtn.textContent = isRain ? 'Rainy' : 'Sunny';
  }
  if (hudCoversBtn) {
    hudCoversBtn.textContent = runtime.coverMode ? 'Shelve Books (C)' : 'Float Covers (C)';
    hudCoversBtn.classList.toggle('active', runtime.coverMode);
  }
  if (touchCoversBtn) {
    touchCoversBtn.textContent = runtime.coverMode ? 'Spines' : 'Covers';
  }
  if (hudAudioBtn) {
    const on = audio.isPlaying();
    hudAudioBtn.textContent = on ? '♫ Vinyl: On (V)' : '♫ Vinyl: Off (V)';
    hudAudioBtn.classList.toggle('active', on);
  }
  if (hudBobBtn) {
    hudBobBtn.textContent = runtime.headBob ? 'Bob: On (B)' : 'Bob: Off (B)';
    hudBobBtn.classList.toggle('active', runtime.headBob);
  }
  if (hudQualityBtn) {
    hudQualityBtn.textContent = `Quality: ${currentTier().label} (Q)`;
  }
}

function toggleMood(source = 'hud') {
  runtime.mood = runtime.mood === 'golden' ? 'rain' : 'golden';
  runtime.shadowsDirty = true;
  audio.playSfx('switch');
  savePrefs();
  syncHud();
  track('mood_toggle', { mood: runtime.mood, source });
}

function handleQualityCycle() {
  cycleQuality(() => {
    engine.syncQuality();
    lighting.applyShadowQuality();
    syncHud();
  });
}

/* Wire Guestbook <-> Controls circular hooks cleanly */
let controlsApi = null;
const guestbookApi = buildGuestbookSystem(scene, GUESTS, renderer, {
  closeBook: () => controlsApi?.closeBook(),
  unlockPointer: () => { if (controlsApi?.controls.isLocked) controlsApi.controls.unlock(); },
  lockPointer: () => controlsApi?.relockPointer(),
  isPointerLocked: () => Boolean(controlsApi?.controls.isLocked),
  setTouchUiVisible: (v) => controlsApi?.setTouchUiVisible(v)
});

controlsApi = setupControlsAndInteractions({
  camera,
  renderer,
  audio,
  bookcaseApi,
  guestbookApi,
  onMoodToggle: toggleMood,
  onQualityCycle: handleQualityCycle,
  onHudSync: syncHud,
  gui
});

hudMoodBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleMood('hud'); });
hudCoversBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  bookcaseApi.toggleCoverMode('hud', controlsApi.closeBook, audio.playSfx);
  syncHud();
});
hudAudioBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.toggle();
  audio.playSfx('switch');
  syncHud();
});
hudBobBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  runtime.headBob = !runtime.headBob;
  savePrefs();
  syncHud();
});
hudQualityBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleQualityCycle();
});

syncHud();

/* ---- Resize Handling (including iOS Safari visualViewport) ---- */
function onResize() {
  engine.resize();
}
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);

/* ---- `?edit=1` Design & Automation Harness (`window.__room`) ---- */
if (EDIT) {
  window.__room = {
    camera,
    scene,
    renderer,
    runtime,
    enterRoom: controlsApi.enterRoom,
    leaveRoom: controlsApi.leaveRoom,
    openGuestbook: guestbookApi.openGuestbook,
    closeGuestbook: guestbookApi.closeGuestbook,
    addGuestBook: guestbookApi.addGuestBook,
    redrawLedger: guestbookApi.redrawLedger,
    toggleMood,
    strike: () => triggerStrike(clock.elapsedTime),
    toggleCoverMode: () => bookcaseApi.toggleCoverMode('harness', controlsApi.closeBook, audio.playSfx),
    interact: controlsApi.interact,
    interactables
  };
}

/* ---- Main Animation Loop ---- */
const clock = new THREE.Clock();

/* Inspect pose: a clicked book (shelf, table, ledge or cover mode) glides to a
   fixed spot in front of the eyes, front cover facing the viewer, spine on the
   left, nudged left/down so the detail drawer (bottom right) doesn't cover it. */
const INSPECT = { dist: 0.42, right: -0.07, down: 0.035 };
const INSPECT_PAD = 12;          // px kept clear around the book
const _fitCache = { key: '', fit: null };
const _box = new THREE.Box3();

/* One rule for every screen: keep the default pose if the book fits on screen
   without touching the detail drawer; otherwise move it into the largest free
   region (left of a side drawer, or above a full-width one) and back off until
   it fits — never closer than INSPECT.dist. Cached per book + viewport size. */
function inspectFit(m) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const key = `${m.id}:${W}x${H}:${camera.fov}`;
  if (_fitCache.key === key) return _fitCache.fit;

  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  m.geometry.boundingBox.getSize(_box.min);
  const bookH = _box.min.y;              // book height (local y)
  const bookW = _box.min.z;              // cover width (local z, spine→fore-edge)
  const ppm1 = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); // px per metre at 1 m

  const el = document.getElementById('detail');
  const d = { l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight };
  const pad = INSPECT_PAD;
  const regions = [
    { x0: pad, y0: pad, x1: d.l - pad, y1: H - pad },   // left of the drawer
    { x0: pad, y0: pad, x1: W - pad, y1: d.t - pad }    // above the drawer
  ].filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  const free = regions.sort((a, b) => area(b) - area(a))[0] || { x0: 0, y0: 0, x1: W, y1: H };

  // 1. Default pose, if it is fully on screen and clear of the drawer.
  const ppm = ppm1 / INSPECT.dist;
  const cx = W / 2 + INSPECT.right * ppm;
  const cy = H / 2 + INSPECT.down * ppm;
  const hw = (bookW * ppm) / 2;
  const hh = (bookH * ppm) / 2;
  let fit = INSPECT;
  const offScreen = cx - hw < pad || cx + hw > W - pad || cy - hh < pad || cy + hh > H - pad;
  const underDrawer = cx + hw > d.l - pad && cx - hw < d.r + pad && cy + hh > d.t - pad && cy - hh < d.b + pad;
  if (offScreen || underDrawer) {
    // 2. Centre in the free region, far enough to fill at most 80% x 70% of it.
    const fw = free.x1 - free.x0;
    const fh = free.y1 - free.y0;
    const dist = Math.max(INSPECT.dist, (bookW * ppm1) / (0.8 * fw), (bookH * ppm1) / (0.7 * fh));
    const p = ppm1 / dist;
    fit = {
      dist,
      right: ((free.x0 + free.x1) / 2 - W / 2) / p,
      down: ((free.y0 + free.y1) / 2 - H / 2) / p
    };
  }
  _fitCache.key = key;
  _fitCache.fit = fit;
  return fit;
}
const _restW = new THREE.Matrix4();
const _restP = new THREE.Vector3();
const _restQ = new THREE.Quaternion();
const _restS = new THREE.Vector3();
const _insP = new THREE.Vector3();
const _insQ = new THREE.Quaternion();
const _camX = new THREE.Vector3();
const _camY = new THREE.Vector3();
const _camZ = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _parentInv = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);

function applyInspect(m, k) {
  m.updateMatrix();
  m.parent.updateWorldMatrix(true, false);
  _restW.multiplyMatrices(m.parent.matrixWorld, m.matrix);
  _restW.decompose(_restP, _restQ, _restS);

  camera.updateMatrixWorld();
  _camX.setFromMatrixColumn(camera.matrixWorld, 0); // right
  _camY.setFromMatrixColumn(camera.matrixWorld, 1); // up
  _camZ.setFromMatrixColumn(camera.matrixWorld, 2); // back (toward viewer)
  const fit = inspectFit(m);
  _insP.copy(camera.position)
    .addScaledVector(_camZ, -fit.dist)
    .addScaledVector(_camX, fit.right)
    .addScaledVector(_camY, -fit.down);
  // Book local axes: +x front cover -> toward viewer, +y top -> up, +z spine -> viewer's left.
  _basis.makeBasis(_camZ, _camY, _camX.clone().negate());
  _insQ.setFromRotationMatrix(_basis);

  _restP.lerp(_insP, k);
  _restQ.slerp(_insQ, k);
  _restS.lerp(_one, k);
  _restW.compose(_restP, _restQ, _restS);
  _parentInv.copy(m.parent.matrixWorld).invert();
  _restW.premultiply(_parentInv);
  _restW.decompose(m.position, m.quaternion, m.scale);
}

function animateBooks(dt) {
  for (const m of books) {
    const u = m.userData;
    const prevPull = u.pull;
    u.pull = damp(u.pull, u.targetPull, 9, dt);
    const prevInsp = u.insp || 0;
    u.insp = damp(prevInsp, runtime.opened === m ? 1 : 0, 6.5, dt);
    if (u.insp < 0.001) u.insp = 0;
    const inspEase = u.insp * u.insp * (3 - 2 * u.insp);
    if ((u.insp > 0) !== (prevInsp > 0)) {
      // Held books stop casting so no stale cached shadow is left behind.
      m.castShadow = u.insp === 0;
      runtime.shadowsDirty = true;
    }

    if (u.onTable) {
      // Table/ledge meshes have a fixed pose inside their wrap; restore it each
      // frame so the inspect blend below always starts from rest.
      if (!u.restLocal) u.restLocal = { p: m.position.clone(), q: m.quaternion.clone() };
      const root = u.tableRoot;
      if (u.onGuestLedge) {
        root.position.set(u.baseX, u.baseY + u.pull * 0.02, u.baseZ + u.pull * 0.22);
        root.rotation.set(u.pull * 0.1, u.baseYaw, 0);
      } else {
        // v1 behaviour: lift gently toward the viewer, keep the cover-up pose.
        root.position.set(u.baseX, u.baseY + u.pull * 0.08, u.baseZ + u.pull * 0.06);
        root.rotation.set(0, u.baseYaw, 0);
      }
      m.position.copy(u.restLocal.p);
      m.quaternion.copy(u.restLocal.q);
      m.scale.set(1, 1, 1);
      if (inspEase > 0) applyInspect(m, inspEase);
      continue;
    }

    const ct = runtime.coverT;
    const ease = ct * ct * (3 - 2 * ct);
    const bx = THREE.MathUtils.lerp(u.baseX, u.coverPos.x, ease);
    const by = THREE.MathUtils.lerp(u.baseY, u.coverPos.y, ease);
    const bz = THREE.MathUtils.lerp(u.baseZ, u.coverPos.z, ease);
    const pullYaw = u.coverRotY + Math.PI / 2;
    const step = u.pull * 0.24;

    m.position.set(
      bx - Math.sin(pullYaw) * step * ease,
      by + u.pull * 0.03 * (1 - ease),
      bz + u.pull * 0.16 * (1 - ease) + Math.cos(pullYaw) * step * ease
    );

    const shelfRotY = u.pull * 0.42;
    m.rotation.x = 0; // clear any tilt left by the inspect blend
    m.rotation.y = THREE.MathUtils.lerp(shelfRotY, u.coverRotY, ease);
    m.rotation.z = u.baseRotZ * (1 - u.pull) * (1 - ease);
    m.scale.setScalar(THREE.MathUtils.lerp(1, u.coverScale, ease));
    if (inspEase > 0) applyInspect(m, inspEase);

    if (Math.abs(u.pull - prevPull) > 0.008) {
      runtime.shadowsDirty = true;
    }
  }
}

/* ---- Rainy Dusk lightning ----
   First strike 15–30 s after night sets in, then every 60–120 s. A soft flash
   (sometimes a double flicker, never a strobe) lights the sky and washes the
   room through the window; thunder follows 1–4 s later. Reduced-motion
   visitors get the thunder without the flash. Shadows are not re-rendered. */
let nextStrike = -1;
let strike = null;
function triggerStrike(elapsed) {
  const delay = 1 + Math.random() * 3;
  strike = { t0: elapsed, power: 0.45 + Math.random() * 0.3, double: Math.random() < 0.45 };
  audio.playThunder?.(delay, 1 - (delay - 1) / 3);
}
function updateStorm(elapsed) {
  const night = runtime.inRoom && runtime.moodT > 0.9;
  if (!night) {
    nextStrike = -1;
  } else if (nextStrike < 0) {
    nextStrike = elapsed + 15 + Math.random() * 15;
  } else if (elapsed >= nextStrike) {
    nextStrike = elapsed + 60 + Math.random() * 60;
    triggerStrike(elapsed);
  }
  let f = 0;
  if (strike) {
    const d = elapsed - strike.t0;
    // Hold briefly at peak, then fade (~0.3 s); an optional second flicker
    f = strike.power * (d < 0.06 ? 1 : Math.exp(-(d - 0.06) / 0.12));
    if (strike.double && d > 0.24) f += strike.power * 0.7 * (d < 0.29 ? 1 : Math.exp(-(d - 0.29) / 0.12));
    if (d > 1.2) strike = null;
  }
  runtime.flash = REDUCED_MOTION ? 0 : f;
}

function animate() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const elapsed = clock.elapsedTime;

  // Smoothly interpolate Golden Hour (0) <-> Cozy Rainy Dusk (1)
  const targetMoodT = runtime.mood === 'rain' ? 1 : 0;
  if (Math.abs(runtime.moodT - targetMoodT) > 0.0005) {
    runtime.moodT = damp(runtime.moodT, targetMoodT, 2.8, dt);
    runtime.shadowsDirty = true;
  } else {
    runtime.moodT = targetMoodT;
  }

  controlsApi.updateMovement(elapsed, dt);
  controlsApi.updateHover();

  bookcaseApi.update(dt);
  animateBooks(dt);

  updateStorm(elapsed);
  lighting.updateMood(elapsed);
  exterior.update(elapsed, dt);
  windowNook.update(elapsed, dt);
  turntable.update(dt, audio.isPlaying(), audio.sideProgress());
  guestbookApi.update(elapsed, dt);
  audio.updateListener(camera);

  monitorPerformance(rawDt, () => {
    engine.syncQuality();
    lighting.applyShadowQuality();
    syncHud();
  });

  engine.renderFrame(dt);
  requestAnimationFrame(animate);
}

// Dismiss loading overlay once initial shaders & scene compile, then defer
// non-critical GitHub Issues / Worker quota fetch by 2 animation frames.
const loadingEl = document.getElementById('loading');
if (loadingEl) loadingEl.style.display = 'none';

animate();
requestAnimationFrame(() => requestAnimationFrame(() => guestbookApi.startNetworkSync()));
