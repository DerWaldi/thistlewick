import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { POINTS } from '../data/houses';
import { angleDiff } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';

type State = 'dormant' | 'approach' | 'windup' | 'swing' | 'brace' | 'charge' | 'recover' | 'stagger' | 'toppled' | 'rising' | 'collapsed';

const HALF = 0.55;
const R = 0.45;
const CENTER_TO_FEET = HALF + R;
const WALK_SPEED = 2.8;
/** The charge: braced, then a straight dash at you from a few metres off. */
const CHARGE_SPEED = 9;
const CHARGE_RANGE: [number, number] = [4, 13];
const REACH = 2.3;
/** Once engaged, it keeps after you this far outside its arena (knockback shouldn't end the fight). */
const LEASH = 12;
/** Provoked (hit, or its Gnarlings are gone), it hunts you much further. */
const LEASH_PROVOKED = 30;
/** A tap just clangs off; it takes a charged Thwackwort to knock one over. */
const CHARGE_TO_TOPPLE = 0.6;
const MAX_HP = 2;

/**
 * Rattlecoat: an empty suit of armour that clanks after intruders. Telegraphed (it raises
 * its sword and its visor glows), and too sturdy for a quick Thwackwort: a charged one
 * topples it. Topple it twice and it falls apart for good, setting the signal `id`.
 * It wakes when you step into its arena, when a spell hits it, or when the last Gnarling in
 * its arena is gone; from a distance it braces and charges at you.
 */
export class Rattlecoat implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private facing: number;
  private state: State = 'dormant';
  private timer = 0;
  private hp = MAX_HP;
  private hitThisSwing = false;
  private toppleDir = new Vector3();
  private hintShown = false;
  private t = 0;
  private vy = 0;
  private provoked = false;
  private hadGnarlings = false;
  private chargeIn = 1.5;
  private chargeDir = new Vector3();

  private root = new Group();
  private body = new Group();
  private armR = new Group();
  private armL = new Group();
  private legL = new Group();
  private legR = new Group();
  private visor: MeshStandardMaterial;
  private pieces: { mesh: Mesh; vel: Vector3; spin: Vector3 }[] = [];

  constructor(
    private spec: SpecOf<'rattlecoat'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + CENTER_TO_FEET, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    this.facing = spec.yaw;
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, R).setTranslation(this.pos.x, this.pos.y, this.pos.z),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true });
    this.kcc = ctx.physics.world.createCharacterController(0.02);
    this.kcc.enableSnapToGround(0.3);
    this.visor = new MeshStandardMaterial({ color: '#2a2230', emissive: new Color('#ff3a1a'), emissiveIntensity: 0.2 });
    this.build();
    ctx.scene.add(this.root);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.7);
    ctx.targets.add(this);
  }

  private build(): void {
    const steel = new MeshStandardMaterial({ color: '#9aa0aa', metalness: 0.75, roughness: 0.35, flatShading: true });
    const dark = new MeshStandardMaterial({ color: '#4a4e58', metalness: 0.6, roughness: 0.5, flatShading: true });
    const plume = new MeshStandardMaterial({ color: '#b0362f', roughness: 0.9, flatShading: true });
    const add = (parent: Group, geo: import('three').BufferGeometry, mat: MeshStandardMaterial, p: [number, number, number]) => {
      const m = new Mesh(geo, mat);
      m.position.set(...p);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    for (const [leg, x] of [
      [this.legL, 0.2],
      [this.legR, -0.2],
    ] as const) {
      leg.position.set(x, 0.85, 0);
      add(leg, new CylinderGeometry(0.11, 0.13, 0.75, 6), steel, [0, -0.38, 0]);
      add(leg, new BoxGeometry(0.22, 0.12, 0.36), dark, [0, -0.8, 0.06]);
      this.root.add(leg);
    }
    this.body.position.y = 0.85;
    this.root.add(this.body);
    add(this.body, new CylinderGeometry(0.34, 0.26, 0.3, 8), dark, [0, 0.1, 0]); // belt/skirt
    add(this.body, new BoxGeometry(0.66, 0.7, 0.42), steel, [0, 0.6, 0]); // breastplate
    add(this.body, new SphereGeometry(0.2, 8, 6), steel, [0.42, 0.88, 0]); // pauldrons
    add(this.body, new SphereGeometry(0.2, 8, 6), steel, [-0.42, 0.88, 0]);
    const helm = new Group();
    helm.position.y = 1.2;
    this.body.add(helm);
    add(helm, new CylinderGeometry(0.2, 0.22, 0.38, 10), steel, [0, 0.12, 0]);
    add(helm, new SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel, [0, 0.31, 0]);
    add(helm, new BoxGeometry(0.3, 0.05, 0.05), this.visor as MeshStandardMaterial, [0, 0.15, 0.2]);
    add(helm, new ConeGeometry(0.08, 0.45, 5), plume, [0, 0.62, -0.05]);
    for (const [arm, x] of [
      [this.armL, 0.48],
      [this.armR, -0.48],
    ] as const) {
      arm.position.set(x, 0.85, 0);
      add(arm, new CylinderGeometry(0.09, 0.1, 0.6, 6), steel, [0, -0.3, 0]);
      add(arm, new SphereGeometry(0.11, 6, 4), dark, [0, -0.62, 0]);
      this.body.add(arm);
    }
    // A notched old sword in the right hand.
    add(this.armR, new BoxGeometry(0.06, 0.08, 1.1), steel, [0, -0.65, 0.5]);
    add(this.armR, new BoxGeometry(0.3, 0.05, 0.06), dark, [0, -0.65, 0]);
  }

  // ---------------------------------------------------------------- SpellTarget

  aimPoint(out: Vector3): Vector3 {
    return out.set(this.pos.x, this.pos.y + 0.4, this.pos.z);
  }
  enabled(): boolean {
    return this.state !== 'collapsed' && this.state !== 'toppled' && this.state !== 'rising';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    this.provoked = true;
    if (hit.charge < CHARGE_TO_TOPPLE) {
      // Clang! Just a stagger.
      this.state = 'stagger';
      this.timer = 0.45;
      this.ctx.events.emit('rattleClang', { pos: this.pos.clone() });
      if (!this.hintShown) {
        this.hintShown = true;
        this.ctx.events.emit('toast', { text: 'Too sturdy! Hold the button to charge Thwackwort.', kind: 'hint' });
      }
      return;
    }
    this.hp--;
    this.toppleDir.copy(hit.dir);
    this.facing = Math.atan2(-hit.dir.x, -hit.dir.z);
    this.ctx.events.emit('rattleTopple', { pos: this.pos.clone() });
    if (this.hp <= 0) {
      this.collapse();
      return;
    }
    this.state = 'toppled';
    this.timer = 3.2;
  }

  private collapse(): void {
    this.state = 'collapsed';
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    this.ctx.signals.set(this.spec.id, true);
    // Only castle Rattlecoats stay down for good; in a trial it's back with its Gnarlings
    // whenever the room is (a reload at a checkpoint, say).
    if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    this.ctx.state.award(POINTS.rattlecoat, 'toppling a Rattlecoat');
    this.ctx.sweets.burst('humbug', this.pos.clone(), 1);
    this.ctx.sweets.burst('bramble', this.pos.clone(), 2);
    // Every piece flies off on its own.
    this.root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    this.root.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    for (const m of meshes) {
      const wp = m.getWorldPosition(new Vector3());
      const wq = m.getWorldQuaternion(m.quaternion.clone());
      this.ctx.scene.attach(m);
      m.position.copy(wp);
      m.quaternion.copy(wq);
      const out = wp.clone().sub(this.pos).setY(0).normalize();
      this.pieces.push({
        mesh: m,
        vel: out.multiplyScalar(2 + Math.random() * 2.5).add(this.toppleDir.clone().multiplyScalar(2)).setY(3 + Math.random() * 3),
        spin: new Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      });
    }
    this.ctx.events.emit('rattleCollapse', { pos: this.pos.clone() });
  }

  // ---------------------------------------------------------------- behaviour

  /** True once the Gnarlings of its room (any within 16 m of its post, if it had any) are all gone. */
  private gnarlingsGone(): boolean {
    let live = 0;
    for (const c of this.ctx.creatures) {
      if (c.constructor.name !== 'Gnarling') continue;
      if (Math.hypot(c.pos.x - this.home.x, c.pos.z - this.home.z) < 16 && Math.abs(c.pos.y - this.home.y) < 6) live++;
    }
    if (live > 0) this.hadGnarlings = true;
    return this.hadGnarlings && live === 0;
  }

  /** Is there floor (no more than a step down) just ahead in this direction? */
  private groundAhead(yaw: number): boolean {
    const o = new Vector3(this.pos.x + Math.sin(yaw) * (R + 0.35), this.pos.y, this.pos.z + Math.cos(yaw) * (R + 0.35));
    return this.ctx.physics.raycast(o, new Vector3(0, -1, 0), CENTER_TO_FEET + 0.7, this.collider, (c) => c.handle !== this.ctx.player.collider.handle) !== null;
  }

  private playerInArena(): boolean {
    const p = this.ctx.player.pos;
    const { min, max } = this.spec.arena;
    return p.x > min[0] && p.x < max[0] && p.y > min[1] && p.y < max[1] && p.z > min[2] && p.z < max[2];
  }

  fixedUpdate(dt: number): void {
    if (this.state === 'collapsed') {
      for (const pc of this.pieces) {
        if (pc.mesh.position.y <= 0.08) {
          pc.vel.multiplyScalar(0.8);
          pc.vel.y = Math.abs(pc.vel.y) > 1.5 ? -pc.vel.y * 0.3 : 0;
          pc.spin.multiplyScalar(0.8);
          pc.mesh.position.y = 0.08;
        } else {
          pc.vel.y -= 18 * dt;
        }
        pc.mesh.position.addScaledVector(pc.vel, dt);
        pc.mesh.rotation.x += pc.spin.x * dt;
        pc.mesh.rotation.y += pc.spin.y * dt;
        pc.mesh.rotation.z += pc.spin.z * dt;
      }
      return;
    }
    this.prev.copy(this.pos);
    this.t += dt;
    this.timer -= dt;
    const player = this.ctx.player;
    const to = new Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = to.length();
    const faceYaw = Math.atan2(to.x, to.z);
    const available = player.mode !== 'reset' && !this.ctx.health.fainting;
    if (!this.provoked && this.gnarlingsGone()) this.provoked = true;
    const chasing = this.state !== 'dormant' && dist < (this.provoked ? LEASH_PROVOKED : LEASH);
    const engaged = available && (this.playerInArena() || chasing || (this.provoked && dist < LEASH_PROVOKED));
    this.chargeIn -= dt;
    let walk = 0;
    let walkYaw = this.facing;

    switch (this.state) {
      case 'dormant': {
        const back = new Vector3(this.home.x - this.pos.x, 0, this.home.z - this.pos.z);
        if (back.length() > 0.3) {
          walk = WALK_SPEED;
          walkYaw = Math.atan2(back.x, back.z);
        } else {
          walkYaw = this.spec.yaw;
        }
        if (engaged) this.state = 'approach';
        break;
      }
      case 'approach':
        if (!engaged) {
          this.state = 'dormant';
          break;
        }
        walkYaw = faceYaw;
        if (dist < REACH && Math.abs(angleDiff(this.facing, faceYaw)) < 0.5) {
          this.state = 'windup';
          this.timer = 0.75;
        } else if (this.chargeIn <= 0 && dist > CHARGE_RANGE[0] && dist < CHARGE_RANGE[1] && Math.abs(angleDiff(this.facing, faceYaw)) < 0.35) {
          // Lowers its sword, stamps, and comes at you.
          this.state = 'brace';
          this.timer = 0.6;
        } else if (dist > 1.5) {
          walk = WALK_SPEED;
        }
        break;
      case 'brace':
        walkYaw = faceYaw;
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 0.85;
          this.hitThisSwing = false;
          this.chargeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
        }
        break;
      case 'charge':
        walk = CHARGE_SPEED;
        walkYaw = this.facing;
        if (!this.hitThisSwing && dist < 1.4) this.hitThisSwing = this.ctx.health.damage(1, this.pos.clone());
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1;
          this.chargeIn = 3.5;
        }
        break;
      case 'windup':
        walkYaw = faceYaw;
        if (this.timer <= 0) {
          this.state = 'swing';
          this.timer = 0.25;
          this.hitThisSwing = false;
        }
        break;
      case 'swing':
        // It steps into the blow, so backing off slowly isn't enough.
        walk = WALK_SPEED * 1.6;
        walkYaw = this.facing;
        if (!this.hitThisSwing && dist < REACH + 0.4 && Math.abs(angleDiff(this.facing, faceYaw)) < 0.9) {
          this.hitThisSwing = this.ctx.health.damage(1, this.pos.clone());
        }
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1.1;
        }
        break;
      case 'recover':
      case 'stagger':
        if (this.timer <= 0) this.state = engaged ? 'approach' : 'dormant';
        break;
      case 'toppled':
        if (this.timer <= 0) {
          this.state = 'rising';
          this.timer = 0.9;
        }
        break;
      case 'rising':
        if (this.timer <= 0) this.state = engaged ? 'approach' : 'dormant';
        break;
    }

    if (this.state !== 'toppled' && this.state !== 'rising' && this.state !== 'swing' && this.state !== 'charge') {
      this.facing += MathUtils.clamp(angleDiff(this.facing, walkYaw), -2.5 * dt, 2.5 * dt);
    }
    this.vy = this.vy - 20 * dt;
    if (walk > 0 && !this.groundAhead(walkYaw)) {
      // It won't step off a ledge, not even mid-charge: armour doesn't climb back out of pits.
      walk = 0;
      if (this.state === 'charge') {
        this.state = 'recover';
        this.timer = 1;
        this.chargeIn = 3.5;
      }
    }
    const desired = new Vector3(Math.sin(walkYaw) * walk * dt, this.vy * dt, Math.cos(walkYaw) * walk * dt);
    if (this.state === 'toppled' && this.timer > 2.8) desired.addScaledVector(this.toppleDir, 4 * dt);
    const ph = player.collider.handle;
    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== ph);
    const mv = this.kcc.computedMovement();
    this.pos.add(new Vector3(mv.x, mv.y, mv.z));
    if (this.kcc.computedGrounded()) this.vy = 0;
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(dt: number, alpha: number): void {
    if (this.state === 'collapsed') return;
    const p = new Vector3().lerpVectors(this.prev, this.pos, alpha);
    this.root.position.set(p.x, p.y - CENTER_TO_FEET, p.z);
    this.root.rotation.y = this.facing;
    this.marker.sprite.position.set(p.x, p.y + 1.5, p.z);

    const walking = this.state === 'approach' || this.state === 'charge' || (this.state === 'dormant' && this.prev.distanceToSquared(this.pos) > 1e-6);
    const s = walking ? Math.sin(this.t * (this.state === 'charge' ? 14 : 6)) : 0;
    this.legL.rotation.x = s * 0.4;
    this.legR.rotation.x = -s * 0.4;
    this.armL.rotation.x = -s * 0.3;
    this.body.position.y = 0.85 + Math.abs(s) * 0.04;

    const raise = this.state === 'windup' ? -2.6 : this.state === 'swing' ? 0.6 : this.state === 'brace' || this.state === 'charge' ? -1.5 : -0.2 - s * 0.2;
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.state === 'brace' || this.state === 'charge' ? 0.35 : 0, 10, dt);
    this.armR.rotation.x = MathUtils.damp(this.armR.rotation.x, raise, this.state === 'swing' ? 30 : 8, dt);
    const lying = this.state === 'toppled' ? -1.5 : 0;
    this.root.rotation.x = MathUtils.damp(this.root.rotation.x, lying, this.state === 'toppled' ? 9 : 4, dt);
    if (this.state === 'stagger') this.body.rotation.z = Math.sin(this.t * 40) * 0.08;
    else this.body.rotation.z = 0;
    this.visor.emissiveIntensity = this.state === 'windup' || this.state === 'swing' || this.state === 'brace' || this.state === 'charge' ? 2.5 : this.state === 'toppled' ? 0 : 0.5;
  }
}
