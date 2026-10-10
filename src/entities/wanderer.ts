import { MathUtils, Vector3 } from 'three';
import { SPEAKERS } from '../data/characters';
import { buildStudent, type StudentRig } from '../player/model';
import type { Entity, Interactable, SpecOf, WorldContext } from './types';

/**
 * A fellow pupil going about their day: walks a loop of waypoints, dawdles at each, stops
 * and turns to face you when you come near, and has a word to say (E). No collider, so
 * nobody gets stuck on anybody in a doorway.
 */
export class Wanderer implements Entity, Interactable {
  private rig: StudentRig;
  private readonly footL: Vector3;
  private readonly footR: Vector3;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private yaw = 0;
  private leg = 0;
  private target = 1;
  private pause = 0;
  private t = Math.random() * 10;
  readonly radius = 2.6;

  constructor(
    private spec: SpecOf<'wanderer'>,
    private ctx: WorldContext,
  ) {
    const l = spec.look ?? {};
    this.rig = buildStudent(l);
    this.rig.root.scale.setScalar(l.scale ?? 0.95);
    this.footL = this.rig.footL.position.clone();
    this.footR = this.rig.footR.position.clone();
    this.pos = new Vector3(...spec.path[0]);
    this.prev = this.pos.clone();
    this.rig.root.position.copy(this.pos);
    ctx.scene.add(this.rig.root);
    ctx.interactables.add(this);
    this.pause = Math.random() * 3;
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.1, 0));
  }
  prompt(): string {
    return `Talk to ${SPEAKERS[this.spec.speaker].name}`;
  }
  interact(): void {
    void this.ctx.talk(this.spec.talk);
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    const p = this.ctx.player.pos;
    const near = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 2.2;
    if (near) {
      this.yaw = MathUtils.lerp(this.yaw, this.yaw + angle(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)), 1 - Math.exp(-6 * dt));
      return;
    }
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    const goal = new Vector3(...this.spec.path[this.target]);
    const to = goal.clone().sub(this.pos);
    to.y = 0;
    const d = to.length();
    const speed = this.spec.speed ?? 1.3;
    if (d < 0.05) {
      this.pos.x = goal.x;
      this.pos.z = goal.z;
      this.target = (this.target + 1) % this.spec.path.length;
      this.pause = 1.5 + Math.random() * 3;
      return;
    }
    const step = Math.min(d, speed * dt);
    this.pos.addScaledVector(to.normalize(), step);
    this.pos.y = MathUtils.lerp(this.pos.y, goal.y, 1 - Math.exp(-8 * dt));
    this.yaw += angle(this.yaw, Math.atan2(to.x, to.z)) * (1 - Math.exp(-8 * dt));
    this.leg += step * 3.2;
  }

  frameUpdate(dt: number, alpha: number): void {
    this.t += dt;
    const r = this.rig;
    r.root.position.lerpVectors(this.prev, this.pos, alpha);
    r.root.rotation.y = this.yaw;
    const walking = this.prev.distanceToSquared(this.pos) > 1e-6;
    const s = Math.sin(this.leg);
    r.footL.position.z = this.footL.z + (walking ? s * 0.14 : 0);
    r.footR.position.z = this.footR.z + (walking ? -s * 0.14 : 0);
    r.body.position.y = walking ? Math.abs(Math.cos(this.leg)) * 0.04 : Math.sin(this.t * 2) * 0.008;
    r.armL.rotation.x = walking ? -s * 0.45 : 0;
    r.armR.rotation.x = walking ? s * 0.45 : -0.2 + Math.sin(this.t * 1.3) * 0.08;
    r.head.rotation.z = Math.sin(this.t * 0.7) * 0.05;
  }
}

function angle(from: number, to: number): number {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
