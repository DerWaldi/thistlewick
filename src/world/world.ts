import { Vector3 } from 'three';
import { Gnarling } from '../entities/gnarling';
import { Checkpoint, Gate, KnockSwitch, Plate } from '../entities/mechanisms';
import { PushBlock } from '../entities/pushBlock';
import { Teaser } from '../entities/teasers';
import type { Entity, EntitySpec, EntityType, SpecOf, WorldContext } from '../entities/types';

type Factory<T extends EntityType> = (spec: SpecOf<T>, ctx: WorldContext) => Entity | null;

/**
 * Maps level data to entity classes. Adding a new kind of object means adding a
 * spec variant in entities/types.ts and one line here.
 */
const FACTORIES: { [T in EntityType]: Factory<T> } = {
  pushBlock: (s, c) => new PushBlock(s, c),
  knockSwitch: (s, c) => new KnockSwitch(s, c),
  plate: (s, c) => new Plate(s, c),
  gate: (s, c) => new Gate(s, c),
  checkpoint: (s, c) => new Checkpoint(s, c),
  gnarling: (s, c) => new Gnarling(s, c),
  teaser: (s, c) => new Teaser(s, c),
  sweet: (s, c) => {
    c.sweets.add(s.kind, new Vector3(...s.pos));
    return null;
  },
  sweetLine: (s, c) => {
    const a = new Vector3(...s.from);
    const b = new Vector3(...s.to);
    for (let i = 0; i < s.count; i++) c.sweets.add(s.kind, a.clone().lerp(b, s.count === 1 ? 0.5 : i / (s.count - 1)));
    return null;
  },
};

/** Owns the live entities of the current level and steps them. */
export class World {
  readonly entities: Entity[] = [];

  constructor(readonly ctx: WorldContext) {}

  spawn(spec: EntitySpec): Entity | null {
    const make = FACTORIES[spec.type] as Factory<typeof spec.type>;
    const e = make(spec as never, this.ctx);
    if (e) this.entities.push(e);
    return e;
  }

  spawnAll(specs: EntitySpec[]): void {
    for (const s of specs) this.spawn(s);
  }

  fixedUpdate(dt: number): void {
    for (const e of this.entities) e.fixedUpdate?.(dt);
    this.ctx.sweets.fixedUpdate(dt);
  }

  lateFixedUpdate(): void {
    for (const e of this.entities) e.lateFixedUpdate?.();
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const e of this.entities) e.frameUpdate?.(dt, alpha);
    this.ctx.sweets.frameUpdate();
  }

  /** Entities of a given class (tests and debugging). */
  ofType<T extends Entity>(cls: abstract new (...args: never[]) => T): T[] {
    return this.entities.filter((e): e is T => e instanceof cls);
  }
}
