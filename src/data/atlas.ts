/**
 * Where every placed card and secret is, by level and area: what Snoop's Map shows. Generated
 * from the level data (tests/e2e/m19-map.spec.ts checks it still matches; regenerate it
 * from there when a level gains or loses a card or secret).
 */
export interface AtlasEntry {
  level: string;
  name: string;
  areas: Record<string, string>;
  cards: { ref: string; area: string | null }[];
  secrets: { ref: string; area: string | null }[];
}

export const ATLAS: AtlasEntry[] = [
  {
    level: 'hub',
    name: 'Thistlewick Castle',
    areas: {
      hall: 'The Lantern Hall',
      cupboard: "Crumbleton's Cupboard",
      wellyard: 'The Well Yard',
      corridor: 'The Crooked Corridor',
      court: 'Hollyhock Court',
      gallery: 'The Long Gallery',
      yard: 'The Kitchen Yard',
      passage: 'The Forgotten Passage',
      orchard: 'The Kitchen Orchard',
      undercroft: 'The Undercroft',
      cellar: 'The Old Wine Cellar',
    },
    cards: [
      { ref: 'lantern-moth', area: 'hall' },
      { ref: 'pellam-fogg', area: 'hall' },
      { ref: 'mother-wortle', area: 'hall' },
      { ref: 'barnaby-gorse', area: 'corridor' },
      { ref: 'lumley-lockjaw', area: 'court' },
      { ref: 'grey-lady', area: 'court' },
      { ref: 'brass-mouse', area: 'hall' },
      { ref: 'griselda-gusset', area: 'court' },
      { ref: 'ambrose-wick', area: 'hall' },
      { ref: 'stair-sprite', area: 'undercroft' },
      { ref: 'silas-applegarth', area: 'orchard' },
      { ref: 'wilfred-dustpan', area: 'passage' },
    ],
    secrets: [
      { ref: 'hub-tapestry', area: 'hall' },
      { ref: 'hub-bookshelf', area: 'corridor' },
      { ref: 'hub-clock', area: 'court' },
      { ref: 'hub-storeroom', area: 'gallery' },
      { ref: 'hub-balcony', area: 'court' },
      { ref: 'hub-wick-ledge', area: 'hall' },
      { ref: 'hub-gallery-niche', area: 'gallery' },
      { ref: 'hub-under-stair', area: 'undercroft' },
      { ref: 'hub-orchard-shed', area: 'orchard' },
      { ref: 'hub-passage', area: 'passage' },
      { ref: 'hub-cellar', area: 'cellar' },
    ],
  },
  {
    level: 'trial',
    name: 'The Thwackwort Trial',
    areas: {
      antechamber: 'The Thwackwort Trial',
      blocks: 'The Shoving Room',
      run: 'The Gauntlet of Gates',
      garden: 'The Overgrown Garden',
      moat: 'The Clockwork Moat',
      leap: "The Sootling's Leap",
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'gnarling', area: 'garden' }],
    secrets: [{ ref: 'trial-ruin', area: 'garden' }],
  },
  {
    level: 'vault',
    name: 'The Latchkin Vaults',
    areas: {
      antechamber: 'The Latchkin Vaults',
      locks: 'The Lockwork Hall',
      pantry: 'The Snapcasket Pantry',
      shutters: 'The Shutter Run',
      great: 'The Great Vault',
      strongroom: 'The Strongroom',
      counting: 'The Counting House',
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'snapcasket', area: 'pantry' }],
    secrets: [{ ref: 'vault-pantry', area: 'pantry' }],
  },
  {
    level: 'tower',
    name: 'The Tumbledown Tower',
    areas: {
      base: 'The Tumbledown Tower',
      stair: 'The Toadstool Stair',
      bellfry: 'The Bellfry',
      roof: 'The Rooftops',
      weathercock: 'The Weathercock Run',
    },
    cards: [{ ref: 'bouncewort', area: 'bellfry' }],
    secrets: [{ ref: 'tower-bell', area: 'bellfry' }],
  },
  {
    level: 'catacombs',
    name: 'The Lamplit Catacombs',
    areas: {
      antechamber: 'The Lamplit Catacombs',
      bridge: 'The Glimmer Bridge',
      walls: 'The Hall of False Walls',
      lantern: "Lamplough's Lantern",
      crypt: 'The Ember Crypt',
      ossuary: 'The Moth Ossuary',
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'gloomwisp', area: 'walls' }],
    secrets: [{ ref: 'catacomb-alcove', area: 'walls' }],
  },
  {
    level: 'glasshouse',
    name: 'The Overgrown Glasshouse',
    areas: {
      shed: 'The Overgrown Glasshouse',
      maze: 'The Briar Maze',
      pond: 'The Lily Pond',
      palm: 'The Palm House',
      beds: 'The Snapweed Beds',
      heart: 'The Bramble Heart',
      hothouse: 'The Hothouse Pool',
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'ember-newt', area: 'pond' }],
    secrets: [{ ref: 'glasshouse-alcove', area: 'pond' }],
  },
  {
    level: 'grounds',
    name: 'The Castle Grounds',
    areas: {
      terrace: 'The Terrace',
      lawn: 'The Castle Grounds',
      lake: 'Fairweather Lake',
    },
    cards: [{ ref: 'isolde-fairweather', area: 'lake' }],
    secrets: [
      { ref: 'grounds-balcony', area: 'terrace' },
      { ref: 'grounds-folly', area: 'lake' },
    ],
  },
  {
    level: 'cisterns',
    name: 'The Flooded Cisterns',
    areas: {
      sluice: 'The Flooded Cisterns',
      canal: 'The Long Canal',
      ferry: 'The Floe Ferry',
      boiler: 'The Boiler Hall',
      frost: 'The Frost Hall',
      'sluice-canal': 'The Sluice Canal',
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'rime-toad', area: 'ferry' }],
    secrets: [{ ref: 'cistern-falls', area: 'ferry' }],
  },
  {
    level: 'clocktower',
    name: 'The Clock Tower',
    areas: { tower: 'The Clock Tower' },
    cards: [{ ref: 'cornelius-cogwhistle', area: 'tower' }],
    secrets: [{ ref: 'tower-nook', area: 'tower' }],
  },
  {
    level: 'clockworks',
    name: 'The Great Clockworks',
    areas: {
      gallery: 'The Escapement Gallery',
      shaft: 'The Weights Shaft',
      wheel: 'The Great Wheel',
      bell: 'The Bell Chamber',
      mainspring: 'The Mainspring',
      star: 'The Star Chamber',
    },
    cards: [{ ref: 'clockwork-owl', area: 'wheel' }],
    secrets: [{ ref: 'clockworks-alcove', area: 'wheel' }],
  },
  {
    level: 'upper',
    name: 'The First Floor',
    areas: {
      hall: 'The Long Hall',
      library: 'The Great Library',
      forbidden: 'The Forbidden Section',
      wing: 'The House Wing',
      leads: 'The Leads',
    },
    cards: [
      { ref: 'orla-vellum', area: 'library' },
      { ref: 'snapweed', area: 'forbidden' },
      { ref: 'chimney-imp', area: 'leads' },
    ],
    secrets: [
      { ref: 'upper-stacks', area: 'library' },
      { ref: 'upper-forbidden', area: 'forbidden' },
      { ref: 'upper-lookout', area: 'leads' },
    ],
  },
  {
    level: 'woods',
    name: 'The Old Woods',
    areas: {
      wicket: 'The Old Woods',
      dell: 'Mushroom Dell',
      canopy: 'The Canopy',
      hollow: 'The Hollow Log',
      brook: 'The Brook Shelf',
      oak: 'The Old Oak',
    },
    cards: [],
    secrets: [{ ref: 'woods-bough', area: 'oak' }],
  },
];
