import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PortraitSpec } from '../data/portraits';
import { buildShelfMesh } from '../entities/hubObjects';
import { paintPortrait } from '../ui/portraits';
import type { LevelBuilder, V3 } from './builder';
import { COLORS, type Pattern } from './materials';

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
  opts: { base?: number; thick?: number; color?: string; holes?: Hole[]; cap?: number; pattern?: Pattern } = {},
): void {
  const base = opts.base ?? 0;
  const t = opts.thick ?? 1;
  const color = opts.color ?? COLORS.stone;
  // Boundary walls whose tops could be reached get an invisible extension, so nobody
  // climbs out of the level.
  if (opts.cap) {
    const mid = (a + bEnd) / 2;
    const len = bEnd - a;
    const y = base + height + opts.cap / 2;
    b.box(axis === 'x' ? [mid, y, at] : [at, y, mid], axis === 'x' ? [len, opts.cap, t] : [t, opts.cap, len], { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  }
  const piece = (from: number, to: number, y0: number, y1: number) => {
    if (to - from < 0.01 || y1 - y0 < 0.01) return;
    const mid = (from + to) / 2;
    const center: V3 = axis === 'x' ? [mid, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, mid];
    const size: V3 = axis === 'x' ? [to - from, y1 - y0, t] : [t, y1 - y0, to - from];
    b.box(center, size, { color, pattern: opts.pattern });
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
    // Over-bright so the bloom pass gives windows and flames a soft halo.
    const m = new Mesh(mergeGeometries(this.geos)!, new MeshBasicMaterial({ color: new Color(color).multiplyScalar(1.9), fog: true }));
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
  c.width = 240;
  c.height = 300;
  paintPortrait(c.getContext('2d')!, spec, 240, 300);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const pic = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  pic.position.set(...pos);
  pic.rotation.set(0, rotY, tilt);
  pic.translateZ(0.06);
  b.prop(pic);
  // An ornate gilt frame (merged into the level mesh): a dark backing, a stepped
  // moulding with a bright inner lip, corner rosettes and a brass name plaque.
  const place = (geo: BufferGeometry, x: number, y: number, z: number, c: string) => {
    b.geo((geo.index ? geo.toNonIndexed() : geo).translate(x, y, z).rotateZ(tilt).rotateY(rotY).translate(...pos), c);
  };
  const F = 0.16;
  place(new BoxGeometry(w + 0.1, h + 0.1, 0.06), 0, 0, 0, '#3a2617');
  for (const [x, y, bw, bh] of [
    [0, h / 2 + F / 2, w + F * 2, F],
    [0, -h / 2 - F / 2, w + F * 2, F],
    [-w / 2 - F / 2, 0, F, h],
    [w / 2 + F / 2, 0, F, h],
  ] as const) {
    place(new BoxGeometry(bw, bh, 0.12), x, y, 0.02, '#a87a2c');
    // Raised bead along the middle of each side.
    const along = bw > bh;
    place(new BoxGeometry(along ? bw - F : F * 0.4, along ? F * 0.4 : bh - F, 0.05), x, y, 0.1, '#e0b85a');
  }
  // Inner lip hugging the canvas.
  for (const [x, y, bw, bh] of [
    [0, h / 2 + 0.02, w + 0.04, 0.04],
    [0, -h / 2 - 0.02, w + 0.04, 0.04],
    [-w / 2 - 0.02, 0, 0.04, h],
    [w / 2 + 0.02, 0, 0.04, h],
  ] as const) {
    place(new BoxGeometry(bw, bh, 0.1), x, y, 0.04, '#f0cf78');
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = sx * (w / 2 + F / 2);
      const cy = sy * (h / 2 + F / 2);
      place(new BoxGeometry(F * 1.25, F * 1.25, 0.14), cx, cy, 0.03, '#b88a34');
      place(new SphereGeometry(F * 0.42, 8, 6), cx, cy, 0.12, '#f0cf78');
    }
  }
  // A crest on top and the plaque below.
  place(new SphereGeometry(F * 0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 1, 0.4), 0, h / 2 + F, 0.03, '#c99a3e');
  place(new BoxGeometry(w * 0.45, 0.12, 0.04), 0, -h / 2 - F - 0.12, 0.02, '#d4a94a');
  place(new BoxGeometry(w * 0.38, 0.06, 0.02), 0, -h / 2 - F - 0.12, 0.05, '#4a3420');
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

export function hollyhock(b: LevelBuilder, x: number, z: number, seed: number, y0 = 0): void {
  const colors = ['#e88ab0', '#c45a9a', '#f2b8d0', '#b05aa8', '#f5d0e0'];
  const h = 1.6 + ((seed * 7919) % 100) / 100;
  deco(b, new CylinderGeometry(0.03, 0.05, h, 4), [x, y0 + h / 2, z], '#4f7a34');
  for (let i = 0; i < 6; i++) {
    const y = y0 + h * 0.45 + i * (h * 0.09);
    const c = colors[(seed + i) % colors.length];
    deco(b, new IcosahedronGeometry(0.12 - i * 0.012, 0), [x + Math.sin(i * 2.4) * 0.08, y, z + Math.cos(i * 2.4) * 0.08], c);
  }
  deco(b, new ConeGeometry(0.18, 0.4, 4), [x, y0 + 0.2, z], '#5f8a3e');
}

export function tree(b: LevelBuilder, x: number, z: number, y0 = 0): void {
  b.cylinder([x, y0 + 2, z], 0.45, 4, '#6b4a2e', undefined, 7, 'plain');
  deco(b, new CylinderGeometry(0.25, 0.4, 3, 6), [x + 0.6, y0 + 4.6, z + 0.2], '#6b4a2e', [0, 0, -0.45]);
  deco(b, new CylinderGeometry(0.2, 0.3, 2.5, 6), [x - 0.5, y0 + 4.8, z - 0.3], '#6b4a2e', [0.3, 0, 0.4]);
  for (const [dx, dy, dz, r] of [
    [0, 6.4, 0, 2.4],
    [1.6, 5.8, 0.6, 1.8],
    [-1.4, 6, -0.8, 1.9],
    [0.4, 7.4, -0.4, 1.6],
  ]) {
    deco(b, new IcosahedronGeometry(r, 0), [x + dx, y0 + dy, z + dz], '#6e9a3e');
  }
}

export function crate(b: LevelBuilder, pos: V3, s = 1): void {
  b.box([pos[0], pos[1] + s / 2, pos[2]], [s, s, s], { color: COLORS.wood, pattern: 'planks' });
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + s - 0.1, pos[2]], COLORS.woodDark);
  deco(b, new BoxGeometry(s + 0.02, 0.08, s + 0.02), [pos[0], pos[1] + 0.1, pos[2]], COLORS.woodDark);
}


/** A painted board; '\n' splits lines, and long lines make the board wider rather than spill off it. */
export function signboard(b: LevelBuilder, text: string, pos: V3, rotY: number): void {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = 'italic bold 46px Palatino, Georgia, serif';
  const lines = text.split('\n');
  g.font = font;
  const w = Math.max(512, Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width))) + 60);
  const h = 110 + (lines.length - 1) * 54;
  c.width = w;
  c.height = h;
  g.fillStyle = '#5e3b22';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c99a3e';
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#f2d48a';
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, 58 + i * 54));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry((2.6 * w) / 512, (0.56 * h) / 110), new MeshBasicMaterial({ map: tex, fog: true }));
  m.position.set(...pos);
  m.rotation.y = rotY;
  b.prop(m);
}

// ---------------------------------------------------------------- atmosphere

let shaftMat: MeshBasicMaterial | null = null;

/** A soft beam of light from a window: two crossed additive planes that fade out. */
export function lightShaft(b: LevelBuilder, from: V3, dir: V3, length: number, width: number, strength = 0.22): void {
  if (!shaftMat) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,220,160,1)');
    grad.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 128);
    const side = g.createLinearGradient(0, 0, 32, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.3, 'rgba(0,0,0,0)');
    side.addColorStop(0.7, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, 32, 128);
    const tex = new CanvasTexture(c);
    shaftMat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
  }
  const d = new Vector3(...dir).normalize();
  const mat = shaftMat.clone();
  mat.opacity = strength;
  for (const spin of [0, Math.PI / 2]) {
    const geo = new PlaneGeometry(width, length);
    geo.translate(0, -length / 2, 0); // top edge at the window
    const m = new Mesh(geo, mat);
    m.position.set(...from);
    m.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), d);
    m.rotateY(spin);
    m.renderOrder = 3;
    b.prop(m);
  }
}

/** Dust motes drifting in a box (slow, sparkly in light shafts). */
export function dustMotes(b: LevelBuilder, min: V3, max: V3, count: number): void {
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = min[0] + Math.random() * (max[0] - min[0]);
    pos[i * 3 + 1] = min[1] + Math.random() * (max[1] - min[1]);
    pos[i * 3 + 2] = min[2] + Math.random() * (max[2] - min[2]);
    seeds[i] = Math.random() * 100;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,240,210,1)');
  grad.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const mat = new PointsMaterial({ size: 0.06, map: new CanvasTexture(c), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.7 });
  // Cap the on-screen size so a mote drifting past the lens doesn't become a big white blob.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', 'gl_PointSize = min(gl_PointSize, 5.0);\n#include <fog_vertex>');
  };
  const points = new Points(geo, mat);
  b.prop(points);
  const base = Float32Array.from(pos);
  b.animated.push({
    update: (_dt, t) => {
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 0.6;
        pos[i * 3 + 1] = min[1] + ((base[i * 3 + 1] - min[1] + t * 0.05 + s) % (max[1] - min[1]));
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s * 1.3) * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
    },
  });
}

let grassMat: MeshStandardMaterial | null = null;
const grassTime = { value: 0 };

/** Swaying grass tufts over a rectangle (one instanced mesh per call). */
export function grass(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, y = 0, density = 3): void {
  const count = Math.max(1, Math.round((x1 - x0) * (z1 - z0) * density));
  // A tuft: three leaning blades.
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const blade = new ConeGeometry(0.035, 0.32 + k * 0.06, 3, 1, true).toNonIndexed();
    blade.translate(0, (0.32 + k * 0.06) / 2, 0);
    blade.rotateZ((k - 1) * 0.35);
    blade.rotateY((k * Math.PI * 2) / 3);
    blade.deleteAttribute('uv');
    parts.push(blade);
  }
  const tuft = mergeGeometries(parts)!;
  if (!grassMat) {
    grassMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = grassTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float sway = sin(uTime * 1.7 + ip.x * 0.7 + ip.z * 0.5) * 0.06 + sin(uTime * 3.1 + ip.z) * 0.02;
            transformed.x += sway * position.y * 2.5;
          #endif`,
        );
    };
    grassMat.customProgramCacheKey = () => 'tw-grass';
  }
  const mesh = new InstancedMesh(tuft, grassMat, count);
  const m = new Matrix4();
  const q = new Quaternion();
  const col = new Color();
  for (let i = 0; i < count; i++) {
    const s = 0.7 + Math.random() * 0.7;
    q.setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    m.compose(new Vector3(x0 + Math.random() * (x1 - x0), y, z0 + Math.random() * (z1 - z0)), q, new Vector3(s, s, s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHSL(0.24 + Math.random() * 0.06, 0.45, 0.32 + Math.random() * 0.12));
  }
  mesh.receiveShadow = true;
  b.prop(mesh);
  b.animated.push({ update: (_dt, t) => (grassTime.value = t) });
}

// ---------------------------------------------------------------- set dressing

/** Place a local-space geometry: offset, then turn by `rotY`, then move to `origin`. */
function put(b: LevelBuilder, geo: BufferGeometry, origin: V3, rotY: number, local: V3, color: string, rot?: V3): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  b.geo(g.translate(...local).rotateY(rotY).translate(...origin), color);
}

/** A tiny deterministic random sequence for scattering props. */
function scatter(seed: number): () => number {
  // Seeds are often made from positions and can be negative; keep the sequence in 0..1.
  let s = (Math.abs(Math.floor(seed)) * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** A rug: a border, a field, a central medallion and tasselled ends. Lies flat; no collider. */
export function rug(b: LevelBuilder, pos: V3, w: number, d: number, field: string, border: string, rotY = 0): void {
  const y = 0.012;
  put(b, new BoxGeometry(w, 0.02, d), pos, rotY, [0, y, 0], border);
  put(b, new BoxGeometry(w - 0.3, 0.02, d - 0.3), pos, rotY, [0, y + 0.004, 0], field);
  put(b, new BoxGeometry(w - 0.5, 0.02, d - 0.5), pos, rotY, [0, y + 0.006, 0], field);
  const m = Math.min(w, d) * 0.32;
  put(b, new BoxGeometry(m, 0.02, m), pos, rotY, [0, y + 0.009, 0], border, [0, Math.PI / 4, 0]);
  put(b, new BoxGeometry(m * 0.55, 0.02, m * 0.55), pos, rotY, [0, y + 0.012, 0], field, [0, Math.PI / 4, 0]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < Math.floor(w / 0.2); i++) {
      put(b, new BoxGeometry(0.05, 0.015, 0.14), pos, rotY, [-w / 2 + 0.1 + i * 0.2, 0.008, side * (d / 2 + 0.06)], '#e8d8b0');
    }
  }
}

/** A plank bench, sat along local X. `rotY` must be a multiple of π/2. */
export function bench(b: LevelBuilder, pos: V3, rotY: number, len = 2.2): void {
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  b.box([pos[0], pos[1] + 0.42, pos[2]], along ? [0.5, 0.1, len] : [len, 0.1, 0.5], { color: COLORS.wood, pattern: 'planks' });
  for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) put(b, new BoxGeometry(0.12, 0.38, 0.44), pos, rotY, [x, 0.19, 0], COLORS.woodDark);
  put(b, new BoxGeometry(len - 0.4, 0.06, 0.06), pos, rotY, [0, 0.12, 0], COLORS.woodDark);
}

/** A candlestick: brass foot, a candle and a flame (into `flames`, which glows). */
export function candlestick(b: LevelBuilder, flames: Glow, pos: V3, h = 0.3): void {
  deco(b, new CylinderGeometry(0.08, 0.1, 0.04, 8), [pos[0], pos[1] + 0.02, pos[2]], '#c99a3e');
  deco(b, new CylinderGeometry(0.02, 0.03, 0.14, 6), [pos[0], pos[1] + 0.1, pos[2]], '#c99a3e');
  deco(b, new CylinderGeometry(0.045, 0.045, 0.03, 8), [pos[0], pos[1] + 0.18, pos[2]], '#c99a3e');
  deco(b, new CylinderGeometry(0.03, 0.03, h, 6), [pos[0], pos[1] + 0.195 + h / 2, pos[2]], '#f3ead8');
  flames.add(new ConeGeometry(0.03, 0.09, 5), [pos[0], pos[1] + 0.24 + h, pos[2]]);
}

/** A long table with candles, plates and goblets. `rotY` must be a multiple of π/2. */
export function table(b: LevelBuilder, flames: Glow, pos: V3, rotY: number, len: number, wid = 1.3, seed = 1): void {
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  const H = 0.85;
  b.box([pos[0], pos[1] + H - 0.05, pos[2]], along ? [wid, 0.1, len] : [len, 0.1, wid], { color: COLORS.wood, pattern: 'planks' });
  b.box([pos[0], pos[1] + (H - 0.1) / 2, pos[2]], along ? [wid - 0.3, H - 0.1, len - 0.4] : [len - 0.4, H - 0.1, wid - 0.3], { invisible: true });
  for (const x of [-len / 2 + 0.25, len / 2 - 0.25]) {
    for (const z of [-wid / 2 + 0.2, wid / 2 - 0.2]) put(b, new BoxGeometry(0.14, H - 0.1, 0.14), pos, rotY, [x, (H - 0.1) / 2, z], COLORS.woodDark);
  }
  put(b, new BoxGeometry(len - 0.5, 0.08, 0.08), pos, rotY, [0, 0.2, 0], COLORS.woodDark);
  // A runner down the middle.
  put(b, new BoxGeometry(len - 0.3, 0.012, 0.4), pos, rotY, [0, H + 0.006, 0], '#8a2a3a');
  const rnd = scatter(seed);
  const top = (x: number, z: number): V3 => {
    const v = new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), rotY);
    return [pos[0] + v.x, pos[1] + H, pos[2] + v.z];
  };
  for (let x = -len / 2 + 0.9; x < len / 2 - 0.5; x += 1.6) candlestick(b, flames, top(x, 0), 0.18 + rnd() * 0.15);
  for (let x = -len / 2 + 0.5; x < len / 2 - 0.3; x += 0.8) {
    for (const z of [-wid / 2 + 0.3, wid / 2 - 0.3]) {
      const p = top(x + (rnd() - 0.5) * 0.2, z);
      deco(b, new CylinderGeometry(0.16, 0.13, 0.02, 10), [p[0], p[1] + 0.01, p[2]], '#e8e0d0');
      if (rnd() < 0.5) {
        const q = top(x + 0.25, z * 0.6);
        deco(b, new CylinderGeometry(0.05, 0.03, 0.12, 6), [q[0], q[1] + 0.12, q[2]], '#c99a3e');
        deco(b, new CylinderGeometry(0.01, 0.01, 0.06, 4), [q[0], q[1] + 0.03, q[2]], '#c99a3e');
        deco(b, new CylinderGeometry(0.05, 0.05, 0.01, 6), [q[0], q[1] + 0.005, q[2]], '#c99a3e');
      }
    }
  }
}

/** A terracotta pot with a leafy plant. */
export function pottedPlant(b: LevelBuilder, pos: V3, s = 1, seed = 1): void {
  const [x, y, z] = pos;
  b.box([x, y + 0.3 * s, z], [0.5 * s, 0.6 * s, 0.5 * s], { invisible: true });
  deco(b, new CylinderGeometry(0.3 * s, 0.22 * s, 0.5 * s, 10), [x, y + 0.25 * s, z], '#b8643a');
  deco(b, new CylinderGeometry(0.33 * s, 0.33 * s, 0.08 * s, 10), [x, y + 0.5 * s, z], '#a0522d');
  deco(b, new CylinderGeometry(0.28 * s, 0.28 * s, 0.02, 10), [x, y + 0.53 * s, z], '#4a3220');
  const rnd = scatter(seed);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd();
    const tilt = 0.5 + rnd() * 0.5;
    const len = (0.6 + rnd() * 0.5) * s;
    const leaf = new ConeGeometry(0.1 * s, len, 4).scale(1, 1, 0.3).translate(0, len / 2, 0).rotateZ(-tilt).rotateY(a);
    deco(b, leaf, [x, y + 0.52 * s, z], i % 2 ? '#5f8a3a' : '#4f7a2e');
  }
  deco(b, new IcosahedronGeometry(0.18 * s, 0), [x, y + 0.7 * s, z], '#6f9a42');
}

/** A stone urn on a square foot; flowers optional. */
export function urn(b: LevelBuilder, pos: V3, flowers = false, seed = 1): void {
  const [x, y, z] = pos;
  b.box([x, y + 0.5, z], [0.6, 1, 0.6], { invisible: true });
  deco(b, new BoxGeometry(0.55, 0.12, 0.55), [x, y + 0.06, z], COLORS.stoneDark);
  deco(b, new CylinderGeometry(0.12, 0.2, 0.25, 8), [x, y + 0.24, z], COLORS.stoneLight);
  deco(b, new SphereGeometry(0.32, 10, 7).scale(1, 0.9, 1), [x, y + 0.6, z], COLORS.stoneLight);
  deco(b, new CylinderGeometry(0.3, 0.22, 0.2, 10), [x, y + 0.92, z], COLORS.stoneLight);
  deco(b, new TorusGeometry(0.3, 0.035, 5, 12).rotateX(Math.PI / 2), [x, y + 1.02, z], COLORS.stone);
  for (const side of [-1, 1]) deco(b, new TorusGeometry(0.1, 0.03, 4, 8), [x + side * 0.33, y + 0.72, z], COLORS.stone);
  if (flowers) {
    const rnd = scatter(seed);
    deco(b, new IcosahedronGeometry(0.28, 0).scale(1, 0.6, 1), [x, y + 1.1, z], '#5f8a3a');
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.25;
      deco(b, new IcosahedronGeometry(0.07, 0), [x + Math.cos(a) * r, y + 1.2 + rnd() * 0.12, z + Math.sin(a) * r], ['#e86a8a', '#f5d36a', '#b98ae0', '#f3ead8'][i % 4]);
    }
  }
}

/** A stack of books, slightly askew. */
export function bookStack(b: LevelBuilder, pos: V3, n = 4, seed = 1): void {
  const rnd = scatter(seed);
  let y = pos[1];
  const colors = ['#7a2f3a', '#2f5a6a', '#5a6a3a', '#8a5a36', '#4a2c4f', '#a0522d'];
  for (let i = 0; i < n; i++) {
    const h = 0.06 + rnd() * 0.05;
    const w = 0.32 + rnd() * 0.12;
    const d = 0.24 + rnd() * 0.06;
    const r = (rnd() - 0.5) * 0.5;
    deco(b, new BoxGeometry(w, h, d), [pos[0], y + h / 2, pos[2]], colors[Math.floor(rnd() * colors.length)], [0, r, 0]);
    deco(b, new BoxGeometry(w - 0.03, h - 0.02, d + 0.005), [pos[0], y + h / 2, pos[2]], '#f3ead8', [0, r, 0]);
    y += h;
  }
}

/** A black iron cauldron on three legs with something green bubbling in it. */
export function cauldron(b: LevelBuilder, pos: V3, r = 0.5): void {
  const [x, y, z] = pos;
  b.box([x, y + r * 0.8, z], [r * 1.6, r * 1.6, r * 1.6], { invisible: true });
  deco(b, new SphereGeometry(r, 12, 8, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), [x, y + r + 0.12, z], '#2a2230');
  deco(b, new TorusGeometry(r * 0.82, 0.05, 5, 16).rotateX(Math.PI / 2), [x, y + r * 1.58 + 0.12, z], '#3a3240');
  deco(b, new CylinderGeometry(r * 0.78, r * 0.78, 0.02, 14), [x, y + r * 1.5 + 0.12, z], '#7ac86a');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    deco(b, new BoxGeometry(0.07, 0.3, 0.07), [x + Math.cos(a) * r * 0.6, y + 0.15, z + Math.sin(a) * r * 0.6], '#2a2230');
  }
  for (let i = 0; i < 4; i++) deco(b, new IcosahedronGeometry(0.04 + i * 0.012, 0), [x - 0.15 + i * 0.1, y + r * 1.55 + 0.14, z + (i % 2) * 0.1], '#a8e890');
}

/** A suit of armour on a plinth, holding a halberd (decor; Rattlecoats are the ones that move). */
export function armour(b: LevelBuilder, pos: V3, rotY: number, plume = '#8a2a3a'): void {
  const steel = '#9aa0a8';
  const dark = '#5a6068';
  b.box([pos[0], pos[1] + 1.1, pos[2]], [0.9, 2.2, 0.9], { invisible: true });
  put(b, new BoxGeometry(0.9, 0.3, 0.9), pos, rotY, [0, 0.15, 0], COLORS.stoneDark);
  for (const side of [-1, 1]) {
    put(b, new CylinderGeometry(0.08, 0.1, 0.65, 6), pos, rotY, [side * 0.13, 0.65, 0], steel);
    put(b, new BoxGeometry(0.16, 0.08, 0.26), pos, rotY, [side * 0.13, 0.34, 0.04], dark);
    put(b, new SphereGeometry(0.08, 6, 4), pos, rotY, [side * 0.13, 0.66, 0.05], dark);
    put(b, new SphereGeometry(0.12, 8, 6), pos, rotY, [side * 0.27, 1.45, 0], steel);
    put(b, new CylinderGeometry(0.06, 0.07, 0.5, 6), pos, rotY, [side * 0.3, 1.15, 0.02], steel, [0, 0, side * 0.1]);
  }
  put(b, new CylinderGeometry(0.22, 0.17, 0.25, 8), pos, rotY, [0, 1.0, 0], dark);
  put(b, new CylinderGeometry(0.25, 0.22, 0.45, 8), pos, rotY, [0, 1.3, 0], steel);
  put(b, new BoxGeometry(0.06, 0.4, 0.04), pos, rotY, [0, 1.3, 0.24], '#c99a3e');
  put(b, new SphereGeometry(0.17, 10, 8), pos, rotY, [0, 1.72, 0], steel);
  put(b, new BoxGeometry(0.22, 0.03, 0.05), pos, rotY, [0, 1.72, 0.15], '#1b1b22');
  put(b, new ConeGeometry(0.06, 0.32, 6), pos, rotY, [0, 1.98, -0.02], plume, [-0.4, 0, 0]);
  // Halberd in the right hand.
  put(b, new CylinderGeometry(0.025, 0.025, 2.3, 6), pos, rotY, [-0.36, 1.25, 0.12], COLORS.woodDark);
  put(b, new BoxGeometry(0.02, 0.3, 0.22), pos, rotY, [-0.36, 2.3, 0.2], steel);
  put(b, new ConeGeometry(0.05, 0.2, 4), pos, rotY, [-0.36, 2.5, 0.12], steel);
}

let webTexture: CanvasTexture | null = null;
/** A cobweb strung across a corner: `corner` is the top of the corner, `d1`/`d2` run along the two walls. */
export function cobweb(b: LevelBuilder, corner: V3, d1: [number, number], d2: [number, number], s = 1.2): void {
  if (!webTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(240,240,240,0.85)';
    g.lineWidth = 1.2;
    const ox = 64;
    const oy = 0;
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(a) * 130, oy + Math.sin(a) * 130);
      g.stroke();
    }
    for (let r = 14; r < 130; r += 13) {
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        const rr = r * (i % 2 ? 0.92 : 1);
        if (i === 0) g.moveTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
        else g.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
      }
      g.stroke();
    }
    webTexture = new CanvasTexture(c);
    webTexture.colorSpace = SRGBColorSpace;
  }
  const [cx, cy, cz] = corner;
  const p1 = [cx + d1[0] * s, cy, cz + d1[1] * s];
  const p2 = [cx + d2[0] * s, cy, cz + d2[1] * s];
  const p3 = [cx + (d1[0] + d2[0]) * 0.15 * s, cy - s, cz + (d1[1] + d2[1]) * 0.15 * s];
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([...p1, ...p2, ...p3]), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 1, 1, 1, 0.5, 0]), 2));
  // All of a level's cobwebs share one mesh (one draw call), rebuilt as each is added.
  let batch = webBatches.get(b);
  if (!batch) {
    batch = { geos: [], mesh: new Mesh(new BufferGeometry(), new MeshBasicMaterial({ map: webTexture, transparent: true, opacity: 0.55, depthWrite: false, side: DoubleSide, fog: true })) };
    webBatches.set(b, batch);
    b.prop(batch.mesh);
  }
  batch.geos.push(geo);
  batch.mesh.geometry.dispose();
  batch.mesh.geometry = mergeGeometries(batch.geos)!;
}
const webBatches = new WeakMap<LevelBuilder, { geos: BufferGeometry[]; mesh: Mesh }>();

/** A heap of fallen stones (no collider). */
export function rubble(b: LevelBuilder, x: number, z: number, n = 7, seed = 1, y = 0, spread = 0.8): void {
  const rnd = scatter(seed);
  for (let i = 0; i < n; i++) {
    const r = 0.1 + rnd() * 0.2;
    const a = rnd() * Math.PI * 2;
    const d = rnd() * spread;
    deco(b, new IcosahedronGeometry(r, 0).scale(1, 0.6, 1), [x + Math.cos(a) * d, y + r * 0.4, z + Math.sin(a) * d], [COLORS.stoneLight, COLORS.stone, COLORS.stoneDark][i % 3], [rnd(), rnd() * 3, 0]);
  }
}

/** A banded barrel. */
export function barrel(b: LevelBuilder, pos: V3, r = 0.4, h = 1): void {
  const [x, y, z] = pos;
  b.box([x, y + h / 2, z], [r * 1.8, h, r * 1.8], { invisible: true });
  deco(b, new CylinderGeometry(r * 0.9, r * 0.9, h, 10), [x, y + h / 2, z], COLORS.wood);
  deco(b, new CylinderGeometry(r, r, h * 0.5, 10), [x, y + h / 2, z], COLORS.wood);
  for (const t of [0.12, 0.88]) deco(b, new CylinderGeometry(r * 0.94, r * 0.94, 0.05, 10), [x, y + h * t, z], '#3a3240');
  for (const t of [0.33, 0.67]) deco(b, new CylinderGeometry(r * 1.01, r * 1.01, 0.05, 10), [x, y + h * t, z], '#3a3240');
  deco(b, new CylinderGeometry(r * 0.86, r * 0.86, 0.02, 10), [x, y + h + 0.005, z], COLORS.woodDark);
}

/** An iron wall sconce with a burning torch. `rotY` faces away from the wall. */
export function wallTorch(b: LevelBuilder, flames: Glow, pos: V3, rotY: number): void {
  put(b, new BoxGeometry(0.16, 0.3, 0.04), pos, rotY, [0, 0, 0.02], '#2a2230');
  put(b, new BoxGeometry(0.05, 0.05, 0.3), pos, rotY, [0, -0.05, 0.17], '#2a2230');
  put(b, new CylinderGeometry(0.09, 0.06, 0.1, 6), pos, rotY, [0, 0.02, 0.3], '#2a2230');
  put(b, new CylinderGeometry(0.04, 0.03, 0.4, 5), pos, rotY, [0, 0.12, 0.3], COLORS.woodDark, [0.15, 0, 0]);
  const v = new Vector3(0, 0, 0.33).applyAxisAngle(new Vector3(0, 1, 0), rotY);
  flames.add(new ConeGeometry(0.09, 0.3, 6), [pos[0] + v.x, pos[1] + 0.42, pos[2] + v.z]);
  flames.add(new ConeGeometry(0.05, 0.42, 5), [pos[0] + v.x, pos[1] + 0.45, pos[2] + v.z]);
}

/** Ivy creeping over a wall face. `facing` is the direction the face looks (±1 along the wall's normal axis). */
export function ivy(b: LevelBuilder, axis: 'x' | 'z', at: number, from: number, to: number, y0: number, y1: number, facing: 1 | -1, seed = 1): void {
  const rnd = scatter(seed);
  const n = Math.round((to - from) * (y1 - y0) * 6);
  const greens = ['#4f7a2e', '#5f8a3a', '#6f9a42', '#3f6a2a'];
  for (let i = 0; i < n; i++) {
    const u = from + rnd() * (to - from);
    // Denser near the bottom, thinning out as it climbs.
    const v = y0 + Math.pow(rnd(), 1.6) * (y1 - y0);
    const leaf = new BoxGeometry(0.24, 0.2, 0.02).rotateZ(rnd() * Math.PI);
    const off = at + facing * (0.03 + rnd() * 0.04);
    if (axis === 'x') deco(b, leaf, [u, v, off], greens[i % 4]);
    else deco(b, leaf.rotateY(Math.PI / 2), [off, v, u], greens[i % 4]);
  }
}

/** A clump of toadstools. */
export function mushrooms(b: LevelBuilder, x: number, z: number, n = 4, seed = 1, y = 0): void {
  const rnd = scatter(seed);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.4;
    const h = 0.1 + rnd() * 0.18;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    deco(b, new CylinderGeometry(0.03, 0.04, h, 5), [px, y + h / 2, pz], '#efe6c8');
    deco(b, new SphereGeometry(0.06 + h * 0.4, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), [px, y + h, pz], i % 3 ? '#c84a3a' : '#d9a24a');
    deco(b, new IcosahedronGeometry(0.015, 0), [px + 0.03, y + h + 0.05 + h * 0.2, pz], '#f6f1e6');
  }
}

/** A round leafy bush (no collider). */
export function bush(b: LevelBuilder, x: number, z: number, s = 1, seed = 1, y = 0): void {
  const rnd = scatter(seed);
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.35 * s;
    deco(b, new IcosahedronGeometry((0.35 + rnd() * 0.2) * s, 0), [x + Math.cos(a) * d, y + (0.35 + rnd() * 0.25) * s, z + Math.sin(a) * d], ['#4f7a2e', '#5f8a3a', '#6f9a42'][i % 3], [rnd(), rnd(), 0]);
  }
}

// ---------------------------------------------------------------- castle skyline pieces
// Decoration for the tops of buildings (roofs, parapets, turrets, chimneys): merged into the
// level mesh, no colliders. Used over the castle's flat ceilings where climbs look out.

// A gable roof: a triangular prism over a rectangle, eaves at `eave`, ridge `rise` above.
// `free` says which ends (low, high along the ridge) stand clear: those overhang and get a
// stone gable wall; an end that butts against another wall or roof stops flush instead, or
// it would poke out through that wall's face.
export function gableRoof(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, eave: number, rise: number, alongX: boolean, free: [boolean, boolean] = [true, true], color: string = COLORS.slate): void {
  const w = (alongX ? z1 - z0 : x1 - x0) + 0.8;
  const a0 = (alongX ? x0 : z0) - (free[0] ? 0.3 : 0);
  const a1 = (alongX ? x1 : z1) + (free[1] ? 0.3 : 0);
  const len = a1 - a0;
  const mid = (a0 + a1) / 2;
  const across = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
  const at = (along: number, y: number): V3 => (alongX ? [along, y, across] : [across, y, along]);
  // A 3-sided cylinder is a triangular prism: apex up after the turn, base at -r/2.
  const g = new CylinderGeometry(1, 1, len, 3).rotateX(-Math.PI / 2).scale(w / Math.sqrt(3), rise / 1.5, 1).translate(0, rise / 3, 0);
  if (alongX) g.rotateY(Math.PI / 2);
  deco(b, g, at(mid, eave), color);
  const cap = alongX ? new BoxGeometry(len, 0.25, 0.35) : new BoxGeometry(0.35, 0.25, len);
  deco(b, cap, at(mid, eave + rise + 0.05), COLORS.stoneDark);
  for (const [i, end] of [
    [0, a0],
    [1, a1],
  ] as [0 | 1, number][]) {
    if (!free[i]) continue;
    const inward = i === 0 ? 0.1 : -0.1;
    // A stone gable wall (bare, the prism's ends read as black triangles) with a round window.
    const gw = new CylinderGeometry(1, 1, 0.35, 3).rotateX(-Math.PI / 2).scale((w - 0.6) / Math.sqrt(3), (rise - 0.2) / 1.5, 1).translate(0, (rise - 0.2) / 3, 0);
    if (alongX) gw.rotateY(Math.PI / 2);
    deco(b, gw, at(end + inward, eave), COLORS.stoneLight);
    const win = new CylinderGeometry(0.45, 0.45, 0.4, 10).rotateX(Math.PI / 2);
    if (alongX) win.rotateY(Math.PI / 2);
    deco(b, win, at(end + inward * 0.6, eave + rise * 0.38), '#2a2230');
    deco(b, new SphereGeometry(0.22, 6, 4), at(end, eave + rise + 0.3), '#c99a3e');
  }
}

// Crenellations round the top of a rectangle of wall.
export function crenels(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, y: number): void {
  for (const [ax, from, to, at] of [
    [true, x0, x1, z0],
    [true, x0, x1, z1],
    [false, z0, z1, x0],
    [false, z0, z1, x1],
  ] as [boolean, number, number, number][]) {
    deco(b, ax ? new BoxGeometry(to - from + 0.6, 0.5, 0.6) : new BoxGeometry(0.6, 0.5, to - from + 0.6), ax ? [(from + to) / 2, y + 0.25, at] : [at, y + 0.25, (from + to) / 2], COLORS.stoneLight);
    for (let u = from + 0.6; u < to - 0.3; u += 1.4) deco(b, new BoxGeometry(0.7, 0.55, 0.6), ax ? [u, y + 0.75, at] : [at, y + 0.75, u], COLORS.stoneLight);
  }
}

// A round turret with a crenellated top and a pointed roof.
export function turret(b: LevelBuilder, x: number, z: number, r: number, base: number, top: number, roof: number, color: string = COLORS.roof): void {
  deco(b, new CylinderGeometry(r, r * 1.05, top - base, 12), [x, (base + top) / 2, z], COLORS.stoneLight);
  // Perched turrets (not from the ground) sit on a corbel.
  if (base > 0) deco(b, new ConeGeometry(r * 1.05, 1.8, 12).rotateX(Math.PI), [x, base - 0.9, z], COLORS.stoneDark);
  deco(b, new CylinderGeometry(r + 0.25, r + 0.25, 0.5, 12), [x, top + 0.25, z], COLORS.stoneLight);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    deco(b, new BoxGeometry(0.5, 0.6, 0.4), [x + Math.cos(a) * (r + 0.05), top + 0.8, z + Math.sin(a) * (r + 0.05)], COLORS.stoneLight, [0, -a, 0]);
  }
  deco(b, new ConeGeometry(r + 0.35, roof, 12), [x, top + 0.5 + roof / 2, z], color);
  deco(b, new CylinderGeometry(0.04, 0.04, 1.2, 4), [x, top + 0.5 + roof + 0.5, z], COLORS.stoneDark);
  deco(b, new SphereGeometry(0.18, 6, 4), [x, top + 0.5 + roof + 0.15, z], '#c99a3e');
  // Arrow slits, facing out every way.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    deco(b, new BoxGeometry(0.14, 1.1, 0.1), [x + Math.cos(a) * r, (base + top) / 2 + 0.6, z + Math.sin(a) * r], '#2a2230', [0, -a + Math.PI / 2, 0]);
  }
}

export function chimneyStack(b: LevelBuilder, x: number, z: number, base: number, h: number): void {
  deco(b, new BoxGeometry(0.9, h, 0.9), [x, base + h / 2, z], COLORS.stoneLight);
  deco(b, new BoxGeometry(1.1, 0.25, 1.1), [x, base + h, z], COLORS.stoneDark);
}

/**
 * A patch of woodland for the background: forest floor over the rectangle and mixed trees
 * (round-topped and firs) scattered through it at `spacing`. Decoration only, merged.
 */
export function woodland(b: LevelBuilder, x0: number, x1: number, z0: number, z1: number, y: number, seed = 1, spacing = 4.2, floor = true): void {
  const rnd = scatter(seed + 777);
  const LEAVES = ['#3f5f34', '#4a6a3a', '#355a2e', '#56763e', '#2f4a28'];
  const BARK = '#5a3a24';
  if (floor) deco(b, new BoxGeometry(x1 - x0, 0.4, z1 - z0), [(x0 + x1) / 2, y - 0.2, (z0 + z1) / 2], '#3d5a2c');
  for (let z = z0 + spacing / 2; z < z1; z += spacing * (0.8 + rnd() * 0.4)) {
    for (let x = x0 + spacing / 2 + rnd() * spacing * 0.5; x < x1; x += spacing * (0.8 + rnd() * 0.5)) {
      const px = x + (rnd() - 0.5) * spacing * 0.6;
      const pz = z + (rnd() - 0.5) * spacing * 0.6;
      const h = 8 + rnd() * 8;
      if (rnd() < 0.5) {
        deco(b, new CylinderGeometry(0.3 + h * 0.025, 0.45 + h * 0.035, h, 6), [px, y + h / 2, pz], BARK);
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const r = 1.6 + rnd() * 2.2;
          deco(b, new IcosahedronGeometry(r, 0), [px + (rnd() - 0.5) * 2.4, y + h * (0.65 + rnd() * 0.35), pz + (rnd() - 0.5) * 2.4], LEAVES[Math.floor(rnd() * LEAVES.length)], [rnd() * 3, rnd() * 3, 0]);
        }
      } else {
        const H = h + 3;
        deco(b, new CylinderGeometry(0.35, 0.55, H * 0.4, 6), [px, y + H * 0.2, pz], BARK);
        for (let k = 0; k < 3; k++) deco(b, new ConeGeometry(3.2 - k * 0.8, H * 0.45, 7), [px, y + H * (0.35 + k * 0.2), pz], LEAVES[(k + Math.floor(rnd() * 5)) % LEAVES.length]);
      }
    }
  }
}
