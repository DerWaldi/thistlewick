import type { EventBus } from '../engine/events';
import type { GameState } from '../state/gameState';
import type { DialogueLine } from '../ui/dialogue';
import { HOUSE_ORDER, HOUSES, SORTING_QUESTIONS, type HouseId } from './houses';

export interface ScriptContext {
  say(lines: DialogueLine[]): Promise<number | null>;
  state: GameState;
  events: EventBus;
}

export type Script = (ctx: ScriptContext) => Promise<void>;

/**
 * All conversations, by id. Scripts can branch on progress and change it (the
 * Sorting Lantern sets your house). Keep the writing short, warm and a bit odd.
 */
export const DIALOGUES: Record<string, Script> = {
  intro: async ({ say }) => {
    await say([
      { speaker: 'wendlebury', text: 'Ah! There you are. Welcome to Thistlewick, dear. Mind the third step, it bites.' },
      { speaker: 'wendlebury', text: "Before anything else, the Sorting Lantern would like a word. It's the one muttering by the hourglasses." },
    ]);
  },

  sorting: async ({ say, state, events }) => {
    if (state.house) {
      const h = HOUSES[state.house];
      await say([{ speaker: 'lantern', text: `Still ${h.name}, still ${h.virtue}. Off you go. Flick, flick.` }]);
      return;
    }
    await say([
      { speaker: 'lantern', text: "Hmm. HmmMMmm. A new one. Come closer, I don't bite. That's the stairs." },
      { speaker: 'lantern', text: 'Three questions, and no peeking at the answers.' },
    ]);
    const tally: Record<HouseId, number> = { bramblecote: 0, mallowmere: 0, nettleby: 0, yarrowdown: 0 };
    for (const q of SORTING_QUESTIONS) {
      const pick = await say([{ speaker: 'lantern', text: q.q, choices: q.answers.map((a) => a.text) }]);
      tally[q.answers[pick ?? 0].house]++;
    }
    const best = Math.max(...Object.values(tally));
    const tied = HOUSE_ORDER.filter((h) => tally[h] === best);
    let house = tied[Math.floor(Math.random() * tied.length)];
    const pick = await say([
      { speaker: 'lantern', text: `I see... ${HOUSES[house].virtue}... yes. Yes! You belong in... ${HOUSES[house].name.toUpperCase()}!` },
      { speaker: 'lantern', text: 'Unless you have strong feelings about it?', choices: ["That's perfect.", ...HOUSE_ORDER.filter((h) => h !== house).map((h) => `Actually... could I be in ${HOUSES[h].name}?`)] },
    ]);
    if (pick && pick > 0) {
      house = HOUSE_ORDER.filter((h) => h !== house)[pick - 1];
      await say([{ speaker: 'lantern', text: `${HOUSES[house].name}, then! Lanterns can be wrong. Rarely. Once, in 1803.` }]);
    }
    state.house = house;
    state.flags.add('sorted');
    events.emit('toast', { text: `You joined ${HOUSES[house].name}!`, kind: 'info' });
    await say([
      { speaker: 'lantern', text: `Win points for ${HOUSES[house].name} by finding secrets, collecting cards and doing well in lessons. The hourglasses keep score.` },
      { speaker: 'wendlebury', text: "Splendid. Your first lesson is Practical Charms with Professor Gorse, up the Crooked Corridor. Do explore on the way, dear." },
    ]);
  },

  wendlebury: async ({ say, state }) => {
    if (!state.house) {
      await say([{ speaker: 'wendlebury', text: 'The Sorting Lantern first, dear. By the hourglasses. It gets sulky if it is kept waiting.' }]);
      return;
    }
    await say([
      { speaker: 'wendlebury', text: 'Practical Charms is up the Crooked Corridor, through the east arch. Professor Gorse will be along shortly.' },
      { speaker: 'wendlebury', text: 'Until then, do have a wander. Thistlewick rewards the curious. And occasionally bites them.' },
    ]);
  },

  frontDoors: async ({ say }) => {
    await say([{ speaker: 'sign', text: 'The great doors are barred from outside. A note is pinned to them: "FIRST-YEARS STAY IN. — W."' }]);
  },

  classroomDoor: async ({ say, state }) => {
    if (!state.house) {
      await say([{ speaker: 'sign', text: '"PRACTICAL CHARMS — Prof. B. Gorse." The door is locked. Perhaps get sorted first.' }]);
      return;
    }
    await say([{ speaker: 'sign', text: '"PRACTICAL CHARMS — Prof. B. Gorse. Back in a jiffy." The door is locked, and the jiffy seems to be a long one.' }]);
  },

  tansy: async ({ say, state }) => {
    if (!state.knows('thwackwort')) {
      await say([
        { speaker: 'tansy', text: "Crumbleton's Cupboard! Cards, curios, clever charms. Shut, though." },
        { speaker: 'moss', text: "Can't sell to someone who hasn't had a proper lesson. Rules is rules." },
        { speaker: 'tansy', text: 'Our rules. We made them up this morning. Come back after Gorse has had a go at you.' },
      ]);
    } else {
      await say([
        { speaker: 'tansy', text: "Look who's learned to shove things! We're nearly open. Just stocking the shelves." },
        { speaker: 'moss', text: 'Stealing the shelves. Stocking. Same thing.' },
      ]);
    }
  },

  moss: async ({ say }) => {
    await say([{ speaker: 'moss', text: "Psst. The Lantern Hall's got more holes in it than a Gnarling's sock. Tapestries, mostly. Didn't hear it from me." }]);
  },

  hourglasses: async ({ say, state }) => {
    const lines = HOUSE_ORDER.map((h) => `${HOUSES[h].name}: ${state.housePoints[h]}`).join('   ·   ');
    await say([{ speaker: 'sign', text: `HOUSE POINTS — ${lines}` }]);
  },
};
