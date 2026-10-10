import RAPIER from '@dimforge/rapier3d-compat';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { angleDiff } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';
import { mergeChildren } from '../world/merge';

type State = 'wander' | 'notice' | 'chase' | 'windup' | 'lunge' | 'recover' | 'stunned' | 'gone';

const HALF = 0.18;
const R = 0.3;
const CENTER_TO_FEET = HALF + R;
const NOTICE_RANGE = 7.5;
const GIVE_UP_RANGE = 13;
const CHASE_SPEED = 3.3;
const WANDER_SPEED = 1.1;
const LUNGE_SPEED = 8.5;
const ATTACK_RANGE = 2.1;

/**
 * Gnarling: a mischievous root-goblin from the castle gardens. It notices you,
 * scurries over, crouches (the tell) and lunges. Thwackwort knocks it head over
 * heels and dazes it; a second hit while it's dazed banishes it in a puff of sweets.
 */
export class Gnarling implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.55;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private readonly pos: Vector3;
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

  // visuals
  private root = new Group();
  private body = new Group();
  private eyes: MeshStandardMaterial;
  private stars = new Group();
  private legs: Mesh[] = [];

  constructor(
    private spec: SpecOf<'gnarling'>,
    private ctx: WorldContext,
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
  }

  private buildModel(): void {
    const bark = new MeshStandardMaterial({ color: '#6b4a2e', flatShading: true, roughness: 0.95 });
    const barkDark = new MeshStandardMaterial({ color: '#4a3220', flatShading: true, roughness: 0.95 });
    const leaf = new MeshStandardMaterial({ color: '#6e9a3e', flatShading: true, roughness: 0.9 });
    const mouthMat = new MeshStandardMaterial({ color: '#1b0f08' });

    const torso = new Mesh(new IcosahedronGeometry(0.34, 0), bark);
    torso.scale.set(1, 1.15, 0.95);
    torso.position.y = 0.42;
    torso.castShadow = true;
    this.body.add(torso);
    // Knobbly bits.
    for (const [px, py, pz, s] of [
      [0.22, 0.55, 0.12, 0.09],
      [-0.25, 0.35, -0.05, 0.08],
      [0.05, 0.2, -0.26, 0.1],
    ]) {
      const k = new Mesh(new OctahedronGeometry(s, 0), barkDark);
      k.position.set(px, py, pz);
      this.body.add(k);
    }
    // Leaf tuft.
    for (let i = 0; i < 4; i++) {
      const l = new Mesh(new ConeGeometry(0.08, 0.36, 4), leaf);
      const a = (i / 4) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.08, 0.86, Math.sin(a) * 0.08);
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      l.castShadow = true;
      this.body.add(l);
    }
    // Eyes and a grumpy mouth.
    const eyeGeo = new SphereGeometry(0.06, 6, 4);
    for (const side of [-1, 1]) {
      const e = new Mesh(eyeGeo, this.eyes);
      e.position.set(side * 0.12, 0.52, 0.28);
      this.body.add(e);
    }
    const mouth = new Mesh(new CylinderGeometry(0.1, 0.1, 0.03, 6, 1, false, 0, Math.PI), mouthMat);
    mouth.rotation.set(Math.PI / 2, 0, Math.PI);
    mouth.position.set(0, 0.36, 0.3);
    this.body.add(mouth);
    // Twig arms and stubby legs.
    for (const side of [-1, 1]) {
      const arm = new Mesh(new CylinderGeometry(0.03, 0.04, 0.34, 4), barkDark);
      arm.position.set(side * 0.34, 0.42, 0.04);
      arm.rotation.z = side * 0.9;
      this.body.add(arm);
      const leg = new Mesh(new CylinderGeometry(0.06, 0.05, 0.2, 5), barkDark);
      leg.position.set(side * 0.13, 0.1, 0);
      this.legs.push(leg);
      this.body.add(leg);
    }
    mergeChildren(this.body, this.legs);
    this.root.add(this.body);

    // Dizzy stars, shown while stunned.
    const starMat = new MeshStandardMaterial({ color: '#ffe58a', emissive: new Color('#ffd84a'), emissiveIntensity: 1 });
    for (let i = 0; i < 3; i++) {
      const s = new Mesh(new OctahedronGeometry(0.07, 0), starMat);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      this.stars.add(s);
    }
    this.stars.position.y = 1.05;
    this.stars.visible = false;
    this.root.add(this.stars);
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
    const push = 6 + hit.charge * 6;
    this.vel.set(hit.dir.x * push, 5 + hit.charge * 2, hit.dir.z * push);
    this.grounded = false;
    this.state = 'stunned';
    this.timer = 3.5 + hit.charge * 2;
    this.spinVis = 0;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private banish(): void {
    this.state = 'gone';
    this.ctx.targets.remove(this);
    this.root.visible = false;
    this.ctx.physics.world.removeCollider(this.collider, false);
    const at = this.pos.clone();
    this.ctx.fx.burst(at, 24, new Color('#c9e88a'), 3.5, 0.18, 2);
    this.ctx.sweets.burst('fizzwort', at, 3);
    if (Math.random() < 0.35) this.ctx.sweets.burst('bramble', at, 1);
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

    const crouch = this.state === 'windup' ? 0.72 : this.state === 'notice' ? 1.15 : 1;
    const sy = MathUtils.damp(this.body.scale.y, crouch, 18, dt);
    this.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    if (this.state === 'windup') this.body.rotation.z = Math.sin(t * 60) * 0.06;

    const angry = this.state === 'windup' || this.state === 'lunge';
    this.eyes.emissive.set(angry ? '#ff3a1a' : '#ffd84a');
    this.eyes.color.set(angry ? '#ff8a6a' : '#fff3a0');

    const stunned = this.state === 'stunned';
    this.stars.visible = stunned;
    if (stunned) {
      this.stars.rotation.y += dt * 6;
      this.spinVis = Math.min(1, this.spinVis + dt * 2);
      this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.grounded ? -1.2 : this.body.rotation.x + dt * 14, 8, dt);
    } else {
      this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.state === 'lunge' ? 0.5 : 0, 10, dt);
    }
  }
}
