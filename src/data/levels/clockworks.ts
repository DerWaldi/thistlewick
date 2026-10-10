import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { cobweb, deco, Glow, signboard, slab, wall, wallTorch } from '../../world/props';

/**
 * The Great Clockworks, Thistledown's trial, inside the clock under Underbough's roof.
 * Brass and lamplight. South to north:
 *
 *   Escapement Gallery  x -6..6, z 0..26, y 0     a 4 m walkway over pits; three pendulums
 *                                                 swing across it (knock you into the pit)
 *   Weights Shaft       x -6..6, z 26..40, y 0..24 lift A floats you to the 6 m ledge (z 34..40);
 *                                                 lift B waits up at 12 by the south gallery:
 *                                                 call it from far enough away to see its stone;
 *                                                 ferry C (12 m) crosses north to the exit but
 *                                                 floats home after 3 s, under a pendulum
 *   The Great Wheel     x -6..6, z 40..60          four platforms ride a wheel (centre y 9,
 *                                                 z 50, radius 6) from the south ledge (y 12) over
 *                                                 the top to the north ledge; fall, and lift D
 *                                                 (which floats home by itself) takes you back up.
 *                                                 Secret: a crate on the floor floats up to an
 *                                                 alcove in the west wall (card)
 *   Bell Chamber        x -6..6, z 60..76, y 12    crate E floats you to the gallery (y 16);
 *                                                 call basket F down from the bell crown (19),
 *                                                 ride it up past the clapper to the Star
 */
export const CLOCKWORKS: LevelDef = {
  id: 'clockworks',
  name: 'The Great Clockworks',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'gallery', name: 'The Escapement Gallery', min: [-6, -10, 0], max: [6, 14, 26] },
    { id: 'shaft', name: 'The Weights Shaft', min: [-6, -2, 26], max: [6, 25, 40] },
    { id: 'wheel', name: 'The Great Wheel', min: [-9, -2, 40], max: [6, 25, 60] },
    { id: 'bell', name: 'The Bell Chamber', min: [-6, 10, 60], max: [6, 30, 76] },
  ],
  intro: { script: 'clockworksIntro', unlessFlag: 'clockworks-entered' },
  music: 'dungeon',
  build,
};

const BRASS = '#c99a3e';
const IRON = '#3a3340';
const STONE = '#6a5a52';
const FLOOR = '#4a4038';

function gear(b: LevelBuilder, c: V3, r: number, axis: 'x' | 'z', teeth = 14): void {
  const rot: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  deco(b, new TorusGeometry(r, r * 0.08, 4, 24), c, BRASS, axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]);
  deco(b, new CylinderGeometry(r * 0.2, r * 0.2, 0.4, 10), c, '#8a6a2a', rot);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    deco(b, new BoxGeometry(0.15, r * 2, 0.15), c, BRASS, axis === 'x' ? [a, 0, 0] : [0, 0, a]);
  }
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const o = [Math.cos(a) * (r + r * 0.12), Math.sin(a) * (r + r * 0.12)];
    const p: V3 = axis === 'x' ? [c[0], c[1] + o[1], c[2] + o[0]] : [c[0] + o[0], c[1] + o[1], c[2]];
    deco(b, new BoxGeometry(axis === 'x' ? 0.2 : 0.35, 0.35, axis === 'x' ? 0.35 : 0.2), p, BRASS, axis === 'x' ? [a, 0, 0] : [0, 0, a]);
  }
}

function build(b: LevelBuilder): void {
  b.killY = -10;
  const flames = new Glow();

  // ================================================================ escapement gallery (z 0..26)
  b.floor(-6.5, 6.5, -0.5, 4, { color: FLOOR });
  b.floor(-2, 2, 4, 22, { color: FLOOR });
  b.floor(-6.5, 6.5, 22, 26, { color: FLOOR });
  wall(b, 'x', -0.5, -6.5, 6.5, 12, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -6.5, 0, 40, 24, { color: STONE });
  wall(b, 'z', 6.5, 0, 40, 24, { color: STONE });
  slab(b, -6.5, 6.5, -0.5, 26, 12.5, 0.5, COLORS.stoneDark);
  for (const z of [4, 22]) deco(b, new BoxGeometry(4.2, 0.2, 0.2), [0, 0.02, z], BRASS);
  // The pits: a long way down to a dark floor you never reach (falling resets you first).
  b.box([0, -9, 13], [13, 0.5, 18], { color: '#1e1816', noCollide: true });
  for (const x of [-6.1, 6.1]) b.box([x, -4.5, 13], [0.5, 9, 18], { color: STONE, noCollide: true });
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'underbough', spawn: 'fromClockworks' } },
    { type: 'checkpoint', pos: [-4.5, 0, 2], yaw: Math.PI / 2, zone: { min: [-6, -1, 0], max: [6, 4, 4] } },
    { type: 'trigger', flag: 'clockworks-hint-gallery', script: 'clockworksGallery', min: [-6, -1, 0], max: [6, 4, 3.5] },
    { type: 'pendulum', pos: [0, 10, 8], length: 9, swing: 0.55, period: 2.8, phase: 0, bob: 0.8 },
    { type: 'pendulum', pos: [0, 10, 13], length: 9, swing: 0.55, period: 2.8, phase: 0.35, bob: 0.8 },
    { type: 'pendulum', pos: [0, 10, 18], length: 9, swing: 0.55, period: 2.8, phase: 0.7, bob: 0.8 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 5.5], to: [0, 0.6, 20.5], count: 7 },
    { type: 'checkpoint', pos: [4.5, 0, 24], yaw: -Math.PI / 2, zone: { min: [-6, -1, 22], max: [6, 4, 26] } },
  );
  for (const z of [2, 24]) {
    wallTorch(b, flames, [-6.0, 2.6, z], Math.PI / 2);
    wallTorch(b, flames, [6.0, 2.6, z], -Math.PI / 2);
  }
  for (const z of [8, 13, 18]) deco(b, new BoxGeometry(12, 0.4, 0.4), [0, 10.1, z], IRON);
  gear(b, [-6, 6, 12], 3, 'x');
  gear(b, [6, 7, 16], 2.4, 'x');
  b.lantern([0, 11, 3], 6, 14);

  // ================================================================ the weights shaft (z 26..40)
  b.floor(-6.5, 6.5, 26, 34, { color: FLOOR });
  slab(b, -6.5, 6.5, 26, 40.5, 24.5, 0.5, COLORS.stoneDark);
  // L1, the ledge at 6 (north half); L2, the gallery at 12 (south).
  b.box([0, 3, 37], [13, 6, 6], { color: STONE, info: { noGrab: true } });
  b.box([0, 11.8, 28.8], [13, 0.4, 5.6], { color: '#7a6a5a', info: { noGrab: true } });
  wall(b, 'x', 40.5, -6.5, 6.5, 24, { color: STONE, holes: [{ from: -6, to: -2.6, bottom: 12, top: 15.4 }] });
  b.add(
    { type: 'trigger', flag: 'clockworks-hint-shaft', script: 'clockworksShaft', min: [-6, -1, 26], max: [6, 4, 30] },
    { type: 'skyLift', style: 'platform', from: [0, 0, 32.8], to: [0, 6, 32.8], size: [2.4, 2.4], speed: 2.4 },
    { type: 'skyLift', style: 'platform', from: [4.5, 6, 32.8], to: [4.5, 12, 32.8], size: [2.4, 2.4], startAt: 'to', speed: 2.4 },
    { type: 'checkpoint', pos: [-4.5, 6, 38.5], yaw: Math.PI / 2, zone: { min: [-6, 5, 34], max: [6, 9, 40] } },
    { type: 'trigger', flag: 'clockworks-hint-call', script: 'clockworksCall', min: [-6, 5, 34], max: [6, 9, 40], delay: 20, unlessSignals: ['cwB'] },
    { type: 'skyLift', style: 'platform', from: [-4, 12, 32.8], to: [-4, 12, 38.8], size: [2.4, 2.4], returnAfter: 3, speed: 3 },
    { type: 'pendulum', pos: [-4, 22, 36], length: 9, swing: 0.5, period: 3.2, phase: 0.2, bob: 0.8 },
    { type: 'checkpoint', pos: [4.5, 12, 28], yaw: -Math.PI / 2, zone: { min: [-6, 11, 26], max: [6, 15, 31.6] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [-5, 6.6, 37], to: [3, 6.6, 37], count: 4 },
    { type: 'sweet', kind: 'bramble', pos: [5.5, 12.6, 27] },
  );
  deco(b, new BoxGeometry(13, 0.3, 0.3), [0, 21.9, 36], IRON);
  // The exit landing beyond the north wall (y 12).
  b.box([-4.3, 11.8, 41.5], [3.4, 0.4, 3], { color: '#7a6a5a' });
  // The clock's weights, hanging the full height.
  for (const [x, z, y] of [
    [-5, 27, 16],
    [5.4, 38.5, 18],
  ]) {
    deco(b, new CylinderGeometry(0.03, 0.03, 24 - y, 4), [x, (24 + y) / 2, z], IRON);
    deco(b, new CylinderGeometry(0.5, 0.5, 1.8, 10), [x, y, z], '#5a5a66');
  }
  b.lantern([0, 9, 37.5], 6, 14);
  b.lantern([0, 15, 28], 6, 14);

  // ================================================================ the great wheel (z 40..60)
  b.floor(-9, 6.5, 40.5, 60, { color: FLOOR });
  wall(b, 'z', -6.5, 40, 60, 24, { color: STONE, holes: [{ from: 48.8, to: 51.2, bottom: 3.6, top: 6.4 }] });
  wall(b, 'z', 6.5, 40, 60, 24, { color: STONE });
  slab(b, -6.5, 6.5, 40, 60, 24.5, 0.5, COLORS.stoneDark);
  // The south ledge (from the shaft) and the north ledge (to the bell chamber), both at 12.
  b.box([-2.1, 11.8, 42], [8.8, 0.4, 3], { color: '#7a6a5a', info: { noGrab: true } });
  b.box([0, 11.8, 58.5], [13, 0.4, 3], { color: '#7a6a5a', info: { noGrab: true } });
  const R = 6;
  const OMEGA = (Math.PI * 2) / 12;
  for (let i = 0; i < 4; i++) {
    const phase = (i / 4) * Math.PI * 2;
    // Clockwise seen from the west: up on the south side, over the top, down to the north.
    b.mover([2.4, 0.3, 2.4], BRASS, (t) => new Vector3(0, 9 + R * Math.sin(phase - OMEGA * t + Math.PI), 50 + R * Math.cos(phase - OMEGA * t + Math.PI)));
  }
  gear(b, [-2.2, 9, 50], R, 'x', 24);
  deco(b, new CylinderGeometry(0.6, 0.6, 3.5, 10), [-4, 9, 50], IRON, [0, 0, Math.PI / 2]);
  b.add(
    { type: 'checkpoint', pos: [-4.5, 12, 41.6], yaw: Math.PI / 2, zone: { min: [-6, 11, 40], max: [2.3, 15, 43.5] } },
    { type: 'trigger', flag: 'clockworks-hint-wheel', script: 'clockworksWheel', min: [-6, 11, 40], max: [2.3, 15, 43.5] },
    // Lift D brings fallers back up to the south ledge, and floats home again by itself.
    { type: 'skyLift', style: 'platform', from: [3.5, 0, 41.8], to: [3.5, 12, 41.8], size: [2.4, 2.4], returnAfter: 4, speed: 3 },
    // The secret: a crate floats up to an alcove in the west wall.
    { type: 'skyLift', style: 'crate', from: [-5.3, 1.2, 50], to: [-5.3, 3.6, 50], size: [1.2, 1.2], post: [0.45, -0.45], speed: 1.6 },
    { type: 'card', card: 'clockwork-owl', pos: [-7.8, 4.8, 50] },
    { type: 'secret', id: 'clockworks-alcove', area: 'wheel', min: [-9, 3.4, 48.8], max: [-7, 6.4, 51.2] },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 15.8, 48], to: [0, 15.8, 52], count: 3 },
    { type: 'checkpoint', pos: [4.5, 12, 58.5], yaw: -Math.PI / 2, zone: { min: [-6, 11, 57], max: [6, 15, 60] } },
  );
  b.box([-8, 3.4, 50], [2.2, 0.4, 2.4], { color: FLOOR });
  // An ungrabbable sill, so the alcove takes the crate rather than a jump and a grab.
  b.box([-6.5, 3.5, 50], [1.1, 0.2, 2.4], { color: '#7a6a5a', info: { noGrab: true } });
  b.box([-8, 5.1, 48.7], [2.2, 3.4, 0.2], { color: STONE });
  b.box([-8, 5.1, 51.3], [2.2, 3.4, 0.2], { color: STONE });
  b.box([-9.1, 5.1, 50], [0.2, 3.4, 2.8], { color: STONE });
  b.box([-8, 6.7, 50], [2.4, 0.2, 2.8], { color: STONE });
  b.lantern([4, 20, 50], 6, 16);

  // ================================================================ bell chamber (z 60..76, y 12)
  b.floor(-6.5, 6.5, 60, 76.5, { top: 12, color: FLOOR, thickness: 1 });
  wall(b, 'x', 60, -6.5, 6.5, 24, { color: STONE, holes: [{ from: -6, to: 6, bottom: 12, top: 15.4 }] });
  wall(b, 'z', -6.5, 60, 76.5, 30, { color: STONE });
  wall(b, 'z', 6.5, 60, 76.5, 30, { color: STONE });
  wall(b, 'x', 76.5, -6.5, 6.5, 30, { color: STONE, holes: [{ from: -4.2, to: -1.8, bottom: 16, top: 19.4 }] });
  slab(b, -6.5, 6.5, 60, 76.5, 30.5, 0.5, COLORS.stoneDark);
  // The gallery (y 16) along the north wall, the bell, and its crown (y 19).
  b.box([0, 15.8, 73], [13, 0.4, 6], { color: '#7a6a5a', info: { noGrab: true } });
  deco(b, new CylinderGeometry(1.2, 3.2, 5, 16, 1, true), [3, 16, 65.5], BRASS);
  deco(b, new TorusGeometry(3.2, 0.2, 6, 20), [3, 13.5, 65.5], BRASS, [Math.PI / 2, 0, 0]);
  b.box([3, 18.8, 65.5], [4, 0.4, 4], { color: BRASS, info: { noGrab: true } });
  deco(b, new CylinderGeometry(0.15, 0.15, 11, 6), [3, 24.5, 65.5], IRON);
  b.add(
    { type: 'checkpoint', pos: [-4.5, 12, 62], yaw: Math.PI / 2, zone: { min: [-6, 11, 60], max: [6, 15, 64] } },
    { type: 'trigger', flag: 'clockworks-hint-bell', script: 'clockworksBell', min: [-6, 11, 60], max: [6, 15, 63] },
    { type: 'skyLift', style: 'crate', from: [-4.5, 13.2, 69.3], to: [-4.5, 16, 69.3], size: [1.2, 1.2], post: [0.45, -0.45], speed: 1.6 },
    { type: 'skyLift', style: 'basket', id: 'cwF', from: [3, 16, 68.8], to: [3, 19, 68.8], size: [2, 1.8], startAt: 'to', speed: 3 },
    // The clapper only reaches the middle of the ride: wait in the basket, go just after it passes.
    { type: 'pendulum', pos: [3, 29.4, 68.8], length: 11, swing: 0.45, period: 4, phase: 0.5, bob: 0.8 },
    { type: 'star', id: 'clockworks-star', pos: [3, 20.6, 65.5], script: 'clockworksComplete' },
    { type: 'door', pos: [-3, 16, 75.95], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'underbough', spawn: 'fromClockworks' }, label: 'Up to class' },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, 16.6, 73], to: [4, 16.6, 73], count: 4 },
  );
  for (const z of [62, 72]) {
    wallTorch(b, flames, [-6.0, 14.6, z], Math.PI / 2);
    wallTorch(b, flames, [6.0, 14.6, z], -Math.PI / 2);
  }
  b.lantern([-3, 22, 66], 6, 14);
  signboard(b, 'Call it, then ride it', [-5.98, 17.5, 68], Math.PI / 2);
  for (const [c, d1, d2] of [
    [[-6, 11.9, 0], [1, 0], [0, 1]],
    [[6, 11.9, 0], [-1, 0], [0, 1]],
    [[-6, 29.9, 76], [1, 0], [0, -1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.3);
  }
  deco(b, new ConeGeometry(0.3, 0.6, 5), [-5.5, 12.3, 61], IRON);
  deco(b, new SphereGeometry(0.4, 8, 6), [5.5, 12.4, 61], '#5a5a66');

  flames.finish(b, '#ffb060');
  b.finish();
}
