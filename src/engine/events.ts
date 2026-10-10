import type { Vector3 } from 'three';
import type { SpellId } from '../data/spells';
import type { HouseId } from '../data/houses';
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
  bellRing: { pos: Vector3 };
  unlock: { pos: Vector3 };
  relock: { pos: Vector3 };
  chestOpen: { pos: Vector3 };
  bridgeMove: { pos: Vector3 };
  vaultOpen: { pos: Vector3 };
  springOn: { pos: Vector3; charged: boolean };
  springOff: { pos: Vector3 };
  lampLit: { pos: Vector3; charged: boolean };
  lampOut: { pos: Vector3 };
  wallFade: { pos: Vector3 };
  burn: { pos: Vector3 };
  brazierFail: { pos: Vector3 };
  gnarlingScared: { pos: Vector3 };
  freeze: { pos: Vector3; charged: boolean };
  thaw: { pos: Vector3 };
  melt: { pos: Vector3 };
  iceCreak: { pos: Vector3 };
  floeSlide: { pos: Vector3 };
  levitate: { pos: Vector3 };
  levitateStop: { pos: Vector3 };
  weedNotice: { pos: Vector3 };
  weedBite: { pos: Vector3 };
  crabShoot: { pos: Vector3 };
  crabHit: { pos: Vector3 };
  crabShatter: { pos: Vector3 };
  snapNotice: { pos: Vector3 };
  snapBite: { pos: Vector3 };
  snapLocked: { pos: Vector3 };
  snapBanished: { pos: Vector3 };
  gnarlingNotice: { pos: Vector3 };
  gnarlingStunned: { pos: Vector3 };
  gnarlingBanished: { pos: Vector3 };
  rattleClang: { pos: Vector3 };
  hexCast: { pos: Vector3 };
  hexHit: { pos: Vector3 };
  bombThrow: { pos: Vector3 };
  bombLand: { pos: Vector3 };
  bombKick: { pos: Vector3 };
  bombBlast: { pos: Vector3 };
  foeBanished: { pos: Vector3 };
  bossRoar: { pos: Vector3 };
  bossHit: { pos: Vector3 };
  bossDown: { pos: Vector3 };
  /** A boss's health bar: shown while `active`. */
  bossHealth: { name: string; hp: number; max: number; active: boolean };
  rattleTopple: { pos: Vector3 };
  rattleCollapse: { pos: Vector3 };
  // progress
  card: { id: string; isNew: boolean };
  secret: { id: string; area: string; found: number; total: number };
  points: { house: HouseId; amount: number; reason: string };
  areaEnter: { id: string; name: string };
  levelLoaded: { id: string };
  learned: { spell: SpellId };
  purchase: { id: string };
  /** A student's errand: accepted, the lost thing found, handed back. */
  quest: { id: string; stage: 'start' | 'found' | 'done' };
  /** The Golden Thistle: the end of the first year (shows the ending). */
  yearComplete: { house: HouseId | null };
  // ui
  toast: { text: string; kind?: 'info' | 'hint' };
  dialogueOpen: { open: boolean };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();
  private unsubs: (() => void)[] | null = null;

  /**
   * @param parent When given, this bus is a *scope*: listeners register on the parent
   * and are all removed by `dispose()` (used for everything that lives in one level).
   */
  constructor(private parent?: EventBus) {
    if (parent) this.unsubs = [];
  }

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    if (this.parent) {
      const off = this.parent.on(type, fn);
      this.unsubs!.push(off);
      return off;
    }
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    if (this.parent) {
      this.parent.emit(type, payload);
      return;
    }
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<GameEvents[K]>)(payload);
  }

  /** A child bus whose listeners can be removed together. */
  scope(): EventBus {
    return new EventBus(this);
  }

  dispose(): void {
    this.unsubs?.forEach((off) => off());
    if (this.unsubs) this.unsubs.length = 0;
  }
}
