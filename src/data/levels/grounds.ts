import { BoxGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, Shape, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { bench, bush, crate, deco, Glow, grass, hollyhock, ivy, mushrooms, signboard, tree, urn, wall, windowPane } from '../../world/props';

/**
 * The Castle Grounds, out through the Lantern Hall's great doors (open once Cindersnap is
 * passed). Day. North is the castle; everything else runs downhill to the lake (+Z north):
 *
 *   Castle front    z 0..4      the facade, two towers, the great doors (back into the hall)
 *   Terrace         x -16..16, z -12..0, y 0   balustrade; the east tower's balcony (y 3.4)
 *                               with a frozen-waterfall climb (Rimewhistle) and a secret
 *   Lawn            x -50..50, z -42..-17, y -3   stairs down from the terrace; trees,
 *                               flower beds, a statue, benches; Coldharbour's boathouse
 *                               (x -40..-30, z -46..-36, door west) on the east shore; a
 *                               door west (x 50.5) into the Old Woods, once Mabel asks
 *   Lake            x -50..50, z -90..-42, water y -3.6   a jetty (x 10..12) and three ice
 *                               sheets to the island folly (centre 22,-75) with a card;
 *                               on the west side, old mooring rocks (x 41..43) and three
 *                               ice sheets to a reed bank (x 47..50, z -66..-56): Ned's float
 */
export const GROUNDS: LevelDef = {
  id: 'grounds',
  name: 'The Castle Grounds',
  spawns: {
    default: { pos: [0, 0, -1.6], yaw: Math.PI },
    fromBoathouse: { pos: [-28.6, -3, -41], yaw: Math.PI / 2 },
    fromWoods: { pos: [48.4, -3, -27], yaw: -Math.PI / 2 },
  },
  areas: [
    { id: 'terrace', name: 'The Terrace', min: [-17, -1, -12.5], max: [17, 12, 0] },
    { id: 'lawn', name: 'The Castle Grounds', min: [-51, -4, -42], max: [51, 12, -12.5] },
    { id: 'lake', name: 'Fairweather Lake', min: [-51, -8, -92], max: [51, 12, -42] },
  ],
  npcSpots: {
    terrace: { pos: [8, 0, -6], yaw: Math.PI },
    lawnBench: { pos: [-6.2, -3, -26.5], yaw: Math.PI / 2 },
    statue: { pos: [2.6, -3, -31], yaw: -Math.PI / 2 },
    jetty: { pos: [11, -3, -45], yaw: Math.PI },
    boathouse: { pos: [-27.5, -3, -38.5], yaw: Math.PI / 2 },
    oldWoodsGate: { pos: [46.5, -3, -25], yaw: Math.PI / 2 },
    lakeshore: { pos: [-15, -3, -41.5], yaw: Math.PI },
  },
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
  // A stone lintel above the doors' name plate (which hangs at about 6 m).
  deco(b, new BoxGeometry(5, 0.5, 0.6), [0, 6.6, -0.2], COLORS.stoneDark);
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

  // The east tower's balcony (top 3.8, out of reach), and a spout over the basin below it:
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
  // Grounds walls: hedges with caps west and east, and the castle's flanks.
  for (const x of [-51, 51]) {
    wall(b, 'z', x, -92, 0, 4, { base: LAWN, color: HEDGE, cap: 6 });
  }
  wall(b, 'x', 0.5, -51, -24, 12, { base: LAWN, cap: 4 });
  wall(b, 'x', 0.5, 24, 51, 12, { base: LAWN, cap: 4 });
  wall(b, 'x', -92, -51, 51, 4, { base: LAWN, color: HEDGE, cap: 6 });
  grass(b, -50, 50, -42, -18, LAWN, 1.2);
  // Gravel paths.
  deco(b, new BoxGeometry(5, 0.04, 25), [0, LAWN + 0.02, -30], '#c8b898');
  // To the boathouse door (z -41), from the edge of the middle path to the threshold.
  deco(b, new BoxGeometry(27.5, 0.04, 3), [-16.25, LAWN + 0.02, -41], '#c8b898');
  deco(b, new BoxGeometry(33.5, 0.04, 3), [19.25, LAWN + 0.02, -27], '#c8b898');
  for (const [x, z] of [
    [-22, -20],
    [-40, -27],
    [-12, -33],
    [25, -36],
    [40, -21],
    [33, -33],
  ]) {
    tree(b, x, z, LAWN);
  }
  for (let i = 0; i < 8; i++) hollyhock(b, -9 - i * 0.9, -19, i, LAWN);
  for (let i = 0; i < 8; i++) hollyhock(b, 9 + i * 0.9, -19, i + 20, LAWN);
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
  // The path to the Old Woods: a door between the gateposts (it replaced a gate in place, so
  // later ids don't shift), open once Mabel has asked you to go in.
  b.add({ type: 'door', pos: [50.5, LAWN, -27], yaw: -Math.PI / 2, width: 3, height: 3.4, to: { level: 'woods', spawn: 'default' }, lockedUnless: 'quest:hedgehog', talk: 'oldWoodsGate' }); // (no label: the board above names it)
  signboard(b, 'The Old Woods\nNo pupils beyond this gate', [49.9, LAWN + 4, -27], -Math.PI / 2);
  for (const z of [-24, -30]) b.cylinder([49.8, LAWN + 1.9, z], 0.35, 3.8, COLORS.stoneLight, undefined, 8);
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [0, LAWN + 0.6, -19], to: [0, LAWN + 0.6, -30], count: 5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-12, LAWN + 0.6, -41], to: [-25, LAWN + 0.6, -41], count: 5 },
    { type: 'sweet', kind: 'bramble', pos: [-40, LAWN + 0.6, -27] },
    { type: 'sweet', kind: 'bramble', pos: [47, LAWN + 0.6, -40.5] },
  );

  // ---------------------------------------------------------------- Coldharbour's boathouse
  // Plank walls (3.8 m) under a pitched roof running west-east, solid gables at both ends,
  // and a wide double door in the west gable.
  const BOARDS = '#6a5a4a';
  const WALL = 3.8;
  const RIDGE = 2.8;
  const wallBox = (c: V3, size: V3) => b.box(c, size, { color: BOARDS, pattern: 'planks' });
  wallBox([-35, LAWN + WALL / 2, -36], [10, WALL, 0.3]);
  wallBox([-35, LAWN + WALL / 2, -46], [10, WALL, 0.3]);
  wallBox([-40, LAWN + WALL / 2, -41], [0.3, WALL, 10.3]);
  wallBox([-30, LAWN + WALL / 2, -37.6], [0.3, WALL, 3.5]);
  wallBox([-30, LAWN + WALL / 2, -44.4], [0.3, WALL, 3.5]);
  wallBox([-30, LAWN + 3.2 + (WALL - 3.2) / 2, -41], [0.3, WALL - 3.2, 3.4]);
  const gable = new Shape();
  gable.moveTo(-5.15, 0);
  gable.lineTo(5.15, 0);
  gable.lineTo(0, RIDGE);
  gable.closePath();
  for (const x of [-30.15, -40.15]) deco(b, new ExtrudeGeometry(gable, { depth: 0.3, bevelEnabled: false }), [x, LAWN + WALL, -41], BOARDS, [0, Math.PI / 2, 0]);
  // The roof: two slopes meeting at the ridge, overhanging the walls a little.
  const half = 5.6;
  const slope = Math.atan2(RIDGE, 5.15);
  const run = Math.hypot(half, half * Math.tan(slope));
  for (const side of [-1, 1]) {
    deco(b, new BoxGeometry(11, 0.22, run), [-35, LAWN + WALL + RIDGE - (half / 2) * Math.tan(slope) + 0.12, -41 + side * (half / 2)], '#4a5a6a', [side * slope, 0, 0]);
  }
  deco(b, new BoxGeometry(11.2, 0.3, 0.3), [-35, LAWN + WALL + RIDGE + 0.15, -41], COLORS.woodDark);
  b.add({ type: 'door', pos: [-29.8, LAWN, -41], yaw: Math.PI / 2, width: 3.4, height: 3.2, to: { level: 'coldharbour', spawn: 'default' }, label: 'Frosts & Waters' });
  // A rowing boat, moored in the water beside the boathouse: a hollow hull, a seat, oars.
  const BOAT: V3 = [-26.8, WATER, -46.5];
  const hull = (dx: number, dy: number, dz: number, size: V3, color = COLORS.wood) => deco(b, new BoxGeometry(...size), [BOAT[0] + dx, BOAT[1] + dy, BOAT[2] + dz], color);
  hull(0, -0.1, 0, [1.1, 0.12, 3]);
  for (const sx of [-1, 1]) hull(sx * 0.6, 0.12, 0, [0.1, 0.5, 3.2], COLORS.woodDark);
  hull(0, 0.12, 1.6, [1.3, 0.5, 0.1], COLORS.woodDark);
  hull(0, 0.12, -1.6, [1.3, 0.5, 0.1], COLORS.woodDark);
  hull(0, 0.2, 0.3, [1.1, 0.06, 0.35]);
  for (const sx of [-1, 1]) deco(b, new BoxGeometry(0.06, 0.06, 2.4), [BOAT[0] + sx * 0.35, BOAT[1] + 0.3, BOAT[2] - 0.3], '#c8a870', [0.1, sx * 0.2, 0]);
  b.cylinder([-28.4, LAWN - 0.5, -45], 0.12, 2, COLORS.woodDark, undefined, 6);
  deco(b, new CylinderGeometry(0.02, 0.02, 1.6, 4), [-27.6, WATER + 0.55, -45.5], '#c8b898', [0.9, 0, 0.9]);
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
  // Faces the lawn, so you read it on your way down to the jetty.
  signboard(b, 'Fairweather Lake\nNo swimming. No skating (yet).', [11, LAWN + 1.6, -42.98], 0);
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

  // Last (ids follow build order): the students' errands.
  errands(b);
  glow.finish(b, '#ffd890');
  b.finish();
}

/**
 * Ned's lucky float, in the reeds on the far west shore: freeze the water between the old
 * mooring rocks (the long middle stretch only holds if charged), and mind the Snapweed.
 */
function errands(b: LevelBuilder): void {
  const ROCK = LAWN - 0.2;
  for (const [x0, x1, z0, z1] of [
    [41, 43, -51, -49],
    [41, 43, -62, -60],
  ]) {
    b.box([(x0 + x1) / 2, (ROCK - 7) / 2, (z0 + z1) / 2], [x1 - x0, ROCK + 7, z1 - z0], { color: COLORS.stoneDark });
    deco(b, new IcosahedronGeometry(0.6, 0), [x0 + 0.3, ROCK + 0.1, z1 - 0.2], COLORS.stone, [1, 2, 0]);
  }
  // The reed bank.
  b.box([48.6, (ROCK - 7) / 2, -61], [3.2, ROCK + 7, 10], { color: '#6a7a4a' });
  for (let i = 0; i < 18; i++) {
    const x = 47.4 + (i % 4) * 0.8;
    const z = -65.5 + Math.floor(i / 4) * 2.1;
    deco(b, new CylinderGeometry(0.03, 0.05, 1.4, 4), [x, ROCK + 0.7, z], '#6a8a3a', [0.15 * Math.sin(i * 3), 0, 0.15 * Math.cos(i * 2)]);
  }
  // Old mooring posts mark the way.
  for (const [x, z] of [
    [40.2, -46],
    [44, -46],
    [40.2, -55],
    [44, -55],
    [45, -63],
  ]) {
    b.cylinder([x, WATER + 0.5, z], 0.14, 2.2, COLORS.woodDark, undefined, 6);
  }
  b.add(
    { type: 'iceSheet', min: [40.5, -49], max: [43.5, -43.2], y: WATER, duration: 6 },
    { type: 'iceSheet', min: [40.5, -60], max: [43.5, -51], y: WATER, duration: 1.5, chargedDuration: 9 },
    { type: 'iceSheet', min: [43, -62], max: [47, -59.6], y: WATER, duration: 6 },
    { type: 'snapweed', pos: [48.4, ROCK, -61.2], radius: 2.2 },
    { type: 'questItem', quest: 'float', pos: [48.8, ROCK + 0.1, -57.6] },
  );
  // Beside the way onto the ice, not in front of it.
  signboard(b, 'Old Moorings\nThe long stretch needs a strong freeze.', [38.6, LAWN + 1.7, -42.96], 0);
  b.cylinder([38.6, LAWN + 0.85, -43.1], 0.08, 1.7, COLORS.woodDark, undefined, 5);
}
