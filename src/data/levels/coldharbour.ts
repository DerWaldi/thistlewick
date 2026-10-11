import { BoxGeometry, ConeGeometry, CylinderGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { barrel, cobweb, crate, deco, Glow, portrait, rug, shelf, signboard, slab, wall, wallTorch } from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * Madam Coldharbour's boathouse, Frosts & Waters (x -10..10, z 0..26). Enter from the
 * grounds (south door). Coldharbour teaches Rimewhistle; three plates, each with a sign:
 *   - P1 on an islet in the east pool (x -10..-3.5, z 5..11): freeze the 5 m of water
 *     between it and the floor (too far to jump)
 *   - P2 on the west ledge (x 6.5..10, z 6..13, top 3.6, ungrabbable): freeze the
 *     waterfall pouring down its face into a pillar, climb that, then the ledge
 *   - P3 across the boat dock (water z 14..24, the whole width) on the north jetty: tapped,
 *     the ice lasts 1.2 s, too short to cross 10 m; a CHARGED freeze lasts 4 s
 * The iron door (west, z 3) leads down to the Flooded Cisterns.
 */
export const COLDHARBOUR: LevelDef = {
  id: 'coldharbour',
  name: 'Frosts & Waters',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromCisterns: { pos: [8.4, 0, 3], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'boathouse', name: 'Frosts & Waters', min: [-10, -3, 0], max: [10, 9, 26] }],
  intro: { script: 'coldharbourLesson', unlessFlag: 'coldharbour-lesson-started' },
  build,
};

const BOARDS = '#7a8a96';
const WATER = -0.5;

function build(b: LevelBuilder): void {
  const flames = new Glow();
  const H = 7;
  b.floor(-10.5, 10.5, -0.5, 26.5, {
    color: '#8a8070',
    holes: [
      [-10, -3.5, 5, 11],
      [4.5, 6.5, 8, 11],
      [-10, 10, 14, 24],
    ],
  });
  b.pool(-10, -3.5, 5, 11, WATER, -2.5);
  b.pool(4.5, 6.5, 8, 11, WATER, -2.5);
  b.pool(-10, 10, 14, 24, WATER, -3);
  wall(b, 'x', -0.5, -10.5, 10.5, H, { color: BOARDS, pattern: 'planks', holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 26.5, -10.5, 10.5, H, { color: BOARDS, pattern: 'planks' });
  wall(b, 'z', -10.5, 0, 26, H, { color: BOARDS, pattern: 'planks' });
  wall(b, 'z', 10.5, 0, 26, H, { color: BOARDS, pattern: 'planks', holes: [{ from: 1.8, to: 4.2, top: 3.5 }] });
  // The boat doors (north), shut for the winter.
  deco(b, new BoxGeometry(8.4, 4.6, 0.1), [0, 2.3, 25.97], '#4a5a66');
  for (const x of [-2, 2]) deco(b, new BoxGeometry(3.8, 4.2, 0.12), [x, 2.3, 25.95], '#5a6a76');
  deco(b, new BoxGeometry(0.3, 4.6, 0.16), [0, 2.3, 25.93], COLORS.woodDark);
  slab(b, -10.5, 10.5, -0.5, 26.5, H + 0.5, 0.5, '#4a5a6a', 'planks');
  for (let z = 2; z < 26; z += 4) deco(b, new BoxGeometry(21, 0.35, 0.35), [0, H - 0.2, z], COLORS.woodDark);

  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'grounds', spawn: 'fromBoathouse' }, lockedDuring: 'rimewhistle', talk: 'classNotOverColdharbour' },
    {
      type: 'door',
      pos: [10, 0, 3],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'cisterns', spawn: 'default' },
      lockedUnless: 'practice-rimewhistle',
      closedAfter: 'rimewhistle',
      talk: 'lockedCisternDoor',
      label: 'The Cisterns',
      style: 'iron',
    },
    {
      type: 'npc',
      speaker: 'coldharbour',
      pos: [0, 0, 8],
      yaw: Math.PI,
      look: { robe: '#2f4f6a', scarf: '#cfeefa', trim: '#e8f6fc', hat: '#1e3040', hatStyle: 'tall', hair: '#f0f0f0', hairStyle: 'long', glasses: true, scale: 1.15, expression: 'stern' },
      talk: 'coldharbour',
    },
  );

  // ---------------------------------------------------------------- P1: the islet in the east pool
  b.box([-9.3, -1.25, 8], [1.4, 2.5, 3], { color: COLORS.stone, info: { noGrab: true } });
  b.add(
    { type: 'iceSheet', min: [-8.6, 6.5], max: [-3.5, 9.5], y: WATER, duration: 6 },
    { type: 'plate', id: 'cp1', pos: [-9.3, 0, 8], latch: true },
  );
  signboard(b, 'Freeze the water.\nThen walk on it!', [-10.45 + 0.47, 2.6, 8], Math.PI / 2);

  // ---------------------------------------------------------------- P2: the frozen waterfall
  b.box([8.25, 1.8, 9.5], [3.5, 3.6, 7], { color: COLORS.stone, info: { noGrab: true } });
  deco(b, new BoxGeometry(3.6, 0.1, 7.1), [8.25, 3.62, 9.5], COLORS.stoneLight);
  deco(b, new CylinderGeometry(0.22, 0.28, 0.8, 6), [6.6, 3.4, 9.5], COLORS.stoneDark, [0, 0, Math.PI / 2]);
  b.add(
    { type: 'waterfall', pos: [6.5, WATER, 9.5], yaw: -Math.PI / 2, width: 1.8, height: 3.6 - WATER, pillar: 2.7, depth: 1.2 },
    { type: 'plate', id: 'cp2', pos: [8.4, 3.6, 9.5], latch: true },
    { type: 'sweetLine', kind: 'fizzwort', from: [8.4, 4.2, 7], to: [8.4, 4.2, 12], count: 3 },
  );
  signboard(b, 'Frozen falls\nare for climbing', [6.48, 1.3, 7.2], -Math.PI / 2);

  // ---------------------------------------------------------------- P3: across the boat dock
  // The jetty stands 3 cm proud of the floor: flush, the two surfaces flickered.
  b.box([0, -0.12, 25.2], [8, 0.3, 2.6], { color: COLORS.wood, pattern: 'planks' });
  for (const x of [-3.5, 3.5]) b.cylinder([x, -1.6, 24.2], 0.15, 3, COLORS.woodDark, undefined, 6);
  b.add(
    // Running across takes about two seconds: a tap freeze melts long before that.
    { type: 'iceSheet', min: [-1.5, 14], max: [1.5, 24], y: WATER, duration: 1.2, chargedDuration: 4 },
    { type: 'plate', id: 'cp3', pos: [0, 0, 25.3], latch: true },
    { type: 'trigger', flag: 'practice-rimewhistle-trigger', script: 'rimePracticeDone', when: ['cp1', 'cp2', 'cp3'] },
    { type: 'trigger', flag: 'hint-coldharbour-charge', script: 'coldharbourChargeHint', when: ['cp1', 'cp2'], unlessSignals: ['cp3'], delay: 25, perVisit: true },
    { type: 'trigger', flag: 'hint-coldharbour-climb', script: 'coldharbourClimbHint', min: [3, -1, 5], max: [6.5, 4, 14], unlessSignals: ['cp2'], delay: 20, perVisit: true },
  );
  // Off to one side, so it never stands between you and the ice.
  signboard(b, 'Long way across?\nHOLD the cast: thicker ice!', [-6.5, 2.4, 13.6], Math.PI);
  b.box([-6.5, 1.2, 13.75], [0.2, 2.4, 0.2], { color: COLORS.woodDark });
  // A rowing boat tied up in the dock, and oars.
  deco(b, new BoxGeometry(1.4, 0.6, 3.8), [-6, WATER + 0.1, 19], COLORS.wood);
  deco(b, new BoxGeometry(1.2, 0.1, 3.6), [-6, WATER + 0.35, 19], COLORS.woodDark);
  deco(b, new TorusGeometry(0.2, 0.04, 4, 8), [-6, WATER + 0.5, 20.9], '#c8b898');

  // ---------------------------------------------------------------- dressing
  for (const z of [3, 12]) shelf(b, [-9.65, 0, z], Math.PI / 2, 2.2, 3);
  crate(b, [9.2, 0, 0.8], 0.8);
  barrel(b, [-2.5, 0, 0.8], 0.4, 1);
  barrel(b, [2.5, 0, 0.8], 0.4, 1);
  rug(b, [0, 0, 6], 4, 3, '#2f4f6a', '#cfeefa');
  // Icicles along the beams, and frost in the corners.
  for (let i = 0; i < 14; i++) deco(b, new ConeGeometry(0.06, 0.4 + (i % 3) * 0.2, 4), [-9 + i * 1.4, H - 0.6, 6 + (i % 2) * 8], '#d8f2fc', [Math.PI, 0, 0]);
  for (const [x, z] of [
    [-9.8, 0.4],
    [9.8, 13.6],
  ]) {
    deco(b, new BoxGeometry(0.8, 0.04, 0.8), [x, 0.02, z], '#f2f8fb');
  }
  wallTorch(b, flames, [-2.2, 2.5, 0.02], 0);
  wallTorch(b, flames, [2.2, 2.5, 0.02], 0);
  portrait(b, CARD_BY_ID.get('grey-lady')!.portrait, [-9.95, 3.6, 3], Math.PI / 2, 1, 1.3, 0.05);
  b.lantern([-4, 5.6, 4], 6, 12);
  b.lantern([4, 5.6, 18], 6, 12);
  for (const [c, d1, d2] of [
    [[-10, H - 0.5, 0], [1, 0], [0, 1]],
    [[10, H - 0.5, 0], [-1, 0], [0, 1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.1);
  }

  flames.finish(b, '#ffb060');
  b.finish();
}
