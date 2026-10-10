import type { EventBus } from '../engine/events';

/**
 * Named on/off wires between level objects: switches and plates drive them,
 * gates and platforms listen. Levels connect things purely by id.
 */
export class Signals {
  private values = new Map<string, boolean>();
  private listeners = new Map<string, Set<() => void>>();

  constructor(private events: EventBus) {}

  get(id: string): boolean {
    return this.values.get(id) ?? false;
  }

  all(ids: string[]): boolean {
    return ids.every((id) => this.get(id));
  }

  set(id: string, on: boolean): void {
    if (this.get(id) === on) return;
    this.values.set(id, on);
    this.events.emit('signal', { id, on });
    this.listeners.get(id)?.forEach((fn) => fn());
  }

  onChange(ids: string[], fn: () => void): void {
    for (const id of ids) {
      let set = this.listeners.get(id);
      if (!set) this.listeners.set(id, (set = new Set()));
      set.add(fn);
    }
  }
}
