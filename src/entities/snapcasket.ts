import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { angleDiff } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

type State = 'dormant' | 'notice' | 'chase' | 'bite' | 'recover' | 'locked' | 'gone';

const HALF = 0.1;
const R = 0.38;
const CENTER_TO_FEET = HALF + R;
const NOTICE_RANGE = 6.5;
const GIVE_UP_RANGE = 14;
const HOP_SPEED = 3.4;
const BITE_SPEED = 7;
const BITE_RANGE = 2.2;
const LOCK_TIME = 5;

/**
 * Snapcasket: a chest that would rather eat you than hold your things. It sits
 * quiet (a pink tongue-tip and a row of teeth give it away), then hops after you
 * and snaps. Latchkin locks its lid shut for a few seconds; while it's locked,
 * Thwackwort sends it packing for good.
 */
export class Snapcasket implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 0.6;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private readonly vel = new Vector3();
  private facing: number;
  private state: State = 'dormant';
  private timer = 0;
  private grounded = false;
  private bitThisHop = false;
  private time = Math.random() * 10;
  private lidOpen = 0;
  private flyAway = 0;

  private root = new Group();
  private body = new Group();
  private lid = new Group();
  private eyes: MeshStandardMaterial;
  private clamp = new Group();
  private tongue: Mesh;

  constructor(
    private spec: SpecOf<'snapcasket'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    this.pos = new Vector3(x, y + CENTER_TO_FEET + 0.05, z);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    this.facing = spec.yaw ?? 0;
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, R).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true),
    );
    this.kcc = ctx.physics.world.createCharacterController(0.02);
    this.kcc.enableAutostep(0.3, 0.1, false);
    this.kcc.enableSnapToGround(0.3);
    this.eyes = new MeshStandardMaterial({ color: '#fff3a0', emissive: new Color('#ffd84a'), emissiveIntensity: 0.2 });
    this.tongue = new Mesh(new SphereGeometry(0.12, 8, 5), new MeshStandardMaterial({ color: '#e0607a', roughness: 0.5 }));
    this.buildModel();
    ctx.scene.add(this.root);
    this.marker = new RuneMarker(ctx.scene, 'latchkin', 0.55);
    ctx.targets.add(this);
  }

  /** Latchkin while it's snapping (or pretending to be a chest); Thwackwort once it's locked shut. */
  get spell(): 'latchkin' | 'thwackwort' {
    return this.state === 'locked' ? 'thwackwort' : 'latchkin';
  }

  private buildModel(): void {
    const wood = new MeshStandardMaterial({ color: '#6e4226', flatShading: true, roughness: 0.9 });
    const woodLight = new MeshStandardMaterial({ color: '#8a5a36', flatShading: true, roughness: 0.9 });
    const iron = new MeshStandardMaterial({ color: '#3a3340', flatShading: true, metalness: 0.4, roughness: 0.6 });
    const mouth = new MeshStandardMaterial({ color: '#5a1420', roughness: 0.8 });
    const tooth = new MeshStandardMaterial({ color: '#f3ead8', flatShading: true, roughness: 0.6 });

    const base = new Mesh(new BoxGeometry(0.9, 0.45, 0.66), wood);
    base.position.y = 0.26;
    const inside = new Mesh(new BoxGeometry(0.78, 0.04, 0.54), mouth);
    inside.position.y = 0.47;
    const bands = new Mesh(new BoxGeometry(0.94, 0.08, 0.7), iron);
    bands.position.y = 0.4;
    this.body.add(base, inside, bands);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const foot = new Mesh(new BoxGeometry(0.14, 0.08, 0.14), iron);
        foot.position.set(sx * 0.34, 0.04, sz * 0.24);
        this.body.add(foot);
      }
    }
    // Lower teeth along the front rim: the giveaway.
    for (let i = 0; i < 7; i++) {
      const t = new Mesh(new ConeGeometry(0.035, 0.1, 4), tooth);
      t.position.set(-0.33 + i * 0.11, 0.53, 0.3);
      this.body.add(t);
    }
    mergeChildren(this.body);

    // Lid hinged at the back, with upper teeth and eyes glowing underneath.
    this.lid.position.set(0, 0.49, -0.33);
    const lidMesh = new Mesh(new CylinderGeometry(0.33, 0.33, 0.9, 8, 1, false, 0, Math.PI), woodLight);
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.position.z = 0.33;
    lidMesh.castShadow = true;
    const lidBand = new Mesh(new TorusGeometry(0.335, 0.03, 4, 10, Math.PI), iron);
    lidBand.rotation.y = Math.PI / 2;
    lidBand.position.z = 0.33;
    this.lid.add(lidMesh, lidBand);
    for (let i = 0; i < 6; i++) {
      const t = new Mesh(new ConeGeometry(0.035, 0.1, 4), tooth);
      t.rotation.x = Math.PI;
      t.position.set(-0.28 + i * 0.11, -0.03, 0.62);
      this.lid.add(t);
    }
    for (const side of [-1, 1]) {
      const e = new Mesh(new SphereGeometry(0.06, 8, 5), this.eyes);
      e.position.set(side * 0.16, -0.06, 0.5);
      this.lid.add(e);
    }
    mergeChildren(this.lid);
    this.body.add(this.lid);

    this.tongue.scale.set(1, 0.35, 1.3);
    this.tongue.position.set(0.12, 0.47, 0.32);
    this.body.add(this.tongue);

    // Shown while locked: a glowing padlock and iron straps across the lid.
    const glow = new MeshStandardMaterial({ color: '#ffd45e', emissive: new Color('#ffb020'), emissiveIntensity: 1.4, metalness: 0.5 });
    const lock = new Mesh(new BoxGeometry(0.2, 0.18, 0.06), glow);
    lock.position.set(0, 0.42, 0.37);
    const shackle = new Mesh(new TorusGeometry(0.07, 0.02, 4, 10, Math.PI), glow);
    shackle.position.set(0, 0.5, 0.37);
    this.clamp.add(lock, shackle);
    for (const side of [-1, 1]) {
      const strap = new Mesh(new BoxGeometry(0.06, 0.06, 0.72), glow);
      strap.position.set(side * 0.3, 0.83, 0);
      this.clamp.add(strap);
    }
    mergeChildren(this.clamp);
    this.clamp.visible = false;
    this.body.add(this.clamp);
    this.root.add(this.body);
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
    if (this.state === 'locked' && hit.spell === 'thwackwort') {
      this.banish(hit);
      return;
    }
    if (hit.spell !== 'latchkin') return;
    if (this.state === 'dormant') {
      // "Unlocking" a sleeping one just wakes it up. Look for the teeth!
      this.wake();
      return;
    }
    this.state = 'locked';
    this.timer = LOCK_TIME;
    this.vel.set(hit.dir.x * 2, 2.5, hit.dir.z * 2);
    this.grounded = false;
    this.ctx.events.emit('snapLocked', { pos: this.pos.clone() });
  }

  private wake(): void {
    this.state = 'notice';
    this.timer = 0.6;
    this.vel.y = 4;
    this.grounded = false;
    this.ctx.events.emit('snapNotice', { pos: this.pos.clone() });
  }

  private banish(hit: SpellHit): void {
    this.state = 'gone';
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    this.vel.set(hit.dir.x * 9, 6, hit.dir.z * 9);
    this.flyAway = 0.001;
    const at = this.pos.clone();
    this.ctx.fx.burst(at, 30, new Color('#ffd45e'), 3.5, 0.16, 1.8);
    this.ctx.sweets.burst('fizzwort', at, 4);
    this.ctx.sweets.burst('bramble', at, 1);
    this.ctx.state.flags.add(`down:${this.spec.id}`);
    this.ctx.signals.set(this.spec.id, true);
    this.ctx.events.emit('snapBanished', { pos: at });
  }

  // ---------------------------------------------------------------- AI

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    this.time += dt;
    if (this.state === 'gone') {
      if (this.flyAway > 0 && this.flyAway < 1.2) {
        this.flyAway += dt;
        this.vel.y -= 20 * dt;
        this.pos.addScaledVector(this.vel, dt);
      }
      return;
    }
    this.timer -= dt;

    const player = this.ctx.player;
    const toPlayer = new Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length();
    const dy = Math.abs(player.pos.y - this.pos.y);
    const available = player.mode !== 'reset' && !this.ctx.health.fainting;
    const facePlayer = Math.atan2(toPlayer.x, toPlayer.z);
    let wishYaw = this.facing;

    switch (this.state) {
      case 'dormant':
        if (available && dist < NOTICE_RANGE * 0.6 && dy < 2) this.wake();
        break;
      case 'notice':
        wishYaw = facePlayer;
        if (this.timer <= 0 && this.grounded) this.state = 'chase';
        break;
      case 'chase': {
        wishYaw = facePlayer;
        const fromHome = this.pos.distanceTo(this.home);
        if (!available || dist > GIVE_UP_RANGE || fromHome > (this.spec.wander ?? 4) + 10) {
          // Lost interest: hop home and go back to pretending.
          wishYaw = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
          if (fromHome < 0.6) this.state = 'dormant';
        }
        if (this.grounded && this.timer <= 0) {
          const biting = dist < BITE_RANGE && dy < 1.5 && available;
          const speed = biting ? BITE_SPEED : HOP_SPEED;
          const yaw = biting ? facePlayer : wishYaw;
          this.vel.set(Math.sin(yaw) * speed, biting ? 4.2 : 5, Math.cos(yaw) * speed);
          this.grounded = false;
          this.timer = biting ? 0.9 : 0.55;
          if (biting) {
            this.state = 'bite';
            this.bitThisHop = false;
          }
        }
        break;
      }
      case 'bite':
        if (!this.bitThisHop && dist < 0.95 && dy < 1.3 && available) {
          this.bitThisHop = this.ctx.health.damage(1, this.pos.clone());
          if (this.bitThisHop) this.ctx.events.emit('snapBite', { pos: this.pos.clone() });
        }
        if (this.grounded && this.timer <= 0) {
          this.state = 'recover';
          this.timer = 0.7;
        }
        break;
      case 'recover':
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'locked':
        if (this.timer <= 0) {
          this.state = 'chase';
          this.timer = 0.4;
          this.ctx.events.emit('relock', { pos: this.pos.clone() });
        }
        break;
    }

    if (this.state !== 'locked' && this.state !== 'dormant') {
      this.facing += MathUtils.clamp(angleDiff(this.facing, wishYaw), -8 * dt, 8 * dt);
    }
    if (this.grounded) {
      this.vel.x = MathUtils.damp(this.vel.x, 0, 12, dt);
      this.vel.z = MathUtils.damp(this.vel.z, 0, 12, dt);
    }
    this.vel.y = this.grounded && this.vel.y <= 0 ? -1 : this.vel.y - 20 * dt;

    const desired = this.vel.clone().multiplyScalar(dt);
    const playerHandle = player.collider.handle;
    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== playerHandle);
    const mv = this.kcc.computedMovement();
    this.pos.add(new Vector3(mv.x, mv.y, mv.z));
    const was = this.grounded;
    this.grounded = this.kcc.computedGrounded() && this.vel.y <= 0.5;
    if (this.grounded && !was) {
      this.vel.y = 0;
      if (this.state !== 'dormant') this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, -CENTER_TO_FEET, 0)), 5, new Color('#c8b8a0'), 1, 0.08, 0.5);
    }
    this.collider.setTranslation(this.pos);

    if (this.pos.y < -10 || this.waterBelow()) {
      this.pos.copy(this.home);
      this.prev.copy(this.home);
      this.vel.set(0, 0, 0);
      this.state = 'dormant';
      this.collider.setTranslation(this.pos);
    }
  }

  private waterBelow(): boolean {
    const s = this.ctx.player.environment.waterSurfaceAt(this.pos);
    return s !== null && this.pos.y < s;
  }

  // ---------------------------------------------------------------- visuals

  frameUpdate(dt: number, alpha: number): void {
    const p = new Vector3().lerpVectors(this.prev, this.pos, alpha);
    this.root.position.set(p.x, p.y - CENTER_TO_FEET, p.z);
    this.root.rotation.y = this.facing;
    this.marker.sprite.position.set(p.x, p.y + 1.0, p.z);
    this.marker.setSpell(this.spell);
    if (this.state === 'gone') {
      this.root.rotation.x += dt * 9;
      this.root.scale.setScalar(Math.max(0.01, 1 - this.flyAway / 1.2));
      if (this.flyAway >= 1.2) this.root.visible = false;
      return;
    }
    const t = this.time;
    const locked = this.state === 'locked';
    const active = this.state !== 'dormant' && !locked;
    // Lid: shut when dormant or locked, chattering while chasing, gaping on a bite.
    // Dormant ones sit a crack open, breathing, so the teeth show if you look.
    const target = locked ? 0 : this.state === 'dormant' ? 0.14 + Math.sin(t * 1.3) * 0.04 : this.state === 'bite' ? (this.grounded ? 0.1 : 1) : 0.35 + Math.abs(Math.sin(t * 9)) * 0.35;
    this.lidOpen = MathUtils.damp(this.lidOpen, target, this.state === 'bite' ? 25 : 14, dt);
    this.lid.rotation.x = -this.lidOpen * 1.1;
    this.eyes.emissiveIntensity = active ? 1.4 : this.state === 'dormant' ? 0.15 + Math.max(0, Math.sin(t * 0.7)) * 0.2 : 0.4;
    this.eyes.emissive.set(this.state === 'bite' ? '#ff3a1a' : '#ffd84a');
    // The tongue-tip lolls out while it pretends to be a chest; tucked away otherwise.
    this.tongue.visible = this.state === 'dormant' || active;
    this.tongue.position.y = this.state === 'dormant' ? 0.47 + Math.sin(t * 1.3) * 0.01 : 0.5;
    this.clamp.visible = locked;
    // Squash on landing, stretch in the air; rattle while locked.
    const sy = this.grounded ? 1 : MathUtils.clamp(1 + this.vel.y * 0.03, 0.85, 1.15);
    const cur = MathUtils.damp(this.body.scale.y, sy, 14, dt);
    this.body.scale.set(1 / Math.sqrt(cur), cur, 1 / Math.sqrt(cur));
    this.body.rotation.z = locked ? Math.sin(t * 40) * 0.08 * Math.min(1, this.timer) : 0;
  }
}
