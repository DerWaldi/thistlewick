import type { Vector3 } from 'three';

/** A light source that reveals glimmer platforms and unmasks false walls within its radius. */
export interface GlimmerLight {
  readonly pos: Vector3;
  /** Current lit radius (0 while unlit). */
  readonly reach: number;
}

/**
 * The lit places in a level. Wick lamps register here; glimmer blocks and false walls
 * ask whether a point (with some slack for their size) is inside any lit radius.
 */
export class GlimmerField {
  private lights: GlimmerLight[] = [];

  add(light: GlimmerLight): void {
    this.lights.push(light);
  }

  covers(p: Vector3, slack = 0): boolean {
    for (const l of this.lights) if (l.reach > 0 && l.pos.distanceTo(p) <= l.reach + slack) return true;
    return false;
  }
}
