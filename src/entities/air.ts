import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import type { ColliderInfo } from '../engine/physics';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

const FEATHER = new Color('#e8f0ff');

/**
 * Plank seams modelled onto a box. Moving things can't use the world-space 'planks' pattern
 * (it's drawn from world position, so it would slide across them as they move).
 */
function plankSeams(w: number, h: number, d: number, gap = 0.3): BoxGeometry[] {
  const out: BoxGeometry[] = [];
  for (let y = -h / 2 + gap; y < h / 2 - 0.05; y += gap) {
    out.push(new BoxGeometry(w + 0.02, 0.025, d + 0.02).translate(0, y, 0));
  }
  return out;
}

const flat = (geo: BufferGeometry) => (geo.index ? geo.toNonIndexed() : geo);

/**
 * Something Thistledown floats between two places: a platform, a basket or a crate. Cast
 * at its feather-stone (the glowing charm on a post at one corner, at chest height when
 * you ride it) and it glides to the other end, carrying whoever stands on it; cast again
 * and it comes back, so a lift at the far end comes when called. With `returnAfter`, it
 * drifts home by itself after that many seconds at the far end.
 */
export class SkyLift implements Entity, SpellTarget {
  readonly spell = 'thistledown' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private info: ColliderInfo & { mover: { delta: Vector3 } };
  private group = new Group();
  private stoneMat: MeshStandardMaterial;
  private readonly a: Vector3;
  private readonly b: Vector3;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly postOffset: Vector3;
  private readonly halfH: number;
  private atB: boolean;
  private moving: Vector3 | null = null;
  private wait = 0;
  private lastTick = 0;
  private time = Math.random() * 10;

  constructor(
    private spec: SpecOf<'skyLift'>,
    private ctx: WorldContext,
  ) {
    const [w, d] = spec.size;
    const style = spec.style ?? 'platform';
    const h = style === 'crate' ? spec.height ?? 1.2 : 0.3;
    this.halfH = h / 2;
    // `from`/`to` are where the top of the deck sits.
    this.a = new Vector3(...spec.from).add(new Vector3(0, -this.halfH, 0));
    this.b = new Vector3(...spec.to).add(new Vector3(0, -this.halfH, 0));
    this.atB = spec.startAt === 'to';
    this.pos = (this.atB ? this.b : this.a).clone();
    this.prev = this.pos.clone();
    const [px, pz] = spec.post ?? [w / 2 - 0.25, d / 2 - 0.25];
    this.postOffset = new Vector3(px, this.halfH + 1.15, pz);

    const mat = worldMaterial();
    const part = (geo: BufferGeometry, color: string, x: number, y: number, z: number) => {
      const m = new Mesh(paint(flat(geo), color, true), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
    };
    if (style === 'crate') {
      part(new BoxGeometry(w, h, d), COLORS.wood, 0, 0, 0);
      for (const g of plankSeams(w, h, d)) part(g, COLORS.woodDark, 0, 0, 0);
      for (const y of [-h / 2 + 0.1, h / 2 - 0.1]) part(new BoxGeometry(w + 0.03, 0.08, d + 0.03), COLORS.woodDark, 0, y, 0);
    } else if (style === 'basket') {
      part(new BoxGeometry(w, h, d), '#b8925a', 0, 0, 0);
      for (const [x, z, sx, sz] of [
        [0, d / 2 - 0.05, w, 0.1],
        [0, -d / 2 + 0.05, w, 0.1],
        [w / 2 - 0.05, 0, 0.1, d],
        [-w / 2 + 0.05, 0, 0.1, d],
      ]) {
        part(new BoxGeometry(sx, 0.5, sz), '#a07a46', x, 0.4, z);
      }
    } else {
      part(new BoxGeometry(w, h, d), '#8a8a96', 0, 0, 0);
      part(new BoxGeometry(w + 0.06, 0.08, d + 0.06), '#c99a3e', 0, h / 2 - 0.02, 0);
    }
    // The feather-stone on its post.
    part(new CylinderGeometry(0.05, 0.06, 1, 6), '#3a3340', this.postOffset.x, this.halfH + 0.5, this.postOffset.z);
    mergeChildren(this.group);
    this.stoneMat = new MeshStandardMaterial({ color: '#dfe8ff', emissive: new Color('#9fb8ff'), emissiveIntensity: 0.6, roughness: 0.3, flatShading: true });
    const stone = new Mesh(new OctahedronGeometry(0.16, 0), this.stoneMat);
    stone.position.copy(this.postOffset);
    this.group.add(stone);
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);

    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, this.halfH, d / 2).setTranslation(this.pos.x, this.pos.y, this.pos.z));
    // Moving ground: never a safe respawn spot.
    this.info = { mover: { delta: new Vector3() }, temporary: true, noGrab: style !== 'crate' };
    ctx.physics.setInfo(this.collider, this.info);
    this.marker = new RuneMarker(ctx.scene, 'thistledown', 0.5);
    ctx.targets.add(this);
    if (spec.id) ctx.signals.set(spec.id, this.atB);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(this.postOffset);
  }
  enabled(): boolean {
    return !this.moving;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    this.go(!this.atB);
  }

  private go(toB: boolean): void {
    this.atB = toB;
    this.moving = (toB ? this.b : this.a).clone();
    this.wait = toB ? this.spec.returnAfter ?? 0 : 0;
    this.lastTick = Math.ceil(this.wait);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, toB);
    this.ctx.events.emit('levitate', { pos: this.pos.clone().add(this.postOffset) });
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, -this.halfH, 0)), 12, FEATHER, 1.6, 0.12, 0.6);
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.prev.copy(this.pos);
    const delta = this.info.mover.delta.set(0, 0, 0);
    if (this.moving) {
      const rem = this.moving.clone().sub(this.pos);
      const dist = rem.length();
      const step = (this.spec.speed ?? 2.5) * dt;
      if (dist <= step) {
        delta.copy(rem);
        this.moving = null;
        this.ctx.events.emit('levitateStop', { pos: this.pos.clone() });
      } else {
        delta.copy(rem).multiplyScalar(step / dist);
      }
      this.pos.add(delta);
      // Going down: move the collider now so a rider follows it.
      if (delta.y < 0) this.collider.setTranslation(this.pos);
      return;
    }
    if (this.atB && this.wait > 0) {
      this.wait -= dt;
      const tick = Math.ceil(this.wait);
      if (tick < this.lastTick) {
        this.lastTick = tick;
        if (tick > 0 && tick <= 3) this.ctx.events.emit('switchTick', { pos: this.pos.clone() });
      }
      if (this.wait <= 0) this.go(false);
    }
  }

  lateFixedUpdate(): void {
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(_dt: number, alpha: number): void {
    this.group.position.lerpVectors(this.prev, this.pos, alpha);
    // A gentle bob in the air, and the stone glows brighter while it carries you.
    const floating = !this.pos.equals(this.a) || !!this.moving;
    this.group.position.y += floating && !this.moving ? Math.sin(this.time * 2) * 0.02 : 0;
    this.stoneMat.emissiveIntensity = this.moving ? 1.6 : 0.6 + Math.sin(this.time * 3) * 0.2;
    this.marker.sprite.position.copy(this.group.position).add(this.postOffset).add(new Vector3(0, 0.45, 0));
  }
}

/**
 * A clock pendulum swinging across a walkway: its bob knocks you back (and costs a pip).
 * Swings in the plane of `yaw` (0 = along x).
 */
export class Pendulum implements Entity {
  private pivot = new Group();
  private time: number;
  private cooldown = 0;
  private readonly origin: Vector3;
  private readonly axis: Vector3;
  private readonly bob = new Vector3();

  constructor(
    private spec: SpecOf<'pendulum'>,
    private ctx: WorldContext,
  ) {
    this.origin = new Vector3(...spec.pos);
    this.axis = new Vector3(Math.cos(spec.yaw ?? 0), 0, -Math.sin(spec.yaw ?? 0));
    this.time = (spec.phase ?? 0) * spec.period;
    const mat = worldMaterial();
    if (spec.style === 'log') {
      // A log slung across the swing on two ropes, its cut ends showing the rings.
      const r = spec.bob ?? 0.7;
      const log = new Mesh(paint(flat(new CylinderGeometry(r, r * 1.05, 2.6, 9)), '#6b4a2e', true), mat);
      log.rotation.x = Math.PI / 2;
      log.position.y = -spec.length;
      this.pivot.add(log);
      for (const side of [-1, 1]) {
        const rope = new Mesh(paint(flat(new CylinderGeometry(0.04, 0.04, spec.length, 5)), '#c8b090', true), mat);
        rope.position.set(0, -spec.length / 2, side * 0.9);
        const end = new Mesh(paint(flat(new CylinderGeometry(r * 0.85, r * 0.85, 0.04, 9)), '#c89a6a', true), mat);
        end.rotation.x = Math.PI / 2;
        end.position.set(0, -spec.length, side * 1.31);
        this.pivot.add(rope, end);
      }
    } else {
      const rod = new Mesh(paint(flat(new CylinderGeometry(0.06, 0.06, spec.length, 6)), '#3a3340', true), mat);
      rod.position.y = -spec.length / 2;
      const disc = new Mesh(paint(flat(new CylinderGeometry(spec.bob ?? 0.7, spec.bob ?? 0.7, 0.25, 16)), '#c99a3e', true), mat);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = -spec.length;
      const boss = new Mesh(paint(flat(new SphereGeometry(0.2, 8, 6)), '#8a6a2a', true), mat);
      boss.position.y = -spec.length;
      this.pivot.add(rod, disc, boss);
    }
    mergeChildren(this.pivot);
    this.pivot.position.copy(this.origin);
    this.pivot.rotation.y = spec.yaw ?? 0;
    ctx.scene.add(this.pivot);
  }

  private angle(): number {
    return Math.sin((this.time / this.spec.period) * Math.PI * 2) * this.spec.swing;
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.cooldown -= dt;
    const a = this.angle();
    this.bob.copy(this.origin).addScaledVector(this.axis, Math.sin(a) * this.spec.length).add(new Vector3(0, -Math.cos(a) * this.spec.length, 0));
    const p = this.ctx.player.pos;
    const r = (this.spec.bob ?? 0.7) + 0.4;
    // The disc is thin across the swing, round along it.
    const rel = p.clone().sub(this.bob);
    const across = rel.clone().sub(this.axis.clone().multiplyScalar(rel.dot(this.axis))).setY(0).length();
    if (this.cooldown <= 0 && Math.hypot(rel.dot(this.axis), rel.y) < r && across < 0.6) {
      if (this.ctx.health.damage(1, this.bob.clone())) this.cooldown = 1;
    }
  }

  frameUpdate(): void {
    this.pivot.rotation.set(0, this.spec.yaw ?? 0, this.angle(), 'YXZ');
  }
}
