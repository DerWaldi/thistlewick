import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { armour, bench, bookStack, candlestick, cobweb, crate, deco, Glow, portrait, pottedPlant, rug, shelf, signboard, slab, table, wall, wallTorch, windowPane } from '../../world/props';
import { CARD_BY_ID } from '../cards';
import { HOUSES, type HouseId } from '../houses';

/**
 * The First Floor, up a door on the Lantern Hall's gallery (east wall). +Z north:
 *
 *   Long Hall      x -4.5..4.5,  z 0..54    the spine: portraits, armour, benches; the door
 *                                           back down (south); doorways west (library) and
 *                                           east (house wing); a stair (z 44..54) up to the roof
 *                                           and, beside the stair (east), the iron door to the
 *                                           Final Examinations (after all seven lessons)
 *   Great Library  x -36..-5.5,  z 8..40    12 m tall. A U-shaped mezzanine (top 5: west,
 *                                           north and south strips) up a stair by the door, or
 *                                           on the book lift (Thistledown, north). The stack
 *                                           island (x -24..-16, z 20..28, top 9): glimmer steps
 *                                           from the west mezzanine, the last only in a CHARGED
 *                                           lamp's glow (card). Behind the north wall, through a
 *                                           sliding bookshelf (knock the odd book), the Forbidden
 *                                           Section: a Snapweed and a chest (card)
 *                                           Along the top of the north bookcases (9), a plank
 *                                           ledge with gaps, reached by a rune tile on the
 *                                           mezzanine (Springwell): Oswin's book at its east end
 *   House Wing     x 5.5..36,    z 8..40    a corridor (z 21..29) with four common rooms: only
 *                                           your own house's door opens
 *   The Leads      x -30..30,    z 54.5..84, y 7.2  the roof: chimney steps up to the ridge, a
 *                                           rain cistern to freeze (or a spring tile to fling
 *                                           you over) to the observatory, a crate lift up its
 *                                           drum, a mushroom bounce to the lookout (card)
 */
export const UPPER: LevelDef = {
  id: 'upper',
  name: 'The First Floor',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromExams: { pos: [3.2, 0, 49], yaw: -Math.PI / 2 },
  },
  areas: [
    { id: 'hall', name: 'The Long Hall', min: [-4.5, -1, 0], max: [4.5, 12, 54.5] },
    { id: 'library', name: 'The Great Library', min: [-36, -1, 8], max: [-5.5, 13, 40] },
    { id: 'forbidden', name: 'The Forbidden Section', min: [-36, -1, 40.5], max: [-28, 5, 48] },
    { id: 'wing', name: 'The House Wing', min: [5.5, -1, 8], max: [36, 7, 40] },
    { id: 'leads', name: 'The Leads', min: [-30.5, 5, 54.5], max: [30.5, 25, 84.5] },
  ],
  npcSpots: {
    hallBenchWest: { pos: [-3.2, 0, 14], yaw: Math.PI / 2 },
    hallBenchEast: { pos: [3.2, 0, 34], yaw: -Math.PI / 2 },
    librarian: { pos: [-11, 0, 31.5], yaw: Math.PI },
    readingTable: { pos: [-28, 0, 14], yaw: 0 },
    mezzanine: { pos: [-20, 5, 38.5], yaw: Math.PI },
    // One fireside per common room: `<house>Fireside`.
    bramblecoteFireside: { pos: [13, 0, 36], yaw: 0 },
    mallowmereFireside: { pos: [28.7, 0, 36], yaw: 0 },
    nettlebyFireside: { pos: [13, 0, 12], yaw: Math.PI },
    yarrowdownFireside: { pos: [28.7, 0, 12], yaw: Math.PI },
    wingCorridor: { pos: [33, 0, 23], yaw: -Math.PI / 2 },
    lookout: { pos: [-6, 7.2, 82], yaw: 0 },
  },
  build,
};

const STONE = '#a8957e';
const WOOD = '#6a4a32';
const H = 7;

/** Each house's common room: its door off the wing corridor, and where the fireside is. */
const COMMON: { house: HouseId; x0: number; x1: number; z0: number; z1: number; doorX: number; doorZ: number; north: boolean }[] = [
  { house: 'bramblecote', x0: 5.5, x1: 20.5, z0: 30, z1: 40, doorX: 13, doorZ: 29.5, north: true },
  { house: 'mallowmere', x0: 21.5, x1: 36, z0: 30, z1: 40, doorX: 28.5, doorZ: 29.5, north: true },
  { house: 'nettleby', x0: 5.5, x1: 20.5, z0: 8, z1: 20, doorX: 13, doorZ: 20.5, north: false },
  { house: 'yarrowdown', x0: 21.5, x1: 36, z0: 8, z1: 20, doorX: 28.5, doorZ: 20.5, north: false },
];

function build(b: LevelBuilder): void {
  const glow = new Glow();
  const flames = new Glow();
  longHall(b, glow, flames);
  library(b, glow, flames);
  houseWing(b, flames);
  leads(b);
  // Last (ids follow build order): Oswin's book on top of the library's north bookcases.
  errands(b);
  glow.finish(b, '#ffe2a0');
  flames.finish(b, '#ffb060');
  b.finish();
}

// ---------------------------------------------------------------- the long hall

function longHall(b: LevelBuilder, glow: Glow, flames: Glow): void {
  b.floor(-5.5, 5.5, -0.5, 54.5, { color: '#8a6a4a' });
  wall(b, 'x', -0.5, -5.5, 5.5, H, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -5, -0.5, 54.5, 12.5, { color: STONE, holes: [{ from: 22, to: 26, top: 4 }] });
  wall(b, 'z', 5, -0.5, 54.5, H, { color: STONE, holes: [{ from: 23, to: 27, top: 4 }] });
  slab(b, -5.5, 5.5, -0.5, 44, H + 0.5, 0.5, '#4a3226', 'planks');
  for (let z = 3; z < 44; z += 4) deco(b, new BoxGeometry(9, 0.4, 0.4), [0, H - 0.2, z], COLORS.woodDark);
  // The carpet runner and the door back down to the Lantern Hall's gallery.
  deco(b, new BoxGeometry(2.6, 0.03, 42), [0, 0.015, 22], COLORS.carpet);
  deco(b, new BoxGeometry(3, 0.025, 42.2), [0, 0.012, 22], '#c99a3e');
  b.add({ type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'hub', spawn: 'fromUpper' }, label: 'The Lantern Hall' });
  // Portraits, armour and benches (NPC spots at two of them).
  const sitters = ['mother-wortle', 'agnes-thistlewick', 'pellam-fogg', 'ezekiel-crumbleton', 'hester-quillfeather', 'ambrose-wick'];
  sitters.forEach((id, i) => {
    const west = i % 2 === 0;
    portrait(b, CARD_BY_ID.get(id)!.portrait, [west ? -4.45 : 4.45, 3.3, 6 + i * 6], west ? Math.PI / 2 : -Math.PI / 2, 1.2, 1.5, (i % 3) * 0.03 - 0.03);
  });
  for (const z of [10, 19, 31, 40]) armour(b, [z % 2 ? -3.9 : 3.9, 0, z], z % 2 ? Math.PI / 2 : -Math.PI / 2);
  bench(b, [-3.6, 0, 14], Math.PI / 2, 2.4);
  bench(b, [3.6, 0, 34], -Math.PI / 2, 2.4);
  for (const z of [3, 41]) windowPane(b, glow, 'z', 5.5, z, 4, 1.4, 3, -1);
  b.lantern([0, 5.8, 12], 6, 14);
  b.lantern([0, 5.8, 34], 6, 14);
  wallTorch(b, flames, [-2.2, 2.6, 0.02], 0);
  wallTorch(b, flames, [2.2, 2.6, 0.02], 0);
  signboard(b, 'The Great Library', [-4.47, 4.8, 24], Math.PI / 2);
  signboard(b, 'The House Wing', [4.47, 4.8, 25], -Math.PI / 2);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 4], to: [0, 0.6, 20], count: 6 },
    { type: 'checkpoint', pos: [-3.4, 0, 2], yaw: Math.PI / 2, zone: { min: [-4.5, -1, 0], max: [4.5, 4, 6] } },
  );
  // The stair hall at the north end: up to the roof.
  slab(b, -5.5, 5.5, 44, 54.5, 11.5, 0.5, '#4a3226', 'planks');
  wall(b, 'x', 54.5, -5.5, 5.5, 11.5, { color: STONE, holes: [{ from: -1.5, to: 1.5, bottom: 7.2, top: 10.6 }] });
  wall(b, 'z', 5, 44, 54.5, 11.5, { color: STONE, holes: [{ from: 47.8, to: 50.2, top: 3.4 }] });
  // Beside the stair, east: the Examination Hall, once all seven lessons are done.
  b.add({ type: 'door', pos: [4.55, 0, 49], yaw: -Math.PI / 2, width: 2.2, height: 3.2, to: { level: 'exams', spawn: 'default' }, afterLesson: 'thistledown', talk: 'examsDoor', label: 'The Examination Hall', style: 'iron' });
  b.stairs([0, 0, 44.4], 0, 18, 0.4, 0.52, 3, COLORS.stoneLight);
  // Beside the stair foot, not in the way.
  signboard(b, 'To the Leads (the roof)', [-3, 3, 43.95], Math.PI);
  b.box([-3, 1.6, 43.9], [0.12, 3.2, 0.12], { color: COLORS.woodDark });
}

// ---------------------------------------------------------------- the Great Library

function library(b: LevelBuilder, glow: Glow, flames: Glow): void {
  const LH = 12;
  b.floor(-37, -5, 7.5, 48.5, { color: '#7a5a3e' });
  wall(b, 'x', 7.5, -37, -5, LH, { color: STONE });
  wall(b, 'x', 40.5, -37, -5, LH, { color: STONE, holes: [{ from: -33, to: -31, top: 2.8 }] });
  wall(b, 'z', -36.5, 7.5, 48.5, LH, { color: STONE });
  slab(b, -37, -5, 7.5, 40.5, LH + 0.5, 0.5, '#4a3226', 'planks');
  for (let z = 10; z < 40; z += 5) deco(b, new BoxGeometry(31, 0.5, 0.5), [-21, LH - 0.25, z], COLORS.woodDark);
  // The mezzanine (top 5): west, north and south strips, with rails.
  slab(b, -36, -33, 8, 40, 5, 0.4, WOOD, 'planks');
  slab(b, -33, -5.5, 37, 40, 5, 0.4, WOOD, 'planks');
  slab(b, -33, -5.5, 8, 11, 5, 0.4, WOOD, 'planks');
  const rail = (from: V3, to: V3) => {
    const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const mid: V3 = [(from[0] + to[0]) / 2, 5.95, (from[2] + to[2]) / 2];
    const along = Math.abs(to[0] - from[0]) > 0.1;
    b.box(mid, along ? [len, 0.1, 0.1] : [0.1, 0.1, len], { color: COLORS.woodDark, info: { noGrab: true } });
    b.box([mid[0], 5.5, mid[2]], along ? [len, 1, 0.06] : [0.06, 1, len], { invisible: true, info: { noGrab: true } });
    for (let t = 0; t <= len; t += 1.5) {
      const p: V3 = along ? [Math.min(from[0], to[0]) + t, 5.45, from[2]] : [from[0], 5.45, Math.min(from[2], to[2]) + t];
      deco(b, new BoxGeometry(0.08, 0.9, 0.08), p, COLORS.woodDark);
    }
  };
  rail([-33, 0, 11], [-33, 0, 37]);
  rail([-33, 0, 37], [-21.3, 0, 37]);
  rail([-18.7, 0, 37], [-5.5, 0, 37]);
  rail([-33, 0, 11], [-8.4, 0, 11]);
  // Up from the floor: the stair by the door...
  b.stairs([-7, 0, 21], Math.PI, 10, 0.5, 1, 2.5, COLORS.stoneLight);
  // ...or the book lift (Thistledown) up to the north strip.
  b.add({ type: 'skyLift', style: 'platform', from: [-20, 0, 35.6], to: [-20, 5, 35.6], size: [2.4, 2.4], speed: 2 });
  // Shelves everywhere: under and along the mezzanine, and freestanding rows.
  for (let z = 13; z < 36; z += 3) shelf(b, [-35.65, 0, z], Math.PI / 2, 2.6, 3.8);
  for (let z = 13; z < 36; z += 3) shelf(b, [-35.65, 5, z], Math.PI / 2, 2.6, 4);
  for (let x = -31; x < -8; x += 3) {
    if (Math.abs(x + 29.4) > 1 && Math.abs(x + 32) > 1.5) shelf(b, [x, 0, 39.65], Math.PI, 2.6, 3.8);
    shelf(b, [x, 5, 39.65], Math.PI, 2.6, 4);
    shelf(b, [x, 5, 8.35], 0, 2.6, 4);
  }
  shelf(b, [-29.4, 0, 39.65], Math.PI, 2.4, 3.8);
  for (const z of [14, 17]) for (const x of [-28, -12]) shelf(b, [x, 0, z], 0, 2.8, 2.6);
  // The stack island: a tower of shelves, too tall to climb (top 9).
  b.box([-20, 4.5, 24], [8, 9, 8], { color: WOOD, pattern: 'planks', info: { noGrab: true } });
  for (const [x, z, r] of [
    [-24.05, 24, Math.PI / 2],
    [-15.95, 24, -Math.PI / 2],
    [-20, 19.95, Math.PI],
    [-20, 28.05, 0],
  ] as [number, number, number][]) {
    for (let y = 0.4; y < 8.6; y += 1.1) deco(b, new BoxGeometry(r === 0 || r === Math.PI ? 7.6 : 0.1, 0.9, r === 0 || r === Math.PI ? 0.1 : 7.6), [x, y + 0.45, z], ['#8a2a3a', '#2f5a6a', '#3f7a4a', '#c99a3e'][Math.round(y) % 4]);
  }
  deco(b, new BoxGeometry(8.2, 0.2, 8.2), [-20, 9.05, 24], COLORS.woodDark);
  b.add(
    { type: 'wickLamp', pos: [-34.6, 5, 24], radius: 6.8, duration: 12, light: true, lightRange: 12 },
    { type: 'glimmerBlock', pos: [-31, 6.2, 24], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [-28.2, 7.3, 24], size: [1.5, 0.3, 1.5] },
    { type: 'glimmerBlock', pos: [-25.6, 8.45, 24], size: [1.5, 0.3, 1.5] },
    { type: 'card', card: 'orla-vellum', pos: [-20, 10.3, 24] },
    { type: 'secret', id: 'upper-stacks', area: 'library', min: [-24, 9, 20], max: [-16, 12, 28] },
    { type: 'sweetLine', kind: 'bramble', from: [-22, 9.6, 22], to: [-18, 9.6, 26], count: 3 },
  );
  signboard(b, 'Stacks out of reach?\nA brighter lamp shows more.', [-36.43, 8.6, 24], Math.PI / 2);
  // Reading tables, a globe, the librarian's desk (an NPC spot), candles.
  table(b, flames, [-28, 0, 22], Math.PI / 2, 3.4, 1.3, 2);
  table(b, flames, [-12, 0, 26], Math.PI / 2, 3.4, 1.3, 5);
  table(b, flames, [-11, 0, 33], 0, 2.4, 1.1, 8);
  bookStack(b, [-11.6, 0.85, 33.1], 6, 3);
  candlestick(b, flames, [-10.2, 0.85, 32.9], 0.3);
  rug(b, [-20, 0, 32.5], 6, 4, '#5d4470', '#c99a3e');
  rug(b, [-20, 0, 15], 6, 4, '#2f5a6a', '#c99a3e');
  b.cylinder([-30, 0.55, 30], 0.18, 1.1, COLORS.woodDark, undefined, 6);
  deco(b, new SphereGeometry(0.6, 12, 8), [-30, 1.6, 30], '#4f9fc4');
  deco(b, new TorusGeometry(0.65, 0.04, 4, 16), [-30, 1.6, 30], '#c99a3e', [0.4, 0, 0]);
  for (const z of [15, 24, 33]) windowPane(b, glow, 'z', -36.5, z, 10.2, 1.4, 2.8, 1);
  b.lantern([-14, 9.5, 18], 7, 18);
  b.lantern([-26, 9.5, 31], 7, 18);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [-30, 5.6, 9.5], to: [-12, 5.6, 9.5], count: 6 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-34.5, 5.6, 14], to: [-34.5, 5.6, 34], count: 6 },
  );

  // The Forbidden Section, behind a sliding bookshelf: knock the odd book.
  wall(b, 'x', 48.5, -37, -27.5, 4.5, { color: STONE });
  wall(b, 'z', -28, 40.5, 48.5, 4.5, { color: STONE });
  slab(b, -37, -27.5, 40.5, 48.5, 4.9, 0.4, COLORS.stoneDark);
  b.add(
    { type: 'bookshelf', pos: [-32, 0, 40.25], yaw: Math.PI, width: 2, height: 2.6, slide: 2.1, when: ['upper-book'] },
    { type: 'knockSwitch', id: 'upper-book', pos: [-29.4, 1.95, 39.45], yaw: Math.PI, style: 'book' },
    { type: 'snapweed', pos: [-31.5, 0, 45], radius: 2.2 },
    { type: 'chest', id: 'upper-forbidden-chest', pos: [-35, 0, 46.8], yaw: Math.PI / 2, card: 'snapweed', sweets: [['humbug', 1], ['bramble', 2]] },
    { type: 'secret', id: 'upper-forbidden', area: 'forbidden', min: [-36, -1, 41], max: [-28.5, 4, 48] },
  );
  for (const x of [-35, -29.6]) shelf(b, [x, 0, 48.15], 0, 2.2, 3.4);
  cobweb(b, [-36, 4.4, 48], [1, 0], [0, -1], 1.2);
  cobweb(b, [-28.5, 4.4, 48], [-1, 0], [0, -1], 1.2);
  deco(b, new CylinderGeometry(0.5, 0.4, 0.6, 8), [-31.5, 0.3, 45], '#7a4a3a');
  signboard(b, 'FORBIDDEN', [-32, 3.5, 40.03], Math.PI);
}

// ---------------------------------------------------------------- the house wing

function houseWing(b: LevelBuilder, flames: Glow): void {
  const WH = 6;
  b.floor(5, 37, 7.5, 40.5, { color: '#8a6a4a' });
  wall(b, 'x', 7.5, 5, 37, WH, { color: STONE });
  wall(b, 'x', 40.5, 5, 37, WH, { color: STONE });
  wall(b, 'z', 36.5, 7.5, 40.5, WH, { color: STONE });
  slab(b, 5, 37, 7.5, 40.5, WH + 0.5, 0.5, '#4a3226', 'planks');
  // The corridor (z 21..29) and its door holes into the common rooms.
  const holes = [
    { from: 11.7, to: 14.3, top: 3.4 },
    { from: 27.2, to: 29.8, top: 3.4 },
  ];
  wall(b, 'x', 20.5, 5.5, 36, WH, { color: STONE, holes });
  wall(b, 'x', 29.5, 5.5, 36, WH, { color: STONE, holes });
  wall(b, 'z', 21, 7.5, 20.5, WH, { color: STONE });
  wall(b, 'z', 21, 29.5, 40.5, WH, { color: STONE });
  deco(b, new BoxGeometry(30, 0.03, 2.4), [21, 0.015, 25], COLORS.carpet);
  b.lantern([21, 5, 25], 6, 14);
  for (const c of COMMON) {
    const h = HOUSES[c.house];
    b.add(
      { type: 'houseSeal', house: c.house },
      { type: 'gate', pos: [c.doorX, 0, c.doorZ], yaw: 0, width: 2, height: 3, when: [`house-door-${c.house}`] },
    );
    // A banner by the door, the house name above it.
    deco(b, new BoxGeometry(1, 2.4, 0.06), [c.doorX - 2.2, 2.6, c.doorZ + (c.north ? -0.53 : 0.53)], h.color);
    deco(b, new BoxGeometry(1.06, 0.15, 0.08), [c.doorX - 2.2, 3.85, c.doorZ + (c.north ? -0.54 : 0.54)], h.trim);
    signboard(b, h.name, [c.doorX, 4.4, c.doorZ + (c.north ? -0.53 : 0.53)], c.north ? Math.PI : 0);
    commonRoom(b, flames, c);
  }
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [8, 0.6, 25], to: [34, 0.6, 25], count: 8 });
  pottedPlant(b, [35.2, 0, 21.8], 1.2, 3);
  pottedPlant(b, [35.2, 0, 28.2], 1.2, 7);
}

/** A common room: fireplace on the far wall, armchairs, a rug and banners in house colours. */
function commonRoom(b: LevelBuilder, flames: Glow, c: (typeof COMMON)[number]): void {
  const h = HOUSES[c.house];
  const cx = (c.x0 + c.x1) / 2;
  const farZ = c.north ? c.z1 - 0.5 : c.z0 + 0.5;
  const toward = c.north ? -1 : 1;
  // Fireplace.
  b.box([cx, 1.4, farZ - toward * 0.1], [3.4, 2.8, 0.8], { color: '#8a5a44' });
  deco(b, new BoxGeometry(2, 1.2, 0.1), [cx, 0.7, farZ + toward * 0.31], '#1e1410');
  for (let i = 0; i < 5; i++) flames.add(new ConeGeometry(0.16, 0.45, 5), [cx - 0.6 + i * 0.3, 0.3, farZ + toward * 0.36]);
  deco(b, new BoxGeometry(3.8, 0.2, 1), [cx, 2.9, farZ + toward * 0.05], COLORS.woodDark);
  rug(b, [cx, 0, (c.z0 + c.z1) / 2], 6, 4, h.color, h.trim);
  for (const side of [-1, 1]) {
    const ax = cx + side * 2.2;
    const az = farZ + toward * 3;
    b.box([ax, 0.4, az], [1.2, 0.8, 1.2], { color: h.color });
    deco(b, new BoxGeometry(1.2, 0.9, 0.3), [ax, 1.1, az - toward * 0.45], h.color);
    deco(b, new BoxGeometry(0.3, 0.5, 1.2), [ax + side * 0.5, 0.95, az], h.trim);
  }
  for (const x of [c.x0 + 1.5, c.x1 - 1.5]) deco(b, new BoxGeometry(1.2, 3.2, 0.06), [x, 3.6, farZ + toward * 0.47], h.color);
  table(b, flames, [cx, 0, (c.z0 + c.z1) / 2 + toward * 0.5], 0, 2.6, 1.1, c.x0);
  signboard(b, 'Notice board', [c.x0 + 0.53, 2.4, (c.z0 + c.z1) / 2], Math.PI / 2);
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [cx - 3, 0.6, farZ + toward * 1.5], to: [cx + 3, 0.6, farZ + toward * 1.5], count: 4 });
}

// ---------------------------------------------------------------- the Leads (the roof)

function leads(b: LevelBuilder): void {
  const R = 7.2;
  b.floor(-30.5, 30.5, 54.5, 84.5, { top: R, thickness: 1, color: '#6a6272', holes: [[8, 17, 70, 82]] });
  // Parapets with caps all round (the stair hall's wall closes the middle of the south side).
  wall(b, 'x', 84.5, -31, 31, 1.2, { base: R, color: COLORS.stoneLight, cap: 6 });
  wall(b, 'z', -30.5, 54.5, 84.5, 1.2, { base: R, color: COLORS.stoneLight, cap: 6 });
  wall(b, 'z', 30.5, 54.5, 84.5, 1.2, { base: R, color: COLORS.stoneLight, cap: 6 });
  wall(b, 'x', 54.5, -31, -5.5, 1.2, { base: R, color: COLORS.stoneLight, cap: 6 });
  wall(b, 'x', 54.5, 5.5, 31, 1.2, { base: R, color: COLORS.stoneLight, cap: 6 });
  b.add(
    { type: 'checkpoint', pos: [-2.5, R, 56.5], yaw: Math.PI / 2, zone: { min: [-6, R - 1, 54.5], max: [6, R + 4, 60] } },
    { type: 'trigger', flag: 'upper-hint-leads', script: 'upperLeads', min: [-6, R - 1, 54.5], max: [6, R + 4, 57] },
  );
  // Chimney steps up to the ridge walkway (top 11.4).
  for (const [z, top] of [
    [59, 8.6],
    [62, 10],
    [65, 11.4],
  ] as [number, number][]) {
    b.box([3, (R + top) / 2, z], [1.6, top - R, 1.6], { color: '#8a5a44', info: { noGrab: true } });
    deco(b, new BoxGeometry(1.8, 0.2, 1.8), [3, top + 0.1, z], COLORS.stoneDark);
    deco(b, new CylinderGeometry(0.2, 0.2, 0.6, 6), [3.4, top + 0.5, z + 0.3], '#5a3a2a');
  }
  b.box([4.5, 9.3, 67], [5, 4.2, 2], { color: '#6a6272', info: { noGrab: true } });
  deco(b, new BoxGeometry(5.2, 0.2, 2.2), [4.5, 11.5, 67], COLORS.stoneDark);
  b.add({ type: 'sweetLine', kind: 'fizzwort', from: [2.5, 12, 67], to: [6.5, 12, 67], count: 3 });
  // The rain cistern (x 8..17, z 70..82): freeze a path across, or take the spring tile.
  b.pool(8, 17, 70, 82, R - 0.4, 5);
  b.add(
    { type: 'iceSheet', min: [8, 74.5], max: [17, 77.5], y: R - 0.4, duration: 5, chargedDuration: 10 },
    { type: 'springPad', pos: [5.8, R, 76], radius: 1, style: 'rune', duration: 4, fling: { yaw: Math.PI / 2, speed: 9.5 } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-20, R + 0.6, 60], to: [-20, R + 0.6, 80], count: 6 },
  );
  // The observatory: a drum (top 11.4) with a dome, a lookout platform on top (14).
  b.cylinder([23, (R + 11.4) / 2, 76], 4, 11.4 - R, COLORS.stoneLight, { noGrab: true }, 16);
  deco(b, new SphereGeometry(3.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [23, 11.4, 76], '#5a6a7a');
  b.cylinder([21.3, 12.7, 76], 1.6, 2.6, COLORS.stoneLight, { noGrab: true }, 12);
  deco(b, new CylinderGeometry(0.15, 0.25, 2, 6), [21.3, 15, 75.6], '#c99a3e', [0.6, 0, 0]);
  b.add(
    { type: 'checkpoint', pos: [27.5, R, 71], yaw: -Math.PI / 2, zone: { min: [17, R - 1, 70], max: [30, R + 3, 84] } },
    { type: 'skyLift', style: 'crate', from: [23, R + 1.2, 71.4], to: [23, 11.4, 71.4], size: [1.2, 1.2], post: [0.45, -0.45], speed: 1.6 },
    { type: 'springPad', pos: [25.6, 11.4, 76], radius: 0.9, style: 'rune', duration: 0 },
    { type: 'card', card: 'chimney-imp', pos: [21.3, 15, 76] },
    { type: 'secret', id: 'upper-lookout', area: 'leads', min: [19.7, 13.8, 74.4], max: [22.9, 17, 77.6] },
    { type: 'emberCrab', pos: [26, R, 80], yaw: 0, patrol: 2.5, interval: 3 },
  );
  // Roof clutter: more chimneys, a skylight, slates.
  for (const [x, z] of [
    [-12, 62],
    [-24, 72],
    [-6, 78],
  ]) {
    b.box([x, R + 1, z], [1.4, 2, 1.4], { color: '#8a5a44' });
  }
  deco(b, new BoxGeometry(6, 0.3, 4), [-16, R + 0.15, 66], '#bfe6f4');
  crate(b, [-28, R, 82], 1);
  signboard(b, 'Observatory: Members Only', [17.4, R + 2.2, 76], -Math.PI / 2);
  // The view: hills all round, far below.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = 150 + (i % 3) * 30;
    deco(b, new IcosahedronGeometry(36 + (i % 4) * 8, 1).scale(1.5, 0.4 + (i % 3) * 0.1, 1), [Math.cos(a) * r, -40, 40 + Math.sin(a) * r], i % 2 ? '#6a8a4a' : '#5a7a44', [0, i, 0]);
  }
  b.cylinder([17.5, R + 1, 76], 0.1, 2, COLORS.woodDark, undefined, 5);
}

/** Oswin's errand: a plank ledge along the tops of the north bookcases, gaps and all. */
function errands(b: LevelBuilder): void {
  for (const [x0, x1] of [
    [-33, -25.5],
    [-23.8, -16.2],
    [-14.6, -8],
  ]) {
    b.box([(x0 + x1) / 2, 9.05, 39.45], [x1 - x0, 0.3, 1.1], { color: WOOD, pattern: 'planks' });
    for (let x = x0 + 0.4; x < x1; x += 2.2) deco(b, new BoxGeometry(0.1, 0.5, 0.9), [x, 8.7, 39.45], COLORS.woodDark, [0.6, 0, 0]);
  }
  b.add(
    { type: 'springPad', pos: [-30, 5, 37.7], radius: 0.65, style: 'rune', duration: 8 },
    { type: 'questItem', quest: 'book', pos: [-8.8, 9.25, 39.45] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-32, 9.8, 39.45], to: [-26.5, 9.8, 39.45], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-22.5, 9.8, 39.45], to: [-17.5, 9.8, 39.45], count: 3 },
  );
}

