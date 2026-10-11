import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import type { LevelBuilder } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { bench, deco, pottedPlant, rug, signboard, wall } from '../../world/props';

/**
 * Professor Underbough's rooftop, Airs & Graces, on top of the Clock Tower (x -10..10,
 * z 0..22, open sky, parapets all round). Enter from the stair hut (south door). Three
 * plates, each with a sign:
 *   - U1 on the bell dais (west, x 6..10, z 3..9, top 3.6, ungrabbable): stand on the crate
 *     beside it and cast at its feather-stone: it floats you up
 *   - U2 across the light-well (z 12..19, open to the drop): ride the lift platform over
 *   - U3 on the chimney stack (east, x -10..-7.5, z 2.5..5.5, top 5): its basket waits at
 *     the top; call it down from across the roof, then ride it up
 * The iron door (west wall, z 10) leads into the Great Clockworks.
 */
export const UNDERBOUGH: LevelDef = {
  id: 'underbough',
  name: 'Airs & Graces',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromClockworks: { pos: [8.4, 0, 10], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'roof', name: 'Airs & Graces', min: [-10, -2, 0], max: [10, 12, 22] }],
  intro: { script: 'underboughLesson', unlessFlag: 'underbough-lesson-started' },
  build,
};

const LEAD = '#8a8a96';

function build(b: LevelBuilder): void {
  b.killY = -12;
  b.floor(-10.5, 10.5, -0.5, 22.5, { color: '#9a8a7a', holes: [[-10, 10, 12, 19]] });
  // Parapets with caps (it's a long way down), and the stair hut over the door.
  wall(b, 'x', 22.5, -10.5, 10.5, 1.2, { color: COLORS.stoneLight, cap: 6 });
  wall(b, 'z', -10.5, 0, 22, 1.2, { color: COLORS.stoneLight, cap: 6 });
  wall(b, 'z', 10.5, 0, 22, 1.2, { color: COLORS.stoneLight, cap: 6, holes: [{ from: 8.8, to: 11.2, top: 1.2 }] });
  wall(b, 'x', -0.5, -10.5, 10.5, 4.2, { color: COLORS.stone, holes: [{ from: -1.25, to: 1.25, top: 3.5 }], cap: 4 });
  deco(b, new ConeGeometry(2.6, 1.6, 4), [0, 5, -1], COLORS.roof, [0, Math.PI / 4, 0]);
  // The iron door's porch (west), so it has a wall to sit in.
  b.box([10.5, 1.9, 10], [1, 3.8, 3.4], { color: COLORS.stone });
  // The light-well: a drop to the floors below.
  for (const z of [11.9, 19.1]) deco(b, new BoxGeometry(20, 0.25, 0.2), [0, 0.1, z], LEAD);

  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'clocktower', spawn: 'fromUnderbough' }, lockedDuring: 'thistledown', talk: 'classNotOverUnderbough' },
    {
      type: 'door',
      pos: [9.95, 0, 10],
      yaw: -Math.PI / 2,
      width: 2.2,
      height: 3.2,
      to: { level: 'clockworks', spawn: 'default' },
      lockedUnless: 'practice-thistledown',
      closedAfter: 'thistledown',
      talk: 'lockedClockworksDoor',
      label: 'The Clockworks',
      style: 'iron',
    },
    {
      type: 'npc',
      speaker: 'underbough',
      pos: [0, 0, 7],
      yaw: Math.PI,
      look: { robe: '#6a7a9a', scarf: '#e8f0ff', trim: '#c8d8f0', hat: '#4a5a7a', hatStyle: 'pointy', hair: '#b86a3a', hairStyle: 'wild', scale: 1.1 },
      talk: 'underbough',
    },
  );

  // ---------------------------------------------------------------- U1: the bell dais and its crate
  b.box([8, 1.8, 6], [4, 3.6, 6], { color: COLORS.stone, info: { noGrab: true } });
  deco(b, new BoxGeometry(4.1, 0.1, 6.1), [8, 3.62, 6], COLORS.stoneLight);
  b.add(
    { type: 'skyLift', style: 'crate', from: [5.3, 1.2, 6], to: [5.3, 3.6, 6], size: [1.2, 1.2], post: [-0.45, -0.45], speed: 1.6 },
    { type: 'plate', id: 'up1', pos: [8.3, 3.6, 6], latch: true },
  );
  // A little bell on the dais.
  deco(b, new CylinderGeometry(0.1, 0.1, 1.6, 6), [8.6, 4.4, 8], COLORS.woodDark);
  deco(b, new ConeGeometry(0.5, 0.7, 10, 1, true), [8.6, 4.7, 8.6], '#c99a3e');
  // On the dais face (z 3..9), beside the crate's path (z 5.4..6.6), not hanging off its end.
  signboard(b, 'Stand on it, cast at\nits feather-stone!', [5.98, 2, 4.3], -Math.PI / 2);

  // ---------------------------------------------------------------- U2: over the light-well
  b.add(
    { type: 'skyLift', style: 'platform', from: [-4, 0, 13.3], to: [-4, 0, 17.7], size: [2.4, 2.4], speed: 2.2 },
    { type: 'plate', id: 'up2', pos: [-4, 0, 20.6], latch: true },
    { type: 'sweetLine', kind: 'fizzwort', from: [2, 0.6, 20.6], to: [8, 0.6, 20.6], count: 4 },
  );
  signboard(b, 'Too far to jump?\nFloat across!', [-4, 0.7, 21.97], Math.PI);

  // ---------------------------------------------------------------- U3: the chimney stack and its basket
  b.box([-8.75, 2.5, 4], [2.5, 5, 3], { color: '#9a5a44', info: { noGrab: true } });
  deco(b, new BoxGeometry(2.7, 0.2, 3.2), [-8.75, 5.05, 4], COLORS.stoneDark);
  for (const x of [-9.4, -8.1]) deco(b, new CylinderGeometry(0.25, 0.25, 0.8, 8), [x, 5.4, 3.2], '#7a4a3a');
  b.add(
    { type: 'skyLift', style: 'basket', from: [-6.6, 0.3, 4], to: [-6.6, 5, 4], size: [1.8, 1.8], startAt: 'to', speed: 2 },
    { type: 'plate', id: 'up3', pos: [-8.6, 5, 4.6], latch: true },
    { type: 'trigger', flag: 'practice-thistledown-trigger', script: 'airPracticeDone', when: ['up1', 'up2', 'up3'] },
    { type: 'trigger', flag: 'hint-underbough-float', script: 'underboughFloatHint', min: [3.5, -1, 3], max: [6.5, 3, 9], unlessSignals: ['up1'], delay: 15, perVisit: true },
    { type: 'trigger', flag: 'hint-underbough-call', script: 'underboughCallHint', when: ['up1', 'up2'], unlessSignals: ['up3'], delay: 25, perVisit: true },
  );
  signboard(b, 'Lifts come when called', [-4.5, 2.2, 0.03], 0);

  // ---------------------------------------------------------------- the rooftop: telescope, weathervane, chimes
  rug(b, [0, 0, 5], 4, 3, '#6a7a9a', '#e8f0ff');
  bench(b, [2.5, 0, 3], 0, 2.4);
  pottedPlant(b, [9.4, 0, 1], 1.1, 6);
  pottedPlant(b, [-9.4, 0, 10.8], 1.1, 9);
  // Telescope on a tripod.
  for (let i = 0; i < 3; i++) deco(b, new CylinderGeometry(0.04, 0.04, 1.6, 4), [3.5 + Math.cos(i * 2.1) * 0.35, 0.75, 10 + Math.sin(i * 2.1) * 0.35], COLORS.woodDark, [Math.sin(i * 2.1) * 0.25, 0, -Math.cos(i * 2.1) * 0.25]);
  deco(b, new CylinderGeometry(0.12, 0.18, 1.6, 8), [3.5, 1.8, 10.2], '#c99a3e', [0.9, 0, 0]);
  // The weathervane on the hut.
  deco(b, new CylinderGeometry(0.04, 0.04, 2, 4), [0, 6.6, -1], '#3a3340');
  deco(b, new BoxGeometry(1.4, 0.3, 0.04), [0.3, 7.3, -1], '#3a3340');
  deco(b, new ConeGeometry(0.15, 0.4, 3), [-0.5, 7.3, -1], '#3a3340', [0, 0, Math.PI / 2]);
  // Wind chimes and pennants along the parapet.
  for (let i = 0; i < 6; i++) {
    deco(b, new CylinderGeometry(0.03, 0.03, 0.5 + (i % 3) * 0.15, 4), [-8 + i * 0.25, 2.2 - (i % 3) * 0.08, 21.7], '#c8d8f0');
  }
  for (let x = -9; x <= 9; x += 3) deco(b, new ConeGeometry(0.3, 0.9, 3), [x, 1.7, 22.3], x % 2 ? '#6a7a9a' : '#e8f0ff', [0, 0, Math.PI / 2]);
  deco(b, new SphereGeometry(0.4, 8, 6), [-7, 1.6, 21.4], '#c99a3e');
  // The view from the top: hills all round, far below, and the lake glinting to the south.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = 140 + (i % 3) * 30;
    deco(b, new IcosahedronGeometry(34 + (i % 4) * 8, 1).scale(1.5, 0.4 + (i % 3) * 0.1, 1), [Math.cos(a) * r, -45, 11 + Math.sin(a) * r], i % 2 ? '#6a8a4a' : '#5a7a44', [0, i, 0]);
  }
  deco(b, new BoxGeometry(120, 0.2, 60), [0, -48, -90], '#4f9fc4');
  b.finish();
}
