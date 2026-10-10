import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { bookStack, candlestick, cobweb, deco, Glow, portrait, rug, shelf, signboard, slab, table, wall, wallTorch } from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * Mr. Lamplough's study in the Undercroft, under the Lantern Hall (x -9..9, z 0..20,
 * dark). Enter from the hub (south door). Lamplough teaches Glimmerwick; three latching
 * plates: P1 on the west ledge (top 3.3) up glimmer steps lit by lamp A; P2 on the east
 * island across a trench (x 2..6.5) on a glimmer bridge lit by lamp B; P3 on the north
 * shelf (top 2.4), whose glimmer step only a CHARGED lamp C reaches. The iron door
 * (east) leads down to the Lamplit Catacombs.
 */
export const LAMPLOUGH: LevelDef = {
  id: 'lamplough',
  name: 'Illumination',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromCatacombs: { pos: [7.4, 0, 15], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'study', name: 'Illumination', min: [-9, -3, 0], max: [9, 8, 20] }],
  intro: { script: 'lamploughLesson', unlessFlag: 'lamplough-lesson-started' },
  ambience: 'dark',
  music: 'dungeon',
  build,
};

function build(b: LevelBuilder): void {
  const flames = new Glow();
  const H = 6;
  b.floor(-9.5, 9.5, -0.5, 20.5, { color: '#5a5262', holes: [[2, 6.5, 0, 12]] });
  b.pool(2, 6.5, 0, 12, -1.4, -2.5);
  wall(b, 'x', -0.5, -9.5, 9.5, H, { color: '#6a6272', holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 20.5, -9.5, 9.5, H, { color: '#6a6272' });
  wall(b, 'z', -9.5, 0, 20, H, { color: '#6a6272' });
  wall(b, 'z', 9.5, 0, 20, H, { color: '#6a6272', holes: [{ from: 13.8, to: 16.2, top: 3.5 }] });
  slab(b, -9.5, 9.5, -0.5, 20.5, H + 0.5, 0.5, '#3a3242', 'planks');
  for (let z = 3; z < 20; z += 4) deco(b, new BoxGeometry(19, 0.4, 0.4), [0, H - 0.2, z], COLORS.woodDark);

  b.add(
    {
      type: 'door',
      pos: [0, 0, 0.05],
      yaw: 0,
      width: 2.4,
      height: 3.4,
      to: { level: 'hub', spawn: 'fromUndercroft' },
      lockedDuring: 'glimmerwick',
      talk: 'classNotOverLamplough',
    },
    {
      type: 'door',
      pos: [9, 0, 15],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'catacombs', spawn: 'default' },
      lockedUnless: 'practice-glimmerwick',
      closedAfter: 'glimmerwick',
      talk: 'lockedCatacombDoor',
      label: 'The Catacombs',
      style: 'iron',
    },
    // Room light: two lamps that are always lit.
    { type: 'wickLamp', pos: [-4, 4.2, 13], style: 'hanging', radius: 2, duration: 0, lit: true, light: true, lightRange: 13 },
    { type: 'wickLamp', pos: [3, 4.2, 15], style: 'hanging', radius: 2, duration: 0, lit: true, light: true, lightRange: 13 },
  );

  // P1: the west ledge, up glimmer steps lit by lamp A.
  b.box([-7.75, 1.65, 8], [2.5, 3.3, 4], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.add(
    { type: 'wickLamp', id: 'gA', pos: [-2.5, 0, 5.2], radius: 4.5, duration: 10, light: true },
    { type: 'glimmerBlock', pos: [-3.2, 0.95, 8], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [-5.2, 2.05, 8], size: [1.5, 0.3, 1.5] },
    { type: 'plate', id: 'g1', pos: [-7.75, 3.3, 8], latch: true },
  );
  // P2: the island across the trench, over a glimmer bridge lit by lamp B.
  b.box([5.5, 1.5, 12.25], [7, 3, 0.5], { color: '#6a6272' }); // closes the trench off to the north
  b.add(
    { type: 'wickLamp', id: 'gB', pos: [1, 0, 3.5], radius: 5.5, duration: 10, light: true },
    { type: 'glimmerBlock', pos: [3.2, -0.15, 7], size: [2.4, 0.3, 1.6] },
    { type: 'glimmerBlock', pos: [5.4, -0.15, 7], size: [2.2, 0.3, 1.6] },
    { type: 'plate', id: 'g2', pos: [7.75, 0, 6], latch: true },
  );
  // P3: the north shelf; its step only shows in a charged lamp's wider glow.
  b.box([6, 1.2, 18.5], [6, 2.4, 3], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.add(
    { type: 'wickLamp', id: 'gC', pos: [-4, 0, 18.8], radius: 4, duration: 10, light: true },
    { type: 'glimmerBlock', pos: [1.5, 1.05, 18.5], size: [1.5, 0.3, 1.5] },
    { type: 'plate', id: 'g3', pos: [6.2, 2.4, 18.5], latch: true },
    { type: 'trigger', flag: 'practice-glimmerwick-trigger', script: 'glimmerPracticeDone', when: ['g1', 'g2', 'g3'] },
    { type: 'trigger', flag: 'hint-lamplough-charge', script: 'lamploughChargeHint', when: ['g1', 'g2'], unlessSignals: ['g3'], delay: 20, perVisit: true },
    {
      type: 'npc',
      speaker: 'lamplough',
      pos: [-1.5, 0, 14.2],
      yaw: Math.PI,
      look: { robe: '#2a3a5a', scarf: '#bfe8ff', trim: '#e8e2d0', hat: '#1e2638', hatStyle: 'tall', hair: '#e8e2d0', hairStyle: 'long', beard: true, glasses: true, scale: 1.2 },
      talk: 'lamplough',
    },
    { type: 'sweetLine', kind: 'fizzwort', from: [-7.75, 3.9, 6.5], to: [-7.75, 3.9, 9.5], count: 2 },
    { type: 'sweet', kind: 'bramble', pos: [7.75, 0.6, 9] },
  );
  signboard(b, 'Too far? HOLD the cast!', [-4, 3.6, 19.97], Math.PI);

  // A study: desk, shelves, a reading chair, candles, rugs.
  table(b, flames, [-1.5, 0, 16], 0, 2.6, 1.1, 4);
  bookStack(b, [-2.2, 0.85, 16.1], 5, 2);
  bookStack(b, [-0.6, 0.85, 15.9], 3, 9);
  candlestick(b, flames, [-1.3, 0.85, 16.3], 0.2);
  shelf(b, [-8.7, 0, 15], Math.PI / 2, 2.6, 3.6);
  shelf(b, [-8.7, 0, 18], Math.PI / 2, 2.6, 3.6);
  shelf(b, [-8.7, 0, 3], Math.PI / 2, 2.6, 3.6);
  b.cylinder([-5.5, 0.35, 16.5], 0.45, 0.7, '#5a2a3a', undefined, 8);
  deco(b, new BoxGeometry(0.9, 0.9, 0.2), [-5.5, 1.1, 16.95], '#5a2a3a');
  rug(b, [-3, 0, 11], 4, 3, '#2a3a5a', '#bfe8ff');
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7;
    deco(b, new SphereGeometry(0.08, 6, 4), [-6 + Math.cos(a) * 0.3, 2.4 + i * 0.05, 1.5 + Math.sin(a) * 0.3], '#ffe8a0');
  }
  deco(b, new CylinderGeometry(0.4, 0.5, 0.9, 8), [-6, 0.45, 1.5], COLORS.stoneDark);
  wallTorch(b, flames, [-2.2, 2.5, 0.02], 0);
  wallTorch(b, flames, [2.2, 2.5, 0.02], 0);
  // Between the west ledge (z 6..10) and the shelves (from z 13.7).
  portrait(b, CARD_BY_ID.get('ambrose-wick')!.portrait, [-9, 3, 11.9], Math.PI / 2, 1.1, 1.4, 0.03);
  for (const [c, d1, d2] of [
    [[-9, H - 0.5, 0], [1, 0], [0, 1]],
    [[9, H - 0.5, 20], [-1, 0], [0, -1]],
    [[-9, H - 0.5, 20], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.2);
  }

  flames.finish(b, '#ffb060');
  b.finish();
}
