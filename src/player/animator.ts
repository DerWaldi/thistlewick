import { MathUtils, Vector3 } from 'three';
import type { EventBus } from '../engine/events';
import { FOOT_OFFSET, type PlayerController } from './controller';
import type { StudentRig } from './model';

/** Critically-damped-ish spring for secondary motion. */
class Spring {
  value: number;
  velocity = 0;
  constructor(
    public target: number,
    private stiffness: number,
    private damping: number,
  ) {
    this.value = target;
  }
  update(dt: number): number {
    const a = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
    this.velocity += a * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  kick(v: number): void {
    this.velocity += v;
  }
}

/**
 * Procedural animation: run cycle driven by distance travelled, lean into
 * acceleration and turns, squash & stretch on jump/land, jiggly hat and scarf.
 */
export class StudentAnimator {
  private phase = 0;
  private squash = new Spring(1, 320, 14);
  private hatX = new Spring(0, 160, 7);
  private hatZ = new Spring(0, 160, 7);
  private scarf = new Spring(0, 60, 5);
  private lean = 0;
  private roll = 0;
  private hangBlend = 0;
  private renderFacing = 0;
  private readonly lastVel = new Vector3();
  private readonly renderPos = new Vector3();
  private time = 0;
  private castFlick = new Spring(0, 260, 16);
  /** 0..1 while the player charges a spell (set by the game each frame). */
  charge = 0;
  private aim = 0;

  constructor(
    private rig: StudentRig,
    private player: PlayerController,
    events: EventBus,
  ) {
    events.on('jump', () => this.squash.kick(4.5));
    events.on('bounce', () => {
      this.squash.kick(7);
      this.hatX.kick(-6);
    });
    events.on('land', ({ impact }) => {
      const k = MathUtils.clamp(impact / 14, 0.15, 1);
      this.squash.kick(-6 * k);
      this.hatX.kick(5 * k);
    });
    events.on('ledgeGrab', () => this.hatX.kick(-4));
    events.on('cast', ({ charge }) => {
      this.castFlick.kick(-14 - charge * 8);
      this.hatX.kick(-3);
    });
    events.on('fizzle', () => this.castFlick.kick(-10));
    events.on('respawn', () => {
      this.renderFacing = player.facing;
    });
    this.renderFacing = player.facing;
  }

  update(dt: number, alpha: number): void {
    if (dt <= 0) return;
    const p = this.player;
    const r = this.rig;
    this.time += dt;

    this.renderPos.lerpVectors(p.prevPos, p.pos, alpha);
    // Ease the body up after a step-up instead of popping.
    p.stepSmoothing *= Math.exp(-18 * dt);
    r.root.position.set(this.renderPos.x, this.renderPos.y - FOOT_OFFSET + p.stepSmoothing, this.renderPos.z);
    this.renderFacing += angleWrap(p.facing - this.renderFacing) * (1 - Math.exp(-30 * dt));
    r.root.rotation.y = this.renderFacing;

    const speed = p.horizontalSpeed;
    const speed01 = MathUtils.clamp(speed / 6.2, 0, 1);
    const grounded = p.mode === 'ground';
    const airborne = p.mode === 'air';
    const hanging = p.mode === 'hang' || p.mode === 'climb';

    // Acceleration in the facing frame drives lean.
    const ax = (p.vel.x - this.lastVel.x) / dt;
    const az = (p.vel.z - this.lastVel.z) / dt;
    this.lastVel.copy(p.vel);
    const fwdAccel = ax * Math.sin(p.facing) + az * Math.cos(p.facing);
    const sliding = p.mode === 'slide';
    const targetLean = grounded
      ? MathUtils.clamp(0.1 * speed01 + fwdAccel * 0.004, -0.15, 0.25)
      : airborne
        ? 0.08
        : sliding
          ? -0.3
          : 0;
    this.lean = MathUtils.damp(this.lean, targetLean, 10, dt);
    const targetRoll = grounded ? MathUtils.clamp(-p.turnVelocity * 0.025 * speed01, -0.3, 0.3) : 0;
    this.roll = MathUtils.damp(this.roll, targetRoll, 10, dt);
    r.body.rotation.set(this.lean, 0, this.roll);

    // Run cycle advances with distance so feet never skate.
    if (grounded) this.phase += (speed * dt) / 0.95 * Math.PI;
    const s = Math.sin(this.phase);
    const stride = grounded ? speed01 : 0;
    r.footL.position.z = 0.03 + s * 0.22 * stride;
    r.footR.position.z = 0.03 - s * 0.22 * stride;
    r.footL.position.y = 0.05 + Math.max(0, -s) * 0.1 * stride;
    r.footR.position.y = 0.05 + Math.max(0, s) * 0.1 * stride;
    const bob = Math.abs(Math.cos(this.phase)) * 0.07 * stride;
    const breathe = grounded && speed < 0.3 ? Math.sin(this.time * 2.2) * 0.012 : 0;
    r.torso.position.y = 0.08 + bob + breathe;

    // Squash & stretch, plus a stretch while rising and a slight stretch while falling fast.
    const airStretch = airborne ? MathUtils.clamp(p.vel.y * 0.012, -0.06, 0.1) : 0;
    this.squash.target = 1 + airStretch;
    const sq = this.squash.update(dt);
    r.body.scale.set(1 / Math.sqrt(Math.max(0.5, sq)), sq, 1 / Math.sqrt(Math.max(0.5, sq)));

    // Arms: swing while running, flail up in the air, reach up while hanging.
    this.hangBlend = MathUtils.damp(this.hangBlend, hanging ? 1 : 0, 18, dt);
    const swing = s * 0.7 * stride;
    const airArms = airborne ? MathUtils.clamp(0.6 + p.vel.y * -0.04, 0.2, 1.1) : sliding ? 1.2 : 0;
    const armX = (swing: number) => MathUtils.lerp(swing, -2.9, this.hangBlend);
    r.armL.rotation.x = armX(swing - airArms * 0.3);
    r.armR.rotation.x = armX(-swing - airArms * 0.5);
    // Casting: the wand arm points forward while charging and flicks on release.
    this.aim = MathUtils.damp(this.aim, this.charge > 0 ? 1 : 0, 14, dt);
    const flick = this.castFlick.update(dt);
    r.armR.rotation.x = MathUtils.lerp(r.armR.rotation.x, -1.45 - this.charge * 0.25, this.aim) + flick * 0.12;
    const tipScale = 1 + this.charge * 2.5 + Math.max(0, -flick) * 0.15;
    r.wandTip.scale.setScalar(tipScale);
    r.armL.rotation.z = MathUtils.lerp(0.18 + airArms * 0.8, 0.25, this.hangBlend);
    r.armR.rotation.z = MathUtils.lerp(-0.18 - airArms * 0.8, -0.25, this.hangBlend);

    // Climb: tuck the body as it goes over.
    if (p.mode === 'climb') {
      const t = p.climbT;
      r.body.rotation.x += Math.sin(t * Math.PI) * 0.5;
    }

    // Head looks slightly where you're turning.
    r.head.rotation.y = MathUtils.damp(r.head.rotation.y, MathUtils.clamp(p.turnVelocity * 0.04, -0.4, 0.4), 8, dt);

    // Hat tip & scarf lag behind the body's motion.
    this.hatX.kick(-fwdAccel * 0.004 * dt * 60);
    this.hatZ.kick(p.turnVelocity * 0.02 * dt * 60);
    r.hatTip.rotation.x = -0.2 + this.hatX.update(dt) * 0.25;
    r.hatTip.rotation.z = -0.35 + this.hatZ.update(dt) * 0.2;
    this.scarf.target = MathUtils.clamp(speed01 * 0.9 + (airborne ? -p.vel.y * 0.05 : 0), -0.3, 1.3);
    r.scarfTail.rotation.x = this.scarf.update(dt) + Math.sin(this.time * 9) * 0.06 * speed01;
  }
}

function angleWrap(d: number): number {
  d = d % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
