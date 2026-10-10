import type { PortraitSpec } from './portraits';

export type SpeakerId = 'wendlebury' | 'lantern' | 'tansy' | 'moss' | 'gorse' | 'quince' | 'hopgood' | 'lamplough' | 'ashcombe' | 'coldharbour' | 'underbough' | 'sign' | 'pip' | 'oswin' | 'tilda' | 'hattie' | 'ned' | 'mabel';

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
  quince: {
    id: 'quince',
    name: 'Madam Quince',
    voice: 610,
    portrait: { bg: ['#cfe0d8', '#2f5a6a'], kind: 'person', skin: '#f0c9a0', robe: '#2f5a6a', hair: '#8a3a22', hat: 'tall', hatColor: '#24323f', glasses: true, prop: 'key', hairStyle: 'bun', collar: 'ruff', expression: 'smirk', jewel: '#c99a3e', eyes: '#3a6a5a' },
  },
  hopgood: {
    id: 'hopgood',
    name: 'Mr. Hopgood',
    voice: 480,
    portrait: { bg: ['#d8f0c0', '#3f7a4a'], kind: 'person', skin: '#f0c9a0', robe: '#3f7a4a', hair: '#d9822e', hat: 'cap', hatColor: '#b0362f', prop: 'wand', hairStyle: 'wild', collar: 'scarf', jewel: '#e8c25a', expression: 'smile', eyes: '#4a7a3a' },
  },
  lamplough: {
    id: 'lamplough',
    name: 'Mr. Lamplough',
    voice: 340,
    portrait: { bg: ['#2a3a5a', '#0e1220'], kind: 'person', skin: '#e8c8a8', robe: '#2a3a5a', hair: '#e8e2d0', hat: 'tall', hatColor: '#1e2638', glasses: true, beard: true, prop: 'wand', hairStyle: 'long', collar: 'plain', expression: 'kind', jewel: '#bfe8ff', eyes: '#5a7aa8' },
  },
  ashcombe: {
    id: 'ashcombe',
    name: 'Professor Ashcombe',
    voice: 400,
    portrait: { bg: ['#f2b07a', '#7a2a1a'], kind: 'person', skin: '#e2a982', robe: '#8a2a1a', hair: '#b8b0a8', hat: 'pointy', hatColor: '#3a1a12', prop: 'cauldron', hairStyle: 'bun', collar: 'scarf', expression: 'stern', jewel: '#ff8a3c', eyes: '#6a4a2a' },
  },
  coldharbour: {
    id: 'coldharbour',
    name: 'Madam Coldharbour',
    voice: 560,
    portrait: { bg: ['#d8eef8', '#2f4f6a'], kind: 'person', skin: '#f3dcc8', robe: '#2f4f6a', hair: '#f0f0f0', hat: 'tall', hatColor: '#1e3040', glasses: true, prop: 'wand', hairStyle: 'long', collar: 'ruff', expression: 'stern', jewel: '#9fe6ff', eyes: '#6a9ab8' },
  },
  underbough: {
    id: 'underbough',
    name: 'Professor Underbough',
    voice: 640,
    portrait: { bg: ['#e8f0ff', '#6a7a9a'], kind: 'person', skin: '#f0c9a0', robe: '#6a7a9a', hair: '#b86a3a', hat: 'pointy', hatColor: '#4a5a7a', prop: 'thistle', hairStyle: 'wild', collar: 'scarf', expression: 'smile', jewel: '#e8f0ff', eyes: '#5a7aa8' },
  },
  // First-years with quests (src/data/quests.ts).
  pip: {
    id: 'pip',
    name: 'Pip Fernsby',
    voice: 760,
    portrait: { bg: ['#d8e6f5', '#4f7fb8'], kind: 'person', skin: '#f3d2b4', robe: '#2c2a3a', hair: '#e8c060', hat: 'none', prop: 'none', hairStyle: 'wild', collar: 'scarf', jewel: '#4f7fb8', expression: 'smile', eyes: '#4a6a9a' },
  },
  oswin: {
    id: 'oswin',
    name: 'Oswin Pellbright',
    voice: 560,
    portrait: { bg: ['#d8ecd0', '#3f7a4a'], kind: 'person', skin: '#c98e6a', robe: '#2c2a3a', hair: '#2a1e18', hat: 'none', glasses: true, prop: 'book', hairStyle: 'short', collar: 'scarf', jewel: '#3f7a4a', expression: 'kind' },
  },
  tilda: {
    id: 'tilda',
    name: 'Tilda Marchbank',
    voice: 820,
    portrait: { bg: ['#f5e0c0', '#d9922e'], kind: 'person', skin: '#f0c9a0', robe: '#2c2a3a', hair: '#8a3a22', hat: 'none', prop: 'none', hairStyle: 'long', collar: 'scarf', jewel: '#d9922e', expression: 'smile', eyes: '#3a6a3a' },
  },
  hattie: {
    id: 'hattie',
    name: 'Hattie Quickfoot',
    voice: 700,
    portrait: { bg: ['#f2d0c8', '#b0362f'], kind: 'person', skin: '#8a5a3e', robe: '#2c2a3a', hair: '#1e1612', hat: 'none', prop: 'none', hairStyle: 'bun', collar: 'scarf', jewel: '#b0362f', expression: 'smirk' },
  },
  ned: {
    id: 'ned',
    name: 'Ned Ashgrove',
    voice: 480,
    portrait: { bg: ['#d8e6f5', '#4f7fb8'], kind: 'person', skin: '#e8b48e', robe: '#2c2a3a', hair: '#b86a3a', hat: 'cap', hatColor: '#4f6a3a', prop: 'none', hairStyle: 'short', collar: 'scarf', jewel: '#4f7fb8', expression: 'smile' },
  },
  mabel: {
    id: 'mabel',
    name: 'Mabel Inchcombe',
    voice: 880,
    portrait: { bg: ['#d8ecd0', '#3f7a4a'], kind: 'person', skin: '#f3d2b4', robe: '#2c2a3a', hair: '#d8b880', hat: 'none', glasses: true, prop: 'none', hairStyle: 'bun', collar: 'scarf', jewel: '#3f7a4a', expression: 'kind', eyes: '#6a4a2a' },
  },
  sign: {
    id: 'sign',
    name: '',
    voice: 0,
    portrait: { bg: ['#f3e4c4', '#d9c18f'], kind: 'person', hat: 'none' },
  },
};
