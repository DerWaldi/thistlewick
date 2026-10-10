import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { barrel, bench, cauldron, cobweb, crate, deco, Glow, portrait, pottedPlant, rug, shelf, signboard, slab, table, wall, wallTorch } from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * Professor Ashcombe's kitchen classroom, Hearth & Flame (x -10..10, z 0..22). Enter from
 * the Kitchen Yard (south door). Ashcombe teaches Cindersnap; three tasks, each with a sign:
 *   - the pantry (west, x -10..-6.5, z 11..17): a cobweb across its doorway, plate P1 inside
 *   - the high shelf (east, x 7..10, z 9..14, top 2.4, too high to jump): a crate hangs on a
 *     rope beside it; burn the rope and the crate drops to make a step up to plate P2
 *   - three braziers by the north wall, notched I-III and set out of order (II, III, I):
 *     light them in order or they all go out
 * The iron door (east, z 17.5) leads to the Overgrown Glasshouse.
 */
export const ASHCOMBE: LevelDef = {
  id: 'ashcombe',
  name: 'Hearth & Flame',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromGlasshouse: { pos: [8.6, 0, 17.5], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'kitchen', name: 'Hearth & Flame', min: [-10, -1, 0], max: [10, 8, 22] }],
  intro: { script: 'ashcombeLesson', unlessFlag: 'ashcombe-lesson-started' },
  build,
};

const BRICK = '#9a5a44';
const PLASTER = '#e0cdb0';

function build(b: LevelBuilder): void {
  const flames = new Glow();
  const H = 6.5;
  b.floor(-10.5, 10.5, -0.5, 22.5, { color: '#a88a70' });
  wall(b, 'x', -0.5, -10.5, 10.5, H, { color: PLASTER, pattern: 'plaster', holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 22.5, -10.5, 10.5, H, { color: PLASTER, pattern: 'plaster' });
  wall(b, 'z', -10.5, 0, 22, H, { color: PLASTER, pattern: 'plaster' });
  wall(b, 'z', 10.5, 0, 22, H, { color: PLASTER, pattern: 'plaster', holes: [{ from: 16.3, to: 18.7, top: 3.5 }] });
  slab(b, -10.5, 10.5, -0.5, 22.5, H + 0.5, 0.5, '#4a3226', 'planks');
  for (let z = 2; z < 22; z += 4) deco(b, new BoxGeometry(21, 0.4, 0.4), [0, H - 0.2, z], COLORS.woodDark);
  // A brick skirting all round: kitchens get scuffed.
  for (const [c, s] of [
    [[0, 0.5, 0.02], [20, 1, 0.06]],
    [[0, 0.5, 21.98], [20, 1, 0.06]],
    [[-9.98, 0.5, 11], [0.06, 1, 22]],
    [[9.98, 0.5, 6], [0.06, 1, 12]],
  ] as [V3, V3][]) {
    deco(b, new BoxGeometry(...s), c, BRICK);
  }

  b.add(
    {
      type: 'door',
      pos: [0, 0, 0.05],
      yaw: 0,
      width: 2.4,
      height: 3.4,
      to: { level: 'hub', spawn: 'fromAshcombe' },
      lockedDuring: 'cindersnap',
      talk: 'classNotOverAshcombe',
    },
    {
      type: 'door',
      pos: [10, 0, 17.5],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'glasshouse', spawn: 'default' },
      lockedUnless: 'practice-cindersnap',
      closedAfter: 'cindersnap',
      talk: 'lockedGlasshouseDoor',
      label: 'The Glasshouse',
      style: 'iron',
    },
    {
      type: 'npc',
      speaker: 'ashcombe',
      pos: [0, 0, 8.5],
      yaw: Math.PI,
      look: { robe: '#8a2a1a', scarf: '#ff8a3c', trim: '#e8c25a', hat: '#3a1a12', hatStyle: 'pointy', hair: '#b8b0a8', hairStyle: 'bun', scale: 1.15 },
      talk: 'ashcombe',
    },
  );

  // ---------------------------------------------------------------- P1: the pantry and its cobweb
  b.box([-8.25, 1.5, 11], [3.5, 3, 0.3], { color: PLASTER });
  b.box([-8.25, 1.5, 17], [3.5, 3, 0.3], { color: PLASTER });
  b.box([-6.5, 1.5, 11.9], [0.3, 3, 1.8], { color: PLASTER });
  b.box([-6.5, 1.5, 16.1], [0.3, 3, 1.8], { color: PLASTER });
  b.box([-6.5, 2.9, 14], [0.3, 0.2, 2.4], { color: COLORS.woodDark });
  b.box([-6.5, 3.6, 14], [0.3, 1, 6.3], { color: COLORS.woodDark, pattern: 'planks' }); // a fascia for the sign
  slab(b, -10, -6.35, 10.85, 17.15, 3.2, 0.2, COLORS.woodDark, 'planks');
  b.add(
    { type: 'burnable', id: 'aweb', style: 'cobweb', pos: [-6.5, 1.4, 14], size: [2.4, 2.8, 0.25], yaw: Math.PI / 2 },
    { type: 'plate', id: 'ap1', pos: [-8.4, 0, 14], latch: true },
    { type: 'sweet', kind: 'bramble', pos: [-9.2, 0.6, 12] },
  );
  for (const z of [12, 16]) shelf(b, [-9.65, 0, z], Math.PI / 2, 1.6, 2.6);
  barrel(b, [-9.3, 0, 15.9], 0.35, 0.9);
  signboard(b, 'Pantry\nMind the cobwebs!', [-6.33, 3.6, 14], Math.PI / 2);

  // ---------------------------------------------------------------- P2: the high shelf and the hanging crate
  b.box([8.5, 1.2, 11.5], [3, 2.4, 5], { color: BRICK, info: { noGrab: true } });
  deco(b, new BoxGeometry(3.1, 0.12, 5.1), [8.5, 2.42, 11.5], COLORS.woodDark);
  b.add(
    { type: 'plate', id: 'ap2', pos: [8.6, 2.4, 11.5], latch: true },
    { type: 'dropper', pos: [6.1, 3.2, 11.5], size: [1.2, 1.2, 1.2], floorY: 0, when: ['arope'] },
    { type: 'burnable', id: 'arope', style: 'rope', pos: [6.1, 4.45, 11.5], size: [0.2, 1.3, 0.2] },
    { type: 'sweetLine', kind: 'fizzwort', from: [8.6, 3, 9.6], to: [8.6, 3, 13.4], count: 3 },
  );
  // The beam and pulley the rope hangs from.
  deco(b, new BoxGeometry(5, 0.35, 0.35), [7.5, 5.25, 11.5], COLORS.woodDark);
  deco(b, new TorusGeometry(0.22, 0.06, 5, 10), [6.1, 4.95, 11.5], '#3a3340');
  signboard(b, 'Ropes hold things up.\nBurn one!', [6.98, 1.6, 11.5], -Math.PI / 2);

  // ---------------------------------------------------------------- P3: three braziers, notched I-III
  b.add(
    { type: 'brazier', id: 'ab2', pos: [-5.5, 0, 19.8], group: 'class', order: 2, light: true },
    { type: 'brazier', id: 'ab3', pos: [-1, 0, 20], group: 'class', order: 3, light: true },
    { type: 'brazier', id: 'ab1', pos: [3.5, 0, 19.8], group: 'class', order: 1, light: true },
    { type: 'trigger', flag: 'practice-cindersnap-trigger', script: 'cinderPracticeDone', when: ['ap1', 'ap2', 'ab1', 'ab2', 'ab3'] },
    { type: 'trigger', flag: 'hint-ashcombe-order', script: 'ashcombeOrderHint', when: ['class:fail'], unlessSignals: ['ab3'], perVisit: true },
    { type: 'trigger', flag: 'hint-ashcombe-rope', script: 'ashcombeRopeHint', min: [-10, -1, 0], max: [10, 4, 22], unlessSignals: ['arope'], delay: 45, perVisit: true },
  );
  signboard(b, 'Light them in order:\ncount the notches!', [-1, 3.6, 21.97], Math.PI);

  // ---------------------------------------------------------------- the kitchen: hearth, tables, pots
  // The great hearth in the west wall.
  b.box([-9.4, 1.6, 5.5], [1.2, 3.2, 0.6], { color: BRICK });
  b.box([-9.4, 1.6, 9.5], [1.2, 3.2, 0.6], { color: BRICK });
  b.box([-9.4, 3.5, 7.5], [1.4, 0.8, 4.8], { color: BRICK });
  deco(b, new BoxGeometry(1.6, 0.2, 5), [-9.3, 4, 7.5], COLORS.woodDark);
  for (let i = 0; i < 5; i++) deco(b, new CylinderGeometry(0.12, 0.12, 1.4, 6), [-9.4, 0.15 + (i % 2) * 0.12, 6.8 + i * 0.35], COLORS.wood, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 7; i++) flames.add(new ConeGeometry(0.18, 0.5 + (i % 3) * 0.15, 5), [-9.3 + Math.sin(i) * 0.15, 0.6, 6.6 + i * 0.3]);
  cauldron(b, [-8.8, 0, 7.5], 0.55);
  deco(b, new CylinderGeometry(0.04, 0.04, 2.2, 4), [-8.8, 2.4, 7.5], '#3a3340');
  // Long tables with candles; pots and loaves.
  table(b, flames, [-3, 0, 4.5], 0, 4, 1.2, 3);
  table(b, flames, [3, 0, 4.5], 0, 4, 1.2, 7);
  bench(b, [-3, 0, 3.4], 0, 3.4);
  bench(b, [3, 0, 3.4], 0, 3.4);
  for (const [x, z, c] of [
    [-4.2, 4.6, '#c9883e'],
    [-2.6, 4.3, '#d9a05a'],
    [2.2, 4.7, '#c9883e'],
    [3.8, 4.4, '#b0362f'],
  ] as [number, number, string][]) {
    deco(b, new SphereGeometry(0.2, 8, 5), [x, 0.95, z], c);
  }
  for (const x of [-1.6, 4.6]) deco(b, new CylinderGeometry(0.22, 0.18, 0.25, 8), [x, 0.97, 4.6], '#7a7a88');
  // Pans hanging over the hearth side.
  for (let i = 0; i < 4; i++) {
    deco(b, new CylinderGeometry(0.25, 0.22, 0.06, 10), [-7.6, 3.2 - (i % 2) * 0.2, 2.6 + i * 0.7], '#b87a4a', [Math.PI / 2, 0, 0]);
    deco(b, new BoxGeometry(0.04, 0.5, 0.04), [-7.6, 3.6 - (i % 2) * 0.2, 2.6 + i * 0.7], '#3a3340');
  }
  deco(b, new BoxGeometry(0.1, 0.1, 3.4), [-7.6, 3.85, 3.6], COLORS.woodDark);
  // Herbs drying from the beams.
  for (let i = 0; i < 6; i++) deco(b, new BoxGeometry(0.18, 0.6, 0.18), [-3 + i * 1.3, H - 0.8, 10], i % 2 ? '#6a8a3a' : '#8a7a3a');
  crate(b, [9.2, 0, 2], 0.9);
  crate(b, [9.2, 0.9, 2.2], 0.7);
  barrel(b, [8, 0, 1.2], 0.4, 1);
  barrel(b, [-9.2, 0, 19.5], 0.4, 1);
  barrel(b, [-9.2, 0, 21], 0.4, 1);
  pottedPlant(b, [8.9, 0, 21], 1, 4);
  rug(b, [0, 0, 13.5], 5, 3, '#8a2a1a', '#e8c25a');
  wallTorch(b, flames, [-2.2, 2.5, 0.02], 0);
  wallTorch(b, flames, [2.2, 2.5, 0.02], 0);
  wallTorch(b, flames, [9.98, 2.6, 6], -Math.PI / 2);
  portrait(b, CARD_BY_ID.get('mother-wortle')!.portrait, [9.95, 3.2, 3.5], -Math.PI / 2, 1.1, 1.4, -0.06);
  b.lantern([-5, 4.8, 13], 6, 12);
  b.lantern([5, 4.8, 5], 6, 12);
  for (const [c, d1, d2] of [
    [[-10, H - 0.5, 0], [1, 0], [0, 1]],
    [[10, H - 0.5, 22], [-1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.2);
  }

  flames.finish(b, '#ffb060');
  b.finish();
}
