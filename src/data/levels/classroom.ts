import { BoxGeometry, CanvasTexture, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { bookStack, candlestick, cauldron, cobweb, deco, dustMotes, Glow, lightShaft, portrait, pottedPlant, rug, shelf, slab, wall, windowPane } from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * Professor Gorse's Practical Charms classroom (x -8..8, z 0..14). Enter from the
 * Crooked Corridor (south door). Gorse teaches Thwackwort, three practice targets
 * unlock the iron door (east) down to the Thwackwort Trial.
 */
export const CLASSROOM: LevelDef = {
  id: 'classroom',
  name: 'Practical Charms',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromTrial: { pos: [6.3, 0, 11.2], yaw: -Math.PI / 2 },
  },
  areas: [{ id: 'classroom', name: 'Practical Charms', min: [-8, -2, 0], max: [8, 8, 14] }],
  intro: { script: 'gorseLesson', unlessFlag: 'lesson-started' },
  build,
};

function build(b: LevelBuilder): void {
  const glow = new Glow();
  const H = 7;
  b.floor(-8.5, 8.5, -0.5, 14.5, { color: '#8a6a4a' });
  // Planks for the floor, stone for the walls.
  b.box([0, 0.01, 7], [16, 0.02, 14], { color: '#9a7350', pattern: 'planks', noCollide: true });
  wall(b, 'x', -0.5, -8.5, 8.5, H, { holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 14.5, -8.5, 8.5, H);
  wall(b, 'z', -8.5, 0, 14, H);
  wall(b, 'z', 8.5, 0, 14, H, { holes: [{ from: 9.9, to: 12.5, top: 3.5 }] });
  slab(b, -8.5, 8.5, -0.5, 14.5, H + 0.5, 0.5, '#5e4a3e', 'planks');
  for (let z = 2; z < 14; z += 4) deco(b, new BoxGeometry(17, 0.4, 0.4), [0, H - 0.2, z], COLORS.woodDark);

  // Doors: back to the corridor, and the iron door down to the Trial.
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'hub', spawn: 'fromClassroom' }, lockedDuring: 'thwackwort', talk: 'classNotOver' },
    {
      type: 'door',
      pos: [8.0, 0, 11.2],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'trial', spawn: 'default' },
      lockedUnless: 'practice-done',
      talk: 'lockedTrialDoor',
      label: 'The Trial',
    },
  );

  // Blackboard.
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 280;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f4a3a';
  g.fillRect(0, 0, 768, 280);
  g.strokeStyle = '#8a5a36';
  g.lineWidth = 16;
  g.strokeRect(0, 0, 768, 280);
  g.fillStyle = 'rgba(240,240,230,0.9)';
  g.font = 'bold 54px Palatino, Georgia, serif';
  g.fillText('THWACKWORT', 40, 80);
  g.font = 'italic 34px Palatino, Georgia, serif';
  g.fillText('1. Point   2. Flick   3. SHOVE!', 40, 140);
  g.fillText('(hold for oomph)', 40, 190);
  g.strokeStyle = 'rgba(240,240,230,0.8)';
  g.lineWidth = 4;
  g.strokeRect(560, 120, 70, 70);
  g.beginPath();
  g.moveTo(520, 155);
  g.lineTo(555, 155);
  g.moveTo(545, 145);
  g.lineTo(555, 155);
  g.lineTo(545, 165);
  g.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const board = new Mesh(new PlaneGeometry(6, 2.2), new MeshBasicMaterial({ map: tex, fog: true }));
  board.position.set(0, 2.8, 13.97);
  board.rotation.y = Math.PI;
  b.prop(board);

  // Desks and stools.
  for (const x of [-3.6, 3.6]) {
    for (const z of [4, 7.2]) {
      b.box([x, 0.8, z], [2.6, 0.1, 1], { color: COLORS.wood, pattern: 'planks' });
      for (const dx of [-1.15, 1.15]) for (const dz of [-0.4, 0.4]) deco(b, new BoxGeometry(0.1, 0.75, 0.1), [x + dx, 0.38, z + dz], COLORS.woodDark);
      for (const dx of [-0.6, 0.6]) b.cylinder([x + dx, 0.25, z - 0.9], 0.22, 0.5, COLORS.woodDark, undefined, 6, 'planks');
    }
  }
  // Teacher's desk.
  b.box([0, 0.55, 9.6], [3, 1.1, 1.1], { color: COLORS.woodDark, pattern: 'planks' });
  deco(b, new BoxGeometry(0.5, 0.35, 0.4), [-0.8, 1.28, 9.6], '#7a2f3a');

  // Gorse himself.
  b.add({
    type: 'npc',
    speaker: 'gorse',
    pos: [0, 0, 11.6],
    yaw: Math.PI,
    look: { robe: '#a0522d', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#5e3b22', hatStyle: 'none', hair: '#e8e2d0', hairStyle: 'bald', beard: true, skin: '#e2a982', scale: 1.3 },
    talk: 'gorse',
  });

  // Practice targets: two on stands, one up on the wall. All three unlock the iron door.
  b.add(
    { type: 'knockSwitch', id: 'p1', pos: [-5.6, 1.6, 9.8], yaw: Math.PI, style: 'target', latch: true },
    { type: 'knockSwitch', id: 'p2', pos: [5.6, 1.6, 9.8], yaw: Math.PI, style: 'target', latch: true },
    { type: 'knockSwitch', id: 'p3', pos: [0, 4.9, 13.75], yaw: Math.PI, latch: true },
    { type: 'trigger', flag: 'practice-trigger', script: 'practiceDone', when: ['p1', 'p2', 'p3'] },
  );

  // Shelves, windows, portraits, light.
  shelf(b, [-7.7, 0, 4], Math.PI / 2, 2.6, 3.4);
  shelf(b, [-7.7, 0, 7], Math.PI / 2, 2.6, 3.4);
  shelf(b, [7.7, 0, 4], -Math.PI / 2, 2.6, 3.4);
  for (const z of [3, 7, 11]) {
    windowPane(b, glow, 'z', -8.5, z, 5, 1.4, 2.8, 1);
    lightShaft(b, [-7.95, 5.3, z], [0.85, -0.65, 0.2], 8, 1.3, 0.18);
  }
  dustMotes(b, [-7.5, 0.5, 1], [7.5, 6.5, 13.5], 90);
  // Clutter: books and inkpots on the desks, a runner up the aisle, a cauldron, plants, cobwebs.
  rug(b, [0, 0, 5.2], 2.2, 7.6, '#5d4470', '#c99a3e');
  let seed = 20;
  for (const x of [-3.6, 3.6]) {
    for (const z of [4, 7.2]) {
      bookStack(b, [x - 0.7, 0.85, z + 0.15], 2 + (seed % 3), seed++);
      deco(b, new BoxGeometry(0.5, 0.01, 0.36), [x + 0.5, 0.855, z], '#f3ead8', [0, 0.2, 0]);
      deco(b, new CylinderGeometry(0.05, 0.06, 0.08, 6), [x + 0.95, 0.89, z - 0.2], '#1b1b22');
      deco(b, new CylinderGeometry(0.006, 0.01, 0.3, 4), [x + 0.98, 1.0, z - 0.2], '#f3ead8', [0.3, 0, -0.3]);
    }
  }
  bookStack(b, [0.7, 1.1, 9.5], 4, 31);
  candlestick(b, glow, [1.2, 1.1, 9.8], 0.22);
  cauldron(b, [-6.8, 0, 12.8], 0.55);
  for (const x of [-7.3, 7.3]) pottedPlant(b, [x, 0, 0.8], 1.3, x);
  for (const [c, d1, d2] of [
    [[-8, H - 0.5, 0], [1, 0], [0, 1]],
    [[8, H - 0.5, 0], [-1, 0], [0, 1]],
    [[-8, H - 0.5, 14], [1, 0], [0, -1]],
    [[8, H - 0.5, 14], [-1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.1);
  }
  portrait(b, CARD_BY_ID.get('barnaby-gorse')!.portrait, [7.95, 3.6, 7], -Math.PI / 2, 1.2, 1.5, 0.05);
  b.lantern([-4, 5.6, 6], 10, 14);
  b.lantern([4, 5.6, 9], 10, 14);
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [-6.5, 0.6, 2], to: [-6.5, 0.6, 12], count: 5 });

  glow.finish(b, '#ffc68a');
  b.finish();
}
