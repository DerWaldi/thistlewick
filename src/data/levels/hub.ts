import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildShelfMesh } from '../../entities/hubObjects';
import { paintPortrait } from '../../ui/portraits';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { CARD_BY_ID } from '../cards';
import { HOUSE_ORDER, HOUSES } from '../houses';
import type { PortraitSpec } from '../portraits';

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

// ---------------------------------------------------------------- helpers

interface Hole {
  from: number;
  to: number;
  bottom?: number;
  top: number;
}

/**
 * A straight wall along X (at z = `at`) or Z (at x = `at`) from `a` to `b`, with
 * rectangular openings. `base` is the floor height.
 */
function wall(
  b: LevelBuilder,
  axis: 'x' | 'z',
  at: number,
  a: number,
  bEnd: number,
  height: number,
  opts: { base?: number; thick?: number; color?: string; holes?: Hole[] } = {},
): void {
  const base = opts.base ?? 0;
  const t = opts.thick ?? 1;
  const color = opts.color ?? COLORS.stone;
  const piece = (from: number, to: number, y0: number, y1: number) => {
    if (to - from < 0.01 || y1 - y0 < 0.01) return;
    const mid = (from + to) / 2;
    const center: V3 = axis === 'x' ? [mid, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, mid];
    const size: V3 = axis === 'x' ? [to - from, y1 - y0, t] : [t, y1 - y0, to - from];
    b.box(center, size, { color });
  };
  const holes = [...(opts.holes ?? [])].sort((p, q) => p.from - q.from);
  let cursor = a;
  for (const h of holes) {
    piece(cursor, h.from, base, base + height);
    piece(h.from, h.to, base + h.top, base + height);
    if (h.bottom) piece(h.from, h.to, base, base + h.bottom);
    cursor = h.to;
  }
  piece(cursor, bEnd, base, base + height);
}

/** A slab: floor/ceiling/roof. */
function slab(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, top: number, thick: number, color: string, pattern: 'stone' | 'planks' | 'plaster' = 'stone'): void {
  b.box([(x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2], [x1 - x0, thick, z1 - z0], { color, pattern });
}

/** Static decorative geometry helpers (merged into the level mesh, no colliders). */
function deco(b: LevelBuilder, geo: BufferGeometry, pos: V3, color: string, rot?: V3): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(...pos);
  b.geo(g, color);
}

function column(b: LevelBuilder, x: number, z: number, h: number, base = 0): void {
  b.cylinder([x, base + h / 2, z], 0.35, h, COLORS.stoneLight, undefined, 8);
  deco(b, new BoxGeometry(0.95, 0.3, 0.95), [x, base + 0.15, z], COLORS.stoneDark);
  deco(b, new BoxGeometry(0.95, 0.3, 0.95), [x, base + h - 0.15, z], COLORS.stoneDark);
}

/** Collected emissive panes (windows, candle flames) so they render in one draw call. */
class Glow {
  private geos: BufferGeometry[] = [];
  add(geo: BufferGeometry, pos: V3, rotY = 0): void {
    const g = (geo.index ? geo.toNonIndexed() : geo).rotateY(rotY).translate(...pos);
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    this.geos.push(g);
  }
  finish(b: LevelBuilder, color: string): void {
    if (!this.geos.length) return;
    const m = new Mesh(mergeGeometries(this.geos)!, new MeshBasicMaterial({ color: new Color(color), fog: true }));
    b.prop(m);
  }
}

/** A tall arched window: glowing panes behind a dark mullion frame. */
function windowPane(b: LevelBuilder, glow: Glow, axis: 'x' | 'z', at: number, along: number, y: number, w: number, h: number, facing: 1 | -1): void {
  const rot = axis === 'x' ? (facing > 0 ? 0 : Math.PI) : facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  const off = 0.52 * facing;
  const p: V3 = axis === 'x' ? [along, y, at + off] : [at + off, y, along];
  glow.add(new PlaneGeometry(w, h), p, rot);
  glow.add(new CircleGeometry(w / 2, 12, 0, Math.PI), axis === 'x' ? [along, y + h / 2, at + off] : [at + off, y + h / 2, along], rot);
  const frame = (gw: number, gh: number, dx: number, dy: number) => {
    const g = new BoxGeometry(gw, gh, 0.08).rotateY(rot);
    const fp: V3 = axis === 'x' ? [along + dx, y + dy, at + off * 1.05] : [at + off * 1.05, y + dy, along + dx];
    deco(b, g, fp, '#2b2230');
  };
  frame(0.08, h, 0, 0);
  frame(w, 0.08, 0, 0);
  frame(w, 0.08, 0, -h / 4);
  frame(w, 0.08, 0, h / 4);
  // Sill.
  const sill = new BoxGeometry(axis === 'x' ? w + 0.3 : 0.4, 0.12, axis === 'x' ? 0.4 : w + 0.3);
  deco(b, sill, axis === 'x' ? [along, y - h / 2 - 0.06, at + off * 0.6] : [at + off * 0.6, y - h / 2 - 0.06, along], COLORS.stoneLight);
}

/** A framed portrait on a wall, slightly crooked. */
function portrait(b: LevelBuilder, spec: PortraitSpec, pos: V3, rotY: number, w = 1.2, h = 1.5, tilt = 0): void {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 200;
  paintPortrait(c.getContext('2d')!, spec, 160, 200);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const pic = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  pic.position.set(...pos);
  pic.rotation.set(0, rotY, tilt);
  pic.translateZ(0.06);
  b.prop(pic);
  // The gilt frame goes into the merged level mesh.
  const frame = new BoxGeometry(w + 0.24, h + 0.24, 0.1).toNonIndexed().rotateZ(tilt).rotateY(rotY).translate(...pos);
  b.geo(frame, '#c99a3e');
}

/** A hanging house banner, baked into the level mesh (it doesn't move). */
function banner(b: LevelBuilder, pos: V3, rotY: number, color: string, trim: string, w = 1.6, h = 4): void {
  const place = (geo: BufferGeometry, x: number, y: number, z: number, c: string) => {
    const g = (geo.index ? geo.toNonIndexed() : geo).translate(x, y, z).rotateY(rotY).translate(...pos);
    b.geo(g, c);
  };
  place(new BoxGeometry(w, h, 0.02), 0, 0, 0, color);
  place(new BoxGeometry(w, 0.25, 0.03), 0, -h / 2 + 0.6, 0.01, trim);
  place(new ConeGeometry(w / 2, 0.6, 3).rotateZ(Math.PI).scale(1, 1, 0.05), 0, -h / 2 - 0.3, 0, color);
  place(new CylinderGeometry(0.05, 0.05, w + 0.4, 6).rotateZ(Math.PI / 2), 0, h / 2, 0, '#3a2617');
}

function shelf(b: LevelBuilder, pos: V3, rotY: number, w: number, h: number, collide = true): void {
  const m = buildShelfMesh(w, h, pos[0] * 13.7 + pos[2] * 5.1);
  m.position.set(...pos);
  m.rotation.y = rotY;
  b.prop(m);
  if (collide) {
    const along = Math.abs(Math.sin(rotY)) > 0.5;
    b.box([pos[0], pos[1] + h / 2, pos[2]], along ? [0.5, h, w] : [w, h, 0.5], { invisible: true });
  }
}

/** A great wooden wheel chandelier with candles; its top is walkable. */
function chandelier(b: LevelBuilder, glow: Glow, x: number, y: number, z: number, r: number, lit: boolean): void {
  b.cylinder([x, y, z], r, 0.3, COLORS.woodDark, undefined, 12, 'planks');
  deco(b, new TorusGeometry(r, 0.08, 4, 16), [x, y - 0.12, z], '#2a2230', [Math.PI / 2, 0, 0]);
  deco(b, new CylinderGeometry(0.03, 0.03, 12 - y, 4), [x, y + (12 - y) / 2, z], '#2a2230');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx = x + Math.cos(a) * (r - 0.15);
    const cz = z + Math.sin(a) * (r - 0.15);
    deco(b, new CylinderGeometry(0.05, 0.05, 0.25, 5), [cx, y + 0.27, cz], '#efe6d2');
    glow.add(new ConeGeometry(0.05, 0.12, 4), [cx, y + 0.45, cz]);
  }
  if (lit) {
    const light = new PointLight('#ffc070', 22, 22, 1.6);
    light.position.set(x, y - 0.6, z);
    b.prop(light);
  }
}

function hollyhock(b: LevelBuilder, x: number, z: number, seed: number): void {
  const colors = ['#e88ab0', '#c45a9a', '#f2b8d0', '#b05aa8', '#f5d0e0'];
  const h = 1.6 + ((seed * 7919) % 100) / 100;
  deco(b, new CylinderGeometry(0.03, 0.05, h, 4), [x, h / 2, z], '#4f7a34');
  for (let i = 0; i < 6; i++) {
    const y = h * 0.45 + i * (h * 0.09);
    const c = colors[(seed + i) % colors.length];
    deco(b, new IcosahedronGeometry(0.12 - i * 0.012, 0), [x + Math.sin(i * 2.4) * 0.08, y, z + Math.cos(i * 2.4) * 0.08], c);
  }
  deco(b, new ConeGeometry(0.18, 0.4, 4), [x, 0.2, z], '#5f8a3e');
}

function tree(b: LevelBuilder, x: number, z: number): void {
  b.cylinder([x, 2, z], 0.45, 4, '#6b4a2e', undefined, 7, 'plain');
  deco(b, new CylinderGeometry(0.25, 0.4, 3, 6), [x + 0.6, 4.6, z + 0.2], '#6b4a2e', [0, 0, -0.45]);
  deco(b, new CylinderGeometry(0.2, 0.3, 2.5, 6), [x - 0.5, 4.8, z - 0.3], '#6b4a2e', [0.3, 0, 0.4]);
  for (const [dx, dy, dz, r] of [
    [0, 6.4, 0, 2.4],
    [1.6, 5.8, 0.6, 1.8],
    [-1.4, 6, -0.8, 1.9],
    [0.4, 7.4, -0.4, 1.6],
  ]) {
    deco(b, new IcosahedronGeometry(r, 0), [x + dx, dy, z + dz], '#6e9a3e');
  }
}

function crate(b: LevelBuilder, pos: V3, s = 1): void {
  b.box([pos[0], pos[1] + s / 2, pos[2]], [s, s, s], { color: COLORS.wood, pattern: 'planks' });
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + s - 0.1, pos[2]], COLORS.woodDark);
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + 0.1, pos[2]], COLORS.woodDark);
}

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
      { from: 8, to: 10, bottom: 5, top: 8 }, // gallery door onto the cloister roof
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
    { type: 'npc', speaker: 'wendlebury', pos: [3, 0, 7], yaw: -Math.PI / 2 - 0.4, look: { robe: '#5d4470', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#3b2c55', scale: 1.25 }, talk: 'wendlebury' },
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 4, height: 5.5, talk: 'frontDoors' },
  );

  // House banners on the east wall, windows on both long walls.
  HOUSE_ORDER.forEach((h, i) => banner(b, [11.95, 7.5, 3 + i * 4], -Math.PI / 2, HOUSES[h].color, HOUSES[h].trim));
  for (const z of [4, 10, 16]) windowPane(b, glow, 'z', -12.5, z, 8, 1.6, 3.6, 1);
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
  for (const x of [-6, -2.5, 1, 4.5]) shelf(b, [x, 5, 29.6], 0, 3, 3.2);
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
    { type: 'npc', speaker: 'tansy', pos: [-16.8, 0, 6.6], yaw: Math.PI / 2, look: { robe: '#46395f', scarf: HOUSES.yarrowdown.color, trim: HOUSES.yarrowdown.trim, hat: '#c8642e' }, talk: 'tansy' },
    { type: 'npc', speaker: 'moss', pos: [-16.8, 0, 9.4], yaw: Math.PI / 2, look: { robe: '#46395f', scarf: HOUSES.nettleby.color, trim: HOUSES.nettleby.trim, hat: '#6b3f4f' }, talk: 'moss' },
  );
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
    // The secret door: slides east into the wall when the book-switch opposite is knocked.
    { type: 'bookshelf', pos: [20, 0, 10.25], yaw: Math.PI, width: 2, height: 2.6, slide: 2.1, when: ['cc-book'] },
    { type: 'knockSwitch', id: 'cc-book', pos: [19.6, 1.95, 6.55], yaw: 0, style: 'book' },
  );
  wall(b, 'x', 13.5, 18.5, 21.5, 3.2, { thick: 1 });
  wall(b, 'z', 18.5, 10.5, 13.5, 3.2, { thick: 1 });
  wall(b, 'z', 21.5, 10.5, 13.5, 3.2, { thick: 1 });
  slab(b, 18, 22, 10.5, 14, 3.4, 0.4, COLORS.stoneDark);
  b.add(
    { type: 'card', card: 'barnaby-gorse', pos: [20, 1.2, 12.2] },
    { type: 'secret', id: 'hub-bookshelf', area: 'corridor', min: [19, -1, 10.8], max: [21, 3, 13.2] },
  );
  portrait(b, { bg: ['#f2c49a', '#a0522d'], kind: 'person', skin: '#e2a982', robe: '#a0522d', hair: '#e8e2d0', hat: 'none', beard: true, prop: 'wand' }, [25.95, 2.6, 13], -Math.PI / 2, 1.1, 1.4, -0.08);
  portrait(b, CARD_BY_ID.get('hester-quillfeather')!.portrait, [32, 4.6, 22.95], Math.PI, 1.1, 1.4, 0.07);
  b.lantern([13.2, 3.4, 8], 6, 10);
  b.lantern([25.6, 3.6, 13.5], 0, 0, false);
  b.lantern([36, 6.4, 18.2], 7, 12);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [14, 0.6, 8], to: [24, 0.6, 8], count: 8 },
    { type: 'sweetLine', kind: 'fizzwort', from: [24, 0.6, 11.5], to: [24, 0.6, 16.5], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [28.5, 0.9, 20.5], to: [33.5, 3.6, 20.5], count: 5 },
    { type: 'door', pos: [42, 3, 20.5], yaw: -Math.PI / 2, width: 2.4, height: 3.4, talk: 'classroomDoor', label: 'Practical Charms' },
    { type: 'checkpoint', pos: [40.5, 3, 18.5], yaw: 0 },
  );

  // ================================================================ HOLLYHOCK COURT (x -16..16, z 30..62)
  const W = 8;
  // Side walls are too tall to climb from the cloister roof; the north wall's top is a
  // walkway (with a parapet) that leads behind the clock tower.
  wall(b, 'z', -16.5, 30, 64, 10.5);
  wall(b, 'z', 16.5, 30, 64, 10.5, { holes: [{ from: 44.5, to: 47.5, top: 3.5 }] });
  wall(b, 'x', 63, -16, 16, W, { thick: 2 });
  b.box([0, W + 0.55, 63.85], [32, 1.1, 0.3], { color: COLORS.stoneLight });
  for (let x = -15; x <= 15; x += 2) deco(b, new BoxGeometry(0.8, 0.4, 0.32), [x, W + 1.3, 63.85], COLORS.stoneLight);
  // Grass beds and paths.
  for (const [x0, x1, z0, z1] of [
    [-12, -6, 35, 57],
    [6, 12, 35, 57],
    [-6, 6, 53, 57],
    [-6, 6, 35, 39],
  ]) {
    deco(b, new BoxGeometry(x1 - x0, 0.06, z1 - z0), [(x0 + x1) / 2, 0.03, (z0 + z1) / 2], '#7f9a5a');
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
  b.add(
    { type: 'gnarling', pos: [-9, 0, 50], wander: 3, requires: 'thwackwort' },
    { type: 'gnarling', pos: [9, 0, 44], wander: 3, requires: 'thwackwort' },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 32], to: [0, 0.6, 39.5], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 0.6, 40], to: [-8, 0.6, 52], count: 6 },
    { type: 'sweetLine', kind: 'fizzwort', from: [8, 0.6, 48], to: [8, 0.6, 56], count: 5 },
    { type: 'checkpoint', pos: [3.5, 0, 32.5], yaw: 0 },
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

function signboard(b: LevelBuilder, text: string, pos: V3, rotY: number): void {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 110;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5e3b22';
  g.fillRect(0, 0, 512, 110);
  g.strokeStyle = '#c99a3e';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 98);
  g.fillStyle = '#f2d48a';
  g.font = 'italic bold 46px Palatino, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 58);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(2.6, 0.56), new MeshBasicMaterial({ map: tex, fog: true }));
  m.position.set(...pos);
  m.rotation.y = rotY;
  b.prop(m);
}
