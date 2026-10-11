import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { cobweb, column, deco, Glow, rubble, slab, urn, wall, wallTorch } from '../../world/props';

/**
 * The Lamplit Catacombs, Glimmerwick's trial, under Lamplough's study. Dark. South to
 * north (+Z):
 *
 *   Antechamber      x -5..5,  z 0..9.5   torches, a checkpoint
 *   Glimmer Bridge   x -5..5,  z 9.5..30  a chasm (z 11..29.2, bottomless) crossed on glimmer
 *                                         stones: lamp G1 lights the first three, then the
 *                                         island (z 17..19) with lamp G2 for three more; the
 *                                         last two only show in a CHARGED G2, and the gap
 *                                         without them is too wide to jump
 *   False Walls      x -8..8,  z 31..50   three walls across, each with one false 2 m section
 *                                         (x -5, 3, -1), and a lamp on a post at the start of
 *                                         each section: the first only shows its wall when
 *                                         CHARGED; the second also (charged) unmasks a false bit
 *                                         of the east wall with the card behind it
 *   Lamplough's      x -9..9,  z 51..70   a divider (x 0, z 54..67) splits the room; four wall
 *   Lantern                               lamps (two per half) open the north gate only while
 *                                         ALL are lit (9 s each). Snapcaskets in both halves
 *   Ember Crypt      x -7..7,  z 71..90   a chasm (z 73.5..86.5) crossed on glimmer stones: lamp
 *                                         C1 on the landing lights the first two, C2 on the island
 *                                         halfway lights the rest; two Ember Crabs on the far ledge
 *                                         spit fire as you cross (Thwackwort flips them a while)
 *   Passage          x -3..3,  z 90.5..98.5 (the old Star chamber)
 *   Moth Ossuary     x -8..8,  z 98.5..131 a chasm (z 102..126) crossed on ten glimmer stones lit
 *                                         by three lamps that burn only 6 s: L1 on the landing,
 *                                         then hanging lamps L2 and L3 over the chasm, lit from
 *                                         the stones before them; the last stone shows only in
 *                                         a CHARGED L3. A Hexling hunts over the chasm. The way
 *                                         out is a false wall only a CHARGED lamp unmasks
 *   Star chamber     x -3..3,  z 131.5..138.5
 */
export const CATACOMBS: LevelDef = {
  id: 'catacombs',
  name: 'The Lamplit Catacombs',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'antechamber', name: 'The Lamplit Catacombs', min: [-5, -20, 0], max: [5, 8, 9.5] },
    { id: 'bridge', name: 'The Glimmer Bridge', min: [-5, -20, 9.5], max: [5, 9, 30.5] },
    { id: 'walls', name: 'The Hall of False Walls', min: [-11, -3, 30.5], max: [8, 9, 50.5] },
    { id: 'lantern', name: "Lamplough's Lantern", min: [-9, -3, 50.5], max: [9, 9, 70.5] },
    { id: 'crypt', name: 'The Ember Crypt', min: [-7.5, -20, 70.5], max: [7.5, 9, 90.5] },
    { id: 'lantern', name: "Lamplough's Lantern", min: [-3.5, -3, 90.5], max: [3.5, 9, 98.5] },
    { id: 'ossuary', name: 'The Moth Ossuary', min: [-8.5, -20, 98.5], max: [8.5, 10, 131.5] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, -3, 131.5], max: [3.5, 9, 138.5] },
  ],
  intro: { script: 'catacombIntro', unlessFlag: 'catacombs-entered' },
  ambience: 'dark',
  music: 'dungeon',
  build,
};

const STONE = '#6a6070';
/** The Star Chamber, after the Moth Ossuary. */
const STAR_Z = 135;
const FLOOR = '#4a4450';

function build(b: LevelBuilder): void {
  b.killY = -15;
  const flames = new Glow();
  b.floor(-11, 9.5, -0.5, 98.5, { color: FLOOR, holes: [[-5, 5, 11, 29.2], [-7, 7, 73.5, 86.5]] });
  b.mist(-5, 5, 11, 29.2, -5);

  // ================================================================ antechamber (z 0..9.5)
  wall(b, 'x', -0.5, -5.5, 5.5, 6, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -5.5, 0, 30.5, 7, { color: STONE });
  wall(b, 'z', 5.5, 0, 30.5, 7, { color: STONE });
  slab(b, -5.5, 5.5, -0.5, 30.5, 7.5, 0.5, COLORS.stoneDark);
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'lamplough', spawn: 'fromCatacombs' } },
    { type: 'checkpoint', pos: [-3.5, 0, 3], yaw: Math.PI / 2, zone: { min: [-5, -1, 0], max: [5, 4, 9] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3.5], to: [0, 0.6, 9], count: 4 },
  );
  for (const z of [3, 8]) {
    wallTorch(b, flames, [-4.98, 2.4, z], Math.PI / 2);
    wallTorch(b, flames, [4.98, 2.4, z], -Math.PI / 2);
  }
  urn(b, [4.2, 0, 1]);
  rubble(b, -4, 8.5, 6, 2);

  // ================================================================ glimmer bridge (z 10..30)
  // The island, standing up out of the dark.
  b.box([0, -6, 18], [2.4, 12, 2], { color: COLORS.stoneLight });
  deco(b, new BoxGeometry(2.6, 0.15, 2.2), [0, 0.03, 18], COLORS.stoneDark);
  const stones: [number, number][] = [
    [0.6, 12.2],
    [-0.6, 14],
    [0.3, 15.8],
    [-0.5, 19.8],
    [0.7, 21.6],
    [-0.4, 23.4],
    [0.7, 25.2], // these two only in a charged glow
    [-0.2, 27],
  ];
  b.add(
    { type: 'trigger', flag: 'catacomb-hint-bridge', script: 'catacombBridge', min: [-5, -1, 9.5], max: [5, 5, 11] },
    { type: 'wickLamp', id: 'cG1', pos: [2.6, 0, 10.2], radius: 6.5, duration: 7, light: true },
    { type: 'wickLamp', id: 'cG2', pos: [0.8, 0, 18.4], radius: 6, duration: 7, light: true },
    ...stones.map(([x, z]) => ({ type: 'glimmerBlock' as const, pos: [x, -0.15, z] as V3, size: [1.6, 0.3, 1.6] as V3 })),
    { type: 'checkpoint', pos: [3.5, 0, 29.9], yaw: -Math.PI / 2, zone: { min: [-5, -1, 29.2], max: [5, 4, 30.5] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-0.5, 0.6, 17.6], to: [0.5, 0.6, 18.6], count: 2 },
  );
  for (const z of [14, 24]) {
    wallTorch(b, flames, [-4.98, 3.5, z], Math.PI / 2);
    wallTorch(b, flames, [4.98, 3.5, z], -Math.PI / 2);
  }
  // Broken bridge stubs at each edge.
  for (const z of [10.6, 29.6]) deco(b, new BoxGeometry(2, 0.3, 0.8), [0, -0.16, z], COLORS.stoneDark);

  // ================================================================ hall of false walls (z 31..50)
  wall(b, 'x', 30.5, -8.5, 8.5, 7, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.4 }] });
  wall(b, 'z', -8.5, 30.5, 50.5, 7, { color: STONE, holes: [{ from: 38, to: 40, top: 3 }] });
  wall(b, 'z', 8.5, 30.5, 50.5, 7, { color: STONE });
  slab(b, -8.5, 8.5, 30.5, 50.5, 7.5, 0.5, COLORS.stoneDark);
  // Three walls across, each with one false section.
  for (const [z, fx] of [
    [36, -5],
    [41, 3],
    [46, -1],
  ]) {
    // 3 m tall: low enough to see the hanging lamp over them from the entrance.
    if (fx - 1 > -8) b.box([(-8 + fx - 1) / 2, 1.5, z], [fx - 1 + 8, 3, 0.6], { color: STONE, pattern: 'stone' });
    if (fx + 1 < 8) b.box([(8 + fx + 1) / 2, 1.5, z], [8 - fx - 1, 3, 0.6], { color: STONE, pattern: 'stone' });
    b.add({ type: 'illusionWall', pos: [fx, 1.5, z], size: [2, 3, 0.6], color: STONE });
  }
  // The secret alcove behind a false bit of the east wall.
  b.box([-9.75, 1.5, 37.9], [2.5, 3, 0.2], { color: STONE });
  b.box([-9.75, 1.5, 40.1], [2.5, 3, 0.2], { color: STONE });
  b.box([-11.1, 1.5, 39], [0.2, 3, 2.4], { color: STONE });
  b.box([-9.75, 3.15, 39], [2.7, 0.3, 2.4], { color: COLORS.stoneDark });
  b.add(
    { type: 'checkpoint', pos: [-6.5, 0, 32], yaw: Math.PI / 2, zone: { min: [-8, -1, 31], max: [8, 4, 33.5] } },
    { type: 'trigger', flag: 'catacomb-hint-walls', script: 'catacombWalls', min: [-8, -1, 31], max: [8, 5, 33.5] },
    // Eye-level lamps, one per section, easy to spot and aim at. The first stays lit and
    // lights the hall; only a charged cast makes it reach the first false wall.
    { type: 'wickLamp', id: 'cW1', pos: [0, 0, 33.5], radius: 4, duration: 0, light: true, lightRange: 16 },
    { type: 'wickLamp', id: 'cW2', pos: [-1, 0, 38.5], radius: 4.5, duration: 10 },
    { type: 'wickLamp', id: 'cW3', pos: [2, 0, 43.5], radius: 4, duration: 10 },
    // Inside the alcove, so the false wall can always be lit from this side too.
    { type: 'wickLamp', pos: [-10.6, 0, 39.6], radius: 2.5, duration: 10 },
    { type: 'illusionWall', pos: [-8.5, 1.5, 39], size: [1, 3, 2], color: STONE },
    { type: 'card', card: 'gloomwisp', pos: [-10, 1.2, 39] },
    { type: 'secret', id: 'catacomb-alcove', area: 'walls', min: [-11, -1, 38], max: [-9, 3, 40] },
    { type: 'gnarling', pos: [4.5, 0, 38.5], wander: 2.5 },
    { type: 'gnarling', pos: [-4.5, 0, 43.5], wander: 2.5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-6, 0.6, 38.5], to: [6, 0.6, 38.5], count: 5 },
    { type: 'sweet', kind: 'bramble', pos: [6.5, 0.6, 48.5] },
  );
  for (const z of [34, 44]) {
    wallTorch(b, flames, [-7.98, 4.5, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 4.5, z], -Math.PI / 2);
  }
  rubble(b, 7, 33, 5, 7);

  // ================================================================ Lamplough's Lantern (z 51..70)
  wall(b, 'x', 50.5, -9.5, 9.5, 8, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.4 }] });
  wall(b, 'z', -9.5, 50.5, 71, 8, { color: STONE });
  wall(b, 'z', 9.5, 50.5, 71, 8, { color: STONE });
  wall(b, 'x', 70.5, -9.5, 9.5, 8, { color: STONE, holes: [{ from: -2.1, to: 2.1, top: 3.6 }] });
  slab(b, -9.5, 9.5, 50.5, 70.5, 8.5, 0.5, COLORS.stoneDark);
  b.box([0, 4, 60.5], [0.8, 8, 13], { color: STONE, pattern: 'stone' }); // the divider (z 54..67)
  b.add(
    { type: 'checkpoint', pos: [-3.5, 0, 52.3], yaw: Math.PI / 2, zone: { min: [-9, -1, 51], max: [9, 4, 53.5] } },
    { type: 'trigger', flag: 'catacomb-hint-lantern', script: 'catacombLantern', min: [-9, -1, 51], max: [9, 5, 53.5] },
    { type: 'wickLamp', id: 'cL1', pos: [-8.98, 2.4, 56], yaw: Math.PI / 2, style: 'wall', radius: 3, duration: 9 },
    { type: 'wickLamp', id: 'cL2', pos: [-8.98, 2.4, 65], yaw: Math.PI / 2, style: 'wall', radius: 3, duration: 9 },
    { type: 'wickLamp', id: 'cL3', pos: [8.98, 2.4, 56], yaw: -Math.PI / 2, style: 'wall', radius: 3, duration: 9 },
    { type: 'wickLamp', id: 'cL4', pos: [8.98, 2.4, 65], yaw: -Math.PI / 2, style: 'wall', radius: 3, duration: 9 },
    { type: 'gate', pos: [0, 0, 70.5], yaw: 0, width: 3, height: 3, when: ['cL1', 'cL2', 'cL3', 'cL4'] },
    { type: 'snapcasket', id: 'c-snap1', pos: [-5, 0, 61], yaw: Math.PI / 2, wander: 2.5 },
    { type: 'snapcasket', id: 'c-snap2', pos: [5, 0, 61], yaw: -Math.PI / 2, wander: 2.5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-5, 0.6, 68.5], to: [5, 0.6, 68.5], count: 5 },
  );
  // The great Lantern itself, hanging over the divider (dark until the gate opens).
  deco(b, new CylinderGeometry(0.06, 0.06, 3, 5), [0, 7, 60.5], '#3a3340');
  deco(b, new SphereGeometry(0.9, 12, 8), [0, 5.2, 60.5], '#c8c0b0');
  deco(b, new CylinderGeometry(0.2, 1.1, 0.6, 8), [0, 6.1, 60.5], '#2a2230');
  for (const [x, z] of [
    [-6, 53],
    [6, 53],
    [-6, 68],
    [6, 68],
  ]) {
    column(b, x, z, 8);
  }
  for (const z of [53.5, 67.5]) {
    wallTorch(b, flames, [-0.42, 3, z], -Math.PI / 2);
    wallTorch(b, flames, [0.42, 3, z], Math.PI / 2);
  }

  // The old Star chamber: a lit passage on to the Moth Ossuary.
  wall(b, 'z', -3.5, 90.5, 98.5, 6, { color: STONE });
  wall(b, 'z', 3.5, 90.5, 98.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, 90.5, 98.5, 6.5, 0.5, COLORS.stoneDark);
  b.add(
    // The Star and the way up moved on (replaced in place: ids stay put).
    { type: 'star', id: 'catacomb-star', pos: [0, 1.9, STAR_Z], script: 'catacombComplete' },
    { type: 'door', pos: [0, 0, STAR_Z + 2.95], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'lamplough', spawn: 'fromCatacombs' }, label: 'Up to class' },
    { type: 'wickLamp', pos: [-2.2, 0, 92.5], radius: 2, duration: 0, lit: true },
    { type: 'wickLamp', pos: [2.2, 0, 92.5], radius: 2, duration: 0, lit: true },
  );
  for (const [c, d1, d2] of [
    [[-5, 6.9, 0], [1, 0], [0, 1]],
    [[5, 6.9, 0], [-1, 0], [0, 1]],
    [[-8, 6.9, 50], [1, 0], [0, -1]],
    [[8, 6.9, 50], [-1, 0], [0, -1]],
    [[-9, 7.9, 70], [1, 0], [0, -1]],
    [[9, 7.9, 70], [-1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.3);
  }

  emberCrypt(b, flames);
  mothOssuary(b, flames);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Ember Crypt (z 70.5..90.5), between Lamplough's Lantern and the Star. Built last so
 * the earlier rooms' sweets keep their ids.
 */
function emberCrypt(b: LevelBuilder, flames: Glow): void {
  wall(b, 'z', -7.5, 70.5, 90.5, 7, { color: STONE });
  wall(b, 'z', 7.5, 70.5, 90.5, 7, { color: STONE });
  wall(b, 'x', 90.5, -7.5, 7.5, 7, { color: STONE, holes: [{ from: -1.2, to: 1.2, top: 3.4 }] });
  slab(b, -7.5, 7.5, 70.5, 90.5, 7.5, 0.5, COLORS.stoneDark);
  b.box([0, -12, 80], [14, 0.5, 13], { color: '#141016', noCollide: true });
  b.mist(-7, 7, 73.5, 86.5, -5);
  // The island halfway across.
  b.box([-3, -6, 80], [2.2, 12, 2.2], { color: COLORS.stoneLight });
  deco(b, new BoxGeometry(2.4, 0.15, 2.4), [-3, 0.03, 80], COLORS.stoneDark);
  const stones: [number, number][] = [
    [0.6, 75],
    [-0.4, 77.4],
    [-0.6, 82.6],
    [0.5, 85],
  ];
  b.add(
    { type: 'checkpoint', pos: [-5.5, 0, 72], yaw: Math.PI / 2, zone: { min: [-7, -1, 70.5], max: [7, 4, 73.5] } },
    { type: 'trigger', flag: 'catacomb-hint-crypt', script: 'catacombCrypt', min: [-7, -1, 70.5], max: [7, 5, 72.5] },
    { type: 'wickLamp', pos: [3, 0, 72.4], radius: 6.5, duration: 8, light: true },
    { type: 'wickLamp', pos: [-3.4, 0, 80.3], radius: 6.5, duration: 8, light: true },
    ...stones.map(([x, z]) => ({ type: 'glimmerBlock' as const, pos: [x, -0.15, z] as V3, size: [1.6, 0.3, 1.6] as V3 })),
    { type: 'checkpoint', pos: [5.5, 0, 88.5], yaw: -Math.PI / 2, zone: { min: [-7, -1, 86.5], max: [7, 4, 90.5] } },
    { type: 'emberCrab', pos: [-3.5, 0, 88.2], patrol: 2, interval: 2.8 },
    { type: 'emberCrab', pos: [3.5, 0, 88.6], patrol: 2, interval: 2.8 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-3.5, 0.6, 79.5], to: [-2.5, 0.6, 80.5], count: 2 },
    { type: 'sweet', kind: 'bramble', pos: [-6.2, 0.6, 89.5] },
  );
  for (const z of [72, 89]) {
    wallTorch(b, flames, [-6.98, 3, z], Math.PI / 2);
    wallTorch(b, flames, [6.98, 3, z], -Math.PI / 2);
  }
  for (const [x, z] of [
    [-6, 74],
    [6, 87],
  ]) {
    column(b, x, z, 7);
  }
  for (const z of [73.5, 86.5]) deco(b, new BoxGeometry(2, 0.3, 0.8), [0, -0.16, z], COLORS.stoneDark);
}

/**
 * The Moth Ossuary (z 98.5..131): a dark chasm on short-lived lamplight, a Hexling, and a
 * false wall out. Then the Star chamber. Built last so the earlier rooms' sweets keep their ids.
 */
function mothOssuary(b: LevelBuilder, flames: Glow): void {
  const Z0 = 98.5;
  const Z1 = 131.5;
  b.floor(-8.5, 8.5, Z0, Z1 + 7, { color: FLOOR, holes: [[-8, 8, 102, 126]] });
  wall(b, 'x', Z0, -8.5, 8.5, 9, { color: STONE, holes: [{ from: -1.6, to: 1.6, top: 3.6 }] });
  wall(b, 'z', -8.5, Z0, Z1, 9, { color: STONE });
  wall(b, 'z', 8.5, Z0, Z1, 9, { color: STONE });
  slab(b, -8.5, 8.5, Z0, Z1, 9.5, 0.5, COLORS.stoneDark);
  b.box([0, -16, 114], [16, 0.5, 24], { color: '#0e0c12', noCollide: true });
  b.mist(-8, 8, 102, 126, -5);
  // Bones in niches along the walls (an ossuary, after all).
  for (const x of [-8.02, 8.02]) {
    for (let z = 103; z < 126; z += 3) {
      deco(b, new BoxGeometry(0.1, 1.2, 2), [x, 3, z], '#2a2230');
      for (let i = 0; i < 3; i++) deco(b, new IcosahedronGeometry(0.16, 0), [x + (x < 0 ? 0.12 : -0.12), 2.6 + i * 0.3, z - 0.5 + i * 0.5], '#d8d0c0');
    }
  }
  // The false wall out, across the far landing.
  b.box([-5.2, 1.6, Z1 - 0.3], [6.6, 3.2, 0.6], { color: STONE });
  b.box([5.2, 1.6, Z1 - 0.3], [6.6, 3.2, 0.6], { color: STONE });
  b.box([0, 6.1, Z1 - 0.3], [17, 5.8, 0.6], { color: STONE });
  const stones: [number, number][] = [
    [-1, 103.4],
    [0.8, 105.4],
    [2.6, 107.4],
    [3.6, 109.8],
    [2, 112.2],
    [0, 114.4],
    [-1.8, 116.6],
    [-3.4, 119],
    [-2.2, 121.6],
    [-0.4, 124.2],
  ];
  b.add(
    { type: 'checkpoint', pos: [-6.5, 0, 100.2], yaw: Math.PI / 2, zone: { min: [-8, -1, 98.6], max: [8, 4, 102] } },
    { type: 'trigger', flag: 'catacomb-hint-ossuary', script: 'catacombOssuary', min: [-8, -1, 98.6], max: [8, 4, 101.5] },
    { type: 'wickLamp', pos: [-1, 0, 100.6], radius: 5.2, duration: 6, light: true },
    { type: 'wickLamp', pos: [2.5, 3.4, 108.5], style: 'hanging', radius: 6, duration: 6 },
    { type: 'wickLamp', pos: [-2.5, 3.4, 117], style: 'hanging', radius: 6, duration: 7 },
    ...stones.map(([x, z]) => ({ type: 'glimmerBlock' as const, pos: [x, -0.15, z] as V3, size: [1.5, 0.3, 1.5] as V3 })),
    { type: 'hexling', pos: [0, 0, 114], height: 5, radius: 3.5, interval: 3.6 },
    { type: 'checkpoint', pos: [-6.5, 0, 127.6], yaw: Math.PI / 2, zone: { min: [-8, -1, 126.2], max: [8, 4, 130.6] } },
    // Far enough off that only its charged glow reaches the false wall.
    { type: 'wickLamp', pos: [5, 0, 127.2], radius: 3.2, duration: 8 },
    { type: 'illusionWall', pos: [0, 1.6, Z1 - 0.3], size: [3.8, 3.2, 0.6], color: STONE },
    { type: 'sweet', kind: 'bramble', pos: [3.6, 0.6, 109.8] },
    { type: 'sweet', kind: 'bramble', pos: [-3.4, 0.6, 119] },
    { type: 'sweet', kind: 'humbug', pos: [-6.5, 0.6, 129.8] },
  );
  for (const z of [100, 128]) {
    wallTorch(b, flames, [-7.98, 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 2.6, z], -Math.PI / 2);
  }
  // The Star chamber, lit all the time.
  wall(b, 'z', -3.5, Z1, Z1 + 7, 6, { color: STONE });
  wall(b, 'z', 3.5, Z1, Z1 + 7, 6, { color: STONE });
  wall(b, 'x', Z1 + 7, -3.5, 3.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, Z1, Z1 + 7, 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, 0.5, STAR_Z], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, STAR_Z], '#c99a3e');
  for (let i = 0; i < 6; i++) deco(b, new IcosahedronGeometry(0.12, 0), [-2 + i * 0.8, 0.12, STAR_Z + 2.6], '#bfe8ff');
  for (const x of [-2.98, 2.98]) wallTorch(b, flames, [x, 2.6, Z1 + 2], x < 0 ? Math.PI / 2 : -Math.PI / 2);
}

