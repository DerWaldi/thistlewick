import type { LevelDef } from '../../world/level';
import { GYM } from './gym';
import { HUB } from './hub';

/** Every level by id. */
export const LEVELS: Record<string, LevelDef> = {
  gym: GYM,
  hub: HUB,
};
