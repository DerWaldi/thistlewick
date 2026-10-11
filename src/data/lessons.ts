import type { SpellId } from './spells';

/** Set when the teacher hears about the Star and hands out the reward: the lesson is really over then. */
export const REWARD_FLAG: Record<SpellId, string> = {
  thwackwort: 'gorse-reward',
  latchkin: 'quince-reward',
  springwell: 'hopgood-reward',
  glimmerwick: 'lamplough-reward',
  cindersnap: 'ashcombe-reward',
  rimewhistle: 'coldharbour-reward',
  thistledown: 'underbough-reward',
};

/**
 * The lessons in the order they're taught: where each one is, and what its trial
 * leaves behind in a save (so a trial can be reset for testing, and a sandbox run
 * in a level knows which spells you'd have by then).
 */
export interface LessonDef {
  spell: SpellId;
  classroom: string;
  trial: string;
  /** The Thistle Star's id (remembered in `collected`). */
  star: string;
  /** Flags the trial sets, exactly or by prefix. */
  flags: string[];
  flagPrefixes: string[];
  /** Ids remembered in `collected` (sweets are `<trial>/...`; chests use their own ids). */
  collectedPrefixes: string[];
}

export const LESSONS: LessonDef[] = [
  {
    spell: 'thwackwort',
    classroom: 'classroom',
    trial: 'trial',
    star: 'trial-star',
    flags: ['trial-entered'],
    flagPrefixes: ['trial-hint-', 'hint-bell-', 'down:rattle', 'looted:trial/'],
    collectedPrefixes: ['trial/'],
  },
  {
    spell: 'latchkin',
    classroom: 'quince',
    trial: 'vault',
    star: 'vault-star',
    flags: ['vault-entered'],
    flagPrefixes: ['vault-hint-', 'down:v-snap', 'looted:vault/'],
    collectedPrefixes: ['vault/', 'v-'],
  },
  {
    spell: 'springwell',
    classroom: 'hopgood',
    trial: 'tower',
    star: 'tower-star',
    flags: ['tower-entered'],
    flagPrefixes: ['tower-hint-', 'down:t-snap', 'looted:tower/'],
    collectedPrefixes: ['tower/'],
  },
  {
    spell: 'glimmerwick',
    classroom: 'lamplough',
    trial: 'catacombs',
    star: 'catacomb-star',
    flags: ['catacombs-entered'],
    flagPrefixes: ['catacomb-hint-', 'down:c-snap', 'looted:catacombs/'],
    collectedPrefixes: ['catacombs/'],
  },
  {
    spell: 'cindersnap',
    classroom: 'ashcombe',
    trial: 'glasshouse',
    star: 'glasshouse-star',
    flags: ['glasshouse-entered'],
    flagPrefixes: ['glasshouse-hint-', 'looted:glasshouse/'],
    collectedPrefixes: ['glasshouse/'],
  },
  {
    spell: 'rimewhistle',
    classroom: 'coldharbour',
    trial: 'cisterns',
    star: 'cistern-star',
    flags: ['cisterns-entered'],
    flagPrefixes: ['cistern-hint-', 'looted:cisterns/'],
    collectedPrefixes: ['cisterns/'],
  },
  {
    spell: 'thistledown',
    classroom: 'underbough',
    trial: 'clockworks',
    star: 'clockworks-star',
    flags: ['clockworks-entered'],
    flagPrefixes: ['clockworks-hint-', 'looted:clockworks/'],
    collectedPrefixes: ['clockworks/'],
  },
];

/** Spells you'd know by the time you reach this level (for sandbox runs). The hub gets them all. */
export function spellsBy(level: string): SpellId[] {
  if (['hub', 'grounds', 'clocktower', 'upper', 'exams', 'woods'].includes(level)) return LESSONS.map((l) => l.spell);
  const i = LESSONS.findIndex((l) => l.classroom === level || l.trial === level);
  return i < 0 ? [] : LESSONS.slice(0, i + 1).map((l) => l.spell);
}

/**
 * Make a finished trial playable again (a dev convenience): the lesson is undone, its
 * Star, sweets, chests and pests come back, its hints replay. Cards and secrets you
 * found stay found, and the teacher's reward isn't given twice.
 */
export function resetTrial(state: { lessons: Set<string>; flags: Set<string>; collected: Set<string> }, spell: string): boolean {
  const l = LESSONS.find((x) => x.spell === spell);
  if (!l) return false;
  state.lessons.delete(l.spell);
  for (const f of [...state.flags]) if (l.flags.includes(f) || l.flagPrefixes.some((p) => f.startsWith(p))) state.flags.delete(f);
  for (const c of [...state.collected]) if (c === l.star || l.collectedPrefixes.some((p) => c.startsWith(p))) state.collected.delete(c);
  return true;
}
