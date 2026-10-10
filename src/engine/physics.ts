import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';

export type Surface = 'default' | 'ice';

/** Gameplay metadata attached to a collider (Rapier colliders have no userData in JS). */
export interface ColliderInfo {
  surface?: Surface;
  /** Landing on this collider launches the player. */
  bounce?: { scale: number; onBounce?: () => void; /** Sideways launch velocity (angled toadstools). */ fling?: Vector3 };
  /** Set for colliders on moving (kinematic) bodies; the player is carried by `delta`. */
  mover?: { delta: Vector3 };
  /** Camera spring arm ignores this collider (small props, foliage). */
  cameraIgnore?: boolean;
  /** Ledges on this collider can't be grabbed. */
  noGrab?: boolean;
  /** Spells see (and fly) through it: grilles and bars that block bodies but not sight. */
  seeThrough?: boolean;
}

export class Physics {
  readonly world: RAPIER.World;
  private info = new Map<number, ColliderInfo>();

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 });
    this.world.timestep = 1 / 60;
  }

  step(): void {
    this.world.step();
  }

  setInfo(c: RAPIER.Collider, info: ColliderInfo): void {
    this.info.set(c.handle, info);
  }

  getInfo(c: RAPIER.Collider | null | undefined): ColliderInfo | undefined {
    return c ? this.info.get(c.handle) : undefined;
  }

  addStaticBox(center: Vector3, halfExtents: Vector3, rotation?: Quaternion, info?: ColliderInfo): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setTranslation(
      center.x,
      center.y,
      center.z,
    );
    if (rotation) desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    const c = this.world.createCollider(desc);
    if (info) this.setInfo(c, info);
    return c;
  }

  addStaticCylinder(center: Vector3, halfHeight: number, radius: number, info?: ColliderInfo): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(center.x, center.y, center.z);
    const c = this.world.createCollider(desc);
    if (info) this.setInfo(c, info);
    return c;
  }

  /** Raycast that ignores sensors and an optional collider. Returns hit point, normal and collider. */
  raycast(
    origin: Vector3,
    dir: Vector3,
    maxDist: number,
    exclude?: RAPIER.Collider,
    predicate?: (c: RAPIER.Collider) => boolean,
  ): { point: Vector3; normal: Vector3; distance: number; collider: RAPIER.Collider } | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDist,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      exclude,
      undefined,
      predicate,
    );
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      point: new Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t),
      normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: t,
      collider: hit.collider,
    };
  }

  /** Sweeps a ball from `from` towards `to`; returns the free fraction (0..1) of the path. */
  sphereSweep(from: Vector3, to: Vector3, radius: number, predicate?: (c: RAPIER.Collider) => boolean): number {
    const dir = new Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 1e-5) return 1;
    const hit = this.world.castShape(
      from,
      { x: 0, y: 0, z: 0, w: 1 },
      dir,
      new RAPIER.Ball(radius),
      0,
      1,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      predicate,
    );
    return hit ? hit.time_of_impact : 1;
  }

  /**
   * Sweeps an upright capsule from `from` by `delta`; returns the free fraction (0..1)
   * and the hit normal (pointing out of the obstacle), if any.
   */
  capsuleSweep(
    from: Vector3,
    delta: Vector3,
    halfHeight: number,
    radius: number,
    exclude?: RAPIER.Collider,
  ): { fraction: number; normal: Vector3 | null } {
    if (delta.lengthSq() < 1e-10) return { fraction: 1, normal: null };
    const hit = this.world.castShape(
      from,
      { x: 0, y: 0, z: 0, w: 1 },
      delta,
      new RAPIER.Capsule(halfHeight, radius),
      0,
      1,
      false,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      exclude,
    );
    if (!hit) return { fraction: 1, normal: null };
    // normal2 is in the hit collider's local frame; rotate to world.
    const r = hit.collider.rotation();
    const n = new Vector3(hit.normal2.x, hit.normal2.y, hit.normal2.z).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
    return { fraction: hit.time_of_impact, normal: n };
  }

  /** True if a capsule at `center` overlaps any solid collider (excluding `exclude`). */
  capsuleBlocked(center: Vector3, halfHeight: number, radius: number, exclude?: RAPIER.Collider): boolean {
    const hit = this.world.intersectionWithShape(
      center,
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Capsule(halfHeight, radius),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      exclude,
    );
    return hit !== null;
  }

  pointInsideSolid(p: Vector3, exclude?: RAPIER.Collider): boolean {
    let inside = false;
    this.world.intersectionsWithPoint(
      p,
      () => {
        inside = true;
        return false;
      },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      exclude,
    );
    return inside;
  }
}
