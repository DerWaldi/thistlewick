import type { EventBus } from '../engine/events';
import type { GameState } from '../state/gameState';
import type { DialogueLine } from '../ui/dialogue';
import { HOUSE_ORDER, HOUSES, POINTS, SORTING_QUESTIONS, type HouseId } from './houses';
import { SPEAKERS } from './characters';
import { QUESTS, questStage, type QuestDef } from './quests';
import { LOST_AND_FOUND } from './shop';
import { STUDENTS } from './students';
import { SWEETS } from './sweets';

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
      {
        speaker: 'wendlebury',
        text: 'Your first year, then. Seven professors will each teach you one spell, and each will set you a trial in some dreadful corner of this castle. Bring me back their Thistle Stars.',
      },
      { speaker: 'wendlebury', text: 'Pass all seven and you may sit the Final Examinations. Do well, and your house may yet win the House Cup. No pressure.' },
      {
        speaker: 'wendlebury',
        text: "The castle is large and moves about a bit. If you lose your way, the little gold arrow up in the corner knows where you're meant to be. Esc shows your timetable.",
      },
      { speaker: 'wendlebury', text: "But first, the Sorting Lantern would like a word. It's the one muttering by the hourglasses." },
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
    if (state.flags.has('year-complete')) {
      await say([
        { speaker: 'wendlebury', text: "The House Cup is on the mantelpiece and the Golden Thistle is on my desk. Mostly I look at the Thistle. Don't tell the Cup." },
        { speaker: 'wendlebury', text: "There's still plenty of castle you haven't found, I expect. There always is. Mind the third step." },
      ]);
      return;
    }
    if (state.lessons.has('thistledown')) {
      await say([
        { speaker: 'wendlebury', text: "Seven Stars. Seven! Professor Underbough floated down from the roof to tell me, and then couldn't get back up. We've sent for a ladder." },
        { speaker: 'wendlebury', text: "That's every spell a first-year can learn, dear. Which means only one thing is left: the Final Examinations." },
        { speaker: 'wendlebury', text: "The Examination Hall is on the First Floor, the iron door beside the stair to the roof. All seven professors have set you a room. Take your time. Explore first, if you like. The exams will wait." },
      ]);
      return;
    }
    if (state.lessons.has('rimewhistle')) {
      await say([
        { speaker: 'wendlebury', text: "Six Stars. Madam Coldharbour says you crossed the Cisterns without getting your socks wet. She has never managed that. She doesn't wear socks." },
        { speaker: 'wendlebury', text: 'There is a little folly on the island in the lake. Old Isolde Fairweather used to row out to it. You, I suspect, will walk.' },
        { speaker: 'wendlebury', text: "Last of all, Airs & Graces with Professor Underbough, at the very top of the Clock Tower. The door is in Hollyhock Court's north wall. It's a lot of stairs. She'll tell you there's a quicker way." },
      ]);
      return;
    }
    if (state.lessons.has('cindersnap')) {
      await say([
        { speaker: 'wendlebury', text: "Five Stars! Professor Ashcombe says you didn't singe a single eyebrow. Hers, I mean. Yours are your own business." },
        { speaker: 'wendlebury', text: "I've had the great doors unbarred. You may go out into the grounds now, dear: Madam Coldharbour teaches Frosts & Waters in the boathouse by the lake." },
        { speaker: 'wendlebury', text: 'Those vines over the west arch in Hollyhock Court have been there since before my time. And the Well Yard gate has been frozen shut all year. I always wondered.' },
      ]);
      return;
    }
    if (state.lessons.has('glimmerwick')) {
      await say([
        { speaker: 'wendlebury', text: "Four Stars! And Mr. Lamplough came UPSTAIRS to tell me. He blinked a great deal, but he came." },
        { speaker: 'wendlebury', text: 'Light shows what wants to stay hidden, dear. I would look again at any wall you think you know.' },
        { speaker: 'wendlebury', text: 'Professor Ashcombe is expecting you in the kitchens. Through the Kitchen Yard: the little corner of Hollyhock Court behind the cloister, east side. Follow your nose.' },
      ]);
      return;
    }
    if (state.lessons.has('springwell')) {
      await say([
        { speaker: 'wendlebury', text: "Three Thistle Stars, and you came down the Tumbledown Tower the front way. Mr. Hopgood is beside himself. Literally, he's bouncing." },
        { speaker: 'wendlebury', text: 'There is a balcony over Hollyhock Court that nobody has stood on in years. I wonder what is up there.' },
        { speaker: 'wendlebury', text: 'Mr. Lamplough will see you now, down in the Undercroft. The little door by the front doors. Take a lamp. Well, you ARE the lamp, soon.' },
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
      { speaker: 'wendlebury', text: 'Practical Charms is up the Crooked Corridor, through the west arch. Professor Gorse will be along shortly.' },
      { speaker: 'wendlebury', text: 'Until then, do have a wander. Thistlewick rewards the curious. And occasionally bites them.' },
    ]);
  },

  frontDoors: async ({ say, state }) => {
    const text = state.lessons.has('glimmerwick')
      ? 'The great doors are still barred. A new note is pinned to them: "FIRST-YEARS STAY IN. Five Stars and you may go and see Madam Coldharbour at the lake. — W."'
      : 'The great doors are barred from outside. A note is pinned to them: "FIRST-YEARS STAY IN. — W."';
    await say([{ speaker: 'sign', text }]);
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
      { speaker: 'gorse', text: "Now, the Thwackwort Trial. Through the iron door. Push blocks, knock switches, and DON'T dawdle on the timed gates. Right at the end there's a leap across a chasm with a bombardier on the far side. Bring me back the Thistle Star!" },
    ]);
  },

  classNotOver: async ({ say, state }) => {
    const text = state.lessons.has('thwackwort')
      ? "Not so fast! You've got the Star, have you? Then come and tell me all about it first. Front of the class!"
      : state.flags.has('practice-done')
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

  trialMoat: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: "(echoing) The Clockwork Moat! The platforms move by themselves. Watch them, hop on as one comes by, and don't dawdle. The Gnarlings on the far side? You know what to do." },
    ]);
  },

  trialLeap: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: "(his voice booming down a pipe) THE SOOTLING'S LEAP! My little bombardier sits on the far ledge. He lobs, you leap. Don't stand still!" },
      { speaker: 'gorse', text: "A fizzing bomb on the ground? THWACK it his way and it'll land right in his lap. Or thwack HIM twice: once to daze him, once to send him packing!" },
    ]);
  },

  trialGarden: async ({ say }) => {
    await say([
      { speaker: 'gorse', text: "(echoing) The old garden. Gnarlings, I'm afraid, and the Rattlecoat that guards the gate. Plain shoves just bounce off armour. CHARGE it!" },
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
      { speaker: 'quince', text: "Now the Latchkin Vaults, through the iron door. Padlocks hide, some lock themselves again, and some chests BITE. Lock those shut and give them a Thwackwort. The Star is beyond my Counting House. Bring it to me." },
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
    const text = state.lessons.has('latchkin')
      ? 'A Star, and you were going to leave without a word? Come here and report, please. Properly.'
      : state.flags.has('practice-latchkin')
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
      { speaker: 'quince', text: "(echoing) The pantry. Some of those chests are chests. Some are Snapcaskets, and they look exactly alike. Watch a chest a while before you trust it: a Snapcasket cannot keep its lid still for long." },
      { speaker: 'quince', text: "(echoing) Latchkin LOCKS a Snapcasket shut. While it's locked, Thwackwort it. Quickly, they don't stay locked." },
    ]);
  },

  vaultShutters: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The shutters lock themselves again. Open one, look through it for the next lock, and don't dawdle." },
    ]);
  },

  vaultStrongroom: async ({ say }) => {
    await say([
      { speaker: 'quince', text: "(echoing) The Strongroom. Pendulums, and gates whose padlocks snap shut again after six seconds. Unlock, watch the swing, and go. Hesitation is a habit. Break it." },
    ]);
  },

  vaultCounting: async ({ say }) => {
    await say([
      { speaker: 'quince', text: '(from a speaking-tube) The Counting House. Three locks on my last gate, and they will not wait for you: five and a half seconds, then they snap shut again.' },
      { speaker: 'quince', text: 'One on the table, one up behind the grille, one going round and round. Find where you can see them, then be quick. And mind the help. They are not helpful.' },
      { speaker: 'quince', text: 'Oh, and a Hexling has got in. A bad fairy: she circles high and throws hexes that follow you. Step aside late. Back off so you can see her, Thwackwort her out of the air, and thwack her again while she is down. A charged one does both.' },
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
      await say([{ speaker: 'hopgood', text: "The Tumbledown Tower! Iron door, there. Bounce your way to the top, then out along the rooftops to the Weathercock and grab the Star. Don't look down. Actually, do, it's lovely." }]);
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
    await say([
      { speaker: 'hopgood', text: 'Up is the best direction. Down is just up, waiting.' },
      { speaker: 'hopgood', text: "Speaking of down: Mr. Lamplough's in the Undercroft, under the Lantern Hall. Little door by the front doors. Bring your eyes." },
    ]);
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
    const text = state.lessons.has('springwell')
      ? 'Whoa, whoa! You got the Star? Come and tell me how high you went first!'
      : state.flags.has('practice-springwell')
      ? "Not yet! The Tower first. The Star is right up on the Weathercock, you can't miss it. Well, you can, but don't."
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

  towerSpire: async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "(shouting up from far, far below) The Star's moved! Some joker put it on the Weathercock! Rune tile, chimney, chimney, beam, toadstool. Don't look down. Do look out for fairies." },
    ]);
  },

  towerComplete: async ({ say, state }) => {
    if (state.lessons.has('springwell')) return;
    state.lessons.add('springwell');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Leaps & Bounds');
    await say([{ speaker: 'hopgood', text: '(far below) WOOHOO! The Thistle Star! Come back down and see me. The door, not the quick way.' }]);
  },

  // ---------------------------------------------------------------- the fourth lesson

  undercroftDoor: async ({ say, state }) => {
    const text = state.lessons.has('springwell')
      ? '"ILLUMINATION — Mr. F. Lamplough. Mind the stairs. There are a great many and none of them are lit."'
      : '"ILLUMINATION — Mr. F. Lamplough. Third-term pupils and above." It is locked, and very dark beyond the keyhole.';
    await say([{ speaker: 'sign', text }]);
  },

  lamploughLesson: async (ctx) => {
    await teachGlimmerwick(ctx);
  },

  lamplough: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('glimmerwick')) {
      await teachGlimmerwick(ctx);
      return;
    }
    if (!state.flags.has('practice-glimmerwick')) {
      await say([{ speaker: 'lamplough', text: 'Three plates. The first is up some steps that only light can see. The second is over the trench. The third is far away; HOLD the cast to light further.' }]);
      return;
    }
    if (!state.lessons.has('glimmerwick')) {
      await say([{ speaker: 'lamplough', text: 'The Catacombs are through the iron door. Lamps go out, my dear. Plan ahead, and never stand on glimmerstone when the light is flickering.' }]);
      return;
    }
    if (!state.flags.has('lamplough-reward')) {
      state.flags.add('lamplough-reward');
      await say([
        { speaker: 'lamplough', text: "You lit Lamplough's Lantern. All four at once. I have not seen it burn like that since... well. Since I lit it. Which was a while ago." },
        { speaker: 'lamplough', text: 'Have this. A picture of me, from when I was still going outside. Look how squinty I am.' },
      ]);
      state.collectCard('fennick-lamplough');
      await say([
        { speaker: 'lamplough', text: 'There are glimmer steps in the Lantern Hall, you know. Up by the gallery. And the Long Gallery has a wall that is not entirely honest.' },
        { speaker: 'lamplough', text: 'Professor Ashcombe wants you next. Hearth & Flame, in the kitchens, through the Kitchen Yard off Hollyhock Court. Too bright for me. Far too warm.' },
      ]);
      return;
    }
    await say([{ speaker: 'lamplough', text: 'Darkness is just light that has not arrived yet. Be patient with it. Then hit it with a lamp.' }]);
  },

  lamploughChargeHint: async ({ say }) => {
    await say([{ speaker: 'lamplough', text: "Can't see the last step? HOLD the cast on the lamp until it glows bright, then let go. A charged lamp lights half as far again." }]);
  },

  glimmerPracticeDone: async ({ say, state }) => {
    state.flags.add('practice-glimmerwick');
    await say([
      { speaker: 'lamplough', text: 'Splendid. You see? Most things are there all along. They are simply waiting for someone to look properly.' },
      { speaker: 'lamplough', text: 'The Lamplit Catacombs, through the iron door. Glimmer bridges, walls that lie, my Lantern of four lamps at once, and the Ossuary, where the lamps are short and the dark is long. Bring me the Thistle Star.' },
    ]);
  },

  lockedCatacombDoor: async ({ say, state }) => {
    if (state.lessons.has('glimmerwick')) {
      await say([{ speaker: 'lamplough', text: 'The Catacombs are sleeping again. Let them. They snore.' }]);
      return;
    }
    await say([{ speaker: 'lamplough', text: 'The plates first, if you please. All three.' }]);
  },

  classNotOverLamplough: async ({ say, state }) => {
    const text = state.lessons.has('glimmerwick')
      ? 'Back already? Come and tell me what you saw down there, first. Over here, by the lamp.'
      : state.flags.has('practice-glimmerwick')
      ? "Not yet, not yet. The Catacombs. The iron door. I'll keep a lamp lit for you."
      : 'Not yet. Three plates first. Light the way.';
    await say([{ speaker: 'lamplough', text }]);
  },

  catacombIntro: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: "(echoing, from far off) The Lamplit Catacombs. Light a lamp and look. Glimmerstone only bears your weight while the light is on it." },
    ]);
  },

  catacombBridge: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: "(echoing) The bridge is there, you just can't see it. Light the lamp, cross to the island, light the next. Quickly: they don't burn long." },
    ]);
  },

  catacombWalls: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: "(echoing) The Hall of False Walls. Some of these walls are lying. Light the lamp by the door first, so you can see. Then each little lamp tells the truth, as far as it reaches. A charged cast reaches further." },
    ]);
  },

  catacombLantern: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: "(echoing) My Lantern! Four lamps round the room. The gate opens only while ALL FOUR are lit. They don't last long. Run, my dear." },
    ]);
  },

  catacombCrypt: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: "(echoing) The Ember Crypt. Crabs that glow and spit fire, nasty things. A good Thwackwort flips them on their backs for a moment. Light the lamps and cross while they're upside down." },
    ]);
  },

  catacombOssuary: async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: '(a voice from the dark) The Ossuary. My shortest lamps, I am afraid: six seconds each. Light the next one before the one you are standing in goes out.' },
      { speaker: 'lamplough', text: 'The last stone wants a brighter lamp. So does the way out. And there is a moth in here. A large, unpleasant one. It throws things.' },
    ]);
  },

  catacombComplete: async ({ say, state }) => {
    if (state.lessons.has('glimmerwick')) return;
    state.lessons.add('glimmerwick');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Illumination');
    await say([{ speaker: 'lamplough', text: '(echoing) Oh, well done! Well done! Come back up and see me. Mind the dark on the way.' }]);
  },

  // ---------------------------------------------------------------- the fifth lesson

  kitchenDoor: async ({ say, state }) => {
    const text = state.lessons.has('glimmerwick')
      ? '"HEARTH & FLAME — Prof. W. Ashcombe. Kitchens. Wipe your feet. Mind the ovens. Mind EVERYTHING."'
      : '"HEARTH & FLAME — Prof. W. Ashcombe. Fifth-term pupils only. Absolutely no toasting forks." It smells wonderfully of bread.';
    await say([{ speaker: 'sign', text }]);
  },

  ashcombeLesson: async (ctx) => {
    await teachCindersnap(ctx);
  },

  ashcombe: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('cindersnap')) {
      await teachCindersnap(ctx);
      return;
    }
    if (!state.flags.has('practice-cindersnap') && !state.lessons.has('cindersnap')) {
      await say([
        { speaker: 'ashcombe', text: 'The pantry cobweb, the crate on its rope, and my three braziers. In ORDER, mind: count the notches on each bowl. One, two, three.' },
      ]);
      return;
    }
    if (!state.lessons.has('cindersnap')) {
      await say([{ speaker: 'ashcombe', text: 'The Glasshouse, through the iron door. Burn what is in your way and nothing else. And stay out of the briars, they bite.' }]);
      return;
    }
    if (!state.flags.has('ashcombe-reward')) {
      state.flags.add('ashcombe-reward');
      await say([
        { speaker: 'ashcombe', text: 'The Bramble Heart, burnt clean, and the Glasshouse still standing. Most first-years manage one or the other.' },
        { speaker: 'ashcombe', text: 'Here. My card. The eyebrows were drawn back on afterwards, whatever Moss Crumbleton tells you.' },
      ]);
      state.collectCard('wilhelmina-ashcombe');
      await say([
        { speaker: 'ashcombe', text: 'There are vines over an arch in Hollyhock Court, on the west side. Nobody has been through there in years. Now somebody can.' },
        { speaker: 'ashcombe', text: "And the great doors are open for you now. Madam Coldharbour is down at the boathouse by the lake. Take a scarf. Take two." },
      ]);
      return;
    }
    await say([{ speaker: 'ashcombe', text: 'A good cook knows what to burn and what not to. So does a good witch. Same thing, really, with more soup.' }]);
  },

  ashcombeOrderHint: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: 'Out of turn, and out they all go! Look at the bowls: the gold notches. One notch first, then two, then three. Not left to right. Count.' },
    ]);
  },

  ashcombeRopeHint: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "That shelf is too high to jump, dear. See the crate hanging beside it? Burn its rope and it comes down. Then it's a step." },
    ]);
  },

  cinderPracticeDone: async ({ say, state }) => {
    state.flags.add('practice-cindersnap');
    await say([
      { speaker: 'ashcombe', text: 'Cobweb gone, crate down, braziers lit in order. And the kitchen still standing. Good.' },
      { speaker: 'ashcombe', text: 'The Overgrown Glasshouse, through the iron door. Briars, ropes, braziers, Gnarlings. The Bramble Heart opens the way to my Hothouse; the Thistle Star is at the far end of it.' },
    ]);
  },

  lockedGlasshouseDoor: async ({ say, state }) => {
    if (state.lessons.has('cindersnap')) {
      await say([{ speaker: 'ashcombe', text: 'The Glasshouse is growing back. Give it a year. It will be just as rude.' }]);
      return;
    }
    await say([{ speaker: 'ashcombe', text: 'Practice first. The cobweb, the crate, the braziers. Then the Glasshouse.' }]);
  },

  classNotOverAshcombe: async ({ say, state }) => {
    const text = state.lessons.has('cindersnap')
      ? 'Not one step until you have told me how my Glasshouse fared. Over here.'
      : state.flags.has('practice-cindersnap')
      ? 'The Glasshouse is the iron door, not that one. Off you go. Wipe your feet when you come back.'
      : 'And where do you think you are going? Practice first. Cobweb, crate, braziers.';
    await say([{ speaker: 'ashcombe', text }]);
  },

  glasshouseIntro: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: '(from back in the kitchen) The Overgrown Glasshouse. Burn the vines, burn the briars, never touch them. Anything on a rope is holding something up.' },
    ]);
  },

  glasshouseMaze: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: '(distant) The Briar Maze. Each hedge has one way through, choked with briars. Burn it, then walk. Brush against a briar and it bites.' },
    ]);
  },

  glasshouseGnarlings: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) Gnarlings! They can't abide fire. Light that brazier and they'll keep well away from it. Stand close to it and you're safe." },
    ]);
  },

  glasshousePond: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) The Lily Pond. The bridge is tied up with a rope, and those crates are hanging over the water for a reason. Burn the ropes from the bank: they're too high to aim at from underneath." },
    ]);
  },

  glasshousePalm: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) The Palm House. Four braziers, I to IV: count the notches. All four at once opens the gate, and they don't burn for long. Plan your route before you light the first." },
    ]);
  },

  glasshousePalmFail: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) Wrong one! They've all gone out. One notch, two, three, four. You'll need to see round that planter: move as you go." },
    ]);
  },

  glasshouseWeeds: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) Snapweed beds! A Snapweed bites anything that comes near it, Gnarlings included. Watch it rear back before it snaps. Burn it from further off than it can reach." },
    ]);
  },

  glasshouseHeart: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) The Bramble Heart. Those briars are green and wet through; they won't catch. Light both braziers and let the heat dry them out first." },
      { speaker: 'ashcombe', text: '(distant) Then light the old brazier in the middle. It opens the way to my Hothouse.' },
    ]);
  },

  glasshouseHothouse: async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "(distant) My Hothouse! Pillars across the pool. Burn what grows on them from the one before: briars hurt, and Snapweeds bite you straight into the water." },
      { speaker: 'ashcombe', text: '(distant) Two Sootlings have moved into my planters. Turf them out, both of them, and my gate will open. Their own bombs work wonders.' },
    ]);
  },

  glasshouseComplete: async ({ say, state }) => {
    if (state.lessons.has('cindersnap')) return;
    state.lessons.add('cindersnap');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Hearth & Flame');
    await say([{ speaker: 'ashcombe', text: "(distant) There's the Star! Bring it back to the kitchen. And close the door, you're letting the heat out." }]);
  },

  // ---------------------------------------------------------------- the sixth lesson

  coldharbourLesson: async (ctx) => {
    await teachRimewhistle(ctx);
  },

  coldharbour: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('rimewhistle')) {
      await teachRimewhistle(ctx);
      return;
    }
    if (!state.flags.has('practice-rimewhistle') && !state.lessons.has('rimewhistle')) {
      await say([
        { speaker: 'coldharbour', text: 'Three plates. Freeze the pool to reach the islet. Freeze the waterfall and climb it. And the dock: HOLD the cast, or the ice will not last the crossing.' },
      ]);
      return;
    }
    if (!state.lessons.has('rimewhistle')) {
      await say([{ speaker: 'coldharbour', text: 'The Cisterns, through the iron door. Ice melts, floes slide, and the water is colder than it looks. Mind your footing.' }]);
      return;
    }
    if (!state.flags.has('coldharbour-reward')) {
      state.flags.add('coldharbour-reward');
      await say([
        { speaker: 'coldharbour', text: 'The Star. And dry, too. Hm. You may have a future in this, child.' },
        { speaker: 'coldharbour', text: 'My card. Taken the morning I broke the ice with my elbow. Note the expression. That is joy.' },
      ]);
      state.collectCard('elspeth-coldharbour');
      await say([
        { speaker: 'coldharbour', text: 'The fountain in Hollyhock Court freezes nicely, if you ask it. And the island in the lake has a folly no one has visited in forty years.' },
        { speaker: 'coldharbour', text: 'Professor Underbough will want you next. Top of the Clock Tower. Wrap up: it is windy, and she does not believe in walls.' },
      ]);
      return;
    }
    await say([{ speaker: 'coldharbour', text: 'Cold is patient. Cold waits. Then cold wins. Remember that, and wear a vest.' }]);
  },

  coldharbourChargeHint: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: 'The dock ice melts before you are across? Then make it thicker: HOLD the cast until it glows, and let go. A charged freeze lasts much longer.' },
    ]);
  },

  coldharbourClimbHint: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: "Freeze the waterfall. A pillar of ice forms at its foot: jump up and grab its top, then climb on to the ledge." },
    ]);
  },

  rimePracticeDone: async ({ say, state }) => {
    state.flags.add('practice-rimewhistle');
    await say([
      { speaker: 'coldharbour', text: 'Adequate. More than adequate. Do not let it go to your head; heads are where the cold gets in.' },
      { speaker: 'coldharbour', text: 'The Flooded Cisterns, through the iron door. Ice that will not wait for you, floes that go where they are pushed, a lever frozen solid, and the Sluice Canal beyond it. The Star is at the very end. Bring it back.' },
    ]);
  },

  lockedCisternDoor: async ({ say, state }) => {
    if (state.lessons.has('rimewhistle')) {
      await say([{ speaker: 'coldharbour', text: 'The Cisterns have flooded again. They do that. Leave them be.' }]);
      return;
    }
    await say([{ speaker: 'coldharbour', text: 'Three plates first. Then the Cisterns.' }]);
  },

  classNotOverColdharbour: async ({ say, state }) => {
    const text = state.lessons.has('rimewhistle')
      ? 'You have the Star. Then you will report to me before you go anywhere, child.'
      : state.flags.has('practice-rimewhistle')
      ? 'The iron door, child. The Cisterns. The lake will still be there afterwards.'
      : 'You have not finished. Three plates.';
    await say([{ speaker: 'coldharbour', text }]);
  },

  cisternIntro: async ({ say }) => {
    await say([{ speaker: 'coldharbour', text: '(echoing) The Flooded Cisterns. Freeze what you must, and keep moving: ice does not last.' }]);
  },

  cisternCanal: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: "(echoing) The Long Canal. Freeze a patch, hop on, freeze the next. They melt in five seconds, ten if you charge them. Ice is slippery: land, then steer gently." },
    ]);
  },

  cisternFalls: async ({ say }) => {
    await say([{ speaker: 'coldharbour', text: '(echoing) Up the cliff? Freeze the waterfall, and climb the ice.' }]);
  },

  cisternFerry: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: "(echoing) The Floe Ferry. Thwackwort a floe and it slides until it bumps into something. Push from behind: stand on the side you want it to leave. The far floe? You'll need ice to get round to it. If they jam, ring the bell." },
    ]);
  },

  cisternCrabs: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: "(echoing) Ember Crabs! They spit fire. Freeze one and it is a block of ice: you may stand on it, for a while. Thwack a frozen crab and it shatters. Those in the water are your stepping stones." },
    ]);
  },

  cisternFrost: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: '(echoing) A wall of ice. Rimewhistle will not shift that. What melts ice, child? Something from Professor Ashcombe, I believe.' },
      { speaker: 'coldharbour', text: '(echoing) The sluice lever on the dais has frozen solid too. Thaw it and give it a knock; it opens the way on.' },
    ]);
  },

  cisternCharge: async ({ say }) => {
    await say([{ speaker: 'coldharbour', text: '(echoing) Those patches melt almost at once. Charge the freeze: hold the cast, let go when it glows, and they will hold long enough.' }]);
  },

  cisternSluice: async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: '(her voice echoing off the water) The Sluice Canal. Charge your freezes here: a tap will not hold you. The crabs in the water are your stepping stones, once frozen.' },
      { speaker: 'coldharbour', text: 'A Sootling has taken the far landing. Send him packing and my last gate opens. And mind the fairy. She does not care for ice either.' },
    ]);
  },

  cisternComplete: async ({ say, state }) => {
    if (state.lessons.has('rimewhistle')) return;
    state.lessons.add('rimewhistle');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Frosts & Waters');
    await say([{ speaker: 'coldharbour', text: '(echoing) The Star. Good. Come back up before your toes fall off.' }]);
  },

  // ---------------------------------------------------------------- the seventh lesson

  clockTowerDoor: async ({ say, state }) => {
    const text = state.lessons.has('cindersnap')
      ? '"THE CLOCK TOWER. Airs & Graces, top floor. Sixth-term pupils and above." A rattle of gears from somewhere far above.'
      : '"THE CLOCK TOWER. No admittance. The clock is busy." It ticks at you, a little rudely.';
    await say([{ speaker: 'sign', text }]);
  },

  underboughLesson: async (ctx) => {
    await teachThistledown(ctx);
  },

  underbough: async (ctx) => {
    const { say, state } = ctx;
    if (!state.knows('thistledown')) {
      await teachThistledown(ctx);
      return;
    }
    if (!state.flags.has('practice-thistledown') && !state.lessons.has('thistledown')) {
      await say([
        { speaker: 'underbough', text: 'Three plates! Float the crate up to the bell. Ride the platform over the light-well. And the basket on the chimney: call it down, then ride it up.' },
      ]);
      return;
    }
    if (!state.lessons.has('thistledown')) {
      await say([{ speaker: 'underbough', text: "The Clockworks, through the iron door. Pendulums, lifts and one enormous wheel. Keep your feet light and your timing lighter." }]);
      return;
    }
    if (!state.flags.has('underbough-reward')) {
      state.flags.add('underbough-reward');
      await say([
        { speaker: 'underbough', text: 'The Star from the top of the Mainspring! Oh, well floated. Well floated indeed.' },
        { speaker: 'underbough', text: 'My card. That is me on a calm day. You can tell, because I am only slightly off the ground.' },
      ]);
      state.collectCard('hazel-underbough');
      await say([{ speaker: 'underbough', text: "Halfway down the tower there's a crate by a nook nobody can reach. Well. Nobody could." }]);
      return;
    }
    await say([{ speaker: 'underbough', text: 'Lightness is a habit. Practise it daily. Not on the stairs.' }]);
  },

  underboughFloatHint: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: "Climb onto the crate, then cast at the little glowing stone on its corner. Up you go! Things float when you cast at their feather-stones." },
    ]);
  },

  underboughCallHint: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: "The basket is up on the chimney. Cast at its stone from across the roof, where you can see it, and it'll come down to you. Then hop in and cast again." },
    ]);
  },

  airPracticeDone: async ({ say, state }) => {
    state.flags.add('practice-thistledown');
    await say([
      { speaker: 'underbough', text: 'Floated, ferried and fetched! You have the knack. Some people never do. They just sort of plummet.' },
      { speaker: 'underbough', text: "The Great Clockworks, through the iron door. All the way down through the clock to its bell, then up through the Mainspring behind it. The Thistle Star is at the very top. Off you float." },
    ]);
  },

  lockedClockworksDoor: async ({ say, state }) => {
    if (state.lessons.has('thistledown')) {
      await say([{ speaker: 'underbough', text: "The Clockworks are winding themselves back up. Best leave them to it." }]);
      return;
    }
    await say([{ speaker: 'underbough', text: 'The three plates first, please. Then the Clockworks.' }]);
  },

  classNotOverUnderbough: async ({ say, state }) => {
    const text = state.lessons.has('thistledown')
      ? 'You made it to the top! Come and tell me about it before you dash off!'
      : state.flags.has('practice-thistledown')
      ? 'Not the stairs! The iron door. The Clockworks. Go on!'
      : 'Three plates first! Then you may go anywhere you like. Down, mostly.';
    await say([{ speaker: 'underbough', text }]);
  },

  clockworksIntro: async ({ say }) => {
    await say([{ speaker: 'underbough', text: '(faintly, from above) The Great Clockworks! Mind the swinging bits. Everything else, cast at its feather-stone.' }]);
  },

  clockworksGallery: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: '(faintly) The Escapement Gallery. Three pendulums. Watch them swing, and go when there is a gap. A clout from one will knock you off the walkway.' },
    ]);
  },

  clockworksShaft: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: '(faintly) The Weights Shaft. Ride the lift up. The next one is waiting high up: call it down. The last one goes home by itself after three seconds, so do not dawdle.' },
    ]);
  },

  clockworksCall: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: "(faintly) Can't aim at the lift up there? Step back to the far corner, where you can see its stone, and call it from there." },
    ]);
  },

  clockworksWheel: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: "(faintly) The Great Wheel. Step onto a platform as it rises level with you, ride it over the top, and step off at the far side. Fall, and the little lift by the wall will bring you back." },
    ]);
  },

  clockworksBell: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: '(faintly) The Bell Chamber! The crate takes you up to the gallery. Then call the basket down from the bell and ride it up to the plate on the crown. Mind the clapper.' },
    ]);
  },

  clockworksMainspring: async ({ say }) => {
    await say([
      { speaker: 'underbough', text: '(faintly, from very high up) The Mainspring! The ferry floats home after three seconds, and the pendulum does not care. The basket waits on the second column: call it, ride it.' },
      { speaker: 'underbough', text: '(faintly) Then the crate up to the top gallery. Something sooty has moved in up there. Two somethings with wings, as well. I did tell you it was a lot of stairs.' },
    ]);
  },

  clockworksComplete: async ({ say, state }) => {
    if (state.lessons.has('thistledown')) return;
    state.lessons.add('thistledown');
    state.award(POINTS.star, 'the Thistle Star');
    state.award(POINTS.lesson, 'passing Airs & Graces');
    await say([{ speaker: 'underbough', text: '(faintly) You did it! Come back up! Use the door. Please use the door.' }]);
  },

  // ---------------------------------------------------------------- the Old Woods

  oldWoodsGate: async ({ say, state }) => {
    const text = state.lessons.has('thistledown')
      ? '"THE OLD WOODS. No pupils beyond this gate." Somebody has chalked underneath: "Unless you are looking for a hedgehog."'
      : '"THE OLD WOODS. No pupils beyond this gate." It is very firmly shut.';
    await say([{ speaker: 'sign', text }]);
  },

  woodsIntro: async ({ say }) => {
    await say([{ speaker: 'mabel', text: '(calling after you) Keep to the old paths! Thimble always goes for the very middle, where the big oak is. Good luck!' }]);
  },

  woodsThicket: async ({ say }) => {
    await say([{ speaker: 'sign', text: 'A briar thicket, far too tall to climb. Briars, though, burn.' }]);
  },

  woodsDell: async ({ say }) => {
    await say([
      { speaker: 'sign', text: "Mother Hazelrigg's toadstools. Spring the one in the middle of the dell and bounce up to the east shelf. The one up there throws you north, onto the ridge." },
    ]);
  },

  woodsBasket: async ({ say }) => {
    await say([{ speaker: 'sign', text: "The basket is waiting on the far side of the gap. Cast at its feather-stone from here and it'll come over. Then hop in and cast again." }]);
  },

  woodsHollow: async ({ say }) => {
    await say([{ speaker: 'sign', text: 'A hollow log, and holes in its floor. The lamp shows the near stones. Hold the button to charge it, and it shows the far one too.' }]);
  },

  woodsFalls: async ({ say }) => {
    await say([{ speaker: 'sign', text: 'The cliff is too sheer to climb. The waterfall, frozen, makes a step at its foot. Climb the ice, then reach for the top.' }]);
  },

  woodsOak: async ({ say }) => {
    await say([{ speaker: 'sign', text: 'Something small and prickly is snuffling behind the root-gate. The padlock on it is old, and not very clever.' }]);
  },

  // ---------------------------------------------------------------- the Final Examinations

  examsDoor: async ({ say }) => {
    await say([{ speaker: 'sign', text: '"THE EXAMINATION HALL. Final-year... no, FIRST-year examinations. Pupils who have passed all seven lessons only."' }]);
  },

  examsIntro: async ({ say }) => {
    await say([
      { speaker: 'wendlebury', text: '(her voice rings down the hall) Welcome to your Final Examinations, dear! Seven professors, seven rooms, one Golden Thistle at the end.' },
      { speaker: 'wendlebury', text: 'Each professor has set you a room. Every gate opens only when you have shown them what you learned. Lecterns along the way, as usual. Good luck!' },
    ]);
  },

  'exam-gorse': async ({ say }) => {
    await say([
      { speaker: 'gorse', text: 'AH! First up, and first is always loudest! Three blocks, one trough. Shove them in, nice and straight, and walk across.' },
      { speaker: 'gorse', text: 'Beyond it, an old friend in armour. Charged knocks, remember! Hold the button. And the bell resets the blocks, if you make a hash of it.' },
    ]);
  },
  'exam-gorse-hint': async ({ say }) => {
    await say([
      { speaker: 'gorse', text: 'The side blocks first want shoving INTO the middle lane. Stand beside one and knock it towards the trough. Then from behind, push it north. One block, one tile, one thwack!' },
    ]);
  },

  'exam-quince': async ({ say }) => {
    await say([
      { speaker: 'quince', text: 'Three padlocks on my pillar. They snap shut after six seconds. My gate opens only while all three are open.' },
      { speaker: 'quince', text: 'You will have to see each one to open it. Plan your walk. And my Snapcaskets will insist on helping. Lock them shut first, then a knock sends them packing.' },
    ]);
  },
  'exam-quince-hint': async ({ say }) => {
    await say([
      { speaker: 'quince', text: 'From the south-west corner you can see two of my locks at once. Open those, then hurry round the west side for the third. Then through the gate, quickly.' },
    ]);
  },

  'exam-hopgood': async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: "UP! Everything in here goes up! The moss to the left ledge, the toadstool flings you over to the right, and the rune tile takes you to the seal on the top shelf." },
      { speaker: 'hopgood', text: "The top shelf is high. VERY high. Charge the tile, or hold jump as you land. Both, if you're showing off. I'd show off." },
    ]);
  },
  'exam-hopgood-hint': async ({ say }) => {
    await say([
      { speaker: 'hopgood', text: 'Hold the button to CHARGE the rune tile, then hop on and hold jump as you land. The tile nudges you north onto the shelf.' },
    ]);
  },

  'exam-lamplough': async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: '(blinking) Ah. The dark. My favourite room. The stones over the drop show only in lamplight, and the lamps burn six seconds.' },
      { speaker: 'lamplough', text: 'The second lamp stands on the pillar halfway. Light it before the first goes out. And the far wall... is not entirely a wall. My gate wants two lamps burning at once.' },
    ]);
  },
  'exam-lamplough-hint2': async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: '(from somewhere in the dark) There is a lamp on this side too. Light it, and the wall lets you back. Light both, and my gate lets you on.' },
    ]);
  },
  'exam-lamplough-hint': async ({ say }) => {
    await say([
      { speaker: 'lamplough', text: 'Light the lamp by the wall: in its glow the middle of the wall is only a rumour. Walk through, and light the lamp on the other side while the first still burns. That one opens the wall from the far side, too.' },
    ]);
  },

  'exam-ashcombe': async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: 'Snapweeds in the beds. Toast them before they toast you. Then the drawbridge: it hangs by a rope, and ropes burn.' },
      { speaker: 'ashcombe', text: 'Last, my four braziers, lit in order, one, two, three, four, before the first goes out. Count the notches on the bowls.' },
    ]);
  },
  'exam-ashcombe-hint': async ({ say }) => {
    await say([
      { speaker: 'ashcombe', text: "The braziers go round in a figure of eight: east front, west back, east back, west front. Walk the line between them before you start, then light them at a run." },
    ]);
  },

  'exam-coldharbour': async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: 'Ember crabs on the stepping stones. Freeze them, then a knock and they shatter. Then the stones are yours.' },
      { speaker: 'coldharbour', text: 'Knock the floe north from the bank, and the post will stop it by the island. The last stretch needs a CHARGED freeze. And a third crab guards my gate. Shatter it.' },
    ]);
  },
  'exam-coldharbour-hint': async ({ say }) => {
    await say([
      { speaker: 'coldharbour', text: "The floe wants knocking north from the bank, behind it. Then from the island hop on, and hold the button to charge your freeze over the water ahead. A tap won't last long enough." },
    ]);
  },

  'exam-underbough': async ({ say }) => {
    await say([
      { speaker: 'underbough', text: 'The last room! The ferry takes you over to the landing and floats home three seconds later. Mind the pendulum, it swings across the ferry.' },
      { speaker: 'underbough', text: 'The basket is waiting up by my seal. Call it down from the landing, step in, cast again. Up and over, and stand on the seal.' },
    ]);
  },
  'exam-underbough-hint': async ({ say }) => {
    await say([
      { speaker: 'underbough', text: "The basket's feather-stone is up on the shelf by the gate. Aim at it from the landing and it'll come to you." },
    ]);
  },

  examsHomeDoor: async ({ say }) => {
    await say([{ speaker: 'wendlebury', text: 'That door is for afterwards, dear. The Golden Thistle first.' }]);
  },

  examBossIntro: async ({ say }) => {
    await say([
      { speaker: 'wendlebury', text: 'Ah. Before the Thistle, one last examiner. The professors built him together, out of brass and spite. They call him the Brass Examiner.' },
      { speaker: 'wendlebury', text: 'He has six seals. When he slams the floor, JUMP. Then, while his fists are stuck, a seal lights up on his chest: hit it with the spell it shows. Charged, where you can.' },
      { speaker: 'wendlebury', text: 'Keep your distance and he throws things. Get too close and he slams. I shall be over here. Behind the pillar. Good luck, dear!' },
    ]);
  },

  examWendlebury: async ({ say, state }) => {
    if (state.flags.has('year-complete')) {
      await say([{ speaker: 'wendlebury', text: "The hall is yours to wander, dear. The professors are re-setting their rooms. Gorse is, in fact, still ringing his bell." }]);
      return;
    }
    await say([{ speaker: 'wendlebury', text: 'Seven rooms! Well? The Golden Thistle is right there, on the plinth. It has been waiting all year.' }]);
  },

  examComplete: async ({ say, state, events }) => {
    if (state.flags.has('year-complete')) return;
    state.flags.add('year-complete');
    state.award(POINTS.star, 'the Golden Thistle');
    state.award(POINTS.exams, 'passing the Final Examinations');
    await say([
      { speaker: 'wendlebury', text: 'The Golden Thistle! Oh, well done. Very well done indeed. Seven professors, and not one of them could stop you.' },
      { speaker: 'wendlebury', text: 'Which brings us, dear, to the House Cup.' },
    ]);
    const house = state.house;
    if (house) {
      const rivals = HOUSE_ORDER.filter((h) => h !== house);
      const best = Math.max(...rivals.map((h) => state.housePoints[h]));
      // The Headmistress's last-minute points, as is traditional.
      if (state.housePoints[house] <= best) {
        const extra = best - state.housePoints[house] + 10;
        state.housePoints[house] += extra;
        events.emit('points', { house, amount: extra, reason: 'seeing the whole year through' });
        await say([{ speaker: 'wendlebury', text: `It was terribly close. But I have a few points left to give, for seeing the whole year through: ${extra} to ${HOUSES[house].name}.` }]);
      }
      const order = [...HOUSE_ORDER].sort((a, b) => state.housePoints[b] - state.housePoints[a]);
      await say([
        { speaker: 'wendlebury', text: `In fourth place, ${HOUSES[order[3]].name}. Third, ${HOUSES[order[2]].name}. Second, ${HOUSES[order[1]].name}...` },
        { speaker: 'wendlebury', text: `...and the House Cup goes to ${HOUSES[order[0]].name.toUpperCase()}! ${state.housePoints[order[0]]} points!` },
      ]);
    }
    await say([
      { speaker: 'wendlebury', text: "That is the end of your first year at Thistlewick. Go and enjoy the summer. The castle will still be here, and so will its secrets. Mind the third step." },
      { speaker: 'wendlebury', text: 'The door behind the plinth goes straight down to the Lantern Hall. No need to go back through all seven rooms. The professors are re-setting them anyway.' },
    ]);
    events.emit('yearComplete', { house });
  },

  upstairsDoor: async ({ say }) => {
    await say([{ speaker: 'sign', text: '"THE FIRST FLOOR. Sorted pupils only." The Sorting Lantern first, then.' }]);
  },

  upperLeads: async ({ say }) => {
    await say([
      { speaker: 'sign', text: '"THE LEADS. The roof is out of bounds." Someone has added underneath, in a different hand: "Unless you can get to the observatory. Then it\'s brilliant."' },
    ]);
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
      // Cards left behind in a finished trial turn up here.
      const lost = LOST_AND_FOUND.filter((l) => state.lessons.has(l.lesson) && !state.cards.has(l.card));
      const told = `told-lost:${lost.map((l) => l.card).join(',')}`;
      if (lost.length && !state.flags.has(told)) {
        state.flags.add(told);
        await say([{ speaker: 'moss', text: 'Oh! Lost & Found. Found some cards lying about down in the trials. Finders keepers. Well, finders sellers.' }]);
      }
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

async function teachGlimmerwick({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'lamplough', text: 'Ah. A visitor. Come in, come in, mind the dark. Fennick Lamplough, Illumination. I am told it is daytime upstairs. I will take their word for it.' },
    { speaker: 'lamplough', text: 'GLIMMERWICK. Cast it at a wick lamp and it lights. And light, my dear, shows things that are there but would rather not be seen.' },
    { speaker: 'lamplough', text: 'Glimmerstone steps appear in its glow, and false walls fade. HOLD the cast to light a wider circle. And mind: lamps go out, and glimmerstone goes with them.' },
  ]);
  if (!state.knows('glimmerwick')) {
    state.learn('glimmerwick');
    events.emit('toast', { text: 'You learned Glimmerwick!', kind: 'info' });
  }
  await say([{ speaker: 'lamplough', text: 'Three plates. Up the hidden steps, over the trench, and the far one: hold the cast to reach it. Off you go.' }]);
}

async function teachCindersnap({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'ashcombe', text: "In you come, wipe your feet. Wilhelmina Ashcombe, Hearth & Flame. Don't touch the ovens. Don't touch anything, actually, until I've explained." },
    { speaker: 'ashcombe', text: 'CINDERSNAP. A spark, no more. Cast it at rope, vine, cobweb or hay and it burns away. Cast it at a brazier and it lights.' },
    { speaker: 'ashcombe', text: "Mind what you burn. A rope that's holding something up will let it DROP. Gnarlings hate fire: they won't go near a lit brazier. And when braziers have notches, you light them in order." },
  ]);
  if (!state.knows('cindersnap')) {
    state.learn('cindersnap');
    events.emit('toast', { text: 'You learned Cindersnap!', kind: 'info' });
  }
  await say([{ speaker: 'ashcombe', text: 'Three tasks. The pantry is full of cobwebs. That shelf is too high to jump: use the crate. And my braziers, in ORDER: one notch, two, three.' }]);
}

async function teachRimewhistle({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'coldharbour', text: 'Close the door. You are letting the warm in. Elspeth Coldharbour, Frosts & Waters. Sit. The bench is cold. Good for the posture.' },
    { speaker: 'coldharbour', text: 'RIMEWHISTLE. Cast it at water and the water freezes: a slab you can walk on. Ice is slippery, and ice melts. Hold the cast to freeze it thicker, and it lasts twice as long.' },
    { speaker: 'coldharbour', text: 'Freeze a waterfall and it becomes a pillar of ice you can climb. Ice floes slide when you Thwackwort them. And fire, should you need it, melts ice at once.' },
  ]);
  if (!state.knows('rimewhistle')) {
    state.learn('rimewhistle');
    events.emit('toast', { text: 'You learned Rimewhistle!', kind: 'info' });
  }
  await say([{ speaker: 'coldharbour', text: 'Three plates. The islet in the pool. The ledge above the waterfall. And the jetty across the dock: the long way, so hold the cast. Begin.' }]);
}

async function teachThistledown({ say, state, events }: ScriptContext): Promise<void> {
  await say([
    { speaker: 'underbough', text: 'Up here! Mind the edge. Hazel Underbough, Airs & Graces. Isn\'t it glorious? You can see the lake, the woods, and on a clear day, Tuesday.' },
    { speaker: 'underbough', text: "THISTLEDOWN. Every lift, crate and basket that can float has a feather-stone: a little glowing stone on a post. Cast at it, and the thing floats to its other place. Cast again, and it comes back." },
    { speaker: 'underbough', text: "Stand on it first and it carries you. If it's waiting far away, call it from where you can see the stone. And some lifts get homesick, and float back by themselves." },
  ]);
  if (!state.knows('thistledown')) {
    state.learn('thistledown');
    events.emit('toast', { text: 'You learned Thistledown!', kind: 'info' });
  }
  await say([{ speaker: 'underbough', text: 'Three plates: up the crate to the bell, across the light-well, and on top of the chimney. Off you float!' }]);
}

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

/**
 * A student's errand: offer it (you can say not now), remind you while it's open, then
 * take the thing back and hand over the reward.
 */
function questScript(q: QuestDef): Script {
  return async ({ say, state, events }) => {
    const who = q.giver;
    const stage = questStage(state, q);
    if (stage === 'offered') {
      const lines: DialogueLine[] = q.offer.map((text) => ({ speaker: who, text }));
      lines[lines.length - 1] = { ...lines[lines.length - 1], choices: ["I'll find it.", 'Not just now.'] };
      const pick = await say(lines);
      if (pick === 1) {
        await say([{ speaker: who, text: "Oh. All right. I'll be here. Fretting." }]);
        return;
      }
      state.flags.add(`quest:${q.id}`);
      events.emit('toast', { text: `New errand: ${q.title}`, kind: 'info' });
      events.emit('quest', { id: q.id, stage: 'start' });
      await say([{ speaker: who, text: q.waiting }]);
      return;
    }
    if (stage === 'active') {
      await say([{ speaker: who, text: q.waiting }]);
      return;
    }
    if (stage === 'found') {
      await say(q.thanks.map((text) => ({ speaker: who, text })));
      state.flags.add(`quest:${q.id}:done`);
      for (const [kind, n] of q.reward.sweets ?? []) state.giveSweets(kind, n);
      if (q.reward.sweets?.length) {
        const total = q.reward.sweets.reduce((t, [kind, n]) => t + SWEETS[kind].value * n, 0);
        events.emit('toast', { text: `+${total} sweets`, kind: 'info' });
      }
      if (q.reward.card) state.collectCard(q.reward.card);
      state.award(POINTS.quest, `helping ${SPEAKERS[who].name.split(' ')[0]}`);
      events.emit('quest', { id: q.id, stage: 'done' });
      return;
    }
    await say([{ speaker: who, text: q.afterwards }]);
  };
}

for (const q of QUESTS) DIALOGUES[`quest-${q.id}`] = questScript(q);

/** Pupils about the castle take turns through what they have to say. */
const chatTurn = new Map<string, number>();
for (const st of STUDENTS) {
  DIALOGUES[`chat-${st.speaker}`] = async ({ say, state }) => {
    const lines = st.lines(state);
    const i = (chatTurn.get(st.speaker) ?? 0) % lines.length;
    chatTurn.set(st.speaker, i + 1);
    await say([{ speaker: st.speaker, text: lines[i] }]);
  };
}
