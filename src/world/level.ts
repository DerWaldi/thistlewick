import type { SpellId } from '../data/spells';
import type { LevelBuilder, V3 } from './builder';

export interface AreaDef {
  id: string;
  name: string;
  min: V3;
  max: V3;
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
  /** Dialogue script id to run on entering, if the flag isn't set yet. */
  intro?: { script: string; unlessFlag: string };
}
