export type HouseId = 'bramblecote' | 'mallowmere' | 'nettleby' | 'yarrowdown';

export interface HouseDef {
  id: HouseId;
  name: string;
  /** Scarf, banner and hourglass colour. */
  color: string;
  trim: string;
  motto: string;
  virtue: string;
}

export const HOUSES: Record<HouseId, HouseDef> = {
  bramblecote: {
    id: 'bramblecote',
    name: 'Bramblecote',
    color: '#b0362f',
    trim: '#e8c25a',
    motto: 'Through the thorns',
    virtue: 'bold and stubborn',
  },
  mallowmere: {
    id: 'mallowmere',
    name: 'Mallowmere',
    color: '#4f7fb8',
    trim: '#e6eef5',
    motto: 'Still waters, warm hearts',
    virtue: 'gentle and loyal',
  },
  nettleby: {
    id: 'nettleby',
    name: 'Nettleby',
    color: '#3f7a4a',
    trim: '#efe3c0',
    motto: 'Sting first, think twice',
    virtue: 'sharp-witted and curious',
  },
  yarrowdown: {
    id: 'yarrowdown',
    name: 'Yarrowdown',
    color: '#d9922e',
    trim: '#5a3a1e',
    motto: 'Rooted, ready, right',
    virtue: 'steadfast and kind',
  },
};

export const HOUSE_ORDER: HouseId[] = ['bramblecote', 'mallowmere', 'nettleby', 'yarrowdown'];

/** What earns house points. */
export const POINTS = {
  lesson: 50,
  star: 30,
  secret: 10,
  card: 5,
  stunMidAir: 5,
  rattlecoat: 10,
};

/** The Sorting Lantern's questions. Each answer leans towards one house. */
export const SORTING_QUESTIONS: { q: string; answers: { text: string; house: HouseId }[] }[] = [
  {
    q: 'A Gnarling has run off with your bootlace. Do you...',
    answers: [
      { text: 'Chase it straight into the hedge.', house: 'bramblecote' },
      { text: 'Leave it a biscuit and ask nicely.', house: 'mallowmere' },
      { text: 'Set a cunning trap with the other lace.', house: 'nettleby' },
      { text: "Wait. It'll be back for the other one.", house: 'yarrowdown' },
    ],
  },
  {
    q: 'Which smell do you like best?',
    answers: [
      { text: 'Bonfire smoke.', house: 'bramblecote' },
      { text: 'Fresh bread.', house: 'mallowmere' },
      { text: 'Old books.', house: 'nettleby' },
      { text: 'Rain on warm stones.', house: 'yarrowdown' },
    ],
  },
  {
    q: 'The staircase has wandered off again. Do you...',
    answers: [
      { text: 'Jump for it.', house: 'bramblecote' },
      { text: 'Help the lost second-year first.', house: 'mallowmere' },
      { text: 'Work out where it goes on Tuesdays.', house: 'nettleby' },
      { text: "Take the long way round. It's a nice walk.", house: 'yarrowdown' },
    ],
  },
];
