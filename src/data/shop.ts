/**
 * Crumbleton's Cupboard stock. Prices are in sweet value (Fizzwort 1, Bonbon 5,
 * Humbug 25). The slice has roughly 200 sweets' worth to find, enough for a
 * thorough player to buy everything (185).
 */
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
  { id: 'card-ezekiel', kind: 'card', ref: 'ezekiel-crumbleton', name: 'Fabled Folk: Ezekiel Crumbleton', price: 25, blurb: "Our great-grandad! Family discount: none." },
  { id: 'card-hester', kind: 'card', ref: 'hester-quillfeather', name: 'Fabled Folk: Hester Quillfeather', price: 25, blurb: 'Slightly creased. The rules she wrote are worse.' },
  { id: 'card-puddlewump', kind: 'card', ref: 'puddlewump', name: 'Fabled Folk: The Puddlewump', price: 25, blurb: 'Hums if you hold it near a window. Allegedly.' },
  { id: 'up-stout', kind: 'upgrade', ref: 'stout-heart', name: 'Stout Heart', price: 50, blurb: 'A lucky acorn on a string. One more stamina pip.' },
  { id: 'up-quick', kind: 'upgrade', ref: 'quick-wand', name: 'Quick Wand', price: 35, blurb: 'A wand-wax that makes charging Thwackwort much faster.' },
  { id: 'up-tooth', kind: 'upgrade', ref: 'sweet-tooth', name: 'Sweet Tooth Charm', price: 25, blurb: 'Sweets fly to you from twice as far away.' },
  { id: 'up-map', kind: 'upgrade', ref: 'snoops-map', name: "Snoop's Map", price: 60, blurb: 'Shows where secrets hide. Moss is still drawing it.', soon: true },
];

/** Effects of upgrades on play. */
export const UPGRADE_EFFECTS = {
  staminaBonus: { 'stout-heart': 1 } as Partial<Record<UpgradeId, number>>,
  chargeTimeScale: 0.55, // with Quick Wand
  magnetScale: 2, // with Sweet Tooth Charm
};
