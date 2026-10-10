import { BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { banner, barrel, bush, cobweb, column, crate, deco, Glow, grass, hollyhock, ivy, mushrooms, rubble, rug, signboard, slab, tree, urn, wall, wallTorch } from '../../world/props';

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
 *   Clockwork Moat   x -8..8,  z 72..96  a pit (z 75..91) crossed on three moving platforms:
 *                                        M1 sweeps side to side, M2 rides back and forth, M3 bobs
 *                                        up and down; Gnarlings wait on the far landing, and a
 *                                        knock switch there opens the Star gate
 *   Passage          x -3..3,  z 96..102.5 (the old Star Chamber)
 *   Sootling's Leap  x -8..8,  z 102.5..138 a chasm (z 106..132): seven stone pillars zig-zag
 *                                        across with a moving slab in the middle, a Hexling
 *                                        circling overhead, a Sootling on the far ledge (top
 *                                        2.2) lobbing bombs the whole way; banish him to open
 *                                        the Star gate (kick a bomb back, or thwack him twice)
 *   Star Chamber     x -3..3,  z 138..144.5 the Thistle Star and the way back up
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
    { id: 'moat', name: 'The Clockwork Moat', min: [-8.5, -25, 72], max: [8.5, 9, 96] },
    { id: 'moat', name: 'The Clockwork Moat', min: [-3.5, -3, 96], max: [3.5, 8, 102.5] },
    { id: 'leap', name: "The Sootling's Leap", min: [-8.5, -25, 102.5], max: [8.5, 10, 138] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, -3, 138], max: [3.5, 8, 144.5] },
  ],
  intro: { script: 'trialIntro', unlessFlag: 'trial-entered' },
  music: 'dungeon',
  build,
};

const STONE = '#8f7e70';
/** The Star Chamber, at the very end now (after the Sootling's Leap). */
const STAR_Z = 141.2;
const FLOOR = '#7d6a5e';
/** Gate openings: the gate entity builds its own posts at ±(w/2 + 0.3). */
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

function build(b: LevelBuilder): void {
  b.killY = -20;
  const flames = new Glow();
  b.floor(-10.5, 10.5, -0.5, 72, {
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
  wallTorch(b, flames, [-5.98, 2.4, 7.5], Math.PI / 2);
  wallTorch(b, flames, [5.98, 2.4, 7.5], -Math.PI / 2);
  barrel(b, [5.4, 0, 0.6]);
  crate(b, [4.4, 0, 0.6], 0.8);
  urn(b, [-5.4, 0, 9]);
  rubble(b, 5.2, 9, 6, 1);
  webs(b, -6, 6, 0, 9.5, 5.9, 1.1);
  b.lantern([0, 4.6, 5], 9, 12);

  // ================================================================ shoving room (z 10..26)
  wall(b, 'z', -8.5, 10, 26, 7, { color: STONE });
  wall(b, 'z', 8.5, 10, 26, 7, { color: STONE });
  slab(b, -8.5, 8.5, 10, 26, 7.5, 0.5, COLORS.stoneDark);
  // One pool for the whole pit; the pier's floor reaches down through it.
  b.pool(-8, 8, 17, 26, -1.2, -2);
  // Pier edges so the pit reads clearly.
  for (const x of [-2.1, 2.1]) b.box([x, 0.1, 23.75], [0.2, 0.2, 4.5], { color: COLORS.stoneLight });
  // The pillar that stops block B going straight east. B starts a tile in from the south
  // wall so there's room to stand behind it and shove it north.
  b.box([5, 1, 14], [2, 2, 2], { color: COLORS.stoneLight });
  deco(b, new BoxGeometry(2.2, 0.2, 2.2), [5, 2.1, 14], COLORS.stoneDark);
  wall(b, 'x', 26, -8.5, 8.5, 7, { color: STONE, holes: [gateHole(0)] });
  b.add(
    { type: 'checkpoint', pos: [-7.3, 0, 13.8], yaw: Math.PI / 2, zone: { min: [-8, -1, 10.2], max: [8, 4, 13] } },
    { type: 'pushBlock', pos: [-3, 0, 12], resetOn: 'r2-bell', sunkSignal: 'r2-a-sunk' },
    { type: 'pushBlock', pos: [3, 0, 14], resetOn: 'r2-bell', sunkSignal: 'r2-b-sunk' },
    { type: 'plate', id: 'r2-plate', pos: [7, 0, 16] },
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
  // Clear of the south wall (the board is 2.6 m wide), just above and beside the bell.
  signboard(b, 'Ring to reset the blocks', [-7.95, 3.5, 12.2], Math.PI / 2);
  for (const x of [-7.98, 7.98]) wallTorch(b, flames, [x, 3.2, 15.5], x < 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const x of [-5.5, 5.5]) wallTorch(b, flames, [x, 3.2, 25.48], Math.PI);
  webs(b, -8, 8, 10.5, 25.5, 6.9, 1.4);
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
  wall(b, 'x', 48, -10.5, 10.5, 7.5, { color: STONE, holes: [gateHole(0)], cap: 8 });
  b.add(
    { type: 'checkpoint', pos: [-2.9, 0, 27.6], yaw: Math.PI / 2, zone: { min: [-4, -1, 26.2], max: [4, 4, 29.5] } },
    { type: 'knockSwitch', id: 'r3-timed', pos: [4.0, 2, 28.6], yaw: -Math.PI / 2, timed: 9 },
    { type: 'gate', pos: [0, 0, 48], yaw: 0, width: 3, height: 3, when: ['r3-timed'] },
    { type: 'trigger', flag: 'trial-hint-run', script: 'trialRun', min: [-4, -1, 26.5], max: [4, 5, 29.5] },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 1.6, 34], to: [0, 1.6, 39], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [-3, 1.8, 41.5] },
  );
  for (const z of [33, 44]) {
    wallTorch(b, flames, [-3.98, 2.8, z], Math.PI / 2);
    wallTorch(b, flames, [3.98, 2.8, z], -Math.PI / 2);
  }
  webs(b, -4, 4, 26.5, 47.5, 6.9, 1.2);
  rubble(b, -3.4, 47, 5, 4, 0, 0.4);
  b.lantern([0, 5.6, 37], 10, 16);

  // ================================================================ overgrown garden (z 48..72, open sky)
  wall(b, 'z', -10.5, 48, 72, 6, { color: STONE, cap: 8 });
  wall(b, 'z', 10.5, 48, 72, 6, { color: STONE, cap: 8 });
  wall(b, 'x', 72, -10.5, 10.5, 6, { color: STONE, holes: [gateHole(0)], cap: 8 });
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
  // Ivy and moss over the old walls, toadstools in the shade, fallen stones by the pillars.
  ivy(b, 'z', -10, 49, 71, 0.2, 5.5, 1, 11);
  ivy(b, 'z', 10, 49, 71, 0.2, 5, -1, 12);
  ivy(b, 'x', 48.5, -10, -2.5, 0.2, 5, 1, 13);
  ivy(b, 'x', 48.5, 2.5, 10, 0.2, 4.5, 1, 14);
  ivy(b, 'x', 71.5, -10, -2.5, 0.2, 4, -1, 15);
  ivy(b, 'x', 71.5, 2.5, 10, 0.2, 4.5, -1, 16);
  for (const [x, z, h] of [
    [-6, 64, 2.6],
    [6, 65, 1.6],
    [-5, 70, 3.2],
  ]) {
    rubble(b, x + 0.6, z + 0.4, 6, x * z, 0.05, 0.7);
    deco(b, new CylinderGeometry(0.5, 0.5, 0.08, 8), [x, h + 0.04, z], COLORS.moss);
  }
  mushrooms(b, 6.6, 66.2, 5, 3, 0.05);
  mushrooms(b, -8.6, 52, 4, 5, 0.05);
  mushrooms(b, -0.5, 58.6, 3, 8, 0.05);
  mushrooms(b, 9.2, 57, 4, 13, 0.05);
  bush(b, -9.3, 69.8, 1.1, 2, 0.05);
  bush(b, 9.2, 70.2, 1, 6, 0.05);
  bush(b, -9.4, 50.4, 0.9, 9, 0.05);

  // ================================================================ the passage (z 96..102.5), once the Star Chamber
  wall(b, 'z', -3.5, 96, 102.5, 6, { color: STONE });
  wall(b, 'z', 3.5, 96, 102.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, 96, 102.5, 6.5, 0.5, COLORS.stoneDark);
  for (const x of [-2.98, 2.98]) wallTorch(b, flames, [x, 2.6, 97.6], x < 0 ? Math.PI / 2 : -Math.PI / 2);
  banner(b, [-2.96, 3.9, 100.4], Math.PI / 2, '#8a2a3a', '#e8c25a', 1.2, 2.4);
  banner(b, [2.96, 3.9, 100.4], -Math.PI / 2, '#2f5a6a', '#e8c25a', 1.2, 2.4);
  // The Star and the way up moved on to the new chamber (replaced in place: ids stay put).
  b.add(
    { type: 'star', id: 'trial-star', pos: [0, 1.9, STAR_Z], script: 'trialComplete' },
    { type: 'door', pos: [0, 0, STAR_Z + 2.75], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'classroom', spawn: 'fromTrial' }, label: 'Up to class' },
  );

  clockworkMoat(b, flames);
  sootlingsLeap(b, flames);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Clockwork Moat (z 72..96): a pit between the garden and the Star, crossed on three
 * platforms that move by themselves. Gnarlings wait on the far landing; the knock switch
 * there opens the Star gate. Built last so the earlier rooms' sweets keep their ids.
 */
function clockworkMoat(b: LevelBuilder, flames: Glow): void {
  b.floor(-8.5, 8.5, 72, 102.5, { color: FLOOR, holes: [[-8, 8, 75, 91]] });
  wall(b, 'z', -8.5, 72, 96, 8, { color: STONE });
  wall(b, 'z', 8.5, 72, 96, 8, { color: STONE });
  wall(b, 'x', 96, -8.5, 8.5, 8, { color: STONE, holes: [gateHole(0)] });
  slab(b, -8.5, 8.5, 72, 96, 8.5, 0.5, COLORS.stoneDark);
  // A long way down to a dark floor you never reach (falling resets you first).
  b.box([0, -16, 83], [16, 0.5, 16], { color: '#1e1816', noCollide: true });
  for (const x of [-8.1, 8.1]) b.box([x, -8, 83], [0.4, 16, 16], { color: STONE, noCollide: true });
  for (const z of [74.9, 91.1]) b.box([0, -10, z], [16, 12, 0.2], { color: STONE, noCollide: true });
  const TAU = Math.PI * 2;
  // M1 sweeps side to side, M2 rides back and forth, M3 bobs down below the rim and up.
  b.mover([2.4, 0.4, 2.4], COLORS.stoneLight, (t) => new Vector3(5 * Math.sin((t * TAU) / 6), -0.2, 77));
  b.mover([2.4, 0.4, 2.4], COLORS.stoneLight, (t) => new Vector3(0, -0.2, 83 + 2.5 * Math.sin((t * TAU) / 5)));
  b.mover([2.4, 0.4, 2.4], COLORS.stoneLight, (t) => new Vector3(2.5, -1.1 + 0.9 * Math.sin((t * TAU) / 4), 88.4));
  b.add(
    { type: 'checkpoint', pos: [-6.5, 0, 73.4], yaw: Math.PI / 2, zone: { min: [-8, -1, 72], max: [8, 4, 75] } },
    { type: 'trigger', flag: 'trial-hint-moat', script: 'trialMoat', min: [-8, -1, 72], max: [8, 4, 74.5] },
    { type: 'checkpoint', pos: [6.5, 0, 93.5], yaw: -Math.PI / 2, zone: { min: [-8, -1, 91], max: [8, 4, 96] } },
    { type: 'gnarling', pos: [-3, 0, 93.5], wander: 2.5 },
    { type: 'gnarling', pos: [4, 0, 93.5], wander: 2.5 },
    { type: 'knockSwitch', id: 'moat-switch', pos: [-7.95, 1.6, 93.5], yaw: Math.PI / 2, style: 'target', latch: true },
    { type: 'gate', pos: [0, 0, 96], yaw: 0, width: 3, height: 3, when: ['moat-switch'] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, 0.6, 77], to: [4, 0.6, 77], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [0, 1, 85.5] },
  );
  // Gears and chains in the walls, to say what drives the platforms.
  for (const [x, z] of [
    [-8.4, 80],
    [8.4, 86],
  ]) {
    deco(b, new CylinderGeometry(2, 2, 0.25, 16), [x, 3.6, z], '#8a6a2a', [0, 0, Math.PI / 2]);
    deco(b, new CylinderGeometry(0.5, 0.5, 0.4, 8), [x, 3.6, z], '#5a4a2a', [0, 0, Math.PI / 2]);
  }
  for (const z of [73.5, 94]) {
    wallTorch(b, flames, [-7.98, 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 2.6, z], -Math.PI / 2);
  }
  webs(b, -8, 8, 72.5, 95.5, 7.9, 1);
}

/**
 * The Sootling's Leap (z 102.5..138): pillars over a chasm, a moving slab in the middle, a
 * Hexling overhead and a Sootling lobbing bombs from the far ledge. Then the Star Chamber.
 * Built last so the earlier rooms' sweets keep their ids.
 */
function sootlingsLeap(b: LevelBuilder, flames: Glow): void {
  const Z0 = 102.5;
  const Z1 = 138;
  b.floor(-8.5, 8.5, Z0, Z1 + 6.5, { color: FLOOR, holes: [[-8, 8, 106, 132]] });
  wall(b, 'x', Z0, -8.5, 8.5, 9, { color: STONE, holes: [gateHole(0)] });
  wall(b, 'z', -8.5, Z0, Z1, 9, { color: STONE });
  wall(b, 'z', 8.5, Z0, Z1, 9, { color: STONE });
  wall(b, 'x', Z1, -8.5, 8.5, 9, { color: STONE, holes: [gateHole(0)] });
  slab(b, -8.5, 8.5, Z0, Z1, 9.5, 0.5, COLORS.stoneDark);
  b.box([0, -16, 119], [16, 0.5, 26], { color: '#1e1816', noCollide: true });
  for (const x of [-8.1, 8.1]) b.box([x, -8, 119], [0.4, 16, 26], { color: STONE, noCollide: true });
  for (const z of [105.9, 132.1]) b.box([0, -10, z], [16, 12, 0.2], { color: STONE, noCollide: true });
  // Pillars, zig-zagging: running jumps, not steps.
  const pillars: [number, number][] = [
    [0, 108.2],
    [-2.7, 110.7],
    [-0.4, 113.2],
    [2.2, 115.4],
    [2.2, 125],
    [-0.5, 127.5],
    [-2.8, 129.8],
  ];
  for (const [x, z] of pillars) {
    b.box([x, -7, z], [1.6, 14, 1.6], { color: COLORS.stoneLight, info: { noGrab: true } });
    deco(b, new BoxGeometry(1.75, 0.12, 1.75), [x, -0.05, z], COLORS.stoneDark);
  }
  // The gap in the middle: a slab that rides back and forth between pillars 4 and 5.
  const TAU = Math.PI * 2;
  b.mover([2.2, 0.4, 2.2], COLORS.stoneLight, (t) => new Vector3(2.2, -0.2, 120.2 + 2.9 * Math.sin((t * TAU) / 5)));
  // The far ledge, where the Sootling sits.
  b.box([5.5, 1.1, 135.5], [5, 2.2, 5], { color: COLORS.stoneLight });
  for (const z of [104.2, 134]) {
    wallTorch(b, flames, [-7.98, 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [7.98, 2.6, z], -Math.PI / 2);
  }
  webs(b, -8, 8, 103, 137.5, 8.9, 1.1);
  b.add(
    { type: 'checkpoint', pos: [-6.5, 0, 104.2], yaw: Math.PI / 2, zone: { min: [-8, -1, 102.6], max: [8, 4, 106] } },
    { type: 'trigger', flag: 'trial-hint-leap', script: 'trialLeap', min: [-8, -1, 102.6], max: [8, 4, 105.5] },
    { type: 'hexling', pos: [0, 0, 118], height: 4.5, radius: 4, interval: 3.2 },
    { type: 'sootling', id: 't-soot', pos: [5.5, 2.2, 135.5], yaw: Math.PI, wander: 0.8, range: 22, interval: 3.4, fuse: 1.5 },
    { type: 'checkpoint', pos: [-6.5, 0, 134], yaw: Math.PI / 2, zone: { min: [-8, -1, 132.2], max: [2.8, 4, 137.8] } },
    { type: 'gnarling', pos: [-4, 0, 135], wander: 2 },
    { type: 'gate', pos: [0, 0, Z1], yaw: 0, width: 3, height: 3, when: ['t-soot'] },
    { type: 'sweet', kind: 'bramble', pos: [-2.7, 0.7, 110.7] },
    { type: 'sweet', kind: 'bramble', pos: [-0.5, 0.7, 127.5] },
    { type: 'sweet', kind: 'humbug', pos: [7.2, 2.8, 137.2] },
  );
  // The Star Chamber.
  wall(b, 'z', -3.5, Z1, Z1 + 6.5, 6, { color: STONE });
  wall(b, 'z', 3.5, Z1, Z1 + 6.5, 6, { color: STONE });
  wall(b, 'x', Z1 + 6.5, -3.5, 3.5, 6, { color: STONE });
  slab(b, -3.5, 3.5, Z1, Z1 + 6.5, 6.5, 0.5, COLORS.stoneDark);
  b.cylinder([0, 0.5, STAR_Z], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, STAR_Z], '#c99a3e');
  rug(b, [0, 0, STAR_Z], 3.6, 4.6, '#5d4470', '#c99a3e');
  for (const x of [-2.98, 2.98]) wallTorch(b, flames, [x, 2.6, Z1 + 1.6], x < 0 ? Math.PI / 2 : -Math.PI / 2);
  webs(b, -3, 3, Z1 + 0.5, Z1 + 6, 5.9, 0.8);
}

