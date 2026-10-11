import type { EntitySpec } from '../../entities/types';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { column, signboard, wall } from '../../world/props';

/**
 * The Bestiary: a dev wing off the gym's north wall, a room for every foe so each can be
 * fought, watched and posed on its own. Sandbox (nothing saved), every spell known.
 *
 *   Gallery         x -3..3,  z -2..70  the way through; for each room, by its door: a lever
 *                                       (drops the room's portcullis, to watch through the bars),
 *                                       a pose lectern (E: hold the foe in its next pose) and a
 *                                       bell (E: start the wing over at this room, every foe fresh)
 *   West rooms      x -20..-4           Gnarlings (z 2..16), Snapcaskets (18..32), Ember Crabs
 *                                       (34..48), a Sootling on a ledge (50..64)
 *   East rooms      x 4..20             the Rattlecoat (2..16), the Snapweed (18..32), a Hexling
 *                                       (34..48, tall, pillars), pendulums (50..64)
 *   Examiner's Hall a hexagon round (0, 85), through a portcullis at the gallery's north end
 * Each room has a lectern checkpoint just inside its door and a sign saying how it's beaten.
 */

const ROOM_ROWS = [9, 25, 41, 57];
const WALL_H = 7;

interface Room {
  side: -1 | 1;
  row: number;
  name: string;
  how: string;
  /** Class name of the foe the pose lectern drives (none for the pendulums). */
  subject?: string;
  poses?: string[];
  /** Where the posed foe stands (the lectern drives the nearest one of its kind). */
  at?: V3;
  height?: number;
  fill(b: LevelBuilder, cx: number, cz: number, s: -1 | 1): EntitySpec[];
}

const ROOMS: Room[] = [
  {
    side: -1,
    row: 0,
    name: 'Gnarlings',
    how: 'Thwackwort stuns. Fire scares them off.',
    subject: 'Gnarling',
    poses: ['wander', 'notice', 'chase', 'windup', 'lunge', 'recover', 'stunned'],
    fill: (_b, cx, cz) => [
      { type: 'gnarling', pos: [cx, 0, cz], wander: 2.5 },
      { type: 'gnarling', pos: [cx - 4, 0, cz + 3], wander: 2.5 },
      { type: 'gnarling', pos: [cx + 3, 0, cz - 3], wander: 2.5 },
      { type: 'brazier', id: 'b-brazier', pos: [cx - 5, 0, cz - 4] },
    ],
  },
  {
    side: 1,
    row: 0,
    name: 'The Rattlecoat',
    how: 'Charged Thwackwort topples it. Twice.',
    subject: 'Rattlecoat',
    poses: ['dormant', 'approach', 'windup', 'swing', 'brace', 'charge', 'recover', 'stagger', 'toppled', 'rising'],
    fill: (_b, cx, cz, s) => [
      { type: 'rattlecoat', id: 'b-rattle', pos: [cx + s * 3, 0, cz], yaw: -s * (Math.PI / 2), arena: { min: [Math.min(s * 4, s * 20), -1, cz - 7.5], max: [Math.max(s * 4, s * 20), 6, cz + 7.5] } },
      { type: 'gnarling', pos: [cx - s * 2, 0, cz + 4], wander: 2 },
      { type: 'gnarling', pos: [cx - s * 2, 0, cz - 4], wander: 2 },
    ],
  },
  {
    side: -1,
    row: 1,
    name: 'Snapcaskets',
    how: 'Latchkin locks the lid, then Thwackwort.',
    subject: 'Snapcasket',
    poses: ['dormant', 'notice', 'chase', 'bite', 'recover', 'locked'],
    fill: (_b, cx, cz, s) => [
      { type: 'snapcasket', id: 'b-snap1', pos: [cx + s * 3, 0, cz - 3], yaw: -s * (Math.PI / 2), wander: 3 },
      { type: 'snapcasket', id: 'b-snap2', pos: [cx + s * 3, 0, cz + 3], yaw: -s * (Math.PI / 2), wander: 3 },
      { type: 'chest', id: 'b-chest', pos: [cx + s * 3, 0, cz], yaw: -s * (Math.PI / 2), sweets: [['fizzwort', 3]] },
    ],
  },
  {
    side: 1,
    row: 1,
    name: 'The Snapweed',
    how: 'Cindersnap burns it. It bites Gnarlings too.',
    subject: 'Snapweed',
    poses: ['idle', 'windup', 'snap', 'rest', 'burning'],
    fill: (_b, cx, cz) => [
      { type: 'snapweed', pos: [cx, 0, cz], radius: 2.2 },
      { type: 'gnarling', pos: [cx + 4, 0, cz + 4], wander: 2 },
    ],
  },
  {
    side: -1,
    row: 2,
    name: 'Ember Crabs',
    how: 'Thwackwort flips them; Rimewhistle freezes them.',
    subject: 'EmberCrab',
    poses: ['walk', 'aim', 'stunned', 'frozen'],
    fill: (b, cx, cz, s) => {
      for (const dz of [-3, 3]) b.box([cx - s * 2, 0.8, cz + dz], [1.6, 1.6, 1.6], { color: COLORS.stone });
      return [
        { type: 'emberCrab', pos: [cx + s * 4, 0, cz - 3], yaw: -s * (Math.PI / 2), patrol: 2.5, interval: 3, reform: 6 },
        { type: 'emberCrab', pos: [cx + s * 4, 0, cz + 3], yaw: -s * (Math.PI / 2), patrol: 2.5, interval: 3.6, reform: 6 },
      ];
    },
  },
  {
    side: 1,
    row: 2,
    name: 'A Hexling',
    how: 'Thwackwort knocks her down; again to banish.',
    subject: 'Hexling',
    poses: ['fly', 'windup', 'down'],
    height: 11,
    fill: (_b, cx, cz) => [{ type: 'hexling', pos: [cx, 0, cz], height: 4.5, radius: 3.5, interval: 3.2 }],
  },
  {
    side: -1,
    row: 3,
    name: 'A Sootling',
    how: 'Kick his bombs back with Thwackwort.',
    subject: 'Sootling',
    poses: ['idle', 'windup', 'dazed'],
    fill: (b, cx, cz, s) => {
      // His ledge at the far end, and a couple of blocks to duck behind.
      b.box([cx + s * 5.5, 1.1, cz], [5, 2.2, 6], { color: COLORS.stoneLight, info: { noGrab: true } });
      for (const dz of [-3, 3]) b.box([cx - s * 2, 0.6, cz + dz], [1.4, 1.2, 1.4], { color: COLORS.stone });
      return [{ type: 'sootling', pos: [cx + s * 5.5, 2.2, cz], yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, wander: 0.8, range: 18, interval: 3.4 }];
    },
  },
  {
    side: 1,
    row: 3,
    name: 'Pendulums',
    how: 'Time your run. They knock you back.',
    fill: (_b, cx, cz) => [
      { type: 'pendulum', pos: [cx - 3, 6.5, cz], length: 5.6, swing: 0.75, period: 2.8, yaw: Math.PI / 2, bob: 0.75 },
      { type: 'pendulum', pos: [cx + 3, 6.5, cz], length: 5.6, swing: 0.75, period: 3.2, phase: 0.5, yaw: Math.PI / 2, bob: 0.75, style: 'log' },
    ],
  },
];

export const BESTIARY: LevelDef = {
  id: 'bestiary',
  name: 'The Bestiary',
  sandbox: true,
  spawns: {
    default: { pos: [0, 0, 0.5], yaw: 0 },
    ...Object.fromEntries(ROOMS.map((r) => [`room-${r.side < 0 ? 'w' : 'e'}${r.row}`, { pos: [r.side * 1.4, 0, ROOM_ROWS[r.row]], yaw: (r.side * Math.PI) / 2 }])),
    'room-hall': { pos: [0, 0, 68], yaw: 0 },
  },
  areas: [
    { id: 'gallery', name: 'The Bestiary', min: [-3.5, -1, -2.5], max: [3.5, 12, 70] },
    ...ROOMS.map((r) => ({ id: `${r.side < 0 ? 'w' : 'e'}${r.row}`, name: r.name, min: [r.side < 0 ? -20.5 : 3.5, -1, ROOM_ROWS[r.row] - 8] as V3, max: [r.side < 0 ? -3.5 : 20.5, 12, ROOM_ROWS[r.row] + 8] as V3 })),
    { id: 'hall', name: "The Examiner's Hall", min: [-18, -1, 70], max: [18, 15, 100] },
  ],
  build,
};

function build(b: LevelBuilder): void {
  b.floor(-21, 21, -3, 70, { color: '#8a7a68' });
  // The gallery's south end, with the door back to the gym.
  wall(b, 'x', -2.5, -21, 21, WALL_H, { cap: 4 });
  b.add({ type: 'door', pos: [0, 0, -1.95], yaw: 0, width: 2.4, height: 3.4, to: { level: 'gym', spawn: 'fromBestiary' }, label: 'The Gym' });
  // Outer walls east and west.
  for (const s of [-1, 1]) wall(b, 'z', s * 20.5, -2.5, 70, WALL_H, { cap: 6 });
  // Gallery walls, with a door into each room.
  for (const s of [-1, 1] as const) {
    wall(b, 'z', s * 3.5, -2.5, 66, WALL_H, { holes: ROOM_ROWS.map((z) => ({ from: z - 2.1, to: z + 2.1, top: 3.6 })) });
  }
  // Walls between the rooms.
  for (const s of [-1, 1]) for (const z of [17, 33, 49, 65]) wall(b, 'x', z, s * 4, s * 21, WALL_H, { cap: 6 });
  // The taller Hexling room gets its walls raised.
  const hex = ROOMS.find((r) => r.height)!;
  const hz = ROOM_ROWS[hex.row];
  wall(b, 'x', hz - 8, 4, 21, hex.height! - WALL_H, { base: WALL_H });
  wall(b, 'x', hz + 8, 4, 21, hex.height! - WALL_H, { base: WALL_H });
  wall(b, 'z', 20.5, hz - 8, hz + 8, hex.height! - WALL_H, { base: WALL_H });
  wall(b, 'z', 3.5, hz - 8, hz + 8, hex.height! - WALL_H, { base: WALL_H });

  ROOMS.forEach((r) => {
    const cz = ROOM_ROWS[r.row];
    const cx = r.side * 12;
    const s = r.side;
    const tag = `${s < 0 ? 'w' : 'e'}${r.row}`;
    const facing = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    // The Hexling room's pillars, to duck behind.
    if (r.subject === 'Hexling') for (const dz of [-4, 4]) column(b, cx, cz + dz, r.height!);
    const specs = r.fill(b, cx, cz, s);
    b.add(
      ...specs,
      // The portcullis in its doorway, shut while the lever is on.
      { type: 'gate', pos: [s * 3.5, 0, cz], yaw: Math.PI / 2, width: 3, height: 3, when: [], shutWhen: [`b-shut-${tag}`] },
      { type: 'bestiaryLever', pos: [s * 2.6, 0, cz + 2.8], yaw: facing, signal: `b-shut-${tag}` },
      { type: 'bestiaryBell', pos: [s * 2.6, 0, cz + 5.2], spawn: `room-${tag}` },
      { type: 'checkpoint', pos: [s * 5.4, 0, cz + 5.8], yaw: -facing, zone: { min: [s < 0 ? -20 : 4, -1, cz - 7.5], max: [s < 0 ? -4 : 20, 4, cz + 7.5] } },
    );
    if (r.subject) b.add({ type: 'bestiaryPose', pos: [s * 2.6, 0, cz - 2.8], yaw: facing, subject: r.subject, at: r.at ?? [cx, 0, cz], poses: r.poses! });
    // The name board over the door, on the gallery side.
    signboard(b, `${r.name}\n${r.how}`, [s * 2.98, 4.7, cz], s < 0 ? Math.PI / 2 : -Math.PI / 2);
    // Open to the sky: daylight does the lighting (the lecterns' lights are enough point lights).
    b.lantern([cx, WALL_H - 1.2, cz], 0, 0, false);
  });

  examinersHall(b);
  b.finish();
}

/** A hexagon (centre (0, 85), 14 m to each side) through a portcullis at the gallery's end. */
function examinersHall(b: LevelBuilder): void {
  const CZ = 85;
  const A = 14;
  const R = A / Math.cos(Math.PI / 6);
  const H = 10;
  const corner = (i: number): [number, number] => [R * Math.cos((i * Math.PI) / 3), CZ + R * Math.sin((i * Math.PI) / 3)];
  b.floor(-R - 1, R + 1, 70, CZ + A + 0.5, { color: '#8a6a4a' });
  // The gallery's north end: the hall's south side, with a portcullis in it.
  wall(b, 'x', 70.5, -21, 21, H, { holes: [{ from: -2.1, to: 2.1, top: 3.6 }] });
  for (const i of [0, 1, 2, 3, 5]) {
    const [x0, z0] = corner(i);
    const [x1, z1] = corner(i + 1);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const out = Math.hypot(mx, mz - CZ);
    b.box([mx + (mx / out) * 0.5, H / 2, mz + ((mz - CZ) / out) * 0.5], [1, H, Math.hypot(x1 - x0, z1 - z0) + 0.6], { color: COLORS.stone, rot: [0, Math.atan2(x1 - x0, z1 - z0), 0] });
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = corner(i);
    // A little taller than the walls, whose tops otherwise flickered with theirs.
    b.cylinder([x, (H + 0.04) / 2, z], 1.1, H + 0.04, COLORS.stoneLight, { noGrab: true }, 10);
  }
  b.add(
    { type: 'gate', pos: [0, 0, 70.5], yaw: 0, width: 3, height: 3, when: [], shutWhen: ['b-shut-hall'] },
    { type: 'bestiaryLever', pos: [2.6, 0, 68.6], yaw: Math.PI, signal: 'b-shut-hall' },
    { type: 'bestiaryBell', pos: [-2.6, 0, 66.4], spawn: 'room-hall' },
    { type: 'bestiaryPose', pos: [-2.6, 0, 68.6], yaw: Math.PI, subject: 'Examiner', at: [0, 0, 88], poses: ['dormant', 'stalk', 'windup', 'stuck', 'stagger', 'volley', 'rain', 'brace', 'charge'] },
    { type: 'checkpoint', pos: [-6, 0, 73], yaw: Math.PI / 2, zone: { min: [-12, -1, 71], max: [12, 4, 75] } },
    // It wakes when you step in.
    { type: 'trigger', flag: 'b-boss-woken', min: [-12, -1, 71], max: [12, 4, 74] },
    { type: 'examiner', id: 'b-boss', pos: [0, 0, 88], arena: { min: [-14, -1, 71.5], max: [14, 10, 98.5] }, ring: { center: [0, 85], radius: 11 }, wakeFlag: 'b-boss-woken' },
  );
  signboard(b, 'The Brass Examiner\nJump the slams, break the seals.', [0, 4.7, 69.97], Math.PI);
}
