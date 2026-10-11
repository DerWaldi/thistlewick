import type { EntitySpec, NpcLook } from '../entities/types';
import type { LevelDef } from '../world/level';
import type { GameState } from '../state/gameState';
import type { SpeakerId } from './characters';
import { HOUSES } from './houses';
import type { SpellId } from './spells';
import type { SweetKind } from './sweets';

/**
 * Errands for fellow first-years. A student appears at a named NPC spot (LevelDef.npcSpots)
 * once the lesson in `after` is done, asks for something lost somewhere that needs that
 * lesson's spell (and earlier ones) to reach, and rewards you when you bring it back.
 *
 * Progress is in flags: `quest:<id>` (accepted), `quest:<id>:found`, `quest:<id>:done`.
 * The item itself is a `questItem` entity placed by the level that hides it.
 */
export type QuestItemKind = 'kite' | 'book' | 'toad' | 'hat' | 'float' | 'hedgehog' | 'scarf' | 'watch';

export interface QuestDef {
  id: string;
  giver: SpeakerId;
  look: NpcLook;
  /** Where the student waits: a level and one of its npcSpots. */
  at: { level: string; spot: string };
  after: SpellId;
  title: string;
  item: { kind: QuestItemKind; name: string };
  /** One line for the quest log. */
  goal: string;
  offer: string[];
  waiting: string;
  thanks: string[];
  afterwards: string;
  reward: { sweets?: [SweetKind, number][]; card?: string };
}

const robe = '#2c2a3a';
const scarf = (h: keyof typeof HOUSES) => ({ robe, scarf: HOUSES[h].color, trim: HOUSES[h].trim, scale: 0.95 });

export const QUESTS: QuestDef[] = [
  {
    id: 'kite',
    giver: 'pip',
    look: { ...scarf('mallowmere'), hair: '#e8c060', hairStyle: 'wild', hatStyle: 'none' },
    at: { level: 'hub', spot: 'courtFountain' },
    after: 'thwackwort',
    title: "Pip's Kite",
    item: { kind: 'kite', name: "Pip's kite" },
    goal: 'Pip lost a kite over Hollyhock Court. It came down on the north wall, behind the clock.',
    offer: [
      "Oh! Hello! You haven't seen a kite, have you? Blue, with a long tail? It's very handsome. It was, anyway.",
      'The wind took it right over the cloister and it came down on top of the north wall, by the clock. I tried climbing. I am not a climber.',
    ],
    waiting: "It's up on the north wall, behind the clock. You get up there from the cloister roof, I think. Somehow.",
    thanks: [
      'My kite! And hardly bent! You climbed all the way up there? Gosh.',
      "Here, have this. It's a card of the man who invented kites that fly themselves. Mine clearly takes after him.",
    ],
    afterwards: "I've tied it to my wrist now. Twice. Gorse says it's a hazard. Gorse says lots of things are hazards.",
    reward: { card: 'ignatius-peel', sweets: [['bramble', 2]] },
  },
  {
    id: 'book',
    giver: 'oswin',
    look: { ...scarf('nettleby'), hair: '#2a1e18', hairStyle: 'tufts', hatStyle: 'none', glasses: true, skin: '#c98e6a' },
    at: { level: 'upper', spot: 'readingTable' },
    after: 'springwell',
    title: "Oswin's Overdue Book",
    item: { kind: 'book', name: 'A Short History of Very Long Ladders' },
    goal: 'Oswin\'s library book is on top of the tall bookcases in the Great Library. The rune tiles on the mezzanine might help.',
    offer: [
      "Psst. Over here. Quietly. I've got a problem, and the librarian mustn't know about it.",
      "I was reading on the mezzanine and I may have, er, thrown my book. At a moth. It landed on top of the big bookcases on the north wall. It's due back tomorrow.",
      "There are old rune tiles up on the mezzanine. Hopgood says the librarians used to bounce up to the top shelves before ladders were invented. Could you...?",
    ],
    waiting: 'On top of the tall bookcases, north wall. The rune tiles on the mezzanine! Spring them and bounce. Quietly.',
    thanks: [
      "You got it! 'A Short History of Very Long Ladders'. I see the irony. Please don't point it out.",
      "Here, I've been saving these. Don't tell the librarian I had sweets in the library either.",
    ],
    afterwards: "Chapter nine is about a ladder so long they had to put a café halfway up. I'm reading slower now. To make it last.",
    reward: { sweets: [['humbug', 1], ['bramble', 3]] },
  },
  {
    id: 'toad',
    giver: 'tilda',
    look: { ...scarf('yarrowdown'), hair: '#8a3a22', hairStyle: 'long', hatStyle: 'none' },
    at: { level: 'hub', spot: 'hallStairFoot' },
    after: 'glimmerwick',
    title: "Tilda's Toad",
    item: { kind: 'toad', name: 'Gherkin the toad' },
    goal: 'Gherkin the toad hopped down the spiral stair into the Undercroft. He likes the dark, and the far end of the corridor.',
    offer: [
      "Have you seen a toad? About this big, green, looks permanently disappointed? His name is Gherkin.",
      'He hopped down the spiral stair to the Undercroft and I lost him in the dark. He always goes for the darkest corner he can find. He thinks it is cosy.',
    ],
    waiting: "Down the spiral stair, in the Undercroft. Somewhere dark. Gherkin can't resist dark. Bring a light! Well, be a light.",
    thanks: [
      "GHERKIN! Oh, you silly thing. Look at him. He's not even sorry.",
      'Thank you so much. Have some sweets. Gherkin would thank you too, but he only says one thing, and it is rude.',
    ],
    afterwards: 'Gherkin is in my pocket now. He says hello. Well. He says the other thing.',
    reward: { sweets: [['humbug', 1], ['bramble', 2]] },
  },
  {
    id: 'hat',
    giver: 'hattie',
    look: { ...scarf('bramblecote'), hair: '#1e1612', hairStyle: 'bun', hatStyle: 'none', skin: '#8a5a3e', expression: 'cheeky' },
    at: { level: 'hub', spot: 'courtCloisterEast' },
    after: 'cindersnap',
    title: "Hattie's Hat",
    item: { kind: 'hat', name: "Hattie's hat" },
    goal: "Hattie's hat blew onto the old dovecote in the Well Yard, through the court's south-east gate. Climb the junk: shed, walkway, annex, tower.",
    offer: [
      "You! You're the one who does all the jumping about. I need a jumper. Somebody who jumps. Not the knitted kind.",
      "My hat blew off in the court and over into the Well Yard, and landed right on top of the old dovecote. All the way up. It's my GOOD hat.",
      "The Well Yard gate is the one with the lock frozen solid. You do fire now, don't you? There's junk piled all over that yard. Some of it might be climbable.",
    ],
    waiting: 'Through the Well Yard gate, the south-east corner of the court. Up the junk to the top of the old dovecote. My hat is right at the top.',
    thanks: [
      "My hat! Still pointy! You're a marvel.",
      "Here. I won these off a Nettleby at cards. They're probably cursed, but only a little.",
    ],
    afterwards: "I've sewn a chin-strap on it. It looks ridiculous. It's staying on, though.",
    reward: { sweets: [['humbug', 2], ['bramble', 2]] },
  },
  {
    id: 'float',
    giver: 'ned',
    look: { ...scarf('mallowmere'), hair: '#b86a3a', hairStyle: 'tufts', hatStyle: 'cap', hat: '#4f6a3a', skin: '#e8b48e' },
    at: { level: 'grounds', spot: 'jetty' },
    after: 'rimewhistle',
    title: "Ned's Lucky Float",
    item: { kind: 'float', name: "Ned's lucky float" },
    goal: "Ned's lucky fishing float drifted into the reeds on the far east shore of the lake. Freeze a way across.",
    offer: [
      "Morning. You wouldn't happen to be good at walking on water? Only, everyone says you've been freezing things.",
      "My lucky float came off the line and drifted all the way over to the reeds on the far east shore. I've never caught a thing without it. Mind you, I've never caught a thing with it either.",
    ],
    waiting: 'Over in the reeds, east end of the lake. Past the old posts in the water. You can freeze the water between them, can\'t you?',
    thanks: [
      'My float! Bobbing like nothing happened. Thank you!',
      "My grandad gave me this card when I started fishing. Old Captain Rooke, the ferryman. You have it. You've earned it more than me.",
    ],
    afterwards: "Still haven't caught anything. But I feel lucky now. That's half of fishing, my grandad says. The other half is fish.",
    reward: { card: 'ebbing-rooke', sweets: [['bramble', 3]] },
  },
  {
    id: 'hedgehog',
    giver: 'mabel',
    look: { ...scarf('nettleby'), hair: '#d8b880', hairStyle: 'bun', hatStyle: 'none', glasses: true },
    at: { level: 'grounds', spot: 'oldWoodsGate' },
    after: 'thistledown',
    title: "Mabel's Hedgehog",
    item: { kind: 'hedgehog', name: 'Thimble the hedgehog' },
    goal: 'Thimble the hedgehog wandered into the Old Woods, through the gate on the east side of the grounds. The way in is a long one.',
    offer: [
      "Oh, thank goodness, a person. I've lost Thimble. My hedgehog. She went under the gate into the Old Woods and she hasn't come back.",
      "Pupils aren't allowed in the Old Woods, except... well, you've done all seven lessons, haven't you? Mother Hazelrigg's old paths go right through the trees. Up through them, mostly.",
      'Please find her? She likes the very middle of the woods, where the oldest tree is. She thinks it is hers.',
    ],
    waiting: 'Through the gate, deep into the Old Woods. Thimble will be by the oldest tree, right in the middle. Be careful, the woods are full of things that bite.',
    thanks: [
      "Thimble! You prickly little wanderer! Oh, she's fine. She's eaten something. She looks very pleased with herself.",
      "This card was my gran's. Mother Hazelrigg, who planted the Old Woods. I think she'd want it to go to the person who got all the way to the middle.",
    ],
    afterwards: 'Thimble has a little lead now. She hates it. She also hates hats, rain and Tuesdays. She loves you, though.',
    reward: { card: 'mother-hazelrigg', sweets: [['humbug', 2]] },
  },
  {
    id: 'scarf',
    giver: 'wren',
    look: { ...scarf('yarrowdown'), hair: '#c8642e', hairStyle: 'long', hatStyle: 'none', skin: '#e8b48e' },
    at: { level: 'hub', spot: 'courtCloisterWest' },
    after: 'springwell',
    title: "Wren's Scarf",
    item: { kind: 'scarf', name: "Wren's scarf" },
    goal: "Wren's scarf blew up onto the little balcony high on the court's west wall. The moss on the cloister roof is springy, if you spring it.",
    offer: [
      "Excuse me, you haven't got a ladder? A very tall one? No. Nobody does.",
      'My scarf blew off and landed on that balcony, up on the west wall of the court. My nan knitted it. It has my name on it. Twice, in case I forget.',
    ],
    waiting: "Up on the balcony, west wall of the court. There's moss on the cloister roof underneath it. Mr. Hopgood says moss is just a spring that hasn't been told yet.",
    thanks: ['My scarf! And not even a pigeon on it. Thank you!', "Here. They're the last of my sweets from home. Worth it."],
    afterwards: "I've tied it in a double knot. Nan would be proud. Or worried. Both, probably.",
    reward: { sweets: [['humbug', 1], ['bramble', 3]] },
  },
  {
    id: 'watch',
    giver: 'otto',
    look: { ...scarf('bramblecote'), hair: '#5a3a22', hairStyle: 'tufts', hatStyle: 'none', glasses: true },
    at: { level: 'upper', spot: 'wingCorridor' },
    after: 'thistledown',
    title: "Otto's Pocket Watch",
    item: { kind: 'watch', name: "Otto's pocket watch" },
    goal: 'Otto left his pocket watch on top of the old observatory, out on the Leads. The crate by the drum floats up, if you ask it nicely.',
    offer: [
      "Do you have the time? No, really, I need to know. I've lost my watch. It was my grandfather's, and he was never on time either.",
      'I was up on the observatory on the Leads, stargazing. Strictly against the rules. I put it down to look through the telescope and then I had to leave quickly.',
    ],
    waiting: "On top of the observatory on the Leads. There's a crate by its drum that floats, once you've done Airs & Graces. I hadn't, so I climbed. Badly.",
    thanks: ['My watch! Still ticking. Still four minutes slow. Thank you!', 'Have these. And a tip: the Leads are prettier at night. Not that I would know.'],
    afterwards: "It's twenty past something. Probably.",
    reward: { sweets: [['humbug', 2], ['bramble', 2]] },
  },
];

/** Npc specs for the students waiting in this level (once their lesson is done). */
export function questGivers(def: LevelDef, state: GameState): EntitySpec[] {
  return QUESTS.filter((q) => q.at.level === def.id && questStage(state, q) !== 'locked').flatMap((q) => {
    const spot = def.npcSpots?.[q.at.spot];
    return spot ? [{ type: 'npc' as const, speaker: q.giver, pos: spot.pos, yaw: spot.yaw, look: q.look, talk: `quest-${q.id}`, quest: q.id }] : [];
  });
}

export const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export type QuestStage = 'locked' | 'offered' | 'active' | 'found' | 'done';

export function questStage(state: GameState, q: QuestDef): QuestStage {
  if (state.flags.has(`quest:${q.id}:done`)) return 'done';
  if (state.flags.has(`quest:${q.id}:found`)) return 'found';
  if (state.flags.has(`quest:${q.id}`)) return 'active';
  return state.lessons.has(q.after) ? 'offered' : 'locked';
}
