import { BoxGeometry, CanvasTexture, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import {
  bookStack,
  candlestick,
  cobweb,
  deco,
  dustMotes,
  Glow,
  lightShaft,
  portrait,
  pottedPlant,
  rug,
  shelf,
  slab,
  table,
  wall,
  windowPane,
} from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * Madam Quince's Locks & Latches classroom, at the top of the Long Gallery
 * (x -7..7, z 0..14). Enter from the gallery (south door). Quince teaches Latchkin;
 * three padlocked practice boxes (the third behind bars, to show spells see through
 * grilles) unlock the iron door (east) down to the Latchkin Vaults.
 */
export const QUINCE: LevelDef = {
  id: 'quince',
  name: 'Locks & Latches',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromVault: { pos: [5.3, 0, 11.2], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'quince', name: 'Locks & Latches', min: [-7, -2, 0], max: [7, 8, 14] }],
  intro: { script: 'quinceLesson', unlessFlag: 'quince-lesson-started' },
  build,
};

function build(b: LevelBuilder): void {
  const glow = new Glow();
  const candle = new Glow();
  const H = 7;
  b.floor(-7.5, 7.5, -0.5, 14.5, { color: '#7a6a5a' });
  b.box([0, 0.01, 7], [14, 0.02, 14], { color: '#8a6a4a', pattern: 'planks', noCollide: true });
  wall(b, 'x', -0.5, -7.5, 7.5, H, { holes: [{ from: -1.25, to: 1.25, top: 3.5 }], color: '#9a8a7a' });
  wall(b, 'x', 14.5, -7.5, 7.5, H, { color: '#9a8a7a' });
  wall(b, 'z', -7.5, 0, 14, H, { color: '#9a8a7a' });
  wall(b, 'z', 7.5, 0, 14, H, { holes: [{ from: 9.9, to: 12.5, top: 3.5 }], color: '#9a8a7a' });
  slab(b, -7.5, 7.5, -0.5, 14.5, H + 0.5, 0.5, '#4a3a4a', 'planks');
  for (let z = 2; z < 14; z += 4) deco(b, new BoxGeometry(15, 0.4, 0.4), [0, H - 0.2, z], COLORS.woodDark);

  b.add(
    {
      type: 'door',
      pos: [0, 0, 0.05],
      yaw: 0,
      width: 2.4,
      height: 3.4,
      to: { level: 'hub', spawn: 'fromQuince' },
      lockedDuring: 'latchkin',
      talk: 'classNotOverQuince',
    },
    {
      type: 'door',
      pos: [7, 0, 11.2],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'vault', spawn: 'default' },
      lockedUnless: 'practice-latchkin',
      closedAfter: 'latchkin',
      style: 'iron',
      talk: 'lockedVaultDoor',
      label: 'The Vaults',
    },
  );

  // Blackboard.
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 280;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f3a4a';
  g.fillRect(0, 0, 768, 280);
  g.strokeStyle = '#8a5a36';
  g.lineWidth = 16;
  g.strokeRect(0, 0, 768, 280);
  g.fillStyle = 'rgba(240,240,230,0.9)';
  g.font = 'bold 54px Palatino, Georgia, serif';
  g.fillText('LATCHKIN', 40, 80);
  g.font = 'italic 34px Palatino, Georgia, serif';
  g.fillText('1. Find the lock   2. SEE the lock', 40, 140);
  g.fillText('3. Ask nicely', 40, 190);
  g.strokeStyle = 'rgba(240,240,230,0.85)';
  g.lineWidth = 5;
  g.strokeRect(590, 130, 70, 60);
  g.beginPath();
  g.arc(625, 130, 26, Math.PI, 0);
  g.stroke();
  g.beginPath();
  g.arc(625, 156, 7, 0, Math.PI * 2);
  g.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const board = new Mesh(new PlaneGeometry(6, 2.2), new MeshBasicMaterial({ map: tex, fog: true }));
  board.position.set(0, 3, 13.97);
  board.rotation.y = Math.PI;
  b.prop(board);

  // Quince, at a workbench strewn with locks.
  table(b, candle, [0, 0, 10.6], 0, 3.2, 1.2, 9);
  for (let i = 0; i < 4; i++) {
    const x = -1.2 + i * 0.7;
    deco(b, new BoxGeometry(0.18, 0.16, 0.08), [x, 0.93, 10.3], '#d4a94a');
    deco(b, new TorusGeometry(0.06, 0.015, 4, 8, Math.PI), [x, 1.04, 10.3], '#3a3340');
  }
  b.add({
    type: 'npc',
    speaker: 'quince',
    pos: [0, 0, 12.2],
    yaw: Math.PI,
    look: { robe: '#2f5a6a', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#24323f', hatStyle: 'tall', hair: '#8a3a22', hairStyle: 'bun', glasses: true, scale: 1.2 },
    talk: 'quince',
  });

  // Practice boxes: two on pedestals, the third in a barred cabinet you cast through.
  for (const x of [-4, 3.2]) {
    b.cylinder([x, 0.45, 6.5], 0.45, 0.9, COLORS.stoneLight, undefined, 8);
    deco(b, new CylinderGeometry(0.55, 0.55, 0.08, 8), [x, 0.94, 6.5], COLORS.stone);
  }
  // The barred cabinet on the west wall: a stone niche with iron bars in front.
  b.box([-6.6, 1.1, 10.5], [0.8, 0.2, 1.6], { color: COLORS.stone });
  b.box([-6.6, 2.5, 10.5], [0.8, 0.2, 1.6], { color: COLORS.stone });
  for (const z of [9.65, 11.35]) b.box([-6.6, 1.8, z], [0.8, 1.6, 0.1], { color: COLORS.stone });
  for (let i = 0; i < 6; i++) deco(b, new CylinderGeometry(0.025, 0.025, 1.2, 5), [-6.18, 1.8, 9.85 + i * 0.26], '#3a3340');
  b.box([-6.18, 1.8, 10.5], [0.06, 1.2, 1.6], { invisible: true, info: { seeThrough: true, noGrab: true, cameraIgnore: true } });
  b.add(
    { type: 'chest', id: 'quince-box-1', pos: [-4, 0.98, 6.5], yaw: Math.PI, style: 'box', sweets: [['fizzwort', 3]], signal: 'q1' },
    { type: 'chest', id: 'quince-box-2', pos: [3.2, 0.98, 6.5], yaw: Math.PI, style: 'box', sweets: [['fizzwort', 3]], signal: 'q2' },
    { type: 'chest', id: 'quince-box-3', pos: [-6.6, 1.2, 10.5], yaw: Math.PI / 2, style: 'box', sweets: [['bramble', 1]], signal: 'q3' },
    { type: 'trigger', flag: 'practice-latchkin-trigger', script: 'latchkinPracticeDone', when: ['q1', 'q2', 'q3'] },
  );

  // Dressing: shelves of locks, a giant key, portraits, rugs, windows and light.
  shelf(b, [6.7, 0, 4], -Math.PI / 2, 2.6, 3.4);
  shelf(b, [6.7, 0, 7], -Math.PI / 2, 2.6, 3.4);
  for (let i = 0; i < 6; i++) {
    const z = 2.9 + i * 0.45;
    deco(b, new BoxGeometry(0.1, 0.14, 0.16), [6.45, 1.55 + (i % 2) * 0.85, z], '#d4a94a');
  }
  // A key as tall as a first-year, hung over the door.
  deco(b, new TorusGeometry(0.45, 0.1, 6, 16), [0, 5.1, 0.6], '#d4a94a');
  deco(b, new BoxGeometry(0.16, 0.16, 2.2).rotateY(Math.PI / 2), [1.55, 5.1, 0.6], '#d4a94a');
  for (const x of [2.3, 2.6]) deco(b, new BoxGeometry(0.12, 0.42, 0.12), [x, 4.85, 0.6], '#d4a94a');
  rug(b, [0, 0, 5], 5, 6, '#2f5a6a', '#d4a94a');
  pottedPlant(b, [-6.4, 0, 1], 1.3, 3);
  pottedPlant(b, [6.4, 0, 1], 1.3, 4);
  bookStack(b, [1.2, 0.85, 10.8], 4, 5);
  candlestick(b, candle, [-1.3, 0.85, 10.9], 0.25);
  for (const z of [3, 7]) {
    windowPane(b, glow, 'z', -7.5, z, 5, 1.4, 2.8, 1);
    lightShaft(b, [-6.95, 5.3, z], [0.85, -0.65, 0.2], 8, 1.3, 0.18);
  }
  dustMotes(b, [-6.5, 0.5, 1], [6.5, 6.5, 13.5], 70);
  // Above the shelves, well clear of the Vaults door's frame.
  portrait(b, CARD_BY_ID.get('lumley-lockjaw')!.portrait, [6.95, 4.85, 5.5], -Math.PI / 2, 1.2, 1.5, 0.04);
  for (const [corner, d1, d2] of [
    [[-7, H - 0.5, 0], [1, 0], [0, 1]],
    [[7, H - 0.5, 14], [-1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, corner, d1, d2, 1);
  }
  b.lantern([-3.5, 5.6, 6], 10, 14);
  b.lantern([3.5, 5.6, 9], 10, 14);
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [-5.5, 0.6, 2], to: [-5.5, 0.6, 6], count: 3 });

  glow.finish(b, '#ffc68a');
  candle.finish(b, '#ffe2a0');
  b.finish();
}
