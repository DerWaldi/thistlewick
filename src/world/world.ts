import { Vector3 } from 'three';
import { Pendulum, SkyLift } from '../entities/air';
import { Brazier, Burnable, Dropper } from '../entities/fire';
import { Gnarling } from '../entities/gnarling';
import { Floe, IceSheet, Waterfall } from '../entities/ice';
import { GlimmerBlock, IllusionWall, WickLamp } from '../entities/glimmer';
import { Chest, Drawbridge, Padlock, VaultDoor } from '../entities/locks';
import { Snapcasket } from '../entities/snapcasket';
import { Bookshelf, CardPickup, Door, Hourglasses, Npc, SecretVolume, SortingLantern, Tapestry } from '../entities/hubObjects';
import { SpringPad } from '../entities/springs';
import { Checkpoint, Gate, KnockSwitch, Plate } from '../entities/mechanisms';
import { PushBlock } from '../entities/pushBlock';
import { Teaser } from '../entities/teasers';
import { ThistleStar, Trigger } from '../entities/lessonObjects';
import { Rattlecoat } from '../entities/rattlecoat';
import type { Entity, EntitySpec, EntityType, SpecOf, WorldContext } from '../entities/types';

type Factory<T extends EntityType> = (spec: SpecOf<T>, ctx: WorldContext, id: string) => object | null;

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
  gnarling: (s, c, id) => new Gnarling(s, c, id),
  teaser: (s, c) => new Teaser(s, c),
  card: (s, c) => (c.state.cards.has(s.card) ? null : new CardPickup(s, c)),
  secret: (s, c) => new SecretVolume(s, c),
  tapestry: (s, c) => new Tapestry(s, c),
  bookshelf: (s, c) => new Bookshelf(s, c),
  npc: (s, c) => new Npc(s, c),
  sortingLantern: (s, c) => new SortingLantern(s, c),
  door: (s, c) => new Door(s, c),
  hourglasses: (s, c) => new Hourglasses(s, c),
  springPad: (s, c) => new SpringPad(s, c),
  trigger: (s, c) => new Trigger(s, c),
  star: (s, c) => (c.state.collected.has(s.id) ? null : new ThistleStar(s, c)),
  rattlecoat: (s, c) => {
    // Already beaten on an earlier visit: stays down, and whatever it guarded stays open.
    if (c.state.flags.has(`down:${s.id}`)) {
      c.signals.set(s.id, true);
      return null;
    }
    return new Rattlecoat(s, c);
  },
  padlock: (s, c) => {
    if (s.persist && c.state.flags.has(`unlocked:${s.id}`)) {
      c.signals.set(s.id, true);
      return null;
    }
    return new Padlock(s, c);
  },
  chest: (s, c) => new Chest(s, c),
  drawbridge: (s, c) => new Drawbridge(s, c),
  vaultDoor: (s, c) => new VaultDoor(s, c),
  snapcasket: (s, c) => {
    if (c.state.flags.has(`down:${s.id}`)) {
      c.signals.set(s.id, true);
      return null;
    }
    return new Snapcasket(s, c);
  },
  wickLamp: (s, c) => new WickLamp(s, c),
  glimmerBlock: (s, c) => new GlimmerBlock(s, c),
  illusionWall: (s, c) => new IllusionWall(s, c),
  burnable: (s, c) => {
    if (s.persist && s.id && c.state.flags.has(`burnt:${s.id}`)) {
      c.signals.set(s.id, true);
      return null;
    }
    return new Burnable(s, c);
  },
  brazier: (s, c) => new Brazier(s, c),
  dropper: (s, c) => new Dropper(s, c),
  iceSheet: (s, c) => new IceSheet(s, c),
  waterfall: (s, c) => new Waterfall(s, c),
  floe: (s, c) => new Floe(s, c),
  skyLift: (s, c) => new SkyLift(s, c),
  pendulum: (s, c) => new Pendulum(s, c),
  sweet: (s, c, id) => {
    if (!c.state.collected.has(id)) c.sweets.add(s.kind, new Vector3(...s.pos), id);
    return null;
  },
  sweetLine: (s, c, id) => {
    const a = new Vector3(...s.from);
    const b = new Vector3(...s.to);
    for (let i = 0; i < s.count; i++) {
      const sid = `${id}.${i}`;
      if (!c.state.collected.has(sid)) c.sweets.add(s.kind, a.clone().lerp(b, s.count === 1 ? 0.5 : i / (s.count - 1)), sid);
    }
    return null;
  },
};

/** Owns the live entities of the current level and steps them. */
export class World {
  readonly entities: Entity[] = [];
  private secretAreas = new Map<string, string[]>();

  constructor(readonly ctx: WorldContext) {}

  spawn(spec: EntitySpec, index: number): Entity | null {
    if (spec.requires && !this.ctx.state.knows(spec.requires)) return null;
    if (spec.unless && this.ctx.state.knows(spec.unless)) return null;
    if (spec.type === 'secret') this.secretAreas.set(spec.area, [...(this.secretAreas.get(spec.area) ?? []), spec.id]);
    // Stable ids from build order, so collected pickups stay collected across sessions.
    const id = `${this.ctx.levelId}/${spec.type}${index}`;
    const make = FACTORIES[spec.type] as Factory<typeof spec.type>;
    const e = make(spec as never, this.ctx, id) as Entity | null;
    if (e) this.entities.push(e);
    return e;
  }

  spawnAll(specs: EntitySpec[]): void {
    specs.forEach((s, i) => this.spawn(s, i));
  }

  secretsIn(area: string): { found: number; total: number } {
    const ids = this.secretAreas.get(area) ?? [];
    return { found: ids.filter((id) => this.ctx.state.secrets.has(id)).length, total: ids.length };
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
