import { BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, SphereGeometry, SRGBColorSpace, TorusGeometry } from 'three';
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
  rubble,
  rug,
  table,
  urn,
  wallTorch,
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
import type { PortraitSpec } from '../portraits';
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
 *   Long Gallery        x 35..42, z 24..52    (y=3) north off the corridor landing, behind a
 *                                              portcullis (Thwackwort the winch); portraits, a
 *                                              padlocked store-room (east), Quince's door (north)
 *
 * Secrets: tapestry alcove (hall), sliding bookshelf (corridor, needs Thwackwort),
 * behind the clock (court, a climb), the gallery store-room (needs Latchkin).
 * Latchkin also opens the court chest and the hall cabinet (cards).
 */
export const HUB: LevelDef = {
  id: 'hub',
  name: 'Thistlewick Castle',
  spawns: {
    default: { pos: [0, 0, 3.5], yaw: 0 },
    start: { pos: [0, 0, 3.5], yaw: 0 },
    title: { pos: [0, 0, 3.5], yaw: 0 },
    fromClassroom: { pos: [38.5, 3, 20], yaw: -Math.PI / 2 },
    fromQuince: { pos: [38.5, 3, 50.3], yaw: Math.PI },
    fromHopgood: { pos: [-14.4, 0, 40], yaw: Math.PI / 2 },
    fromUndercroft: { pos: [31.9, -8.5, 2.5], yaw: -Math.PI / 2 },
    fromAshcombe: { pos: [-30.6, 0, 25], yaw: Math.PI / 2 },
    fromGrounds: { pos: [0, 0, 2], yaw: 0 },
  },
  areas: [
    { id: 'hall', name: 'The Lantern Hall', min: [-12, -2, 0], max: [12, 14, 30] },
    { id: 'hall', name: 'The Lantern Hall', min: [-16, -2, 21], max: [-12, 6, 26] },
    { id: 'cupboard', name: "Crumbleton's Cupboard", min: [-18.5, -2, 4], max: [-12, 6, 12] },
    { id: 'corridor', name: 'The Crooked Corridor', min: [12, -2, 5], max: [42, 12, 23] },
    { id: 'corridor', name: 'The Crooked Corridor', min: [18.5, -2, 10], max: [21.5, 4, 13.5] },
    { id: 'court', name: 'Hollyhock Court', min: [-17, -3, 30], max: [17, 30, 66] },
    { id: 'gallery', name: 'The Long Gallery', min: [34.5, 2, 23.5], max: [47.5, 11, 52.5] },
    { id: 'yard', name: 'The Kitchen Yard', min: [-32.5, -2, 13.5], max: [-18.5, 12, 36.5] },
    { id: 'orchard', name: 'The Kitchen Orchard', min: [17, -2, 38.5], max: [27.5, 12, 53.5] },
    { id: 'undercroft', name: 'The Undercroft', min: [12.6, -10, -1.2], max: [34, -1.5, 6.2], ambience: 'dark' },
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
  b.floor(-18.5, 42, 0, 30, { color: '#b8a088', holes: [[13, 19.4, 0, 5.7]] }); // hall, cupboard, corridor ground (and the Undercroft stairwell)
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
  wall(b, 'z', 12.5, 0, 30, HH, {
    holes: [
      { from: 6, to: 10, top: 4.5 }, // to the corridor
      { from: 1.3, to: 3.7, top: 3.4 }, // down to the Undercroft
    ],
  });
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
    // The great doors: barred until Cindersnap is passed, then out to the Castle Grounds.
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 4, height: 5.5, to: { level: 'grounds', spawn: 'default' }, afterLesson: 'cindersnap', talk: 'frontDoors', label: 'The Grounds' },
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
  wall(b, 'x', 23.5, 21, 42.5, 9, { holes: [{ from: 36.4, to: 40.6, bottom: 3, top: 6.6 }] }); // portcullis to the Long Gallery
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
  bench(b, [38.2, 3, 18.25], 0, 2.4);
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
  wall(b, 'z', -16.5, 30, 64, 10.5, { cap: 8, holes: [{ from: 38.8, to: 41.2, top: 3.4 }] }); // Leaps & Bounds
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
    // Freeze the pool (Rimewhistle) to walk out to the fountain.
    { type: 'iceSheet', min: [-1.6, 41], max: [1.6, 45.4], y: -0.35, duration: 0 },
  );

  // Vine-choked arch in the east wall (Cindersnap), a mossy pad on the west roof under an
  // unreachable balcony (Springwell), and a locked chest (Latchkin).
  b.add(
    // Burns away for good (Cindersnap), opening the Kitchen Orchard.
    { type: 'burnable', id: 'hub-arch-vines', style: 'vines', persist: true, pos: [16.5, 1.75, 46], size: [3, 3.5, 0.6], yaw: Math.PI / 2 },
    { type: 'springPad', pos: [-14.2, R, 47], radius: 1.1, style: 'moss', duration: 0 },
    { type: 'chest', id: 'hub-court-chest', pos: [-14.2, 0, 60], yaw: Math.PI / 2, card: 'lumley-lockjaw', sweets: [['bramble', 2]] },
  );
  b.box([-14.75, 9.1, 52], [2.5, 0.4, 4], { color: COLORS.stoneLight }); // balcony
  b.box([-13.6, 9.8, 52], [0.2, 1, 4], { color: COLORS.woodDark, pattern: 'planks' });
  b.box([-14.75, 9.8, 53.9], [2.5, 1, 0.2], { color: COLORS.woodDark, pattern: 'planks' }); // north rail
  deco(b, new BoxGeometry(0.1, 3, 1.8), [-16, 10.8, 52], COLORS.woodDark);

  // The clock tower on the north wall; behind it, a ledge with a card (secret 3).
  b.box([0, 11, 61.8], [4.4, 6, 1.6], { color: COLORS.stoneLight });
  // The front overhangs the wall into the court, so carry it down to the cloister roof
  // with a plinth and a moulded band, rather than leaving it floating.
  b.box([0, R + 1.5, 61.5], [4.4, 3, 1], { color: COLORS.stoneLight });
  deco(b, new BoxGeometry(4.8, 0.3, 1.3), [0, R + 0.15, 61.45], COLORS.stone);
  deco(b, new BoxGeometry(4.7, 0.25, 1.9), [0, 8.1, 61.75], COLORS.stone);
  deco(b, new BoxGeometry(4.7, 0.25, 1.9), [0, 13.9, 61.75], COLORS.stone);
  deco(b, new ConeGeometry(3.2, 3.5, 4), [0, 15.75, 61.8], COLORS.roof, [0, Math.PI / 4, 0]);
  const clock = new Group();
  const face = new Mesh(new CylinderGeometry(1.4, 1.4, 0.15, 24), new MeshStandardMaterial({ color: '#f3e4c4', roughness: 0.6 }));
  face.rotation.x = Math.PI / 2;
  const dial = new Mesh(new CircleGeometry(1.36, 32), new MeshStandardMaterial({ map: clockDial(), roughness: 0.6 }));
  // The clock faces the court (-Z), so everything on its face sits at negative z.
  dial.position.z = -0.08;
  dial.rotation.y = Math.PI;
  const rim = new Mesh(new TorusGeometry(1.42, 0.1, 6, 24), new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.6, roughness: 0.4 }));
  const hand1 = new Mesh(new BoxGeometry(0.08, 1, 0.05), new MeshStandardMaterial({ color: '#2b1d14' }));
  hand1.position.set(0.25, 0.35, -0.11);
  hand1.rotation.z = -0.6;
  const hand2 = new Mesh(new BoxGeometry(0.08, 0.7, 0.05), new MeshStandardMaterial({ color: '#2b1d14' }));
  hand2.position.set(-0.2, 0.15, -0.12);
  hand2.rotation.z = 1.1;
  const cap = new Mesh(new CylinderGeometry(0.1, 0.1, 0.08, 10), new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.6, roughness: 0.4 }));
  cap.rotation.x = Math.PI / 2;
  cap.position.z = -0.14;
  clock.add(face, dial, rim, hand1, hand2, cap);
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
  ivy(b, 'z', -16, 34, 38.4, 0.2, 7, 1, 1);
  ivy(b, 'z', -16, 41.6, 44, 0.2, 7, 1, 7);
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

  // ================================================================ LONG GALLERY (x 35..42, z 24..52, y=3)
  // Added after everything else: entity ids come from build order, so new specs go last.
  const G = 3;
  wall(b, 'z', 34.5, 23.5, 52.5, 10.4, { color: COLORS.stoneLight, holes: [{ from: 49.5, to: 51.5, bottom: G, top: G + 3 }] }); // a false wall fills this
  wall(b, 'z', 42.5, 23.5, 52.5, 10.4, {
    color: COLORS.stoneLight,
    holes: [
      { from: 33.4, to: 37.6, bottom: G, top: G + 3.6 }, // the store-room
    ],
  });
  wall(b, 'x', 52.5, 34.5, 42.5, 10.4, { color: COLORS.stoneLight, holes: [{ from: 37.3, to: 39.7, bottom: G, top: G + 3.4 }] });
  b.box([38.5, G / 2, 38.25], [7, G, 28.5], { color: '#8a6a4a', pattern: 'planks' });
  slab(b, 34.5, 42.5, 23.5, 52.5, 10.8, 0.4, '#5e4a3e', 'planks');
  for (let z = 26; z < 52; z += 4) deco(b, new BoxGeometry(7.2, 0.35, 0.35), [38.5, 10.42, z], COLORS.woodDark);
  rug(b, [38.5, G, 38], 2.2, 25, '#5d4470', '#c99a3e');
  for (const z of [29, 37, 45]) {
    windowPane(b, glow, 'z', 34.5, z, G + 4.4, 1.5, 3.4, 1);
    lightShaft(b, [35.05, G + 5.2, z], [0.8, -0.7, 0.15], 9, 1.4, 0.15);
    bench(b, [35.6, G, z], Math.PI / 2, 2);
  }
  const gallerySitters = [
    CARD_BY_ID.get('mother-wortle')!.portrait,
    { bg: ['#d8c4a4', '#7a5a3a'], kind: 'person', skin: '#e8b48e', robe: '#5a2a3a', hair: '#2b1d14', hat: 'tall', hatColor: '#2b1d14', beard: true, collar: 'ruff', expression: 'stern', prop: 'book' },
    CARD_BY_ID.get('ezekiel-crumbleton')!.portrait,
    { bg: ['#c8d8c0', '#4a6a4a'], kind: 'person', skin: '#f3d2b4', robe: '#3f7a4a', hair: '#e8c25a', hat: 'pointy', hatColor: '#3f5a3a', hairStyle: 'long', collar: 'scarf', jewel: '#7aa8c8', expression: 'kind', prop: 'thistle' },
    CARD_BY_ID.get('puddlewump')!.portrait,
    { bg: ['#e0c8e8', '#5a3a6a'], kind: 'person', skin: '#d9a07a', robe: '#4a2c4f', hair: '#d8d8d8', hat: 'none', hairStyle: 'wild', glasses: true, collar: 'ruff', expression: 'smirk', prop: 'scroll' },
    CARD_BY_ID.get('grey-lady')!.portrait,
    { bg: ['#f2d48a', '#9a6a2e'], kind: 'person', skin: '#f0c9a0', robe: '#7a2f3a', hair: '#5a3a1e', hat: 'bonnet', hatColor: '#e8d8c0', hairStyle: 'bun', collar: 'plain', expression: 'smile', prop: 'cauldron' },
  ] as PortraitSpec[];
  // West wall: between the windows (29, 37, 45), clear of the false wall's alcove (z 49.5..51.5).
  [33, 41, 47.4].forEach((z, i) => portrait(b, gallerySitters[i], [35.05, G + 2.6, z], Math.PI / 2, 1.2, 1.5, (i % 2 ? -1 : 1) * 0.04));
  [27, 31, 40, 44, 48].forEach((z, i) => portrait(b, gallerySitters[3 + i], [41.95, G + 2.6, z], -Math.PI / 2, i % 2 ? 1.1 : 1.3, i % 2 ? 1.4 : 1.7, (i % 2 ? 1 : -1) * 0.05));
  armour(b, [41.3, G, 29], -Math.PI / 2, '#2f5a6a');
  armour(b, [41.3, G, 42], -Math.PI / 2, '#8a2a3a');
  pottedPlant(b, [41.3, G, 51.3], 1.3, 41.3);
  pottedPlant(b, [35.7, G, 47.2], 1.3, 35.7);
  armour(b, [41.3, G, 46], -Math.PI / 2, '#3f7a4a');
  urn(b, [35.7, G, 24.8], true, 3);
  dustMotes(b, [35.5, G + 0.5, 24.5], [41.5, G + 6.5, 51.5], 80);
  cobweb(b, [35, 10.2, 52], [1, 0], [0, -1], 1.2);
  cobweb(b, [42, 10.2, 24], [-1, 0], [0, 1], 1.2);
  b.lantern([38.5, G + 5.5, 38], 9, 16);
  signboard(b, 'The Long Gallery', [38.5, G + 4.3, 22.98], Math.PI);
  // The padlocked store-room off the east wall (x 43..47, z 33..38).
  b.box([45, G / 2, 35.75], [4, G, 5.5], { color: COLORS.stone });
  wall(b, 'x', 32.75, 42.5, 47.5, 4.5, { base: G, color: COLORS.stone });
  wall(b, 'x', 38.75, 42.5, 47.5, 4.5, { base: G, color: COLORS.stone });
  wall(b, 'z', 47.5, 33, 38.5, 4.5, { base: G, color: COLORS.stone });
  slab(b, 42.5, 47.5, 32.75, 38.75, G + 4.6, 0.4, COLORS.stoneDark);
  barrel(b, [46.4, G, 33.9]);
  crate(b, [46.3, G, 37.6], 0.9);
  crate(b, [46.35, G + 0.9, 37.65], 0.6);
  bookStack(b, [44, G, 37.8], 6, 33);
  b.add(
    { type: 'gate', pos: [38.5, G, 23.5], yaw: 0, width: 3, height: 3, when: ['hub-portcullis'] },
    { type: 'knockSwitch', id: 'hub-portcullis', pos: [35.6, G + 1.7, 22.95], yaw: Math.PI, latch: true, persist: true },
    {
      type: 'door',
      pos: [38.5, G, 52],
      yaw: Math.PI,
      width: 2.4,
      height: 3.4,
      to: { level: 'quince', spawn: 'default' },
      talk: 'galleryDoor',
      lockedUnless: 'sorted',
      label: 'Locks & Latches',
    },
    { type: 'gate', pos: [42.5, G, 35.5], yaw: Math.PI / 2, width: 3, height: 3, when: ['hub-store-lock'] },
    { type: 'padlock', id: 'hub-store-lock', pos: [42.4, G + 1.5, 36.2], yaw: -Math.PI / 2, persist: true },
    { type: 'secret', id: 'hub-storeroom', area: 'gallery', min: [43, G - 1, 33], max: [47, G + 3, 38.5] },
    { type: 'sweet', kind: 'humbug', pos: [44, G + 0.6, 34.2] },
    { type: 'chest', id: 'hub-store-chest', pos: [45.8, G, 35.75], yaw: -Math.PI / 2, sweets: [['bramble', 2], ['fizzwort', 4]] },
    { type: 'chest', id: 'hub-hall-cabinet', pos: [11.6, 0, 19.6], yaw: -Math.PI / 2, style: 'cabinet', card: 'brass-mouse' },
    { type: 'sweetLine', kind: 'fizzwort', from: [38.5, G + 0.6, 26], to: [38.5, G + 0.6, 34], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [38.5, G + 0.6, 40], to: [38.5, G + 0.6, 48], count: 5 },
  );

  // ================================================================ after Springwell (appended: ids follow build order)
  b.add(
    {
      type: 'door',
      // In Hollyhock Court's west cloister.
      pos: [-16, 0, 40],
      yaw: Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'hopgood', spawn: 'default' },
      lockedUnless: 'unlocked:hub-hopgood-lock',
      talk: 'hopgoodDoor',
      label: 'Leaps & Bounds',
    },
    { type: 'padlock', id: 'hub-hopgood-lock', pos: [-15.92, 1.5, 40.45], yaw: Math.PI / 2, persist: true },
    // The court balcony, reached by bouncing off the springy moss on the cloister roof.
    { type: 'card', card: 'griselda-gusset', pos: [-14.9, 10.4, 52.8] },
    { type: 'secret', id: 'hub-balcony', area: 'court', min: [-16, 9, 50], max: [-13.5, 12.5, 54] },
    { type: 'sweetLine', kind: 'bramble', from: [-15, 9.8, 50.6], to: [-15, 9.8, 51.6], count: 2 },
  );

  // ================================================================ THE UNDERCROFT (under the hall's south-east corner)
  // A round stairwell (centre 16.2, 2.5) spiralling down from the hall to y -7.5, then a
  // corridor east to Lamplough's door.
  {
    const cx = 16.2;
    const cz = 2.5;
    const BOT = -7.5;
    const TOP = 4.4;
    const ring = 16;
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2;
      const len = 3.4 * ((Math.PI * 2) / ring) * 1.06;
      // Openings: west at the top only (from the hall: solid below it, or you'd walk out
      // under the hall from the bottom), east at the bottom (to the corridor).
      const spans: [number, number][] = k === ring / 2 ? [[BOT, -0.3], [3, TOP]] : k === 0 ? [[-4.5, TOP]] : [[BOT, TOP]];
      for (const [lo, hi] of spans) {
        b.box([cx + Math.cos(a) * 3.4, (lo + hi) / 2, cz + Math.sin(a) * 3.4], [0.4, hi - lo, len], { color: COLORS.stone, rot: [0, -a, 0], info: { noGrab: true } });
      }
    }
    b.cylinder([cx, (BOT + TOP) / 2, cz], 0.7, TOP - BOT, COLORS.stoneLight, { noGrab: true }, 12);
    slab(b, 12.8, 19.6, -0.9, 5.9, TOP + 0.4, 0.4, '#5e4a3e', 'planks');
    b.box([cx, BOT - 0.25, cz], [6.8, 0.5, 6.8], { color: '#5a5262' });
    // The spiral: a landing step at the top (west), then 24 steps of 0.3 m round to the east.
    // The steps are for looks; you walk on a smooth invisible helical ramp under their
    // nosings (individual step edges snag the capsule, worst near the column).
    const step = (a: number, top: number, solid: boolean) =>
      b.box([cx + Math.cos(a) * 1.8, top - 0.15, cz + Math.sin(a) * 1.8], [2.2, 0.3, 1.25], {
        color: COLORS.stoneLight,
        rot: [0, -a, 0],
        info: { noGrab: true },
        noCollide: !solid,
      });
    step(Math.PI, 0, true);
    const da = Math.PI / 8;
    for (let i = 0; i < 24; i++) step(Math.PI + (i + 1) * da, -0.3 * (i + 1), false);
    const chord = 2 * 1.8 * Math.sin(da / 2);
    const pitch = Math.atan2(0.3, chord);
    for (let i = 0; i <= 24; i++) {
      // From step i-1 (the landing for i = 0) down to step i (the floor after the last).
      const am = Math.PI + (i + 0.5) * da;
      const ym = -0.3 * (i + 0.5);
      b.box([cx + Math.cos(am) * 1.8, ym - 0.1, cz + Math.sin(am) * 1.8], [2.2, 0.2, chord / Math.cos(pitch) + 0.08], {
        invisible: true,
        rot: [pitch, -am, 0],
        info: { noGrab: true },
      });
    }
    b.box([13.4, -0.15, cz], [0.9, 0.3, 1.4], { color: COLORS.stoneLight }); // across the wall to the landing
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + 0.5 + i * 1.6;
      deco(b, new BoxGeometry(0.16, 0.3, 0.04), [cx + Math.cos(a) * 3.18, -1 - i * 1.7, cz + Math.sin(a) * 3.18], '#2a2230', [0, -a + Math.PI / 2, 0]);
      candle.add(new ConeGeometry(0.07, 0.24, 5), [cx + Math.cos(a) * 3.05, -0.72 - i * 1.7, cz + Math.sin(a) * 3.05]);
    }
    b.lantern([cx, 1.5, cz], 0, 0, false);
    // The corridor (x 19.6..33.1, z 1.1..3.9, floor -7.5), stepping down a metre at the
    // end (x 29..31) so Lamplough's door has room for its name over it.
    const LOW = BOT - 1;
    b.box([24.2, BOT - 0.25, 2.5], [9.6, 0.5, 3.8], { color: '#5a5262' });
    b.box([30, LOW - 0.25, 2.5], [2, 0.5, 3.8], { color: '#5a5262' });
    b.ramp([31, LOW, 2.5], Math.hypot(2, 1), 2.8, (Math.atan2(1, 2) * 180) / Math.PI, -Math.PI / 2, '#5a5262');
    b.box([32.3, LOW - 0.25, 2.5], [2.6, 0.5, 3.8], { color: '#5a5262' });
    wall(b, 'x', 0.6, 19.4, 33.6, 4.6, { base: LOW, color: '#6a6272' });
    wall(b, 'x', 4.4, 19.4, 33.6, 4.6, { base: LOW, color: '#6a6272' });
    wall(b, 'z', 33.6, 0.6, 4.4, 4.6, { base: LOW, color: '#6a6272' });
    slab(b, 19.4, 33.6, 0.6, 4.4, BOT + 3.6, 0.3, '#3a3242', 'planks');
    for (const x of [22, 26, 30]) {
      wallTorch(b, candle, [x, BOT + 2.3, 1.12], 0);
      wallTorch(b, candle, [x + 2, BOT + 2.3, 3.88], Math.PI);
    }
    b.lantern([27, BOT + 2.8, 2.5], 6, 10);
    rubble(b, 20.5, 1.6, 5, 11, BOT);
    barrel(b, [32.4, LOW, 1.6]);
    bookStack(b, [32.5, LOW, 3.5], 6, 17);
    cobweb(b, [33.1, BOT + 3.25, 1.1], [-1, 0], [0, 1], 0.9);
    cobweb(b, [19.6, BOT + 3.5, 3.9], [1, 0], [0, -1], 0.8);
    signboard(b, 'Undercroft', [11.97, 3.95, cz], -Math.PI / 2);
    // The nook under the stair: a few candles and a bench round the column.
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.45 + i * 0.12);
      candlestick(b, candle, [cx + Math.cos(a) * 2.9, BOT, cz + Math.sin(a) * 2.9], 0.15 + (i % 2) * 0.1);
    }
    rug(b, [cx - 0.8, BOT, cz + 1.9], 1.6, 1.2, '#5a2a3a', '#c99a3e', -0.5);
  }

  // ================================================================ after Glimmerwick (appended: ids follow build order)
  // Glimmer steps from the gallery up to a ledge high on the hall's east wall; the top
  // step only shows in a charged lamp's glow.
  b.box([11.5, 9.95, 18.5], [1, 0.5, 1.8], { color: COLORS.stoneLight, info: { noGrab: true } });
  deco(b, new BoxGeometry(1.1, 0.12, 1.9), [11.5, 9.7, 18.5], COLORS.stoneDark);
  // The false wall's alcove behind the Long Gallery's west wall.
  b.box([33.25, G + 1.5, 49.3], [1.5, 3, 0.2], { color: COLORS.stoneLight });
  b.box([33.25, G + 1.5, 51.7], [1.5, 3, 0.2], { color: COLORS.stoneLight });
  b.box([32.4, G + 1.5, 50.5], [0.2, 3, 2.6], { color: COLORS.stoneLight });
  b.box([33.25, G + 3.15, 50.5], [1.9, 0.3, 2.8], { color: COLORS.stoneDark });
  b.box([33.25, G - 0.5, 50.5], [1.5, 1, 2.4], { color: '#8a6a4a', pattern: 'planks' });
  b.add(
    {
      // At the bottom of the Undercroft stair (this entry was once a door in the hall wall:
      // replaced in place so later ids don't shift).
      type: 'door',
      pos: [33.1, -8.5, 2.5],
      yaw: -Math.PI / 2,
      width: 2.4,
      height: 3.4,
      to: { level: 'lamplough', spawn: 'default' },
      afterLesson: 'springwell',
      talk: 'undercroftDoor',
      label: 'Illumination',
    },
    { type: 'wickLamp', pos: [10.8, 5, 27.5], radius: 5, duration: 8 },
    { type: 'glimmerBlock', pos: [10.6, 6.15, 24.6], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [10.6, 7.45, 22.4], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [10.6, 8.75, 20.2], size: [1.5, 0.3, 1.5] },
    { type: 'card', card: 'ambrose-wick', pos: [11.4, 11, 18.5] },
    { type: 'secret', id: 'hub-wick-ledge', area: 'hall', min: [10.8, 9.8, 17.4], max: [12, 12.5, 19.6] },
    { type: 'wickLamp', pos: [37, G, 48.6], radius: 4, duration: 8 },
    { type: 'wickLamp', pos: [33, G, 51.1], radius: 2.5, duration: 8 }, // inside the alcove: no getting shut in
    { type: 'illusionWall', pos: [34.5, G + 1.5, 50.5], size: [1, 3, 2], color: COLORS.stoneLight },
    { type: 'secret', id: 'hub-gallery-niche', area: 'gallery', min: [32.5, G - 1, 49.5], max: [34, G + 3, 51.5] },
    { type: 'sweet', kind: 'humbug', pos: [33.2, G + 0.6, 50.5] },
    { type: 'sweetLine', kind: 'bramble', from: [33.2, G + 0.6, 49.8], to: [33.2, G + 0.6, 51.2], count: 2 },
  );

  // ================================================================ the Undercroft (appended)
  b.add(
    { type: 'card', card: 'stair-sprite', pos: [15.3, -6.4, 4.3] },
    { type: 'secret', id: 'hub-under-stair', area: 'undercroft', min: [13.4, -8, 3.2], max: [17.2, -5.5, 5.6] },
  );

  kitchenYard(b, glow);
  wellYard(b);
  orchard(b);
  // Appended after everything above, so earlier sweets keep their ids.
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [14.5, 0.6, 27], to: [14.5, 0.6, 14], count: 5 },
    { type: 'sweet', kind: 'humbug', pos: [19, 1.1, 27.5] },
    { type: 'sweetLine', kind: 'fizzwort', from: [22, 0.6, 27], to: [32, 0.6, 27], count: 4 },
  );

  glow.finish(b, '#ffc68a');
  candle.finish(b, '#ffe2a0');
  b.finish();
}

/**
 * The Kitchen Yard (x -32..-19, z 14..36), west of the castle: reached from Hollyhock
 * Court through the corner behind the cloister (x -18.5..-12.5, z 26.5..30) and an arch.
 * The kitchens (Ashcombe's door, Hearth & Flame) are in its west wall, in a bakehouse
 * front with a chimney; herb beds, a woodpile, a cart and a hay stack fill the rest.
 */
function kitchenYard(b: LevelBuilder, glow: Glow): void {
  const BRICK = '#9a5a44';
  b.floor(-32.5, -18.5, 13.5, 36.5, { color: '#a89878' });
  // The arch from the corner into the yard; its wall also closes the castle's west edge.
  wall(b, 'z', -18.5, 12.5, 36.5, 7, { cap: 4, color: COLORS.stone, holes: [{ from: 26.9, to: 29.6, top: 3.8 }] });
  deco(b, new BoxGeometry(1.2, 0.5, 3.3), [-18.5, 4, 28.25], COLORS.stoneLight);
  wall(b, 'x', 30.5, -18.5, -16.5, 10.5, { cap: 8 });
  wall(b, 'z', -32.5, 13.5, 36.5, 7, { cap: 4, color: BRICK, holes: [{ from: 23.9, to: 26.1, top: 3.4 }] });
  wall(b, 'x', 13.5, -33, -18, 7, { cap: 4 });
  wall(b, 'x', 36.5, -33, -18, 7, { cap: 4 });
  // Nobody climbs onto the tapestry alcove's roof from the corner.
  b.box([-14.5, 5.5, 26], [4, 4, 1], { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  signboard(b, 'The Kitchen Yard', [-18.5, 4.6, 29.06], Math.PI);
  b.add({
    type: 'door',
    pos: [-32, 0, 25],
    yaw: Math.PI / 2,
    width: 2.2,
    height: 3.2,
    to: { level: 'ashcombe', spawn: 'default' },
    afterLesson: 'glimmerwick',
    talk: 'kitchenDoor',
    label: 'Hearth & Flame',
  });
  // The bakehouse front: a brick gable, the chimney, and a bread oven's glowing mouth.
  signboard(b, 'Hearth & Flame', [-31.95, 3.85, 25], Math.PI / 2);
  // A tiled eave along the top of the wall, and the chimney.
  deco(b, new BoxGeometry(1.6, 0.25, 23.2), [-31.9, 7.05, 25], COLORS.roof, [0, 0, -0.35]);
  b.box([-31.6, 8.5, 20], [1.4, 3, 1.6], { color: BRICK, noCollide: true });
  deco(b, new BoxGeometry(1.6, 0.2, 1.8), [-31.6, 10.1, 20], COLORS.stoneDark);
  // The bread oven: a brick hump with embers in its mouth.
  b.box([-31.3, 0.9, 20.5], [1.6, 1.8, 2.4], { color: BRICK });
  deco(b, new BoxGeometry(0.06, 0.6, 1), [-30.48, 0.75, 20.5], '#1e1410');
  for (let i = 0; i < 5; i++) glow.add(new SphereGeometry(0.07, 5, 4), [-30.47, 0.52 + (i % 2) * 0.06, 20.1 + i * 0.2]);
  b.lantern([-31.7, 3, 23.4], 0, 0, false);
  b.lantern([-31.7, 3, 26.6], 0, 0, false);
  // Herb beds.
  for (const [x, z] of [
    [-27, 18],
    [-22.5, 18],
    [-27, 32.5],
  ]) {
    b.box([x, 0.25, z], [3.4, 0.5, 2], { color: COLORS.woodDark, pattern: 'planks' });
    deco(b, new BoxGeometry(3.2, 0.06, 1.8), [x, 0.52, z], '#5a4030');
    for (let i = 0; i < 6; i++) bush(b, x - 1.3 + (i % 3) * 1.3, z - 0.45 + Math.floor(i / 3) * 0.9, 0.45, i + Math.round(x), 0.5);
  }
  // A woodpile against the north wall, kept low.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 8 - row; i++) {
      deco(b, new CylinderGeometry(0.14, 0.14, 1.2, 6), [-25 + i * 0.29 + row * 0.14, 0.14 + row * 0.24, 35.6], i % 2 ? COLORS.wood : '#a0703e', [Math.PI / 2, 0, 0]);
    }
  }
  b.box([-24, 0.4, 35.6], [2.6, 0.8, 1.2], { invisible: true });
  // A cart and some barrels by the arch.
  b.box([-21.2, 0.8, 20.5], [1.6, 0.3, 2.8], { color: COLORS.wood, pattern: 'planks' });
  for (const z of [19.4, 21.6]) deco(b, new CylinderGeometry(0.55, 0.55, 0.12, 10), [-20.3, 0.55, z], COLORS.woodDark, [0, 0, Math.PI / 2]);
  deco(b, new BoxGeometry(0.1, 0.1, 2), [-21.2, 0.6, 23.4], COLORS.woodDark, [0.3, 0, 0]);
  for (let i = 0; i < 4; i++) deco(b, new SphereGeometry(0.22, 6, 4), [-21.6 + (i % 2) * 0.6, 1.15, 19.8 + i * 0.5], i % 2 ? '#c9883e' : '#8a6a3a');
  barrel(b, [-19.7, 0, 31.2], 0.4, 1);
  barrel(b, [-19.7, 0, 32.2], 0.4, 1);
  crate(b, [-20, 0, 35.3], 0.9);
  // Washing on a line.
  deco(b, new CylinderGeometry(0.05, 0.05, 2.6, 5), [-29, 1.3, 15], COLORS.woodDark);
  deco(b, new CylinderGeometry(0.05, 0.05, 2.6, 5), [-22, 1.3, 15], COLORS.woodDark);
  deco(b, new BoxGeometry(7, 0.02, 0.02), [-25.5, 2.5, 15], '#d8d0c0');
  for (const [x, c] of [
    [-28, '#b0362f'],
    [-26.6, '#e8e2d0'],
    [-25.2, '#3f7a4a'],
    [-23.6, '#5d4470'],
  ] as [number, string][]) {
    deco(b, new BoxGeometry(0.9, 1, 0.03), [x, 1.95, 15], c);
  }
  // The hay stack in the north-west corner has something tucked behind it.
  b.add(
    { type: 'burnable', id: 'hub-yard-hay', style: 'hay', persist: true, pos: [-30.4, 0.7, 33.2], size: [1.8, 1.4, 1.4] },
    { type: 'burnable', id: 'hub-yard-hay2', style: 'hay', persist: true, pos: [-29, 0.7, 34.8], size: [1.4, 1.4, 1.8] },
    { type: 'sweet', kind: 'humbug', pos: [-31.4, 0.6, 35.4] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-22, 0.6, 28.2], to: [-29, 0.6, 28.2], count: 5 },
  );
  b.box([-30.8, 0.7, 35.6], [0.3, 1.4, 1.6], { color: COLORS.stoneDark });
  grass(b, -32.5, -18.5, 13.5, 16.5, 0, 2);
  grass(b, -32.5, -29, 28, 36.5, 0, 2);
  tree(b, -21.5, 33);
}

/**
 * The Well Yard (the alley east of the hall, x 13..34, z 11..30): an old frozen yard. Its
 * gate's lock is iced over until Cindersnap thaws it.
 */
function wellYard(b: LevelBuilder): void {
  b.add(
    { type: 'gate', pos: [14.5, 0, 30], yaw: 0, width: 3.2, height: 3.4, when: ['hub-well-ice'] },
    // The lock is frozen into a lump of ice: Cindersnap thaws it, for good.
    { type: 'burnable', id: 'hub-well-ice', style: 'ice', persist: true, pos: [14.5, 1.2, 30.45], size: [0.9, 0.8, 0.5] },
  );
  signboard(b, 'Well Yard\nFrozen shut', [14.5, 3.9, 30.3], 0);
  // The well, frosted over, with icicles on its little roof.
  b.cylinder([15, 0.45, 25], 1, 0.9, COLORS.stoneLight, undefined, 10);
  deco(b, new CylinderGeometry(0.92, 0.92, 0.04, 10), [15, 0.86, 25], '#e8f6fc');
  for (const dx of [-0.9, 0.9]) deco(b, new BoxGeometry(0.15, 1.8, 0.15), [15 + dx, 1.8, 25], COLORS.woodDark);
  deco(b, new ConeGeometry(1.4, 0.8, 4), [15, 3, 25], COLORS.roof, [0, Math.PI / 4, 0]);
  deco(b, new ConeGeometry(1.45, 0.3, 4), [15, 3.3, 25], '#f4fbff', [0, Math.PI / 4, 0]);
  for (let i = 0; i < 6; i++) deco(b, new ConeGeometry(0.05, 0.4, 4), [14.1 + i * 0.36, 2.45, 25.95], '#d8f2fc', [Math.PI, 0, 0]);
  deco(b, new BoxGeometry(2, 0.6, 0.8), [19, 0.3, 27.5], COLORS.stoneDark);
  deco(b, new BoxGeometry(1.8, 0.04, 0.6), [19, 0.6, 27.5], COLORS.ice);
  // Snow drifts, thickest by the walls.
  for (const [x, z, w, d] of [
    [13.8, 27, 1.4, 5],
    [16.2, 20, 3, 2],
    [21, 28.4, 6, 1.4],
    [14.2, 14, 1.6, 4],
  ]) {
    deco(b, new BoxGeometry(w, 0.06, d), [x, 0.03, z], '#f2f8fb');
  }
  for (const z of [12.5, 17]) crate(b, [13.6, 0, z], 0.9);
}

/**
 * The Kitchen Orchard (x 17..27.5, z 38.5..53.5), behind the vines over the court's
 * east arch: apple trees, long grass, and a cobwebbed potting shed with a card.
 */
function orchard(b: LevelBuilder): void {
  b.floor(17, 27.5, 38.5, 53.5, { color: '#8a9a5a' });
  wall(b, 'z', 28, 38.5, 53.5, 6, { cap: 4 });
  wall(b, 'x', 38, 17, 28.5, 6, { cap: 4 });
  wall(b, 'x', 54, 17, 28.5, 6, { cap: 4 });
  ivy(b, 'z', 27.5, 39, 53, 0, 5, -1, 11);
  grass(b, 17, 27.5, 38.5, 53.5, 0, 3);
  for (const [x, z] of [
    [20.5, 41.5],
    [24.5, 45.5],
    [20, 50.5],
  ]) {
    tree(b, x, z);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      deco(b, new SphereGeometry(0.16, 6, 4), [x + Math.cos(a) * 1.9, 5.2 + (i % 3) * 0.5, z + Math.sin(a) * 1.9], i % 2 ? '#c8382a' : '#d9a03a');
    }
    // Windfalls.
    for (let i = 0; i < 3; i++) deco(b, new SphereGeometry(0.13, 6, 4), [x + 1 + i * 0.4, 0.12, z - 1.2 + i * 0.5], '#b8382a');
  }
  signboard(b, 'The Kitchen Orchard', [17.05, 3.4, 41], Math.PI / 2);
  // The potting shed, its doorway (west) thick with cobwebs.
  const SHED = '#7a5a3a';
  b.box([25.5, 1.4, 49.2], [3.6, 2.8, 0.3], { color: SHED, pattern: 'planks' });
  b.box([25.5, 1.4, 52.8], [3.6, 2.8, 0.3], { color: SHED, pattern: 'planks' });
  b.box([23.85, 1.4, 49.8], [0.3, 2.8, 0.9], { color: SHED, pattern: 'planks' });
  b.box([23.85, 1.4, 52.2], [0.3, 2.8, 0.9], { color: SHED, pattern: 'planks' });
  b.box([23.85, 2.6, 51], [0.3, 0.4, 1.5], { color: SHED, pattern: 'planks' });
  slab(b, 23.6, 27.5, 48.9, 53.1, 3.1, 0.3, COLORS.roof, 'planks');
  b.add(
    { type: 'burnable', id: 'hub-orchard-web', style: 'cobweb', persist: true, pos: [23.85, 1.2, 51], size: [1.5, 2.4, 0.2], yaw: Math.PI / 2 },
    { type: 'card', card: 'silas-applegarth', pos: [26.3, 1.2, 51] },
    { type: 'secret', id: 'hub-orchard-shed', area: 'orchard', min: [24, -1, 49.4], max: [27.5, 3, 52.6] },
    { type: 'sweetLine', kind: 'fizzwort', from: [18.5, 0.6, 44], to: [22.5, 0.6, 48], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [26.5, 0.6, 39.5] },
  );
  b.box([26.6, 0.4, 51], [1.2, 0.8, 2.6], { color: COLORS.wood, pattern: 'planks' });
  pottedPlant(b, [26.6, 0.8, 49.9], 0.6, 3);
  pottedPlant(b, [26.6, 0.8, 52.1], 0.6, 8);
  barrel(b, [22.8, 0, 52.8], 0.35, 0.9);
  bush(b, 26.5, 42, 1.3, 9);
  bush(b, 18, 52.6, 1.1, 12);
}

/** A painted clock dial: Roman numerals, minute ticks and a gilt ring. */
function clockDial(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(256, 230, 40, 256, 256, 256);
  grad.addColorStop(0, '#fbf3df');
  grad.addColorStop(1, '#e2cfa6');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#c99a3e';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(256, 256, 236, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#2b1d14';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 ? 214 : 200;
    g.lineWidth = i % 5 ? 3 : 7;
    g.beginPath();
    g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0);
    g.lineTo(256 + Math.sin(a) * 226, 256 - Math.cos(a) * 226);
    g.stroke();
  }
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#2b1d14';
  g.font = 'bold 44px Palatino, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  numerals.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.sin(a) * 160, 256 - Math.cos(a) * 160);
    g.rotate(a);
    g.fillText(n, 0, 0);
    g.restore();
  });
  // A little thistle under the centre, the school's mark.
  g.fillStyle = '#7a4fa0';
  g.beginPath();
  g.arc(256, 330, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4f7a34';
  g.fillRect(253, 342, 6, 26);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
