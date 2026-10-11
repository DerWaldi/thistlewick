import { BoxGeometry, CanvasTexture, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { banner, cobweb, deco, dustMotes, Glow, lightShaft, portrait, pottedPlant, signboard, slab, wall, windowPane } from '../../world/props';
import { CARD_BY_ID } from '../cards';
import { HOUSE_ORDER, HOUSES } from '../houses';

/**
 * Mr. Hopgood's Leaps & Bounds gym, off the Long Gallery (x -8..8, z 0..16, a tall
 * room). Enter from the gallery (south door). Hopgood teaches Springwell; three
 * platforms along the north wall carry latching plates, each reached by bouncing
 * off its pad (the tall one needs jump held on landing). The iron door (west) leads
 * down... well, up, to the Tumbledown Tower.
 */
export const HOPGOOD: LevelDef = {
  id: 'hopgood',
  name: 'Leaps & Bounds',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromTower: { pos: [6.3, 0, 3], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'gym', name: 'Leaps & Bounds', min: [-8, -2, 0], max: [8, 13, 16] }],
  intro: { script: 'hopgoodLesson', unlessFlag: 'hopgood-lesson-started' },
  build,
};

function build(b: LevelBuilder): void {
  const glow = new Glow();
  const H = 12;
  b.floor(-8.5, 8.5, -0.5, 16.5, { color: '#8a6a4a' });
  b.box([0, 0.01, 8], [16, 0.02, 16], { color: '#b08a5a', pattern: 'planks', noCollide: true });
  wall(b, 'x', -0.5, -8.5, 8.5, H, { holes: [{ from: -1.25, to: 1.25, top: 3.5 }], color: '#b8a088' });
  wall(b, 'x', 16.5, -8.5, 8.5, H, { color: '#b8a088' });
  wall(b, 'z', -8.5, 0, 16, H, { color: '#b8a088' });
  wall(b, 'z', 8.5, 0, 16, H, { holes: [{ from: 1.8, to: 4.2, top: 3.5 }], color: '#b8a088' });
  slab(b, -8.5, 8.5, -0.5, 16.5, H + 0.5, 0.5, '#5e4a3e', 'planks');
  for (let z = 2; z < 16; z += 3.5) deco(b, new BoxGeometry(17, 0.45, 0.45), [0, H - 0.25, z], COLORS.woodDark);
  // Court lines painted on the floor.
  deco(b, new BoxGeometry(14, 0.01, 0.08), [0, 0.025, 8], '#f3ead8');
  deco(b, new CylinderGeometry(2, 2, 0.01, 32, 1, true), [0, 0.03, 8], '#f3ead8');

  b.add(
    {
      type: 'door',
      pos: [0, 0, 0.05],
      yaw: 0,
      width: 2.4,
      height: 3.4,
      to: { level: 'hub', spawn: 'fromHopgood' },
      lockedDuring: 'springwell',
      talk: 'classNotOverHopgood',
    },
    {
      type: 'door',
      pos: [8, 0, 3],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'tower', spawn: 'default' },
      lockedUnless: 'practice-springwell',
      closedAfter: 'springwell',
      talk: 'lockedTowerDoor',
      label: 'The Tower',
      style: 'iron',
    },
  );

  // The three practice platforms (no ledge-grabbing: bounce up), pads in front.
  const platforms: [number, number, number, number][] = [
    // x0, x1, top, pad x
    [-7, -3.5, 5, -5.25],
    [-1.75, 1.75, 6, 0],
    [3.5, 7, 7.8, 5.25],
  ];
  platforms.forEach(([x0, x1, top], i) => {
    b.box([(x0 + x1) / 2, top / 2, 14], [x1 - x0, top, 4], { color: i === 2 ? '#a07a5a' : '#8a6a4a', pattern: 'planks', info: { noGrab: true } });
    // A lip along the front edge (not a full cap: a cap flush with the top z-fights).
    deco(b, new BoxGeometry(x1 - x0 + 0.1, 0.16, 0.14), [(x0 + x1) / 2, top - 0.05, 11.95], COLORS.woodDark);
    // Painted height marks.
    for (let y = 1; y < top; y += 1) deco(b, new BoxGeometry(0.4, 0.05, 0.02), [(x0 + x1) / 2, y, 11.99], '#f3ead8');
  });
  b.add(
    { type: 'springPad', pos: [-5.25, 0, 9.6], radius: 1.1, style: 'moss', duration: 10 },
    { type: 'springPad', pos: [0, 0, 9.4], radius: 1.1, style: 'mattress', duration: 10 },
    { type: 'springPad', pos: [5.25, 0, 10.1], radius: 1.1, style: 'rune', duration: 10 },
    // Near the front edges, where you land.
    { type: 'plate', id: 'h1', pos: [-5.25, 5, 13.1], latch: true },
    { type: 'plate', id: 'h2', pos: [0, 6, 13.1], latch: true },
    { type: 'plate', id: 'h3', pos: [5.25, 7.8, 13.1], latch: true },
    { type: 'trigger', flag: 'practice-springwell-trigger', script: 'springPracticeDone', when: ['h1', 'h2', 'h3'] },
    // Stuck under the tall one? Hopgood shouts a tip.
    { type: 'trigger', flag: 'hint-hopgood-charge', script: 'hopgoodChargeHint', when: ['h1', 'h2'], unlessSignals: ['h3'], delay: 20, perVisit: true },
    {
      type: 'npc',
      speaker: 'hopgood',
      pos: [-3, 0, 4.5],
      yaw: Math.PI * 0.85,
      look: { robe: '#3f7a4a', scarf: '#e8c25a', trim: '#b0362f', hat: '#b0362f', hatStyle: 'cap', hair: '#d9822e', hairStyle: 'wild', scale: 1.2, expression: 'cheeky' },
      talk: 'hopgood',
    },
    { type: 'sweetLine', kind: 'fizzwort', from: [-5.25, 5.6, 13], to: [-5.25, 5.6, 15], count: 2 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 6.6, 13], to: [0, 6.6, 15], count: 2 },
    { type: 'sweet', kind: 'bramble', pos: [5.25, 8.4, 14.6] },
  );

  signboard(b, 'Too high? HOLD the cast!', [5.25, 3.2, 11.97], Math.PI);

  // Gym kit: wall bars, mats, a vaulting horse, medicine balls, climbing ropes.
  for (let i = 0; i < 6; i++) {
    const z = 3 + i * 0.5;
    deco(b, new CylinderGeometry(0.05, 0.05, 6, 6), [-7.85, 3, z], COLORS.wood);
  }
  for (let y = 0.4; y < 6; y += 0.45) deco(b, new CylinderGeometry(0.03, 0.03, 2.6, 5).rotateX(Math.PI / 2), [-7.82, y, 4.25], COLORS.woodDark);
  for (const [x, z] of [
    [-5.5, 6],
    [4.5, 6.4],
  ]) {
    deco(b, new BoxGeometry(2.6, 0.18, 1.6), [x, 0.09, z], '#3a5a8a');
    deco(b, new BoxGeometry(2.62, 0.04, 0.1), [x, 0.19, z], '#e8dcc0');
  }
  b.box([2.8, 0.55, 2.3], [1.6, 1.1, 0.6], { color: '#7a4a2a' });
  deco(b, new BoxGeometry(1.7, 0.18, 0.7), [2.8, 1.19, 2.3], '#5a2a1a');
  for (const [x, z, c] of [
    [6.9, 6.8, '#7a2f3a'],
    [7.2, 7.6, '#2f5a6a'],
    [6.6, 7.7, '#c99a3e'],
  ] as const) {
    deco(b, new SphereGeometry(0.3, 10, 7), [x, 0.3, z], c);
  }
  for (const x of [-1.5, 1.5]) deco(b, new CylinderGeometry(0.05, 0.05, 7, 6), [x, H - 3.5, 5], '#c8a878');
  HOUSE_ORDER.forEach((h, i) => banner(b, [-7.95, 9, 6 + i * 2.2], Math.PI / 2, HOUSES[h].color, HOUSES[h].trim, 1.2, 2.6));

  // A scoreboard.
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 200;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b2b3a';
  g.fillRect(0, 0, 512, 200);
  g.strokeStyle = '#c99a3e';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 190);
  g.fillStyle = '#f3e4c4';
  g.font = 'bold 44px Palatino, Georgia, serif';
  g.textAlign = 'center';
  g.fillText('LEAPS & BOUNDS', 256, 72);
  g.font = 'italic 30px Palatino, Georgia, serif';
  g.fillText('Cast. Run. Hold jump. Fly.', 256, 130);
  g.fillText('(Land somewhere soft.)', 256, 172);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const board = new Mesh(new PlaneGeometry(4, 1.56), new MeshBasicMaterial({ map: tex, fog: true }));
  board.position.set(0, 10, 15.97);
  board.rotation.y = Math.PI;
  b.prop(board);

  for (const z of [10, 14]) {
    windowPane(b, glow, 'z', 8.5, z, 7, 1.4, 3.4, -1);
    lightShaft(b, [7.95, 8, z], [-0.85, -0.6, -0.15], 10, 1.4, 0.16);
  }
  dustMotes(b, [-7.5, 0.5, 1], [7.5, 11, 15], 90);
  portrait(b, CARD_BY_ID.get('griselda-gusset')!.portrait, [-2.5, 3.2, 0.06], 0, 1.1, 1.4, 0.04);
  pottedPlant(b, [-7.3, 0, 0.8], 1.3, 2);
  pottedPlant(b, [7.3, 0, 0.8], 1.3, 5);
  for (const [corner, d1, d2] of [
    [[-8, H - 0.6, 16], [1, 0], [0, -1]],
    [[8, H - 0.6, 16], [-1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, corner, d1, d2, 1.2);
  }
  b.lantern([-3, 9.5, 8], 10, 16);
  b.lantern([3, 9.5, 8], 10, 16);

  glow.finish(b, '#ffc68a');
  b.finish();
}
