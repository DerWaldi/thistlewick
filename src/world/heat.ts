import type { Vector3 } from 'three';

/** Something burning (a lit brazier) that Gnarlings won't go near. */
export interface HeatSource {
  readonly pos: Vector3;
  readonly lit: boolean;
}

/** The fires burning in a level; Gnarlings ask it which one (if any) is too close for comfort. */
export class HeatField {
  private sources: HeatSource[] = [];

  add(s: HeatSource): void {
    this.sources.push(s);
  }

  /** The nearest lit fire within `range` of `p` (horizontally), or null. */
  near(p: Vector3, range: number): HeatSource | null {
    let best: HeatSource | null = null;
    let bestD = range;
    for (const s of this.sources) {
      if (!s.lit) continue;
      const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
      if (d < bestD && Math.abs(s.pos.y - p.y) < 3) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }
}
