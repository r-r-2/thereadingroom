/* Spatial Web Audio Engine for The Reading Room v2:
   1. Ambient synth LP ("Afternoon Study") routed through an HRTF 3D `PannerNode`
      positioned at the right-wall turntable platter (so turning your head or
      walking toward the nook naturally shifts stereo perspective).
   2. Fixes v1's `voices[]` memory leak by pruning oscillators via `onended`.
   3. Gentle filtered pink-noise Rainy Dusk ambiance outside the left-wall
      window (`moodT`), spatialized to the window opening.
   4. Subtle procedural foley:
      - Surface-aware footsteps (oak plank tap vs. soft wool rug thud)
      - Tactile paper/cloth slide when pulling or shelving a book
      - Brass mechanical click on wall lever / mood switch / turntable needle */

import * as THREE from 'three';
import { ROOM, NOOK } from './constants.js';
import { SETTINGS, runtime } from './state.js';

export function createAudioEngine(turntableWorldPos) {
  let ctx = null;
  let master = null;
  let footNoise = null; // cached pink-noise buffer for footstep scuffs
  let musicBus = null;
  let panner = null;
  let hissNode = null;
  let rainGain = null;
  let rainPanner = null;

  let playing = false;
  let started = false;
  let timer = null;
  let step = 0;
  const activeVoices = new Set();

  const CHORDS = [
    [261.63, 329.63, 392.0, 493.88],
    [220.0,  261.63, 329.63, 392.0],
    [174.61, 220.0,  261.63, 349.23],
    [196.0,  246.94, 293.66, 392.0]
  ];
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5];
  const SIDE_STEPS = 40;

  function registerVoice(osc) {
    activeVoices.add(osc);
    osc.onended = () => activeVoices.delete(osc);
  }

  function makeNoiseBuffer(seconds, pink = false) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (pink) {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      } else {
        d[i] = white * 0.25 + (Math.random() < 0.0008 ? (Math.random() - 0.5) * 2.2 : 0);
      }
    }
    return buf;
  }

  function init() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);

    /* ---- 1. HRTF Spatialized Turntable Bus ---- */
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0001;

    panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.6;
    panner.maxDistance = 16;
    panner.rolloffFactor = 0.55;
    panner.positionX.value = turntableWorldPos.x;
    panner.positionY.value = turntableWorldPos.y;
    panner.positionZ.value = turntableWorldPos.z;

    musicBus.connect(panner).connect(master);

    // Warm slapback tape delay on the synth LP
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    const dFilter = ctx.createBiquadFilter();
    dFilter.type = 'lowpass';
    dFilter.frequency.value = 1800;
    delay.connect(dFilter).connect(fb).connect(delay);
    delay.connect(wet).connect(musicBus);
    init._delay = delay;

    // Subtle vinyl surface crackle
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = makeNoiseBuffer(3, false);
    hissSrc.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2600;
    hp.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.value = 0.015;
    hissSrc.connect(hp).connect(hg).connect(musicBus);
    hissSrc.start();
    hissNode = hissSrc;

    /* ---- 2. Spatialized Rainy-Dusk Window Ambiance ---- */
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = makeNoiseBuffer(4, true);
    rainSrc.loop = true;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 1150;

    rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;

    rainPanner = ctx.createPanner();
    rainPanner.panningModel = 'HRTF';
    rainPanner.distanceModel = 'inverse';
    rainPanner.refDistance = 3.0;
    rainPanner.rolloffFactor = 0.45;
    rainPanner.positionX.value = -ROOM.w / 2;
    rainPanner.positionY.value = NOOK.sill + NOOK.winH * 0.5;
    rainPanner.positionZ.value = NOOK.worldZ;

    rainSrc.connect(rainLp).connect(rainGain).connect(rainPanner).connect(master);
    rainSrc.start();
  }

  function padNote(freq, dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';
    o1.frequency.value = freq;
    o2.frequency.value = freq * 1.003;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 1.4);
    g.gain.setValueAtTime(0.09, t + dur - 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(musicBus);
    g.connect(init._delay);

    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    registerVoice(o1);
    registerVoice(o2);
  }

  function pluck(freq, delaySec = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delaySec;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 1.8);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);

    o.connect(lp).connect(g);
    g.connect(musicBus);
    g.connect(init._delay);

    o.start(t);
    o.stop(t + 2.5);
    registerVoice(o);
  }

  function bar() {
    if (!playing) return;
    const chord = CHORDS[step % CHORDS.length];
    chord.forEach((f) => padNote(f, 5.2));
    padNote(chord[0] / 2, 5.2);
    const notes = 2 + (step % 2);
    for (let i = 0; i < notes; i++) {
      const f = SCALE[(step * 3 + i * 2) % SCALE.length];
      pluck(f, 0.8 + i * 1.45);
    }
    step++;
  }

  /* ---- 3. Subtle Procedural Foley Effects ---- */
  function playFootstep(onRug = false) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = onRug ? 72 + Math.random() * 14 : 118 + Math.random() * 26;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + (onRug ? 0.075 : 0.055));

    const g = ctx.createGain();
    const amp = (onRug ? 0.028 : 0.04) * Math.min(1, SETTINGS.volume * 2.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (onRug ? 0.085 : 0.06));

    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.09);

    // Short filtered-noise scuff: the low thump alone is inaudible on laptop/phone
    // speakers. Crisp heel tap on oak, duller brush on the wool rug.
    if (!footNoise) footNoise = makeNoiseBuffer(0.25, true);
    const src = ctx.createBufferSource();
    src.buffer = footNoise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter();
    if (onRug) {
      f.type = 'lowpass';
      f.frequency.value = 650 + Math.random() * 150;
    } else {
      f.type = 'bandpass';
      f.frequency.value = 1500 + Math.random() * 500;
      f.Q.value = 1.1;
    }
    const sg = ctx.createGain();
    const len = onRug ? 0.07 : 0.045;
    const sAmp = (onRug ? 0.05 : 0.07) * Math.min(1, SETTINGS.volume * 2.5);
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(sAmp, t + 0.004);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(sg).connect(master);
    src.start(t, Math.random() * 0.15);
    src.stop(t + len + 0.01);
  }

  /* Thunder: brown-ish noise through a low-pass, swelling then rolling off,
     placed at the window via HRTF. `delay` seconds after the flash; closer
     strikes (short delay) are louder and a little brighter. */
  let thunderBuf = null;
  let thunderPanner = null;
  function playThunder(delay = 2, strength = 0.6) {
    if (!ctx || ctx.state !== 'running') return;
    const vol = Math.min(1, SETTINGS.volume * 2.5);
    if (vol <= 0.01) return;
    if (!thunderBuf) {
      const len = Math.floor(ctx.sampleRate * 4.5);
      thunderBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = thunderBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;   // brown noise
        d[i] = last * 3.2;
      }
    }
    if (!thunderPanner) {
      thunderPanner = ctx.createPanner();
      thunderPanner.panningModel = 'HRTF';
      thunderPanner.distanceModel = 'inverse';
      thunderPanner.refDistance = 3.0;
      thunderPanner.rolloffFactor = 0.3;
      thunderPanner.positionX.value = -ROOM.w / 2 - 2;
      thunderPanner.positionY.value = NOOK.sill + NOOK.winH;
      thunderPanner.positionZ.value = NOOK.worldZ;
      thunderPanner.connect(master);
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = thunderBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140 + strength * 160;
    const g = ctx.createGain();
    const peak = (0.18 + 0.32 * strength) * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.25 + (1 - strength) * 0.5);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.0);
    src.connect(lp).connect(g).connect(thunderPanner);
    src.start(t);
    src.stop(t + 4.2);
  }

  function playSfx(kind) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const volScale = Math.min(1, SETTINGS.volume * 2.4);
    if (volScale <= 0.01) return;

    if (kind === 'book_open' || kind === 'book_close') {
      // Soft tactile paper/cloth whisper
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(0.16, true);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = kind === 'book_open' ? 920 : 680;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.065 * volScale, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(bp).connect(g).connect(master);
      src.start(t);
    } else if (kind === 'lever' || kind === 'switch') {
      // Crisp brass toggle click
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(kind === 'lever' ? 290 : 520, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.045);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 * volScale, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.055);
    }
  }

  const _fwd = new THREE.Vector3();
  const _up = new THREE.Vector3();

  function updateListener(camera) {
    if (!ctx || ctx.state !== 'running') return;
    const listener = ctx.listener;
    const p = camera.position;
    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    if (listener.positionX) {
      listener.positionX.value = p.x;
      listener.positionY.value = p.y;
      listener.positionZ.value = p.z;
      listener.forwardX.value = _fwd.x;
      listener.forwardY.value = _fwd.y;
      listener.forwardZ.value = _fwd.z;
      listener.upX.value = _up.x;
      listener.upY.value = _up.y;
      listener.upZ.value = _up.z;
    } else {
      listener.setPosition(p.x, p.y, p.z);
      listener.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z);
    }

    // Smoothly fade Rainy Dusk window audio with moodT
    if (rainGain) {
      const targetRain = runtime.inRoom ? runtime.moodT * SETTINGS.volume * 0.48 : 0.0;
      rainGain.gain.setTargetAtTime(targetRain, ctx.currentTime, 0.25);
    }
  }

  return {
    start() {
      init();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return;
      playing = true;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(SETTINGS.volume, ctx.currentTime + 0.8);
      if (!started) { started = true; bar(); }
      else bar();
      timer = setInterval(bar, 4800);
    },
    stop() {
      if (!ctx || !playing) return;
      playing = false;
      clearInterval(timer); timer = null;
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), t);
      musicBus.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      for (const v of activeVoices) {
        try { v.stop(t + 0.36); } catch { /* already stopped */ }
      }
      activeVoices.clear();
    },
    toggle() {
      this.isPlaying() ? this.stop() : this.start();
      return playing;
    },
    isPlaying: () => playing,
    sideProgress: () => (step % SIDE_STEPS) / SIDE_STEPS,
    setVolume(v) {
      SETTINGS.volume = v;
      if (!ctx || !playing) return;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(Math.max(v, 0.0001), ctx.currentTime + 0.08);
    },
    playFootstep,
    playThunder,
    playSfx,
    updateListener,
    _hiss: () => hissNode
  };
}
