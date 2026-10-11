import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import type { LevelBuilder } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { bush, deco, Glow, grass, mushrooms, rubble, signboard, tree, wall } from '../../world/props';

/**
 * The Old Woods, through the gate on the west side of the Castle Grounds (open once Mabel
 * has asked you to find Thimble). Day, deep in the trees. +Z runs into the woods:
 *
 *   The Wicket      z 0..24,   y 0    the gateway back to the grounds; a briar thicket
 *                                     between boulders (Cindersnap), two Snapweeds in a
 *                                     second gap, Gnarlings
 *   Mushroom Dell   z 24..44,  y 0    a toadstool up to the east shelf (4.5), a second that
 *                                     flings you north onto the ridge (8) (Springwell)
 *   The Canopy      z 44..80,  y 8    tree platforms over a flooded ravine (water -3): rope
 *                                     bridges, a swinging log, a basket you call over a
 *                                     7 m gap (Thistledown)
 *   The Hollow Log  z 80..94,  y 8    dark: holes in its floor crossed on glimmer stones, the
 *                                     last only in a CHARGED lamp's glow (Glimmerwick)
 *   The Brook Shelf z 94..104, y 8    an Ember Crab; a waterfall down the cliff (top 13) to
 *                                     freeze and climb (Rimewhistle)
 *   The Old Oak     z 104..130, y 13  the great oak; Thimble in a nook under its roots behind
 *                                     a padlocked root-gate (Latchkin); a rune tile that
 *                                     needs a charged bounce up to a bough (22: secret, chest);
 *                                     a door back to the grounds
 */
export const WOODS: LevelDef = {
  id: 'woods',
  name: 'The Old Woods',
  spawns: {
    default: { pos: [0, 0, 2.2], yaw: 0 },
  },
  areas: [
    { id: 'wicket', name: 'The Old Woods', min: [-17, -5, -1], max: [17, 20, 24] },
    { id: 'dell', name: 'Mushroom Dell', min: [-17, -5, 24], max: [17, 20, 44] },
    { id: 'canopy', name: 'The Canopy', min: [-17, -6, 44], max: [17, 25, 80] },
    { id: 'hollow', name: 'The Hollow Log', min: [-6.5, 7, 80], max: [0.5, 12, 94], ambience: 'dark' },
    { id: 'canopy', name: 'The Canopy', min: [-17, -6, 80], max: [17, 25, 94] },
    { id: 'brook', name: 'The Brook Shelf', min: [-17, -6, 94], max: [17, 12.5, 106] },
    { id: 'oak', name: 'The Old Oak', min: [-17, 12.5, 104], max: [17, 40, 131] },
  ],
  intro: { script: 'woodsIntro', unlessFlag: 'woods-entered' },
  music: 'woods',
  build,
};

const GRASS = '#6f8a4a';
const ROCK = '#8a8478';
const BARK = '#6b4a2e';
const LEAF = '#4f7a34';
const PLANK = '#8a6a44';

function build(b: LevelBuilder): void {
  b.killY = -12;
  const glow = new Glow();
  b.defaultPattern = 'plain';

  bounds(b);
  wicket(b);
  dell(b);
  canopy(b);
  hollow(b);
  brook(b);
  oak(b);

  glow.finish(b, '#ffd890');
  b.finish();
}

/** Invisible walls round the edge, with a thick wood beyond them so nobody sees the end. */
function bounds(b: LevelBuilder): void {
  for (const x of [-16.5, 16.5]) b.box([x, 12, 65], [1, 40, 132], { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  b.box([0, 12, 130.5], [34, 40, 1], { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -2 + Math.floor(i / 2) * 6.2;
    const y = z < 44 ? 0 : z < 104 ? -3 : 13;
    const h = 12 + (i % 3) * 3;
    deco(b, new CylinderGeometry(0.5, 0.7, h, 6), [side * (18.5 + (i % 4)), y + h / 2 - 1, z], BARK);
    deco(b, new ConeGeometry(4 + (i % 3), h * 0.8, 7), [side * (18.5 + (i % 4)), y + h * 0.8, z], i % 3 ? '#3f5f34' : '#4a6a3a');
  }
  for (let i = 0; i < 9; i++) deco(b, new ConeGeometry(5, 18, 7), [-16 + i * 4, 22, 134 + (i % 2) * 3], i % 2 ? '#3f5f34' : '#4a6a3a');
}

/**
 * Lumpy boulders half sunk into a rock block's sides and top edges, so it reads as rock
 * rather than a box. Decoration only; `lip` keeps them low on tops people walk on.
 */
function crag(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, y0: number, top: number, seed: number, lip = 0.35): void {
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const shades = ['#8a8478', '#7a746a', '#9a9488', '#6f6a60'];
  const lump = (x: number, y: number, z: number, r: number) =>
    deco(b, new IcosahedronGeometry(r, 0), [x, y, z], shades[Math.floor(rnd() * shades.length)], [rnd() * 3, rnd() * 3, rnd() * 3]);
  const along = (a0: number, a1: number, place: (t: number) => void) => {
    for (let t = a0 + 0.8; t < a1 - 0.4; t += 1.6 + rnd() * 0.8) place(t);
  };
  // Top edges: small and low, half buried.
  along(x0, x1, (x) => {
    lump(x, top - 0.55 + lip, z0, 0.6 + rnd() * 0.4);
    lump(x, top - 0.55 + lip, z1, 0.6 + rnd() * 0.4);
  });
  along(z0, z1, (z) => {
    lump(x0, top - 0.55 + lip, z, 0.6 + rnd() * 0.4);
    lump(x1, top - 0.55 + lip, z, 0.6 + rnd() * 0.4);
  });
  // The faces: bigger lumps scattered over them.
  for (let y = y0 + 0.8; y < top - 0.8; y += 1.8) {
    along(x0, x1, (x) => {
      if (rnd() < 0.55) lump(x, y + rnd() * 0.6, z0, 0.7 + rnd() * 0.6);
      if (rnd() < 0.55) lump(x, y + rnd() * 0.6, z1, 0.7 + rnd() * 0.6);
    });
    along(z0, z1, (z) => {
      if (rnd() < 0.55) lump(x0, y + rnd() * 0.6, z, 0.7 + rnd() * 0.6);
      if (rnd() < 0.55) lump(x1, y + rnd() * 0.6, z, 0.7 + rnd() * 0.6);
    });
  }
}

// ---------------------------------------------------------------- the Wicket (z 0..24)

function wicket(b: LevelBuilder): void {
  b.floor(-16.5, 16.5, -1, 24, { color: GRASS });
  // The old gateway back to the grounds.
  wall(b, 'x', -0.5, -16.5, 16.5, 6, { color: ROCK, holes: [{ from: -1.6, to: 1.6, top: 3.6 }] });
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 3, height: 3.4, to: { level: 'grounds', spawn: 'fromWoods' }, label: 'The Castle Grounds' },
    { type: 'checkpoint', pos: [3.4, 0, 3], yaw: -Math.PI / 2, zone: { min: [-16, -1, 0], max: [16, 4, 6] } },
  );
  signboard(b, "MOTHER HAZELRIGG'S WOOD\nKeep to the old paths. Mind the teeth.", [0, 4.6, 0.06], 0);
  // The thicket: boulders either side, briars in the gap, too tall to climb.
  b.box([-9, 2, 11], [15, 4, 2.4], { color: ROCK, info: { noGrab: true } });
  b.box([9, 2, 11], [15, 4, 2.4], { color: ROCK, info: { noGrab: true } });
  crag(b, -16.5, -1.5, 9.8, 12.2, 0, 4, 1, 0.6);
  crag(b, 1.5, 16.5, 9.8, 12.2, 0, 4, 2, 0.6);
  // The second gap, and the Snapweeds that wait in it.
  b.box([-9.25, 1.7, 17], [14.5, 3.4, 2], { color: ROCK, info: { noGrab: true } });
  b.box([9.25, 1.7, 17], [14.5, 3.4, 2], { color: ROCK, info: { noGrab: true } });
  crag(b, -16.5, -2, 16, 18, 0, 3.4, 3, 0.6);
  crag(b, 2, 16.5, 16, 18, 0, 3.4, 4, 0.6);
  for (const [x, z] of [
    [-12, 7],
    [12, 6],
    [-6, 22],
    [9, 21],
    [-13, 21],
  ]) {
    tree(b, x, z);
  }
  for (const [x, z, s] of [
    [-4, 5, 1.2],
    [5.5, 8, 1],
    [-6, 14, 1.3],
    [6, 14.5, 1.1],
  ]) {
    bush(b, x, z, s, Math.round(x * 7 + z));
  }
  grass(b, -16, 16, 0, 24, 0, 2);
  mushrooms(b, 7, 4, 5, 2);
  rubble(b, -3, 9.4, 5, 3);
  b.add(
    { type: 'burnable', id: 'wd-thicket', style: 'briar', pos: [0, 2, 11], size: [3, 4, 1.4] },
    { type: 'snapweed', pos: [-1.6, 0, 19.3], radius: 2.2 },
    { type: 'snapweed', pos: [1.6, 0, 19.3], radius: 2.2 },
    { type: 'gnarling', pos: [-5, 0, 21.5], wander: 3 },
    { type: 'gnarling', pos: [5, 0, 22], wander: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3.5], to: [0, 0.6, 8.5], count: 4 },
    { type: 'trigger', flag: 'woods-hint-thicket', script: 'woodsThicket', min: [-16, -1, 6], max: [16, 4, 9.6], unlessSignals: ['wd-thicket'], delay: 15, perVisit: true },
  );
}

// ---------------------------------------------------------------- Mushroom Dell (z 24..44)

function dell(b: LevelBuilder): void {
  b.floor(-16.5, 16.5, 24, 44, { color: GRASS });
  // The east shelf (4.5) and the ridge (8) across the far end: neither can be climbed.
  b.box([-11.25, 2.25, 35], [10.5, 4.5, 10], { color: ROCK, info: { noGrab: true } });
  b.box([0, 1, 46], [33, 14, 4], { color: ROCK, info: { noGrab: true } });
  deco(b, new BoxGeometry(10.6, 0.15, 10.1), [-11.25, 4.55, 35], GRASS);
  crag(b, -16.5, -6, 30, 40, 0, 4.5, 5);
  crag(b, -16.5, 16.5, 44, 48, 0, 8, 6);
  deco(b, new BoxGeometry(33.1, 0.15, 4.1), [0, 8.05, 46], GRASS);
  for (const [x, z] of [
    [8, 30],
    [12, 38],
    [-14, 27],
  ]) {
    tree(b, x, z);
  }
  // Giant toadstools for decoration (the springy ones are entities).
  for (const [x, z, h, r] of [
    [6, 27, 2.4, 1.4],
    [10, 33, 3.4, 1.8],
    [3, 40, 1.6, 1],
    [-14, 41.5, 5.8, 1.3],
  ]) {
    b.cylinder([x, h / 2, z], 0.3, h, '#efe6d2', undefined, 7);
    deco(b, new SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1), [x, h, z], '#c8382a');
  }
  grass(b, -6, 16, 24, 44, 0, 2);
  mushrooms(b, -2, 28, 6, 5);
  b.add(
    { type: 'springPad', pos: [-3.6, 0, 34], radius: 1.1, style: 'mushroom', height: 0.3, duration: 8 },
    { type: 'springPad', pos: [-11, 4.5, 38], radius: 1, style: 'mushroom', height: 0.3, duration: 8, fling: { yaw: 0, speed: 6 } },
    { type: 'checkpoint', pos: [-14, 4.5, 32], yaw: Math.PI / 2, zone: { min: [-16, 3.5, 30], max: [-6, 8, 40] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 5.1, 31.5], to: [-14, 5.1, 31.5], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [-14.5, 5.1, 39] },
    { type: 'trigger', flag: 'woods-hint-dell', script: 'woodsDell', min: [-16, -1, 24], max: [16, 4, 43], delay: 25, perVisit: true },
  );
}

// ---------------------------------------------------------------- the Canopy (z 44..94, y 8)

const P = 8;

/** A plank bridge from a to b (at height P), with rope rails that don't stop anyone. */
function bridge(b: LevelBuilder, a: [number, number], c: [number, number], w = 1.3): void {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  b.box([(a[0] + c[0]) / 2, P - 0.1, (a[1] + c[1]) / 2], [w, 0.2, len], { color: PLANK, rot: [0, yaw, 0], info: { noGrab: true } });
  for (const side of [-1, 1]) {
    const ox = Math.cos(yaw) * side * (w / 2);
    const oz = -Math.sin(yaw) * side * (w / 2);
    deco(b, new CylinderGeometry(0.025, 0.025, len, 4).rotateX(Math.PI / 2), [(a[0] + c[0]) / 2 + ox, P + 0.9, (a[1] + c[1]) / 2 + oz], '#c8b090', [0, yaw, 0]);
  }
}

/** A round platform built round a trunk, with the tree's crown above. */
function platform(b: LevelBuilder, x: number, z: number, r: number): void {
  b.cylinder([x, P - 0.2, z], r, 0.4, PLANK, { noGrab: true }, 12);
  b.cylinder([x, 0.8, z], 0.7, 13.6, BARK, undefined, 8);
  deco(b, new CylinderGeometry(0.55, 0.7, 6, 8), [x, P + 3, z], BARK);
  for (const [dx, dy, dz, rr] of [
    [0, 8, 0, 3.6],
    [2, 7, 1, 2.6],
    [-2.2, 7.4, -0.8, 2.8],
    [0.6, 9.6, -0.6, 2.4],
  ]) {
    deco(b, new IcosahedronGeometry(rr, 0), [x + dx, P + dy, z + dz], LEAF);
  }
}

function canopy(b: LevelBuilder): void {
  // The ravine under it all: fall in and you're fished out at the last firm footing.
  b.pool(-16.5, 16.5, 48, 94, -3, -6);
  for (const x of [-16.5, 16.5]) b.box([x, -1, 71], [1, 4, 46], { color: ROCK });
  rubble(b, -10, 60, 6, 9, -3, 1.4);
  rubble(b, 9, 75, 6, 13, -3, 1.4);
  const P1: [number, number] = [0, 50.6];
  const P2: [number, number] = [6.5, 58];
  const P3: [number, number] = [-1, 64.5];
  const P4: [number, number] = [-3, 76];
  platform(b, ...P1, 2.6);
  platform(b, ...P2, 2.2);
  platform(b, ...P3, 2.2);
  platform(b, ...P4, 2.5);
  bridge(b, [1.6, 52.6], [5.1, 56.3]);
  bridge(b, [5, 59.6], [0.4, 63]);
  bridge(b, [-3.1, 78.3], [-3.1, 80.2]);
  b.add(
    // A log on ropes swings across the second bridge.
    { type: 'pendulum', pos: [2.7, P + 6.5, 61.3], length: 5.6, swing: 0.75, period: 2.8, yaw: Math.atan2(-4.6, 3.4), bob: 0.75 },
    // The basket waits at the far side: call it over, ride it back.
    { type: 'skyLift', style: 'basket', id: 'wd-basket', from: [-1.6, P, 67.7], to: [-2.6, P, 72.5], size: [2, 2], startAt: 'to', speed: 2 },
    { type: 'checkpoint', pos: [0, P, 49.4], yaw: 0, zone: { min: [-6, P - 1, 44], max: [6, P + 4, 53] } },
    { type: 'checkpoint', pos: [-1, P, 63.2], yaw: 0, zone: { min: [-3.2, P - 1, 62.3], max: [1.2, P + 4, 66.7] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [2, P + 0.6, 53.2], to: [4.6, P + 0.6, 55.8], count: 3 },
    { type: 'sweetLine', kind: 'bramble', from: [-3, P + 0.6, 75], to: [-3, P + 0.6, 77], count: 2 },
    { type: 'trigger', flag: 'woods-hint-basket', script: 'woodsBasket', min: [-3.2, P - 1, 62.3], max: [1.2, P + 4, 66.7], unlessSignals: ['wd-basket'], delay: 20, perVisit: true },
  );
}

// ---------------------------------------------------------------- the Hollow Log (z 80..94, dark)

function hollow(b: LevelBuilder): void {
  const X0 = -6;
  const X1 = 0;
  // A fallen giant, hollow inside: floor with holes, walls, a curved-looking roof.
  b.floor(X0, X1, 80, 94, { top: P, thickness: 0.6, color: '#5a4030', holes: [[X0, X1, 83, 90]] });
  for (const x of [X0 - 0.3, X1 + 0.3]) b.box([x, P + 2, 87], [0.6, 4, 14], { color: BARK });
  b.box([(X0 + X1) / 2, P + 4.2, 87], [X1 - X0 + 1.2, 0.5, 14], { color: BARK });
  for (const x of [X0 + 0.4, X1 - 0.4]) deco(b, new BoxGeometry(0.6, 1, 14), [x, P + 3.5, 87], BARK, [0, 0, x < -3 ? -0.6 : 0.6]);
  // Bark rings at the ends.
  for (const z of [80, 94]) deco(b, new CylinderGeometry(4, 4, 0.5, 10, 1, true).rotateX(Math.PI / 2), [-3, P + 1.9, z], '#5a3a22');
  b.add(
    { type: 'wickLamp', pos: [-1.2, P, 81.4], radius: 5.2, duration: 9, light: true },
    { type: 'glimmerBlock', pos: [-3.8, P - 0.15, 84.2], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [-2.2, P - 0.15, 86.2], size: [1.5, 0.3, 1.5] },
    // Only a charged lamp reaches this one.
    { type: 'glimmerBlock', pos: [-3.2, P - 0.15, 88.4], size: [1.5, 0.3, 1.5] },
    { type: 'trigger', flag: 'woods-hint-hollow', script: 'woodsHollow', min: [X0, P - 1, 80], max: [X1, P + 3, 83], delay: 15, perVisit: true },
  );
  signboard(b, 'Dark ahead.\nA brighter lamp reaches further.', [-5.68, P + 2.2, 81.6], Math.PI / 2);
}

// ---------------------------------------------------------------- the Brook Shelf (z 94..104, y 8)

function brook(b: LevelBuilder): void {
  b.box([0, (P - 6) / 2, 99], [33, P + 6, 10], { color: ROCK, info: { noGrab: true } });
  deco(b, new BoxGeometry(33.1, 0.12, 10.1), [0, P + 0.06, 99], GRASS);
  // The cliff up to the oak (13), with a waterfall down its face.
  const UP = 13;
  // Only the middle, behind the falls, can be grabbed: from the top of the frozen pillar.
  b.box([-9, (UP + P) / 2, 105], [15, UP - P, 2], { color: ROCK, info: { noGrab: true } });
  b.box([9, (UP + P) / 2, 105], [15, UP - P, 2], { color: ROCK, info: { noGrab: true } });
  b.box([0, (UP + P) / 2, 105], [3, UP - P, 2], { color: ROCK });
  crag(b, -16.5, -1.6, 104, 106, P, UP, 7);
  crag(b, 1.6, 16.5, 104, 106, P, UP, 8);
  crag(b, -16.5, 16.5, 94, 104, P - 4, P, 9);
  b.add(
    { type: 'waterfall', pos: [0, P, 104], yaw: Math.PI, width: 2, height: UP - P, pillar: 2.6, depth: 1.2, duration: 10 },
    { type: 'emberCrab', id: 'wd-crab', pos: [7, P, 99], patrol: 3, interval: 3 },
    { type: 'checkpoint', pos: [-6, P, 96.5], yaw: 0, zone: { min: [-16, P - 1, 94], max: [16, P + 4, 98] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-12, P + 0.6, 100], to: [-6, P + 0.6, 100], count: 4 },
    { type: 'trigger', flag: 'woods-hint-falls', script: 'woodsFalls', min: [-4, P - 1, 100], max: [4, P + 4, 104], delay: 15, perVisit: true },
  );
  for (const [x, z] of [
    [-13, 101],
    [12, 102],
  ]) {
    tree(b, x, z, P);
  }
  mushrooms(b, -9, 102.5, 5, 7, P);
}

// ---------------------------------------------------------------- the Old Oak (z 104..130, y 13)

function oak(b: LevelBuilder): void {
  const UP = 13;
  b.box([0, UP / 2, 118.5], [33, UP, 25], { color: ROCK, info: { noGrab: true } });
  deco(b, new BoxGeometry(33.1, 0.12, 26.1), [0, UP + 0.06, 118], GRASS);
  grass(b, -16, 16, 106, 130, UP, 2);
  // The great oak: trunk, roots, and a crown that fills the sky.
  b.cylinder([0, UP + 7, 122], 3, 14, BARK, undefined, 12);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    deco(b, new CylinderGeometry(0.4, 0.9, 4.5, 6), [Math.cos(a) * 3.6, UP + 0.6, 122 + Math.sin(a) * 3.6], BARK, [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]);
  }
  for (const [dx, dy, dz, r] of [
    [0, 18, 0, 8],
    [6, 15, 2, 5.5],
    [-6.5, 16, -1, 6],
    [2, 21, -3, 5],
    [-3, 14, 5, 5],
  ]) {
    deco(b, new IcosahedronGeometry(r, 1), [dx, UP + dy, 122 + dz], dy > 17 ? '#4a7a34' : LEAF);
  }
  // Thimble's nook under the roots, behind a root-gate with an old padlock.
  b.box([-1.6, UP + 1.3, 118], [1, 2.6, 2.4], { color: BARK });
  b.box([1.6, UP + 1.3, 118], [1, 2.6, 2.4], { color: BARK });
  b.box([0, UP + 2.9, 118], [4.2, 0.6, 2.4], { color: BARK });
  b.add(
    { type: 'gate', pos: [0, UP, 116.9], yaw: 0, width: 2.2, height: 2.6, when: ['wd-lock'] },
    { type: 'padlock', id: 'wd-lock', pos: [0.75, UP + 1.3, 116.75], yaw: Math.PI },
    { type: 'snapcasket', id: 'wd-snap', pos: [-5, UP, 112], wander: 3 },
    { type: 'questItem', quest: 'hedgehog', pos: [0, UP + 0.05, 118.6] },
    { type: 'checkpoint', pos: [-6, UP, 107], yaw: 0, zone: { min: [-16, UP - 1, 104], max: [16, UP + 4, 109] } },
    // A bough high in the crown: only a charged bounce reaches it.
    { type: 'springPad', pos: [-6.4, UP, 124], radius: 0.9, style: 'rune', duration: 8 },
    { type: 'chest', id: 'wd-bough-chest', pos: [-11.6, 22, 124], yaw: Math.PI / 2, sweets: [['humbug', 2], ['bramble', 3]] },
    { type: 'secret', id: 'woods-bough', area: 'oak', min: [-13.5, 21, 121.5], max: [-8.5, 25, 126.5] },
    // The door home, by the west edge.
    { type: 'door', pos: [15.45, UP, 112], yaw: -Math.PI / 2, width: 2.4, height: 3.2, to: { level: 'grounds', spawn: 'fromWoods' }, label: 'The Castle Grounds' },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, UP + 0.6, 109], to: [4, UP + 0.6, 109], count: 4 },
    { type: 'trigger', flag: 'woods-hint-oak', script: 'woodsOak', min: [-16, UP - 1, 109], max: [16, UP + 4, 116], unlessSignals: ['wd-lock'], delay: 30, perVisit: true },
  );
  b.box([-11, 21.85, 124], [5, 0.3, 4.5], { color: BARK, info: { noGrab: true } });
  deco(b, new CylinderGeometry(0.45, 0.8, 9, 7), [-6, UP + 9.5, 123], BARK, [0, 0, 0.75]);
  // The door's frame: a gap in a mossy stone wall along the west edge.
  wall(b, 'z', 16.2, 108, 116, 4.5, { base: UP, color: ROCK, holes: [{ from: 110.7, to: 113.3, top: 3.4 }] });
  signboard(b, 'Back to the Castle', [15.68, UP + 3.9, 112], -Math.PI / 2);
  for (const [x, z] of [
    [10, 126],
    [-13, 110],
    [12, 107],
  ]) {
    tree(b, x, z, UP);
  }
  bush(b, 7, 119, 1.4, 4, UP);
  bush(b, -7, 116, 1.2, 9, UP);
  mushrooms(b, 4.5, 125, 6, 3, UP);
}
