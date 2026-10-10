import { Vector3 } from 'three';
import { CARD_BY_ID } from '../data/cards';
import { HOUSE_ORDER, HOUSES, POINTS, type HouseId } from '../data/houses';
import type { SpellId } from '../data/spells';
import { SWEETS, type SweetKind } from '../data/sweets';
import type { EventBus } from '../engine/events';

export interface CheckpointRef {
  level: string;
  pos: Vector3;
  yaw: number;
}

/**
 * Progress and player stats. Everything here is persisted (see save.ts), so keep
 * it plain data plus small helpers that emit the matching events.
 */
export class GameState {
  maxStamina = 5;
  stamina = 5;
  sweets = 0;
  readonly sweetCounts: Record<SweetKind, number> = { fizzwort: 0, bramble: 0, humbug: 0 };
  readonly known = new Set<SpellId>();
  checkpoint: CheckpointRef | null = null;
  house: HouseId | null = null;
  readonly housePoints: Record<HouseId, number> = { bramblecote: 0, mallowmere: 0, nettleby: 0, yarrowdown: 0 };
  readonly cards = new Set<string>();
  readonly secrets = new Set<string>();
  /** Ids of placed pickups already taken (sweets, chests), so they don't come back. */
  readonly collected = new Set<string>();
  readonly flags = new Set<string>();
  readonly lessons = new Set<string>();
  readonly upgrades = new Set<string>();
  /** Level the player is currently in (so Continue resumes there). */
  level = 'hub';
  playTime = 0;

  constructor(private events: EventBus) {}

  knows(spell: SpellId): boolean {
    return this.known.has(spell);
  }

  learn(spell: SpellId): void {
    if (this.known.has(spell)) return;
    this.known.add(spell);
    this.events.emit('learned', { spell });
  }

  collectSweet(kind: SweetKind, pos: Vector3, id?: string): void {
    const def = SWEETS[kind];
    this.sweets += def.value;
    this.sweetCounts[kind]++;
    if (id) this.collected.add(id);
    this.events.emit('sweet', { kind, value: def.value, pos });
  }

  collectCard(id: string): void {
    const isNew = !this.cards.has(id);
    this.cards.add(id);
    this.events.emit('card', { id, isNew });
    if (isNew) {
      const c = CARD_BY_ID.get(id);
      this.events.emit('toast', { text: `New card! #${c?.number} ${c?.name ?? id}`, kind: 'info' });
      this.award(POINTS.card, 'a new card');
    }
  }

  findSecret(id: string, area: string, areaTotal: number, areaFound: () => number): void {
    if (this.secrets.has(id)) return;
    this.secrets.add(id);
    const found = areaFound();
    this.events.emit('secret', { id, area, found, total: areaTotal });
    this.award(POINTS.secret, 'finding a secret');
  }

  setCheckpoint(level: string, pos: Vector3, yaw: number): void {
    this.checkpoint = { level, pos: pos.clone(), yaw };
    this.events.emit('checkpoint', { pos: pos.clone() });
  }

  /**
   * Award house points to the player's house. The other houses aren't idle either:
   * they earn a random share, so the race stays close but your efforts show.
   */
  award(amount: number, reason: string): void {
    if (!this.house) return;
    this.housePoints[this.house] += amount;
    this.events.emit('points', { house: this.house, amount, reason });
    for (const h of HOUSE_ORDER) {
      if (h === this.house) continue;
      this.housePoints[h] += Math.round(amount * (0.25 + Math.random() * 0.6));
    }
  }

  /** Slow background drift of rival points while you play (called every few minutes). */
  rivalsTick(): void {
    for (const h of HOUSE_ORDER) if (h !== this.house) this.housePoints[h] += Math.floor(Math.random() * 4);
  }

  houseColor(): { color: string; trim: string } {
    const h = this.house ? HOUSES[this.house] : null;
    return { color: h?.color ?? '#7a6a5a', trim: h?.trim ?? '#d9c18f' };
  }
}
