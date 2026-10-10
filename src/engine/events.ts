import type { Vector3 } from 'three';
import type { SpellId } from '../data/spells';
import type { SweetKind } from '../data/sweets';

/** All game-wide events. Add new events here so emitters and listeners stay type-checked. */
export interface GameEvents {
  // movement
  jump: { pos: Vector3 };
  land: { pos: Vector3; impact: number };
  bounce: { pos: Vector3; power: number };
  ledgeGrab: { pos: Vector3 };
  ledgeClimb: { pos: Vector3 };
  splash: { pos: Vector3 };
  respawn: { pos: Vector3; reason: 'water' | 'fall' | 'faint' };
  skid: { pos: Vector3 };
  // casting
  chargeStart: { spell: SpellId };
  cast: { spell: SpellId; charge: number; from: Vector3; to: Vector3 };
  spellHit: { spell: SpellId; charge: number; pos: Vector3 };
  fizzle: { pos: Vector3; reason: 'noTarget' | 'unknownSpell' };
  // health
  hurt: { amount: number; pos: Vector3 };
  faint: { pos: Vector3 };
  // world
  sweet: { kind: SweetKind; value: number; pos: Vector3 };
  checkpoint: { pos: Vector3 };
  signal: { id: string; on: boolean };
  blockSlide: { pos: Vector3 };
  blockStop: { pos: Vector3; fell: boolean };
  gateMove: { pos: Vector3; opening: boolean };
  switchTick: { pos: Vector3 };
  gnarlingNotice: { pos: Vector3 };
  gnarlingStunned: { pos: Vector3 };
  gnarlingBanished: { pos: Vector3 };
  // ui
  toast: { text: string; kind?: 'info' | 'hint' };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) (fn as Handler<GameEvents[K]>)(payload);
  }
}
