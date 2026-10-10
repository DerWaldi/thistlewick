import type { PortraitSpec } from './portraits';

export type CardSet = 'Founders' | 'Oddballs' | 'Creatures';

export interface CardDef {
  id: string;
  number: number;
  name: string;
  title: string;
  set: CardSet;
  /** Card-back flavour text. */
  text: string;
  /** Where to find it, shown once found (and as a riddle-ish hint once the hint map exists). */
  hint: string;
  portrait: PortraitSpec;
}

const FOUNDER_BG: [string, string] = ['#f2d48a', '#b9823e'];
const ODDBALL_BG: [string, string] = ['#c9b6e8', '#6e4f9a'];
const CREATURE_BG: [string, string] = ['#b8e0a8', '#4f8a5a'];

/** The Fabled Folk collection. Numbers are fixed once released; new cards go on the end. */
export const CARDS: CardDef[] = [
  {
    id: 'mother-wortle',
    number: 1,
    name: 'Mother Wortle',
    title: 'Inventor of the Self-Stirring Cauldron',
    set: 'Founders',
    text: 'Grew tired of stirring and simply asked the cauldron to do it. It has never stopped since, which is why the kitchens smell of soup on Tuesdays.',
    hint: 'Behind a tapestry that sways when no wind blows.',
    portrait: { bg: FOUNDER_BG, kind: 'person', skin: '#e8b48e', robe: '#5a6a3a', hair: '#d8d8d8', hat: 'bonnet', hatColor: '#efe6d2', prop: 'cauldron', expression: 'kind', collar: 'scarf', jewel: '#7a8a3a' },
  },
  {
    id: 'pellam-fogg',
    number: 2,
    name: 'Sir Pellam Fogg',
    title: 'Founder by Wager',
    set: 'Founders',
    text: 'Founded Thistlewick to win a bet he could not afterwards remember making. He insisted on paying up anyway, which is the sort of man he was.',
    hint: 'High in the Lantern Hall, where only the bold go hopping.',
    portrait: { bg: FOUNDER_BG, kind: 'person', skin: '#f0c9a0', robe: '#7a2f3a', hair: '#8a5a36', hat: 'tall', hatColor: '#2b1d14', beard: true, prop: 'scroll', collar: 'ruff', expression: 'stern', jewel: '#b0362f' },
  },
  {
    id: 'agnes-thistlewick',
    number: 3,
    name: 'Old Agnes Thistlewick',
    title: 'Who Planted the First Thistle',
    set: 'Founders',
    text: 'Planted a single thistle on a bare hill and told it to grow a school. It took three hundred years, but thistles are patient.',
    hint: 'A reward for a Practical Charms trial well done.',
    portrait: { bg: FOUNDER_BG, kind: 'person', skin: '#d9a07a', robe: '#4a2c4f', hair: '#bfbfbf', hat: 'pointy', hatColor: '#4a2c4f', glasses: true, prop: 'thistle', hairStyle: 'long', collar: 'ruff', jewel: '#9a4fa0' },
  },
  {
    id: 'grey-lady',
    number: 4,
    name: 'The Grey Lady of Hobb’s Mire',
    title: 'Resident Ghost (Unofficial)',
    set: 'Oddballs',
    text: 'Haunts the clock tower and corrects anyone who whistles out of tune. Prefers to be called Margery.',
    hint: 'Behind the courtyard clock, if you can climb that high.',
    portrait: { bg: ['#d8e4ea', '#7a8a9a'], kind: 'ghost' },
  },
  {
    id: 'barnaby-gorse',
    number: 5,
    name: 'Barnaby Gorse',
    title: 'Wand-Toss Champion, 1952',
    set: 'Oddballs',
    text: 'Before he taught Practical Charms he could throw a wand clean over the East Tower. He still checks the sky for it sometimes.',
    hint: 'Shelved away in the Crooked Corridor. Knock and it shall open.',
    portrait: { bg: ODDBALL_BG, kind: 'person', skin: '#e2a982', robe: '#a0522d', hair: '#e8e2d0', hat: 'none', beard: true, prop: 'wand', hairStyle: 'bald', expression: 'kind', eyes: '#4a6a9a' },
  },
  {
    id: 'ezekiel-crumbleton',
    number: 6,
    name: 'Ezekiel Crumbleton',
    title: 'Inventor of the Bottomless Pocket (Mostly)',
    set: 'Oddballs',
    text: 'The pocket has a bottom. It is simply very far down, and occasionally returns things that were never put in.',
    hint: 'Sold, with a wink, at Crumbleton’s Cupboard.',
    portrait: { bg: ODDBALL_BG, kind: 'person', skin: '#f0c9a0', robe: '#2f5a6a', hair: '#c8642e', hat: 'cap', hatColor: '#6b3f4f', prop: 'pocket', hairStyle: 'wild', expression: 'smirk', collar: 'scarf', jewel: '#c99a3e' },
  },
  {
    id: 'hester-quillfeather',
    number: 7,
    name: 'Hester Quillfeather',
    title: 'Author of Every School Rule',
    set: 'Oddballs',
    text: 'Wrote down every rule of Thistlewick in one enormous book, then lost the book. The school has been making it up ever since.',
    hint: 'Sold, with a wink, at Crumbleton’s Cupboard.',
    portrait: { bg: ODDBALL_BG, kind: 'person', skin: '#f3d2b4', robe: '#2b2b4a', hair: '#3a2617', hat: 'pointy', hatColor: '#2b2b4a', glasses: true, prop: 'book', hairStyle: 'long', expression: 'stern', eyes: '#6a4a2a' },
  },
  {
    id: 'gnarling',
    number: 8,
    name: 'The Gnarling',
    title: 'Common Root-Goblin',
    set: 'Creatures',
    text: 'Steals bootlaces to line its nest. Harmless, mostly, if you keep your feet out of the flowerbeds.',
    hint: 'Earned the hard way in the Thwackwort Trial.',
    portrait: { bg: CREATURE_BG, kind: 'gnarling' },
  },
  {
    id: 'puddlewump',
    number: 9,
    name: 'The Puddlewump',
    title: 'Hums When It Rains',
    set: 'Creatures',
    text: 'A pond-dweller the size of a teapot. Hums a different tune for every kind of rain. Nobody has heard the snow song and lived to hum it.',
    hint: 'Sold, with a wink, at Crumbleton’s Cupboard.',
    portrait: { bg: ['#b8d8f0', '#3f6f9a'], kind: 'puddlewump' },
  },
  {
    id: 'lantern-moth',
    number: 10,
    name: 'The Lantern Moth',
    title: 'Patron of Late Readers',
    set: 'Creatures',
    text: 'Follows anyone carrying both a candle and something to read. Will sit on the page you are on, which is helpful until you need to turn it.',
    hint: 'Atop the great chandelier of the Lantern Hall.',
    portrait: { bg: ['#f5e6b8', '#9a6a2e'], kind: 'moth' },
  },
  {
    id: 'lumley-lockjaw',
    number: 11,
    name: 'Lumley Lockjaw',
    title: 'Locksmith to Three Kings and a Duck',
    set: 'Founders',
    text: 'Built every lock in Thistlewick and hid each key somewhere only he would think of. He has since forgotten all of them, and says it is the happiest he has ever been.',
    hint: 'Locked away in Hollyhock Court, until you learn to ask nicely.',
    portrait: { bg: FOUNDER_BG, kind: 'person', skin: '#e8b48e', robe: '#3a4a5a', hair: '#9a9a9a', hat: 'cap', hatColor: '#5a3a22', beard: true, prop: 'key', hairStyle: 'short', collar: 'plain', expression: 'smile', jewel: '#c99a3e' },
  },
  {
    id: 'ottoline-quince',
    number: 12,
    name: 'Ottoline Quince',
    title: 'Never Met a Lock She Couldn’t Talk Round',
    set: 'Oddballs',
    text: 'Once talked the Royal Treasury open with nothing but a compliment and a cough drop. She gave everything back, alphabetised.',
    hint: 'A reward for a Locks & Latches trial well done.',
    portrait: { bg: ODDBALL_BG, kind: 'person', skin: '#f0c9a0', robe: '#2f5a6a', hair: '#8a3a22', hat: 'tall', hatColor: '#24323f', glasses: true, prop: 'key', hairStyle: 'bun', collar: 'ruff', expression: 'smirk', jewel: '#c99a3e', eyes: '#3a6a5a' },
  },
  {
    id: 'snapcasket',
    number: 13,
    name: 'The Snapcasket',
    title: 'A Chest With Opinions',
    set: 'Creatures',
    text: 'Looks like a perfectly good chest. Is not. Always check for teeth before storing your socks.',
    hint: 'Hidden behind a loose brick, deep in the Latchkin Vaults.',
    portrait: { bg: ['#e8c9a0', '#7a4a26'], kind: 'snapcasket' },
  },
  {
    id: 'brass-mouse',
    number: 14,
    name: 'The Brass Mouse',
    title: 'Collector of Keys',
    set: 'Creatures',
    text: 'A clockwork mouse that gathers keys and never, ever gives them back. Somewhere in the walls it has a nest of nine hundred.',
    hint: 'In a padlocked cabinet in the Lantern Hall.',
    portrait: { bg: ['#f2e2b8', '#8a6a3a'], kind: 'mouse' },
  },
  {
    id: 'griselda-gusset',
    number: 15,
    name: 'Griselda Gusset',
    title: 'Inventor of the Upward Staircase',
    set: 'Founders',
    text: 'Built a staircase that only goes up. It is still going. Nobody has reached the top, but the view is said to be marvellous.',
    hint: 'On the courtyard balcony nobody can reach.',
    portrait: { bg: FOUNDER_BG, kind: 'person', skin: '#f3d2b4', robe: '#6a4a8a', hair: '#c8642e', hat: 'pointy', hatColor: '#4a2c5f', hairStyle: 'long', collar: 'ruff', expression: 'smirk', jewel: '#8ef06a', prop: 'scroll' },
  },
  {
    id: 'tobias-hopgood',
    number: 16,
    name: 'Tobias Hopgood',
    title: 'Fell Upstairs, Professionally',
    set: 'Oddballs',
    text: 'Has never once used the stairs. Holds the castle record for the highest bounce, set the day the Bellfry mattresses were delivered.',
    hint: 'A reward for a Leaps & Bounds trial well done.',
    portrait: { bg: ODDBALL_BG, kind: 'person', skin: '#f0c9a0', robe: '#3f7a4a', hair: '#d9822e', hat: 'cap', hatColor: '#b0362f', prop: 'wand', hairStyle: 'wild', collar: 'scarf', jewel: '#e8c25a', expression: 'smile', eyes: '#4a7a3a' },
  },
  {
    id: 'bouncewort',
    number: 17,
    name: 'The Bouncewort',
    title: 'A Toadstool With Ambitions',
    set: 'Creatures',
    text: 'Grows only where something once landed very hard. Its spores are spring-loaded. Do not sit on one, however tempting it looks.',
    hint: 'Atop the great bell of the Tumbledown Tower.',
    portrait: { bg: ['#d8f0c0', '#4f7a3a'], kind: 'mushroom' },
  },
];

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
