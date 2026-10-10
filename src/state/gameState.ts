import { Vector3 } from 'three';
import type { SpellId } from '../data/spells';
import { SWEETS, type SweetKind } from '../data/sweets';
import type { EventBus } from '../engine/events';

/**
 * Progress and player stats. Everything here will be persisted once saving
 * lands (M2), so keep it plain data plus small helpers.
 */
export class GameState {
  maxStamina = 5;
  stamina = 5;
  sweets = 0;
  readonly sweetCounts: Record<SweetKind, number> = { fizzwort: 0, bramble: 0, humbug: 0 };
  readonly known = new Set<SpellId>();
  checkpoint: { pos: Vector3; yaw: number } | null = null;

  constructor(private events: EventBus) {}

  knows(spell: SpellId): boolean {
    return this.known.has(spell);
  }

  learn(spell: SpellId): void {
    this.known.add(spell);
  }

  collectSweet(kind: SweetKind, pos: Vector3): void {
    const def = SWEETS[kind];
    this.sweets += def.value;
    this.sweetCounts[kind]++;
    this.events.emit('sweet', { kind, value: def.value, pos });
  }

  setCheckpoint(pos: Vector3, yaw: number): void {
    this.checkpoint = { pos: pos.clone(), yaw };
    this.events.emit('checkpoint', { pos: pos.clone() });
  }
}
