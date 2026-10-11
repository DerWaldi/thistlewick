import type { EntitySpec, NpcLook } from '../entities/types';
import type { GameState } from '../state/gameState';
import type { V3 } from '../world/builder';
import type { LevelDef } from '../world/level';
import type { SpeakerId } from './characters';
import { HOUSES } from './houses';

/**
 * Fellow pupils going about their day in the castle: each walks a loop and has a few things
 * to say, mostly useful, picked from what you've done so far. They make the place feel
 * lived in, and they're a gentle second line of hints.
 */
export interface StudentDef {
  speaker: SpeakerId;
  look: NpcLook;
  level: string;
  path: V3[];
  /** What they might say, given your progress (they take turns through the list). */
  lines: (s: GameState) => string[];
}

const robe = '#2c2a3a';
const scarf = (h: keyof typeof HOUSES) => ({ robe, scarf: HOUSES[h].color, trim: HOUSES[h].trim, scale: 0.94 });

export const STUDENTS: StudentDef[] = [
  {
    speaker: 'rowan',
    look: { ...scarf('bramblecote'), hair: '#2a1e18', hairStyle: 'wild', hatStyle: 'none', skin: '#d9a07a', expression: 'cheeky' },
    level: 'hub',
    // Along the Lantern Hall gallery.
    path: [
      [-9, 5, 25.5],
      [6, 5, 25.5],
      [6, 5, 28],
      [-9, 5, 28],
    ],
    lines: (s) => [
      'Gorse once thwacked a door so hard it opened the room next door as well.',
      'Hold the button to charge a spell. Everything is better charged. Except soup.',
      ...(s.knows('thwackwort') ? ["Sootlings! If one of their bombs lands by you, thwack it back. Right into their laps."] : []),
      ...(s.knows('latchkin') ? ['Hexlings fly too high to hit? Back off a bit, so you can see them. Then knock them down and thwack them again before they get up.'] : []),
      ...(s.flags.has('year-complete') ? ['You beat the Brass Examiner? My brother says it chased him round the hall for an hour. He still twitches at the sound of brass.'] : []),
    ],
  },
  {
    speaker: 'bess',
    look: { ...scarf('yarrowdown'), hair: '#e8c060', hairStyle: 'bun', hatStyle: 'none' },
    level: 'hub',
    // The court's south walk, along the cloister.
    path: [
      [-10, 0, 34.6],
      [10, 0, 34.6],
    ],
    lines: (s) => [
      "Lost? The little gold arrow up in the corner always knows where you're meant to be.",
      'Esc shows your timetable and all the errands you said yes to.',
      'Some of the others need a hand. Look for a gold ! over their heads.',
      ...(s.lessons.size >= 2 ? ['Every trial has a nasty last room now. The professors had a meeting about it. A long one.'] : []),
      ...(s.knows('springwell') ? ['If a bounce pad feels too short, hold jump as you land. Or charge the pad. Or both, if you like heights.'] : []),
    ],
  },
  {
    speaker: 'fitz',
    look: { ...scarf('mallowmere'), hair: '#1e1612', hairStyle: 'tufts', hatStyle: 'none', glasses: true, skin: '#8a5a3e' },
    level: 'hub',
    // Up and down the west cloister.
    path: [
      [15.3, 0, 35],
      [15.3, 0, 49],
      [15.3, 0, 57],
      [15.3, 0, 49],
    ],
    lines: (s) => [
      "I'm reading ahead. Chapter twelve is all about spells that haven't been invented yet. It's very short.",
      ...(s.knows('glimmerwick') ? ["Lamps don't stay lit. Look where you're going BEFORE you light them, not after."] : []),
      ...(s.knows('cindersnap') ? ['Snapweeds bite everything near them. Even Gnarlings. Especially Gnarlings. Lure one over, if you are feeling wicked.'] : []),
      ...(s.knows('rimewhistle') ? ['A tapped freeze melts in a blink. Hold the button for proper ice, the kind you can trust.'] : []),
      'The clock in the court has a walkway behind it. Nobody knows who built it, or why it leads nowhere much.',
    ],
  },
  {
    speaker: 'nell',
    look: { ...scarf('nettleby'), hair: '#8a3a22', hairStyle: 'long', hatStyle: 'none' },
    level: 'upper',
    // Down the Long Hall's carpet.
    path: [
      [0.8, 0, 6],
      [0.8, 0, 22],
      [-0.8, 0, 38],
      [-0.8, 0, 22],
    ],
    lines: (s) => [
      'The roof is out of bounds. Which is exactly why everyone goes up there.',
      'Our common room only opens for us. Yours only opens for you. The doors are very particular.',
      ...(s.knows('springwell') ? ["The library's top shelves have a ledge on them. Oswin keeps throwing books up there. Don't ask."] : []),
      ...(s.lessons.size >= 7 && !s.flags.has('year-complete') ? ['The Examination Hall is open! The great iron door at the top of the grand stair. I heard there is something made of brass in there. Something big.'] : []),
    ],
  },
  {
    speaker: 'tam',
    look: { ...scarf('mallowmere'), hair: '#d8b880', hairStyle: 'tufts', hatStyle: 'cap', hat: '#4f7fb8' },
    level: 'grounds',
    // Down the lawn path to the statue and back.
    path: [
      [0.8, -3, -17.5],
      [0.8, -3, -30],
    ],
    lines: (s) => [
      'Fairweather Lake is nicer frozen. Less wet.',
      "The Old Woods? Nobody goes in there. Except Mabel, when her hedgehog's gone walkabout. Which is always.",
      ...(s.knows('rimewhistle') ? ['Old Ned keeps losing his fishing float over by the reeds. West end of the lake.'] : []),
    ],
  },
];

/** Wanderer specs for the pupils who walk about in this level. */
export function wanderers(def: LevelDef): EntitySpec[] {
  return STUDENTS.filter((st) => st.level === def.id).map((st) => ({ type: 'wanderer' as const, speaker: st.speaker, look: st.look, path: st.path, talk: `chat-${st.speaker}` }));
}
