import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

/** A vertex-coloured mesh in a shared material, so a creature's parts merge into few draw calls. */
function part(geo: THREE_Geo, color: string, mat: MeshStandardMaterial): Mesh {
  const g = geo.index ? geo.toNonIndexed() : geo;
  return new Mesh(paint(g, color, true), mat);
}
type THREE_Geo = BoxGeometry | ConeGeometry | CylinderGeometry | IcosahedronGeometry | SphereGeometry;

/** Something that a Snapweed's bite (or an exploding thing) can hurt besides the player. */
export interface Creature {
  readonly pos: Vector3;
  /** Bitten by something at `from`: the creature reacts (Gnarlings are banished). */
  bitten(from: Vector3): void;
}

const FLAME = new Color('#ff8a3c');
const FROST = new Color('#e8f8ff');
const flatMat = (color: string, emissive?: string, intensity = 0) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, emissive: new Color(emissive ?? '#000000'), emissiveIntensity: intensity });

/** Pays out sweets the first time a placed creature is beaten (never again: nothing is farmable). */
function loot(ctx: WorldContext, id: string, at: Vector3, fizz = 3): void {
  const flag = `looted:${id}`;
  if (ctx.state.flags.has(flag)) return;
  ctx.state.flags.add(flag);
  ctx.sweets.burst('fizzwort', at, fizz);
  ctx.sweets.burst('bramble', at, 1);
}

type WeedState = 'idle' | 'windup' | 'snap' | 'rest' | 'burning' | 'gone';

/**
 * Snapweed: a rooted, biting plant. Anything that comes within `radius` (you, and Gnarlings
 * too) makes it rear back, jaws wide (the tell), then snap: everything still in reach gets
 * bitten. Thwackwort just bounces off; Cindersnap burns it away for good.
 */
export class Snapweed implements Entity, SpellTarget {
  readonly spell = 'cindersnap' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly stem = new Group();
  private readonly head = new Group();
  private readonly jawTop = new Group();
  private readonly jawBottom = new Group();
  private readonly fire: Mesh;
  private readonly base: Vector3;
  private readonly headPos = new Vector3();
  private state: WeedState = 'idle';
  private timer = 0;
  private time = Math.random() * 10;
  private lean = 0;
  private faceYaw = 0;
  private readonly reach: number;

  constructor(
    private spec: SpecOf<'snapweed'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.base = new Vector3(...spec.pos);
    this.reach = spec.radius ?? 2.4;
    const mat = worldMaterial();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = part(new ConeGeometry(0.22, 0.9, 4), '#5f9a3e', mat);
      leaf.position.set(Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35);
      leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      this.root.add(leaf);
    }
    const stalk = part(new CylinderGeometry(0.1, 0.16, 1.3, 6), '#4f7a34', mat);
    stalk.position.y = 0.65;
    this.stem.add(stalk);
    // The head: two jaw halves lined with teeth, hinged at the back.
    for (const [jaw, sign] of [
      [this.jawTop, 1],
      [this.jawBottom, -1],
    ] as [Group, number][]) {
      const shell = part(new SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, sign > 0 ? 0 : Math.PI / 2, Math.PI / 2), '#8a3a5a', mat);
      shell.position.z = 0.32;
      const inner = part(new CylinderGeometry(0.38, 0.38, 0.03, 10), '#c8384a', mat);
      inner.position.set(0, 0, 0.32);
      jaw.add(shell, inner);
      for (let t = 0; t < 7; t++) {
        const a = (t / 7) * Math.PI * 2;
        const tooth = part(new ConeGeometry(0.05, 0.16, 4), '#f4ecd8', mat);
        tooth.position.set(Math.cos(a) * 0.32, -sign * 0.06, 0.32 + Math.sin(a) * 0.32);
        if (sign > 0) tooth.rotation.x = Math.PI;
        jaw.add(tooth);
      }
      mergeChildren(jaw);
      this.head.add(jaw);
    }
    this.head.position.y = 1.35;
    this.head.position.z = -0.3;
    this.stem.add(this.head);
    this.root.add(this.stem);
    this.fire = new Mesh(new ConeGeometry(0.5, 1.4, 6), new MeshStandardMaterial({ color: '#ffb347', emissive: new Color('#ff7a1a'), emissiveIntensity: 2, transparent: true, opacity: 0.85 }));
    this.fire.position.y = 0.8;
    this.fire.visible = false;
    this.root.add(this.fire);
    mergeChildren(this.stem, [this.head]);
    mergeChildren(this.root, [this.stem, this.fire]);
    this.root.position.copy(this.base);
    this.root.traverse((o) => (o.castShadow = true));
    ctx.scene.add(this.root);
    this.collider = ctx.physics.addStaticCylinder(this.base.clone().add(new Vector3(0, 0.75, 0)), 0.75, 0.35, { noGrab: true });
    this.marker = new RuneMarker(ctx.scene, 'cindersnap', 0.55);
    this.marker.sprite.position.copy(this.base).add(new Vector3(0, 2.4, 0));
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.base).add(new Vector3(0, 1.2, 0));
  }
  enabled(): boolean {
    return this.state !== 'burning' && this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (!this.enabled()) return;
    this.state = 'burning';
    this.timer = 1.2;
    this.fire.visible = true;
    this.ctx.events.emit('burn', { pos: this.base.clone().add(new Vector3(0, 1, 0)) });
  }

  private inReach(p: Vector3): boolean {
    return Math.hypot(p.x - this.base.x, p.z - this.base.z) < this.reach && p.y > this.base.y - 1 && p.y < this.base.y + 2.8;
  }

  private someoneNear(): Vector3 | null {
    const p = this.ctx.player.pos;
    if (this.inReach(p) && this.ctx.player.mode !== 'reset') return p;
    for (const c of this.ctx.creatures) if (this.inReach(c.pos)) return c.pos;
    return null;
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    switch (this.state) {
      case 'idle': {
        const who = this.someoneNear();
        if (who) {
          this.faceYaw = Math.atan2(who.x - this.base.x, who.z - this.base.z);
          this.state = 'windup';
          this.timer = 0.55;
          this.ctx.events.emit('weedNotice', { pos: this.base.clone() });
        }
        break;
      }
      case 'windup': {
        const who = this.someoneNear();
        if (who) this.faceYaw = Math.atan2(who.x - this.base.x, who.z - this.base.z);
        if (this.timer <= 0) {
          this.state = 'snap';
          this.timer = 0.18;
          this.bite();
        }
        break;
      }
      case 'snap':
        if (this.timer <= 0) {
          this.state = 'rest';
          this.timer = 0.9;
        }
        break;
      case 'rest':
        if (this.timer <= 0) this.state = 'idle';
        break;
      case 'burning':
        if (Math.random() < dt * 14) {
          const s = this.base.clone().add(new Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8));
          this.ctx.fx.burst(s, 2, Math.random() < 0.6 ? FLAME : new Color('#5a4a40'), 1.6, 0.12, 0.8);
        }
        if (this.timer <= 0) this.wither();
        break;
    }
  }

  private bite(): void {
    const head = this.base.clone().add(new Vector3(Math.sin(this.faceYaw) * 1.2, 1.2, Math.cos(this.faceYaw) * 1.2));
    this.ctx.events.emit('weedBite', { pos: head });
    if (this.inReach(this.ctx.player.pos)) this.ctx.health.damage(1, this.base.clone().add(new Vector3(0, 1, 0)));
    for (const c of [...this.ctx.creatures]) if (this.inReach(c.pos)) c.bitten(this.base);
  }

  private wither(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    const at = this.base.clone().add(new Vector3(0, 0.8, 0));
    this.ctx.fx.burst(at, 20, new Color('#5a4a40'), 2.4, 0.16, 1.4);
    if (this.spec.id) {
      this.ctx.signals.set(this.spec.id, true);
      if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    }
    loot(this.ctx, this.id, at, 2);
  }

  frameUpdate(dt: number): void {
    if (this.state === 'gone') return;
    // Face whoever it's after; sway when idle; rear back in the windup, lunge on the snap.
    const target = this.state === 'idle' || this.state === 'rest' ? Math.sin(this.time * 0.7) * 0.6 : this.faceYaw;
    this.stem.rotation.y += MathUtils.clamp(((target - this.stem.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -dt * 8, dt * 8);
    const wantLean = this.state === 'windup' ? -0.45 : this.state === 'snap' ? 0.75 : this.state === 'burning' ? 0.9 : Math.sin(this.time * 1.3) * 0.08;
    this.lean = MathUtils.damp(this.lean, wantLean, this.state === 'snap' ? 30 : 10, dt);
    this.stem.rotation.x = this.lean;
    const open = this.state === 'windup' ? 0.75 : this.state === 'snap' ? 0 : this.state === 'idle' ? 0.12 + Math.abs(Math.sin(this.time * 2)) * 0.1 : 0.15;
    this.jawTop.rotation.x = MathUtils.damp(this.jawTop.rotation.x, -open, 20, dt);
    this.jawBottom.rotation.x = MathUtils.damp(this.jawBottom.rotation.x, open * 0.6, 20, dt);
    if (this.state === 'burning') {
      const s = Math.max(0.1, this.timer / 1.2);
      this.stem.scale.set(1, s, 1);
      this.fire.scale.setScalar(0.8 + Math.sin(this.time * 30) * 0.15);
    }
    this.headPos.copy(this.base);
  }
}

type CrabState = 'walk' | 'aim' | 'stunned' | 'frozen' | 'gone';

/** One fireball in flight. */
interface Fireball {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
}

/**
 * Ember Crab: scuttles sideways along its patrol and, whenever it can see you, stops and
 * lobs a fireball. Thwackwort flips it over for a few seconds; Rimewhistle freezes it into
 * a block of ice (solid: you can stand on it) and a Thwackwort then shatters it for good.
 * Until you know Rimewhistle, Thwackwort is all you've got.
 */
export class EmberCrab implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private iceCollider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly shellMat: MeshStandardMaterial;
  private readonly ice: Mesh;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private readonly axis: Vector3;
  private readonly balls: Fireball[] = [];
  private readonly ballMat = new MeshStandardMaterial({ color: '#ffb347', emissive: new Color('#ff6a1a'), emissiveIntensity: 2.4 });
  private state: CrabState = 'walk';
  private timer = 0;
  private reload = 1.5 + Math.random();
  private along = 0;
  private dir = 1;
  private facing = 0;
  private time = Math.random() * 10;

  constructor(
    private spec: SpecOf<'emberCrab'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + 0.35, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    const yaw = spec.yaw ?? 0;
    this.axis = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.facing = yaw;
    this.shellMat = worldMaterial();
    this.shellMat.emissive = new Color('#ff5a1a');
    const glowMat = flatMat('#ffd27a', '#ff8a3c', 1.5);
    const sm = this.shellMat;
    const shell = part(new IcosahedronGeometry(0.5, 0), '#b8401e', sm);
    shell.scale.set(1.2, 0.5, 0.9);
    this.body.add(shell);
    // Glowing cracks in the shell.
    for (let i = 0; i < 4; i++) {
      const crack = new Mesh(new BoxGeometry(0.5, 0.03, 0.04), glowMat);
      crack.position.set((i - 1.5) * 0.18, 0.23, (i % 2) * 0.1 - 0.05);
      crack.rotation.y = i * 0.7;
      this.body.add(crack);
    }
    for (const side of [-1, 1]) {
      // Eyes on stalks, and two claws.
      const stalk = part(new CylinderGeometry(0.03, 0.03, 0.3, 4), '#5a2010', sm);
      stalk.position.set(side * 0.15, 0.32, 0.3);
      const eye = new Mesh(new SphereGeometry(0.07, 6, 4), glowMat);
      eye.position.set(side * 0.15, 0.48, 0.3);
      const claw = part(new IcosahedronGeometry(0.2, 0), '#c8502a', sm);
      claw.scale.set(1, 0.6, 1.4);
      claw.position.set(side * 0.55, 0.05, 0.45);
      this.body.add(stalk, eye, claw);
      for (let l = 0; l < 3; l++) {
        const leg = part(new CylinderGeometry(0.035, 0.03, 0.55, 4), '#5a2010', sm);
        leg.position.set(side * 0.55, -0.15, -0.25 + l * 0.25);
        leg.rotation.z = side * 1.1;
        this.body.add(leg);
      }
    }
    // Legs are merged too: the scuttle is a body wobble rather than per-leg animation.
    mergeChildren(this.body);
    this.root.add(this.body);
    this.ice = new Mesh(new BoxGeometry(1.6, 1, 1.4), new MeshStandardMaterial({ color: '#cfeefa', transparent: true, opacity: 0.6, roughness: 0.1, emissive: new Color('#5aaed0'), emissiveIntensity: 0.3 }));
    this.ice.position.y = 0.15;
    this.ice.visible = false;
    this.root.add(this.ice);
    this.root.traverse((o) => (o.castShadow = true));
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    // A sensor while alive (you walk into it and get pinched, like Gnarlings), a solid block of
    // ice while frozen.
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.3, 0.5).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true));
    this.iceCollider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.5, 0.7).setTranslation(this.pos.x, this.pos.y + 0.15, this.pos.z));
    // Rough, frosted ice: slippery footing on a block this small would make it a slide, not a step.
    ctx.physics.setInfo(this.iceCollider, { temporary: true, noGrab: true });
    this.iceCollider.setEnabled(false);
    this.marker = new RuneMarker(ctx.scene, this.spell, 0.55);
    ctx.targets.add(this);
  }

  /** Rimewhistle while it's live (if you know it), Thwackwort to flip it or shatter the ice. */
  get spell(): 'thwackwort' | 'rimewhistle' {
    if (this.state === 'frozen') return 'thwackwort';
    return this.ctx.state.knows('rimewhistle') && this.state !== 'stunned' ? 'rimewhistle' : 'thwackwort';
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.2, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle || c.handle === this.iceCollider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (hit.spell === 'rimewhistle') {
      this.state = 'frozen';
      this.timer = 8 * (hit.charge > 0.5 ? 1.6 : 1);
      this.ice.visible = true;
      this.iceCollider.setTranslation(new Vector3(this.pos.x, this.pos.y + 0.15, this.pos.z));
      this.iceCollider.setEnabled(true);
      this.ctx.events.emit('freeze', { pos: this.pos.clone(), charged: hit.charge > 0.5 });
      this.ctx.fx.burst(this.pos.clone(), 16, FROST, 2.4, 0.14, 1);
      return;
    }
    if (this.state === 'frozen') {
      this.shatter();
      return;
    }
    // Flipped onto its back for a moment.
    this.state = 'stunned';
    this.timer = 3 + hit.charge * 2;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private reformIn = 0;

  private shatter(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    if (this.spec.reform) {
      // A stepping stone you need: it crawls back out of the water a few seconds later.
      this.collider.setEnabled(false);
      this.iceCollider.setEnabled(false);
      this.reformIn = this.spec.reform;
    } else {
      this.ctx.physics.world.removeCollider(this.collider, false);
      this.ctx.physics.world.removeCollider(this.iceCollider, false);
    }
    this.ctx.events.emit('crabShatter', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone(), 26, FROST, 4, 0.16, 2);
    if (this.spec.id) {
      this.ctx.signals.set(this.spec.id, true);
      if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    }
    loot(this.ctx, this.id, this.pos.clone());
  }

  private canSee(target: Vector3): boolean {
    const from = this.pos.clone().add(new Vector3(0, 0.4, 0));
    const to = target.clone().sub(from);
    const dist = to.length();
    const hit = this.ctx.physics.raycast(from, to.normalize(), dist, this.collider, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
    return !hit;
  }

  private shoot(): void {
    const p = this.ctx.player.pos;
    const from = this.pos.clone().add(new Vector3(Math.sin(this.facing) * 0.5, 0.45, Math.cos(this.facing) * 0.5));
    // Lead the target a little.
    const aim = p.clone().addScaledVector(this.ctx.player.vel, 0.35).sub(from);
    const vel = aim.normalize().multiplyScalar(this.spec.speed ?? 7);
    const mesh = new Mesh(new IcosahedronGeometry(0.22, 1), this.ballMat);
    mesh.position.copy(from);
    this.ctx.scene.add(mesh);
    this.balls.push({ mesh, pos: from, vel, life: 3.5 });
    this.ctx.events.emit('crabShoot', { pos: from.clone() });
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    this.updateBalls(dt);
    if (this.state === 'gone' && this.reformIn > 0) {
      this.reformIn -= dt;
      if (this.reformIn <= 0) {
        this.state = 'walk';
        this.pos.copy(this.home);
        this.prev.copy(this.home);
        this.root.visible = true;
        this.ice.visible = false;
        this.collider.setEnabled(true);
        this.ctx.targets.add(this);
        this.ctx.fx.burst(this.pos.clone(), 14, FLAME, 2, 0.12, 0.6);
      }
    }
    const p = this.ctx.player.pos;
    const range = this.spec.range ?? 13;
    const dist = p.distanceTo(this.pos);
    switch (this.state) {
      case 'walk': {
        const len = this.spec.patrol ?? 3;
        this.along += this.dir * dt * 1.2;
        if (Math.abs(this.along) > len) {
          this.along = Math.sign(this.along) * len;
          this.dir *= -1;
        }
        this.pos.copy(this.home).addScaledVector(this.axis, this.along);
        this.reload -= dt;
        if (this.reload <= 0 && dist < range && this.ctx.player.mode !== 'reset' && this.canSee(p)) {
          this.state = 'aim';
          this.timer = 0.6;
        }
        break;
      }
      case 'aim':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          this.shoot();
          this.state = 'walk';
          this.reload = this.spec.interval ?? 2.4;
        }
        break;
      case 'stunned':
        if (this.timer <= 0) this.state = 'walk';
        break;
      case 'frozen':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.ice.visible = false;
          this.iceCollider.setEnabled(false);
          this.ctx.events.emit('thaw', { pos: this.pos.clone() });
        }
        break;
    }
    if (this.state !== 'gone') {
      this.collider.setTranslation(this.pos);
      // Walking into a live crab gets you pinched.
      if (this.state === 'walk' || this.state === 'aim') {
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.9 && Math.abs(p.y - this.pos.y) < 1.2) this.ctx.health.damage(1, this.pos.clone());
      }
    }
  }

  private updateBalls(dt: number): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life -= dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const hitWall = this.ctx.physics.raycast(b.pos, step.clone().normalize(), len, this.collider, (c) => c.handle !== this.ctx.player.collider.handle);
      b.pos.add(step);
      const p = this.ctx.player.pos;
      const hitPlayer = b.pos.distanceTo(p) < 0.7 && this.ctx.player.mode !== 'reset';
      if (hitPlayer) this.ctx.health.damage(1, b.pos.clone());
      if (hitPlayer || hitWall || b.life <= 0) {
        this.ctx.fx.burst(b.pos.clone(), 10, FLAME, 2, 0.12, 0.8);
        this.ctx.events.emit('crabHit', { pos: b.pos.clone() });
        b.mesh.removeFromParent();
        b.mesh.geometry.dispose();
        this.balls.splice(i, 1);
      }
    }
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const b of this.balls) {
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y += dt * 8;
      if (Math.random() < dt * 20) this.ctx.fx.burst(b.pos.clone(), 1, FLAME, 0.6, 0.08, 0.4);
    }
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = MathUtils.damp(this.root.rotation.y, this.facing, 8, dt);
    const walking = this.state === 'walk';
    this.body.position.y = walking ? Math.abs(Math.sin(this.time * 14)) * 0.05 : 0;
    this.body.rotation.x = walking ? Math.sin(this.time * 14) * 0.05 : 0;
    // Flipped over when stunned; still and glassy when frozen.
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, this.state === 'stunned' ? Math.PI : 0, 10, dt);
    this.shellMat.emissiveIntensity = this.state === 'frozen' ? 0 : this.state === 'aim' ? 1.4 : 0.6 + Math.sin(this.time * 3) * 0.15;
    this.shellMat.color.set(this.state === 'frozen' ? '#a8d8ec' : '#ffffff');
    this.marker.setSpell(this.spell);
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.2, 0));
  }
}
