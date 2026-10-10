import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { cobweb, deco, Glow, portrait, signboard, slab, wall, windowPane } from '../../world/props';
import { CARD_BY_ID } from '../cards';

/**
 * The Clock Tower, through a door in Hollyhock Court's north wall (open once Rimewhistle
 * is passed). A square tower (x -8..8, z 0..16, 32 m tall) round an open shaft
 * (x -4..4, z 4..12) where the clock's weights hang. Seven flights climb the walls
 * anticlockwise from the ground (SE corner): landings NE 3.6, NW 7.2, SW 10.8 (behind the
 * dial), SE 14.4, NE 18, NW 21.6, and SW 25.2 at the top, where Underbough's door is.
 * Thistledown: a crate on the NW landing (7.2) floats up to a nook in the north wall (card).
 */
export const CLOCKTOWER: LevelDef = {
  id: 'clocktower',
  name: 'The Clock Tower',
  spawns: {
    default: { pos: [0, 0, 1.6], yaw: 0 },
    fromUnderbough: { pos: [-6.4, 25.2, 2], yaw: Math.PI / 2 },
  },
  areas: [{ id: 'tower', name: 'The Clock Tower', min: [-8.5, -1, 0], max: [8.5, 33, 19] }],
  build,
};

const STONE = '#9a8a7a';

/**
 * A flight of stone steps on a sloping stringer: each step block reaches only half a metre
 * below its tread, so the underside follows the slope instead of hanging as a solid wedge.
 * Collision is one smooth invisible ramp, like `b.stairs`.
 */
function flight(b: LevelBuilder, start: V3, yaw: number, steps: number, rise: number, run: number, width: number): void {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const at = (d: number, y: number): V3 => [start[0] + fx * d, start[1] + y, start[2] + fz * d];
  const depth = 0.55;
  for (let i = 0; i < steps; i++) {
    const top = rise * (i + 1);
    b.box(at(run * i + run / 2, top - (rise + depth) / 2), [width, rise + depth, run], {
      color: i % 2 ? COLORS.stoneLight : '#c4ae90',
      rot: [0, yaw, 0],
      noCollide: true,
    });
  }
  const height = rise * steps;
  const length = run * steps;
  const angle = Math.atan2(height, length);
  // The stringer's underside: a plank along the slope, just under the step blocks.
  deco(b, new BoxGeometry(width, 0.15, Math.hypot(length, height)), at(length / 2, height / 2 - depth - rise - 0.08), '#8a7a6a', [-angle, yaw, 0]);
  const flat = run * (steps - 0.5);
  b.ramp(at(-run / 2, 0), Math.hypot(flat, height), width, (Math.atan2(height, flat) * 180) / Math.PI, yaw, COLORS.stoneLight, true);
  b.box(at(run * (steps - 0.5), height - 0.3), [width, 0.6, run], { rot: [0, yaw, 0], invisible: true });
}
const RISE = 3.6;

function build(b: LevelBuilder): void {
  const glow = new Glow();
  const H = 32;
  b.floor(-8.5, 8.5, -0.5, 16.5, { color: COLORS.stoneDark });
  wall(b, 'x', -0.5, -8.5, 8.5, H, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 16.5, -8.5, 8.5, H, { color: STONE, holes: [{ from: -7, to: -5, bottom: 7.2 + RISE * 0.8, top: 7.2 + RISE * 0.8 + 2.4 }] });
  wall(b, 'z', -8.5, 0, 16, H, { color: STONE, holes: [{ from: 0.9, to: 3.1, bottom: 7 * RISE, top: 7 * RISE + 3.4 }] });
  wall(b, 'z', 8.5, 0, 16, H, { color: STONE });
  slab(b, -8.5, 8.5, -0.5, 16.5, H + 0.5, 0.5, COLORS.woodDark, 'planks');

  // ---------------------------------------------------------------- the climb
  // Flights hug the outer wall (3.5 m wide); their inner edges run 0.5 m outside the shaft.
  const flights: { start: V3; yaw: number }[] = [
    { start: [6.25, 0, 4], yaw: 0 },
    { start: [4, RISE, 14.25], yaw: -Math.PI / 2 },
    { start: [-6.25, 2 * RISE, 12], yaw: Math.PI },
    { start: [-4, 3 * RISE, 1.75], yaw: Math.PI / 2 },
    { start: [6.25, 4 * RISE, 4], yaw: 0 },
    { start: [4, 5 * RISE, 14.25], yaw: -Math.PI / 2 },
    { start: [-6.25, 6 * RISE, 12], yaw: Math.PI },
  ];
  for (const f of flights) flight(b, f.start, f.yaw, 12, RISE / 12, 8 / 12, 3.5);
  const landings: [number, number, number, number, number][] = [
    [4, 8, 12, 16, RISE],
    [-8, -4, 12, 16, 2 * RISE],
    [-8, -4, 0, 4, 3 * RISE],
    [4, 8, 0, 4, 4 * RISE],
    [4, 8, 12, 16, 5 * RISE],
    [-8, -4, 12, 16, 6 * RISE],
    [-8, -4, 0, 4, 7 * RISE],
  ];
  for (const [x0, x1, z0, z1, y] of landings) {
    slab(b, x0, x1, z0, z1, y, 0.5, '#7a6a5a', 'planks');
    // Stone corbels along both walls the landing rests on.
    const wx = x0 < 0 ? x0 : x1;
    const wz = z0 < 8 ? z0 : z1;
    for (let k = 0; k < 3; k++) {
      const u = 0.6 + k * 1.4;
      deco(b, new BoxGeometry(0.45, 0.6, 0.45), [wx - Math.sign(wx) * 0.22, y - 0.8, z0 + u + (wz === z0 ? 0.6 : 0)], STONE);
      deco(b, new BoxGeometry(0.45, 0.6, 0.45), [x0 + u + (wx === x0 ? 0.6 : 0), y - 0.8, wz - Math.sign(wz - 8) * 0.22], STONE);
    }
  }
  // Nobody falls down the shaft: an invisible screen round it from just above head height.
  for (const [c, s] of [
    [[4, 18, 8], [0.1, 28, 8]],
    [[-4, 18, 8], [0.1, 28, 8]],
    [[0, 18, 4], [8, 28, 0.1]],
    [[0, 18, 12], [8, 28, 0.1]],
  ] as [V3, V3][]) {
    b.box(c, s, { invisible: true, info: { noGrab: true, cameraIgnore: true } });
  }
  // Handrails along every flight's inner edge (visual).
  for (let lap = 0; lap < 2; lap++) {
    const y0 = lap * 4 * RISE;
    for (const [from, to] of [
      [[4.55, y0 + 1, 4], [4.55, y0 + RISE + 1, 12]],
      [[4, y0 + RISE + 1, 12.45], [-4, y0 + 2 * RISE + 1, 12.45]],
      [[-4.55, y0 + 2 * RISE + 1, 12], [-4.55, y0 + 3 * RISE + 1, 4]],
      [[-4, y0 + 3 * RISE + 1, 3.55], [4, y0 + 4 * RISE + 1, 3.55]],
    ] as [V3, V3][]) {
      // The second lap ends at the top landing: no fourth flight.
      if (lap === 1 && from[2] === 3.55) continue;
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const dz = to[2] - from[2];
      const len = Math.hypot(dx, dy, dz);
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      deco(b, new BoxGeometry(0.1, 0.1, len), [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], COLORS.woodDark, [pitch, yaw, 0]);
      for (let t = 0; t <= 4; t++) {
        const p: V3 = [from[0] + (dx * t) / 4, from[1] + (dy * t) / 4 - 0.5, from[2] + (dz * t) / 4];
        deco(b, new BoxGeometry(0.08, 1, 0.08), p, COLORS.woodDark);
      }
    }
  }

  // ---------------------------------------------------------------- the shaft: weights, chains, the slow pendulum
  for (const [x, z, y] of [
    [-1.5, 7, 9],
    [1.5, 9, 15],
  ]) {
    deco(b, new CylinderGeometry(0.03, 0.03, H - y, 4), [x, (H + y) / 2, z], '#3a3340');
    deco(b, new CylinderGeometry(0.5, 0.5, 1.6, 10), [x, y, z], '#5a5a66');
    deco(b, new TorusGeometry(0.15, 0.04, 4, 8), [x, y + 0.95, z], '#3a3340');
  }
  b.add({ type: 'pendulum', pos: [0, H - 2, 8], length: 12, swing: 0.25, period: 4.5, yaw: Math.PI / 2, bob: 1 });
  // Gears on the walls.
  for (const [x, y, z, r, axis] of [
    [8.4, 9, 8, 2.2, 'x'],
    [-8.4, 16, 8, 1.6, 'x'],
    [0, 20, 16.4, 2.6, 'z'],
    [8.4, 24, 6, 1.4, 'x'],
  ] as [number, number, number, number, 'x' | 'z'][]) {
    const rot: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    deco(b, new CylinderGeometry(r, r, 0.2, 18), [x, y, z], '#8a6a2a', rot);
    deco(b, new CylinderGeometry(r * 0.3, r * 0.3, 0.3, 10), [x, y, z], '#5a4a2a', rot);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const off = [Math.cos(a) * (r + 0.15), Math.sin(a) * (r + 0.15)];
      const pos: V3 = axis === 'x' ? [x, y + off[1], z + off[0]] : [x + off[0], y + off[1], z];
      deco(b, new BoxGeometry(axis === 'x' ? 0.2 : 0.3, 0.3, axis === 'x' ? 0.3 : 0.2), pos, '#8a6a2a', axis === 'x' ? [a, 0, 0] : [0, 0, a]);
    }
  }
  // The back of the great dial, glowing with daylight, behind the SW/S landings.
  deco(b, new CircleGeometry(2.8, 32), [0, 11.6, 0.02], '#f3e4c4');
  glow.add(new TorusGeometry(2.9, 0.08, 4, 32), [0, 11.6, 0.05]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    deco(b, new BoxGeometry(0.12, 0.4, 0.04), [Math.sin(a) * 2.4, 11.6 + Math.cos(a) * 2.4, 0.05], '#2b1d14', [0, 0, -a]);
  }
  deco(b, new CylinderGeometry(0.25, 0.25, 0.6, 10), [0, 11.6, 0.3], '#3a3340', [Math.PI / 2, 0, 0]);

  // ---------------------------------------------------------------- windows, lamps, the way up
  for (const y of [5, 13, 21, 28]) {
    windowPane(b, glow, 'z', 8.48, 8, y, 1.2, 2.4, -1);
    windowPane(b, glow, 'z', -8.48, 8, y + 4, 1.2, 2.4, 1);
  }
  b.lantern([6, 3.2, 1.2], 6, 12);
  b.lantern([-6, 2 * RISE + 2.6, 15], 6, 12);
  b.lantern([6, 4 * RISE + 2.6, 1.2], 6, 12);
  b.lantern([-6, 7 * RISE + 2.6, 1.2], 6, 12);
  signboard(b, 'Airs & Graces: top of the stairs', [6, 2.2, 0.05], 0);
  b.add({
    type: 'door',
    pos: [0, 0, 0.05],
    yaw: 0,
    width: 2.4,
    height: 3.4,
    to: { level: 'hub', spawn: 'fromClockTower' },
    label: 'Hollyhock Court',
  });
  b.add({
    type: 'door',
    pos: [-8, 7 * RISE, 2],
    yaw: Math.PI / 2,
    width: 2.2,
    height: 3.2,
    to: { level: 'underbough', spawn: 'default' },
    label: 'Airs & Graces',
  });
  b.add(
    { type: 'sweetLine', kind: 'fizzwort', from: [6, RISE * 0.25 + 0.6, 5], to: [6, RISE * 0.9 + 0.6, 11], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [2, RISE * 1.3 + 0.6, 14], to: [-2, RISE * 1.7 + 0.6, 14], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-6, RISE * 2.3 + 0.6, 10], to: [-6, RISE * 2.7 + 0.6, 6], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [6, 4 * RISE + 0.6, 1] },
    { type: 'sweetLine', kind: 'fizzwort', from: [6, RISE * 4.3 + 0.6, 6], to: [6, RISE * 4.8 + 0.6, 11], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [-6, 6 * RISE + 0.6, 15] },
  );

  // ---------------------------------------------------------------- Thistledown: the nook over the NW landing
  // The nook's sill (top 2*RISE + 3) is out of reach from the landing; the crate floats up to it.
  b.box([-6, 2 * RISE + 2.9, 17.1], [2, 0.2, 2.2], { color: '#7a6a5a', info: { noGrab: true } });
  b.box([-7.1, 2 * RISE + 4.2, 17.2], [0.2, 2.4, 2], { color: STONE });
  b.box([-4.9, 2 * RISE + 4.2, 17.2], [0.2, 2.4, 2], { color: STONE });
  b.box([-6, 2 * RISE + 4.2, 18.3], [2.4, 2.4, 0.2], { color: STONE });
  b.box([-6, 2 * RISE + 5.5, 17.2], [2.4, 0.2, 2.4], { color: STONE });
  b.add(
    { type: 'skyLift', style: 'crate', from: [-6, 2 * RISE + 1.2, 15.3], to: [-6, 2 * RISE + 3, 15.3], size: [1.2, 1.2], post: [0.45, -0.45], speed: 1.5 },
    { type: 'card', card: 'cornelius-cogwhistle', pos: [-6, 2 * RISE + 4.1, 17.4] },
    { type: 'secret', id: 'tower-nook', area: 'tower', min: [-7, 2 * RISE + 2.8, 16.2], max: [-5, 2 * RISE + 5.3, 18.2] },
  );
  portrait(b, CARD_BY_ID.get('hester-quillfeather')!.portrait, [8.45, 4 * RISE + 2.8, 2], -Math.PI / 2, 1, 1.3, 0.04);
  for (const [c, d1, d2] of [
    [[-8, H - 0.5, 0], [1, 0], [0, 1]],
    [[8, H - 0.5, 16], [-1, 0], [0, -1]],
    [[-8, 2 * RISE + 2.5, 16], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.2);
  }
  deco(b, new ConeGeometry(0.4, 0.6, 4), [0, 0.3, 14.5], '#5a5a66');
  deco(b, new SphereGeometry(0.3, 6, 4), [-1.5, 0.3, 14.8], '#5a5a66');

  glow.finish(b, '#ffe2a0');
  b.finish();
}
