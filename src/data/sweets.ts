export type SweetKind = 'fizzwort' | 'bramble' | 'humbug';

export interface SweetDef {
  kind: SweetKind;
  name: string;
  value: number;
  color: string;
  /** Chime pitch for pickups (Hz). */
  pitch: number;
}

export const SWEETS: Record<SweetKind, SweetDef> = {
  fizzwort: { kind: 'fizzwort', name: 'Fizzwort Drop', value: 1, color: '#4fd6c0', pitch: 880 },
  bramble: { kind: 'bramble', name: 'Bramble Bonbon', value: 5, color: '#a24fd0', pitch: 660 },
  humbug: { kind: 'humbug', name: 'Gilded Humbug', value: 25, color: '#f5c04a', pitch: 523 },
};
