import type RAPIER from '@dimforge/rapier3d-compat';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { Physics } from '../engine/physics';

/*
 * Small effects every foe shares, so they all react the same way: a white flash when a spell
 * lands, dizzy stars while stunned, and a death where the body falls apart instead of popping
 * out of existence.
 */

/**
 * A short white flash over a foe when a spell lands. Plain materials get a white emissive;
 * `glowing` ones (a crab's shell, whose own glow the foe animates) are pushed towards white on
 * top of whatever the foe set, so call `update` after the foe's own material changes.
 */
export class HitFlash {
  private readonly plain: MeshStandardMaterial[];
  private readonly glowing: { m: MeshStandardMaterial; base: Color }[] = [];
  private t = 0;
  private static readonly LENGTH = 0.16;
  private static readonly WHITE = new Color('#ffffff');

  constructor(root: Object3D, glowing: MeshStandardMaterial[] = []) {
    const seen = new Set<Material>(glowing);
    for (const m of glowing) this.glowing.push({ m, base: m.emissive.clone() });
    this.plain = plainMaterials(root, seen);
  }

  flash(): void {
    this.t = HitFlash.LENGTH;
  }

  update(dt: number): void {
    if (this.t <= 0) return;
    this.t = Math.max(0, this.t - dt);
    const f = (this.t / HitFlash.LENGTH) ** 1.5 * 0.75;
    for (const m of this.plain) {
      m.emissive.setScalar(f);
      m.emissiveIntensity = 1;
    }
    for (const { m, base } of this.glowing) {
      m.emissive.copy(base).lerp(HitFlash.WHITE, f);
      m.emissiveIntensity = Math.max(m.emissiveIntensity, f * 1.2);
    }
  }
}

/** A foe's lit, non-glowing materials (eyes, visors and the like glow on their own). */
export function plainMaterials(root: Object3D, skip = new Set<Material>()): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (!(o as Mesh).isMesh || !m || skip.has(m)) return;
    skip.add(m);
    if (m.isMeshStandardMaterial && m.emissive.getHex() === 0) out.push(m);
  });
  return out;
}

/** Three little stars circling a stunned head (the Gnarling's, shared). */
export class DizzyStars extends Group {
  private static mat?: MeshStandardMaterial;
  private static geo?: OctahedronGeometry;

  constructor(height: number, radius = 0.3, size = 1) {
    super();
    DizzyStars.mat ??= new MeshStandardMaterial({ color: '#ffe58a', emissive: new Color('#ffd84a'), emissiveIntensity: 1 });
    DizzyStars.geo ??= new OctahedronGeometry(0.07, 0);
    for (let i = 0; i < 3; i++) {
      const s = new Mesh(DizzyStars.geo, DizzyStars.mat);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      s.scale.setScalar(size);
      this.add(s);
    }
    this.position.y = height;
    this.visible = false;
  }

  update(dt: number, show: boolean, t: number): void {
    this.visible = show;
    if (!show) return;
    this.rotation.y += dt * 6;
    this.children.forEach((s, i) => (s.position.y = Math.sin(t * 5 + i * 2.1) * 0.05));
  }
}

interface Piece {
  obj: Object3D;
  vel: Vector3;
  spin: Vector3;
  floor: number;
  gravity: number;
  age: number;
  life: number;
}

export interface CrumbleOptions {
  /** The foe's centre; pieces fly out from it. */
  from: Vector3;
  /** Extra velocity for every piece (a knock's direction). */
  push?: Vector3;
  /** How hard pieces fly outwards, and upwards. */
  speed?: number;
  up?: number;
  gravity?: number;
  /** Seconds the pieces lie there before they shrink away. */
  life?: number;
  /** The foe's own solid colliders, which the pieces fall through (they may linger a step). */
  ignore?: RAPIER.Collider[];
  /** Tint the pieces (charred, frosted): they get a darkened copy of their material. */
  tint?: Color;
}

/**
 * Pieces of beaten foes: copies of the foe's meshes (so the foe itself can come back, as a
 * reforming crab does) that fly apart, bounce on the floor under them, and shrink away.
 * Stepped in the fixed update, so tests see the same thing every run.
 */
export class Debris {
  private pieces: Piece[] = [];
  private readonly tinted = new Map<string, Material>();

  constructor(
    private readonly scene: Object3D,
    private readonly physics: Physics,
  ) {}

  /** Breaks `root` into its meshes. The caller hides the foe itself. */
  crumble(root: Object3D, o: CrumbleOptions): void {
    root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    root.traverse((m) => {
      if ((m as Mesh).isMesh && m.visible && isShown(m)) meshes.push(m as Mesh);
    });
    const speed = o.speed ?? 3;
    for (const src of meshes) {
      src.geometry.computeBoundingSphere();
      const sphere = src.geometry.boundingSphere!;
      // Each piece tumbles about its own middle: a pivot there, the mesh offset inside it.
      const mid = sphere.center.clone().applyMatrix4(src.matrixWorld);
      const pivot = new Group();
      pivot.position.copy(this.scene.worldToLocal(mid.clone()));
      this.scene.add(pivot);
      const mesh = new Mesh(src.geometry, o.tint ? this.tintOf(src.material as Material, o.tint) : src.material);
      mesh.castShadow = src.castShadow;
      src.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.position.sub(mid);
      pivot.add(mesh);
      const out = mid.clone().sub(o.from).setY(0);
      if (out.lengthSq() < 1e-4) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      out.normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      if (o.push) out.add(o.push);
      out.y = (o.up ?? 3) * (0.6 + Math.random() * 0.8);
      const skip = new Set((o.ignore ?? []).map((c) => c.handle));
      const ground = this.physics.raycast(mid.clone().add(new Vector3(0, 0.05, 0)), new Vector3(0, -1, 0), 12, undefined, (c) => !skip.has(c.handle));
      this.pieces.push({
        obj: pivot,
        vel: out,
        spin: new Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
        // Pieces come to rest with their middle a little above the floor.
        floor: ground ? Math.min(pivot.position.y, this.scene.worldToLocal(ground.point.clone()).y + Math.min(0.12, sphere.radius * mesh.scale.x * 0.4)) : -Infinity,
        gravity: o.gravity ?? 18,
        age: 0,
        life: (o.life ?? 2.5) * (0.8 + Math.random() * 0.4),
      });
    }
  }

  fixedUpdate(dt: number): void {
    if (!this.pieces.length) return;
    this.pieces = this.pieces.filter((p) => {
      p.age += dt;
      const o = p.obj;
      if (p.age > p.life + 0.5 || o.position.y < p.floor - 30) {
        o.removeFromParent();
        return false;
      }
      p.vel.y -= p.gravity * dt;
      o.position.addScaledVector(p.vel, dt);
      if (o.position.y <= p.floor) {
        o.position.y = p.floor;
        p.vel.y = Math.abs(p.vel.y) > 1.5 ? -p.vel.y * 0.3 : 0;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
        p.spin.multiplyScalar(0.6);
      }
      o.rotation.x += p.spin.x * dt;
      o.rotation.y += p.spin.y * dt;
      o.rotation.z += p.spin.z * dt;
      if (p.age > p.life) o.scale.setScalar(Math.max(0.001, 1 - (p.age - p.life) / 0.5));
      return true;
    });
  }

  private tintOf(m: Material, tint: Color): Material {
    const key = `${m.uuid}:${tint.getHexString()}`;
    let t = this.tinted.get(key);
    if (!t) {
      t = m.clone();
      const s = t as MeshStandardMaterial;
      if (s.color) s.color.multiply(tint);
      if (s.emissive) s.emissive.multiplyScalar(0.2);
      this.tinted.set(key, t);
    }
    return t;
  }
}

function isShown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

interface BoltLook {
  core: MeshBasicMaterial;
  halo: SpriteMaterial;
  tail: MeshBasicMaterial;
  inner: MeshBasicMaterial;
  star: MeshBasicMaterial;
}
const boltLooks = new Map<string, BoltLook>();
let boltGeo: { core: SphereGeometry; tail: ConeGeometry; inner: ConeGeometry; star: BufferGeometry } | null = null;

function glowTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, inner);
  grad.addColorStop(0.5, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Opaque at the cone's base (by the core), fading out to its tip. */
function tailTexture(color: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function boltLook(color: string, glow: string): BoltLook {
  const key = color + glow;
  let look = boltLooks.get(key);
  if (!look) {
    const add = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false } as const;
    look = {
      core: new MeshBasicMaterial({ color: new Color(color).lerp(new Color('#ffffff'), 0.7), toneMapped: false }),
      halo: new SpriteMaterial({ map: glowTexture(color, glow), ...add }),
      tail: new MeshBasicMaterial({ map: tailTexture(glow), opacity: 0.8, side: DoubleSide, ...add }),
      inner: new MeshBasicMaterial({ map: tailTexture(color), opacity: 0.9, side: DoubleSide, ...add }),
      star: new MeshBasicMaterial({ color, side: DoubleSide, ...add }),
    };
    boltLooks.set(key, look);
  }
  return look;
}

/**
 * A magic bolt: a white-hot core in a pulsing halo, a comet tail streaming behind it along its
 * flight, and a four-pointed spark spinning round it. Shared geometry and materials per colour.
 */
export class MagicBolt extends Group {
  private readonly halo: Sprite;
  private readonly star: Mesh;
  private readonly tail: Group;
  private static readonly AHEAD = new Vector3();

  constructor(color: string, glow: string, size = 1) {
    super();
    if (!boltGeo) {
      const star = new Shape();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 0.07 : 0.32;
        if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      // Cones point their tips down -Z, their bases at the core.
      const cone = (r: number, h: number) => new ConeGeometry(r, h, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -h / 2);
      boltGeo = { core: new SphereGeometry(0.1, 10, 8), tail: cone(0.17, 1.1), inner: cone(0.08, 0.7), star: new ShapeGeometry(star) };
    }
    const look = boltLook(color, glow);
    this.add(new Mesh(boltGeo.core, look.core));
    this.halo = new Sprite(look.halo);
    this.halo.scale.setScalar(0.75);
    this.add(this.halo);
    this.tail = new Group();
    this.tail.add(new Mesh(boltGeo.tail, look.tail), new Mesh(boltGeo.inner, look.inner));
    this.add(this.tail);
    this.star = new Mesh(boltGeo.star, look.star);
    this.add(this.star);
    this.scale.setScalar(size);
  }

  /** Place it, point the tail away from where it's going, and let it pulse and spin. */
  update(pos: Vector3, vel: Vector3, t: number): void {
    this.position.copy(pos);
    const speed = vel.length();
    if (speed > 0.01) this.lookAt(MagicBolt.AHEAD.copy(pos).add(vel));
    // The tail stretches with speed and flickers.
    this.tail.scale.set(1, 1, MathUtils.clamp(speed / 6.5, 0.4, 1.6) * (0.9 + Math.sin(t * 37) * 0.1));
    this.halo.scale.setScalar(0.7 + Math.sin(t * 19) * 0.12);
    this.star.rotation.z = t * 9;
  }
}
