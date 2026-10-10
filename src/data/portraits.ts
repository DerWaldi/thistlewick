/**
 * Parameters for the procedural portrait painter (src/ui/portraits.ts). Used for
 * Fabled Folk cards and dialogue speakers.
 */
export interface PortraitSpec {
  /** Background gradient (top, bottom). */
  bg: [string, string];
  kind: 'person' | 'ghost' | 'gnarling' | 'puddlewump' | 'moth' | 'lantern' | 'snapcasket' | 'mouse' | 'mushroom' | 'wisp' | 'sprite' | 'newt';
  skin?: string;
  robe?: string;
  hair?: string;
  hat?: 'pointy' | 'tall' | 'bonnet' | 'cap' | 'none';
  hatColor?: string;
  beard?: boolean;
  glasses?: boolean;
  /** Small object held or floating beside them. */
  prop?: 'cauldron' | 'scroll' | 'key' | 'wand' | 'book' | 'thistle' | 'pocket' | 'none';
  hairStyle?: 'short' | 'long' | 'bun' | 'wild' | 'bald';
  collar?: 'ruff' | 'plain' | 'scarf';
  expression?: 'smile' | 'stern' | 'smirk' | 'kind';
  /** Brooch / jewel colour. */
  jewel?: string;
  eyes?: string;
}
