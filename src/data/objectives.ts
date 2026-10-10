import type { V3 } from '../world/builder';
import type { GameState } from '../state/gameState';
import { SPEAKERS, type SpeakerId } from './characters';
import { QUESTS, questStage } from './quests';
import type { SpellId } from './spells';

/**
 * "What next?": the one goal the story wants from you now, and where to walk for it in
 * each level (a compass in the HUD points at the first waypoint you haven't passed yet).
 */
type P = { x: number; y: number; z: number };

export interface Waypoint {
  pos: V3;
  /** Once this holds for the player's position, the compass moves on to the next waypoint. */
  passed?: (p: P) => boolean;
}

export interface Objective {
  /** Short line for the HUD. */
  title: string;
  /** A sentence of directions, for the pause menu. */
  detail: string;
  /** Waypoints by level. Levels without an entry point the way out towards the castle. */
  route: Record<string, Waypoint[]>;
}

// ---- the castle's ways about (hub)
const intoCorridor: Waypoint = { pos: [13.6, 0, 8], passed: (p) => p.x > 13 };
const intoCourt: Waypoint = { pos: [0, 0, 31.5], passed: (p) => p.z > 30.5 || p.x < -12.6 || p.x > 12.6 };
const upToGallery: Waypoint = { pos: [0, 0, 12.6], passed: (p) => p.y > 3.5 };

/** Where each level's way back towards the Lantern Hall is. */
const WAY_OUT: Record<string, V3> = {
  classroom: [0, 0, 0.05],
  trial: [0, 0, 0.05],
  quince: [0, 0, 0.05],
  vault: [0, 0, 0.05],
  hopgood: [0, 0, 0.05],
  tower: [0, 0, 0.05],
  lamplough: [0, 0, 0.05],
  catacombs: [0, 0, 0.05],
  ashcombe: [0, 0, 0.05],
  glasshouse: [0, 0, 0.05],
  coldharbour: [0, 0, 0.05],
  cisterns: [0, 0, 0.05],
  underbough: [0, 0, 0.05],
  clockworks: [0, 0, 0.05],
  clocktower: [0, 0, 0.05],
  grounds: [0, 0, -0.05],
  upper: [0, 0, 0.05],
  exams: [0, 0, -0.45],
  woods: [0, 0, 0.05],
};

interface LessonRoute {
  spell: SpellId;
  teacher: SpeakerId;
  subject: string;
  classroom: string;
  trial: string;
  /** Teacher, trial door (in the classroom), Star and the trial's way back up. */
  teacherPos: V3;
  trialDoor: V3;
  star: V3;
  exit: V3;
  practiceFlag: string;
  rewardFlag: string;
  /** How to get to the classroom door from the hub (and other castle levels on the way). */
  way: (state: GameState) => { text: string; route: Record<string, Waypoint[]> };
  practice: string;
}

const UP = 3.2; // the Cisterns' upper floor
const RISE = 3.6; // the Clock Tower's flights

const ROUTES: LessonRoute[] = [
  {
    spell: 'thwackwort',
    teacher: 'gorse',
    subject: 'Practical Charms',
    classroom: 'classroom',
    trial: 'trial',
    teacherPos: [0, 0, 11.6],
    trialDoor: [8, 0, 11.2],
    star: [0, 1.9, 141.2],
    exit: [0, 0, 143.95],
    practiceFlag: 'practice-done',
    rewardFlag: 'gorse-reward',
    practice: 'Knock all three practice targets with Thwackwort.',
    way: () => ({
      text: 'Through the east arch of the Lantern Hall and along the Crooked Corridor, up the stairs at its end.',
      route: { hub: [intoCorridor, { pos: [42, 3, 20.5] }] },
    }),
  },
  {
    spell: 'latchkin',
    teacher: 'quince',
    subject: 'Locks & Latches',
    classroom: 'quince',
    trial: 'vault',
    teacherPos: [0, 0, 12.2],
    trialDoor: [7, 0, 11.2],
    star: [0, 1.9, 158.5],
    exit: [0, 0, 161.45],
    practiceFlag: 'practice-latchkin',
    rewardFlag: 'quince-reward',
    practice: 'Open all three practice padlocks with Latchkin.',
    way: (s) =>
      s.flags.has('on:hub-portcullis')
        ? { text: 'Up the Crooked Corridor stairs, through the portcullis and along the Long Gallery to its far end.', route: { hub: [intoCorridor, { pos: [38.5, 3, 52] }] } }
        : {
            text: 'The Long Gallery portcullis is down: Thwackwort its winch, by the top of the Crooked Corridor stairs.',
            route: { hub: [intoCorridor, { pos: [35.6, 4.7, 22.95] }] },
          },
  },
  {
    spell: 'springwell',
    teacher: 'hopgood',
    subject: 'Leaps & Bounds',
    classroom: 'hopgood',
    trial: 'tower',
    teacherPos: [-3, 0, 4.5],
    trialDoor: [8, 0, 3],
    star: [63, 57.4, 10.4],
    exit: [63, 56, 12.9],
    practiceFlag: 'practice-springwell',
    rewardFlag: 'hopgood-reward',
    practice: 'Spring all three practice pads and bounce onto their platforms. The tall one needs a charged cast.',
    way: (s) => ({
      text: s.flags.has('unlocked:hub-hopgood-lock')
        ? "In Hollyhock Court's west cloister."
        : "In Hollyhock Court's west cloister. Somebody has padlocked the door: you know a spell for that.",
      route: { hub: [intoCourt, { pos: [-15.6, 0, 40] }] },
    }),
  },
  {
    spell: 'glimmerwick',
    teacher: 'lamplough',
    subject: 'Illumination',
    classroom: 'lamplough',
    trial: 'catacombs',
    teacherPos: [-1.5, 0, 14.2],
    trialDoor: [9, 0, 15],
    star: [0, 1.9, 135],
    exit: [0, 0, 137.95],
    practiceFlag: 'practice-glimmerwick',
    rewardFlag: 'lamplough-reward',
    practice: 'Light the three practice lamps and cross on what they show.',
    way: () => ({
      text: 'Down the spiral stair behind the little door by the Lantern Hall\'s front doors, to the end of the Undercroft.',
      route: { hub: [{ pos: [13.2, 0, 2.5], passed: (p) => p.y < -1 || p.x > 13.6 }, { pos: [33.1, -8.5, 2.5] }] },
    }),
  },
  {
    spell: 'cindersnap',
    teacher: 'ashcombe',
    subject: 'Hearth & Flame',
    classroom: 'ashcombe',
    trial: 'glasshouse',
    teacherPos: [0, 0, 8.5],
    trialDoor: [10, 0, 17.5],
    star: [0, 1.9, 141.3],
    exit: [0, 0, 144.3],
    practiceFlag: 'practice-cindersnap',
    rewardFlag: 'ashcombe-reward',
    practice: 'Burn the cobweb, drop the crate and light the braziers in order.',
    way: () => ({
      text: "The kitchens: through the corner behind Hollyhock Court's west cloister, into the Kitchen Yard.",
      route: { hub: [intoCourt, { pos: [-15.5, 0, 28.4], passed: (p) => p.x < -18.6 }, { pos: [-32, 0, 25] }] },
    }),
  },
  {
    spell: 'rimewhistle',
    teacher: 'coldharbour',
    subject: 'Frosts & Waters',
    classroom: 'coldharbour',
    trial: 'cisterns',
    teacherPos: [0, 0, 8],
    trialDoor: [10, 0, 3],
    star: [0, UP + 1.9, 139.3],
    exit: [0, UP, 142.25],
    practiceFlag: 'practice-rimewhistle',
    rewardFlag: 'coldharbour-reward',
    practice: 'Freeze the pool, climb the frozen falls and reach the dock with a charged freeze.',
    way: () => ({
      text: "Out through the Lantern Hall's great doors, down across the lawn to the boathouse on the lake's west shore.",
      route: { hub: [{ pos: [0, 0, 0.6] }], grounds: [{ pos: [-29.8, -3, -41] }] },
    }),
  },
  {
    spell: 'thistledown',
    teacher: 'underbough',
    subject: 'Airs & Graces',
    classroom: 'underbough',
    trial: 'clockworks',
    teacherPos: [0, 0, 7],
    trialDoor: [9.95, 0, 10],
    star: [0, 29.9, 109.3],
    exit: [0, 28, 112.25],
    practiceFlag: 'practice-thistledown',
    rewardFlag: 'underbough-reward',
    practice: 'Float the crate, ride the platform over the light-well and call the basket down from the chimney.',
    way: () => ({
      text: "The Clock Tower door in the middle of Hollyhock Court's north wall, then all the way up.",
      route: { hub: [intoCourt, { pos: [0, 0, 61.95] }], clocktower: [{ pos: [-8, 7 * RISE, 2] }] },
    }),
  },
];

const name = (who: SpeakerId) => SPEAKERS[who].name;

export function currentObjective(s: GameState): Objective {
  if (!s.house) {
    return {
      title: 'Talk to the Sorting Lantern',
      detail: 'The Sorting Lantern mutters on its lectern by the hourglasses in the Lantern Hall. It will choose your house.',
      route: { hub: [{ pos: [-6.5, 1.2, 9] }] },
    };
  }
  for (const [i, l] of ROUTES.entries()) {
    const learned = s.knows(l.spell);
    const done = s.lessons.has(l.spell);
    if (done && s.flags.has(l.rewardFlag)) continue;
    if (done) {
      return {
        title: `Report back to ${name(l.teacher)}`,
        detail: `You have the Thistle Star from the ${l.subject} trial. ${name(l.teacher)} will want to hear all about it.`,
        route: { [l.trial]: [{ pos: l.exit }], [l.classroom]: [{ pos: l.teacherPos }], ...l.way(s).route },
      };
    }
    if (learned && s.flags.has(l.practiceFlag)) {
      return {
        title: `The ${l.subject} trial: find the Thistle Star`,
        detail: `Through the iron door in ${name(l.teacher)}'s classroom. The Thistle Star waits at the far end.`,
        route: { [l.classroom]: [{ pos: l.trialDoor }], [l.trial]: [{ pos: l.star }] },
      };
    }
    if (learned) {
      return { title: `${l.subject}: practice`, detail: l.practice, route: { [l.classroom]: [{ pos: l.teacherPos }] } };
    }
    const way = l.way(s);
    const first = i === 0;
    return {
      title: `${l.subject} with ${name(l.teacher)}`,
      detail: `${first ? 'Your first lesson. ' : ''}${way.text}`,
      route: { ...way.route, [l.classroom]: [{ pos: l.teacherPos }] },
    };
  }
  if (!s.flags.has('year-complete')) {
    return {
      title: 'The Final Examinations',
      detail: 'Up the grand stair to the Lantern Hall gallery, through the door to the First Floor, and along the Long Hall: the iron door beside the stair to the roof.',
      route: {
        hub: [upToGallery, { pos: [11.95, 5, 25.5] }],
        upper: [{ pos: [4.55, 0, 49] }],
        exams: [{ pos: [0, 2.6, 202] }],
      },
    };
  }
  // The story's done: point at whatever errand is waiting.
  for (const q of QUESTS) {
    const stage = questStage(s, q);
    if (stage === 'found') {
      return { title: `Take it back to ${name(q.giver)}`, detail: q.goal, route: {} };
    }
  }
  for (const q of QUESTS) {
    if (questStage(s, q) === 'active') return { title: q.title, detail: q.goal, route: {} };
  }
  return {
    title: 'Explore Thistlewick',
    detail: 'Cards to collect, secrets to find, students who need a hand. The castle is yours.',
    route: {},
  };
}

/** The point the compass should aim at in this level, or null. */
export function compassTarget(o: Objective, level: string, p: P, story: boolean): V3 | null {
  const route = o.route[level];
  if (!route) return story && Object.keys(o.route).length ? (WAY_OUT[level] ?? null) : null;
  for (const w of route) if (!w.passed?.(p)) return w.pos;
  return route[route.length - 1]?.pos ?? null;
}
