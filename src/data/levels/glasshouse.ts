import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { barrel, bush, cobweb, crate, deco, Glow, grass, ivy, mushrooms, pottedPlant, signboard, slab, wall, wallTorch, type Hole } from '../../world/props';

/**
 * The Overgrown Glasshouse, Cindersnap's trial, through Ashcombe's iron door. Daylight
 * pours in where the roof panes have gone. South to north (+Z):
 *
 *   Potting Shed   x -5..5,  z 0..8.5    a checkpoint; vines across the door north
 *   Briar Maze     x -9..9,  z 8.5..28.5 three hedge rows (3 m, ungrabbable), each passable
 *                                        only by burning a briar plug (briars hurt to touch);
 *                                        a briar clump across lane A-B; two Gnarlings in each
 *                                        of the first two lanes; two more in lane B-C and a
 *                                        brazier there that scares them off; vines
 *                                        over the exit (east end of lane C-D)
 *   Lily Pond      x -9..9,  z 28.5..48.5 water z 31.5..44.3. A drawbridge (rope on the south
 *                                        bank) reaches the island; two crates hang on ropes over
 *                                        the water beyond it: burn them down as stepping stones
 *                                        (the ropes are too steep to aim at from the island, so
 *                                        burn them from the bank). Secret: a third crate on the
 *                                        south bank drops by the east ledge (top 2.4), along it a
 *                                        cobweb over an alcove in the east wall with a card
 *   Palm House     x -9..9,  z 48.5..68.5 a raised planter (x -3.5..3.5, z 52..64) blocks the
 *                                        view across; four braziers in the corners, notched
 *                                        I (SE), II (NW), III (SW), IV (NE), 10 s each; the
 *                                        north gate opens only while all four burn, and lighting
 *                                        one out of turn puts them all out. Two Gnarlings
 *   Snapweed Beds  x -9..9,  z 68.5..88.5 hedges zig-zag the way north through four lanes, a
 *                                        Snapweed at every corner (it bites anything in reach,
 *                                        Gnarlings too; burn it from further off); two Gnarlings
 *                                        in the last lane
 *   Bramble Heart  x -6..6,  z 88.5..100.5 an old brazier on the pedestal inside a ring of
 *                                        briars too green to burn until both braziers by the
 *                                        door are lit; lighting it opens the north gate
 *   Hothouse Pool  x -9..9,  z 100.5..138  pillars across a pool (z 104..129.5): briars on two
 *                                        to burn from the one before, Snapweeds on two more; a
 *                                        Hexling over the water; two Sootlings on planters on
 *                                        the far bank hold the Star gate until both are banished
 *   Star chamber   x -3..3,  z 138..144.5
 */
export const GLASSHOUSE: LevelDef = {
  id: 'glasshouse',
  name: 'The Overgrown Glasshouse',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'shed', name: 'The Overgrown Glasshouse', min: [-5.5, -2, 0], max: [5.5, 8, 8.5] },
    { id: 'maze', name: 'The Briar Maze', min: [-9.5, -2, 8.5], max: [9.5, 9, 28.5] },
    { id: 'pond', name: 'The Lily Pond', min: [-12.5, -4, 28.5], max: [9.5, 9, 48.5] },
    { id: 'palm', name: 'The Palm House', min: [-9.5, -2, 48.5], max: [9.5, 9, 68.5] },
    { id: 'beds', name: 'The Snapweed Beds', min: [-9.5, -2, 68.5], max: [9.5, 9, 88.5] },
    { id: 'heart', name: 'The Bramble Heart', min: [-6.5, -2, 88.5], max: [6.5, 9, 100.5] },
    { id: 'hothouse', name: 'The Hothouse Pool', min: [-9.5, -4, 100.5], max: [9.5, 10, 138] },
    { id: 'star', name: 'The Star Chamber', min: [-3.5, -2, 138], max: [3.5, 9, 144.5] },
  ],
  intro: { script: 'glasshouseIntro', unlessFlag: 'glasshouse-entered' },
  music: 'dungeon',
  build,
};

const BRICK = '#9a5a44';
const GLASS = '#b4d4c8';
const IRON = '#3a3a40';
const HEDGE = '#3f6a2a';
const FLOOR = '#9a8a6e';
const H = 6.5;

/**
 * A glasshouse wall: a brick plinth, frosted panes above it and iron glazing bars.
 * Holes are door openings (from the floor up to `top`) or windows (`bottom` > 0).
 */

/** The Star chamber, after the Hothouse Pool. */
const STAR_Z = 141.3;
function glassWall(b: LevelBuilder, axis: 'x' | 'z', at: number, from: number, to: number, holes: Hole[] = []): void {
  // Doors cut through the plinth too; windows (bottom above it) don't.
  const doors = holes.filter((h) => (h.bottom ?? 0) < 1.2).map((h) => ({ from: h.from, to: h.to, top: 1.2 }));
  wall(b, axis, at, from, to, 1.2, { color: BRICK, holes: doors });
  wall(b, axis, at, from, to, H - 1.2, {
    base: 1.2,
    color: GLASS,
    pattern: 'plain',
    thick: 0.4,
    cap: 4,
    holes: holes.map((h) => ({ from: h.from, to: h.to, bottom: Math.max(0, (h.bottom ?? 0) - 1.2), top: h.top - 1.2 })),
  });
  for (let u = from + 1.5; u < to - 0.2; u += 1.5) {
    if (holes.some((h) => u > h.from - 0.1 && u < h.to + 0.1)) continue;
    deco(b, new BoxGeometry(axis === 'x' ? 0.08 : 0.5, H - 1.2, axis === 'x' ? 0.5 : 0.08), axis === 'x' ? [u, 1.2 + (H - 1.2) / 2, at] : [at, 1.2 + (H - 1.2) / 2, u], IRON);
  }
  // Horizontal bars, broken wherever an opening crosses their height.
  for (const y of [1.25, 3.8, H - 0.05]) {
    const gaps = holes.filter((h) => y > (h.bottom ?? 0) - 0.1 && y < h.top + 0.1).sort((p, q) => p.from - q.from);
    let u0 = from;
    for (const [g0, g1] of [...gaps.map((h) => [h.from, h.to]), [to, to]]) {
      const l = g0 - u0;
      if (l > 0.05) deco(b, new BoxGeometry(axis === 'x' ? l : 0.52, 0.1, axis === 'x' ? 0.52 : l), axis === 'x' ? [(u0 + g0) / 2, y, at] : [at, y, (u0 + g0) / 2], IRON);
      u0 = Math.max(u0, g1);
    }
  }
}

/** A hedge row across the maze (x -9..9) with gaps. */
function hedgeRow(b: LevelBuilder, z: number, gaps: [number, number][]): void {
  let x = -9;
  for (const [g0, g1] of [...gaps, [9, 9] as [number, number]]) {
    if (g0 - x > 0.01) {
      b.box([(x + g0) / 2, 1.5, z], [g0 - x, 3, 0.8], { color: HEDGE, pattern: 'plain', info: { noGrab: true } });
      // Leafy clumps all over, so it reads as a hedge rather than a green wall.
      for (let u = x + 0.4; u < g0 - 0.2; u += 0.8) {
        const k = Math.abs(Math.sin(u * 12.9 + z));
        deco(b, new IcosahedronGeometry(0.42, 0), [u, 3 + k * 0.15, z], k > 0.5 ? '#4f7a34' : '#5a8a3a', [k, k * 2, 0]);
        for (const side of [-1, 1]) for (const y of [0.7, 1.9]) deco(b, new IcosahedronGeometry(0.3 + k * 0.1, 0), [u + k * 0.2, y + k * 0.4, z + side * 0.38], k > 0.3 ? '#3f6a2a' : '#4f7a34', [k * 3, k, 0]);
      }
    }
    x = g1;
  }
}

function palm(b: LevelBuilder, x: number, y: number, z: number, h: number): void {
  deco(b, new CylinderGeometry(0.16, 0.24, h, 6), [x, y + h / 2, z], '#7a5a3a', [0, 0, 0.06]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    deco(b, new BoxGeometry(0.5, 0.06, 2.2), [x + Math.sin(a) * 0.9, y + h - 0.2, z + Math.cos(a) * 0.9], i % 2 ? '#4f8a34' : '#5f9a3e', [0.4 * Math.cos(a), a, -0.4 * Math.sin(a)]);
  }
}

function build(b: LevelBuilder): void {
  b.killY = -15;
  const flames = new Glow();
  b.floor(-12.5, 9.5, -0.5, 100.5, { color: FLOOR, holes: [[-9, 9, 31.5, 44.3]] });

  // ================================================================ potting shed (z 0..8.5)
  wall(b, 'x', -0.5, -5.5, 5.5, 5, { color: BRICK, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -5.5, 0, 8.5, 5, { color: BRICK });
  wall(b, 'z', 5.5, 0, 8.5, 5, { color: BRICK });
  slab(b, -5.5, 5.5, -0.5, 8, 5.4, 0.4, COLORS.woodDark, 'planks');
  for (let z = 1; z < 8; z += 2.2) deco(b, new BoxGeometry(11, 0.3, 0.3), [0, 5.05, z], COLORS.wood);
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'ashcombe', spawn: 'fromGlasshouse' } },
    { type: 'checkpoint', pos: [-3.6, 0, 3], yaw: Math.PI / 2, zone: { min: [-5, -1, 0], max: [5, 4, 8] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3], to: [0, 0.6, 6.5], count: 3 },
    { type: 'burnable', style: 'hay', pos: [3.8, 0.5, 6.6], size: [1.2, 1, 1.2] },
    { type: 'sweet', kind: 'bramble', pos: [4.6, 0.5, 7.6] },
  );
  // The potting bench, pots and sacks.
  b.box([4.6, 0.45, 2.8], [1, 0.9, 3.2], { color: COLORS.wood, pattern: 'planks' });
  for (let i = 0; i < 4; i++) pottedPlant(b, [4.6, 0.9, 1.6 + i * 0.8], 0.6, i + 2);
  crate(b, [-4.6, 0, 7.4], 0.8);
  barrel(b, [-4.7, 0, 5.9], 0.35, 0.9);
  signboard(b, 'Vines burn.\nBriars BITE!', [-3, 2.6, 7.95], Math.PI);
  cobweb(b, [-5, 4.9, 0], [1, 0], [0, 1], 1.1);
  cobweb(b, [5, 4.9, 0], [-1, 0], [0, 1], 1.1);

  // ================================================================ the glasshouse shell
  glassWall(b, 'x', 8.5, -9.5, 9.5, [{ from: -1.2, to: 1.2, top: 3.2 }]);
  glassWall(b, 'z', -9.5, 8, 68.5, [{ from: 36.5, to: 38.5, bottom: 2.4, top: 4.8 }]);
  glassWall(b, 'z', 9.5, 8, 68.5);
  // Roof ribs: the panes between them are long gone.
  for (let z = 10.5; z < 68; z += 4) {
    deco(b, new BoxGeometry(19, 0.25, 0.25), [0, H, z], IRON);
    for (const side of [-1, 1]) deco(b, new BoxGeometry(9.6, 0.2, 0.2), [side * 4.6, H + 1.1, z], IRON, [0, 0, side * -0.23]);
  }
  deco(b, new BoxGeometry(0.3, 0.3, 60), [0, H + 2.2, 38.5], IRON);
  for (const [z, x] of [
    [14, -6],
    [30, 5],
    [50, -4],
    [62, 6],
  ]) {
    deco(b, new BoxGeometry(3.8, 0.05, 3.6), [x, H + 0.9, z], GLASS, [0, 0, x < 0 ? 0.23 : -0.23]);
  }
  ivy(b, 'z', -9.3, 9, 27, 1.2, 5.5, 1, 3);
  ivy(b, 'z', 9.3, 30, 47, 1.2, 4.5, -1, 5);
  ivy(b, 'z', -9.3, 50, 67, 1.2, 5, 1, 7);

  // ================================================================ briar maze (z 8.5..28.5)
  hedgeRow(b, 13.5, [[5.5, 7.5]]);
  hedgeRow(b, 18.5, [[-7.5, -5.5]]);
  hedgeRow(b, 23.5, [[5.5, 7.5]]);
  glassWall(b, 'x', 28.5, -9.5, 9.5, [{ from: -7.7, to: -5.3, top: 3.2 }]);
  b.add(
    { type: 'burnable', style: 'vines', pos: [0, 1.6, 8.5], size: [2.4, 3.2, 0.5] },
    { type: 'checkpoint', pos: [-7.6, 0, 10.4], yaw: Math.PI / 2, zone: { min: [-9, -1, 9], max: [9, 4, 13] } },
    { type: 'trigger', flag: 'glasshouse-hint-maze', script: 'glasshouseMaze', min: [-9, -1, 9], max: [9, 5, 11] },
    { type: 'burnable', style: 'briar', pos: [6.5, 1.5, 13.5], size: [2, 3, 0.8] },
    { type: 'burnable', style: 'briar', pos: [0, 1.5, 16], size: [4.2, 3, 0.8], yaw: Math.PI / 2 },
    { type: 'burnable', style: 'briar', pos: [-6.5, 1.5, 18.5], size: [2, 3, 0.8] },
    { type: 'burnable', style: 'briar', pos: [6.5, 1.5, 23.5], size: [2, 3, 0.8] },
    { type: 'burnable', style: 'vines', pos: [-6.5, 1.6, 28.5], size: [2.4, 3.2, 0.5] },
    // Lane B-C: Gnarlings, and a brazier they won't go near.
    { type: 'checkpoint', pos: [-8.2, 0, 21], yaw: Math.PI / 2, zone: { min: [-9, -1, 19], max: [-4, 4, 23] } },
    { type: 'trigger', flag: 'glasshouse-hint-gnarlings', script: 'glasshouseGnarlings', min: [-9, -1, 19], max: [-4, 5, 23] },
    { type: 'brazier', id: 'gfire', pos: [0.5, 0, 21] },
    { type: 'gnarling', pos: [-2.5, 0, 21], wander: 2 },
    { type: 'gnarling', pos: [4, 0, 21], wander: 2 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, 0.6, 11], to: [4, 0.6, 11], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [4, 0.6, 16], to: [-4, 0.6, 16], count: 2 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-3, 0.6, 26], to: [3, 0.6, 26], count: 3 },
    // Hay in the last lane, with something tucked behind it.
    { type: 'burnable', style: 'hay', pos: [8.2, 0.5, 25.2], size: [1.2, 1, 1.2] },
    { type: 'burnable', style: 'hay', pos: [8.2, 0.5, 26.6], size: [1.2, 1, 1.2] },
    { type: 'burnable', style: 'hay', pos: [7, 0.5, 27.4], size: [1.2, 1, 1.2] },
    { type: 'sweet', kind: 'bramble', pos: [8.4, 0.5, 27.6] },
  );
  for (const [x, z, s] of [
    [-8.3, 15, 2],
    [3, 25, 4],
    [8.3, 20, 6],
  ] as [number, number, number][]) {
    mushrooms(b, x, z, 4, s);
  }
  grass(b, -9, 9, 9, 28, 0, 2);

  // ================================================================ lily pond (z 28.5..48.5)
  b.pool(-9, 9, 31.5, 44.3, -0.5, -2.4);
  // (The floor slab is 4 m deep, so its cut edges already make the basin walls.)
  // The island.
  b.box([0, -1.25, 37.75], [4, 2.5, 2.5], { color: COLORS.stone, info: { noGrab: true } });
  deco(b, new BoxGeometry(4.1, 0.08, 2.6), [0, 0.02, 37.75], COLORS.moss);
  // The east ledge (secret route) standing in the water.
  b.box([-8, 0, 35.5], [2, 4.8, 8], { color: COLORS.stone, info: { noGrab: true } });
  deco(b, new BoxGeometry(2.1, 0.1, 8.1), [-8, 2.42, 35.5], COLORS.moss);
  // Lily pads.
  for (const [x, z] of [
    [-4, 33],
    [4.5, 34.5],
    [6, 40],
    [-5, 41.5],
    [3, 37],
  ]) {
    deco(b, new CylinderGeometry(0.5, 0.5, 0.03, 9, 1, false, 0, Math.PI * 1.75), [x, -0.42, z], '#4f8a34');
  }
  b.add(
    { type: 'checkpoint', pos: [-3.6, 0, 29.6], yaw: Math.PI / 2, zone: { min: [-9, -1, 29], max: [9, 4, 31.5] } },
    { type: 'trigger', flag: 'glasshouse-hint-pond', script: 'glasshousePond', min: [-9, -1, 29], max: [9, 5, 31.5] },
    // The drawbridge to the island, held up by a rope tied off on the bank.
    { type: 'drawbridge', pos: [0, 0, 31.5], yaw: 0, length: 5, width: 2, when: ['gr1'] },
    { type: 'burnable', id: 'gr1', style: 'rope', pos: [1.55, 2.1, 31.1], size: [0.2, 2.2, 0.2] },
    // Two crates over the water beyond the island.
    { type: 'dropper', pos: [-1, 2.5, 40.3], size: [1.4, 2.6, 1.4], floorY: -2.4, when: ['gr2'] },
    { type: 'burnable', id: 'gr2', style: 'rope', pos: [-1, 4.4, 40.3], size: [0.2, 1.2, 0.2] },
    { type: 'dropper', pos: [1, 2.5, 42.6], size: [1.4, 2.6, 1.4], floorY: -2.4, when: ['gr3'] },
    { type: 'burnable', id: 'gr3', style: 'rope', pos: [1, 4.4, 42.6], size: [0.2, 1.2, 0.2] },
    // Secret: a crate drops by the east ledge; the alcove is behind the cobweb along it.
    { type: 'dropper', pos: [-8, 3.2, 30.5], size: [1.2, 1.2, 1.2], floorY: 0, when: ['gr4'] },
    { type: 'burnable', id: 'gr4', style: 'rope', pos: [-8, 4.45, 30.5], size: [0.2, 1.3, 0.2] },
    { type: 'burnable', style: 'cobweb', pos: [-9.5, 3.6, 37.5], size: [2, 2.4, 0.3], yaw: Math.PI / 2 },
    { type: 'card', card: 'ember-newt', pos: [-11, 3.6, 37.5] },
    { type: 'secret', id: 'glasshouse-alcove', area: 'pond', min: [-12, 2, 36.5], max: [-10, 5, 38.5] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 3, 32.5], to: [-8, 3, 35.5], count: 3 },
    { type: 'checkpoint', pos: [4, 0, 46.8], yaw: -Math.PI / 2, zone: { min: [-9, -1, 44.5], max: [9, 4, 48] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-1, 0.6, 37.75], to: [1, 0.6, 37.75], count: 2 },
  );
  // The bridge's tie-off post, and the beams the crates hang from.
  b.cylinder([1.55, 1.6, 30.75], 0.14, 3.2, COLORS.woodDark, undefined, 6);
  deco(b, new BoxGeometry(0.2, 0.2, 1), [1.55, 3.2, 31.1], COLORS.woodDark);
  for (const z of [40.3, 42.6]) deco(b, new BoxGeometry(19, 0.3, 0.3), [0, 5.1, z], COLORS.woodDark);
  deco(b, new BoxGeometry(3, 0.3, 0.3), [-8, 5.2, 30.5], COLORS.woodDark);
  // The alcove: a little brick cupboard poking out of the east wall at ledge height.
  b.box([-11, 1.2, 37.5], [2.4, 2.4, 2.4], { color: BRICK });
  b.box([-11, 3.6, 36.2], [2.4, 2.4, 0.3], { color: BRICK });
  b.box([-11, 3.6, 38.8], [2.4, 2.4, 0.3], { color: BRICK });
  b.box([-12.3, 3.6, 37.5], [0.3, 2.4, 2.9], { color: BRICK });
  slab(b, -12.5, -10, 36, 39, 5.1, 0.3, COLORS.woodDark, 'planks');
  glassWall(b, 'x', 48.5, -9.5, 9.5, [{ from: -1.2, to: 1.2, top: 3.2 }]);
  for (const [x, z] of [
    [-7, 46.5],
    [7.5, 30],
  ]) {
    bush(b, x, z, 1.2, x > 0 ? 3 : 4);
  }

  // ================================================================ palm house (z 48.5..68.5)
  b.box([0, 1.5, 58], [7, 3, 12], { color: BRICK, info: { noGrab: true } });
  deco(b, new BoxGeometry(6.6, 0.1, 11.6), [0, 3.02, 58], '#5a4030');
  for (const [x, z, h] of [
    [-1.8, 54, 4.5],
    [1.6, 57.5, 5.5],
    [-1.2, 61.5, 4],
    [2, 62.6, 3.5],
  ]) {
    palm(b, x, 3, z, h);
  }
  b.add(
    { type: 'checkpoint', pos: [-4.4, 0, 49.6], yaw: Math.PI / 2, zone: { min: [-9, -1, 48.5], max: [9, 4, 51] } },
    { type: 'trigger', flag: 'glasshouse-hint-palm', script: 'glasshousePalm', min: [-9, -1, 48.5], max: [9, 5, 50.5] },
    { type: 'trigger', flag: 'glasshouse-hint-palmfail', script: 'glasshousePalmFail', when: ['palm:fail'], unlessSignals: ['h4'], perVisit: true },
    { type: 'brazier', id: 'h1', pos: [-7, 0, 50.6], group: 'palm', order: 1, duration: 10 },
    { type: 'brazier', id: 'h2', pos: [7, 0, 66.2], group: 'palm', order: 2, duration: 10 },
    { type: 'brazier', id: 'h3', pos: [7, 0, 50.6], group: 'palm', order: 3, duration: 10 },
    { type: 'brazier', id: 'h4', pos: [-7, 0, 66.2], group: 'palm', order: 4, duration: 10 },
    { type: 'gate', pos: [0, 0, 68.5], yaw: 0, width: 3, height: 3.2, when: ['h1', 'h2', 'h3', 'h4'] },
    { type: 'gnarling', pos: [-6, 0, 58], wander: 2 },
    { type: 'gnarling', pos: [6, 0, 58], wander: 2 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-6, 0.6, 53], to: [-6, 0.6, 63], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [6, 0.6, 53], to: [6, 0.6, 63], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [0, 3.6, 58] },
  );
  signboard(b, 'Light in order: I, II, III, IV\nCount the notches!', [-6, 2.4, 49.02], 0);
  for (const [x, z] of [
    [-8.6, 54],
    [8.6, 62],
    [-8.6, 62],
  ]) {
    pottedPlant(b, [x, 0, z], 1.3, Math.round(z));
  }
  glassWall(b, 'x', 68.5, -9.5, 9.5, [{ from: -1.5, to: 1.5, top: 3.4 }]);

  // ================================================================ the Bramble Heart (z 88.5..100.5)
  wall(b, 'z', -6.5, 88.5, 100.5, H, { color: BRICK, cap: 3 });
  wall(b, 'z', 6.5, 88.5, 100.5, H, { color: BRICK, cap: 3 });
  wall(b, 'x', 100.5, -6.5, 6.5, H, { color: BRICK, holes: [{ from: -1.2, to: 1.2, top: 3.4 }], cap: 3 });
  for (let z = 90; z < 100; z += 3) deco(b, new BoxGeometry(13, 0.25, 0.25), [0, H, z], IRON);
  b.cylinder([0, 0.5, 95], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, 95], '#c99a3e');
  const ring: { pos: V3; size: V3; yaw?: number }[] = [
    { pos: [0, 1.6, 93.1], size: [4.2, 3.2, 0.6] },
    { pos: [0, 1.6, 96.9], size: [4.2, 3.2, 0.6] },
    { pos: [-1.9, 1.6, 95], size: [3.2, 3.2, 0.6], yaw: Math.PI / 2 },
    { pos: [1.9, 1.6, 95], size: [3.2, 3.2, 0.6], yaw: Math.PI / 2 },
  ];
  b.add(
    { type: 'checkpoint', pos: [-4, 0, 89.6], yaw: Math.PI / 2, zone: { min: [-6, -1, 88.5], max: [6, 4, 91] } },
    { type: 'trigger', flag: 'glasshouse-hint-heart', script: 'glasshouseHeart', min: [-6, -1, 88.5], max: [6, 5, 90.5] },
    { type: 'brazier', id: 's1', pos: [-5, 0, 91.5], light: true },
    { type: 'brazier', id: 's2', pos: [5, 0, 91.5], light: true },
    ...ring.map((r) => ({ type: 'burnable' as const, style: 'briar' as const, ...r, fireproofUntil: ['s1', 's2'] })),
    // The Star and the way back moved on to the Hothouse (replaced in place: ids stay put).
    { type: 'star', id: 'glasshouse-star', pos: [0, 1.9, STAR_Z], script: 'glasshouseComplete' },
    { type: 'door', pos: [0, 0, STAR_Z + 2.65], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'ashcombe', spawn: 'fromGlasshouse' }, label: 'Back to class' },
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    deco(b, new ConeGeometry(0.25, 0.9, 5), [Math.cos(a) * 3.2, 0.45, 95 + Math.sin(a) * 3.2], '#5a3a2a', [0.2 * Math.sin(a), 0, -0.2 * Math.cos(a)]);
  }
  for (const [x, z] of [
    [-5.5, 99.5],
    [5.5, 99.5],
  ]) {
    deco(b, new SphereGeometry(0.5, 7, 5), [x, 0.4, z], '#4f7a34');
  }

  snapweedBeds(b);
  hothouse(b, flames);
  mazeGnarlings(b);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Snapweed Beds (z 68.5..88.5), between the Palm House and the Bramble Heart. Built
 * last so the earlier rooms' sweets keep their ids.
 */
function snapweedBeds(b: LevelBuilder): void {
  glassWall(b, 'z', -9.5, 68.5, 88.5);
  glassWall(b, 'z', 9.5, 68.5, 88.5);
  glassWall(b, 'x', 88.5, -9.5, 9.5, [{ from: -1.2, to: 1.2, top: 3.2 }]);
  for (let z = 70.5; z < 88; z += 4) {
    deco(b, new BoxGeometry(19, 0.25, 0.25), [0, H, z], IRON);
    for (const side of [-1, 1]) deco(b, new BoxGeometry(9.6, 0.2, 0.2), [side * 4.6, H + 1.1, z], IRON, [0, 0, side * -0.23]);
  }
  // Four lanes, the gaps alternating west and east.
  hedgeRow(b, 73.5, [[5, 9]]);
  hedgeRow(b, 78.5, [[-9, -5]]);
  hedgeRow(b, 83.5, [[5, 9]]);
  b.add(
    { type: 'checkpoint', pos: [-7.6, 0, 70.6], yaw: Math.PI / 2, zone: { min: [-9, -1, 69], max: [9, 4, 73] } },
    { type: 'trigger', flag: 'glasshouse-hint-weeds', script: 'glasshouseWeeds', min: [-9, -1, 68.5], max: [9, 5, 70.5] },
    { type: 'snapweed', pos: [7, 0, 71.2] },
    { type: 'snapweed', pos: [6.8, 0, 76.2] },
    { type: 'snapweed', pos: [-7, 0, 75.9] },
    { type: 'snapweed', pos: [-0.5, 0, 80.8] },
    { type: 'snapweed', pos: [7, 0, 81.2] },
    { type: 'checkpoint', pos: [-8, 0, 81], yaw: Math.PI / 2, zone: { min: [-9, -1, 79], max: [-4, 4, 83] } },
    { type: 'snapweed', pos: [6.8, 0, 86.2] },
    { type: 'snapweed', pos: [-3, 0, 86.3] },
    { type: 'gnarling', pos: [2, 0, 86], wander: 2.5 },
    { type: 'gnarling', pos: [-6, 0, 86], wander: 2 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, 0.6, 71], to: [3, 0.6, 71], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [3, 0.6, 76], to: [-3, 0.6, 76], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [-8.3, 0.6, 76] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-3, 0.6, 81], to: [4, 0.6, 81], count: 4 },
  );
  // On posts in front of the hedge: hung on it, its leaf clumps covered the words.
  signboard(b, 'Snapweed!\nDo not feed.', [0, 2.2, 72.55], Math.PI);
  for (const x of [-0.9, 0.9]) deco(b, new BoxGeometry(0.12, 2.2, 0.12), [x, 1.1, 72.66], COLORS.woodDark);
  grass(b, -9, 9, 69, 88, 0, 2);
  for (const [x, z, sd] of [
    [-8.3, 72, 3],
    [3, 87.4, 5],
    [8.3, 79.5, 7],
  ] as [number, number, number][]) {
    mushrooms(b, x, z, 4, sd);
  }
}

/**
 * More Gnarlings in the maze's first two lanes, so it's a fight from the start, not just in
 * the brazier lane. Built last so the earlier specs keep their ids.
 */
function mazeGnarlings(b: LevelBuilder): void {
  b.add(
    // Lane A (z 8.5..13.5), guarding the burnable plug at its far end.
    { type: 'gnarling', pos: [3, 0, 11.6], wander: 2 },
    { type: 'gnarling', pos: [7, 0, 11.2], wander: 1.5 },
    // Lane B (z 13.5..18.5), one either side of the briar clump.
    { type: 'gnarling', pos: [4, 0, 16], wander: 2 },
    { type: 'gnarling', pos: [-4.5, 0, 16], wander: 2 },
  );
}

/**
 * The Hothouse Pool (z 100.5..138): pillars over water with briars and Snapweeds to burn on
 * the way, a Hexling, and two Sootlings who hold the Star gate. The Bramble Heart's pedestal
 * brazier opens the way in. Built last so the earlier rooms' sweets keep their ids.
 */
function hothouse(b: LevelBuilder, flames: Glow): void {
  const Z0 = 100.5;
  const Z1 = 138;
  const W = -0.6;
  // The Bramble Heart is narrower than the Hothouse: brick up the gaps either side of its door wall.
  for (const x of [-8, 8]) b.box([x, H / 2, Z0], [3, H, 1], { color: BRICK });
  b.floor(-9.5, 9.5, Z0, Z1 + 6.5, { color: '#7a6a52', holes: [[-9, 9, 104, 129.5]] });
  b.pool(-9, 9, 104, 129.5, W, -3);
  glassWall(b, 'z', -9.5, Z0, Z1);
  glassWall(b, 'z', 9.5, Z0, Z1);
  glassWall(b, 'x', Z1, -9.5, 9.5, [{ from: -1.5, to: 1.5, top: 3.4 }]);
  for (let z = Z0 + 2; z < Z1; z += 3) deco(b, new BoxGeometry(19, 0.25, 0.25), [0, H, z], IRON);
  const pillars: [number, number][] = [
    [0, 106.2],
    [-2.4, 108.8],
    [0, 111.4],
    [2.6, 114],
    [0.4, 116.8],
    [-2.2, 119.4],
    [0, 122],
    [2.4, 124.6],
    [0.4, 127.2],
  ];
  for (const [x, z] of pillars) {
    b.box([x, -1.5, z], [1.6, 3, 1.6], { color: COLORS.stoneLight, info: { noGrab: true } });
    deco(b, new BoxGeometry(1.75, 0.1, 1.75), [x, -0.04, z], '#4f7a34');
  }
  // Raised planters on the far bank for the Sootlings.
  for (const x of [-6, 6]) {
    b.box([x, 0.8, 134], [3, 1.6, 3], { color: BRICK });
    deco(b, new BoxGeometry(2.8, 0.1, 2.8), [x, 1.62, 134], '#5a4030');
  }
  b.add(
    { type: 'gate', pos: [0, 0, Z0], yaw: 0, width: 2.4, height: 3.2, when: ['g-heart'] },
    { type: 'brazier', id: 'g-heart', pos: [0, 1, 95], light: true },
    { type: 'checkpoint', pos: [-7, 0, 102.2], yaw: Math.PI / 2, zone: { min: [-9, -1, 100.8], max: [9, 4, 104] } },
    { type: 'trigger', flag: 'glasshouse-hint-hothouse', script: 'glasshouseHothouse', min: [-9, -1, 100.8], max: [9, 4, 103.5] },
    { type: 'burnable', style: 'briar', pos: [-2.4, 1.3, 108.8], size: [1.5, 2.6, 1.5] },
    { type: 'snapweed', pos: [2.6, 0, 114], radius: 1.7 },
    { type: 'burnable', style: 'briar', pos: [-2.2, 1.3, 119.4], size: [1.5, 2.6, 1.5] },
    { type: 'snapweed', pos: [0, 0, 122], radius: 1.7 },
    { type: 'hexling', pos: [0, 0, 116], height: 4.5, radius: 4, interval: 3.4 },
    { type: 'sootling', id: 'g-soot1', pos: [-6, 1.6, 134], yaw: Math.PI, wander: 0.5, range: 22, interval: 3.8 },
    { type: 'sootling', id: 'g-soot2', pos: [6, 1.6, 134], yaw: Math.PI, wander: 0.5, range: 22, interval: 4.2 },
    { type: 'checkpoint', pos: [0, 0, 131], yaw: 0, zone: { min: [-9, -1, 129.6], max: [9, 4, 132] } },
    { type: 'gate', pos: [0, 0, Z1], yaw: 0, width: 3, height: 3, when: ['g-soot1', 'g-soot2'] },
    { type: 'sweet', kind: 'bramble', pos: [0, 0.7, 111.4] },
    { type: 'sweet', kind: 'bramble', pos: [0.4, 0.7, 116.8] },
    { type: 'sweet', kind: 'humbug', pos: [8, 0.6, 136.5] },
  );
  for (const [x, z, h] of [
    [-7.5, 106, 4],
    [7.5, 121, 5],
  ]) {
    palm(b, x, W, z, h);
  }
  // The Star chamber: brick, with a little roof of glass.
  wall(b, 'z', -3.5, Z1, Z1 + 6.5, H, { color: BRICK, cap: 3 });
  wall(b, 'z', 3.5, Z1, Z1 + 6.5, H, { color: BRICK, cap: 3 });
  wall(b, 'x', Z1 + 6.5, -3.5, 3.5, H, { color: BRICK, cap: 3 });
  b.cylinder([0, 0.5, STAR_Z], 0.7, 1, COLORS.stoneLight, undefined, 8);
  deco(b, new CylinderGeometry(0.85, 0.85, 0.12, 8), [0, 1.06, STAR_Z], '#c99a3e');
  for (const x of [-2.98, 2.98]) wallTorch(b, flames, [x, 2.6, Z1 + 1.6], x < 0 ? Math.PI / 2 : -Math.PI / 2);
}

