import type { LevelDef } from '../../world/level';
import { CLASSROOM } from './classroom';
import { GYM } from './gym';
import { HOPGOOD } from './hopgood';
import { CATACOMBS } from './catacombs';
import { HUB } from './hub';
import { LAMPLOUGH } from './lamplough';
import { QUINCE } from './quince';
import { TOWER } from './tower';
import { TRIAL } from './trial';
import { VAULT } from './vault';

/** Every level by id. */
export const LEVELS: Record<string, LevelDef> = {
  gym: GYM,
  hub: HUB,
  classroom: CLASSROOM,
  trial: TRIAL,
  quince: QUINCE,
  vault: VAULT,
  hopgood: HOPGOOD,
  tower: TOWER,
  lamplough: LAMPLOUGH,
  catacombs: CATACOMBS,
};
