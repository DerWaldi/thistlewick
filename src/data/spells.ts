export type SpellId =
  | 'thwackwort'
  | 'latchkin'
  | 'glimmerwick'
  | 'cindersnap'
  | 'springwell'
  | 'rimewhistle'
  | 'thistledown';

export interface SpellDef {
  id: SpellId;
  name: string;
  /** Lesson / subject that teaches it. */
  subject: string;
  teacher: string;
  /** Bolt and rune colour. */
  color: string;
  /** Hold to charge for a stronger effect. */
  chargeable: boolean;
  blurb: string;
}

/** Every spell in the game. Effects live with the targets that react to them. */
export const SPELLS: Record<SpellId, SpellDef> = {
  thwackwort: {
    id: 'thwackwort',
    name: 'Thwackwort',
    subject: 'Practical Charms',
    teacher: 'Prof. Barnaby Gorse',
    color: '#ff9a3c',
    chargeable: true,
    blurb: 'A good firm shove. Pushes blocks, knocks switches and sends pests tumbling. Hold to charge.',
  },
  latchkin: {
    id: 'latchkin',
    name: 'Latchkin',
    subject: 'Locks & Latches',
    teacher: 'Madam Ottoline Quince',
    color: '#ffd45e',
    chargeable: false,
    blurb: 'Persuades locks that they would rather be open.',
  },
  glimmerwick: {
    id: 'glimmerwick',
    name: 'Glimmerwick',
    subject: 'Illumination',
    teacher: 'Mr. Fennick Lamplough',
    color: '#bfe8ff',
    chargeable: true,
    blurb: 'A lantern-glow that shows what wants to stay hidden.',
  },
  cindersnap: {
    id: 'cindersnap',
    name: 'Cindersnap',
    subject: 'Hearth & Flame',
    teacher: 'Prof. Wilhelmina Ashcombe',
    color: '#ff5a2e',
    chargeable: false,
    blurb: 'A spark that bites through rope, vine and cobweb.',
  },
  springwell: {
    id: 'springwell',
    name: 'Springwell',
    subject: 'Leaps & Bounds',
    teacher: 'Mr. Tobias Hopgood',
    color: '#8ef06a',
    chargeable: true,
    blurb: 'Makes moss, mushrooms and mattresses delightfully bouncy.',
  },
  rimewhistle: {
    id: 'rimewhistle',
    name: 'Rimewhistle',
    subject: 'Frosts & Waters',
    teacher: 'Madam Elspeth Coldharbour',
    color: '#9fe6ff',
    chargeable: true,
    blurb: 'A whistle of winter that turns water into a path.',
  },
  thistledown: {
    id: 'thistledown',
    name: 'Thistledown',
    subject: 'Airs & Graces',
    teacher: 'Prof. Hazel Underbough',
    color: '#f4e9ff',
    chargeable: false,
    blurb: 'Lifts heavy things as if they were seed-fluff.',
  },
};
