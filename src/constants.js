/* Shared physical dimensions & constants for The Reading Room v2.
   All spatial units are real-world metres. */

export const ROOM = { w: 7, d: 6.4, h: 2.9 };
export const EYE = 1.62;

export const DOOR = { w: 0.92, h: 2.12 };

export const NOOK = {
  winW: 2.55,
  winH: 1.92,
  sill: 0.50,
  seatW: 2.55,
  seatD: 0.62,
  seatH: 0.42,
  cushionH: 0.09,
  towerW: 0.78,
  towerD: 0.34,
  towerH: 2.55,
  cabH: 0.78,
  frameT: 0.07,
  frameD: 0.09,
  worldZ: -0.15
};

export const CASE = { w: 1.42, h: 2.3, d: 0.32 };
export const SHELF_Y = [0.42, 0.90, 1.38, 1.86];

export const TABLE = { w: 1.15, d: 0.62, h: 0.75, x: -1.95, z: -2.52 };

export const HOST_NAME = 'Rahul';
export const GUEST_RELAY_URL = 'https://reading-room-guestbook.rahul-kmr007.workers.dev';
export const GUEST_REPO = 'r-r-2/thereadingroom';
export const GUEST_MAX_PER_IP = 20;
export const GUEST_MAX_ON_TABLE = 12;
export const GUEST_ON_TABLE = 3;
export const GUEST_ALWAYS_ON_TABLE = ['Swaa'];
export const GUEST_PENDING_ON_TABLE = false;
export const GUEST_LS_KEY = 'rr-guest-mine';
export const GUEST_SEEN_KEY = 'rr-guest-seen';

export const GUEST_TABLE = {
  w: 1.9,
  d: 0.62,
  h: 0.76,
  x: 1.9,
  z: ROOM.d / 2 - 0.02 - 0.62 / 2
};

export const GUEST_LEDGE = {
  w: GUEST_TABLE.w + 0.06,
  d: 0.09,
  t: 0.02,
  y: [1.22, 1.56],
  perRail: 8,
  gap: 0.014,
  lean: 0.10,
  wallZ: -GUEST_TABLE.d / 2 - 0.02
};

export const STAND = { w: 1.15, d: 0.46, h: 0.72 };
// Lamp spots in their furniture's local space (lighting.js mirrors them in world space)
export const CREDENZA_LAMP = { x: 0.42, z: -0.08 };   // free right end of the credenza
export const GUEST_LAMP = { x: -0.84, z: -0.16 };     // free left end of the guest table
export const LAMP_SCALE = 0.82;
export const ARM_PARK = 0.404;
export const ARM_OUTER = -0.459;
export const ARM_INNER = -0.710;

/* Frame-rate independent exponential smoothing */
export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
