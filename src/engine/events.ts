import type { Vector3 } from 'three';

/** All game-wide events. Add new events here so emitters and listeners stay type-checked. */
export interface GameEvents {
  jump: { pos: Vector3 };
  land: { pos: Vector3; impact: number };
  bounce: { pos: Vector3; power: number };
  ledgeGrab: { pos: Vector3 };
  ledgeClimb: { pos: Vector3 };
  splash: { pos: Vector3 };
  respawn: { pos: Vector3; reason: 'water' | 'fall' };
  skid: { pos: Vector3 };
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
