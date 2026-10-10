import type { PortraitSpec } from './portraits';

export type SpeakerId = 'wendlebury' | 'lantern' | 'tansy' | 'moss' | 'gorse' | 'sign';

export interface SpeakerDef {
  id: SpeakerId;
  name: string;
  /** Base pitch for the little typewriter blips. */
  voice: number;
  portrait: PortraitSpec;
}

export const SPEAKERS: Record<SpeakerId, SpeakerDef> = {
  wendlebury: {
    id: 'wendlebury',
    name: 'Headmistress Wendlebury',
    voice: 520,
    portrait: { bg: ['#e8d0f0', '#7a4f8a'], kind: 'person', skin: '#f0c9a0', robe: '#5d4470', hair: '#e8e8e8', hat: 'pointy', hatColor: '#3b2c55', glasses: true, prop: 'none', hairStyle: 'bun', collar: 'ruff', expression: 'kind', jewel: '#7a4fb0', eyes: '#4a6a9a' },
  },
  lantern: {
    id: 'lantern',
    name: 'The Sorting Lantern',
    voice: 300,
    portrait: { bg: ['#3a2c1e', '#120c08'], kind: 'lantern' },
  },
  tansy: {
    id: 'tansy',
    name: 'Tansy Crumbleton',
    voice: 700,
    portrait: { bg: ['#f5d8a8', '#c97a3a'], kind: 'person', skin: '#f3d2b4', robe: '#d9922e', hair: '#c8642e', hat: 'none', prop: 'none', hairStyle: 'long', collar: 'scarf', jewel: '#b0362f', expression: 'smirk' },
  },
  moss: {
    id: 'moss',
    name: 'Moss Crumbleton',
    voice: 440,
    portrait: { bg: ['#cde8b8', '#4f7a3a'], kind: 'person', skin: '#f3d2b4', robe: '#3f7a4a', hair: '#c8642e', hat: 'cap', hatColor: '#6b3f4f', prop: 'none', hairStyle: 'wild', expression: 'smirk', eyes: '#6a4a2a' },
  },
  gorse: {
    id: 'gorse',
    name: 'Professor Gorse',
    voice: 260,
    portrait: { bg: ['#f2c49a', '#a0522d'], kind: 'person', skin: '#e2a982', robe: '#a0522d', hair: '#e8e2d0', hat: 'none', beard: true, prop: 'wand', hairStyle: 'bald', expression: 'kind', eyes: '#4a6a9a' },
  },
  sign: {
    id: 'sign',
    name: '',
    voice: 0,
    portrait: { bg: ['#f3e4c4', '#d9c18f'], kind: 'person', hat: 'none' },
  },
};
