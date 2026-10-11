import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import {
  barrel,
  bookStack,
  cobweb,
  column,
  crate,
  deco,
  Glow,
  rubble,
  rug,
  shelf,
  signboard,
  slab,
  table,
  urn,
  wall,
  wallTorch,
} from '../../world/props';

/**
 * The Latchkin Vaults, under Madam Quince's classroom. Five rooms, south to north (+Z):
 *
 *   Antechamber    x -5..5,   z 0..9    a padlock on the first gate
 *   Lockwork Hall  x -9..9,   z 10..30  the north gate has three padlocks: one in plain sight
 *                                       (P1), one above the west platform (P2, only visible
 *                                       once you've climbed up via the step block), one in a
 *                                       closed cubby (P3, seen through a grille from the side
 *                                       passage east of the hall, x 10..13)
 *   Pantry         x -8..8,   z 31..48  three Snapcaskets (lock, then thwack) hold the gate; a
 *                                       real chest; a book opens a shelf-door to a secret chest
 *   Shutter Run    x -4..4,   z 49..74  shutters whose padlocks relock after 7 s; each lock is
 *                                       seen through the shutter before it. Then a pit, and a
 *                                       winch padlock that drops the drawbridge
 *   Great Vault    x -9..9,   z 75..92  four padlocks ride a wheel above the round vault door;
 *                                       two Snapcaskets prowl
 *   Strongroom     x -4..4,   z 93..115 behind the vault door: three pendulums swing across the
 *                                       corridor, and two gates whose padlocks relock after 6 s;
 *                                       unlock, then time your dash between the swings.
 *   Passage        x -3..3,   z 115..121.5 (the old Star chamber), treasure
 *   Counting House x -9..9,   z 121.5..155  the Star gate wants three padlocks open at once
 *                                       (they relock after 5.5 s): one on the north face of the
 *                                       counting table, one high on the east wall behind a
 *                                       grille, one riding a wheel over the gate. A west
 *                                       walkway (top 3.2, stair at its south end) is the best
 *                                       view. The first Hexling overhead (on her own, so
 *                                       she gets a proper introduction), a Gnarling on the
 *                                       walkway, two Snapcaskets on the floor
 *   Star Chamber   x -3..3,   z 155..161.5
 */
export const VAULT: LevelDef = {
  id: 'vault',
  name: 'The Latchkin Vaults',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'antechamber', name: 'The Latchkin Vaults', min: [-5, -3, 0], max: [5, 8, 9] },
    { id: 'locks', name: 'The Lockwork Hall', min: [-9.5, -3, 9], max: [14, 12, 30] },
    { id: 'pantry', name: 'The Snapcasket Pantry', min: [-11.5, -3, 30], max: [8.5, 8, 48] },
    { id: 'shutters', name: 'The Shutter Run', min: [-4.5, -3, 48], max: [4.5, 8, 74.5] },
    { id: 'great', name: 'The Great Vault', min: [-9.5, -3, 74.5], max: [9.5, 12, 93] },
    { id: 'strongroom', name: 'The Strongroom', min: [-4.5, -3, 93], max: [4.5, 12, 115] },
    { id: 'great', name: 'The Great Vault', min: [-3.5, -3, 115], max: [3.5, 12, 121.5] },
    { id: 'counting', name: 'The Counting House', min: [-9.5, -3, 121.5], max: [9.5, 14, 155] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, -3, 155], max: [3.5, 8, 161.5] },
  ],
  intro: { script: 'vaultIntro', unlessFlag: 'vault-entered' },
  music: 'dungeon',
  build,
};

const STONE = '#8a8090';
/** The Star Chamber, after the Counting House. */
const STAR_Z = 158.5;
const FLOOR = '#6e6670';
const GOLD = '#e8c25a';
const gateHole = (x: number) => ({ from: x - 2.1, to: x + 2.1, top: 3.6 });

/** Cobwebs in the top corners of a rectangular room (inner faces x0..x1, z0..z1). */
function webs(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, y: number, s = 1): void {
  for (const [x, dx] of [
    [x0, 1],
    [x1, -1],
  ]) {
    for (const [z, dz] of [
      [z0, 1],
      [z1, -1],
    ]) {
      cobweb(b, [x, y, z] as V3, [dx, 0], [0, dz], s);
    }
  }
}

/** A heap of gold coins and goblets (no collider). */
function treasure(b: LevelBuilder, x: number, z: number, n: number, seed: number): void {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.9;
    deco(b, new IcosahedronGeometry(0.12 + rnd() * 0.12, 0).scale(1, 0.45, 1), [x + Math.cos(a) * d, 0.05 + rnd() * 0.1, z + Math.sin(a) * d], i % 4 ? GOLD : '#c99a3e');
  }
  deco(b, new CylinderGeometry(0.1, 0.06, 0.25, 6), [x + 0.3, 0.2, z - 0.2], GOLD);
}

function build(b: LevelBuilder): void {
  b.killY = -20;
  const flames = new Glow();
  b.floor(-13, 14, -0.5, 122, {
    color: FLOOR,
    holes: [[-4, 4, 68.5, 72.5]], // the drawbridge pit
  });

  // ================================================================ antechamber (z 0..9)
  wall(b, 'x', -0.5, -5.5, 5.5, 6, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -5.5, 0, 9, 6, { color: STONE });
  wall(b, 'z', 5.5, 0, 9, 6, { color: STONE });
  slab(b, -5.5, 5.5, -0.5, 9, 6.5, 0.5, COLORS.stoneDark);
  wall(b, 'x', 9.5, -9.5, 14, 9.5, { color: STONE, holes: [gateHole(0)] });
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'quince', spawn: 'fromVault' } },
    { type: 'checkpoint', pos: [-3.5, 0, 2.5], yaw: Math.PI / 2, zone: { min: [-5, -1, 0], max: [5, 4, 9] } },
    { type: 'gate', pos: [0, 0, 9.5], yaw: 0, width: 3, height: 3, when: ['v-lock1'] },
    { type: 'padlock', id: 'v-lock1', pos: [0.5, 1.5, 9.38], yaw: Math.PI },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3.5], to: [0, 0.6, 7.5], count: 3 },
  );
  wallTorch(b, flames, [-4.98, 2.4, 6], Math.PI / 2);
  wallTorch(b, flames, [4.98, 2.4, 6], -Math.PI / 2);
  barrel(b, [4.4, 0, 0.7]);
  crate(b, [-4.3, 0, 8.2], 0.9);
  webs(b, -5, 5, 0, 9, 5.9, 1);
  b.lantern([0, 4.6, 4.5], 0, 0, false);

  // ================================================================ lockwork hall (z 10..30)
  wall(b, 'z', -9.5, 10, 30, 9.5, { color: STONE });
  wall(b, 'z', 9.5, 10, 30, 9.5, {
    color: STONE,
    holes: [
      { from: 12, to: 14, top: 3 }, // into the side passage
      { from: 27, to: 29.6, bottom: 0.8, top: 2.6 }, // the grille window into the cubby
    ],
  });
  slab(b, -9.5, 9.5, 10, 30.5, 10, 0.5, COLORS.stoneDark);
  wall(b, 'x', 30.5, -9.5, 14, 9.5, { color: STONE, holes: [gateHole(0)] });
  // The west platform (top 4.4) with a parapet; the step block is the way up.
  b.box([-7.5, 2.2, 21], [3, 4.4, 14], { color: COLORS.stoneLight });
  b.box([-6.1, 4.9, 14.5], [0.2, 1, 1], { color: COLORS.stone });
  b.box([-6.1, 4.9, 22.5], [0.2, 1, 11], { color: COLORS.stone });
  b.box([-5, 1.2, 16], [2, 2.4, 2], { color: COLORS.stone });
  deco(b, new BoxGeometry(2.1, 0.12, 2.1), [-5, 2.46, 16], COLORS.stoneDark);
  // The cubby in the north-east corner: walled off from the hall, seen only through the grille.
  b.box([7.5, 2, 26], [3.4, 4, 0.4], { color: STONE });
  b.box([6, 2, 28], [0.4, 4, 4], { color: STONE });
  b.box([7.6, 4.15, 28], [3.6, 0.3, 4.2], { color: COLORS.stoneDark });
  for (let i = 0; i < 9; i++) deco(b, new CylinderGeometry(0.03, 0.03, 1.8, 5), [9.5, 1.7, 27.15 + i * 0.29], '#3a3340');
  for (const y of [0.85, 2.55]) deco(b, new BoxGeometry(0.08, 0.08, 2.6), [9.5, y, 28.3], '#3a3340');
  b.box([9.5, 1.7, 28.3], [0.1, 1.8, 2.6], { invisible: true, info: { seeThrough: true, noGrab: true, cameraIgnore: true } });
  // The side passage (x 10..13).
  wall(b, 'z', 13.5, 11, 31, 4.5, { color: STONE });
  wall(b, 'x', 11.5, 10, 14, 4.5, { color: STONE });
  slab(b, 9.5, 14, 11, 31, 4.6, 0.4, COLORS.stoneDark);
  b.add(
    { type: 'checkpoint', pos: [-3.5, 0, 11.2], yaw: 0, zone: { min: [-9, -1, 10], max: [9, 4, 12.5] } },
    { type: 'trigger', flag: 'vault-hint-locks', script: 'vaultLocks', min: [-9, -1, 10], max: [9, 5, 13] },
    { type: 'gate', pos: [0, 0, 30.5], yaw: 0, width: 3, height: 3, when: ['v-p1', 'v-p2', 'v-p3'] },
    { type: 'padlock', id: 'v-p1', pos: [-0.6, 1.5, 30.38], yaw: Math.PI },
    { type: 'padlock', id: 'v-p2', pos: [-8.95, 5.2, 24.5], yaw: Math.PI / 2 },
    { type: 'padlock', id: 'v-p3', pos: [6.22, 1.7, 28.4], yaw: Math.PI / 2 },
    { type: 'chest', id: 'v-passage-chest', pos: [11.5, 0, 22], yaw: -Math.PI / 2, sweets: [['fizzwort', 5], ['bramble', 1]] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-7.5, 5, 15.5], to: [-7.5, 5, 26.5], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [11.5, 0.6, 13], to: [11.5, 0.6, 20], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [-7.5, 5.2, 27.5] },
  );
  for (const z of [16, 24]) {
    wallTorch(b, flames, [8.98, 2.8, z], -Math.PI / 2);
  }
  wallTorch(b, flames, [-5.95, 3.2, 12], Math.PI / 2);
  wallTorch(b, flames, [12.98, 2.6, 17], -Math.PI / 2);
  wallTorch(b, flames, [12.98, 2.6, 27], -Math.PI / 2);
  for (const x of [-3, 3]) column(b, x, 20, 9.5);
  for (let i = 0; i < 5; i++) deco(b, new BoxGeometry(0.14, 0.18, 0.1), [-8.85, 1.2 + (i % 2) * 0.5, 12 + i * 0.6], GOLD);
  rug(b, [1, 0, 20], 4, 12, '#5a2a3a', '#c99a3e');
  webs(b, -9, 9, 10, 30, 9.4, 1.6);
  rubble(b, 8, 12, 6, 3);
  b.lantern([0, 8, 20], 10, 18);
  signboard(b, 'Three locks. Look closer.', [0, 4.6, 29.98], Math.PI);

  // ================================================================ pantry (z 31..48)
  wall(b, 'z', -8.5, 31, 48, 6, { color: STONE, holes: [{ from: 40, to: 42, top: 2.6 }] });
  wall(b, 'z', 8.5, 31, 48, 6, { color: STONE });
  slab(b, -8.5, 8.5, 30.5, 48, 6.5, 0.5, COLORS.stoneDark);
  wall(b, 'x', 48.5, -8.5, 8.5, 6.5, { color: STONE, holes: [gateHole(0)] });
  // The secret alcove behind the shelf-door.
  b.box([-10.1, 1.5, 39.7], [2.4, 3, 0.2], { color: STONE });
  b.box([-10.1, 1.5, 42.3], [2.4, 3, 0.2], { color: STONE });
  b.box([-11.3, 1.5, 41], [0.2, 3, 2.8], { color: STONE });
  b.box([-10.1, 2.75, 41], [2.6, 0.3, 2.8], { color: COLORS.stoneDark });
  b.add(
    { type: 'checkpoint', pos: [7.2, 0, 32.3], yaw: -Math.PI / 2, zone: { min: [-8, -1, 31], max: [8, 4, 33.5] } },
    { type: 'trigger', flag: 'vault-hint-pantry', script: 'vaultPantry', min: [-8, -1, 31], max: [8, 5, 34] },
    { type: 'snapcasket', id: 'v-snap1', pos: [-4, 0, 37], yaw: 0, wander: 3 },
    { type: 'snapcasket', id: 'v-snap2', pos: [4.5, 0, 40.5], yaw: -Math.PI / 2, wander: 3 },
    { type: 'snapcasket', id: 'v-snap3', pos: [-2.5, 0, 45], yaw: Math.PI, wander: 3 },
    { type: 'chest', id: 'v-pantry-chest', pos: [6.6, 0, 36], yaw: -Math.PI / 2, sweets: [['fizzwort', 4], ['bramble', 2]] },
    { type: 'gate', pos: [0, 0, 48.5], yaw: 0, width: 3, height: 3, when: ['v-snap1', 'v-snap2', 'v-snap3'] },
    { type: 'bookshelf', pos: [-8.5, 0, 41], yaw: Math.PI / 2, width: 2, height: 2.6, slide: 2.1, when: ['v-book'] },
    { type: 'knockSwitch', id: 'v-book', pos: [-7.55, 1.95, 37.8], yaw: Math.PI / 2, style: 'book' },
    { type: 'chest', id: 'v-secret-chest', pos: [-10.2, 0, 41], yaw: Math.PI / 2, card: 'snapcasket' },
    { type: 'secret', id: 'vault-pantry', area: 'pantry', min: [-11.2, -1, 39.9], max: [-8.6, 3, 42.1] },
  );
  shelf(b, [-7.75, 0, 37.6], Math.PI / 2, 2.4, 3);
  shelf(b, [7.75, 0, 42], -Math.PI / 2, 2.4, 3);
  shelf(b, [7.75, 0, 45], -Math.PI / 2, 2.4, 3);
  table(b, flames, [1.5, 0, 41], 0, 3.4, 1.2, 12);
  for (const [x, z] of [
    [-7.4, 32],
    [-6.6, 32.2],
    [7.4, 47.4],
    [-7.4, 47.3],
  ]) {
    barrel(b, [x, 0, z], 0.38, 0.95);
  }
  crate(b, [6.2, 0, 47.2], 1);
  urn(b, [-7.5, 0, 45.5]);
  // Hanging sausages and onions from a beam.
  deco(b, new BoxGeometry(14, 0.25, 0.25), [0, 5.6, 39], COLORS.woodDark);
  for (let i = 0; i < 12; i++) {
    const x = -6 + i * 1.1;
    if (i % 3 === 2) deco(b, new IcosahedronGeometry(0.16, 0), [x, 4.7, 39], '#d9a86a');
    else deco(b, new CylinderGeometry(0.07, 0.07, 0.7, 6), [x, 5.0, 39], '#8a3a2a');
    deco(b, new CylinderGeometry(0.01, 0.01, 0.5, 3), [x, 5.3, 39], '#c8b8a0');
  }
  for (const z of [35, 44]) {
    wallTorch(b, flames, [-7.98, 2.8, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 2.8, z - 4], -Math.PI / 2);
  }
  webs(b, -8, 8, 31, 48, 5.9, 1.2);
  b.lantern([-3, 4.6, 42], 8, 12);

  // ================================================================ shutter run (z 49..74)
  wall(b, 'z', -4.5, 49, 74, 6, { color: STONE });
  wall(b, 'z', 4.5, 49, 74, 6, { color: STONE });
  slab(b, -4.5, 4.5, 48.5, 74, 6.5, 0.5, COLORS.stoneDark);
  for (const z of [54.5, 60.5, 66.5]) wall(b, 'x', z, -4.5, 4.5, 6, { color: STONE, holes: [gateHole(0)] });
  b.pool(-4, 4, 68.5, 72.5, -1.2, -2.5);
  wall(b, 'x', 74.5, -9.5, 9.5, 10, { color: STONE, holes: [{ from: -2, to: 2, top: 3.6 }] });
  b.add(
    { type: 'checkpoint', pos: [3.3, 0, 50.3], yaw: -Math.PI / 2, zone: { min: [-4, -1, 49], max: [4, 4, 52] } },
    { type: 'trigger', flag: 'vault-hint-shutters', script: 'vaultShutters', min: [-4, -1, 49], max: [4, 5, 52] },
    { type: 'gate', pos: [0, 0, 54.5], yaw: 0, width: 3, height: 3, when: ['v-l1'] },
    { type: 'gate', pos: [0, 0, 60.5], yaw: 0, width: 3, height: 3, when: ['v-l2'] },
    { type: 'gate', pos: [0, 0, 66.5], yaw: 0, width: 3, height: 3, when: ['v-l3'] },
    { type: 'padlock', id: 'v-l1', pos: [-3.2, 1.8, 54], yaw: Math.PI, relock: 7 },
    { type: 'padlock', id: 'v-l2', pos: [-3.2, 1.8, 60], yaw: Math.PI, relock: 7 },
    { type: 'padlock', id: 'v-l3', pos: [3.2, 1.8, 66], yaw: Math.PI, relock: 7 },
    { type: 'padlock', id: 'v-l4', pos: [3.98, 2.4, 70.5], yaw: -Math.PI / 2 },
    { type: 'drawbridge', pos: [0, 0, 72.5], yaw: Math.PI, length: 4, width: 3.2, when: ['v-l4'] },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 56], to: [0, 0.6, 59], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 62], to: [0, 0.6, 65], count: 3 },
  );
  // Winch gear by the far side of the pit, chained to the bridge.
  deco(b, new TorusGeometry(0.5, 0.1, 6, 12).rotateY(Math.PI / 2), [3.85, 2.4, 71.3], '#3a3340');
  for (const x of [-1.5, 1.5]) deco(b, new CylinderGeometry(0.04, 0.04, 4.2, 4), [x, 3.3, 72.6], '#3a3340');
  for (const z of [57, 63]) {
    wallTorch(b, flames, [-3.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [3.98, 3, z], -Math.PI / 2);
  }
  webs(b, -4, 4, 49, 74, 5.9, 0.9);
  b.lantern([0, 5.2, 70.5], 0, 0, false);

  // ================================================================ great vault (z 75..92) + star chamber
  wall(b, 'z', -9.5, 75, 93, 10, { color: STONE });
  wall(b, 'z', 9.5, 75, 93, 10, { color: STONE });
  wall(b, 'x', 92.5, -9.5, 9.5, 10, { color: STONE, holes: [{ from: -1.1, to: 1.1, top: 4 }] });
  slab(b, -9.5, 9.5, 74.5, 93, 10.5, 0.5, COLORS.stoneDark);
  // The lock-wheel over the vault door (low enough to aim at from the middle of the
  // room: the camera can only tilt so far up), and a carved collar round the door.
  deco(b, new TorusGeometry(1.6, 0.16, 8, 32), [0, 6.7, 91.9], '#5a4a3a');
  for (let i = 0; i < 4; i++) deco(b, new BoxGeometry(3.1, 0.14, 0.1).rotateZ((i / 4) * Math.PI), [0, 6.7, 91.92], '#5a4a3a');
  deco(b, new CylinderGeometry(0.35, 0.35, 0.2, 12).rotateX(Math.PI / 2), [0, 6.7, 91.85], '#c99a3e');
  deco(b, new TorusGeometry(2.75, 0.22, 8, 36), [0, 2.3, 91.85], COLORS.stoneLight);
  for (const x of [-1.8, 1.8]) deco(b, new CylinderGeometry(0.05, 0.05, 2.6, 4).rotateZ(x > 0 ? 0.5 : -0.5), [x * 0.7, 5.1, 91.9], '#3a3340');
  for (const x of [-4.5, 4.5]) {
    b.cylinder([x, 3, 85], 0.7, 6, COLORS.stoneLight, undefined, 10);
    deco(b, new BoxGeometry(1.8, 0.4, 1.8), [x, 0.2, 85], COLORS.stoneDark);
  }
  b.add(
    { type: 'checkpoint', pos: [6.5, 0, 76.8], yaw: -Math.PI / 2, zone: { min: [-9, -1, 75], max: [9, 4, 78.5] } },
    { type: 'trigger', flag: 'vault-hint-great', script: 'vaultGreat', min: [-9, -1, 75], max: [9, 5, 79] },
    { type: 'vaultDoor', pos: [0, 2.3, 91.6], yaw: Math.PI, radius: 2.6, when: ['v-w1', 'v-w2', 'v-w3', 'v-w4'] },
    ...[0, 1, 2, 3].map((i) => ({
      type: 'padlock' as const,
      id: `v-w${i + 1}`,
      pos: [0, 0, 0] as V3,
      yaw: Math.PI,
      orbit: { center: [0, 6.7, 91.8] as V3, radius: 1.6, speed: 0.4, phase: (i / 4) * Math.PI * 2 },
    })),
    { type: 'snapcasket', id: 'v-snap4', pos: [-5.5, 0, 81], yaw: 0, wander: 3 },
    { type: 'snapcasket', id: 'v-snap5', pos: [5.5, 0, 88], yaw: Math.PI, wander: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-7.5, 0.6, 79], to: [-7.5, 0.6, 90], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [7.5, 0.6, 79], to: [7.5, 0.6, 90], count: 5 },
  );
  treasure(b, -7.6, 90.6, 18, 2);
  treasure(b, 7.4, 90.4, 16, 5);
  treasure(b, -8, 77, 10, 9);
  rug(b, [0, 0, 83], 5, 9, '#2f5a6a', '#d4a94a');
  for (const z of [80, 88]) {
    wallTorch(b, flames, [-8.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [8.98, 3, z], -Math.PI / 2);
  }
  webs(b, -9, 9, 75, 92, 9.9, 1.6);
  b.lantern([0, 8.5, 82], 10, 18);

  // The old Star chamber: now a treasure passage on to the Counting House.
  wall(b, 'z', -3.5, 115, 121.5, 6, { color: STONE });
  wall(b, 'z', 3.5, 115, 121.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, 115, 121.5, 6.5, 0.5, COLORS.stoneDark);
  treasure(b, -2.3, 119.8, 12, 13);
  treasure(b, 2.3, 119.6, 12, 17);
  bookStack(b, [2.4, 0, 116.2], 5, 21);
  // The Star and the way up moved on to the new chamber (replaced in place: ids stay put).
  b.add(
    { type: 'star', id: 'vault-star', pos: [0, 1.9, STAR_Z], script: 'vaultComplete' },
    { type: 'door', pos: [0, 0, STAR_Z + 2.45], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'quince', spawn: 'fromVault' }, label: 'Up to class' },
  );
  wallTorch(b, flames, [-2.98, 2.6, 117], Math.PI / 2);
  wallTorch(b, flames, [2.98, 2.6, 117], -Math.PI / 2);

  strongroom(b, flames);
  countingHouse(b, flames);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Strongroom (z 93..115), behind the vault door: pendulums and relocking gates. Built
 * last so the earlier rooms' sweets keep their ids.
 */
function strongroom(b: LevelBuilder, flames: Glow): void {
  wall(b, 'z', -4.5, 93, 115, 10, { color: STONE });
  wall(b, 'z', 4.5, 93, 115, 10, { color: STONE });
  wall(b, 'x', 115, -4.5, 4.5, 10, { color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  slab(b, -4.5, 4.5, 93, 115, 10.5, 0.5, COLORS.stoneDark);
  for (const z of [100.5, 111]) {
    wall(b, 'x', z, -4.5, 4.5, 10, { color: STONE, holes: [{ from: -2.1, to: 2.1, top: 3.6 }], thick: 0.6 });
  }
  b.add(
    { type: 'checkpoint', pos: [-3, 0, 94.2], yaw: Math.PI / 2, zone: { min: [-4, -1, 93], max: [4, 4, 95.5] } },
    { type: 'trigger', flag: 'vault-hint-strongroom', script: 'vaultStrongroom', min: [-4, -1, 93], max: [4, 5, 95] },
    { type: 'pendulum', pos: [0, 9.8, 97], length: 8.8, swing: 0.36, period: 2.6, phase: 0, bob: 0.7 },
    { type: 'gate', pos: [0, 0, 100.5], yaw: 0, width: 3, height: 3, when: ['v-g1'] },
    { type: 'padlock', id: 'v-g1', pos: [-3.3, 1.8, 100.1], yaw: Math.PI, relock: 6 },
    { type: 'checkpoint', pos: [-3, 0, 101.8], yaw: Math.PI / 2, zone: { min: [-4, -1, 101], max: [4, 4, 102.6] } },
    { type: 'pendulum', pos: [0, 9.8, 104.5], length: 8.8, swing: 0.36, period: 2.6, phase: 0.5, bob: 0.7 },
    { type: 'pendulum', pos: [0, 9.8, 107.8], length: 8.8, swing: 0.36, period: 2.2, phase: 0.2, bob: 0.7 },
    { type: 'gate', pos: [0, 0, 111], yaw: 0, width: 3, height: 3, when: ['v-g2'] },
    { type: 'padlock', id: 'v-g2', pos: [3.3, 1.8, 110.6], yaw: Math.PI, relock: 6 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 95.5], to: [0, 0.6, 99], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 103], to: [0, 0.6, 109.5], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [3, 0.6, 113.5] },
  );
  for (const z of [97, 104.5, 107.8]) deco(b, new BoxGeometry(9, 0.4, 0.4), [0, 9.8, z], '#3a3340');
  for (const z of [95, 106]) {
    wallTorch(b, flames, [-3.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [3.98, 3, z], -Math.PI / 2);
  }
  treasure(b, -3.2, 113.6, 10, 31);
  b.lantern([0, 8.5, 103], 8, 14);
}

/**
 * The Counting House (z 121.5..155): three padlocks that must be open together, under fire.
 * Then the Star Chamber. Built last so the earlier rooms' sweets keep their ids.
 */
function countingHouse(b: LevelBuilder, flames: Glow): void {
  const Z0 = 121.5;
  const Z1 = 155;
  b.floor(-9.5, 9.5, Z0, Z1 + 6.5, { color: FLOOR });
  wall(b, 'x', Z0, -9.5, 9.5, 11, { color: STONE, holes: [{ from: -1.6, to: 1.6, top: 3.6 }] });
  wall(b, 'z', -9.5, Z0, Z1, 11, { color: STONE });
  wall(b, 'z', 9.5, Z0, Z1, 11, { color: STONE, holes: [{ from: 130.6, to: 133.4, bottom: 4.6, top: 7.4 }] });
  wall(b, 'x', Z1, -9.5, 9.5, 11, { color: STONE, holes: [gateHole(0)] });
  slab(b, -9.5, 9.5, Z0, Z1, 11.5, 0.5, COLORS.stoneDark);
  // The west walkway (3.2) and its stair.
  b.box([-7.25, 1.6, 140], [3.5, 3.2, 24], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.stairs([-7.25, 0, 124], 0, 8, 0.4, 0.5, 3.5, COLORS.stoneLight);
  for (let z = 132; z < 152; z += 2) deco(b, new BoxGeometry(0.08, 1, 0.08), [-5.55, 3.7, z], COLORS.woodDark);
  deco(b, new BoxGeometry(0.06, 0.08, 20), [-5.55, 4.2, 141.5], COLORS.woodDark);
  // The rail holds you: an invisible fence along it (you jump down from the open end by the stair).
  b.box([-5.55, 3.85, 141.5], [0.12, 1.3, 20], { invisible: true, info: { noGrab: true, cameraIgnore: true, seeThrough: true } });
  // The counting table: a broad desk of a pillar, padlock on its north face.
  b.box([0, 1.2, 141], [4, 2.4, 10], { color: '#6a4a32', pattern: 'planks', info: { noGrab: true } });
  treasure(b, -1, 139, 10, 41);
  treasure(b, 1, 143, 10, 43);
  // The east alcove (high), behind a grille: P2 sits at its back.
  b.box([10.6, 4.4, 132], [1.6, 0.4, 2.8], { color: STONE });
  b.box([11.2, 6, 132], [0.4, 3.4, 2.8], { color: STONE });
  for (let z = 130.9; z < 133.2; z += 0.35) deco(b, new BoxGeometry(0.06, 2.8, 0.06), [9.55, 6, z], '#2a2230');
  b.box([9.55, 6, 132], [0.1, 2.8, 2.8], { invisible: true, info: { seeThrough: true, noGrab: true, cameraIgnore: true } });
  b.add(
    { type: 'checkpoint', pos: [3.5, 0, 123], yaw: -Math.PI / 2, zone: { min: [-9, -1, Z0], max: [9, 4, 125] } },
    { type: 'trigger', flag: 'vault-hint-counting', script: 'vaultCounting', min: [-9, -1, Z0], max: [9, 4, 124.5] },
    { type: 'padlock', id: 'v-c1', pos: [0, 1.6, 146.06], yaw: 0, relock: 5.5 },
    { type: 'padlock', id: 'v-c2', pos: [10.9, 6, 132], yaw: -Math.PI / 2, relock: 5.5 },
    { type: 'padlock', id: 'v-c3', pos: [0, 0, 0], yaw: Math.PI, relock: 5.5, orbit: { center: [0, 6.2, Z1 - 0.55], radius: 1.7, speed: 0.9, phase: 0 } },
    { type: 'gate', pos: [0, 0, Z1], yaw: 0, width: 3, height: 3, when: ['v-c1', 'v-c2', 'v-c3'] },
    // (This slot was a Sootling: one new foe per room, and he has the Thwackwort Trial.)
    { type: 'gnarling', pos: [-7.4, 3.2, 147], wander: 1.2 },
    { type: 'hexling', pos: [2, 0, 136], height: 5.5, radius: 4, interval: 3.4 },
    { type: 'snapcasket', id: 'v-snap-c1', pos: [5, 0, 128], wander: 3 },
    { type: 'snapcasket', id: 'v-snap-c2', pos: [5, 0, 150], wander: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-7.25, 3.8, 133], to: [-7.25, 3.8, 147], count: 5 },
    { type: 'sweet', kind: 'humbug', pos: [-7.8, 3.8, 151.5] },
  );
  for (const z of [124, 140, 153]) {
    wallTorch(b, flames, [-8.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [8.98, 3, z], -Math.PI / 2);
  }
  deco(b, new TorusGeometry(1.7, 0.08, 6, 24), [0, 6.2, Z1 - 0.52], GOLD);
  webs(b, -9, 9, Z0 + 0.5, Z1 - 0.5, 10.9, 1.4);
  b.lantern([0, 9.5, 138], 9, 18);
  // The Star Chamber.
  wall(b, 'z', -3.5, Z1, Z1 + 6.5, 6, { color: STONE });
  wall(b, 'z', 3.5, Z1, Z1 + 6.5, 6, { color: STONE });
  wall(b, 'x', Z1 + 6.5, -3.5, 3.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, Z1, Z1 + 6.5, 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, 0.5, STAR_Z], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, STAR_Z], '#c99a3e');
  treasure(b, -2.3, STAR_Z + 1.6, 12, 51);
  treasure(b, 2.3, STAR_Z + 1.4, 12, 57);
  wallTorch(b, flames, [-2.98, 2.6, Z1 + 1.5], Math.PI / 2);
  wallTorch(b, flames, [2.98, 2.6, Z1 + 1.5], -Math.PI / 2);
}

