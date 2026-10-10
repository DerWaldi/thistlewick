import { Vector3 } from 'three';
import type { HouseId } from '../data/houses';
import type { SpellId } from '../data/spells';
import type { SweetKind } from '../data/sweets';
import type { GameState } from './gameState';

export const SAVE_KEY = 'thistlewick.save.v1';
const VERSION = 1;

/** The persisted shape. Bump VERSION and add a migration when it changes. */
export interface SaveData {
  version: number;
  savedAt: number;
  maxStamina: number;
  sweets: number;
  sweetCounts: Record<SweetKind, number>;
  known: SpellId[];
  checkpoint: { level: string; pos: [number, number, number]; yaw: number } | null;
  house: HouseId | null;
  housePoints: Record<HouseId, number>;
  cards: string[];
  secrets: string[];
  collected: string[];
  flags: string[];
  lessons: string[];
  upgrades: string[];
  level: string;
  playTime: number;
}

const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (d) => ({ ...d, newField: default }),  // example for version 1 -> 2
};

export function serialize(s: GameState): SaveData {
  return {
    version: VERSION,
    savedAt: Date.now(),
    maxStamina: s.maxStamina,
    sweets: s.sweets,
    sweetCounts: { ...s.sweetCounts },
    known: [...s.known],
    checkpoint: s.checkpoint ? { level: s.checkpoint.level, pos: s.checkpoint.pos.toArray() as [number, number, number], yaw: s.checkpoint.yaw } : null,
    house: s.house,
    housePoints: { ...s.housePoints },
    cards: [...s.cards],
    secrets: [...s.secrets],
    collected: [...s.collected],
    flags: [...s.flags],
    lessons: [...s.lessons],
    upgrades: [...s.upgrades],
    level: s.level,
    playTime: s.playTime,
  };
}

export function apply(s: GameState, d: SaveData): void {
  s.maxStamina = d.maxStamina;
  s.stamina = d.maxStamina;
  s.sweets = d.sweets;
  Object.assign(s.sweetCounts, d.sweetCounts);
  d.known.forEach((k) => s.known.add(k));
  s.checkpoint = d.checkpoint ? { level: d.checkpoint.level, pos: new Vector3(...d.checkpoint.pos), yaw: d.checkpoint.yaw } : null;
  s.house = d.house;
  Object.assign(s.housePoints, d.housePoints);
  d.cards.forEach((c) => s.cards.add(c));
  d.secrets.forEach((c) => s.secrets.add(c));
  d.collected.forEach((c) => s.collected.add(c));
  d.flags.forEach((c) => s.flags.add(c));
  d.lessons.forEach((c) => s.lessons.add(c));
  d.upgrades.forEach((c) => s.upgrades.add(c));
  s.level = d.level;
  s.playTime = d.playTime;
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    let d = JSON.parse(raw) as Record<string, unknown>;
    let v = (d.version as number) ?? 0;
    while (v < VERSION && MIGRATIONS[v]) {
      d = MIGRATIONS[v](d);
      v++;
    }
    if (v !== VERSION) return null;
    return d as unknown as SaveData;
  } catch {
    return null;
  }
}

export function writeSave(s: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(s)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
