/* Adaptive quality tiers (`ultra`, `high`, `mobile`) + lightweight FPS
   watchdog that gracefully steps down screen-space AO if sustained frame
   times exceed ~23 ms (~43 FPS). */

import { TOUCH, runtime, SETTINGS, savePrefs } from './state.js';

export const QUALITY_TIERS = {
  ultra: {
    label: 'Ultra',
    maxDpr: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    ao: true,
    aoHalfRes: false,
    smaa: true
  },
  high: {
    label: 'High',
    maxDpr: 1.75,
    shadows: true,
    shadowMapSize: 1536,
    ao: true,
    aoHalfRes: true,
    smaa: true
  },
  mobile: {
    label: 'Fast',
    maxDpr: 1.25,
    shadows: false,
    shadowMapSize: 1024,
    ao: false,
    aoHalfRes: true,
    smaa: false
  }
};

export function currentTier() {
  return QUALITY_TIERS[runtime.quality] || (TOUCH ? QUALITY_TIERS.mobile : QUALITY_TIERS.high);
}

export function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, currentTier().maxDpr);
}

/* Frame-time monitor: only runs while actively inside the room so background
   tab throttling or gate idle does not trigger a false downgrade. */
let sampleAccum = 0;
let sampleFrames = 0;
let slowStreaks = 0;
let autoDowngraded = false;

export function monitorPerformance(rawDt, onTierChange) {
  if (autoDowngraded || !runtime.inRoom || rawDt > 0.25) return;
  sampleAccum += rawDt;
  sampleFrames++;
  if (sampleAccum < 2.0) return;

  const avgFps = sampleFrames / sampleAccum;
  sampleAccum = 0;
  sampleFrames = 0;

  if (avgFps < 43) {
    slowStreaks++;
    if (slowStreaks >= 2) {
      if (runtime.quality === 'ultra') {
        setQuality('high', onTierChange, false);
      } else if (runtime.quality === 'high' && SETTINGS.aoEnabled) {
        SETTINGS.aoEnabled = false;
        autoDowngraded = true;
        onTierChange?.();
      }
    }
  } else {
    slowStreaks = 0;
  }
}

export function setQuality(tierKey, onTierChange, persist = true) {
  if (!QUALITY_TIERS[tierKey]) return;
  runtime.quality = tierKey;
  if (persist) runtime.qualityChosen = true;
  SETTINGS.aoEnabled = QUALITY_TIERS[tierKey].ao;
  runtime.shadowsDirty = true;
  if (persist) savePrefs();
  onTierChange?.();
}

export function cycleQuality(onTierChange) {
  const order = TOUCH ? ['mobile', 'high'] : ['high', 'ultra', 'mobile'];
  const idx = order.indexOf(runtime.quality);
  const next = order[(idx + 1) % order.length];
  setQuality(next, onTierChange, true);
  return QUALITY_TIERS[next].label;
}
