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
    if (state.lessons.has('springwell')) {
      await say([
        { speaker: 'wendlebury', text: "Three Thistle Stars, and you came down the Tumbledown Tower the front way. Mr. Hopgood is beside himself. Literally, he's bouncing." },
        { speaker: 'wendlebury', text: 'There is a balcony over Hollyhock Court that nobody has stood on in years. I wonder what is up there.' },
      ]);
      return;
    }
    if (state.lessons.has('latchkin')) {
      await say([
        { speaker: 'wendlebury', text: "Two Thistle Stars! Madam Quince tells me you opened her Great Vault without so much as a hairpin. I'm told she smiled. Nobody has ever seen her smile." },
        { speaker: 'wendlebury', text: "Do have a look round the castle again. Thistlewick is full of things that are locked for no good reason." },
        { speaker: 'wendlebury', text: "Oh, and Mr. Hopgood is waiting for you. Leaps & Bounds, in the Long Gallery. Someone padlocked his door again. I can't think who." },
      ]);
      return;
    }
    if (state.lessons.has('thwackwort')) {
      await say([
        { speaker: 'wendlebury', text: "A Thistle Star already! Professor Gorse hasn't stopped talking about it. Well, he never stops talking, but now it's about you." },
        { speaker: 'wendlebury', text: 'Next, Locks & Latches with Madam Quince, up in the Long Gallery. The portcullis by Practical Charms sticks. Give its winch a firm Thwackwort.' },
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
      await say([{ speaker: 'gorse', text: "Next stop: Locks & Latches, Madam Quince. The Long Gallery, past the portcullis on the landing outside. Thwack the winch, it's always stuck." }]);
      return;
    }
    await say([
      { speaker: 'gorse', text: 'Keep practising! A good Thwackwort opens more doors than a key. Not literally. Well, sometimes literally.' },
      { speaker: 'gorse', text: "Madam Quince is expecting you for Locks & Latches. Long Gallery, past the portcullis outside. Thwack the winch, it's always stuck." },
    ]);
  },

  practiceDone: async ({ say, state }) => {
    state.flags.add('practice-done');
    await say([
      { speaker: 'gorse', text: 'Splendid! Three for three! You have a natural shove, you know.' },
      { speaker: 'gorse', text: "Now, the Thwackwort Trial. Through the iron door. Push blocks, knock switches, and DON'T dawdle on the timed gates. Bring me back the Thistle Star!" },
    ]);
  },

  classNotOver: async ({ say, state }) => {
    const text = state.flags.has('practice-done')
      ? "Not so fast! Class isn't over until you bring me that Thistle Star. The Trial's through the iron door."
      : "Not so fast! Class isn't over. Three practice targets first, then the Trial.";
    await say([{ speaker: 'gorse', text }]);
  },

  lockedTrialDoor: async ({ say, state }) => {
    if (state.lessons.has('thwackwort')) {
      await say([{ speaker: 'gorse', text: "The Trial's done, and the Star is yours! No sense rattling that poor armour twice. It's still sulking." }]);
      return;
    }
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

  // ---------------------------------------------------------------- the second lesson

  quinceLesson: async (ctx) => {
    await teachLatchkin(ctx);
  },

  quince: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('latchkin')) {
      await teachLatchkin(ctx);
      return;
    }
    if (!state.flags.has('practice-latchkin')) {
      await say([{ speaker: 'quince', text: 'Three boxes, three locks. Look at the lock, not the box. Then ask it nicely.' }]);
      return;
    }
    if (!state.lessons.has('latchkin')) {
      await say([{ speaker: 'quince', text: 'The Vaults are behind the iron door. Every lock down there can be opened. The trick is seeing it first.' }]);
      return;
    }
    if (!state.flags.has('quince-reward')) {
      state.flags.add('quince-reward');
      await say([
        { speaker: 'quince', text: 'The Great Vault. Opened. By a first-year. Hm.' },
        { speaker: 'quince', text: "...That was me being impressed. Take this. It's a terribly flattering likeness, I'm told." },
      ]);
      state.collectCard('ottoline-quince');
      await say([
        { speaker: 'quince', text: 'Latchkin works on the castle, too. Old Lockjaw put a lock on everything he could reach. Chests, cabinets, store-rooms. Go and be nosy.' },
      ]);
      return;
    }
    await say([
      { speaker: 'quince', text: 'A locked door is only a question. Latchkin is a very polite answer.' },
      { speaker: 'quince', text: "Mr. Hopgood is next. Leaps & Bounds. I locked his door myself, he kept bouncing into my lessons. You may let him out." },
    ]);
  },

  latchkinPracticeDone: async ({ say, state }) => {
    state.flags.add('practice-latchkin');
    await say([
      { speaker: 'quince', text: 'Three for three. Tidy. I do like tidy.' },
      { speaker: 'quince', text: "Now the Latchkin Vaults, through the iron door. Padlocks hide, some lock themselves again, and some chests BITE. Lock those shut and give them a Thwackwort. Bring me the Thistle Star." },
    ]);
  },

  lockedVaultDoor: async ({ say, state }) => {
    if (state.lessons.has('latchkin')) {
      await say([{ speaker: 'quince', text: 'The Vaults are done with, and so are you. Well done. Shoo.' }]);
      return;
    }
    await say([{ speaker: 'quince', text: 'Practice boxes first. All three. I will know.' }]);
  },

  classNotOverQuince: async ({ say, state }) => {
    const text = state.flags.has('practice-latchkin')
      ? 'Class is not over until the Great Vault is open. The iron door, if you please.'
      : 'Class is not over. Three practice boxes, then the Vaults.';
    await say([{ speaker: 'quince', text }]);
  },

  galleryDoor: async ({ say }) => {
    await say([{ speaker: 'sign', text: '"LOCKS & LATCHES — Madam O. Quince. Knock. Then wait. Then knock again, properly."' }]);
  },

  vaultIntro: async ({ say }) => {
    await say([
      { speaker: 'quince', text: '(echoing) The Latchkin Vaults. Old Lockjaw built them to keep his keys in, and then lost the keys. Typical.' },
      { speaker: 'quince', text: '(echoing) That gate has a padlock on it. Point. Persuade. Proceed.' },
    ]);
  },

  vaultLocks: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The Lockwork Hall. Three padlocks hold that door, and you'll only see one from here." },
      { speaker: 'quince', text: "(echoing) A spell needs to SEE its lock. Climb up for a better look, and peer through anything with holes in it." },
    ]);
  },

  vaultPantry: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The pantry. Some of those chests are chests. Some are Snapcaskets. Look for teeth." },
      { speaker: 'quince', text: "(echoing) Latchkin LOCKS a Snapcasket shut. While it's locked, Thwackwort it. Quickly, they don't stay locked." },
    ]);
  },

  vaultShutters: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The shutters lock themselves again. Open one, look through it for the next lock, and don't dawdle." },
    ]);
  },

  vaultGreat: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The Great Vault. Four locks ride round the wheel. Catch each one as it comes past. And mind the furniture." },
    ]);
  },

  vaultComplete: async ({ say, state }) => {
    if (state.lessons.has('latchkin')) return;
    state.lessons.add('latchkin');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Locks & Latches');
    await say([{ speaker: 'quince', text: '(echoing) The Thistle Star. Well. Come up and see me, please. Promptly.' }]);
  },

  // ---------------------------------------------------------------- the third lesson

  hopgoodDoor: async ({ say, state }) => {
    const text = state.knows('latchkin')
      ? '"LEAPS & BOUNDS — Mr. T. Hopgood." Somebody has padlocked it. Again.'
      : '"LEAPS & BOUNDS — Mr. T. Hopgood." A heavy padlock hangs on it, and something on the other side is going boing.';
    await say([{ speaker: 'sign', text }]);
  },

  hopgoodLesson: async (ctx) => {
    await teachSpringwell(ctx);
  },

  hopgood: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('springwell')) {
      await teachSpringwell(ctx);
      return;
    }
    if (!state.flags.has('practice-springwell')) {
      await say([{ speaker: 'hopgood', text: "Three platforms, three plates! The tall one needs extra oomph: hold jump as you land on the pad, or hold the cast to charge it. Higher, higher!" }]);
      return;
    }
    if (!state.lessons.has('springwell')) {
      await say([{ speaker: 'hopgood', text: "The Tumbledown Tower! Iron door, there. Bounce your way to the top and grab the Star. Don't look down. Actually, do, it's lovely." }]);
      return;
    }
    if (!state.flags.has('hopgood-reward')) {
      state.flags.add('hopgood-reward');
      await say([
        { speaker: 'hopgood', text: "You did the spire! First go! Oh, that's my favourite thing that's happened all week, and I fell up a chimney on Tuesday." },
        { speaker: 'hopgood', text: "Here, have me. On a card. Best likeness I've had, they caught me mid-bounce." },
      ]);
      state.collectCard('tobias-hopgood');
      await say([{ speaker: 'hopgood', text: 'Springwell works on the castle moss, too. There is a mossy bit on the cloister roof under a balcony. Just saying.' }]);
      return;
    }
    await say([{ speaker: 'hopgood', text: 'Up is the best direction. Down is just up, waiting.' }]);
  },

  hopgoodChargeHint: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "Stuck under the tall one? HOLD the cast until it glows bright, then let go: a charged Springwell throws you much higher. Or tap jump just as you bounce!" },
    ]);
  },

  springPracticeDone: async ({ say, state }) => {
    state.flags.add('practice-springwell');
    await say([
      { speaker: 'hopgood', text: 'Plates one, two AND three! Lovely bouncing, lovely!' },
      { speaker: 'hopgood', text: "The Tumbledown Tower, through the iron door. Pads go flat after a few seconds, so cast and GO. A charged cast throws you higher. And the roof has no railings. That's the fun of it." },
    ]);
  },

  lockedTowerDoor: async ({ say, state }) => {
    if (state.lessons.has('springwell')) {
      await say([{ speaker: 'hopgood', text: "The Tower's done! I'd let you go again but the spire's still wobbling." }]);
      return;
    }
    await say([{ speaker: 'hopgood', text: 'Plates first! All three. Up you go!' }]);
  },

  classNotOverHopgood: async ({ say, state }) => {
    const text = state.flags.has('practice-springwell')
      ? "Not yet! The Tower first. The Star is right at the top, you can't miss it. Well, you can, but don't."
      : 'Not yet! Three plates, then the Tower.';
    await say([{ speaker: 'hopgood', text }]);
  },

  towerIntro: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "(far above) Welcome to the Tumbledown Tower! It's mostly up. Springwell a pad, run on, and hold jump as you land." },
    ]);
  },

  towerStair: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "(echoing) The toadstool stair! Cast at the next cap BEFORE you jump on it. They go flat quickly. And the leaning ones throw you where they lean." },
    ]);
  },

  towerBellfry: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "(echoing) The Bellfry! The walkway is high. A plain bounce won't do, HOLD the cast to charge it. And the gate up there only opens while the knocker under the walkway is ticking." },
    ]);
  },

  towerRoof: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "(windy) The roof! Turret to turret to the spire. The leaning caps aim for you, just steer a little. The last hop is a big one: charge it, or hold that jump!" },
    ]);
  },

  towerComplete: async ({ say, state }) => {
    if (state.lessons.has('springwell')) return;
    state.lessons.add('springwell');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Leaps & Bounds');
    await say([{ speaker: 'hopgood', text: '(far below) WOOHOO! The Thistle Star! Come back down and see me. The door, not the quick way.' }]);
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

async function teachSpringwell({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'hopgood', text: "Hello hello! Tobias Hopgood, Leaps & Bounds. Thank you for the door, I'd been bouncing on it for an hour." },
    { speaker: 'hopgood', text: 'SPRINGWELL! Moss, toadstools, mattresses, anything with a bit of give. Cast at it, and for a few seconds it throws you skywards.' },
    { speaker: 'hopgood', text: "Hold the cast to charge it, and it throws you higher. Hold jump as you land, and higher still. Both? Ooh. Mind the ceiling." },
  ]);
  if (!state.knows('springwell')) {
    state.learn('springwell');
    events.emit('toast', { text: 'You learned Springwell!', kind: 'info' });
  }
  await say([{ speaker: 'hopgood', text: 'Three platforms, a plate on each. Stand on all three! The tall one needs extra oomph: hold jump as you land, or charge your cast.' }]);
}

async function teachLatchkin({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'quince', text: 'You are the Gorse pupil. The one who shoves things. Sit. No, stand. Watch.' },
    { speaker: 'quince', text: 'Ottoline Quince, Locks & Latches. A lock is not an obstacle. It is a question, asked rudely. LATCHKIN answers it politely.' },
    { speaker: 'quince', text: 'Aim at the lock itself, the padlock, the keyhole, and cast. The lock must be in plain sight. Locks are shy.' },
  ]);
  if (!state.knows('latchkin')) {
    state.learn('latchkin');
    events.emit('toast', { text: 'You learned Latchkin!', kind: 'info' });
  }
  await say([{ speaker: 'quince', text: 'Three practice boxes. Open them all. What is inside is yours. I am feeling generous.' }]);
}

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
