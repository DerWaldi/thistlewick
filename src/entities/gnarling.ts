import RAPIER from '@dimforge/rapier3d-compat';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  OctahedronGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  BoxGeometry,
  type BufferGeometry,
  Vector3,
} from 'three';
import { POINTS } from '../data/houses';
import { angleDiff } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import { DizzyStars, HitFlash } from './creatureFx';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Creature } from './creatures';
import type { Entity, SpecOf, WorldContext } from './types';
import { mergeChildren } from '../world/merge';

type State = 'wander' | 'notice' | 'chase' | 'windup' | 'lunge' | 'recover' | 'stunned' | 'gone';

const HALF = 0.18;
const R = 0.3;
const CENTER_TO_FEET = HALF + R;
// Tuned up for grown-ups: they spot you sooner, close the distance faster and lunge harder.
const NOTICE_RANGE = 9;
const GIVE_UP_RANGE = 15;
const CHASE_SPEED = 4.3;
const WANDER_SPEED = 1.3;
const LUNGE_SPEED = 10;
const ATTACK_RANGE = 2.4;
/** Gnarlings won't come closer than this to a lit fire, so standing by one keeps you safe. */
const FEAR_RANGE = 3.6;

/**
 * Gnarling: a mischievous root-goblin from the castle gardens. It notices you,
 * scurries over, crouches (the tell) and lunges. Thwackwort knocks it head over
 * heels and dazes it; a second hit while it's dazed banishes it in a puff of sweets.
 */
export class Gnarling implements Entity, SpellTarget, Creature {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.55;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private readonly vel = new Vector3();
  private facing = Math.random() * Math.PI * 2;
  private state: State = 'wander';
  private timer = 0;
  private wanderTarget: Vector3 | null = null;
  private grounded = false;
  private hitThisLunge = false;
  private spinVis = 0;
  private time = Math.random() * 10;
  private scared = false;

  // visuals
  private root = new Group();
  private body = new Group();
  private eyes: MeshStandardMaterial;
  private stars = new DizzyStars(1.35);
  private flash!: HitFlash;
  private legs: Group[] = [];
  private arms: Group[] = [];

  constructor(
    private spec: SpecOf<'gnarling'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    const [x, y, z] = spec.pos;
    this.pos = new Vector3(x, y + CENTER_TO_FEET + 0.05, z);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, R).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true),
    );
    this.kcc = ctx.physics.world.createCharacterController(0.02);
    this.kcc.enableAutostep(0.3, 0.1, false);
    this.kcc.enableSnapToGround(0.3);
    this.kcc.setMaxSlopeClimbAngle((46 * Math.PI) / 180);
    this.eyes = new MeshStandardMaterial({ color: '#fff3a0', emissive: new Color('#ffd84a'), emissiveIntensity: 1.2 });
    this.buildModel();
    ctx.scene.add(this.root);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
    ctx.targets.add(this);
    ctx.creatures.add(this);
  }

  /** Bitten by a Snapweed: that's the end of it. */
  bitten(): void {
    if (this.state !== 'gone') this.banish();
  }

  /**
   * A root creature: a faceted bark body under a big spiky crown of leaves, glowing eyes
   * under a scowling brow, long root arms ending in three claws, and root legs that splay into
   * toes. Arms and legs are their own groups so they can swing.
   */
  private buildModel(): void {
    const bark = new MeshStandardMaterial({ color: '#6b4a2e', flatShading: true, roughness: 0.95 });
    const barkDark = new MeshStandardMaterial({ color: '#4a3220', flatShading: true, roughness: 0.95 });
    const leaf = new MeshStandardMaterial({ color: '#6aa83a', flatShading: true, roughness: 0.9 });
    const leafDark = new MeshStandardMaterial({ color: '#3f7a2a', flatShading: true, roughness: 0.9 });
    const add = (parent: Group, geo: BufferGeometry, mat: MeshStandardMaterial, p: [number, number, number], r: [number, number, number] = [0, 0, 0], sc?: [number, number, number]) => {
      const m = new Mesh(geo, mat);
      m.position.set(...p);
      m.rotation.set(...r);
      if (sc) m.scale.set(...sc);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // The body: a faceted lump of bark, wider at the shoulders, with ridges down it.
    add(this.body, new IcosahedronGeometry(0.3, 1), bark, [0, 0.58, 0], [0, 0.3, 0], [1, 1.2, 0.88]);
    for (const [a, y, len] of [
      [0.5, 0.52, 0.34],
      [-0.6, 0.6, 0.3],
      [2.4, 0.55, 0.36],
      [-2.2, 0.5, 0.3],
      [3.1, 0.62, 0.28],
    ]) {
      add(this.body, new OctahedronGeometry(0.06, 0), barkDark, [Math.sin(a) * 0.27, y, Math.cos(a) * 0.24], [0, a, 0], [0.7, len / 0.12, 0.7]);
    }
    // A scowling brow over deep-set eyes, and a small jagged mouth.
    add(this.body, new BoxGeometry(0.3, 0.06, 0.08), barkDark, [0, 0.74, 0.24], [0.2, 0, 0]);
    const eyeGeo = new SphereGeometry(0.055, 6, 4);
    for (const side of [-1, 1]) {
      const e = add(this.body, eyeGeo, this.eyes, [side * 0.1, 0.67, 0.25], [0, 0, side * 0.35], [1.25, 0.85, 0.7]);
      e.castShadow = false;
    }
    // The crown: a ring of long leaf spikes around a tall centre one, leaning out.
    add(this.body, new ConeGeometry(0.07, 0.5, 4), leaf, [0, 1.08, -0.02]);
    // Two rings: long spikes splaying wide from the top, a shorter mane lower round the head.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const len = 0.32 + ((i * 5) % 3) * 0.09;
      const lean = 0.6 + ((i * 3) % 3) * 0.18;
      add(this.body, new ConeGeometry(0.06, len, 4), i % 2 ? leafDark : leaf, [Math.cos(a) * 0.15, 0.9 + len * 0.32, Math.sin(a) * 0.13], [Math.sin(a) * lean, 0, -Math.cos(a) * lean]);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      if (Math.cos(a) > 0.75) continue; // leave the face clear
      add(this.body, new ConeGeometry(0.05, 0.24, 4), i % 2 ? leaf : leafDark, [Math.sin(a) * 0.24, 0.84, Math.cos(a) * 0.2], [Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1]);
    }
    // A couple of sprouts on the shoulders.
    for (const side of [-1, 1]) add(this.body, new ConeGeometry(0.035, 0.16, 4), leafDark, [side * 0.24, 0.8, -0.05], [0, 0, -side * 0.8]);

    // Long root arms, hanging, each with three claws.
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.27, 0.72, 0.02);
      arm.rotation.z = side * 0.25;
      add(arm, new CylinderGeometry(0.035, 0.05, 0.3, 5), barkDark, [0, -0.15, 0], [0, 0, side * 0.2]);
      add(arm, new CylinderGeometry(0.03, 0.035, 0.26, 5), bark, [side * 0.04, -0.4, 0.02], [0.15, 0, -side * 0.1]);
      for (let c = 0; c < 3; c++) {
        add(arm, new ConeGeometry(0.022, 0.15, 4), barkDark, [side * 0.03 + (c - 1) * 0.035, -0.58, 0.04 + (c === 1 ? 0.02 : 0)], [Math.PI + 0.15, 0, (c - 1) * 0.35]);
      }
      mergeChildren(arm);
      this.arms.push(arm);
      this.body.add(arm);
    }
    // Root legs that splay into toes on the ground.
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.13, 0, 0);
      add(leg, new CylinderGeometry(0.06, 0.045, 0.34, 5), barkDark, [0, 0.2, 0]);
      for (let c = 0; c < 3; c++) {
        const a = (c - 1) * 0.6 + (side > 0 ? 0.2 : -0.2);
        add(leg, new ConeGeometry(0.035, 0.22, 4), barkDark, [Math.sin(a) * 0.08, 0.03, 0.04 + Math.cos(a) * 0.08], [Math.PI / 2 - 0.15, 0, -a]);
      }
      mergeChildren(leg);
      this.legs.push(leg);
      this.body.add(leg);
    }
    mergeChildren(this.body, [...this.legs, ...this.arms]);
    this.root.add(this.body);

    this.root.add(this.stars);
    this.flash = new HitFlash(this.root);
  }

  // ---------------------------------------------------------------- SpellTarget

  aimPoint(out: Vector3): Vector3 {
    return out.set(this.pos.x, this.pos.y + 0.05, this.pos.z);
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state === 'stunned') {
      this.banish();
      return;
    }
    // Catching one mid-hop (or mid-lunge) is worth a little extra.
    if (!this.grounded) this.ctx.state.award(POINTS.stunMidAir, 'a mid-air stun');
    const push = 6 + hit.charge * 6;
    this.vel.set(hit.dir.x * push, 5 + hit.charge * 2, hit.dir.z * push);
    this.grounded = false;
    this.state = 'stunned';
    this.timer = 3.5 + hit.charge * 2;
    this.spinVis = 0;
    this.flash.flash();
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private banish(): void {
    this.state = 'gone';
    this.ctx.targets.remove(this);
    this.ctx.creatures.delete(this);
    // Thwacked to bits: the root-goblin falls apart into twigs.
    this.stars.visible = false;
    this.ctx.debris.crumble(this.root, { from: this.pos.clone(), speed: 2.5, up: 4, life: 1.2 });
    this.root.visible = false;
    this.ctx.physics.world.removeCollider(this.collider, false);
    const at = this.pos.clone();
    this.ctx.fx.burst(at, 24, new Color('#c9e88a'), 3.5, 0.18, 2);
    // Gnarlings come back on every visit, but each only pays out once, so they can't be farmed.
    const looted = `looted:${this.id}`;
    if (!this.ctx.state.flags.has(looted)) {
      this.ctx.state.flags.add(looted);
      this.ctx.sweets.burst('fizzwort', at, 3);
      if (Math.random() < 0.35) this.ctx.sweets.burst('bramble', at, 1);
    }
    this.ctx.events.emit('gnarlingBanished', { pos: at });
  }

  // ---------------------------------------------------------------- AI

  fixedUpdate(dt: number): void {
    if (this.state === 'gone') return;
    this.prev.copy(this.pos);
    this.time += dt;
    this.timer -= dt;

    const player = this.ctx.player;
    const toPlayer = new Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length();
    const dy = Math.abs(player.pos.y - this.pos.y);
    const playerAvailable = player.mode !== 'reset' && !this.ctx.health.fainting;
    const facePlayer = Math.atan2(toPlayer.x, toPlayer.z);
    let wish = 0;
    let wishYaw = this.facing;

    switch (this.state) {
      case 'wander': {
        if (playerAvailable && dist < NOTICE_RANGE && dy < 2.5) {
          this.state = 'notice';
          this.timer = 0.5;
          this.vel.y = 3.5; // a startled hop
          this.grounded = false;
          this.ctx.events.emit('gnarlingNotice', { pos: this.pos.clone() });
          break;
        }
        if (!this.wanderTarget || this.timer <= 0) {
          const r = (this.spec.wander ?? 3) * Math.sqrt(Math.random());
          const a = Math.random() * Math.PI * 2;
          this.wanderTarget = this.home.clone().add(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
          this.timer = 2 + Math.random() * 2.5;
        }
        const to = new Vector3(this.wanderTarget.x - this.pos.x, 0, this.wanderTarget.z - this.pos.z);
        if (to.length() > 0.4) {
          wish = WANDER_SPEED;
          wishYaw = Math.atan2(to.x, to.z);
        }
        break;
      }
      case 'notice':
        wishYaw = facePlayer;
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'chase': {
        const fromHome = new Vector3(this.pos.x - this.home.x, 0, this.pos.z - this.home.z).length();
        if (!playerAvailable || dist > GIVE_UP_RANGE || fromHome > (this.spec.wander ?? 3) + 10) {
          this.state = 'wander';
          this.wanderTarget = this.home.clone();
          this.timer = 4;
          break;
        }
        wishYaw = facePlayer;
        if (dist < ATTACK_RANGE && dy < 1.5) {
          this.state = 'windup';
          this.timer = 0.5;
        } else {
          wish = CHASE_SPEED;
        }
        break;
      }
      case 'windup':
        wishYaw = facePlayer;
        if (this.timer <= 0) {
          this.state = 'lunge';
          this.timer = 0.3;
          this.hitThisLunge = false;
          this.vel.x = Math.sin(this.facing) * LUNGE_SPEED;
          this.vel.z = Math.cos(this.facing) * LUNGE_SPEED;
          this.vel.y = 2.5;
          this.grounded = false;
        }
        break;
      case 'lunge':
        if (!this.hitThisLunge && dist < 0.95 && dy < 1.3 && playerAvailable) {
          this.hitThisLunge = this.ctx.health.damage(1, this.pos.clone());
        }
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 0.9;
        }
        break;
      case 'recover':
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'stunned':
        if (this.timer <= 0) {
          this.state = 'chase';
        }
        break;
    }

    // Fire: back away from it, whatever else they had in mind.
    const fire = this.state === 'stunned' || this.state === 'lunge' ? null : this.ctx.heat.near(this.pos, FEAR_RANGE);
    if (fire) {
      if (!this.scared) this.ctx.events.emit('gnarlingScared', { pos: this.pos.clone() });
      wishYaw = Math.atan2(this.pos.x - fire.pos.x, this.pos.z - fire.pos.z);
      wish = CHASE_SPEED;
      if (this.state === 'windup') this.state = 'chase';
    }
    this.scared = !!fire;

    // Turn & move.
    if (this.state !== 'stunned' && this.state !== 'lunge') {
      this.facing += MathUtils.clamp(angleDiff(this.facing, wishYaw), -10 * dt, 10 * dt);
    }
    if (this.grounded && this.state !== 'lunge' && this.state !== 'stunned') {
      const tx = Math.sin(wishYaw) * wish;
      const tz = Math.cos(wishYaw) * wish;
      this.vel.x = MathUtils.damp(this.vel.x, tx, 10, dt);
      this.vel.z = MathUtils.damp(this.vel.z, tz, 10, dt);
    } else if (this.grounded) {
      this.vel.x = MathUtils.damp(this.vel.x, 0, this.state === 'stunned' ? 4 : 1.5, dt);
      this.vel.z = MathUtils.damp(this.vel.z, 0, this.state === 'stunned' ? 4 : 1.5, dt);
    }
    this.vel.y = this.grounded && this.vel.y <= 0 ? -1 : this.vel.y - 22 * dt;

    const desired = this.vel.clone().multiplyScalar(dt);
    const playerHandle = player.collider.handle;
    this.kcc.computeColliderMovement(
      this.collider,
      desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (c) => c.handle !== playerHandle,
    );
    const mv = this.kcc.computedMovement();
    this.pos.add(new Vector3(mv.x, mv.y, mv.z));
    const wasGrounded = this.grounded;
    this.grounded = this.kcc.computedGrounded() && this.vel.y <= 0.5;
    if (this.grounded && !wasGrounded) this.vel.y = 0;
    this.collider.setTranslation(this.pos);

    // Fell somewhere silly: pop back home.
    if (this.pos.y < -10 || this.waterBelow()) {
      this.pos.copy(this.home);
      this.prev.copy(this.home);
      this.vel.set(0, 0, 0);
      this.state = 'wander';
      this.collider.setTranslation(this.pos);
    }
  }

  private waterBelow(): boolean {
    const env = this.ctx.player.environment;
    const s = env.waterSurfaceAt(this.pos);
    return s !== null && this.pos.y < s;
  }

  // ---------------------------------------------------------------- visuals

  frameUpdate(dt: number, alpha: number): void {
    if (this.state === 'gone') return;
    const p = new Vector3().lerpVectors(this.prev, this.pos, alpha);
    this.root.position.set(p.x, p.y - CENTER_TO_FEET, p.z);
    this.root.rotation.y = this.facing;
    this.marker.sprite.position.set(p.x, p.y + 1.0, p.z);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const t = this.time;
    const moving = speed > 0.3 && this.grounded;
    // Hop-waddle while moving.
    this.body.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
    this.body.rotation.z = moving ? Math.sin(t * 14) * 0.12 : 0;
    this.legs[0].position.z = moving ? Math.sin(t * 14) * 0.08 : 0;
    this.legs[1].position.z = moving ? -Math.sin(t * 14) * 0.08 : 0;
    // Arms: swing with the waddle, rise claws-up in the wind-up, reach forward in the lunge.
    const armX = this.state === 'windup' ? -2.4 : this.state === 'lunge' ? -1.5 : moving ? Math.sin(t * 14) * 0.5 : Math.sin(t * 1.6) * 0.08;
    this.arms[0].rotation.x = MathUtils.damp(this.arms[0].rotation.x, armX, 14, dt);
    this.arms[1].rotation.x = MathUtils.damp(this.arms[1].rotation.x, this.state === 'windup' || this.state === 'lunge' ? armX : moving ? -armX : armX, 14, dt);

    const crouch = this.state === 'windup' ? 0.72 : this.state === 'notice' ? 1.15 : 1;
    const sy = MathUtils.damp(this.body.scale.y, crouch, 18, dt);
    this.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    if (this.state === 'windup') this.body.rotation.z = Math.sin(t * 60) * 0.06;

    const angry = this.state === 'windup' || this.state === 'lunge';
    this.eyes.emissive.set(angry ? '#ff3a1a' : '#ffd84a');
    this.eyes.color.set(angry ? '#ff8a6a' : '#fff3a0');

    const stunned = this.state === 'stunned';
    this.flash.update(dt);
    this.stars.update(dt, stunned, t);
    if (stunned) {
      this.spinVis = Math.min(1, this.spinVis + dt * 2);
      this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.grounded ? -1.2 : this.body.rotation.x + dt * 14, 8, dt);
    } else {
      this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.state === 'lunge' ? 0.5 : 0, 10, dt);
    }
  }
}
