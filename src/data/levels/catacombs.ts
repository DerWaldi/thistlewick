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
 *                                         of the west wall with the card behind it
 *   Lamplough's      x -9..9,  z 51..70   a divider (x 0, z 54..67) splits the room; four wall
 *   Lantern                               lamps (two per half) open the north gate only while
 *                                         ALL are lit (9 s each). Snapcaskets in both halves
 *   Star chamber     x -3..3,  z 71..78
 */
export const CATACOMBS: LevelDef = {
  id: 'catacombs',
  name: 'The Lamplit Catacombs',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'antechamber', name: 'The Lamplit Catacombs', min: [-5, -20, 0], max: [5, 8, 9.5] },
    { id: 'bridge', name: 'The Glimmer Bridge', min: [-5, -20, 9.5], max: [5, 9, 30.5] },
    { id: 'walls', name: 'The Hall of False Walls', min: [-11, -3, 30.5], max: [8, 9, 50.5] },
    { id: 'lantern', name: "Lamplough's Lantern", min: [-9, -3, 50.5], max: [9, 9, 78.5] },
  ],
  intro: { script: 'catacombIntro', unlessFlag: 'catacombs-entered' },
  ambience: 'dark',
  music: 'dungeon',
  build,
};

const STONE = '#6a6070';
const FLOOR = '#4a4450';

function build(b: LevelBuilder): void {
  b.killY = -15;
  const flames = new Glow();
  b.floor(-11, 9.5, -0.5, 78.5, { color: FLOOR, holes: [[-5, 5, 11, 29.2]] });

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
  // The secret alcove behind a false bit of the west wall.
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

  // Star chamber.
  wall(b, 'z', -3.5, 70.5, 78.5, 6, { color: STONE });
  wall(b, 'z', 3.5, 70.5, 78.5, 6, { color: STONE });
  wall(b, 'x', 78.5, -3.5, 3.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, 70.5, 78.5, 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, 0.5, 75], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, 75], '#c99a3e');
  for (let i = 0; i < 6; i++) deco(b, new IcosahedronGeometry(0.12, 0), [-2 + i * 0.8, 0.12, 77.6], '#bfe8ff');
  b.add(
    { type: 'star', id: 'catacomb-star', pos: [0, 1.9, 75], script: 'catacombComplete' },
    { type: 'door', pos: [0, 0, 77.95], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'lamplough', spawn: 'fromCatacombs' }, label: 'Up to class' },
    { type: 'wickLamp', pos: [-2.2, 0, 72.5], radius: 2, duration: 0, lit: true },
    { type: 'wickLamp', pos: [2.2, 0, 72.5], radius: 2, duration: 0, lit: true },
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

  flames.finish(b, '#ffb060');
  b.finish();
}
