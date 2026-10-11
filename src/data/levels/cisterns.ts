import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { cobweb, column, deco, Glow, rubble, signboard, slab, wall, wallTorch } from '../../world/props';

/**
 * The Flooded Cisterns, Rimewhistle's trial, under the boathouse. Dark. South to north:
 *
 *   Sluice Room    x -5..5,  z 0..8,   y 0    a checkpoint
 *   Long Canal     x -8..8,  z 8..34,  y 0    water z 11..30; five ice patches zig-zag
 *                                             across (5 s each, 10 charged), gaps you jump on
 *                                             slippery ice; at the north landing a waterfall
 *                                             pours off the cliff (top 3.2): freeze it, climb
 *   Floe Ferry     x -10..10, z 34..56, y 3.2  pool x -8..8, z 37..53; a causeway of stones
 *                                             (x -1.5..1.5) with two 4 m gaps. Floe A (east)
 *                                             shoved west from the east walkway stops at a post
 *                                             in gap 1. Floe B sits in an west bay; freeze the
 *                                             patch from the middle stone to the west islet,
 *                                             stand west of B and shove it east into gap 2.
 *                                             The bell resets the floes. Secret: walk through
 *                                             the waterfall on the west wall (card)
 *   Boiler Hall    x -8..8,  z 59..79, y 3.2  a steaming pool (z 61..77.5) with five Ember Crabs
 *                                             standing in it: freeze one and it's a block of ice
 *                                             to stand on (8 s); hop across them to the far bank,
 *                                             where two more patrol (freeze, then Thwackwort them)
 *   Frost Hall     x -7..7,  z 79..96, y 3.2  an ice wall across the door (Cindersnap melts
 *                                             it); a channel z 62..69 with two patches that
 *                                             last 1.2 s (5 charged); the sluice lever frozen in
 *                                             a block of ice on the dais: melt it, thwack the
 *                                             lever, and the north gate opens
 *   Sluice Canal   x -8..8,  z 96.5..136, y 3.2  water z 100..128: a short-lived ice patch (charged)
 *                                             to a stone, three Ember Crabs in the water to freeze
 *                                             and hop across under their fire, a second stone, a
 *                                             long charged patch to the far landing. A Hexling
 *                                             over the canal; a Sootling holds the Star gate
 *   Star chamber   x -3..3,  z 136..142.5
 */
export const CISTERNS: LevelDef = {
  id: 'cisterns',
  name: 'The Flooded Cisterns',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'sluice', name: 'The Flooded Cisterns', min: [-5, -4, 0], max: [5, 8, 8] },
    { id: 'canal', name: 'The Long Canal', min: [-8, -4, 8], max: [8, 9, 34] },
    { id: 'ferry', name: 'The Floe Ferry', min: [-10, 0, 34], max: [14, 12, 59] },
    { id: 'boiler', name: 'The Boiler Hall', min: [-9, 0, 59], max: [9, 12, 79] },
    { id: 'frost', name: 'The Frost Hall', min: [-7, 0, 79], max: [7, 12, 96.5] },
    { id: 'sluice-canal', name: 'The Sluice Canal', min: [-8.5, -4, 96.5], max: [8.5, 14, 136] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, 0, 136], max: [3.5, 12, 142.5] },
  ],
  intro: { script: 'cisternIntro', unlessFlag: 'cisterns-entered' },
  ambience: 'dim',
  music: 'dungeon',
  build,
};

const STONE = '#5a6a72';
/** The Star, at the far end of the Sluice Canal. */
const STAR_Z = 139.3;
const FLOOR = '#4a5458';
const UP = 3.2;

function build(b: LevelBuilder): void {
  b.killY = -12;
  const flames = new Glow();

  // ================================================================ sluice room (z 0..8)
  b.floor(-5.5, 5.5, -0.5, 8, { color: FLOOR });
  wall(b, 'x', -0.5, -5.5, 5.5, 6, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -5.5, 0, 8, 6, { color: STONE });
  wall(b, 'z', 5.5, 0, 8, 6, { color: STONE });
  slab(b, -5.5, 5.5, -0.5, 8, 6.5, 0.5, COLORS.stoneDark);
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'coldharbour', spawn: 'fromCisterns' } },
    { type: 'checkpoint', pos: [-3.5, 0, 3], yaw: Math.PI / 2, zone: { min: [-5, -1, 0], max: [5, 4, 8] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3], to: [0, 0.6, 7], count: 3 },
  );
  for (const z of [2.5, 6]) {
    wallTorch(b, flames, [-4.98, 2.4, z], Math.PI / 2);
    wallTorch(b, flames, [4.98, 2.4, z], -Math.PI / 2);
  }
  // Sluice wheels on the walls.
  for (const x of [-3.5, 3.5]) {
    deco(b, new CylinderGeometry(0.7, 0.7, 0.12, 10), [x, 2.6, 7.4], '#3a3a40', [Math.PI / 2, 0, 0]);
    deco(b, new BoxGeometry(1.4, 0.1, 0.1), [x, 2.6, 7.3], '#3a3a40');
  }

  // ================================================================ the long canal (z 8..34)
  b.floor(-8.5, 8.5, 8, 34, { color: FLOOR, holes: [[-8, 8, 11, 30]] });
  b.pool(-8, 8, 11, 30, -0.5, -3);
  wall(b, 'x', 8, -8.5, 8.5, 9, { color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  wall(b, 'z', -8.5, 8, 34, 9, { color: STONE });
  wall(b, 'z', 8.5, 8, 34, 9, { color: STONE });
  slab(b, -8.5, 8.5, 8, 34, 9.5, 0.5, COLORS.stoneDark);
  const patches: [number, number, number, number][] = [
    [-3.3, 12.2, -0.7, 14.8],
    [0.7, 16, 3.3, 18.6],
    [-3.3, 19.8, -0.7, 22.4],
    [0.7, 23.6, 3.3, 26.2],
    [-1.3, 27.4, 1.3, 30],
  ];
  b.add(
    { type: 'trigger', flag: 'cistern-hint-canal', script: 'cisternCanal', min: [-8, -1, 8], max: [8, 5, 11] },
    ...patches.map(([x0, z0, x1, z1]) => ({ type: 'iceSheet' as const, min: [x0, z0] as [number, number], max: [x1, z1] as [number, number], y: -0.5, duration: 5 })),
    { type: 'checkpoint', pos: [-6.5, 0, 31], yaw: Math.PI / 2, zone: { min: [-8, -1, 30], max: [8, 3, 32.4] } },
    { type: 'trigger', flag: 'cistern-hint-falls', script: 'cisternFalls', min: [-8, -1, 30], max: [8, 3, 32.4] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-5, 0.6, 9.5], to: [5, 0.6, 9.5], count: 4 },
  );
  // The cliff up to the ferry (top 3.2), with a waterfall into a basin at its foot.
  b.box([0, UP / 2, 34.5], [21, UP, 1], { color: STONE, info: { noGrab: true } });
  for (const [c, sz] of [
    [[0, 0.25, 32.3], [2.8, 0.5, 0.2]],
    [[-1.4, 0.25, 33.1], [0.2, 0.5, 1.8]],
    [[1.4, 0.25, 33.1], [0.2, 0.5, 1.8]],
  ] as [V3, V3][]) {
    b.box(c, sz, { color: COLORS.stoneLight, info: { noGrab: true } });
  }
  // Ends 2 cm short of the floor's edge, whose face its basin shared.
  b.pool(-1.3, 1.3, 32.4, 33.98, 0.3, -0.05);
  deco(b, new CylinderGeometry(0.25, 0.3, 0.8, 6), [0, UP - 0.1, 33.9], COLORS.stoneDark, [Math.PI / 2, 0, 0]);
  b.add({ type: 'waterfall', pos: [0, 0.3, 34], yaw: Math.PI, width: 1.8, height: UP - 0.3, pillar: 1.9, depth: 1.2 });
  for (const z of [14, 22, 29]) {
    wallTorch(b, flames, [-7.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 3, z], -Math.PI / 2);
  }
  for (const [x, z] of [
    [-6, 15],
    [5.5, 21],
    [-5.5, 26],
  ]) {
    column(b, x, z, 9, -3);
  }
  b.lantern([0, 7, 20], 7, 18);

  // ================================================================ the floe ferry (z 34..56, y 3.2)
  // Starts behind the cliff block (z 34..35), so their faces never overlap.
  b.floor(-10.5, 10.5, 35, 59, {
    top: UP,
    color: FLOOR,
    holes: [
      [-8, 8, 37, 53],
      [-10, -8, 44, 53],
      [8, 10, 37, 53],
    ],
  });
  b.pool(-10, 10, 37, 53, UP - 0.5, 0.4);
  wall(b, 'z', -10.5, 34, 59, 8, { base: UP, color: STONE });
  wall(b, 'z', 10.5, 34, 59, 8, { base: UP, color: STONE, holes: [{ from: 53.8, to: 56.2, top: 3.4 }] });
  wall(b, 'x', 59, -10.5, 10.5, 8, { base: UP, color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  slab(b, -10.5, 10.5, 34, 59.5, UP + 8.5, 0.5, COLORS.stoneDark);
  // The causeway: three stones with two gaps; posts that stop the floes; the west islet.
  const stone = (x0: number, x1: number, z0: number, z1: number, top = UP + 0.2) =>
    b.box([(x0 + x1) / 2, (top + 0.4) / 2, (z0 + z1) / 2], [x1 - x0, top - 0.4, z1 - z0], { color: COLORS.stoneLight, info: { noGrab: true } });
  stone(-1.5, 1.5, 37, 39.5);
  stone(-1.5, 1.5, 43.5, 46);
  stone(-1.5, 1.5, 50, 53);
  stone(1.6, 2.6, 40.5, 42.5, UP + 1);
  stone(-2.6, -1.6, 47, 49, UP + 1);
  stone(7.4, 10, 46.8, 49.2);
  b.add(
    { type: 'checkpoint', pos: [-6, UP, 35.4], yaw: Math.PI / 2, zone: { min: [-10, UP - 1, 34], max: [10, UP + 3, 37] } },
    { type: 'trigger', flag: 'cistern-hint-ferry', script: 'cisternFerry', min: [-10, UP - 1, 34], max: [10, UP + 3, 36.5] },
    { type: 'floe', pos: [-5.5, UP - 0.5, 41.5], size: [3, 3.6], resetOn: 'cf-reset' },
    { type: 'floe', pos: [5.5, UP - 0.5, 48], size: [3, 3.6], resetOn: 'cf-reset' },
    { type: 'iceSheet', min: [1.5, 44.2], max: [7.4, 45.9], y: UP - 0.5, duration: 8 },
    { type: 'knockSwitch', id: 'cf-reset', pos: [4, UP + 1.6, 34.9], yaw: 0, style: 'bell', timed: 1 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, UP + 0.8, 38], to: [0, UP + 0.8, 45], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [8.7, UP + 0.6, 48] },
  );
  signboard(b, 'Ring to reset the floes', [4, UP + 3.3, 34.55], 0);
  // The secret: a waterfall over an opening in the west wall, with an alcove behind it.
  b.add(
    { type: 'waterfall', pos: [10, UP, 55], yaw: -Math.PI / 2, width: 2.2, height: 3.4, pillar: 1.6, depth: 1, duration: 6 },
    { type: 'card', card: 'rime-toad', pos: [12.3, UP + 1.2, 55] },
    { type: 'secret', id: 'cistern-falls', area: 'ferry', min: [10.8, UP - 0.5, 53.8], max: [13.6, UP + 3, 56.2] },
    { type: 'sweetLine', kind: 'fizzwort', from: [4.5, UP + 0.6, 55], to: [8.5, UP + 0.6, 55], count: 3 },
  );
  b.box([12.3, UP - 0.2, 55], [2.6, 0.4, 2.6], { color: FLOOR });
  b.box([12.3, UP + 1.7, 53.65], [2.6, 3.4, 0.3], { color: STONE });
  b.box([12.3, UP + 1.7, 56.35], [2.6, 3.4, 0.3], { color: STONE });
  b.box([13.75, UP + 1.7, 55], [0.3, 3.4, 3], { color: STONE });
  b.box([12.3, UP + 3.55, 55], [3.2, 0.3, 3], { color: COLORS.stoneDark });
  for (const z of [38, 50]) {
    wallTorch(b, flames, [-9.98, UP + 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [9.98, UP + 2.6, z], -Math.PI / 2);
  }
  b.lantern([0, UP + 6, 45], 7, 18);

  // ================================================================ the frost hall (z 79..96, y 3.2)
  b.floor(-7.5, 7.5, 79, 96.5, { top: UP, color: FLOOR, holes: [[-7, 7, 82, 89]] });
  b.pool(-7, 7, 82, 89, UP - 0.5, 0.4);
  wall(b, 'z', -7.5, 79, 96.5, 7, { base: UP, color: STONE });
  wall(b, 'z', 7.5, 79, 96.5, 7, { base: UP, color: STONE });
  wall(b, 'x', 96.5, -7.5, 7.5, 7, { base: UP, color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  slab(b, -7.5, 7.5, 79, 96.5, UP + 7.5, 0.5, COLORS.stoneDark);
  b.add(
    { type: 'burnable', style: 'ice', pos: [0, UP + 1.7, 79], size: [2.4, 3.4, 0.9] },
    { type: 'checkpoint', pos: [-5, UP, 80.8], yaw: Math.PI / 2, zone: { min: [-7, UP - 1, 79.6], max: [7, UP + 3, 82] } },
    { type: 'trigger', flag: 'cistern-hint-frost', script: 'cisternFrost', min: [-1.2, UP - 1, 76.5], max: [1.2, UP + 3, 78.2] },
    { type: 'iceSheet', min: [-1.5, 82], max: [1.5, 85.2], y: UP - 0.5, duration: 1.2, chargedDuration: 5 },
    { type: 'iceSheet', min: [-1.5, 86.2], max: [1.5, 89], y: UP - 0.5, duration: 1.2, chargedDuration: 5 },
    { type: 'trigger', flag: 'cistern-hint-charge', script: 'cisternCharge', min: [-7, UP - 1, 79.6], max: [7, UP + 3, 82], delay: 30, perVisit: true },
    // The Star moved on to the Sluice Canal (replaced in place: ids stay put); the block of
    // ice on the dais now holds the sluice lever.
    { type: 'star', id: 'cistern-star', pos: [0, UP + 1.9, STAR_Z], script: 'cisternComplete' },
    { type: 'burnable', style: 'ice', pos: [0, UP + 1.9, 93], size: [1.8, 1.8, 1.8] },
    { type: 'door', pos: [0, UP, STAR_Z + 2.65], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'coldharbour', spawn: 'fromCisterns' }, label: 'Up to class' },
  );
  b.cylinder([0, UP + 0.5, 93], 0.9, 1, COLORS.stoneLight, undefined, 8);
  for (let i = 0; i < 10; i++) deco(b, new ConeGeometry(0.08, 0.5 + (i % 3) * 0.3, 4), [-6.5 + i * 1.45, UP + 6.6, 84 + (i % 2) * 6], '#d8f2fc', [Math.PI, 0, 0]);
  for (let i = 0; i < 6; i++) deco(b, new IcosahedronGeometry(0.3 + (i % 3) * 0.15, 0), [-6 + (i % 2) * 12, UP + 0.2, 91 + i], '#cfeefa');
  for (const z of [81, 92]) {
    wallTorch(b, flames, [-7.48, UP + 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [7.48, UP + 2.6, z], -Math.PI / 2);
  }
  b.lantern([0, UP + 5.5, 91], 7, 14);
  rubble(b, 6, 94, 5, 9, UP);
  for (const [c, d1, d2] of [
    [[-5, 5.9, 0], [1, 0], [0, 1]],
    [[5, 5.9, 0], [-1, 0], [0, 1]],
    [[-10, UP + 7.9, 59], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.2);
  }

  boilerHall(b, flames);
  sluiceCanal(b, flames);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Boiler Hall (z 59..79, y 3.2), between the Floe Ferry and the Frost Hall. Built last
 * so the earlier rooms' sweets keep their ids.
 */
function boilerHall(b: LevelBuilder, flames: Glow): void {
  const W = UP - 0.5;
  b.floor(-9, 9, 59.5, 79, { top: UP, color: FLOOR, holes: [[-8.5, 8.5, 61, 77.5]] });
  b.pool(-8.5, 8.5, 61, 77.5, W, 0.4);
  wall(b, 'z', -9, 59, 79, 8, { base: UP, color: STONE });
  wall(b, 'z', 9, 59, 79, 8, { base: UP, color: STONE });
  wall(b, 'x', 79, -9.5, 9.5, 8, { base: UP, color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  slab(b, -9.5, 9.5, 59, 79, UP + 8.5, 0.5, COLORS.stoneDark);
  // Five crabs stand in the water on sunken ledges (you can't stand on those: they're under
  // water). Frozen, each is a block of ice just level with the banks.
  const stones: [number, number][] = [
    [-2, 63],
    [0, 66.2],
    [2, 69.4],
    [0, 72.6],
    [-2, 75.8],
  ];
  for (const [x, z] of stones) b.box([x, (0.4 + W - 0.4) / 2, z], [1.6, W - 0.4 - 0.4, 1.4], { color: COLORS.stoneDark });
  b.add(
    { type: 'checkpoint', pos: [-6.5, UP, 60.2], yaw: Math.PI / 2, zone: { min: [-8.5, UP - 1, 59.5], max: [8.5, UP + 3, 61] } },
    { type: 'trigger', flag: 'cistern-hint-crabs', script: 'cisternCrabs', min: [-8.5, UP - 1, 59.5], max: [8.5, UP + 3, 61] },
    ...stones.map(([x, z]) => ({ type: 'emberCrab' as const, pos: [x, W - 0.8, z] as V3, patrol: 0, range: 9, interval: 4, reform: 6 })),
    { type: 'checkpoint', pos: [6.5, UP, 78], yaw: -Math.PI / 2, zone: { min: [-8.5, UP - 1, 77.5], max: [8.5, UP + 3, 79] } },
    { type: 'emberCrab', pos: [-5, UP, 78.2], patrol: 2.5, interval: 3 },
    { type: 'emberCrab', pos: [5, UP, 78.2], patrol: 2.5, interval: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, UP + 0.6, 60.2], to: [4, UP + 0.6, 60.2], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [8, UP + 0.6, 78.2] },
  );
  // Steam vents and boiler pipes.
  for (const [x, z] of [
    [-7, 66],
    [6, 71],
    [-5, 74],
  ]) {
    deco(b, new CylinderGeometry(0.3, 0.4, 0.3, 8), [x, W + 0.1, z], '#5a5a66');
  }
  for (const z of [62, 70, 76]) deco(b, new CylinderGeometry(0.25, 0.25, 17.5, 8), [0, UP + 6.5, z], '#8a6a4a', [0, 0, Math.PI / 2]);
  for (const z of [60.5, 77.5]) {
    wallTorch(b, flames, [-8.48, UP + 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [8.48, UP + 2.6, z], -Math.PI / 2);
  }
  b.lantern([-4, UP + 6, 64], 8, 16);
  b.lantern([4, UP + 6, 74], 8, 16);
}

/**
 * The Sluice Canal (z 96.5..136, y 3.2): ice, frozen crabs and a long charged patch under
 * fire. The Frost Hall's lever opens the way in. Built last so the earlier rooms' sweets keep
 * their ids.
 */
function sluiceCanal(b: LevelBuilder, flames: Glow): void {
  const Z0 = 96.5;
  const Z1 = 136;
  const W = UP - 0.5;
  b.floor(-8.5, 8.5, Z0, Z1 + 6.5, { top: UP, color: FLOOR, holes: [[-8, 8, 100, 128]] });
  b.pool(-8, 8, 100, 128, W, 0.4);
  wall(b, 'z', -8.5, Z0, Z1, 8, { base: UP, color: STONE });
  wall(b, 'z', 8.5, Z0, Z1, 8, { base: UP, color: STONE });
  wall(b, 'x', Z1, -8.5, 8.5, 8, { base: UP, color: STONE, holes: [{ from: -2.1, to: 2.1, top: 3.6 }] });
  slab(b, -8.5, 8.5, Z0, Z1, UP + 8.5, 0.5, COLORS.stoneDark);
  // Two stones in the canal, and the crabs' footings under the water.
  for (const [z0, z1] of [
    [106, 108],
    [117, 119],
  ]) {
    b.box([0, (UP + 0.4) / 2, (z0 + z1) / 2], [3, UP - 0.4, z1 - z0], { color: COLORS.stoneLight });
  }
  const crabs: [number, number][] = [
    [0, 110.1],
    [1.8, 112.7],
    [-0.6, 115.3],
  ];
  for (const [x, z] of crabs) b.box([x, (0.4 + W - 0.3) / 2, z], [1.6, W - 0.3 - 0.4, 1.4], { color: COLORS.stoneDark });
  b.add(
    { type: 'knockSwitch', id: 'c-sluice', pos: [0, UP + 1.6, 93], yaw: Math.PI, style: 'target', latch: true },
    { type: 'gate', pos: [0, UP, Z0], yaw: 0, width: 2.4, height: 3.2, when: ['c-sluice'] },
    { type: 'checkpoint', pos: [-6.5, UP, 98.2], yaw: Math.PI / 2, zone: { min: [-8, UP - 1, 96.8], max: [8, UP + 3, 100] } },
    { type: 'trigger', flag: 'cistern-hint-sluice', script: 'cisternSluice', min: [-8, UP - 1, 96.8], max: [8, UP + 3, 99.5] },
    { type: 'iceSheet', min: [-1.5, 100], max: [1.5, 106], y: W, duration: 1.2, chargedDuration: 4.5 },
    ...crabs.map(([x, z]) => ({ type: 'emberCrab' as const, pos: [x, W - 0.3, z] as V3, patrol: 0, range: 12, interval: 3, reform: 6 })),
    { type: 'iceSheet', min: [-1.5, 119], max: [1.5, 128], y: W, duration: 1.2, chargedDuration: 4 },
    { type: 'hexling', pos: [0, UP, 113], height: 4.5, radius: 4, interval: 3.6 },
    { type: 'sootling', id: 'c-soot', pos: [5.5, UP, 132.5], yaw: Math.PI, wander: 0.8, range: 20, interval: 3.8 },
    { type: 'checkpoint', pos: [-6.5, UP, 130], yaw: Math.PI / 2, zone: { min: [-8, UP - 1, 128.2], max: [8, UP + 3, 135.6] } },
    { type: 'gate', pos: [0, UP, Z1], yaw: 0, width: 3, height: 3, when: ['c-soot'] },
    { type: 'sweet', kind: 'bramble', pos: [0, UP + 0.6, 107] },
    { type: 'sweet', kind: 'bramble', pos: [0, UP + 0.6, 118] },
    { type: 'sweet', kind: 'humbug', pos: [-7, UP + 0.6, 134.5] },
  );
  for (let i = 0; i < 12; i++) deco(b, new ConeGeometry(0.08, 0.5 + (i % 3) * 0.3, 4), [-7.5 + i * 1.4, UP + 7.6, 102 + (i % 3) * 9], '#d8f2fc', [Math.PI, 0, 0]);
  for (const z of [98, 131]) {
    wallTorch(b, flames, [-7.98, UP + 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, UP + 2.6, z], -Math.PI / 2);
  }
  // The Star chamber.
  wall(b, 'z', -3.5, Z1, Z1 + 6.5, 6, { base: UP, color: STONE });
  wall(b, 'z', 3.5, Z1, Z1 + 6.5, 6, { base: UP, color: STONE });
  wall(b, 'x', Z1 + 6.5, -3.5, 3.5, 6, { base: UP, color: STONE });
  slab(b, -3.5, 3.5, Z1, Z1 + 6.5, UP + 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, UP + 0.5, STAR_Z], 0.9, 1, COLORS.stoneLight, undefined, 8);
  for (const x of [-2.98, 2.98]) wallTorch(b, flames, [x, UP + 2.6, Z1 + 1.6], x < 0 ? Math.PI / 2 : -Math.PI / 2);
}

