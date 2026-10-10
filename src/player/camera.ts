import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { Input } from '../engine/input';
import type { Physics } from '../engine/physics';
import type { Tuning } from '../data/tuning';
import { FOOT_OFFSET, angleDiff, type PlayerController } from './controller';

const CAM_RADIUS = 0.28;

/**
 * Orbit camera with a collision-aware spring arm.
 * - The pivot follows the player quickly horizontally but lazily vertically, so jumps
 *   don't yank the view; it only chases height once you land or fall out of frame.
 * - The arm is shortened instantly when blocked and eases back out.
 * - After the mouse rests for a moment, the yaw drifts behind the running direction.
 */
export class OrbitCamera {
  yaw = 0; // camera looks along (sin yaw, 0, cos yaw)
  pitch = -0.25;
  private readonly pivot = new Vector3();
  private pivotY = 0;
  private armLength: number;
  private readonly lookAhead = new Vector3();
  private initialised = false;
  private speedFov = 0;
  private mouseIdle = 0;

  constructor(
    readonly camera: PerspectiveCamera,
    private input: Input,
    private physics: Physics,
    private tuning: Tuning,
    private player: PlayerController,
  ) {
    this.armLength = tuning.camera.distance;
  }

  private blocksCamera(col: import('@dimforge/rapier3d-compat').Collider): boolean {
    return col !== this.player.collider && !this.physics.getInfo(col)?.cameraIgnore;
  }

  /** Snap behind the player (after teleports/respawns). */
  snap(): void {
    this.initialised = false;
  }

  update(dt: number, alpha: number): void {
    const c = this.tuning.camera;
    const p = this.player;

    const { dx, dy } = this.input.consumeMouse();
    // Idle time is accumulated in game time so recentering is deterministic under test stepping.
    this.mouseIdle = dx !== 0 || dy !== 0 ? 0 : this.mouseIdle + dt;
    this.yaw -= dx * c.sensitivity;
    this.pitch = MathUtils.clamp(this.pitch - dy * c.sensitivity, c.minPitch, c.maxPitch);

    // Interpolated player feet position for smooth rendering at any refresh rate.
    const fx = MathUtils.lerp(p.prevPos.x, p.pos.x, alpha);
    const fy = MathUtils.lerp(p.prevPos.y, p.pos.y, alpha) - FOOT_OFFSET;
    const fz = MathUtils.lerp(p.prevPos.z, p.pos.z, alpha);

    if (!this.initialised) {
      this.pivot.set(fx, fy + c.height, fz);
      this.pivotY = fy;
      this.yaw = p.facing;
      this.armLength = c.distance;
      this.lookAhead.set(0, 0, 0);
      this.initialised = true;
    }

    // Auto-recenter behind the movement direction when the mouse is idle.
    const idle = this.mouseIdle;
    const speed = p.horizontalSpeed;
    if (c.autoRecenter && idle > c.recenterDelay && speed > 2 && (p.mode === 'ground' || p.mode === 'air' || p.mode === 'slide')) {
      const moveYaw = Math.atan2(p.vel.x, p.vel.z);
      const d = angleDiff(this.yaw, moveYaw);
      // Don't swing round when running towards the camera; only ease in sideways motion.
      if (Math.abs(d) < 2.2) {
        const strength = c.recenterSpeed * Math.min(1, speed / 6) * Math.min(1, (idle - c.recenterDelay) * 2);
        this.yaw += d * (1 - Math.exp(-strength * dt));
      }
    }

    // Vertical pivot: track the ground height, not the jump arc.
    const grounded = p.mode === 'ground' || p.mode === 'climb' || p.mode === 'hang';
    if (grounded || fy < this.pivotY - 0.5) {
      this.pivotY = MathUtils.damp(this.pivotY, fy, grounded ? c.verticalSharpness : c.verticalSharpness * 2, dt);
    } else if (fy > this.pivotY + 1.6) {
      // Launched above a normal jump (bounce pads, lifts): keep the player in frame.
      this.pivotY = MathUtils.damp(this.pivotY, fy - 1.0, c.verticalSharpness * 3, dt);
    }

    // Look ahead a little in the running direction.
    const la = c.lookAhead;
    this.lookAhead.x = MathUtils.damp(this.lookAhead.x, p.vel.x * la, 3, dt);
    this.lookAhead.z = MathUtils.damp(this.lookAhead.z, p.vel.z * la, 3, dt);

    const targetX = fx + this.lookAhead.x;
    const targetZ = fz + this.lookAhead.z;
    this.pivot.x = MathUtils.damp(this.pivot.x, targetX, c.followSharpness, dt);
    this.pivot.z = MathUtils.damp(this.pivot.z, targetZ, c.followSharpness, dt);
    this.pivot.y = this.pivotY + c.height;
    // Over-the-shoulder: shift the look point right so the student doesn't cover the crosshair.
    const shoulderPivot = this.pivot.clone();
    shoulderPivot.x += -Math.cos(this.yaw) * c.shoulder;
    shoulderPivot.z += Math.sin(this.yaw) * c.shoulder;

    // The pivot itself must not be inside geometry (e.g. hanging under a low ceiling).
    const safePivot = new Vector3(fx, fy + FOOT_OFFSET + 0.3, fz);
    const pivotFree = this.physics.sphereSweep(safePivot, shoulderPivot, CAM_RADIUS, (col) => this.blocksCamera(col));
    const pivot = new Vector3().lerpVectors(safePivot, shoulderPivot, Math.max(0, pivotFree - 0.02));

    // Spring arm. Looking up pulls the camera in so it doesn't dig into the floor.
    const cp = Math.cos(this.pitch);
    const dir = new Vector3(-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    const upLook = Math.max(0, this.pitch) / Math.max(0.01, c.maxPitch);
    const wanted = c.distance * (1 - 0.35 * upLook);
    const desired = pivot.clone().addScaledVector(dir, wanted);
    const free = this.physics.sphereSweep(pivot, desired, CAM_RADIUS, (col) => this.blocksCamera(col));
    const allowed = Math.max(0.4, wanted * free - 0.05);
    if (allowed < this.armLength) this.armLength = allowed;
    else this.armLength = MathUtils.damp(this.armLength, allowed, 3, dt);

    this.camera.position.copy(pivot).addScaledVector(dir, this.armLength);
    this.camera.lookAt(pivot);

    // A slight FOV ease when moving fast sells speed.
    this.speedFov = MathUtils.damp(this.speedFov, Math.min(1, speed / 6.5), 4, dt);
    const fov = c.baseFov + c.speedFov * this.speedFov;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
