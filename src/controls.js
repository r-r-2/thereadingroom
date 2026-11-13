/* First-person Controls, Collision, Subtle Head-Bob & Raycast Interactions:
   - Desktop: PointerLockControls + WASD / Arrow movement + keyboard shortcuts
     (`C` covers, `M` mood Golden Hour ↔ Rainy Dusk, `B` head-bob toggle)
   - Mobile / Touch: first-person drag-to-look + virtual walk stick + tap raycast
   - Subtle, toggleable footstep-synced figure-8 head-bob (~7.5 mm vertical, zero roll)
     + 1.5 mm idle breathing, automatically damped to 0 when aiming at an
     interactable or inspecting a book (and respects `prefers-reduced-motion`).
   - Surface-aware footsteps (oak floor planks vs. woven center wool rug).
   - Preserves the `NaN`-safe movement guard documented in `GOTCHAS.md`. */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
  ROOM,
  EYE,
  CASE,
  TABLE,
  STAND,
  NOOK,
  GUEST_TABLE,
  damp
} from './constants.js';
import {
  SETTINGS,
  EDIT,
  runtime,
  interactables,
  savePrefs,
  track
} from './state.js';
import { RUG_BOUNDS } from './room.js';
import { showDetailCover } from './books.js';

export function setupControlsAndInteractions({
  camera,
  renderer,
  audio,
  bookcaseApi,
  guestbookApi,
  onMoodToggle,
  onQualityCycle,
  onHudSync,
  gui
}) {
  const controls = new PointerLockControls(camera, document.body);

  const gate = document.getElementById('gate');
  const gateKeys = document.getElementById('gate-keys');
  const hud = document.getElementById('hud');
  const touchUi = document.getElementById('touch-ui');
  const stickEl = document.getElementById('stick');
  const stickKnob = document.getElementById('stick-knob');
  const touchCoversBtn = document.getElementById('touch-covers');
  const touchMoodBtn = document.getElementById('touch-mood');
  const touchGuestBtn = document.getElementById('touch-guest');
  const touchLeaveBtn = document.getElementById('touch-leave');

  const crosshair = document.getElementById('crosshair');
  const promptEl = document.getElementById('prompt');
  const detailEl = document.getElementById('detail');
  const dSwatch = document.getElementById('d-swatch');
  const dTitle = document.getElementById('d-title');
  const dAuthor = document.getElementById('d-author');
  const dMeta = document.getElementById('d-meta');
  const dBar = document.getElementById('d-bar');
  const dBarFill = document.getElementById('d-bar-fill');
  const dNote = document.getElementById('d-note');
  const dReviewWrap = document.getElementById('d-review-wrap');
  const dReview = document.getElementById('d-review');
  const dClose = document.getElementById('d-close');

  function applyTouchGateCopy() {
    document.body.classList.add('touch');
    if (gateKeys) gateKeys.innerHTML = '<span>Drag</span> to look &nbsp;·&nbsp; <span>Stick</span> to walk &nbsp;·&nbsp; <span>Tap</span> a book &nbsp;·&nbsp; <span>Tap</span> the record';
    const cta = document.getElementById('gate-cta');
    if (cta) cta.textContent = 'Tap to enter';
  }
  if (runtime.useTouch) applyTouchGateCopy();

  function setTouchUiVisible(v) {
    touchUi?.classList.toggle('on', Boolean(v));
  }

  let hasEnteredOnce = false;
  let lastLeaveAt = 0;

  function onEnterRoom(method) {
    runtime.inRoom = true;
    gate.classList.add('hidden');
    document.body.classList.remove('paused');
    hud.style.opacity = '1';
    if (runtime.useTouch) setTouchUiVisible(true);
    if (EDIT && gui) gui.hide();
    if (!hasEnteredOnce) {
      hasEnteredOnce = true;
      audio.start();
      guestbookApi.showFirstVisitToast();
    }
    onHudSync?.();
    track('room_enter', { method });
  }

  function onLeaveRoom() {
    runtime.inRoom = false;
    lastLeaveAt = performance.now();
    gate.classList.remove('hidden');
    // After the first visit, Esc keeps the pill bar visible and clickable above
    // the gate (Leave a book, Vinyl, Quality…); before it, the intro stays clean.
    document.body.classList.toggle('paused', hasEnteredOnce);
    hud.style.opacity = hasEnteredOnce ? '1' : '0';
    setTouchUiVisible(false);
    promptEl.classList.remove('show');
    if (EDIT && gui) gui.show();
  }

  controls.addEventListener('lock', () => onEnterRoom('pointer'));
  controls.addEventListener('unlock', () => {
    if (runtime.guestbookOpen) return;
    onLeaveRoom();
  });

  /* Re-capturing the mouse can be refused (Esc keydown is not an accepted
     gesture, and browsers impose a ~1 s cooldown after a release). Without a
     fallback the room stays "entered" with no pointer lock: the view can't be
     turned and nothing re-captures it. Drop to the paused gate instead, where
     one click re-enters. */
  function fallBackToGate() {
    if (runtime.useTouch || controls.isLocked || runtime.guestbookOpen || !runtime.inRoom) return;
    onLeaveRoom();
  }
  document.addEventListener('pointerlockerror', fallBackToGate);
  function relockPointer() {
    try {
      const p = controls.domElement.requestPointerLock?.();
      p?.catch?.(fallBackToGate);   // newer browsers return a promise
    } catch { fallBackToGate(); }
    setTimeout(fallBackToGate, 400);  // browsers that refuse silently
  }

  function enterTouch() {
    if (runtime.inRoom || performance.now() - lastLeaveAt < 350) return;
    if (!runtime.useTouch) {
      runtime.useTouch = true;
      applyTouchGateCopy();
    }
    onEnterRoom('touch');
  }

  gate.addEventListener('click', () => {
    if (runtime.guestbookOpen || performance.now() - lastLeaveAt < 350) return;
    if (runtime.useTouch) enterTouch();
    else controls.lock();
  });
  gate.addEventListener('touchend', (e) => {
    // Allow clicking links inside gate-foot (such as "Visit v1") without hijacking tap
    if (e.target.closest('a')) return;
    if (runtime.guestbookOpen) return;
    e.preventDefault();
    enterTouch();
  }, { passive: false });

  /* ---- Keyboard Input (NaN-safe explicit boolean map) ---- */
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (runtime.guestbookOpen) {
      if (e.code === 'Escape') { e.preventDefault(); guestbookApi.closeGuestbook(true); }
      return;
    }
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    keys[e.code] = true;
    if (e.code === 'KeyC' && (controls.isLocked || runtime.inRoom)) {
      bookcaseApi.toggleCoverMode('key', closeBook, audio.playSfx);
      onHudSync?.();
    } else if (e.code === 'KeyM' && (controls.isLocked || runtime.inRoom)) {
      onMoodToggle?.('key');
    } else if (e.code === 'KeyB' && (controls.isLocked || runtime.inRoom)) {
      runtime.headBob = !runtime.headBob;
      savePrefs();
      onHudSync?.();
    } else if ((e.code === 'KeyQ' || e.code === 'KeyG') && (controls.isLocked || runtime.inRoom)) {
      onQualityCycle?.();
    } else if (e.code === 'KeyV' && (controls.isLocked || runtime.inRoom)) {
      audio.toggle();
      audio.playSfx('switch');
      onHudSync?.();
    } else if (e.code === 'KeyL' && (controls.isLocked || runtime.inRoom)) {
      e.preventDefault(); // don't type "l" into the form that opens
      guestbookApi.openGuestbook('form', 'key');
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  /* ---- Book Detail Drawer ---- */
  function showDetail(b) {
    dSwatch.style.background = b.c;
    showDetailCover(b.coverUrl);
    dTitle.textContent = b.t;
    dTitle.href = b.isbn
      ? `https://openlibrary.org/isbn/${b.isbn}`
      : `https://openlibrary.org/search?q=${encodeURIComponent(`${b.t} ${b.a || ''}`.trim())}`;
    dAuthor.textContent = b.a || '';
    if (b.guest) {
      dMeta.textContent = b.pending
        ? `Guest recommendation · waiting for approval`
        : `Guest recommendation${b.guestAt ? ` · ${b.guestAt}` : ''}`;
      dBar.style.display = 'none';
    } else if (b.reading) {
      dMeta.textContent = `Currently reading · ${b.reading}%`;
      dBar.style.display = 'block';
      dBarFill.style.width = `${b.reading}%`;
    } else {
      dMeta.textContent = `Finished ${b.fin}`;
      dBar.style.display = 'none';
    }
    dNote.textContent = b.note || '';
    dNote.style.display = b.note ? 'block' : 'none';
    dReview.textContent = b.review || '';
    dReviewWrap.style.display = b.review ? 'block' : 'none';
    detailEl.classList.add('open');
  }

  function closeBook() {
    if (!runtime.opened) return;
    runtime.opened.userData.targetPull = 0;
    runtime.opened = null;
    detailEl.classList.remove('open');
    audio.playSfx('book_close');
  }

  dTitle?.addEventListener('click', () => {
    const b = runtime.opened?.userData?.book;
    if (b) track('openlibrary_click', { title: b.t, isbn: b.isbn || '' });
  });

  dClose?.addEventListener('click', (e) => { e.stopPropagation(); closeBook(); });

  /* ---- Raycast Hover & Click/Tap Dispatch ---- */
  const raycaster = new THREE.Raycaster();
  raycaster.far = 3.4;
  const center = new THREE.Vector2(0, 0);

  function updateHover() {
    if (runtime.useTouch || !controls.isLocked) {
      runtime.looked = null;
      crosshair.classList.remove('hit');
      promptEl.classList.remove('show');
      return;
    }
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    const hit = hits[0]?.object || null;
    if (hit !== runtime.looked) {
      runtime.looked = hit;
      if (runtime.looked) {
        crosshair.classList.add('hit');
        if (runtime.looked.userData.turntable) {
          promptEl.textContent = audio.isPlaying() ? 'Click to lift needle' : 'Click to play record';
        } else if (runtime.looked.userData.lever) {
          promptEl.textContent = runtime.coverMode ? 'Click to shelve books' : 'Click to float covers';
        } else if (runtime.looked.userData.moodSwitch) {
          promptEl.textContent = runtime.mood === 'rain'
            ? 'Click for Golden Hour'
            : 'Click for Cozy Rainy Dusk';
        } else if (runtime.looked.userData.guestbook) {
          promptEl.textContent = 'Click to read the guestbook';
        } else if (runtime.looked.userData.guestAdd) {
          promptEl.textContent = 'Click to leave a book on the table';
        } else {
          const b = runtime.looked.userData.book;
          promptEl.textContent = runtime.opened === runtime.looked
            ? 'Click to put back'
            : `Click to inspect “${b.t}”`;
        }
        promptEl.classList.add('show');
      } else {
        crosshair.classList.remove('hit');
        promptEl.classList.remove('show');
      }
    }
  }

  function handleTarget(target, source = 'pointer') {
    if (!target) {
      if (runtime.opened) closeBook();
      return;
    }
    if (target.userData.turntable) {
      const on = audio.toggle();
      audio.playSfx('switch');
      onHudSync?.();
      track('turntable_toggle', { playing: on });
      if (!runtime.useTouch) {
        promptEl.textContent = on ? 'Click to lift needle' : 'Click to play record';
      }
      return;
    }
    if (target.userData.lever) {
      bookcaseApi.toggleCoverMode(source, closeBook, audio.playSfx);
      onHudSync?.();
      if (!runtime.useTouch) {
        promptEl.textContent = runtime.coverMode ? 'Click to shelve books' : 'Click to float covers';
      }
      return;
    }
    if (target.userData.moodSwitch) {
      onMoodToggle?.('sill_switch');
      if (!runtime.useTouch) {
        promptEl.textContent = runtime.mood === 'rain'
          ? 'Click for Golden Hour'
          : 'Click for Cozy Rainy Dusk';
      }
      return;
    }
    if (target.userData.guestbook) { guestbookApi.openGuestbook('book', source); return; }
    if (target.userData.guestAdd) { guestbookApi.openGuestbook('form', source); return; }

    if (runtime.opened === target) {
      closeBook();
      if (!runtime.useTouch) promptEl.textContent = `Click to inspect “${target.userData.book.t}”`;
    } else {
      if (runtime.opened) runtime.opened.userData.targetPull = 0;
      runtime.opened = target;
      target.userData.targetPull = 1;
      audio.playSfx('book_open');
      showDetail(target.userData.book);
      const b = target.userData.book;
      track('book_open', {
        title: b.t,
        author: b.a,
        isbn: b.isbn || '',
        shelf: b.guest ? 'guest_table' : b.reading ? 'reading_table' : (b.row || 'shelf'),
        status: b.guest ? (b.pending ? 'guest_pending' : 'guest') : b.reading ? 'reading' : 'finished',
        cover_mode: runtime.coverMode
      });
      if (!runtime.useTouch) promptEl.textContent = 'Click to put back';
    }
  }

  window.addEventListener('mousedown', (e) => {
    if (runtime.useTouch || !controls.isLocked || e.button !== 0) return;
    handleTarget(runtime.looked, 'pointer');
  });

  /* ---- Mobile / Touch Controls (Virtual Stick + Drag-to-Look + Tap Raycast) ---- */
  const stickVec = { x: 0, y: 0 };
  let stickTouchId = null;
  let stickOrigin = { x: 0, y: 0 };
  const STICK_MAX = 40;

  let lookTouchId = null;
  let lookStart = { x: 0, y: 0, t: 0 };
  let lookLast = { x: 0, y: 0 };
  let lookMoved = false;
  const touchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const LOOK_SENS = 0.0032;
  const TAP_MOVE_PX = 12;
  const TAP_MAX_MS = 350;
  const tapNdc = new THREE.Vector2();

  stickEl?.addEventListener('touchstart', (e) => {
    if (stickTouchId !== null) return;
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    const r = stickEl.getBoundingClientRect();
    stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    updateStick(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  function updateStick(cx, cy) {
    let dx = cx - stickOrigin.x;
    let dy = cy - stickOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_MAX) { dx = (dx / len) * STICK_MAX; dy = (dy / len) * STICK_MAX; }
    if (stickKnob) stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    stickVec.x = dx / STICK_MAX;
    stickVec.y = dy / STICK_MAX;
  }

  function resetStick() {
    stickTouchId = null;
    stickVec.x = 0; stickVec.y = 0;
    if (stickKnob) stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  renderer.domElement.addEventListener('touchstart', (e) => {
    if (!runtime.useTouch || !runtime.inRoom || lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookStart = { x: t.clientX, y: t.clientY, t: performance.now() };
    lookLast = { x: t.clientX, y: t.clientY };
    lookMoved = false;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        updateStick(t.clientX, t.clientY);
        e.preventDefault();
      } else if (t.identifier === lookTouchId) {
        const dx = t.clientX - lookLast.x;
        const dy = t.clientY - lookLast.y;
        lookLast = { x: t.clientX, y: t.clientY };
        if (Math.hypot(t.clientX - lookStart.x, t.clientY - lookStart.y) > TAP_MOVE_PX) {
          lookMoved = true;
        }
        touchEuler.setFromQuaternion(camera.quaternion);
        touchEuler.y -= dx * LOOK_SENS;
        touchEuler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, touchEuler.x - dy * LOOK_SENS));
        camera.quaternion.setFromEuler(touchEuler);
        e.preventDefault();
      }
    }
  }, { passive: false });

  function endTouches(e, cancelled) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) resetStick();
      else if (t.identifier === lookTouchId) {
        const isTap = !cancelled && !lookMoved && (performance.now() - lookStart.t) < TAP_MAX_MS;
        lookTouchId = null;
        if (isTap && runtime.inRoom) tapInteract(t.clientX, t.clientY);
      }
    }
  }
  window.addEventListener('touchend', (e) => endTouches(e, false));
  window.addEventListener('touchcancel', (e) => endTouches(e, true));

  function tapInteract(cx, cy) {
    tapNdc.x = (cx / window.innerWidth) * 2 - 1;
    tapNdc.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(tapNdc, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    handleTarget(hits[0]?.object || null, 'touch');
  }

  touchCoversBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    bookcaseApi.toggleCoverMode('touch', closeBook, audio.playSfx);
    onHudSync?.();
  });
  touchMoodBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    onMoodToggle?.('touch');
  });
  touchGuestBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    guestbookApi.openGuestbook('form', 'touch');
  });
  touchLeaveBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetStick();
    lookTouchId = null;
    if (runtime.opened) closeBook();
    onLeaveRoom();
  });

  /* ---- Movement, Furniture Collision & Subtle Toggleable Head-Bob ---- */
  const velocity = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const NOOK_SPAN_HALF = NOOK.winW / 2 + NOOK.frameT + NOOK.towerW;

  let bobPhase = 0;
  let bobAmp = 0;
  let lastStepHalfCycle = 0;

  function updateMovement(t, dt) {
    if (controls.isLocked || (runtime.useTouch && runtime.inRoom)) {
      // NaN-safe explicit ternaries (never Number(keys[...]))
      const kbZ = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const kbX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      dir.z = kbZ - stickVec.y;
      dir.x = kbX + stickVec.x;
      const dLen = Math.hypot(dir.x, dir.z);
      if (dLen > 1) { dir.x /= dLen; dir.z /= dLen; }

      const speed = SETTINGS.moveSpeed;
      velocity.x = damp(velocity.x, dir.x * speed, 10, dt);
      velocity.z = damp(velocity.z, dir.z * speed, 10, dt);
      controls.moveRight(velocity.x * dt);
      controls.moveForward(velocity.z * dt);

      const p = camera.position;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) {
        p.set(0, EYE, 2.6);
        velocity.set(0, 0, 0);
      }

      // Room walls
      const pad = 0.35;
      p.x = Math.max(-ROOM.w / 2 + pad, Math.min(ROOM.w / 2 - pad, p.x));
      p.z = Math.max(-ROOM.d / 2 + pad, Math.min(ROOM.d / 2 - pad, p.z));

      // Bookcase footprint
      const caseFrontZ = -ROOM.d / 2 + CASE.d + 0.03 + 0.34;
      if (Math.abs(p.x) < CASE.w / 2 + 0.25 && p.z < caseFrontZ) p.z = caseFrontZ;

      // Credenza / Turntable footprint
      const standLeftX = ROOM.w / 2 - STAND.d - 0.06 - 0.3;
      if (Math.abs(p.z - -0.4) < STAND.w / 2 + 0.22 && p.x > standLeftX) p.x = standLeftX;

      // Reading table footprint
      const tHalfX = TABLE.w / 2 + 0.28, tHalfZ = TABLE.d / 2 + 0.28;
      const dxT = p.x - TABLE.x, dzT = p.z - TABLE.z;
      if (Math.abs(dxT) < tHalfX && Math.abs(dzT) < tHalfZ) {
        if (tHalfX - Math.abs(dxT) < tHalfZ - Math.abs(dzT)) {
          p.x = TABLE.x + Math.sign(dxT || 1) * tHalfX;
        } else {
          p.z = TABLE.z + Math.sign(dzT || 1) * tHalfZ;
        }
      }

      // Left-wall Book Nook bench & curio towers
      const nookFrontX = -ROOM.w / 2 + NOOK.seatD + 0.26;
      if (Math.abs(p.z - NOOK.worldZ) < NOOK_SPAN_HALF + 0.18 && p.x < nookFrontX) {
        p.x = nookFrontX;
      }

      // Guest table footprint
      const gHalfX = GUEST_TABLE.w / 2 + 0.28, gHalfZ = GUEST_TABLE.d / 2 + 0.28;
      const dxG = p.x - GUEST_TABLE.x, dzG = p.z - GUEST_TABLE.z;
      if (Math.abs(dxG) < gHalfX && Math.abs(dzG) < gHalfZ) {
        if (gHalfX - Math.abs(dxG) < gHalfZ - Math.abs(dzG)) {
          p.x = GUEST_TABLE.x + Math.sign(dxG || 1) * gHalfX;
        } else {
          p.z = GUEST_TABLE.z + Math.sign(dzG || 1) * gHalfZ;
        }
      }

      // Footstep cadence + subtle toggleable head-bob (freezes when hovering/inspecting)
      const moveMag = Math.min(1, Math.hypot(velocity.x, velocity.z) / Math.max(0.1, speed));
      if (moveMag > 0.12) {
        bobPhase += dt * (7.6 + moveMag * 2.2);
        const halfCycle = Math.floor(bobPhase / Math.PI);
        if (halfCycle !== lastStepHalfCycle) {
          lastStepHalfCycle = halfCycle;
          const onRug = (
            p.x >= RUG_BOUNDS.minX && p.x <= RUG_BOUNDS.maxX &&
            p.z >= RUG_BOUNDS.minZ && p.z <= RUG_BOUNDS.maxZ
          );
          audio.playFootstep(onRug);
        }
      }

      const freezeForFocus = Boolean(runtime.looked || runtime.opened);
      const targetBob = (runtime.headBob && !freezeForFocus) ? moveMag : 0;
      bobAmp = damp(bobAmp, targetBob, 10, dt);

      const walkOffsetY = Math.sin(bobPhase * 2) * 0.0075 * bobAmp;
      const idleBreathY = (runtime.headBob && !freezeForFocus)
        ? Math.sin(t * 1.45) * 0.0014 * (1 - bobAmp)
        : 0;
      p.y = EYE + walkOffsetY + idleBreathY;
    } else {
      camera.position.y = EYE;
    }
  }

  return {
    controls,
    relockPointer,
    closeBook,
    setTouchUiVisible,
    updateHover,
    updateMovement,
    enterRoom: () => {
      if (runtime.useTouch) enterTouch();
      else onEnterRoom('harness');
    },
    leaveRoom: () => {
      if (controls.isLocked) controls.unlock();
      else onLeaveRoom();
    },
    interact: (obj) => handleTarget(obj, 'harness')
  };
}
