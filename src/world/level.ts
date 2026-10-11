import type { SpellId } from '../data/spells';
import type { Mood } from '../engine/music';
import type { LevelBuilder, V3 } from './builder';

export interface AreaDef {
  id: string;
  name: string;
  min: V3;
  max: V3;
  /** Overrides the level's ambience while you're in here (the lights dim as you go underground). */
  ambience?: 'day' | 'dark' | 'dim';
}

export interface SpawnPoint {
  pos: V3;
  yaw: number;
}

/** A level: geometry + entities (via the builder), named spawn points and named areas. */
export interface LevelDef {
  id: string;
  name: string;
  build(b: LevelBuilder): void;
  /** Must include 'default'. */
  spawns: Record<string, SpawnPoint>;
  areas?: AreaDef[];
  /** Spells you have here regardless of progress (sandbox levels). */
  grants?: SpellId[];
  /** Sandbox levels never touch the save. */
  sandbox?: boolean;
  /** 'dark' for places underground: lamps and torches do the lighting (default 'day'). */
  ambience?: 'day' | 'dark' | 'dim';
  /** Background music (default 'hub'). */
  music?: Mood;
  /**
   * Named places kept free for NPCs (students giving quests later): a bench, a fireside, a
   * window seat. Nothing is placed there yet; quests pick a spot by name.
   */
  npcSpots?: Record<string, SpawnPoint>;
  /** Dialogue script id to run on entering, if the flag isn't set yet. */
  intro?: { script: string; unlessFlag: string };
}
