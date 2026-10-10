import type { EventBus } from '../engine/events';
import type { GameState } from '../state/gameState';
import type { DialogueLine } from '../ui/dialogue';
import { HOUSE_ORDER, HOUSES, POINTS, SORTING_QUESTIONS, type HouseId } from './houses';

export interface ScriptContext {
  say(lines: DialogueLine[]): Promise<number | null>;
  state: GameState;
  events: EventBus;
  /** Open Crumbleton's Cupboard; resolves when it's closed. */
  openShop(): Promise<void>;
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
    if (state.lessons.has('thwackwort')) {
      await say([
        { speaker: 'wendlebury', text: "A Thistle Star already! Professor Gorse hasn't stopped talking about it. Well, he never stops talking, but now it's about you." },
        { speaker: 'wendlebury', text: 'I hear the Crumbleton twins are opening their Cupboard. Mind your sweets.' },
      ]);
      return;
    }
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

  classroomDoor: async ({ say }) => {
    await say([{ speaker: 'sign', text: '"PRACTICAL CHARMS — Prof. B. Gorse. First-years must be SORTED before class." The door is locked.' }]);
  },

  // ---------------------------------------------------------------- the first lesson

  gorseLesson: async (ctx) => {
    await teachThwackwort(ctx);
  },

  gorse: async (ctx) => {
    const { say, state, events } = ctx;
    if (!state.knows('thwackwort')) {
      await teachThwackwort(ctx);
      return;
    }
    if (!state.flags.has('practice-done')) {
      await say([{ speaker: 'gorse', text: 'Three targets, three good thwacks! Aim, and flick. Hold it if you like a bit of oomph.' }]);
      return;
    }
    if (!state.lessons.has('thwackwort')) {
      await say([{ speaker: 'gorse', text: 'The Trial is through the iron door, there. Push, knock, run, and mind the armour. It sulks.' }]);
      return;
    }
    if (!state.flags.has('gorse-reward')) {
      state.flags.add('gorse-reward');
      await say([
        { speaker: 'gorse', text: "HA! A Thistle Star, first time! I haven't seen a shove like that since my Wand-Toss days." },
        { speaker: 'gorse', text: "Here. Old Agnes Thistlewick, founder of us all. I've had a spare for years. Don't tell the Crumbletons." },
      ]);
      state.collectCard('agnes-thistlewick');
      events.emit('toast', { text: 'Thwackwort now works on the castle, too. Look for things to knock.', kind: 'hint' });
      return;
    }
    await say([{ speaker: 'gorse', text: 'Keep practising! A good Thwackwort opens more doors than a key. Not literally. Well, sometimes literally.' }]);
  },

  practiceDone: async ({ say, state }) => {
    state.flags.add('practice-done');
    await say([
      { speaker: 'gorse', text: 'Splendid! Three for three! You have a natural shove, you know.' },
      { speaker: 'gorse', text: "Now, the Thwackwort Trial. Through the iron door. Push blocks, knock switches, and DON'T dawdle on the timed gates. Bring me back the Thistle Star!" },
    ]);
  },

  lockedTrialDoor: async ({ say }) => {
    await say([{ speaker: 'gorse', text: 'Ah-ah! Practice targets first. All three. I am counting.' }]);
  },

  trialIntro: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: "(Gorse's voice echoes from somewhere above.) Welcome to the Trial! Every room wants a shove of some sort. Knock that switch to begin!" },
    ]);
  },

  trialBlocks: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: '(echoing) The Shoving Room! One block makes a bridge over the water, the other must sit on the plate to hold the gate open.' },
      { speaker: 'gorse', text: "Blocks only go where you shove them, and they don't come back on their own. Get in a muddle? Thwack the BELL by the door." },
    ]);
  },

  trialBell: async ({ say }) => {
    await say([{ speaker: 'gorse', text: '(echoing) Got yourself in a muddle? Give the bell by the door a thwack, and the blocks will trot back home.' }]);
  },

  trialRun: async ({ say }) => {
    await say([{ speaker: 'gorse', text: "(echoing) Knock the switch, then RUN! The gate won't wait. Neither will I. I have a lunch." }]);
  },

  trialGarden: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: "(echoing) The old garden. Gnarlings, I'm afraid, and the Rattlecoat that guards the Star. Plain shoves just bounce off armour. CHARGE it!" },
    ]);
  },

  trialComplete: async ({ say, state }) => {
    if (state.lessons.has('thwackwort')) return;
    state.lessons.add('thwackwort');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Practical Charms');
    await say([{ speaker: 'gorse', text: '(echoing) BRAVO! The Thistle Star! Come back up and see me, there is something in it for you.' }]);
  },

  tansy: async ({ say, state, openShop }) => {
    if (state.lessons.has('thwackwort')) {
      const first = !state.flags.has('shop-visited');
      state.flags.add('shop-visited');
      await say(
        first
          ? [
              { speaker: 'tansy', text: "A Thistle Star! Gorse was shouting about it all the way down the corridor. That means we're OPEN." },
              { speaker: 'moss', text: 'Cards, charms, curiosities. Paid in sweets. All prices final. Mostly.' },
            ]
          : [{ speaker: 'tansy', text: 'Back for more? Excellent. Moss, look busy.' }],
      );
      const before = state.sweets;
      await openShop();
      await say([
        state.sweets < before
          ? { speaker: 'moss', text: 'Pleasure doing business. Mind the step, it bites.' }
          : { speaker: 'tansy', text: 'Just browsing? Come back when your pockets rattle.' },
      ]);
      return;
    }
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

  moss: async (ctx) => {
    if (ctx.state.lessons.has('thwackwort')) return DIALOGUES.tansy(ctx);
    const { say } = ctx;
    await say([{ speaker: 'moss', text: "Psst. The Lantern Hall's got more holes in it than a Gnarling's sock. Tapestries, mostly. Didn't hear it from me." }]);
  },

  hourglasses: async ({ say, state }) => {
    const lines = HOUSE_ORDER.map((h) => `${HOUSES[h].name}: ${state.housePoints[h]}`).join('   ·   ');
    await say([{ speaker: 'sign', text: `HOUSE POINTS — ${lines}` }]);
  },
};

async function teachThwackwort({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'gorse', text: 'Ah! A first-year! Come in, come in. Barnaby Gorse, Practical Charms. Mind the desks, they kick.' },
    { speaker: 'gorse', text: "Today: THWACKWORT. A good firm shove. Point your wand, give it a flick, and things move. Blocks, switches, pests. Not people. Mostly." },
    { speaker: 'gorse', text: "When you aim, you'll see a glowing rune. That's the spell asking to be cast. Click, and off it goes. Hold the click to charge it, for a bigger shove." },
  ]);
  if (!state.knows('thwackwort')) {
    state.learn('thwackwort');
    events.emit('toast', { text: 'You learned Thwackwort!', kind: 'info' });
  }
  await say([{ speaker: 'gorse', text: 'Now then: three targets. Knock all three and I shall be impressed. Go on!' }]);
}
