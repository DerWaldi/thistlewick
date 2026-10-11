/**
 * Crumbleton's Cupboard stock. Prices are in sweet value (Fizzwort 1, Bonbon 5,
 * Humbug 25). The slice has roughly 200 sweets' worth to find, enough for a
 * thorough player to buy everything (185).
 */
import { CARD_BY_ID } from './cards';
import type { SpellId } from './spells';

export type UpgradeId = 'stout-heart' | 'quick-wand' | 'sweet-tooth' | 'snoops-map';

export interface ShopItem {
  id: string;
  kind: 'card' | 'upgrade';
  /** Card id or upgrade id. */
  ref: string;
  name: string;
  price: number;
  blurb: string;
  /** Not for sale yet (shown greyed out). */
  soon?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'card-ezekiel', kind: 'card', ref: 'ezekiel-crumbleton', name: 'Fabled Folk: Ezekiel Crumbleton', price: 120, blurb: "Our great-grandad! Family discount: none." },
  { id: 'card-hester', kind: 'card', ref: 'hester-quillfeather', name: 'Fabled Folk: Hester Quillfeather', price: 120, blurb: 'Slightly creased. The rules she wrote are worse.' },
  { id: 'card-puddlewump', kind: 'card', ref: 'puddlewump', name: 'Fabled Folk: The Puddlewump', price: 120, blurb: 'Hums if you hold it near a window. Allegedly.' },
  { id: 'up-stout', kind: 'upgrade', ref: 'stout-heart', name: 'Stout Heart', price: 300, blurb: 'A lucky acorn on a string. One more stamina pip.' },
  { id: 'up-quick', kind: 'upgrade', ref: 'quick-wand', name: 'Quick Wand', price: 180, blurb: 'A wand-wax that makes charging Thwackwort much faster.' },
  { id: 'up-tooth', kind: 'upgrade', ref: 'sweet-tooth', name: 'Sweet Tooth Charm', price: 90, blurb: 'Sweets fly to you from twice as far away.' },
  { id: 'up-map', kind: 'upgrade', ref: 'snoops-map', name: "Snoop's Map", price: 220, blurb: 'Every room in the castle, and which of them still hide a card or a secret. Esc, then Map.' },
];

/**
 * Cards hidden inside a trial. Trials run once, so a card missed there turns up at
 * the Cupboard afterwards ("found lying about"), at a premium.
 */
export const LOST_AND_FOUND: { card: string; lesson: SpellId; blurb: string }[] = [
  { card: 'gnarling', lesson: 'thwackwort', blurb: 'Found it in the Trial garden. The Gnarling wanted it back. We said no.' },
  { card: 'snapcasket', lesson: 'latchkin', blurb: 'Came out of a chest in the Vaults. The chest is still annoyed.' },
  { card: 'bouncewort', lesson: 'springwell', blurb: 'Fell off the great bell in the Tower. Bounced twice.' },
  { card: 'gloomwisp', lesson: 'glimmerwick', blurb: 'Was hiding behind a wall in the Catacombs. Very nervous. Handle gently.' },
  { card: 'ember-newt', lesson: 'cindersnap', blurb: 'Crawled out of the Glasshouse and into our kettle. Still warm. So is the kettle.' },
  { card: 'rime-toad', lesson: 'rimewhistle', blurb: 'Found it sitting in our ice bucket. It seemed happy. We were not.' },
  { card: 'clockwork-owl', lesson: 'thistledown', blurb: 'Flew in through the window at four minutes past. It insists it was on time.' },
];

/** What's on the shelves for this player: the usual stock plus anything they missed in a finished trial. */
export function shopStock(state: { lessons: Set<string>; cards: Set<string> }): ShopItem[] {
  const lost = LOST_AND_FOUND.filter((l) => state.lessons.has(l.lesson) && !state.cards.has(l.card)).map(
    (l): ShopItem => ({ id: `lost-${l.card}`, kind: 'card', ref: l.card, name: `Lost & Found: ${CARD_BY_ID.get(l.card)?.name ?? l.card}`, price: 150, blurb: l.blurb }),
  );
  return [...lost, ...SHOP_ITEMS];
}

/** Effects of upgrades on play. */
export const UPGRADE_EFFECTS = {
  staminaBonus: { 'stout-heart': 1 } as Partial<Record<UpgradeId, number>>,
  chargeTimeScale: 0.55, // with Quick Wand
  magnetScale: 2, // with Sweet Tooth Charm
};
