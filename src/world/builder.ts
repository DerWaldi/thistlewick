import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColliderInfo, Physics } from '../engine/physics';
import type { EntitySpec } from '../entities/types';
import type { PlayerEnvironment } from '../player/controller';
import { COLORS, worldMaterial } from './materials';

export type V3 = [number, number, number];

export interface BoxOpts {
  color?: string;
  /** Rotation in radians as [pitch, yaw, roll], applied yaw-first (Euler order YXZ). */
  rot?: V3;
  info?: ColliderInfo;
  /** Visual only, no collider. */
  noCollide?: boolean;
  /** Collider only, no mesh. */
  invisible?: boolean;
}

interface WaterVolume {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surface: number;
}

interface Mover {
  collider: RAPIER.Collider;
  mesh: Object3D;
  info: ColliderInfo & { mover: { delta: Vector3 } };
  path: (t: number) => Vector3;
  prev: Vector3;
  cur: Vector3;
}

/** Things with their own per-frame animation (bounce pads, lanterns...). */
export interface Animated {
  update(dt: number, time: number): void;
}

/**
 * Builds level geometry: static pieces are vertex-coloured and merged into a single
 * mesh + many colliders; movers, water and props get their own objects.
 */
export class LevelBuilder implements PlayerEnvironment {
  killY = -15;
  readonly root = new Group();
  private staticGeos: BufferGeometry[] = [];
  private iceGeos: BufferGeometry[] = [];
  private water: WaterVolume[] = [];
  private movers: Mover[] = [];
  readonly animated: Animated[] = [];
  /** Entities to spawn once the world exists (see World.spawnAll). */
  readonly entities: EntitySpec[] = [];
  private time = 0;

  constructor(
    scene: Scene,
    private physics: Physics,
  ) {
    scene.add(this.root);
  }

  // ---------------------------------------------------------------- primitives

  box(center: V3, size: V3, opts: BoxOpts = {}): void {
    const q = opts.rot ? new Quaternion().setFromEuler(new Euler(opts.rot[0], opts.rot[1], opts.rot[2], 'YXZ')) : undefined;
    const c = new Vector3(...center);
    if (!opts.noCollide) {
      this.physics.addStaticBox(c, new Vector3(size[0] / 2, size[1] / 2, size[2] / 2), q, opts.info);
    }
    if (opts.invisible) return;
    const geo = new BoxGeometry(...size).toNonIndexed();
    if (q) geo.applyQuaternion(q);
    geo.translate(...center);
    paint(geo, opts.color ?? COLORS.stone, true);
    if (opts.info?.surface === 'ice') this.iceGeos.push(geo);
    else this.staticGeos.push(geo);
  }

  /** Place an entity (push block, switch, sweet...) in the level. */
  add(...specs: EntitySpec[]): void {
    this.entities.push(...specs);
  }

  /**
   * A slab floor over [minX,maxX]x[minZ,maxZ] with its top at `top`, leaving rectangular
   * holes (pits, pools). Cells are merged along X to keep the collider count down.
   */
  floor(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    opts: { top?: number; thickness?: number; color?: string; holes?: [number, number, number, number][] } = {},
  ): void {
    const top = opts.top ?? 0;
    const t = opts.thickness ?? 4;
    const holes = opts.holes ?? [];
    const xs = [...new Set([minX, maxX, ...holes.flatMap((h) => [h[0], h[1]])])].filter((v) => v >= minX && v <= maxX).sort((a, b) => a - b);
    const zs = [...new Set([minZ, maxZ, ...holes.flatMap((h) => [h[2], h[3]])])].filter((v) => v >= minZ && v <= maxZ).sort((a, b) => a - b);
    const inHole = (x: number, z: number) => holes.some((h) => x > h[0] && x < h[1] && z > h[2] && z < h[3]);
    for (let j = 0; j < zs.length - 1; j++) {
      let runStart: number | null = null;
      for (let i = 0; i <= xs.length - 1; i++) {
        const solid = i < xs.length - 1 && !inHole((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2);
        if (solid && runStart === null) runStart = xs[i];
        if (!solid && runStart !== null) {
          const x0 = runStart;
          const x1 = xs[i];
          this.box([(x0 + x1) / 2, top - t / 2, (zs[j] + zs[j + 1]) / 2], [x1 - x0, t, zs[j + 1] - zs[j]], { color: opts.color ?? COLORS.floor });
          runStart = null;
        }
      }
    }
  }

  /** A straight wall from (x0,z0) to (x1,z1) standing on `base`. */
  wall(x0: number, z0: number, x1: number, z1: number, height: number, opts: { base?: number; thickness?: number; color?: string } = {}): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const base = opts.base ?? 0;
    this.box([(x0 + x1) / 2, base + height / 2, (z0 + z1) / 2], [opts.thickness ?? 0.6, height, len], {
      color: opts.color ?? COLORS.stone,
      rot: [0, yaw, 0],
    });
  }

  cylinder(center: V3, radius: number, height: number, color: string, info?: ColliderInfo, segments = 10): void {
    this.physics.addStaticCylinder(new Vector3(...center), height / 2, radius, info);
    const geo = new CylinderGeometry(radius, radius, height, segments).toNonIndexed();
    geo.translate(...center);
    paint(geo, color, true);
    this.staticGeos.push(geo);
  }

  /** A ramp rising from `bottom` (centre of its low edge) along `yaw` at `angleDeg`. */
  ramp(bottom: V3, length: number, width: number, angleDeg: number, yaw = 0, color = COLORS.stoneLight, invisible = false): void {
    const a = (angleDeg * Math.PI) / 180;
    const t = 0.4; // slab thickness
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const half = length / 2;
    // Slab centre: halfway up the slope, pushed down by half the thickness along the slope normal.
    const cx = bottom[0] + fx * Math.cos(a) * half + fx * Math.sin(a) * (t / 2);
    const cy = bottom[1] + Math.sin(a) * half - Math.cos(a) * (t / 2);
    const cz = bottom[2] + fz * Math.cos(a) * half + fz * Math.sin(a) * (t / 2);
    this.box([cx, cy, cz], [width, t, length], { color, rot: [-a, yaw, 0], invisible });
  }

  /**
   * Straight staircase starting at `start` (bottom front centre) going along `yaw`.
   * The steps are visual only; collision is one smooth ramp through the middle of each
   * tread, so the capsule never snags on step edges (feet sink/hover by at most half a step).
   */
  stairs(start: V3, yaw: number, steps: number, rise: number, run: number, width: number, color = COLORS.stoneLight): void {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const at = (d: number, y: number): V3 => [start[0] + fx * d, start[1] + y, start[2] + fz * d];
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1);
      const d = run * i + run / 2;
      this.box(at(d, h / 2), [width, h, run], {
        color: i % 2 ? color : shade(color, 0.94),
        rot: [0, yaw, 0],
        noCollide: true,
      });
    }
    const height = rise * steps;
    // The slope runs from half a tread in front of the stairs to the front edge of the top
    // tread, so whatever the stairs lead onto meets it flush.
    const flat = run * (steps - 0.5);
    const angle = (Math.atan2(height, flat) * 180) / Math.PI;
    this.ramp(at(-run / 2, 0), Math.hypot(flat, height), width, angle, yaw, color, true);
    this.box(at(run * (steps - 0.5), height / 2), [width, height, run], { rot: [0, yaw, 0], invisible: true });
  }

  /** Rectangular pool with a water surface; falling in resets the player. */
  pool(minX: number, maxX: number, minZ: number, maxZ: number, surface: number, bottom: number): void {
    this.box([(minX + maxX) / 2, bottom - 0.5, (minZ + maxZ) / 2], [maxX - minX, 1, maxZ - minZ], { color: COLORS.stoneDark });
    this.water.push({ minX, maxX, minZ, maxZ, surface });
    const mat = new MeshStandardMaterial({
      color: COLORS.water,
      transparent: true,
      opacity: 0.78,
      roughness: 0.15,
      metalness: 0.1,
      flatShading: true,
    });
    const geo = new PlaneGeometry(maxX - minX, maxZ - minZ, 12, 12);
    const water = new Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set((minX + maxX) / 2, surface, (minZ + maxZ) / 2);
    water.receiveShadow = true;
    this.root.add(water);
    const pos = geo.getAttribute('position') as BufferAttribute;
    const base = Float32Array.from(pos.array);
    this.animated.push({
      update: (_dt, time) => {
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3];
          const y = base[i * 3 + 1];
          pos.setZ(i, Math.sin(x * 0.9 + time * 1.6) * 0.05 + Math.cos(y * 1.1 + time * 1.3) * 0.05);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      },
    });
  }

  /** Moving platform following `path(t)` (t in seconds). */
  mover(size: V3, color: string, path: (t: number) => Vector3): void {
    const p0 = path(0);
    // A bodiless collider moved by hand: no velocity, so the character controller
    // doesn't half-apply platform motion; the player adds `delta` itself.
    const collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(p0.x, p0.y, p0.z),
    );
    const info = { mover: { delta: new Vector3() } };
    this.physics.setInfo(collider, info);
    const geo = new BoxGeometry(...size).toNonIndexed();
    paint(geo, color, true);
    const mesh = new Mesh(geo, worldMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(p0);
    this.root.add(mesh);
    this.movers.push({ collider, mesh, info, path, prev: p0.clone(), cur: p0.clone() });
  }

  /** A springy mushroom cap that launches the player. */
  bouncePad(center: V3, radius: number, scale = 1): void {
    const capH = 0.35;
    const group = new Group();
    group.position.set(...center);
    const stem = new Mesh(paint(new CylinderGeometry(radius * 0.45, radius * 0.55, 0.5, 8).toNonIndexed(), '#efe2c8', true), worldMaterial());
    stem.position.y = 0.25;
    const cap = new Mesh(paint(new CylinderGeometry(radius * 0.8, radius, capH, 12).toNonIndexed(), '#c4486a', true), worldMaterial());
    cap.position.y = 0.5 + capH / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const dot = new Mesh(paint(new CylinderGeometry(0.12, 0.12, 0.04, 6).toNonIndexed(), '#fff4dc', true), worldMaterial());
      dot.position.set(Math.cos(a) * radius * 0.5, capH / 2 + 0.01, Math.sin(a) * radius * 0.5);
      cap.add(dot);
    }
    stem.castShadow = cap.castShadow = true;
    group.add(stem, cap);
    this.root.add(group);

    let squash = 0;
    let vel = 0;
    const padTop = 0.5 + capH;
    const colliderCenter = new Vector3(center[0], center[1] + padTop / 2, center[2]);
    this.physics.addStaticCylinder(colliderCenter, padTop / 2, radius, {
      bounce: { scale, onBounce: () => (vel -= 9) },
      noGrab: true,
    });
    this.animated.push({
      update: (dt) => {
        vel += (-squash * 300 - vel * 10) * dt;
        squash += vel * dt;
        cap.scale.set(1 - squash * 0.5, 1 + squash * 1.4, 1 - squash * 0.5);
      },
    });
  }

  lantern(pos: V3, intensity = 6, distance = 9): void {
    const light = new PointLight(COLORS.lantern, intensity, distance, 1.6);
    light.position.set(...pos);
    this.root.add(light);
    const glow = new Mesh(
      new BoxGeometry(0.22, 0.32, 0.22),
      new MeshStandardMaterial({ color: COLORS.lantern, emissive: new Color(COLORS.lantern), emissiveIntensity: 1.6 }),
    );
    glow.position.set(...pos);
    const iron = new MeshStandardMaterial({ color: '#2a2230', flatShading: true });
    const cap = new Mesh(new ConeGeometry(0.2, 0.18, 4), iron);
    cap.position.y = 0.25;
    cap.rotation.y = Math.PI / 4;
    const base = new Mesh(new BoxGeometry(0.26, 0.05, 0.26), iron);
    base.position.y = -0.18;
    const ring = new Mesh(new TorusGeometry(0.06, 0.015, 4, 8), iron);
    ring.position.y = 0.38;
    glow.add(cap, base, ring);
    this.root.add(glow);
    const phase = Math.random() * 10;
    this.animated.push({
      update: (_dt, t) => {
        light.intensity = intensity * (0.92 + Math.sin(t * 7 + phase) * 0.04 + Math.sin(t * 13.3 + phase) * 0.04);
      },
    });
  }

  /** Floating signpost text (greybox annotations). */
  label(text: string, pos: V3, scale = 1): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = 'bold 44px Palatino, Georgia, serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 40;
    canvas.width = w;
    canvas.height = 72;
    ctx.font = font;
    ctx.fillStyle = 'rgba(243,228,196,0.92)';
    ctx.strokeStyle = '#c9973a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, 68, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b1d14';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 20, 38);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const sprite = new Sprite(new SpriteMaterial({ map: tex, fog: true }));
    sprite.position.set(...pos);
    sprite.scale.set((w / 72) * 0.55 * scale, 0.55 * scale, 1);
    this.root.add(sprite);
  }

  /** Adds an arbitrary decorative mesh (no collider). */
  prop(obj: Object3D): void {
    this.root.add(obj);
  }

  /** Merge all static geometry into as few draw calls as possible. */
  finish(): void {
    const add = (geos: BufferGeometry[], material: Material) => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      geos.forEach((g) => g.dispose());
    };
    add(this.staticGeos, worldMaterial({ grid: true }));
    add(this.iceGeos, worldMaterial({ grid: true, roughness: 0.2 }));
    this.staticGeos = [];
    this.iceGeos = [];
  }

  // ---------------------------------------------------------------- runtime

  /** Advance movers before the player update; they report their per-step delta for riders. */
  fixedUpdate(dt: number): void {
    this.time += dt;
    for (const m of this.movers) {
      const next = m.path(this.time);
      m.prev.copy(m.cur);
      m.info.mover.delta.subVectors(next, m.cur);
      m.cur.copy(next);
      // Descending platforms move first so riders can follow them down;
      // ascending ones move after the player (see applyMovers).
      if (m.info.mover.delta.y < 0) m.collider.setTranslation(next);
    }
  }

  /** Move platform colliders after the player has moved, so riders never start a step inside them. */
  applyMovers(): void {
    for (const m of this.movers) m.collider.setTranslation(m.cur);
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const m of this.movers) m.mesh.position.lerpVectors(m.prev, m.cur, alpha);
    for (const a of this.animated) a.update(dt, this.time);
  }

  waterSurfaceAt(p: Vector3): number | null {
    for (const w of this.water) {
      if (p.x > w.minX && p.x < w.maxX && p.z > w.minZ && p.z < w.maxZ) return w.surface;
    }
    return null;
  }
}

/** Fill a geometry's vertex colours, with gentle per-face variation for a hand-made look. */
export function paint(geo: BufferGeometry, color: string, vary = false): BufferGeometry {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new Color(color);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 3) {
    const k = vary ? 0.96 + hash(pos.getX(i) * 3.1 + pos.getY(i) * 1.7 + pos.getZ(i) * 2.3) * 0.08 : 1;
    c.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3 && i + j < pos.count; j++) colors.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function shade(hex: string, k: number): string {
  return '#' + new Color(hex).multiplyScalar(k).getHexString();
}
