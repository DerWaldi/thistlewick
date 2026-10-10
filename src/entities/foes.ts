import RAPIER from '@dimforge/rapier3d-compat';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

/**
 * Two foes that fight from a distance, so you can't just walk up and thwack them:
 *
 * Hexling: a bad fairy. She circles high over her patch, and when she can see you she
 * winds up (a purple glow) and throws a hex orb that drifts after you for a moment. A
 * Thwackwort knocks her out of the air; while she's down, a second one banishes her (a
 * charged hit does both at once). High up she's hard to aim at: back off, or wait for her
 * to swoop.
 *
 * Sootling: a chimney imp with a sack of soot-bombs. He lobs them in an arc to where you're
 * heading; a bomb lands, fizzes and blinks, and goes off after its fuse. Thwackwort a
 * fizzing bomb and it goes flying (back at him, if you aim well: his own blast knocks him
 * out). Thwackwort him and he's dazed, and drops whatever he was about to throw; a second
 * thwack while he's dazed banishes him.
 */

const HEX = new Color('#c86aff');
const SOOT = new Color('#3a3036');
const SPARK = new Color('#ffb347');
const BLAST = new Color('#ff7a2a');

function part(geo: BufferGeometry, color: string, mat: MeshStandardMaterial): Mesh {
  const g = geo.index ? geo.toNonIndexed() : geo;
  return new Mesh(paint(g, color, true), mat);
}

/** Pays out sweets the first time a placed foe is beaten (never again), on solid ground. */
function loot(ctx: WorldContext, id: string, at: Vector3): void {
  const flag = `looted:${id}`;
  if (ctx.state.flags.has(flag)) return;
  ctx.state.flags.add(flag);
  // Banished over a chasm? The sweets land where you can reach them.
  const ground = ctx.physics.raycast(at, new Vector3(0, -1, 0), 8);
  at = ground ? ground.point.clone().add(new Vector3(0, 0.6, 0)) : ctx.player.pos.clone();
  ctx.sweets.burst('fizzwort', at, 3);
  ctx.sweets.burst('bramble', at, 1);
}

function canSee(ctx: WorldContext, from: Vector3, target: Vector3, ignore: RAPIER.Collider): boolean {
  const to = target.clone().sub(from);
  const dist = to.length();
  return !ctx.physics.raycast(from, to.normalize(), dist, ignore, (c) => c.handle !== ctx.player.collider.handle && !ctx.physics.getInfo(c)?.seeThrough);
}

/** Banished in a puff: it's gone for this visit (and for good with `persist`). */
function banish(ctx: WorldContext, spec: { id?: string; persist?: boolean }, id: string, at: Vector3): void {
  ctx.fx.burst(at.clone(), 26, HEX, 3.4, 0.16, 0.5);
  ctx.events.emit('foeBanished', { pos: at.clone() });
  if (spec.id) {
    ctx.signals.set(spec.id, true);
    if (spec.persist) ctx.state.flags.add(`down:${spec.id}`);
  }
  loot(ctx, id, at);
}

// ================================================================ Hexling

type HexState = 'fly' | 'windup' | 'down' | 'gone';

interface Orb {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
  homing: number;
}

export class Hexling implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.8;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly wings: Mesh[] = [];
  private readonly glow: MeshStandardMaterial;
  private readonly home: Vector3;
  readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly orbs: Orb[] = [];
  private readonly orbMat = new MeshStandardMaterial({ color: '#e0a8ff', emissive: new Color('#a040ff'), emissiveIntensity: 2.6 });
  private state: HexState = 'fly';
  private timer = 0;
  private reload: number;
  private t = Math.random() * 20;
  private vy = 0;

  constructor(
    private spec: SpecOf<'hexling'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.home = new Vector3(spec.pos[0], spec.pos[1] + (spec.height ?? 3.2), spec.pos[2]);
    this.pos = this.home.clone();
    this.prev = this.pos.clone();
    this.reload = 1.2 + Math.random() * 1.5;
    const mat = worldMaterial();
    this.glow = new MeshStandardMaterial({ color: '#f0d0ff', emissive: new Color('#b050ff'), emissiveIntensity: 1, flatShading: true });
    // A thin dark-purple figure in a ragged dress, a pointed cap, pale green skin.
    const dress = part(new ConeGeometry(0.28, 0.75, 7), '#3a1a4a', mat);
    dress.position.y = -0.15;
    const torso = part(new CylinderGeometry(0.1, 0.14, 0.3, 6), '#4a2a5a', mat);
    torso.position.y = 0.32;
    const head = part(new SphereGeometry(0.16, 8, 6), '#b8d8a0', mat);
    head.position.y = 0.58;
    const cap = part(new ConeGeometry(0.15, 0.42, 6), '#2a1030', mat);
    cap.position.set(0, 0.86, -0.04);
    cap.rotation.x = -0.35;
    const hair = part(new IcosahedronGeometry(0.17, 0), '#5a2a6a', mat);
    hair.position.set(0, 0.6, -0.06);
    hair.scale.set(1, 0.8, 0.9);
    this.body.add(dress, torso, head, cap, hair);
    for (const side of [-1, 1]) {
      const arm = part(new CylinderGeometry(0.03, 0.03, 0.34, 4), '#b8d8a0', mat);
      arm.position.set(side * 0.16, 0.3, 0.06);
      arm.rotation.z = side * 0.9;
      this.body.add(arm);
    }
    mergeChildren(this.body);
    // Glowing eyes and a hex glow in her hands (the wind-up tell).
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.035, 5, 4), this.glow);
      eye.position.set(side * 0.06, 0.6, 0.14);
      this.body.add(eye);
    }
    const hand = new Mesh(new IcosahedronGeometry(0.1, 1), this.glow);
    hand.position.set(0, 0.42, 0.28);
    hand.name = 'hand';
    this.body.add(hand);
    // Moth-like wings, flapping.
    const wingMat = new MeshBasicMaterial({ color: '#b080d0', transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false });
    for (const side of [-1, 1]) {
      const g = new PlaneGeometry(0.7, 0.55);
      g.translate(side * 0.38, 0.05, 0);
      const w = new Mesh(g, wingMat);
      w.position.set(0, 0.36, -0.1);
      this.wings.push(w);
      this.body.add(w);
    }
    this.root.add(this.body);
    // Bigger than a real fairy, so she reads from across a room.
    this.body.scale.setScalar(1.4);
    this.root.traverse((o) => (o.castShadow = true));
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.55).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true));
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.3, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state === 'down' || hit.charge > 0.5) {
      this.gone();
      return;
    }
    // Knocked out of the air: she drops, and lies dazed for a moment.
    this.state = 'down';
    this.timer = 3.2;
    this.vy = 1.5;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone(), 12, HEX, 2.2, 0.12, 0.8);
  }

  private gone(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    banish(this.ctx, this.spec, this.id, this.pos);
  }

  private throwOrb(): void {
    const from = this.pos.clone().add(new Vector3(0, 0.4, 0));
    const aim = this.ctx.player.pos.clone().add(new Vector3(0, 0.3, 0)).addScaledVector(this.ctx.player.vel, 0.3).sub(from);
    const vel = aim.normalize().multiplyScalar(this.spec.speed ?? 6.5);
    const mesh = new Mesh(new IcosahedronGeometry(0.2, 1), this.orbMat);
    mesh.position.copy(from);
    this.ctx.scene.add(mesh);
    this.orbs.push({ mesh, pos: from, vel, life: 4, homing: 1.4 });
    this.ctx.events.emit('hexCast', { pos: from.clone() });
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    this.updateOrbs(dt);
    if (this.state === 'gone') return;
    const p = this.ctx.player.pos;
    const r = this.spec.radius ?? 3.5;
    switch (this.state) {
      case 'fly':
      case 'windup': {
        // A lazy figure-of-eight over her patch, bobbing; she slows to throw.
        const speed = this.state === 'windup' ? 0.15 : 0.55;
        this.t += dt * (speed - 1);
        const a = this.t * 0.9;
        const target = this.home.clone().add(new Vector3(Math.sin(a) * r, Math.sin(this.t * 2.3) * 0.35, Math.sin(a * 2) * r * 0.5));
        this.pos.lerp(target, 1 - Math.exp(-3 * dt));
        if (this.state === 'fly') {
          this.reload -= dt;
          const range = this.spec.range ?? 15;
          if (this.reload <= 0 && p.distanceTo(this.pos) < range && this.ctx.player.mode !== 'reset' && canSee(this.ctx, this.pos, p, this.collider)) {
            this.state = 'windup';
            this.timer = 0.75;
          }
        } else if (this.timer <= 0) {
          this.throwOrb();
          this.state = 'fly';
          this.reload = this.spec.interval ?? 2.6;
        }
        break;
      }
      case 'down': {
        // Falls to the ground (or whatever's under her), lies dazed, then flutters back up.
        const ground = this.ctx.physics.raycast(this.pos, new Vector3(0, -1, 0), 80, this.collider);
        const floor = ground ? ground.point.y + 0.35 : this.pos.y;
        this.vy -= 18 * dt;
        this.pos.y = Math.max(floor, this.pos.y + this.vy * dt);
        if (this.pos.y <= floor) this.vy = 0;
        if (this.timer <= 0) {
          this.state = 'fly';
          this.reload = 1.5;
        }
        break;
      }
    }
    this.collider.setTranslation(this.pos);
    // Brushing past her stings.
    if (this.state !== 'down' && this.pos.distanceTo(p) < 0.8) this.ctx.health.damage(1, this.pos.clone());
  }

  private updateOrbs(dt: number): void {
    const p = this.ctx.player.pos;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      // Drifts after you for its first moments, then flies straight: sidestep late.
      if (o.homing > 0) {
        o.homing -= dt;
        const want = p.clone().add(new Vector3(0, 0.3, 0)).sub(o.pos).normalize().multiplyScalar(o.vel.length());
        o.vel.lerp(want, 1 - Math.exp(-1.6 * dt));
      }
      const step = o.vel.clone().multiplyScalar(dt);
      const hitWall = this.ctx.physics.raycast(o.pos, step.clone().normalize(), step.length(), this.collider, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
      o.pos.add(step);
      const hitPlayer = o.pos.distanceTo(p) < 0.65 && this.ctx.player.mode !== 'reset';
      if (hitPlayer) this.ctx.health.damage(1, o.pos.clone());
      if (hitPlayer || hitWall || o.life <= 0) {
        this.ctx.fx.burst(o.pos.clone(), 12, HEX, 2.2, 0.12, 0.6);
        this.ctx.events.emit('hexHit', { pos: o.pos.clone() });
        o.mesh.removeFromParent();
        o.mesh.geometry.dispose();
        this.orbs.splice(i, 1);
      }
    }
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const o of this.orbs) {
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y += dt * 6;
      if (Math.random() < dt * 24) this.ctx.fx.burst(o.pos.clone(), 1, HEX, 0.5, 0.07, 0.2);
    }
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    // A faint trail of hex-dust where she flies.
    if (this.state !== 'down' && Math.random() < dt * 14) this.ctx.fx.burst(this.root.position.clone().add(new Vector3(0, 0.2, 0)), 1, HEX, 0.3, 0.06, -0.1);
    const p = this.ctx.player.pos;
    this.root.rotation.y = MathUtils.damp(this.root.rotation.y, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 5, dt);
    const down = this.state === 'down';
    const flap = down ? 0.15 : Math.sin(this.t * 26) * 0.7;
    this.wings[0].rotation.y = 0.3 + flap;
    this.wings[1].rotation.y = -0.3 - flap;
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, down ? 1.4 : Math.sin(this.t * 1.3) * 0.12, 8, dt);
    this.glow.emissiveIntensity = this.state === 'windup' ? 3 + Math.sin(this.t * 40) : down ? 0.3 : 1;
    const hand = this.body.getObjectByName('hand')!;
    hand.visible = this.state === 'windup';
    hand.scale.setScalar(this.state === 'windup' ? 1 + (0.75 - Math.max(0, this.timer)) * 1.6 : 1);
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.3, 0));
  }
}

// ================================================================ Sootling

type SootState = 'idle' | 'windup' | 'dazed' | 'gone';

/** A soot-bomb: in the air, then fizzing on the ground until its fuse runs out. */
class SootBomb implements SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.45;
  readonly mesh: Group;
  private readonly fuseMat: MeshStandardMaterial;
  readonly pos: Vector3;
  readonly vel: Vector3;
  fuse: number;
  grounded = false;
  done = false;
  private t = 0;

  constructor(
    private ctx: WorldContext,
    from: Vector3,
    vel: Vector3,
    fuse: number,
    private onBlast: (at: Vector3) => void,
    /** Where a kick in this direction should send it (the thrower, if he's roughly that way). */
    private kickTarget: (dir: Vector3, from: Vector3) => Vector3 | null,
  ) {
    this.pos = from.clone();
    this.vel = vel.clone();
    this.fuse = fuse;
    this.mesh = new Group();
    const shell = new Mesh(new IcosahedronGeometry(0.26, 1), new MeshStandardMaterial({ color: '#2a2428', roughness: 0.7, flatShading: true }));
    this.fuseMat = new MeshStandardMaterial({ color: '#ffd27a', emissive: new Color('#ff8a3c'), emissiveIntensity: 2 });
    const spark = new Mesh(new SphereGeometry(0.07, 6, 4), this.fuseMat);
    spark.position.y = 0.3;
    const cord = new Mesh(new CylinderGeometry(0.02, 0.02, 0.14, 4), new MeshStandardMaterial({ color: '#c8b090' }));
    cord.position.y = 0.24;
    this.mesh.add(shell, cord, spark);
    this.mesh.position.copy(this.pos);
    ctx.scene.add(this.mesh);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.4);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos);
  }
  enabled(): boolean {
    return !this.done && this.grounded;
  }
  owns(): boolean {
    return false;
  }

  /** Knocked away, off in the direction of the hit (back at whoever threw it, with luck). */
  onSpell(hit: SpellHit): void {
    const d = new Vector3(hit.dir.x, 0, hit.dir.z).normalize();
    const target = this.kickTarget(d, this.pos);
    if (target) {
      // Kicked his way: it arcs back and lands on him, just as the fuse runs out.
      const flight = MathUtils.clamp(target.distanceTo(this.pos) / 12, 0.45, 1.1);
      this.vel.set((target.x - this.pos.x) / flight, (target.y - this.pos.y) / flight + 10 * flight, (target.z - this.pos.z) / flight);
      this.fuse = flight + 0.12;
    } else {
      this.vel.copy(d.multiplyScalar(10 + hit.charge * 5)).add(new Vector3(0, 5, 0));
      this.fuse = Math.max(this.fuse, 0.9);
    }
    this.grounded = false;
    this.ctx.events.emit('bombKick', { pos: this.pos.clone() });
  }

  update(dt: number): void {
    this.t += dt;
    this.fuse -= dt;
    if (!this.grounded) {
      this.vel.y -= 20 * dt;
      const step = this.vel.clone().multiplyScalar(dt);
      const hit = this.ctx.physics.raycast(this.pos, step.clone().normalize(), step.length() + 0.25, undefined, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
      if (hit) {
        // Lands (or thuds against a wall and drops).
        this.pos.copy(hit.point).add(new Vector3(0, 0.26, 0));
        if (hit.normal.y > 0.5) {
          this.grounded = true;
          this.vel.set(0, 0, 0);
          this.ctx.events.emit('bombLand', { pos: this.pos.clone() });
        } else {
          this.vel.set(hit.normal.x * 1.5, Math.min(this.vel.y, 0), hit.normal.z * 1.5);
        }
      } else {
        this.pos.add(step);
      }
      if (this.pos.y < -60) this.fuse = 0;
    }
    if (this.fuse <= 0) this.blast();
  }

  private blast(): void {
    this.done = true;
    this.mesh.removeFromParent();
    this.marker.sprite.removeFromParent();
    this.ctx.targets.remove(this);
    this.onBlast(this.pos.clone());
  }

  frame(dt: number): void {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y += dt * (this.grounded ? 1 : 8);
    // The fuse blinks faster as it burns down.
    const rate = this.fuse < 0.8 ? 18 : this.fuse < 1.6 ? 9 : 4;
    this.fuseMat.emissiveIntensity = Math.sin(this.t * rate) > 0 ? 3.2 : 0.6;
    if (Math.random() < dt * 16) this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 0.32, 0)), 1, SPARK, 0.8, 0.05, 0.3);
    this.marker.sprite.position.copy(this.pos).add(new Vector3(0, 0.7, 0));
  }
}

export class Sootling implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly arm = new Group();
  private readonly eyeMat: MeshStandardMaterial;
  readonly pos: Vector3;
  private readonly home: Vector3;
  private readonly prev: Vector3;
  private readonly bombs: SootBomb[] = [];
  private state: SootState = 'idle';
  private timer = 0;
  private reload: number;
  private t = Math.random() * 10;
  private facing = 0;
  private hop = 0;

  constructor(
    private spec: SpecOf<'sootling'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1], spec.pos[2]);
    this.home = this.pos.clone();
    this.prev = this.pos.clone();
    this.reload = 1 + Math.random() * 1.5;
    this.facing = spec.yaw ?? 0;
    const mat = worldMaterial();
    this.eyeMat = new MeshStandardMaterial({ color: '#ffe08a', emissive: new Color('#ffb020'), emissiveIntensity: 1.6 });
    // A squat soot-black imp with big ears, a sack of bombs on his back.
    const belly = part(new SphereGeometry(0.42, 8, 6), '#2e282c', mat);
    belly.scale.set(1, 0.9, 0.95);
    belly.position.y = 0.45;
    const head = part(new SphereGeometry(0.3, 8, 6), '#3a3236', mat);
    head.position.set(0, 0.95, 0.05);
    const sack = part(new IcosahedronGeometry(0.34, 0), '#7a5a3a', mat);
    sack.position.set(0, 0.62, -0.38);
    for (const side of [-1, 1]) {
      const ear = part(new ConeGeometry(0.1, 0.4, 4), '#3a3236', mat);
      ear.position.set(side * 0.3, 1.1, 0);
      ear.rotation.z = -side * 1.1;
      const foot = part(new SphereGeometry(0.13, 6, 4), '#1e1a1c', mat);
      foot.position.set(side * 0.2, 0.08, 0.1);
      foot.scale.set(1, 0.6, 1.4);
      this.body.add(ear, foot);
    }
    this.body.add(belly, head, sack);
    mergeChildren(this.body);
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.065, 6, 4), this.eyeMat);
      eye.position.set(side * 0.11, 1, 0.3);
      this.body.add(eye);
    }
    // The throwing arm, with a bomb in hand during the wind-up.
    const armMesh = part(new CylinderGeometry(0.06, 0.05, 0.45, 5), '#2e282c', mat);
    armMesh.position.y = 0.22;
    const held = new Mesh(new IcosahedronGeometry(0.2, 1), new MeshStandardMaterial({ color: '#2a2428', flatShading: true }));
    held.position.y = 0.5;
    held.name = 'held';
    this.arm.add(armMesh, held);
    this.arm.position.set(0.32, 0.6, 0);
    this.body.add(this.arm);
    this.root.add(this.body);
    this.root.traverse((o) => (o.castShadow = true));
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.5).setTranslation(this.pos.x, this.pos.y + 0.6, this.pos.z).setSensor(true));
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.7, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state === 'dazed') {
      this.gone();
      return;
    }
    // Caught mid-throw: the bomb drops at his feet.
    if (this.state === 'windup') this.lob(this.pos.clone().add(new Vector3(Math.sin(this.facing) * 0.4, 0, Math.cos(this.facing) * 0.4)), 1.4, 0.5);
    this.state = 'dazed';
    this.timer = 2.6 + hit.charge * 1.5;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private gone(): void {
    if (this.state === 'gone') return;
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    banish(this.ctx, this.spec, this.id, this.pos.clone().add(new Vector3(0, 0.6, 0)));
  }

  /** Throws a bomb to land at `at` after `flight` seconds. */
  private lob(at: Vector3, fuse: number, flight: number): void {
    const from = this.pos.clone().add(new Vector3(0, 1.2, 0));
    const g = 20;
    const vel = new Vector3((at.x - from.x) / flight, (at.y - from.y) / flight + 0.5 * g * flight, (at.z - from.z) / flight);
    this.bombs.push(
      new SootBomb(this.ctx, from, vel, fuse + flight, (p) => this.blast(p), (dir, at) => {
        if (this.state === 'gone') return null;
        const to = this.pos.clone().sub(at);
        to.y = 0;
        const dist = to.length();
        return dist < 16 && to.normalize().dot(dir) > Math.cos(0.45) ? this.pos.clone().add(new Vector3(0, 0.3, 0)) : null;
      }),
    );
    this.ctx.events.emit('bombThrow', { pos: from.clone() });
  }

  /** Everything in reach gets knocked about: you, Gnarlings, and the thrower himself. */
  private blast(at: Vector3): void {
    const r = this.spec.blastRadius ?? 2.4;
    this.ctx.events.emit('bombBlast', { pos: at.clone() });
    this.ctx.fx.burst(at.clone(), 30, BLAST, 5, 0.2, 0.6);
    this.ctx.fx.burst(at.clone().add(new Vector3(0, 0.4, 0)), 22, SOOT, 2.4, 0.3, -0.2);
    const p = this.ctx.player.pos;
    if (p.distanceTo(at) < r && this.ctx.player.mode !== 'reset') this.ctx.health.damage(p.distanceTo(at) < r * 0.45 ? 2 : 1, at.clone());
    for (const c of this.ctx.creatures) if (c.pos.distanceTo(at) < r) c.bitten(at);
    if (this.state !== 'gone' && this.pos.clone().add(new Vector3(0, 0.6, 0)).distanceTo(at) < r) this.gone();
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      this.bombs[i].update(dt);
      if (this.bombs[i].done) this.bombs.splice(i, 1);
    }
    if (this.state === 'gone') return;
    const p = this.ctx.player.pos;
    switch (this.state) {
      case 'idle': {
        // Shuffles about his spot, then turns to throw when he sees you.
        const wander = this.spec.wander ?? 1.2;
        this.pos.x = this.home.x + Math.sin(this.t * 0.7) * wander;
        this.pos.z = this.home.z + Math.sin(this.t * 0.45) * wander * 0.6;
        this.reload -= dt;
        const range = this.spec.range ?? 16;
        const eye = this.pos.clone().add(new Vector3(0, 1, 0));
        if (this.reload <= 0 && p.distanceTo(this.pos) < range && this.ctx.player.mode !== 'reset' && canSee(this.ctx, eye, p, this.collider)) {
          this.state = 'windup';
          this.timer = 0.8;
        }
        break;
      }
      case 'windup':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          // Aims where you're going, give or take.
          const flight = MathUtils.clamp(p.distanceTo(this.pos) / 9, 0.6, 1.4);
          const at = p.clone().addScaledVector(this.ctx.player.vel, flight * 0.8);
          at.y = p.y - 0.9;
          at.x += (Math.random() - 0.5) * 1.2;
          at.z += (Math.random() - 0.5) * 1.2;
          this.lob(at, this.spec.fuse ?? 1.6, flight);
          this.state = 'idle';
          this.reload = this.spec.interval ?? 3;
        }
        break;
      case 'dazed':
        if (this.timer <= 0) {
          this.state = 'idle';
          this.reload = 1.2;
        }
        break;
    }
    this.collider.setTranslation(new Vector3(this.pos.x, this.pos.y + 0.6, this.pos.z));
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const b of this.bombs) b.frame(dt);
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = MathUtils.damp(this.root.rotation.y, this.facing, 6, dt);
    const dazed = this.state === 'dazed';
    this.hop += dt * (dazed ? 0 : 6);
    this.body.position.y = dazed ? 0 : Math.abs(Math.sin(this.hop)) * 0.06;
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, dazed ? 0.9 : 0, 8, dt);
    const windup = this.state === 'windup';
    this.arm.rotation.x = MathUtils.damp(this.arm.rotation.x, windup ? -2.4 : -0.3, 10, dt);
    this.arm.getObjectByName('held')!.visible = windup;
    this.eyeMat.emissiveIntensity = dazed ? 0.2 : windup ? 3 : 1.6;
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.75, 0));
  }
}
