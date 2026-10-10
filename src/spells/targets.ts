import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vector3 } from 'three';
import type { SpellId } from '../data/spells';
import type { RuneMarker } from './runes';

export interface SpellHit {
  spell: SpellId;
  /** 0 for a tap, up to 1 for a full charge. */
  charge: number;
  /** Where the caster stood. */
  from: Vector3;
  /** Normalised horizontal direction from caster to target. */
  dir: Vector3;
}

/**
 * Anything a spell can be aimed at. Targets are context-sensitive: each one
 * names the single spell it responds to, and casting picks that spell.
 */
export interface SpellTarget {
  readonly spell: SpellId;
  readonly marker: RuneMarker;
  /** How forgiving aiming at this target is (metres around the aim point). */
  readonly radius: number;
  /** Where bolts fly to and where the marker floats near. */
  aimPoint(out: Vector3): Vector3;
  /** Whether this target can currently be cast at (e.g. a switch mid-animation can't). */
  enabled(): boolean;
  /** Line-of-sight rays that hit one of these colliders count as hitting the target. */
  owns(c: RAPIER.Collider): boolean;
  onSpell(hit: SpellHit): void;
}

export class TargetRegistry {
  readonly all = new Set<SpellTarget>();
  add(t: SpellTarget): void {
    this.all.add(t);
  }
  remove(t: SpellTarget): void {
    this.all.delete(t);
    t.marker.state = 'hidden';
  }
}
