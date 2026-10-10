import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { bench, bush, crate, deco, Glow, grass, hollyhock, ivy, mushrooms, signboard, tree, urn, wall, windowPane } from '../../world/props';

/**
 * The Castle Grounds, out through the Lantern Hall's great doors (open once Cindersnap is
 * passed). Day. North is the castle; everything else runs downhill to the lake (+Z north):
 *
 *   Castle front    z 0..4      the facade, two towers, the great doors (back into the hall)
 *   Terrace         x -16..16, z -12..0, y 0   balustrade; the west tower's balcony (y 3.4)
 *                               with a frozen-waterfall climb (Rimewhistle) and a secret
 *   Lawn            x -50..50, z -42..-17, y -3   stairs down from the terrace; trees,
 *                               flower beds, a statue, benches; Coldharbour's boathouse
 *                               (x -40..-30, z -46..-36, door east) on the west shore; a
 *                               gated path east to the Old Woods (for later)
 *   Lake            x -50..50, z -90..-42, water y -3.6   a jetty (x 10..12) and three ice
 *                               sheets to the island folly (centre 22,-75) with a card
 */
export const GROUNDS: LevelDef = {
  id: 'grounds',
  name: 'The Castle Grounds',
  spawns: {
    default: { pos: [0, 0, -1.6], yaw: Math.PI },
    fromBoathouse: { pos: [-28.6, -3, -40], yaw: Math.PI / 2 },
  },
  areas: [
    { id: 'terrace', name: 'The Terrace', min: [-17, -1, -12.5], max: [17, 12, 0] },
    { id: 'lawn', name: 'The Castle Grounds', min: [-51, -4, -42], max: [51, 12, -12.5] },
    { id: 'lake', name: 'Fairweather Lake', min: [-51, -8, -92], max: [51, 12, -42] },
  ],
  build,
};

const LAWN = -3;
const WATER = -3.6;
const GRASS = '#7f9a5a';
const HEDGE = '#3f6a2a';

function build(b: LevelBuilder): void {
  b.killY = -14;
  const glow = new Glow();

  // ================================================================ the castle front and terrace
  b.floor(-17, 17, -12, 0, { color: COLORS.stoneLight });
  // The facade: a long wall with the great doors, towers at either end.
  wall(b, 'x', 0.5, -24, 24, 14, { holes: [{ from: -2, to: 2, top: 5.5 }], cap: 6 });
  for (const x of [-20, 20]) {
    b.cylinder([x, 8, -1], 4, 22, COLORS.stone, undefined, 12);
    deco(b, new ConeGeometry(4.8, 7, 12), [x, 22.5, -1], COLORS.roof);
  }
  for (const x of [-12, -6, 6, 12]) windowPane(b, glow, 'x', -0.02, x, 7, 1.6, 3, -1);
  deco(b, new BoxGeometry(5, 0.6, 0.6), [0, 5.8, -0.2], COLORS.stoneDark);
  b.add({ type: 'door', pos: [0, 0, -0.05], yaw: Math.PI, width: 4, height: 5.5, to: { level: 'hub', spawn: 'fromGrounds' }, label: 'The Lantern Hall' });
  // Balustrade round the terrace, open where the stairs go down.
  for (const [x0, x1] of [
    [-17, -3],
    [3, 17],
  ]) {
    wall(b, 'x', -12, x0, x1, 1, { thick: 0.5, color: COLORS.stoneLight, cap: 2 });
  }
  wall(b, 'z', -17, -12, 0.5, 1, { thick: 0.5, color: COLORS.stoneLight, cap: 2 });
  wall(b, 'z', 17, -12, 0.5, 1, { thick: 0.5, color: COLORS.stoneLight, cap: 2 });
  for (const x of [-16, -9, 9, 16]) urn(b, [x, 1, -12], true, Math.abs(x));
  b.stairs([0, LAWN, -17.5], 0, 10, 0.3, 0.55, 6, COLORS.stoneLight);
  ivy(b, 'x', -12.5, -16, -4, -3, -0.2, -1, 4);
  ivy(b, 'x', -12.5, 4, 16, -3, -0.2, -1, 6);

  // The west tower's balcony (top 3.8, out of reach), and a spout over the basin below it:
  // freeze the falling water and climb the ice.
  b.box([-14.5, 3.65, -1.9], [5, 0.3, 3.8], { color: COLORS.stoneLight });
  for (const x of [-16.95, -12.05]) b.box([x, 4.3, -1.9], [0.1, 1, 3.8], { color: COLORS.woodDark, pattern: 'planks', info: { noGrab: true } });
  for (const [c, sz] of [
    [[-14.5, 0.25, -6.1], [3.8, 0.5, 0.2]],
    [[-16.4, 0.25, -4.95], [0.2, 0.5, 2.3]],
    [[-12.6, 0.25, -4.95], [0.2, 0.5, 2.3]],
  ] as [V3, V3][]) {
    b.box(c, sz, { color: COLORS.stoneLight, info: { noGrab: true } });
  }
  b.pool(-16.3, -12.7, -6, -3.8, 0.3, -0.05);
  deco(b, new CylinderGeometry(0.25, 0.3, 0.8, 6), [-14.5, 3.3, -4.05], COLORS.stoneDark, [Math.PI / 2, 0, 0]);
  b.add(
    { type: 'waterfall', pos: [-14.5, 0.3, -3.8], yaw: Math.PI, width: 1.6, height: 3.35, pillar: 2.15, depth: 1.2 },
    { type: 'sweetLine', kind: 'bramble', from: [-16, 4.3, -2.2], to: [-13, 4.3, -2.2], count: 3 },
    { type: 'secret', id: 'grounds-balcony', area: 'terrace', min: [-17, 3.6, -3.8], max: [-12, 6, 0] },
  );

  // ================================================================ the lawn
  b.floor(-51, 51, -42, -12, { top: LAWN, color: GRASS });
  for (const [x0, x1] of [
    [-51, -17],
    [17, 51],
  ]) {
    b.box([(x0 + x1) / 2, -1.5, -6], [x1 - x0, 3, 12], { color: GRASS, info: { noGrab: true } });
  }
  // Grounds walls: hedges with caps east and west, and the castle's flanks.
  for (const x of [-51, 51]) {
    wall(b, 'z', x, -92, 0, 4, { base: LAWN, color: HEDGE, cap: 6 });
  }
  wall(b, 'x', 0.5, -51, -24, 12, { base: LAWN, cap: 4 });
  wall(b, 'x', 0.5, 24, 51, 12, { base: LAWN, cap: 4 });
  wall(b, 'x', -92, -51, 51, 4, { base: LAWN, color: HEDGE, cap: 6 });
  grass(b, -50, 50, -42, -18, LAWN, 1.2);
  // Gravel paths.
  deco(b, new BoxGeometry(5, 0.04, 25), [0, LAWN + 0.02, -30], '#c8b898');
  deco(b, new BoxGeometry(40, 0.04, 3), [-18, LAWN + 0.02, -40], '#c8b898');
  deco(b, new BoxGeometry(36, 0.04, 3), [18, LAWN + 0.02, -27], '#c8b898');
  for (const [x, z] of [
    [-22, -20],
    [-40, -27],
    [-12, -33],
    [25, -36],
    [40, -21],
    [33, -33],
  ]) {
    tree(b, x, z);
  }
  for (let i = 0; i < 8; i++) hollyhock(b, -9 - i * 0.9, -19, i);
  for (let i = 0; i < 8; i++) hollyhock(b, 9 + i * 0.9, -19, i + 20);
  for (const [x, z, s] of [
    [-30, -18, 1.4],
    [30, -18, 1.4],
    [-47, -35, 1.6],
    [47, -40, 1.6],
    [-5, -38, 1],
    [6, -38, 1],
  ] as [number, number, number][]) {
    bush(b, x, z, s, Math.round(x * z), LAWN);
  }
  mushrooms(b, -41, -26, 5, 3, LAWN);
  bench(b, [-6, LAWN, -28], Math.PI / 2, 2.4);
  bench(b, [6, LAWN, -28], -Math.PI / 2, 2.4);
  // A statue of the founder, looking out over the lake.
  b.box([0, LAWN + 0.6, -34], [2.4, 1.2, 2.4], { color: COLORS.stoneLight });
  b.cylinder([0, LAWN + 2.1, -34], 0.45, 1.8, '#9aa4a0', undefined, 8);
  deco(b, new SphereGeometry(0.4, 8, 6), [0, LAWN + 3.3, -34], '#9aa4a0');
  deco(b, new ConeGeometry(0.5, 1, 8), [0, LAWN + 3.9, -34], '#8a948f');
  deco(b, new BoxGeometry(0.1, 1.6, 0.1), [0.55, LAWN + 2.6, -34.2], '#8a948f', [0, 0, -0.3]);
  // The gated path to the Old Woods (later).
  b.add({ type: 'gate', pos: [50.5, LAWN, -27], yaw: Math.PI / 2, width: 3, height: 3.4, when: ['old-woods'] });
  signboard(b, 'The Old Woods\nNo pupils beyond this gate', [49.9, LAWN + 4, -27], -Math.PI / 2);
  for (const z of [-24, -30]) b.cylinder([49.8, LAWN + 1.9, z], 0.35, 3.8, COLORS.stoneLight, undefined, 8);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [0, LAWN + 0.6, -19], to: [0, LAWN + 0.6, -30], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-12, LAWN + 0.6, -40], to: [-25, LAWN + 0.6, -40], count: 5 },
    { type: 'sweet', kind: 'bramble', pos: [-40, LAWN + 0.6, -27] },
    { type: 'sweet', kind: 'bramble', pos: [47, LAWN + 0.6, -40.5] },
  );

  // ---------------------------------------------------------------- Coldharbour's boathouse
  const BOARDS = '#6a5a4a';
  b.box([-35, LAWN + 1.75, -36], [10, 3.5, 0.3], { color: BOARDS, pattern: 'planks' });
  b.box([-40, LAWN + 1.75, -41], [0.3, 3.5, 10], { color: BOARDS, pattern: 'planks' });
  b.box([-30, LAWN + 1.75, -37.6], [0.3, 3.5, 3.2], { color: BOARDS, pattern: 'planks' });
  b.box([-30, LAWN + 1.75, -44.4], [0.3, 3.5, 3.2], { color: BOARDS, pattern: 'planks' });
  b.box([-30, LAWN + 3.2, -41], [0.3, 0.6, 3.6], { color: BOARDS, pattern: 'planks' });
  b.box([-35, LAWN + 1.75, -46], [10, 3.5, 0.3], { color: BOARDS, pattern: 'planks' });
  for (const side of [-1, 1]) {
    deco(b, new BoxGeometry(11, 0.25, 6.2), [-35, LAWN + 4.6, -41 + side * 2.6], '#4a5a6a', [side * 0.5, 0, 0]);
  }
  deco(b, new BoxGeometry(11, 0.3, 0.3), [-35, LAWN + 6, -41], COLORS.woodDark);
  b.add({ type: 'door', pos: [-30.1, LAWN, -41], yaw: Math.PI / 2, width: 2.2, height: 3, to: { level: 'coldharbour', spawn: 'default' }, label: 'Frosts & Waters' });
  // A rowing boat, pulled up on the shore.
  deco(b, new BoxGeometry(1.2, 0.5, 3.4), [-26.5, LAWN + 0.25, -44], COLORS.wood);
  deco(b, new BoxGeometry(1, 0.1, 3.2), [-26.5, LAWN + 0.45, -44], COLORS.woodDark);
  crate(b, [-28, LAWN, -37], 0.8);

  // ================================================================ the lake
  b.floor(-51, 51, -92, -42, { top: LAWN, color: GRASS, holes: [[-50, 50, -90, -43]] });
  b.pool(-50, 50, -90, -43, WATER, -7);
  // Reeds and stones along the shore.
  for (let i = 0; i < 26; i++) {
    const x = -48 + i * 3.8;
    deco(b, new CylinderGeometry(0.03, 0.05, 1.2, 4), [x, WATER + 0.6, -43.4], '#6a8a3a', [0.1 * Math.sin(i), 0, 0.15 * Math.cos(i)]);
    if (i % 3 === 0) deco(b, new IcosahedronGeometry(0.5, 0), [x + 1.5, WATER + 0.1, -43.6], COLORS.stoneDark, [i, i, 0]);
  }
  // The jetty.
  b.box([11, LAWN - 0.15, -47.5], [2.4, 0.3, 9], { color: COLORS.wood, pattern: 'planks', info: { noGrab: true } });
  for (const z of [-44, -48, -51.5]) for (const x of [10, 12]) b.cylinder([x, LAWN - 1.4, z], 0.15, 2.4, COLORS.woodDark, undefined, 6);
  // The island and its folly.
  b.cylinder([22, -5, -75], 4.5, 4, '#8a9a6a', undefined, 12);
  deco(b, new CylinderGeometry(4.6, 4.6, 0.1, 12), [22, LAWN + 0.03, -75], GRASS);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.cylinder([22 + Math.cos(a) * 2.2, LAWN + 1.6, -75 + Math.sin(a) * 2.2], 0.22, 3.2, COLORS.stoneLight, undefined, 8);
  }
  deco(b, new CylinderGeometry(2.6, 2.6, 0.4, 12), [22, LAWN + 3.4, -75], COLORS.stoneLight);
  deco(b, new SphereGeometry(2.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [22, LAWN + 3.6, -75], '#b8c8c0');
  b.cylinder([22, LAWN + 0.4, -75], 0.7, 0.8, COLORS.stoneLight, undefined, 8);
  b.add(
    // Three patches of water to freeze, from the jetty's end to the island.
    { type: 'iceSheet', min: [9.5, -57.5], max: [13.5, -53.5], y: WATER, duration: 8 },
    { type: 'iceSheet', min: [13, -63.5], max: [17, -59.5], y: WATER, duration: 8 },
    { type: 'iceSheet', min: [15.5, -69.5], max: [19.5, -65.5], y: WATER, duration: 8 },
    { type: 'card', card: 'isolde-fairweather', pos: [22, LAWN + 1.4, -75] },
    { type: 'secret', id: 'grounds-folly', area: 'lake', min: [19, LAWN - 1, -78], max: [25, LAWN + 3, -72] },
  );
  signboard(b, 'Fairweather Lake\nNo swimming. No skating (yet).', [11, LAWN + 1.6, -43.2], Math.PI);
  b.cylinder([11, LAWN + 0.8, -43.1], 0.08, 1.6, COLORS.woodDark, undefined, 5);
  // Lily pads and a duck house.
  for (const [x, z] of [
    [-10, -55],
    [-20, -62],
    [30, -50],
    [-3, -70],
    [35, -80],
  ]) {
    deco(b, new CylinderGeometry(0.6, 0.6, 0.03, 9, 1, false, 0, Math.PI * 1.75), [x, WATER + 0.06, z], '#4f8a34');
  }
  b.cylinder([-15, WATER + 0.2, -60], 0.12, 2, COLORS.woodDark, undefined, 5);
  deco(b, new BoxGeometry(1, 0.7, 0.8), [-15, WATER + 1.5, -60], COLORS.wood);
  deco(b, new ConeGeometry(0.8, 0.5, 4), [-15, WATER + 2.1, -60], COLORS.roof, [0, Math.PI / 4, 0]);
  deco(b, new TorusGeometry(0.15, 0.04, 4, 8), [-15, WATER + 1.5, -59.58], '#2a2230');

  // ================================================================ the view: hills and a treeline
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * 0.05 + (i / 25) * Math.PI * 0.9;
    const r = 120 + (i % 3) * 25;
    const x = Math.cos(a) * r;
    const z = -40 - Math.sin(a) * r;
    deco(b, new IcosahedronGeometry(30 + (i % 4) * 8, 1).scale(1.4, 0.35 + (i % 3) * 0.08, 1), [x, -10, z], i % 2 ? '#6a8a4a' : '#5a7a44', [0, i, 0]);
  }
  for (let i = 0; i < 40; i++) {
    const x = -60 + i * 3.1 + Math.sin(i * 7) * 1.2;
    const z = -96 - (i % 3) * 2.5;
    const h = 7 + (i % 4) * 1.5;
    deco(b, new ConeGeometry(2 + (i % 2) * 0.6, h, 6), [x, LAWN + h / 2 + 1, z], i % 3 ? '#3f5f34' : '#4a6a3a');
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const z = -6 - i * 6.5;
      const h = 8 + (i % 3) * 2;
      deco(b, new ConeGeometry(2.4, h, 6), [side * (56 + (i % 2) * 3), LAWN + h / 2, z], i % 2 ? '#3f5f34' : '#4a6a3a');
    }
  }

  glow.finish(b, '#ffd890');
  b.finish();
}
