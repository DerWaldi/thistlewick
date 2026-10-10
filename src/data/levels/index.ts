import type { LevelDef } from '../../world/level';
import { CLASSROOM } from './classroom';
import { GYM } from './gym';
import { HUB } from './hub';
import { TRIAL } from './trial';

/** Every level by id. */
export const LEVELS: Record<string, LevelDef> = {
  gym: GYM,
  hub: HUB,
  classroom: CLASSROOM,
  trial: TRIAL,
};
