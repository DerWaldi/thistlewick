import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import {
  armour,
  barrel,
  bench,
  bookStack,
  bush,
  candlestick,
  cauldron,
  cobweb,
  ivy,
  mushrooms,
  pottedPlant,
  rug,
  table,
  urn,
  banner,
  chandelier,
  column,
  crate,
  deco,
  dustMotes,
  Glow,
  grass,
  hollyhock,
  lightShaft,
  portrait,
  shelf,
  signboard,
  slab,
  tree,
  wall,
  windowPane,
} from '../../world/props';
import { CARD_BY_ID } from '../cards';
import { HOUSE_ORDER, HOUSES } from '../houses';

/**
 * The castle hub. Map (metres, +Z north, floor at y=0):
 *
 *   Hollyhock Court     x -16..16, z 30..62   open sky, cloister (roof walkable at y=5), fountain,
 *                                              clock tower on the north wall
 *   Lantern Hall        x -12..12, z 0..30    grand stair to a gallery (y=5, z 21..30), hourglasses
 *   Crumbleton's Cupboard x -18..-12, z 4..12 the shop (west door of the hall)
 *   Crooked Corridor    x 12..42, z 5..23     east from the hall, north, then east up stairs
 *                                              (y=3) to Gorse's classroom door
 *
 * Secrets: tapestry alcove (hall), sliding bookshelf (corridor, needs Thwackwort),
 * behind the clock (court, a climb).
 */
export const HUB: LevelDef = {
  id: 'hub',
  name: 'Thistlewick Castle',
  spawns: {
    default: { pos: [0, 0, 3.5], yaw: 0 },
    start: { pos: [0, 0, 3.5], yaw: 0 },
    title: { pos: [0, 0, 3.5], yaw: 0 },
    fromClassroom: { pos: [38.5, 3, 20], yaw: -Math.PI / 2 },
  },
  areas: [
    { id: 'hall', name: 'The Lantern Hall', min: [-12, -2, 0], max: [12, 14, 30] },
    { id: 'hall', name: 'The Lantern Hall', min: [-16, -2, 21], max: [-12, 6, 26] },
    { id: 'cupboard', name: "Crumbleton's Cupboard", min: [-18.5, -2, 4], max: [-12, 6, 12] },
    { id: 'corridor', name: 'The Crooked Corridor', min: [12, -2, 5], max: [42, 12, 23] },
    { id: 'corridor', name: 'The Crooked Corridor', min: [18.5, -2, 10], max: [21.5, 4, 13.5] },
    { id: 'court', name: 'Hollyhock Court', min: [-17, -3, 30], max: [17, 30, 66] },
  ],
  intro: { script: 'intro', unlessFlag: 'greeted' },
  build: buildHub,
};

// ---------------------------------------------------------------- the castle

function buildHub(b: LevelBuilder): void {
  b.killY = -20;
  const glow = new Glow();
  const candle = new Glow();

  // ================================================================ floors
  b.floor(-18.5, 42, 0, 30, { color: '#b8a088' }); // hall, cupboard, corridor ground
  b.floor(-16.5, 16.5, 30, 64.5, { color: '#a99476', holes: [[-5, 5, 41, 51]] });

  // ================================================================ LANTERN HALL (x -12..12, z 0..30)
  const HH = 12;
  wall(b, 'x', -0.5, -12.5, 12.5, HH); // south
  wall(b, 'z', -12.5, 0, 30, HH, {
    holes: [
      { from: 7, to: 9.2, top: 3 }, // to the Cupboard
      { from: 22.5, to: 24.5, top: 3 }, // behind the tapestry
    ],
  });
  wall(b, 'z', 12.5, 0, 30, HH, { holes: [{ from: 6, to: 10, top: 4.5 }] }); // to the corridor
  wall(b, 'x', 30.5, -12.5, 12.5, HH, {
    holes: [
      { from: -2, to: 2, top: 4.5 }, // to the court
      { from: 8, to: 10, bottom: 4.98, top: 8 }, // gallery door onto the cloister roof (sill just under the roof, no z-fighting)
    ],
  });
  slab(b, -12.5, 12.5, 0, 30.5, HH + 0.6, 0.6, '#5e4a3e', 'planks');
  for (let z = 4; z < 30; z += 5) deco(b, new BoxGeometry(24, 0.5, 0.5), [0, HH - 0.25, z], COLORS.woodDark);
  // Carpet runner from the doors to the stairs.
  deco(b, new BoxGeometry(3, 0.03, 12.5), [0, 0.015, 6.5], COLORS.carpet);
  deco(b, new BoxGeometry(3.4, 0.025, 12.7), [0, 0.012, 6.5], '#c99a3e');

  // Grand staircase up to the gallery.
  b.stairs([0, 0, 13], 0, 16, 0.3125, 0.5, 6, COLORS.stoneLight);
  // Banisters.
  for (const side of [-1, 1]) {
    b.ramp([side * 3.15, 0, 12.8], Math.hypot(8.2, 5.1), 0.3, (Math.atan2(5.1, 8.2) * 180) / Math.PI, 0, COLORS.woodDark);
    b.box([side * 3.15, 0.55, 12.8], [0.35, 1.1, 0.35], { color: COLORS.woodDark, pattern: 'planks' });
  }

  // Gallery (y=5) along the north wall.
  slab(b, -12, 12, 21, 30, 5, 0.5, '#8a6a4a', 'planks');
  for (const x of [-12, 3]) b.box([x + 4.5, 5.5, 21.1], [9, 1, 0.25], { color: COLORS.woodDark, pattern: 'planks' });
  for (const x of [-8, -4, 4, 8]) column(b, x, 21.4, 4.5);

  // Hourglasses, the Sorting Lantern and the headmistress.
  b.add(
    { type: 'hourglasses', pos: [-10, 0, 13], yaw: Math.PI / 2 },
    { type: 'sortingLantern', pos: [-6.5, 0, 9], yaw: Math.PI / 2 },
    { type: 'npc', speaker: 'wendlebury', pos: [3, 0, 7], yaw: -Math.PI / 2 - 0.4, look: { robe: '#5d4470', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#3b2c55', hair: '#e8e8e8', hairStyle: 'bun', glasses: true, scale: 1.25 }, talk: 'wendlebury' },
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 4, height: 5.5, talk: 'frontDoors' },
  );

  // House banners on the east wall, windows on both long walls.
  HOUSE_ORDER.forEach((h, i) => banner(b, [11.95, 7.5, 3 + i * 4], -Math.PI / 2, HOUSES[h].color, HOUSES[h].trim));
  for (const z of [4, 10, 16]) {
    windowPane(b, glow, 'z', -12.5, z, 8, 1.6, 3.6, 1);
    lightShaft(b, [-11.9, 8.4, z], [0.85, -0.8, 0.25], 13, 1.5, 0.16);
  }
  dustMotes(b, [-11, 0.5, 1], [11, 10, 28], 170);
  for (const z of [18.5]) windowPane(b, glow, 'z', 12.5, z, 8, 1.6, 3.6, -1);
  portrait(b, CARD_BY_ID.get('pellam-fogg')!.portrait, [-11.95, 2.8, 15], Math.PI / 2, 1.4, 1.8, 0.04);
  portrait(b, CARD_BY_ID.get('agnes-thistlewick')!.portrait, [-11.95, 2.8, 18.5], Math.PI / 2, 1.2, 1.5, -0.05);
  portrait(b, { bg: ['#d8c4a4', '#8a6a4a'], kind: 'person', skin: '#e8b48e', robe: '#2f5a6a', hair: '#3a2617', hat: 'tall', hatColor: '#2b1d14' }, [11.95, 2.8, 22], -Math.PI / 2, 1.2, 1.5, 0.06);

  // Chandeliers. The west one's top is reachable from the gallery and has a card on it.
  chandelier(b, candle, -7, 6, 18.4, 1.6, true);
  chandelier(b, candle, 7, 6, 18.4, 1.6, false);
  chandelier(b, candle, 0, 8.5, 7, 2, true);
  b.add(
    { type: 'card', card: 'lantern-moth', pos: [-7, 6.75, 18.4] },
    { type: 'sweetLine', kind: 'bramble', from: [6.2, 6.6, 18.4], to: [7.8, 6.6, 18.4], count: 2 },
  );

  // Gallery climb to the high west window: crate -> bookshelf top -> grab the sill.
  crate(b, [-9.5, 5, 26.5], 1);
  shelf(b, [-10.6, 5, 27.6], Math.PI / 2, 2.4, 2);
  // Window bay: a stone buttress whose top (y=9.05) is the sill, flush so it can be grabbed.
  b.box([-11.45, 7.9, 27.6], [1.1, 2.3, 2.6], { color: COLORS.stoneLight });
  windowPane(b, glow, 'z', -12.5, 27.6, 10.6, 1.4, 2.6, 1);
  b.add({ type: 'card', card: 'pellam-fogg', pos: [-11.45, 9.75, 27.6] });

  // Gallery decor: shelves along the north wall, the door onto the cloister roof.
  for (const x of [-6, -2.5, 1, 4.5]) shelf(b, [x, 5, 29.6], Math.PI, 3, 3.2);
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [-6, 5.6, 24], to: [6, 5.6, 24], count: 7 });

  // Secret 1: the swaying tapestry in the west wall hides an alcove.
  b.add({ type: 'tapestry', pos: [-11.95, 0.05, 23.5], yaw: Math.PI / 2, width: 2.2, height: 3.2, color: '#8a2a3a', trim: '#e8c25a', sway: true });
  b.add({ type: 'tapestry', pos: [-11.95, 0.6, 3], yaw: Math.PI / 2, width: 2.2, height: 3.6, color: '#2f5a6a', trim: '#e6eef5' });
  b.add({ type: 'tapestry', pos: [11.95, 0.6, 26], yaw: -Math.PI / 2, width: 2.2, height: 3.6, color: '#3f7a4a', trim: '#efe3c0' });
  wall(b, 'x', 21, -16.5, -12.5, 3.5, { thick: 1 });
  wall(b, 'x', 26, -16.5, -12.5, 3.5, { thick: 1 });
  wall(b, 'z', -16.5, 21, 26, 3.5, { thick: 1 });
  slab(b, -16.5, -12.5, 21, 26, 3.8, 0.4, COLORS.stoneDark);
  b.add(
    { type: 'card', card: 'mother-wortle', pos: [-15, 1.2, 23.5] },
    { type: 'secret', id: 'hub-tapestry', area: 'hall', min: [-16, -1, 21.5], max: [-13, 3, 25.5] },
    { type: 'sweetLine', kind: 'bramble', from: [-15.5, 0.5, 22.3], to: [-15.5, 0.5, 24.7], count: 3 },
  );
  b.lantern([-14.5, 2.7, 23.5], 0, 0, false);

  // Hall furnishings: a long table with benches, rugs, plants by the doors, urns at the
  // stair foot, armour under the gallery, a reading desk upstairs and cobwebs up high.
  // North of the corridor arch (z 6..10), so the way east stays clear.
  table(b, candle, [8.6, 0, 14.8], Math.PI / 2, 6, 1.4, 4);
  bench(b, [7.3, 0, 14.8], Math.PI / 2, 5.2);
  bench(b, [9.9, 0, 14.8], Math.PI / 2, 5.2);
  // Centred on the hourglass row (z 10.6..15.4), clear of the Sorting Lantern.
  rug(b, [-7.3, 0, 13], 3.2, 5.8, '#2f5a6a', '#c99a3e');
  rug(b, [0, 0, 25.5], 6, 3.6, '#5d4470', '#c99a3e');
  for (const x of [-3.3, 3.3]) pottedPlant(b, [x, 0, 1.1], 1.2, x > 0 ? 2 : 3);
  for (const [x, z] of [
    [-11.2, 0.9],
    [11.2, 0.9],
    [11.2, 29.2],
  ]) {
    pottedPlant(b, [x, 0, z], 1.4, x * z);
  }
  for (const x of [-3.9, 3.9]) urn(b, [x, 0, 13.6], true, x > 0 ? 5 : 6);
  armour(b, [-4.6, 0, 29.3], Math.PI, '#8a2a3a');
  armour(b, [4.6, 0, 29.3], Math.PI, '#2f5a6a');
  b.box([-1.5, 5.8, 27.6], [1.8, 0.08, 0.8], { color: COLORS.wood, pattern: 'planks' });
  for (const x of [-2.25, -0.75]) deco(b, new BoxGeometry(0.1, 0.76, 0.6), [x, 5.38, 27.6], COLORS.woodDark);
  b.box([-1.5, 5.4, 27.6], [1.4, 0.8, 0.5], { invisible: true });
  bookStack(b, [-2.1, 5.84, 27.5], 5, 3);
  bookStack(b, [-1.1, 5.84, 27.7], 3, 8);
  candlestick(b, candle, [-1.6, 5.84, 27.85], 0.2);
  for (const [c, d1, d2] of [
    [[-12, HH - 0.6, 0], [1, 0], [0, 1]],
    [[12, HH - 0.6, 0], [-1, 0], [0, 1]],
    [[12, HH - 0.6, 30], [-1, 0], [0, -1]],
    [[-12, HH - 0.6, 30], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.6);
  }

  // ================================================================ CRUMBLETON'S CUPBOARD (x -18..-12, z 4..12)
  wall(b, 'x', 3.5, -18.5, -12.5, 3.5);
  wall(b, 'x', 12.5, -18.5, -12.5, 3.5);
  wall(b, 'z', -18.5, 3.5, 12.5, 3.5);
  slab(b, -18.5, -12.5, 3.5, 12.5, 3.9, 0.4, COLORS.woodDark, 'planks');
  b.box([-15.6, 0.55, 8], [0.8, 1.1, 6], { color: COLORS.wood, pattern: 'planks' }); // counter
  shelf(b, [-17.9, 0, 6], Math.PI / 2, 2.6, 2.8);
  shelf(b, [-17.9, 0, 10], Math.PI / 2, 2.6, 2.8);
  for (let i = 0; i < 9; i++) {
    const colors = ['#4fd6c0', '#a24fd0', '#f5c04a'];
    deco(b, new CylinderGeometry(0.13, 0.13, 0.3, 8), [-15.6 + ((i % 3) - 1) * 0.2, 1.25, 5.6 + i * 0.6], colors[i % 3]);
  }
  b.add(
    { type: 'npc', speaker: 'tansy', pos: [-16.8, 0, 6.6], yaw: Math.PI / 2, look: { robe: '#46395f', scarf: HOUSES.yarrowdown.color, trim: HOUSES.yarrowdown.trim, hat: '#c8642e', hatStyle: 'none', hair: '#c8642e', hairStyle: 'long', skin: '#f3d2b4' }, talk: 'tansy' },
    { type: 'npc', speaker: 'moss', pos: [-16.8, 0, 9.4], yaw: Math.PI / 2, look: { robe: '#46395f', scarf: HOUSES.nettleby.color, trim: HOUSES.nettleby.trim, hat: '#6b3f4f', hatStyle: 'cap', hair: '#c8642e', hairStyle: 'wild', skin: '#f3d2b4' }, talk: 'moss' },
  );
  barrel(b, [-13.5, 0, 4.5]);
  barrel(b, [-14.35, 0, 4.42], 0.32, 0.8);
  crate(b, [-13.5, 0, 11.5], 0.8);
  crate(b, [-13.55, 0.8, 11.55], 0.5);
  cauldron(b, [-17.6, 0, 8], 0.4);
  bookStack(b, [-15.5, 1.1, 10.6], 4, 11);
  bookStack(b, [-15.7, 1.1, 4.9], 3, 12);
  cobweb(b, [-18, 3.6, 4], [1, 0], [0, 1], 0.9);
  cobweb(b, [-13, 3.6, 12], [-1, 0], [0, -1], 0.7);
  const shopLight = new PointLight('#ffc070', 8, 9, 1.6);
  shopLight.position.set(-14.5, 3, 8);
  b.prop(shopLight);
  signboard(b, "Crumbleton's Cupboard", [-11.9, 3.6, 8.1], Math.PI / 2);

  // ================================================================ CROOKED CORRIDOR
  const CH = 5;
  // Leg 1: east from the hall (x 12.5..26, z 6..10).
  wall(b, 'x', 5.5, 12.5, 26.5, CH);
  wall(b, 'x', 10.5, 12.5, 22, CH, { holes: [{ from: 19, to: 21, top: 2.6 }] });
  slab(b, 12.5, 26.5, 5, 11, CH + 0.4, 0.4, '#5e4a3e', 'planks');
  // Leg 2: north (x 22..26, z 10..18).
  wall(b, 'z', 21.5, 10.5, 17.5, CH);
  wall(b, 'z', 26.5, 5, 17.5, CH);
  slab(b, 21, 27, 10.5, 17.5, CH + 0.4, 0.4, '#5e4a3e', 'planks');
  // Leg 3: east and up (x 22..42, z 18..22), stairs x 28..34 to y=3.
  wall(b, 'x', 23.5, 21, 42.5, 9);
  wall(b, 'x', 17.5, 26.5, 42.5, 9);
  wall(b, 'z', 21.5, 17.5, 23.5, 9);
  wall(b, 'z', 42.5, 17.5, 23.5, 9);
  slab(b, 21, 43, 17, 24, 9.4, 0.4, '#5e4a3e', 'planks');
  b.stairs([28, 0, 20.5], Math.PI / 2, 10, 0.3, 0.6, 5, COLORS.stoneLight);
  b.box([38.25, 1.5, 20.5], [8.5, 3, 5], { color: COLORS.stone }); // landing (top at y=3)
  // Crooked touches: a sagging beam, a couple of uneven flagstones (step-up height).
  deco(b, new BoxGeometry(14, 0.4, 0.4), [19, CH - 0.3, 8], COLORS.woodDark, [0, 0, 0.04]);
  b.box([16, 0.1, 8], [1.6, 0.2, 2.4], { color: COLORS.stoneLight });
  b.box([24, 0.12, 14], [3, 0.24, 1.6], { color: COLORS.stoneLight });

  // Bookshelves line the corridor (one of them is a door).
  for (const x of [14, 16.6]) shelf(b, [x, 0, 9.65], Math.PI, 2.4, 3.2);
  for (const x of [14, 16.6, 22]) shelf(b, [x, 0, 6.35], 0, 2.4, 3.2);
  shelf(b, [19.3, 0, 6.35], 0, 2.4, 3.2);
  b.add(
    // The secret door: slides west into the wall when the odd book on the shelf beside it is knocked.
    { type: 'bookshelf', pos: [20, 0, 10.25], yaw: Math.PI, width: 2, height: 2.6, slide: 2.1, when: ['cc-book'] },
    { type: 'knockSwitch', id: 'cc-book', pos: [17.4, 1.95, 9.45], yaw: Math.PI, style: 'book' },
  );
  wall(b, 'x', 13.5, 18.5, 21.5, 3.2, { thick: 1 });
  wall(b, 'z', 18.5, 10.5, 13.5, 3.2, { thick: 1 });
  // Ends inside the corridor wall (x 21..22) rather than flush with its face, which z-fought.
  slab(b, 18, 21.5, 10.5, 14, 3.4, 0.4, COLORS.stoneDark);
  b.add(
    { type: 'card', card: 'barnaby-gorse', pos: [20, 1.2, 12.2] },
    { type: 'secret', id: 'hub-bookshelf', area: 'corridor', min: [19, -1, 10.8], max: [21, 3, 13.2] },
  );
  portrait(b, CARD_BY_ID.get('barnaby-gorse')!.portrait, [25.95, 2.6, 13], -Math.PI / 2, 1.1, 1.4, -0.08);
  portrait(b, CARD_BY_ID.get('hester-quillfeather')!.portrait, [32, 4.6, 22.95], Math.PI, 1.1, 1.4, 0.07);
  rug(b, [21.6, 0, 8], 7, 1.7, '#8a2a3a', '#3a2617');
  rug(b, [24, 0, 16.5], 1.7, 2.4, '#3f7a4a', '#c99a3e');
  barrel(b, [22.4, 0, 22.6]);
  crate(b, [23.3, 0, 22.55], 0.8);
  pottedPlant(b, [25.6, 0, 17.2], 1.1, 7);
  bench(b, [37.4, 3, 22.75], 0, 2.4);
  pottedPlant(b, [41.55, 3, 22.55], 1.2, 9);
  armour(b, [35, 3, 18.5], 0, '#c99a3e');
  for (const [c, d1, d2] of [
    [[13, CH - 0.2, 6], [1, 0], [0, 1]],
    [[26, CH - 0.2, 6], [-1, 0], [0, 1]],
    [[42, 8.6, 23], [-1, 0], [0, -1]],
    [[22, 8.6, 23], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1);
  }
  b.lantern([13.2, 3.4, 8], 6, 10);
  b.lantern([25.6, 3.6, 13.5], 0, 0, false);
  b.lantern([36, 6.4, 18.2], 7, 12);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [14, 0.6, 8], to: [24, 0.6, 8], count: 8 },
    { type: 'sweetLine', kind: 'fizzwort', from: [24, 0.6, 11.5], to: [24, 0.6, 16.5], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [28.5, 0.9, 20.5], to: [33.5, 3.6, 20.5], count: 5 },
    {
      type: 'door',
      pos: [42, 3, 20.5],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'classroom', spawn: 'default' },
      lockedUnless: 'sorted',
      talk: 'classroomDoor',
      label: 'Practical Charms',
    },
    { type: 'checkpoint', pos: [40.5, 3, 18.5], yaw: 0, zone: { min: [34, 2, 18], max: [42, 7, 23] } },
  );

  // ================================================================ HOLLYHOCK COURT (x -16..16, z 30..62)
  const W = 8;
  // Side walls are too tall to climb from the cloister roof; the north wall's top is a
  // walkway (with a parapet) that leads behind the clock tower.
  wall(b, 'z', -16.5, 30, 64, 10.5, { cap: 8 });
  wall(b, 'z', 16.5, 30, 64, 10.5, { holes: [{ from: 44.5, to: 47.5, top: 3.5 }], cap: 8 });
  wall(b, 'x', 63, -16, 16, W, { thick: 2 });
  b.box([0, W + 0.55, 63.85], [32, 1.1, 0.3], { color: COLORS.stoneLight });
  // Keep people on the walkway: an invisible screen above the parapet.
  b.box([0, W + 5, 63.85], [32, 8, 0.3], { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  for (let x = -15; x <= 15; x += 2) deco(b, new BoxGeometry(0.8, 0.4, 0.32), [x, W + 1.3, 63.85], COLORS.stoneLight);
  // Grass beds and paths.
  for (const [x0, x1, z0, z1] of [
    [-12, -6, 35, 57],
    [6, 12, 35, 57],
    [-6, 6, 53, 57],
    [-6, 6, 35, 39],
  ]) {
    deco(b, new BoxGeometry(x1 - x0, 0.06, z1 - z0), [(x0 + x1) / 2, 0.03, (z0 + z1) / 2], '#7f9a5a');
    grass(b, x0 + 0.2, x1 - 0.2, z0 + 0.2, z1 - 0.2, 0.06, 2.6);
  }
  // Cloister: covered walk on all four sides (roof walkable at y=5).
  const R = 5;
  slab(b, -16, 16, 30, 33.5, R, 0.5, COLORS.slate); // south (along the hall)
  slab(b, -16, -12.5, 33.5, 62, R, 0.5, COLORS.slate); // west
  slab(b, 12.5, 16, 33.5, 62, R, 0.5, COLORS.slate); // east
  slab(b, -12.5, 12.5, 58.5, 62, R, 0.5, COLORS.slate); // north
  for (let x = -12; x <= 12; x += 4) {
    if (Math.abs(x) > 1) column(b, x, 33.5, 4.5);
    column(b, x, 58.5, 4.5);
  }
  for (let z = 37.5; z <= 54.5; z += 4) {
    column(b, -12.5, z, 4.5);
    column(b, 12.5, z, 4.5);
  }
  // Roof trim.
  for (const [x, z, w, d] of [
    [0, 33.6, 25.4, 0.3],
    [0, 58.4, 25.4, 0.3],
    [-12.6, 46, 0.3, 25],
    [12.6, 46, 0.3, 25],
  ]) {
    deco(b, new BoxGeometry(w, 0.35, d), [x, R + 0.17, z], COLORS.stoneLight);
  }

  // Fountain: a deep pool with an island you can't jump to (yet).
  b.pool(-5, 5, 41, 51, -0.35, -1.6);
  for (const [x, z, w, d] of [
    [0, 40.75, 10.5, 0.5],
    [0, 51.25, 10.5, 0.5],
    [-5.25, 46, 0.5, 10],
    [5.25, 46, 0.5, 10],
  ]) {
    b.box([x, 0.2, z], [w, 0.4, d], { color: COLORS.stoneLight });
  }
  b.cylinder([0, -0.7, 46], 0.6, 1.8, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.25, 0.4, 1.2, 8), [0, 0.8, 46], COLORS.stoneLight);
  deco(b, new CylinderGeometry(0.8, 0.5, 0.3, 10), [0, 1.5, 46], COLORS.stoneLight);
  b.add(
    { type: 'sweet', kind: 'humbug', pos: [0, 2.1, 46] },
    { type: 'teaser', spell: 'rimewhistle', prop: 'marker', pos: [0, 0.4, 42.2], yaw: 0 },
  );

  // Vine-choked arch in the east wall (Cindersnap), a mossy pad on the west roof under an
  // unreachable balcony (Springwell), and a locked chest (Latchkin).
  b.add(
    { type: 'teaser', spell: 'cindersnap', prop: 'vines', pos: [16, 0, 46], yaw: -Math.PI / 2 },
    { type: 'springPad', pos: [-14.2, R, 47], radius: 1.1 },
    { type: 'teaser', spell: 'latchkin', prop: 'chest', pos: [-14.2, 0, 60], yaw: Math.PI / 2, id: 'hub-court-chest' },
  );
  b.box([-14.75, 9.1, 52], [2.5, 0.4, 4], { color: COLORS.stoneLight }); // balcony
  b.box([-13.6, 9.8, 52], [0.2, 1, 4], { color: COLORS.woodDark, pattern: 'planks' });
  deco(b, new BoxGeometry(0.1, 3, 1.8), [-16, 10.8, 52], COLORS.woodDark);

  // The clock tower on the north wall; behind it, a ledge with a card (secret 3).
  b.box([0, 11, 61.8], [4.4, 6, 1.6], { color: COLORS.stoneLight });
  deco(b, new ConeGeometry(3.2, 3.5, 4), [0, 15.75, 61.8], COLORS.roof, [0, Math.PI / 4, 0]);
  const clock = new Group();
  const face = new Mesh(new CylinderGeometry(1.4, 1.4, 0.15, 24), new MeshStandardMaterial({ color: '#f3e4c4', roughness: 0.6 }));
  face.rotation.x = Math.PI / 2;
  const rim = new Mesh(new TorusGeometry(1.42, 0.1, 6, 24), new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.6, roughness: 0.4 }));
  const hand1 = new Mesh(new BoxGeometry(0.08, 1, 0.05), new MeshStandardMaterial({ color: '#2b1d14' }));
  hand1.position.set(0.25, 0.35, 0.1);
  hand1.rotation.z = -0.6;
  const hand2 = new Mesh(new BoxGeometry(0.08, 0.7, 0.05), new MeshStandardMaterial({ color: '#2b1d14' }));
  hand2.position.set(-0.2, 0.15, 0.1);
  hand2.rotation.z = 1.1;
  clock.add(face, rim, hand1, hand2);
  clock.position.set(0, 11.5, 60.95);
  b.prop(clock);
  crate(b, [-6, R, 60.3], 1.2);
  b.add(
    { type: 'card', card: 'grey-lady', pos: [0, 8.9, 63.15] },
    { type: 'secret', id: 'hub-clock', area: 'court', min: [-2.2, 7.5, 62.6], max: [2.2, 11, 63.7] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-12, 8.6, 62.8], to: [-4, 8.6, 62.8], count: 6 },
    { type: 'sweetLine', kind: 'bramble', from: [14.2, 5.6, 36], to: [14.2, 5.6, 56], count: 4 },
  );

  // Gardens: hollyhocks along the beds, a crooked old tree, benches.
  let seed = 1;
  for (let z = 36; z <= 56; z += 1.6) {
    hollyhock(b, -11.4 + Math.sin(z) * 0.2, z, seed++);
    hollyhock(b, 11.4 + Math.cos(z) * 0.2, z, seed++);
  }
  for (let x = -5; x <= 5; x += 1.4) hollyhock(b, x, 56.4, seed++);
  tree(b, -8.5, 37.5);
  for (const [x, z, r] of [
    [8, 37.5, 0],
    [-8.5, 55, 0],
  ]) {
    b.box([x, 0.45, z], [2.4, 0.15, 0.7], { color: COLORS.wood, pattern: 'planks' });
    deco(b, new BoxGeometry(0.2, 0.45, 0.6), [x - 1, 0.22, z], COLORS.woodDark, [0, r, 0]);
    deco(b, new BoxGeometry(0.2, 0.45, 0.6), [x + 1, 0.22, z], COLORS.woodDark, [0, r, 0]);
  }
  // Pots under the cloister, bushes and toadstools in the beds, ivy up the walls.
  for (const [x, z] of [
    [-14.6, 34.6],
    [14.6, 34.6],
    [14.6, 60.4],
  ]) {
    pottedPlant(b, [x, 0, z], 1.3, x + z);
  }
  for (const [x, z] of [
    [-7, 42],
    [-10.6, 46.5],
    [7.2, 50.5],
    [10.6, 41],
    [-4, 55],
    [4, 37],
  ]) {
    bush(b, x, z, 1, x * 3 + z, 0.06);
  }
  mushrooms(b, -9.4, 38.6, 5, 2, 0.06);
  mushrooms(b, 9.2, 54.2, 4, 7, 0.06);
  mushrooms(b, -7.2, 49, 3, 9, 0.06);
  ivy(b, 'z', -16, 34, 44, 0.2, 7, 1, 1);
  ivy(b, 'z', -16, 54, 61, 0.2, 5, 1, 2);
  ivy(b, 'z', 16, 34, 43, 0.2, 6, -1, 3);
  ivy(b, 'z', 16, 49, 61, 0.2, 7.5, -1, 4);
  ivy(b, 'x', 62, -12, -4, 0.2, 4.5, -1, 5);
  ivy(b, 'x', 62, 4, 12, 0.2, 4.5, -1, 6);
  b.add(
    { type: 'gnarling', pos: [-9, 0, 50], wander: 3, requires: 'thwackwort' },
    { type: 'gnarling', pos: [9, 0, 44], wander: 3, requires: 'thwackwort' },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 32], to: [0, 0.6, 39.5], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 0.6, 40], to: [-8, 0.6, 52], count: 6 },
    { type: 'sweetLine', kind: 'fizzwort', from: [8, 0.6, 48], to: [8, 0.6, 56], count: 5 },
    { type: 'checkpoint', pos: [3.5, 0, 32.5], yaw: 0, zone: { min: [-5, -1, 31], max: [5, 4, 34] } },
  );
  for (const [x, z] of [
    [-12.5, 35.5],
    [12.5, 35.5],
    [-12.5, 56.5],
    [12.5, 56.5],
  ]) {
    b.lantern([x, 3.8, z], 0, 0, false);
  }

  glow.finish(b, '#ffc68a');
  candle.finish(b, '#ffe2a0');
  b.finish();
}
