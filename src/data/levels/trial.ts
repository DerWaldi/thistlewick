import { BoxGeometry, CylinderGeometry } from 'three';
import type { LevelBuilder } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { column, crate, deco, grass, hollyhock, signboard, slab, tree, wall } from '../../world/props';

/**
 * The Thwackwort Trial, under Gorse's classroom. Five rooms, south to north (+Z):
 *
 *   Antechamber      x -6..6,  z 0..10   knock a switch to open the first gate
 *   Shoving Room     x -8..8,  z 10..26  block A bridges the flooded pit (push it east one
 *                                        tile, then north), block B goes north then east onto
 *                                        the plate that holds the exit gate; a bell resets both
 *   Gauntlet         x -4..4,  z 26..48  timed switch (9 s), then hurdle (z 31), gap (35..37.5),
 *                                        step (40..43, 1.2 m) and hurdle (45.8) to the gate
 *   Overgrown Garden x -10..10, z 48..72 Gnarlings; a push block helps you up a ruined wall to a
 *                                        hidden card; the Rattlecoat guards the Star gate
 *   Star Chamber     x -3..3,  z 72..78  the Thistle Star and the way back up
 */
export const TRIAL: LevelDef = {
  id: 'trial',
  name: 'The Thwackwort Trial',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'antechamber', name: 'The Thwackwort Trial', min: [-6, -3, 0], max: [6, 8, 10] },
    { id: 'blocks', name: 'The Shoving Room', min: [-8.5, -3, 10], max: [8.5, 8, 26] },
    { id: 'run', name: 'The Gauntlet of Gates', min: [-4.5, -3, 26], max: [4.5, 8, 48] },
    { id: 'garden', name: 'The Overgrown Garden', min: [-10.5, -3, 48], max: [10.5, 20, 72] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, -3, 72], max: [3.5, 8, 78.5] },
  ],
  intro: { script: 'trialIntro', unlessFlag: 'trial-entered' },
  music: 'dungeon',
  build,
};

const STONE = '#8f7e70';
const FLOOR = '#7d6a5e';
/** Gate openings: the gate entity builds its own posts at ±(w/2 + 0.3). */
const gateHole = (x: number) => ({ from: x - 2.1, to: x + 2.1, top: 3.6 });

function build(b: LevelBuilder): void {
  b.killY = -20;
  b.floor(-10.5, 10.5, -0.5, 78.5, {
    color: FLOOR,
    holes: [
      [-8, 8, 17, 21.5], // the flooded pit
      [-8, -2, 21.5, 26], // ...either side of the pier
      [2, 8, 21.5, 26],
      [-4, 4, 35, 37.5], // gauntlet gap
    ],
  });

  // ================================================================ antechamber (z 0..10)
  wall(b, 'x', -0.5, -6.5, 6.5, 6, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -6.5, 0, 10, 6, { color: STONE });
  wall(b, 'z', 6.5, 0, 10, 6, { color: STONE });
  slab(b, -6.5, 6.5, -0.5, 10, 6.5, 0.5, COLORS.stoneDark);
  wall(b, 'x', 10, -8.5, 8.5, 7, { color: STONE, holes: [gateHole(0)] });
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'classroom', spawn: 'fromTrial' } },
    { type: 'checkpoint', pos: [-4.2, 0, 3], yaw: Math.PI / 2, zone: { min: [-6, -1, 0], max: [6, 4, 10] } },
    { type: 'knockSwitch', id: 'r1', pos: [3.5, 2, 9.45], yaw: Math.PI },
    { type: 'gate', pos: [0, 0, 10], yaw: 0, width: 3, height: 3, when: ['r1'] },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3.5], to: [0, 0.6, 8.5], count: 4 },
  );
  for (const x of [-4, 4]) column(b, x, 6, 6);
  b.lantern([0, 4.6, 5], 9, 12);

  // ================================================================ shoving room (z 10..26)
  wall(b, 'z', -8.5, 10, 26, 7, { color: STONE });
  wall(b, 'z', 8.5, 10, 26, 7, { color: STONE });
  slab(b, -8.5, 8.5, 10, 26, 7.5, 0.5, COLORS.stoneDark);
  b.pool(-8, 8, 17, 21.5, -1.2, -2);
  b.pool(-8, -2, 21.5, 26, -1.2, -2);
  b.pool(2, 8, 21.5, 26, -1.2, -2);
  // Pier edges so the pit reads clearly.
  for (const x of [-2.1, 2.1]) b.box([x, 0.1, 23.75], [0.2, 0.2, 4.5], { color: COLORS.stoneLight });
  b.box([5, 1, 12], [2, 2, 2], { color: COLORS.stoneLight }); // the pillar that blocks block B
  deco(b, new BoxGeometry(2.2, 0.2, 2.2), [5, 2.1, 12], COLORS.stoneDark);
  wall(b, 'x', 26, -8.5, 8.5, 7, { color: STONE, holes: [gateHole(0)] });
  b.add(
    { type: 'checkpoint', pos: [-7.3, 0, 13.8], yaw: Math.PI / 2, zone: { min: [-8, -1, 10.2], max: [8, 4, 13] } },
    { type: 'pushBlock', pos: [-3, 0, 12], resetOn: 'r2-bell', sunkSignal: 'r2-a-sunk' },
    { type: 'pushBlock', pos: [3, 0, 12], resetOn: 'r2-bell', sunkSignal: 'r2-b-sunk' },
    { type: 'plate', id: 'r2-plate', pos: [7, 0, 14] },
    { type: 'knockSwitch', id: 'r2-bell', pos: [-7.2, 2.1, 11.2], yaw: Math.PI / 2, style: 'bell', timed: 1 },
    { type: 'gate', pos: [0, 0, 26], yaw: 0, width: 3, height: 3, when: ['r2-plate'] },
    { type: 'trigger', flag: 'trial-hint-blocks', script: 'trialBlocks', min: [-8, -1, 10.6], max: [8, 5, 15] },
    // If it's gone wrong (both blocks in the water, or a long while without the gate), point at the bell.
    { type: 'trigger', flag: 'hint-bell-sunk', script: 'trialBell', when: ['r2-a-sunk', 'r2-b-sunk'], unlessSignals: ['r2-plate'], perVisit: true },
    { type: 'trigger', flag: 'hint-bell-slow', script: 'trialBell', min: [-8, -1, 10.2], max: [8, 5, 17], unlessSignals: ['r2-plate'], delay: 75, perVisit: true },
    { type: 'sweetLine', kind: 'fizzwort', from: [-1, 0.6, 22.2], to: [1, 0.6, 25.2], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [7, 0.8, 11] },
  );
  b.lantern([0, 5.6, 14], 10, 16);
  signboard(b, 'Ring to reset the blocks', [-7.95, 3.9, 11.2], Math.PI / 2);
  b.lantern([-7.9, 3.5, 20], 0, 0, false);
  b.lantern([7.9, 3.5, 20], 0, 0, false);

  // ================================================================ gauntlet (z 26..48)
  wall(b, 'z', -4.5, 26, 48, 7, { color: STONE });
  wall(b, 'z', 4.5, 26, 48, 7, { color: STONE });
  slab(b, -4.5, 4.5, 26, 48, 7.5, 0.5, COLORS.stoneDark);
  b.pool(-4, 4, 35, 37.5, -1.2, -2.5);
  b.box([0, 0.45, 31], [8, 0.9, 0.5], { color: COLORS.stoneLight }); // hurdle
  b.box([0, 0.6, 41.5], [8, 1.2, 3], { color: COLORS.stone }); // step up and over
  b.box([0, 0.45, 45.8], [8, 0.9, 0.5], { color: COLORS.stoneLight }); // hurdle
  wall(b, 'x', 48, -10.5, 10.5, 7.5, { color: STONE, holes: [gateHole(0)] });
  b.add(
    { type: 'checkpoint', pos: [-2.9, 0, 27.6], yaw: Math.PI / 2, zone: { min: [-4, -1, 26.2], max: [4, 4, 29.5] } },
    { type: 'knockSwitch', id: 'r3-timed', pos: [4.0, 2, 28.6], yaw: -Math.PI / 2, timed: 9 },
    { type: 'gate', pos: [0, 0, 48], yaw: 0, width: 3, height: 3, when: ['r3-timed'] },
    { type: 'trigger', flag: 'trial-hint-run', script: 'trialRun', min: [-4, -1, 26.5], max: [4, 5, 29.5] },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 1.6, 34], to: [0, 1.6, 39], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [-3, 1.8, 41.5] },
  );
  b.lantern([0, 5.6, 37], 10, 16);

  // ================================================================ overgrown garden (z 48..72, open sky)
  wall(b, 'z', -10.5, 48, 72, 6, { color: STONE });
  wall(b, 'z', 10.5, 48, 72, 6, { color: STONE });
  wall(b, 'x', 72, -10.5, 10.5, 6, { color: STONE, holes: [gateHole(0)] });
  deco(b, new BoxGeometry(20, 0.05, 23.5), [0, 0.025, 60], '#6e8a44');
  grass(b, -9.8, 9.8, 48.6, 71.4, 0.05, 1.6);
  // Hedges (jumpable), beds and an old tree.
  for (const [x, z, w, d] of [
    [-6.5, 53, 4, 1],
    [6.5, 53.5, 4, 1],
    [6, 61, 1, 4],
    [-1.5, 57.5, 3, 1],
  ]) {
    b.box([x, 0.6, z], [w, 1.2, d], { color: '#5f7f3a', pattern: 'plaster' });
  }
  let seed = 3;
  for (let z = 50; z < 71; z += 1.7) {
    hollyhock(b, 9.7, z, seed++);
  }
  tree(b, 7.5, 67);
  // A ruined wall stump on the west side: too tall to jump, but a pushed block helps.
  b.box([-9, 2.2, 57], [2, 4.4, 4], { color: COLORS.stoneLight });
  deco(b, new BoxGeometry(2.2, 0.3, 4.2), [-9, 4.5, 57], COLORS.moss);
  b.add(
    { type: 'checkpoint', pos: [-7.5, 0, 50], yaw: Math.PI / 2, zone: { min: [-10, -1, 48.2], max: [10, 4, 51.5] } },
    { type: 'trigger', flag: 'trial-hint-garden', script: 'trialGarden', min: [-10, -1, 48.5], max: [10, 5, 51.5] },
    { type: 'gnarling', pos: [-5, 0, 55.5], wander: 2.5 },
    { type: 'gnarling', pos: [4.5, 0, 56], wander: 2.5 },
    { type: 'gnarling', pos: [-3.5, 0, 60.5], wander: 2.5 },
    { type: 'gnarling', pos: [3, 0, 59.5], wander: 2.5 },
    { type: 'pushBlock', pos: [-4, 0, 57] },
    { type: 'card', card: 'gnarling', pos: [-9, 5.2, 57] },
    { type: 'secret', id: 'trial-ruin', area: 'garden', min: [-10, 4, 55], max: [-8, 7.5, 59] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 0.6, 61], to: [8, 0.6, 61], count: 8 },
    { type: 'sweet', kind: 'humbug', pos: [-9, 5.2, 55.6] },
    { type: 'rattlecoat', id: 'rattle', pos: [0, 0, 68], yaw: Math.PI, arena: { min: [-10.5, -1, 62.5], max: [10.5, 6, 72] } },
    { type: 'gate', pos: [0, 0, 72], yaw: 0, width: 3, height: 3, when: ['rattle'] },
  );
  // Broken pillars around the Rattlecoat's yard.
  for (const [x, z, h] of [
    [-6, 64, 2.6],
    [6, 65, 1.6],
    [-5, 70, 3.2],
  ]) {
    b.cylinder([x, h / 2, z], 0.45, h, COLORS.stoneLight, undefined, 8);
  }
  crate(b, [8.6, 0, 50], 1);

  // ================================================================ star chamber (z 72..78)
  wall(b, 'z', -3.5, 72, 78.5, 6, { color: STONE });
  wall(b, 'z', 3.5, 72, 78.5, 6, { color: STONE });
  wall(b, 'x', 78.5, -3.5, 3.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, 72, 78.5, 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, 0.5, 75.2], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, 75.2], '#c99a3e');
  b.add(
    { type: 'star', id: 'trial-star', pos: [0, 1.9, 75.2], script: 'trialComplete' },
    { type: 'door', pos: [0, 0, 77.95], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'classroom', spawn: 'fromTrial' }, label: 'Up to class' },
  );

  b.finish();
}
