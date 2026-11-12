/* Shared mutable runtime state, feature flags, and single-source-of-truth
   SETTINGS (used both at scene initialisation and by `?edit=1` lil-gui). */

const params = new URLSearchParams(location.search);

export const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
export const EDIT = params.has('edit');
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

const PREF_KEY = 'rr-v2-prefs';
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
const saved = loadPrefs();

export function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({
      mood: runtime.mood,
      headBob: runtime.headBob,
      quality: runtime.quality,
      qualityChosen: runtime.qualityChosen
    }));
  } catch { /* ignore private browsing */ }
}

/* Single source of truth for look, lighting, movement & audio.
   Unlike v1, scene objects initialise directly from SETTINGS so `?edit=1`
   sliders always match actual scene values. */
export const SETTINGS = {
  exposure: 1.02,
  effects: true,
  aoEnabled: !TOUCH,
  aoIntensity: 1.85,
  aoRadius: 0.42,
  bloomStrength: 0.22,
  bloomRadius: 0.58,
  bloomThreshold: 0.88,
  vignetteOffset: 0.32,
  vignetteDarkness: 0.52,
  envIntensity: 0.42,
  fogNear: 9.5,
  fogFar: 23,
  ambientIntensity: 0.42,
  ambientColor: '#fff1e2',
  hemiIntensity: 0.52,
  sunIntensity: 2.35,
  sunColor: '#ffe2be',
  sunX: -6.8,
  sunY: 3.7,
  sunZ: 0.35,
  fillIntensity: 0.28,
  fillColor: '#f6eadc',
  windowBounce: 1.35,
  moveSpeed: 2.4,
  fov: 68,
  volume: 0.34
};

export const runtime = {
  useTouch: TOUCH,
  inRoom: false,
  guestbookOpen: false,
  coverMode: false,
  coverT: 0,
  mood: saved.mood === 'rain' ? 'rain' : 'golden',   // 'golden' | 'rain'
  moodT: saved.mood === 'rain' ? 1 : 0,              // 0 = golden hour, 1 = rainy dusk
  headBob: typeof saved.headBob === 'boolean' ? saved.headBob : !REDUCED_MOTION,
  // Everyone starts on Fast; a tier is remembered only once the visitor picks
  // one (Q / HUD). Older prefs saved 'high' implicitly, so they are ignored.
  quality: (saved.qualityChosen && saved.quality) || 'mobile',
  qualityChosen: Boolean(saved.qualityChosen && saved.quality),
  looked: null,
  opened: null,
  shadowsDirty: true
};

// AO follows the starting tier (Fast has none).
SETTINGS.aoEnabled = runtime.quality !== 'mobile';

/* Shared arrays populated across scene-builder modules */
export const interactables = [];
export const books = [];
export const candleFlames = [];

export function track(name, eventParams) {
  if (typeof window.track === 'function') {
    window.track(name, eventParams);
  }
}
