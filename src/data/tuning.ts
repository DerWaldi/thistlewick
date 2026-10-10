/**
 * Game-feel numbers for the player and camera. Live-editable through the tuning
 * panel (` key); tweaks persist in localStorage under TUNING_KEY until reset.
 * When a tweak feels right, copy it from the panel and paste it here as the new default.
 */
export const DEFAULT_TUNING = {
  move: {
    runSpeed: 6.2,
    groundAccel: 48,
    groundDecel: 38,
    turnaroundAccel: 70,
    airAccel: 20,
    airDecel: 4,
    turnRate: 14, // facing turn speed, rad/s
    maxSlope: 46, // degrees; steeper ground can't be stood on, jumped from or climbed
    iceAccelScale: 0.12,
    iceDecelScale: 0.04,
  },
  jump: {
    height: 1.55, // apex height above takeoff with a full hold, metres
    gravity: 32,
    fallGravityScale: 1.55,
    cutGravityScale: 2.8, // applied while rising after jump is released
    maxFallSpeed: 28,
    coyoteTime: 0.11,
    bufferTime: 0.13,
    bounceHeight: 6.5,
    bounceBoostScale: 1.35, // bounce height multiplier when jump is held on landing
  },
  ledge: {
    enabled: true,
    autoClimb: true, // climb straight up if you're pushing toward the wall when grabbing
    reach: 0.45, // how far in front of the capsule a wall can be
    minAbove: -0.15, // ledge height window relative to capsule centre
    maxAbove: 0.95,
    climbTime: 0.36,
    regrabCooldown: 0.35,
    shimmySpeed: 1.8,
  },
  cast: {
    range: 20, // max distance from the player to a target
    aimCone: 11, // degrees of forgiveness around the crosshair
    markerRange: 14, // idle runes show within this distance
    tapTime: 0.16, // holding longer than this starts charging
    chargeTime: 0.9,
    chargeMoveScale: 0.45, // movement speed while charging
    boltSpeed: 32,
    cooldown: 0.22,
    magnetRadius: 1.8, // sweets fly to you inside this radius
  },
  camera: {
    distance: 5.4,
    height: 1.5, // pivot height above the feet
    shoulder: 0.65, // sideways offset so the player sits left of the crosshair
    minPitch: -0.95,
    maxPitch: 0.55,
    sensitivity: 0.0022,
    followSharpness: 14,
    verticalSharpness: 5,
    lookAhead: 0.22,
    autoRecenter: true,
    recenterDelay: 1.4,
    recenterSpeed: 1.2,
    baseFov: 60,
    speedFov: 5,
  },
};

export type Tuning = typeof DEFAULT_TUNING;

export const TUNING_KEY = 'thistlewick.tuning';

export function loadTuning(): Tuning {
  const t = structuredClone(DEFAULT_TUNING);
  try {
    const raw = localStorage.getItem(TUNING_KEY);
    if (raw) deepAssign(t, JSON.parse(raw));
  } catch {
    // ignore corrupt or unavailable storage
  }
  return t;
}

export function saveTuning(t: Tuning): void {
  try {
    localStorage.setItem(TUNING_KEY, JSON.stringify(t));
  } catch {
    // storage may be unavailable (private mode)
  }
}

/** Copies only keys that already exist in `target`, so stale saved tunings can't add junk. */
function deepAssign(target: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const k of Object.keys(target)) {
    const v = src?.[k];
    if (v === undefined) continue;
    const cur = target[k];
    if (cur && typeof cur === 'object') deepAssign(cur as Record<string, unknown>, v as Record<string, unknown>);
    else if (typeof v === typeof cur) target[k] = v;
  }
}
