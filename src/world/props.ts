import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
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
import type { PortraitSpec } from '../data/portraits';
import { buildShelfMesh } from '../entities/hubObjects';
import { paintPortrait } from '../ui/portraits';
import type { LevelBuilder, V3 } from './builder';
import { COLORS } from './materials';

/*
 * Reusable level-building pieces: walls with openings, slabs, windows, shelves,
 * portraits, banners, chandeliers, plants. Static ones bake into the merged level mesh.
 */


export interface Hole {
  from: number;
  to: number;
  bottom?: number;
  top: number;
}

/**
 * A straight wall along X (at z = `at`) or Z (at x = `at`) from `a` to `b`, with
 * rectangular openings. `base` is the floor height.
 */
export function wall(
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
export function slab(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, top: number, thick: number, color: string, pattern: 'stone' | 'planks' | 'plaster' = 'stone'): void {
  b.box([(x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2], [x1 - x0, thick, z1 - z0], { color, pattern });
}

/** Static decorative geometry helpers (merged into the level mesh, no colliders). */
export function deco(b: LevelBuilder, geo: BufferGeometry, pos: V3, color: string, rot?: V3): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(...pos);
  b.geo(g, color);
}

export function column(b: LevelBuilder, x: number, z: number, h: number, base = 0): void {
  b.cylinder([x, base + h / 2, z], 0.35, h, COLORS.stoneLight, undefined, 8);
  deco(b, new BoxGeometry(0.95, 0.3, 0.95), [x, base + 0.15, z], COLORS.stoneDark);
  deco(b, new BoxGeometry(0.95, 0.3, 0.95), [x, base + h - 0.15, z], COLORS.stoneDark);
}

/** Collected emissive panes (windows, candle flames) so they render in one draw call. */
export class Glow {
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
export function windowPane(b: LevelBuilder, glow: Glow, axis: 'x' | 'z', at: number, along: number, y: number, w: number, h: number, facing: 1 | -1): void {
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
export function portrait(b: LevelBuilder, spec: PortraitSpec, pos: V3, rotY: number, w = 1.2, h = 1.5, tilt = 0): void {
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
export function banner(b: LevelBuilder, pos: V3, rotY: number, color: string, trim: string, w = 1.6, h = 4): void {
  const place = (geo: BufferGeometry, x: number, y: number, z: number, c: string) => {
    const g = (geo.index ? geo.toNonIndexed() : geo).translate(x, y, z).rotateY(rotY).translate(...pos);
    b.geo(g, c);
  };
  place(new BoxGeometry(w, h, 0.02), 0, 0, 0, color);
  place(new BoxGeometry(w, 0.25, 0.03), 0, -h / 2 + 0.6, 0.01, trim);
  place(new ConeGeometry(w / 2, 0.6, 3).rotateZ(Math.PI).scale(1, 1, 0.05), 0, -h / 2 - 0.3, 0, color);
  place(new CylinderGeometry(0.05, 0.05, w + 0.4, 6).rotateZ(Math.PI / 2), 0, h / 2, 0, '#3a2617');
}

export function shelf(b: LevelBuilder, pos: V3, rotY: number, w: number, h: number, collide = true): void {
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
export function chandelier(b: LevelBuilder, glow: Glow, x: number, y: number, z: number, r: number, lit: boolean): void {
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

export function hollyhock(b: LevelBuilder, x: number, z: number, seed: number): void {
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

export function tree(b: LevelBuilder, x: number, z: number): void {
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

export function crate(b: LevelBuilder, pos: V3, s = 1): void {
  b.box([pos[0], pos[1] + s / 2, pos[2]], [s, s, s], { color: COLORS.wood, pattern: 'planks' });
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + s - 0.1, pos[2]], COLORS.woodDark);
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + 0.1, pos[2]], COLORS.woodDark);
}


export function signboard(b: LevelBuilder, text: string, pos: V3, rotY: number): void {
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
