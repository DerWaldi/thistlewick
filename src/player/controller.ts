import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import type { EventBus } from '../engine/events';
import type { Input } from '../engine/input';
import type { ColliderInfo, Physics, Surface } from '../engine/physics';
import type { Tuning } from '../data/tuning';

export type PlayerMode = 'ground' | 'air' | 'slide' | 'hang' | 'climb' | 'reset';

/** What the controller needs to know about the level it's in. */
export interface PlayerEnvironment {
  killY: number;
  /** Water surface height at this xz position, or null if there's no water here. */
  waterSurfaceAt(p: Vector3): number | null;
}

export const HALF_HEIGHT = 0.45;
export const RADIUS = 0.35;
/** Capsule centre to feet. */
export const FOOT_OFFSET = HALF_HEIGHT + RADIUS;
const RING_RAYS = 8;
const HANG_OFFSET = 0.78; // capsule centre below the ledge lip while hanging
const UP = new Vector3(0, 1, 0);

const tmpA = new Vector3();
const tmpB = new Vector3();

interface LedgeHit {
  lipY: number;
  wallPoint: Vector3;
  normal: Vector3; // horizontal, pointing out of the wall
}

/**
 * Kinematic third-person controller: acceleration-based running, variable-height
 * jumps with coyote time and buffering, ledge grab/shimmy/climb, bounce pads,
 * slippery surfaces, moving platforms and water/fall resets.
 */
export class PlayerController {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;

  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly vel = new Vector3();
  facing = 0; // yaw; forward = (sin, 0, cos)
  turnVelocity = 0; // rad/s, for animation lean
  mode: PlayerMode = 'air';
  grounded = false;
  groundSurface: Surface = 'default';
  readonly groundNormal = new Vector3(0, 1, 0);
  readonly lastSafe = new Vector3();
  /** Seconds since grounded/airborne changed, for animation. */
  stateTime = 0;
  /** Normalised 0..1 progress of the current climb. */
  climbT = 0;
  /** Multiplies run speed (e.g. while charging a spell). */
  speedScale = 1;
  /** When set, the player turns to this yaw instead of the stick direction. */
  faceOverride: number | null = null;
  /** Ignore movement and jump input (cutscenes, fainting). */
  frozen = false;

  private groundInfo: ColliderInfo | undefined;
  private coyote = 0;
  private buffer = 0;
  private jumpedThisArc = false;
  private regrab = 0;
  private safeTimer = 0;
  private skidCooldown = 0;
  private resetTimer = 0;
  private hang: LedgeHit | null = null;
  private hangSnap = 1;
  private readonly hangFrom = new Vector3();
  private readonly climbFrom = new Vector3();
  private readonly climbTo = new Vector3();

  constructor(
    private physics: Physics,
    private input: Input,
    private events: EventBus,
    private tuning: Tuning,
    private env: PlayerEnvironment,
    spawn: Vector3,
  ) {
    const world = physics.world;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + FOOT_OFFSET, spawn.z),
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.kcc = world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(0.32, 0.15, false);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setSlideEnabled(true);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.teleport(spawn);
  }

  /** Moves the player's feet to `feet` and clears all motion. */
  teleport(feet: Vector3, facing?: number): void {
    this.pos.set(feet.x, feet.y + FOOT_OFFSET, feet.z);
    this.prevPos.copy(this.pos);
    this.lastSafe.copy(this.pos);
    this.safeHistory.length = 0;
    this.vel.set(0, 0, 0);
    this.body.setTranslation(this.pos, true);
    this.body.setNextKinematicTranslation(this.pos);
    this.mode = 'air';
    this.grounded = false;
    this.hang = null;
    if (facing !== undefined) this.facing = facing;
  }

  get environment(): PlayerEnvironment {
    return this.env;
  }

  get feet(): Vector3 {
    return tmpA.set(this.pos.x, this.pos.y - FOOT_OFFSET, this.pos.z);
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  update(dt: number, cameraYaw: number): void {
    this.prevPos.copy(this.pos);
    this.regrab -= dt;
    this.skidCooldown -= dt;
    this.stateTime += dt;
    if (this.input.consumeJump() && !this.frozen) this.buffer = this.tuning.jump.bufferTime;
    const maxSlope = (this.tuning.move.maxSlope * Math.PI) / 180;
    this.kcc.setMaxSlopeClimbAngle(maxSlope);
    this.kcc.setMinSlopeSlideAngle(maxSlope);

    const prevFacing = this.facing;
    switch (this.mode) {
      case 'reset':
        this.updateReset(dt);
        break;
      case 'hang':
        this.updateHang(dt, cameraYaw);
        break;
      case 'climb':
        this.updateClimb(dt);
        break;
      default:
        this.updateMove(dt, cameraYaw);
    }
    this.buffer -= dt;
    this.turnVelocity = angleDiff(prevFacing, this.facing) / dt;
    this.body.setNextKinematicTranslation(this.pos);
  }

  // ---------------------------------------------------------------- running & jumping

  private wishDir(cameraYaw: number, out: Vector3): number {
    if (this.frozen) {
      out.set(0, 0, 0);
      return 0;
    }
    const axis = this.input.moveAxis();
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    // right = forward x up
    out.set(fx * axis.y - fz * axis.x, 0, fz * axis.y + fx * axis.x);
    return out.length();
  }

  private updateMove(dt: number, cameraYaw: number): void {
    const m = this.tuning.move;
    const j = this.tuning.jump;
    const wish = tmpB;
    const wishLen = this.wishDir(cameraYaw, wish);
    const onIce = this.grounded && this.groundSurface === 'ice';

    // Horizontal velocity: accelerate towards the wished velocity.
    const tx = wish.x * m.runSpeed * this.speedScale;
    const tz = wish.z * m.runSpeed * this.speedScale;
    let rate: number;
    if (this.grounded) {
      if (wishLen > 0.01) {
        const turningAround = this.vel.x * tx + this.vel.z * tz < 0;
        rate = turningAround ? m.turnaroundAccel : m.groundAccel;
        if (turningAround && this.horizontalSpeed > 4 && this.skidCooldown <= 0 && !onIce) {
          this.events.emit('skid', { pos: this.feet.clone() });
          this.skidCooldown = 0.3;
        }
        if (onIce) rate *= m.iceAccelScale;
      } else {
        rate = onIce ? m.groundDecel * m.iceDecelScale : m.groundDecel;
      }
    } else {
      rate = wishLen > 0.01 ? m.airAccel : m.airDecel;
    }
    moveTowards2D(this.vel, tx, tz, rate * dt);

    // Facing follows the stick, not the velocity, so turning reads instantly.
    if (this.faceOverride !== null) {
      this.facing = rotateTowards(this.facing, this.faceOverride, m.turnRate * dt);
    } else if (wishLen > 0.1) {
      const target = Math.atan2(wish.x, wish.z);
      this.facing = rotateTowards(this.facing, target, m.turnRate * dt);
    }

    // Jumping with coyote time and buffering.
    if (this.grounded) this.coyote = j.coyoteTime;
    else this.coyote -= dt;
    if (this.buffer > 0 && this.coyote > 0) this.jump(j.height);

    // Gravity: heavier on the way down, and when jump is released early.
    if (!this.grounded) {
      let g = j.gravity;
      if (this.vel.y < 0) g *= j.fallGravityScale;
      else if (this.jumpedThisArc && !this.input.jumpHeld()) g *= j.cutGravityScale;
      this.vel.y = Math.max(this.vel.y - g * dt, -j.maxFallSpeed);
    } else {
      this.vel.y = -1; // keep contact so grounded stays reliable on slopes and steps
    }

    // Ride moving platforms.
    const carry = this.grounded && this.groundInfo?.mover ? this.groundInfo.mover.delta : null;
    const desired = new Vector3(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    if (carry) {
      desired.x += carry.x;
      desired.z += carry.z;
      // Match the platform exactly (snap-to-ground keeps us in contact). Pressing down
      // into it makes Rapier occasionally stop at the surface and drop the horizontal part.
      desired.y = carry.y;
    }

    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.kcc.computedMovement();
    this.pos.x += mv.x;
    this.pos.y += mv.y;
    this.pos.z += mv.z;

    // Bonk heads on ceilings; stop pushing into walls (but keep full speed up walkable slopes).
    if (this.vel.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0;
    for (let i = 0; i < this.kcc.numComputedCollisions(); i++) {
      const c = this.kcc.computedCollision(i);
      if (!c) continue;
      const n = c.normal1; // obstacle surface normal, pointing at the character
      if (n.y >= 0.3 || n.y < -0.3) continue; // only near-vertical walls; slopes are handled by the KCC
      const len = Math.hypot(n.x, n.z);
      if (len < 1e-4) continue;
      const nx = n.x / len;
      const nz = n.z / len;
      const into = this.vel.x * nx + this.vel.z * nz;
      if (into < 0) {
        this.vel.x -= into * nx;
        this.vel.z -= into * nz;
      }
    }

    const wasGrounded = this.grounded;
    const fallSpeed = -this.vel.y;
    const kccGrounded = this.kcc.computedGrounded();
    this.grounded = kccGrounded && this.vel.y <= 0.01;
    this.probeGround();

    // Too steep to stand on: no grounding, no jumping, and gravity pulls us down the slope.
    // "Held up but nothing walkable under the feet" covers the foot of a steep slope and
    // perching on the rim of a steep slab; the centre probe covers resting on the slope.
    // Balanced on an edge with nothing below ('none') isn't grounded either: you slip off.
    const wallY = Math.cos((this.tuning.move.maxSlope * Math.PI) / 180);
    const footing = kccGrounded ? this.footing(wallY) : 'none';
    if (footing !== 'walkable') this.grounded = false;
    const n = this.groundNormal;
    const sliding = (this.onSteep || footing === 'steep') && this.vel.y <= 0.01;
    if (sliding) {
      this.coyote = 0;
      this.vel.y = Math.max(this.vel.y, mv.y / dt);
      const g = j.gravity * j.fallGravityScale;
      this.vel.x += n.x * n.y * g * dt;
      this.vel.z += n.z * n.y * g * dt;
    }

    if (this.grounded !== wasGrounded) this.stateTime = 0;
    this.mode = this.grounded ? 'ground' : sliding ? 'slide' : 'air';

    if (this.grounded && !wasGrounded) {
      this.jumpedThisArc = false;
      this.vel.y = 0;
      if (this.groundInfo?.bounce) {
        this.bounce(this.groundInfo.bounce.scale);
        this.groundInfo.bounce.onBounce?.();
      } else {
        this.events.emit('land', { pos: this.feet.clone(), impact: fallSpeed });
        // A buffered jump fires on the landing frame.
        if (this.buffer > 0) this.jump(j.height);
      }
    } else if (this.grounded && this.groundInfo?.bounce) {
      this.bounce(this.groundInfo.bounce.scale);
    }

    if (!this.grounded && wasGrounded && !this.jumpedThisArc && carry) {
      // Walking off a moving platform keeps its momentum.
      this.vel.x += carry.x / dt;
      this.vel.z += carry.z / dt;
    }

    this.trackSafeGround(dt);
    if (!this.grounded) this.tryGrabLedge(cameraYaw);
    this.checkHazards();
  }

  private jump(height: number): void {
    const j = this.tuning.jump;
    const carry = this.grounded && this.groundInfo?.mover ? this.groundInfo.mover.delta : null;
    if (carry) {
      this.vel.x += carry.x * 60;
      this.vel.z += carry.z * 60;
    }
    this.vel.y = Math.sqrt(2 * j.gravity * height);
    this.grounded = false;
    this.mode = 'air';
    this.coyote = 0;
    this.buffer = 0;
    this.jumpedThisArc = true;
    this.stateTime = 0;
    this.events.emit('jump', { pos: this.feet.clone() });
  }

  /** Launch upwards (bounce pads, gusts). `height` is the apex height in metres. */
  launch(height: number, horizontal?: Vector3): void {
    this.vel.y = Math.sqrt(2 * this.tuning.jump.gravity * height);
    if (horizontal) {
      this.vel.x += horizontal.x;
      this.vel.z += horizontal.z;
    }
    this.grounded = false;
    this.mode = 'air';
    this.coyote = 0;
    this.jumpedThisArc = false;
    this.stateTime = 0;
    if (this.hang) this.hang = null;
  }

  /** Get knocked back (hurt): a short hop away from `from`. Breaks ledge holds. */
  knockback(from: Vector3, strength = 6): void {
    const away = new Vector3(this.pos.x - from.x, 0, this.pos.z - from.z);
    if (away.lengthSq() < 1e-4) away.set(-Math.sin(this.facing), 0, -Math.cos(this.facing));
    away.normalize().multiplyScalar(strength);
    this.vel.x = 0;
    this.vel.z = 0;
    this.launch(0.6, away);
    this.regrab = 0.4;
  }

  private bounce(scale: number): void {
    const j = this.tuning.jump;
    const boosted = this.input.jumpHeld() || this.buffer > 0;
    const h = j.bounceHeight * scale * (boosted ? j.bounceBoostScale : 1);
    this.launch(h);
    this.buffer = 0;
    this.events.emit('bounce', { pos: this.feet.clone(), power: boosted ? 1 : 0.7 });
  }

  private probeGround(): void {
    // Long enough to reach a steep slope under the capsule (the centre sits higher above those).
    const hit = this.physics.raycast(this.pos, new Vector3(0, -1, 0), FOOT_OFFSET + 0.7, this.collider);
    const near = hit !== null && hit.distance <= FOOT_OFFSET + 0.25;
    this.groundInfo = near ? this.physics.getInfo(hit.collider) : undefined;
    this.groundSurface = this.groundInfo?.surface ?? 'default';
    if (hit) this.groundNormal.copy(hit.normal);
    else this.groundNormal.set(0, 1, 0);
    this.centerOverGround = near;
    const maxSlope = (this.tuning.move.maxSlope * Math.PI) / 180;
    this.onSteep =
      hit !== null &&
      hit.normal.y > 0.05 &&
      hit.normal.y < Math.cos(maxSlope) &&
      hit.distance <= HALF_HEIGHT + RADIUS / hit.normal.y + 0.1;
  }
  private centerOverGround = false;
  private onSteep = false;

  /**
   * What's right under the feet? Probes the centre and a ring just inside the capsule radius.
   * 'none' means we're balanced on an edge with nothing below (just let gravity take us).
   * Records the steepest surface found in groundNormal when there's no walkable one.
   */
  private footing(wallY: number): 'walkable' | 'steep' | 'none' {
    const feetY = this.pos.y - FOOT_OFFSET;
    const down = new Vector3(0, -1, 0);
    const origin = new Vector3();
    let steepest: Vector3 | null = null;
    for (let i = 0; i <= RING_RAYS; i++) {
      const a = (i / RING_RAYS) * Math.PI * 2;
      const r = i === RING_RAYS ? 0 : RADIUS * 0.85;
      origin.set(this.pos.x + Math.cos(a) * r, feetY + 0.45, this.pos.z + Math.sin(a) * r);
      const hit = this.physics.raycast(origin, down, 0.65, this.collider);
      if (!hit || hit.point.y < feetY - 0.15) continue;
      if (hit.normal.y >= wallY) return 'walkable';
      if (!steepest || hit.normal.y < steepest.y) steepest = hit.normal;
    }
    if (!steepest) return 'none';
    this.groundNormal.copy(steepest);
    return 'steep';
  }

  private trackSafeGround(dt: number): void {
    const info = this.groundInfo;
    const stable =
      this.grounded && this.centerOverGround && !info?.mover && !info?.bounce && this.groundNormal.y > 0.85;
    if (!stable) {
      this.safeTimer = 0;
      return;
    }
    this.safeTimer += dt;
    if (this.safeTimer > 0.25) {
      this.lastSafe.copy(this.pos);
      const last = this.safeHistory[this.safeHistory.length - 1];
      if (!last || last.distanceToSquared(this.pos) > 0.36) {
        this.safeHistory.push(this.pos.clone());
        if (this.safeHistory.length > 24) this.safeHistory.shift();
      }
    }
  }

  /** Most recent safe spot that's a little way back from the edge we fell off. */
  private pickRespawn(): Vector3 {
    const edge = this.safeHistory[this.safeHistory.length - 1] ?? this.lastSafe;
    for (let i = this.safeHistory.length - 1; i >= 0; i--) {
      const p = this.safeHistory[i];
      if (Math.hypot(p.x - edge.x, p.z - edge.z) >= 1.5) return p.clone();
    }
    return (this.safeHistory[0] ?? this.lastSafe).clone();
  }
  private safeHistory: Vector3[] = [];

  // ---------------------------------------------------------------- hazards

  private checkHazards(): void {
    const surface = this.env.waterSurfaceAt(this.pos);
    if (surface !== null && this.pos.y < surface + 0.1) {
      this.events.emit('splash', { pos: new Vector3(this.pos.x, surface, this.pos.z) });
      this.beginReset('water');
    } else if (this.pos.y < this.env.killY) {
      this.beginReset('fall');
    }
  }

  private resetReason: 'water' | 'fall' = 'fall';

  private beginReset(reason: 'water' | 'fall'): void {
    this.mode = 'reset';
    this.resetReason = reason;
    this.resetTimer = 0;
    this.vel.multiplyScalar(0.2);
  }

  private updateReset(dt: number): void {
    this.resetTimer += dt;
    // Sink slowly while the screen fades.
    this.vel.y = Math.max(this.vel.y - 6 * dt, -2);
    this.pos.addScaledVector(this.vel, dt);
    if (this.resetTimer >= 0.6) {
      const p = this.pickRespawn();
      this.safeHistory.length = 0;
      this.lastSafe.copy(p);
      this.pos.copy(p);
      this.prevPos.copy(p);
      this.body.setTranslation(p, true);
      this.vel.set(0, 0, 0);
      this.mode = 'air';
      this.grounded = false;
      this.events.emit('respawn', { pos: p.clone(), reason: this.resetReason });
    }
  }

  // ---------------------------------------------------------------- ledges

  private findLedge(dir: Vector3): LedgeHit | null {
    const l = this.tuning.ledge;
    for (const h of [0.55, 0.15, -0.3]) {
      const origin = new Vector3(this.pos.x, this.pos.y + h, this.pos.z);
      const wall = this.physics.raycast(origin, dir, RADIUS + l.reach, this.collider);
      if (!wall || Math.abs(wall.normal.y) > 0.3) continue;
      const info = this.physics.getInfo(wall.collider);
      if (info?.noGrab || info?.mover) return null;
      const n = new Vector3(wall.normal.x, 0, wall.normal.z).normalize();
      if (n.dot(dir) > -0.5) continue; // glancing angle

      // Probe downward just behind the wall face to find the top surface.
      const top = this.pos.y + l.maxAbove + 0.3;
      const probe = new Vector3(wall.point.x - n.x * 0.15, top, wall.point.z - n.z * 0.15);
      const down = this.physics.raycast(probe, new Vector3(0, -1, 0), l.maxAbove + 0.3 - l.minAbove, this.collider);
      if (!down || down.distance < 0.02 || down.normal.y < 0.8) return null;
      const lipY = down.point.y;
      if (lipY < this.pos.y + l.minAbove || lipY > this.pos.y + l.maxAbove) return null;
      if (this.physics.getInfo(down.collider)?.noGrab) return null;

      // There must be room to stand on top.
      const stand = new Vector3(wall.point.x - n.x * (RADIUS + 0.2), lipY + FOOT_OFFSET + 0.05, wall.point.z - n.z * (RADIUS + 0.2));
      if (this.physics.capsuleBlocked(stand, HALF_HEIGHT, RADIUS - 0.02, this.collider)) return null;
      return { lipY, wallPoint: wall.point, normal: n };
    }
    return null;
  }

  private tryGrabLedge(cameraYaw: number): void {
    const l = this.tuning.ledge;
    if (!l.enabled || this.regrab > 0 || this.vel.y > 3) return;
    const dir = new Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const ledge = this.findLedge(dir);
    if (!ledge) return;

    this.hang = ledge;
    this.vel.set(0, 0, 0);
    this.facing = Math.atan2(-ledge.normal.x, -ledge.normal.z);
    this.jumpedThisArc = false;
    this.events.emit('ledgeGrab', { pos: ledge.wallPoint.clone() });

    const wish = new Vector3();
    const wishLen = this.wishDir(cameraYaw, wish);
    const pushingIn = wishLen > 0.3 && wish.dot(ledge.normal) < -0.35 * wishLen;
    const lowLip = ledge.lipY < this.pos.y + 0.25;
    if (lowLip || (l.autoClimb && pushingIn)) {
      this.startClimb();
    } else {
      this.mode = 'hang';
      this.stateTime = 0;
      this.hangSnap = 0;
      this.hangFrom.copy(this.pos);
    }
  }

  private hangPosition(h: LedgeHit, out: Vector3): Vector3 {
    return out.set(
      h.wallPoint.x + h.normal.x * (RADIUS + 0.03),
      h.lipY - HANG_OFFSET,
      h.wallPoint.z + h.normal.z * (RADIUS + 0.03),
    );
  }

  private updateHang(dt: number, cameraYaw: number): void {
    const h = this.hang!;
    const l = this.tuning.ledge;
    const target = this.hangPosition(h, tmpB);
    if (this.hangSnap < 1) {
      this.hangSnap = Math.min(1, this.hangSnap + dt / 0.09);
      this.pos.lerpVectors(this.hangFrom, target, easeOut(this.hangSnap));
      return;
    }
    this.pos.copy(target);

    const wish = new Vector3();
    const wishLen = this.wishDir(cameraYaw, wish);
    const toward = -wish.dot(h.normal);
    if (this.buffer > 0 || (l.autoClimb && toward > 0.5 && this.stateTime > 0.15)) {
      this.buffer = 0;
      this.startClimb();
      return;
    }
    if (toward < -0.5 && wishLen > 0.5) {
      // Let go.
      this.hang = null;
      this.mode = 'air';
      this.stateTime = 0;
      this.regrab = l.regrabCooldown;
      this.vel.set(h.normal.x * 1.5, 0, h.normal.z * 1.5);
      return;
    }

    // Shimmy along the ledge.
    const tangent = new Vector3().crossVectors(UP, h.normal); // left when facing the wall
    const along = wish.dot(tangent);
    if (Math.abs(along) > 0.3) {
      const step = tangent.clone().multiplyScalar(Math.sign(along) * l.shimmySpeed * dt);
      const saved = this.pos.clone();
      this.pos.add(step);
      const next = this.findLedgeAt(h);
      if (next && Math.abs(next.lipY - h.lipY) < 0.2) {
        this.hang = next;
        this.pos.copy(this.hangPosition(next, tmpB));
        this.vel.copy(step).divideScalar(dt);
      } else {
        this.pos.copy(saved);
        this.vel.set(0, 0, 0);
      }
    } else {
      this.vel.set(0, 0, 0);
    }
  }

  /** Re-probes the ledge from the current hang position (used while shimmying). */
  private findLedgeAt(h: LedgeHit): LedgeHit | null {
    const saveY = this.pos.y;
    // findLedge expects the capsule roughly level with the lip; hanging puts us below the window.
    this.pos.y = h.lipY - 0.4;
    const r = this.findLedge(h.normal.clone().negate());
    this.pos.y = saveY;
    return r;
  }

  private startClimb(): void {
    const h = this.hang!;
    this.mode = 'climb';
    this.climbT = 0;
    this.stateTime = 0;
    this.climbFrom.copy(this.pos);
    this.climbTo.set(
      h.wallPoint.x - h.normal.x * (RADIUS + 0.25),
      h.lipY + FOOT_OFFSET + 0.03,
      h.wallPoint.z - h.normal.z * (RADIUS + 0.25),
    );
    this.vel.set(0, 0, 0);
  }

  private updateClimb(dt: number): void {
    const h = this.hang!;
    this.climbT = Math.min(1, this.climbT + dt / this.tuning.ledge.climbTime);
    const t = this.climbT;
    // Rise first (staying outside the wall), then step onto the ledge.
    const rise = easeOut(Math.min(1, t / 0.6));
    const over = easeInOut(Math.max(0, (t - 0.45) / 0.55));
    const outX = h.wallPoint.x + h.normal.x * (RADIUS + 0.03);
    const outZ = h.wallPoint.z + h.normal.z * (RADIUS + 0.03);
    const startX = this.climbFrom.x + (outX - this.climbFrom.x) * Math.min(1, t * 4);
    const startZ = this.climbFrom.z + (outZ - this.climbFrom.z) * Math.min(1, t * 4);
    this.pos.set(
      startX + (this.climbTo.x - startX) * over,
      this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * rise,
      startZ + (this.climbTo.z - startZ) * over,
    );
    if (t >= 1) {
      this.hang = null;
      this.mode = 'ground';
      this.grounded = true;
      this.stateTime = 0;
      this.regrab = 0.2;
      this.events.emit('ledgeClimb', { pos: this.feet.clone() });
    }
  }
}

// ---------------------------------------------------------------- helpers

function moveTowards2D(v: Vector3, tx: number, tz: number, maxDelta: number): void {
  const dx = tx - v.x;
  const dz = tz - v.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxDelta || d < 1e-6) {
    v.x = tx;
    v.z = tz;
  } else {
    v.x += (dx / d) * maxDelta;
    v.z += (dz / d) * maxDelta;
  }
}

export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rotateTowards(a: number, b: number, maxStep: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
