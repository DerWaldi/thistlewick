import type { LevelDef } from '../../world/level';
import { ASHCOMBE } from './ashcombe';
import { CLASSROOM } from './classroom';
import { GLASSHOUSE } from './glasshouse';
import { GROUNDS } from './grounds';
import { GYM } from './gym';
import { HOPGOOD } from './hopgood';
import { CATACOMBS } from './catacombs';
import { CISTERNS } from './cisterns';
import { CLOCKTOWER } from './clocktower';
import { CLOCKWORKS } from './clockworks';
import { COLDHARBOUR } from './coldharbour';
import { HUB } from './hub';
import { LAMPLOUGH } from './lamplough';
import { QUINCE } from './quince';
import { TOWER } from './tower';
import { TRIAL } from './trial';
import { UNDERBOUGH } from './underbough';
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
  ashcombe: ASHCOMBE,
  glasshouse: GLASSHOUSE,
  grounds: GROUNDS,
  coldharbour: COLDHARBOUR,
  cisterns: CISTERNS,
  clocktower: CLOCKTOWER,
  underbough: UNDERBOUGH,
  clockworks: CLOCKWORKS,
};
