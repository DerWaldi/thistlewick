import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { banner, barrel, cobweb, crate, deco, Glow, rubble, rug, signboard, wall, wallTorch } from '../../world/props';

/**
 * The Tumbledown Tower, Springwell's trial, climbed from Hopgood's gym. A tower
 * x -10..10, z 0..20, stacked in tiers, then a run across turrets outside:
 *
 *   Base      y 0      pad A (moss) up onto the east block L1 (top 5)
 *   Stair     y 5..17  toadstools: M1 (cap 4) up to shelf P2 (9.5); leaning M2 (8.5, beside P2) throws
 *                      you to shelf P3 (13), M3 (12) up through the floor hatch (x 1..6, z 1..7)
 *   Bellfry   y 17.5   Snapcaskets; the walkway (top 27, north) needs a CHARGED bounce off pad B;
 *                      its gate only opens while the knocker under the walkway ticks (9 s);
 *                      mattress C under the roof hatch (x -10..-6.5, z 17.5..20). The great
 *                      bell's top (29.2) needs charge AND a held jump: the card's up there.
 *   Roof      y 32.5   rune tile R1 throws you to turret T1 (16.5, 10, top 31), R2 to T2
 *                      (23, 4, top 34), R3 to T3 (29.5, 10, top 37); from T3 a big bounce (charge
 *                      or held jump) up onto the spire (top 45). Falling off the roof returns
 *                      you to the roof checkpoint.
 *   Weathercock Run    from the spire, rune tiles to chimneys C1 (43, 10, top 47) and C2 (49.5,
 *                      4, top 50), moss up to a narrow beam (x 51.5..58.5, z 4, top 53) under
 *                      two Hexlings, a toadstool at its end to the Weathercock (63, 10, top 56):
 *                      a Sootling, the Thistle Star and the way down. Falls go back to the spire.
 */
export const TOWER: LevelDef = {
  id: 'tower',
  name: 'The Tumbledown Tower',
  spawns: { default: { pos: [0, 0, 1.6], yaw: 0 } },
  areas: [
    { id: 'base', name: 'The Tumbledown Tower', min: [-10, -3, 0], max: [10, 4.5, 20] },
    { id: 'stair', name: 'The Toadstool Stair', min: [-10, 4.5, 0], max: [10, 17.25, 20] },
    { id: 'bellfry', name: 'The Bellfry', min: [-10, 17.25, 0], max: [10, 32.25, 20] },
    { id: 'roof', name: 'The Rooftops', min: [-12, 32.25, -6], max: [40, 60, 26] },
    { id: 'weathercock', name: 'The Weathercock Run', min: [40, 32.25, -6], max: [72, 70, 26] },
  ],
  intro: { script: 'towerIntro', unlessFlag: 'tower-entered' },
  music: 'dungeon',
  build,
};

const STONE = '#9a8a78';
const ROOF = 32.5;

function build(b: LevelBuilder): void {
  b.killY = -10;
  const flames = new Glow();
  b.floor(-10.5, 10.5, -0.5, 20.5, { color: '#7d6a5e' });

  // ================================================================ the tower shell
  const TOP = ROOF + 0.8;
  wall(b, 'x', -0.5, -10.5, 10.5, TOP, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'x', 20.5, -10.5, 10.5, TOP, { color: STONE });
  wall(b, 'z', -10.5, -0.5, 20.5, TOP, { color: STONE });
  wall(b, 'z', 10.5, -0.5, 20.5, TOP, { color: STONE });
  // Crenellations round the roof.
  for (let i = -10; i <= 10; i += 2) {
    for (const z of [-0.5, 20.5]) deco(b, new BoxGeometry(1, 0.6, 1), [i, TOP + 0.3, z], STONE);
    for (const x of [-10.5, 10.5]) deco(b, new BoxGeometry(1, 0.6, 1), [x, TOP + 0.3, i + 10], STONE);
  }
  // Floors: the Bellfry floor with its hatch over M3, and the roof with its hatch over C.
  const floorAt = (y: number, boxes: [number, number, number, number][], color: string) => {
    for (const [x0, x1, z0, z1] of boxes) b.box([(x0 + x1) / 2, y - 0.25, (z0 + z1) / 2], [x1 - x0, 0.5, z1 - z0], { color, pattern: 'planks' });
  };
  floorAt(17.5, [
    [-10, 1, 0, 20],
    [6, 10, 0, 20],
    [1, 6, 0, 1],
    [1, 6, 7, 20],
  ], '#8a6a4a');
  for (const [x, z, w, d] of [
    [3.5, 1, 5, 0.12],
    [3.5, 7, 5, 0.12],
    [1, 4, 0.12, 6],
    [6, 4, 0.12, 6],
  ]) {
    deco(b, new BoxGeometry(w, 0.14, d), [x, 17.56, z], COLORS.woodDark);
  }
  floorAt(ROOF, [
    [-10, 10, 0, 17.5],
    [-6.5, 10, 17.5, 20],
  ], '#7a6a6a');

  // ================================================================ base (y 0)
  b.box([-7.5, 2.5, 12], [5, 5, 16], { color: COLORS.stoneLight }); // L1
  // Caps sit a few centimetres proud of the surfaces they trim: flush faces z-fight.
  deco(b, new BoxGeometry(5.1, 0.15, 16.1), [-7.5, 4.96, 12], COLORS.stoneDark);
  b.add(
    { type: 'door', pos: [0, 0, 0.05], yaw: 0, width: 2.4, height: 3.4, to: { level: 'hopgood', spawn: 'fromTower' } },
    { type: 'checkpoint', pos: [-7, 0, 2.5], yaw: Math.PI / 2, zone: { min: [-10, -1, 0], max: [10, 4, 6] } },
    { type: 'springPad', pos: [-2.5, 0, 12], radius: 1.2, style: 'moss', duration: 6 },
    { type: 'gnarling', pos: [4, 0, 7], wander: 3 },
    { type: 'gnarling', pos: [5.5, 0, 15], wander: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [0, 0.6, 3.5], to: [0, 0.6, 9], count: 4 },
  );
  barrel(b, [9.2, 0, 1]);
  crate(b, [8.9, 0, 19], 1.1);
  rubble(b, 7, 18, 6, 4);
  rug(b, [0, 0, 4], 3, 4, '#3f7a4a', '#c99a3e');
  wallTorch(b, flames, [-1.9, 2.6, 0.02], 0);
  wallTorch(b, flames, [1.9, 2.6, 0.02], 0);
  signboard(b, 'Up is the only way', [0, 4.4, 0.03], 0);

  // ================================================================ toadstool stair (y 5..17)
  b.box([2.5, 9, 18], [5, 1, 4], { color: COLORS.wood, pattern: 'planks' }); // P2 (top 9.5)
  b.box([8, 12.5, 5], [4, 1, 6], { color: COLORS.wood, pattern: 'planks' }); // P3 (top 13)
  for (const [x, y, z] of [
    [0.5, 8, 19.6],
    [4.5, 8, 19.6],
    [9.6, 11.5, 2.5],
    [9.6, 11.5, 7.5],
  ]) {
    deco(b, new BoxGeometry(0.4, 1.4, 0.4).rotateX(z > 10 ? 0.6 : 0).rotateZ(z > 10 ? 0 : 0.6), [x, y, z], COLORS.woodDark);
  }
  b.add(
    { type: 'checkpoint', pos: [-8.5, 5, 6], yaw: Math.PI / 2, zone: { min: [-10, 4.5, 4], max: [-5, 8, 20] } },
    { type: 'trigger', flag: 'tower-hint-stair', script: 'towerStair', min: [-10, 4.5, 4], max: [-5, 8, 20] },
    { type: 'springPad', pos: [-2.5, 0, 17.5], radius: 1.1, style: 'mushroom', height: 3.85, duration: 5 },
    { type: 'springPad', pos: [6.2, 0, 15], radius: 1.1, style: 'mushroom', height: 8.35, duration: 5, fling: { yaw: Math.atan2(1.8, -7.6), speed: 8.8 } },
    { type: 'springPad', pos: [3.5, 0, 4], radius: 1.1, style: 'mushroom', height: 11.85, duration: 5 },
    { type: 'checkpoint', pos: [9, 13, 3], yaw: -Math.PI / 2, zone: { min: [6, 12.5, 2], max: [10, 16, 8] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [1, 10.1, 18], to: [4, 10.1, 18], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [7.5, 13.6, 3], to: [7.5, 13.6, 7], count: 3 },
    { type: 'sweet', kind: 'bramble', pos: [-2.5, 9.5, 17.5] },
  );
  for (const z of [8, 16]) wallTorch(b, flames, [-9.98, 8, z], Math.PI / 2);
  wallTorch(b, flames, [9.98, 11, 12], -Math.PI / 2);
  b.lantern([0, 14.5, 10], 10, 20);

  // ================================================================ the Bellfry (floor 17.5)
  b.box([0, 26.5, 18.75], [20, 1, 2.5], { color: COLORS.wood, pattern: 'planks' }); // walkway (top 27)
  // The walkway's south side: a full wall east of the landing gap, a parapet west of it.
  b.box([-5.75, 29.5, 17.65], [8.5, 5, 0.3], { color: STONE });
  b.box([5.75, 27.6, 17.65], [8.5, 1.2, 0.3], { color: COLORS.woodDark });
  b.box([-4, 31.4, 18.75], [0.8, 1.2, 2.5], { color: STONE }); // above the gate
  // The great bell, hanging over the middle. Its flat top (29.2) can be bounced onto.
  deco(b, new CylinderGeometry(0.9, 1.6, 3.2, 16, 1, true), [0, 26.8, 12], '#c99a3e');
  deco(b, new SphereGeometry(0.9, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 28.4, 12], '#c99a3e');
  deco(b, new TorusGeometry(1.6, 0.1, 6, 20).rotateX(Math.PI / 2), [0, 25.2, 12], '#a87a2c');
  deco(b, new CylinderGeometry(0.12, 0.2, 1, 6), [0, 25.4, 12], '#3a3340');
  deco(b, new CylinderGeometry(0.08, 0.08, 3, 5), [0, 30.6, 12], '#3a3340');
  b.cylinder([0, 27.1, 12], 1.1, 4.2, '#c99a3e', { noGrab: true }, 12);
  b.add(
    { type: 'checkpoint', pos: [-8, 17.5, 2.5], yaw: Math.PI / 2, zone: { min: [-10, 17, 0], max: [10, 21, 16] } },
    { type: 'trigger', flag: 'tower-hint-bellfry', script: 'towerBellfry', min: [-10, 17, 0], max: [10, 21, 16] },
    { type: 'knockSwitch', id: 't-knock', pos: [0, 22.5, 19.95], yaw: Math.PI, timed: 9 },
    { type: 'gate', pos: [-4, 27, 18.75], yaw: Math.PI / 2, width: 2.5, height: 3.2, when: ['t-knock'] },
    { type: 'springPad', pos: [0, 17.5, 15.2], radius: 1.3, style: 'rune', duration: 6 },
    { type: 'springPad', pos: [-8, 27, 18.75], radius: 1.2, style: 'mattress', duration: 6 },
    { type: 'snapcasket', id: 't-snap1', pos: [-5, 17.5, 8], yaw: 0, wander: 3 },
    { type: 'snapcasket', id: 't-snap2', pos: [6.5, 17.5, 12], yaw: -Math.PI / 2, wander: 3 },
    { type: 'card', card: 'bouncewort', pos: [0, 30, 12] },
    { type: 'secret', id: 'tower-bell', area: 'bellfry', min: [-1.6, 29, 10.4], max: [1.6, 32, 13.6] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 18.1, 6], to: [-8, 18.1, 14], count: 4 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-9, 27.6, 18.75], to: [-5, 27.6, 18.75], count: 3 },
  );
  for (const z of [5, 12]) {
    wallTorch(b, flames, [-9.98, 20.5, z], Math.PI / 2);
    wallTorch(b, flames, [9.98, 20.5, z], -Math.PI / 2);
  }
  b.lantern([6, 30, 6], 9, 16);
  for (const [c, d1, d2] of [
    [[-10, 31.8, 0], [1, 0], [0, 1]],
    [[10, 31.8, 0], [-1, 0], [0, 1]],
  ] as [V3, [number, number], [number, number]][]) {
    cobweb(b, c, d1, d2, 1.4);
  }

  // ================================================================ the rooftops (y 32.5)
  // Turrets standing free of the tower, and the spire with the Star.
  b.cylinder([16.5, 15.5, 10], 2.6, 31, COLORS.stoneLight, undefined, 14);
  b.cylinder([23, 17, 4], 2.2, 34, COLORS.stoneLight, undefined, 14);
  b.cylinder([29.5, 18.5, 10], 3, 37, COLORS.stoneLight, undefined, 14);
  b.box([35, 22.5, 10], [5, 45, 5], { color: COLORS.stoneLight, info: { noGrab: true } });
  for (const [x, z, top, r] of [
    [16.5, 10, 31, 2.6],
    [23, 4, 34, 2.2],
    [29.5, 10, 37, 3],
  ]) {
    deco(b, new CylinderGeometry(r + 0.15, r + 0.15, 0.3, 14), [x, top - 0.12, z], COLORS.stoneDark);
    banner(b, [x, top - 1.8, z - r - 0.05], Math.PI, '#3f7a4a', '#e8c25a', 1, 2.2);
  }
  deco(b, new BoxGeometry(5.3, 0.4, 5.3), [35, 44.83, 10], COLORS.stoneDark);
  deco(b, new CylinderGeometry(0.06, 0.06, 4, 5), [36.8, 47, 8.2], '#3a3340');
  deco(b, new BoxGeometry(0.05, 0.9, 1.4), [36.8, 48.5, 8.9], '#e8c25a');
  deco(b, new ConeGeometry(1.2, 2.5, 4), [-6, ROOF + 1.25, 6], COLORS.roof, [0, Math.PI / 4, 0]);
  b.box([-6, ROOF + 0.6, 6], [1.2, 1.2, 1.2], { color: STONE });
  b.add(
    { type: 'checkpoint', pos: [-8, ROOF, 14.5], yaw: Math.PI / 2, zone: { min: [-10, 32, 0], max: [10, 36, 17] } },
    { type: 'trigger', flag: 'tower-hint-roof', script: 'towerRoof', min: [-10, 32, 0], max: [10, 36, 17] },
    { type: 'springPad', pos: [8.2, ROOF, 10], radius: 1, style: 'rune', duration: 5, fling: { yaw: Math.PI / 2, speed: 6.5 } },
    { type: 'springPad', pos: [16.5, 31, 10], radius: 1, style: 'rune', duration: 5, fling: { yaw: Math.atan2(6.5, -6), speed: 8.4 } },
    { type: 'springPad', pos: [23, 34, 4], radius: 1, style: 'rune', duration: 5, fling: { yaw: Math.atan2(6.5, 6), speed: 8.6 } },
    { type: 'springPad', pos: [29.5, 37, 10], radius: 1.2, style: 'moss', duration: 6 },
    { type: 'snapcasket', id: 't-snap3', pos: [28.6, 37, 11.4], yaw: -Math.PI / 2, wander: 1 },
    // The Star and the way down moved on to the Weathercock (replaced in place: ids stay put).
    { type: 'star', id: 'tower-star', pos: [63, 57.4, 10.4], script: 'towerComplete' },
    { type: 'door', pos: [63, 56, 12.9], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'hopgood', spawn: 'fromTower' }, label: 'Back to class' },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4, ROOF + 0.6, 10], to: [4, ROOF + 0.6, 10], count: 4 },
    { type: 'sweet', kind: 'humbug', pos: [23, 35, 4] },
  );

  weathercockRun(b);

  flames.finish(b, '#ffb060');
  b.finish();
}

/**
 * The Weathercock Run, on from the spire (top 45): a rune throws you to chimney C1, another
 * to C2, moss up to a narrow beam (top 53) with Hexlings swooping, a toadstool at its end
 * flings you onto the Weathercock (top 56), where a Sootling guards the Star. Falling puts
 * you back on the spire. Built last so the earlier rooms' sweets keep their ids.
 */
function weathercockRun(b: LevelBuilder): void {
  const C1: V3 = [43, 47, 10];
  const C2: V3 = [49.5, 50, 4];
  const F: V3 = [63, 56, 10];
  for (const [[x, top, z], r] of [
    [C1, 1.6],
    [C2, 1.4],
    [F, 3],
  ] as [V3, number][]) {
    b.cylinder([x, top / 2, z], r, top, COLORS.stoneLight, { noGrab: true }, 14);
    deco(b, new CylinderGeometry(r + 0.15, r + 0.15, 0.3, 14), [x, top - 0.12, z], COLORS.stoneDark);
  }
  // The beam: a narrow plank of stone, propped on one post.
  b.box([55, 52.85, 4], [7, 0.3, 1.2], { color: COLORS.stoneLight, info: { noGrab: true } });
  deco(b, new CylinderGeometry(0.35, 0.5, 52.7, 8), [55, 26.35, 4], COLORS.stoneLight);
  // The Weathercock itself, on a pole over the Star.
  deco(b, new CylinderGeometry(0.08, 0.08, 5, 6), [64.6, 58.5, 8.4], '#3a3340');
  deco(b, new ConeGeometry(0.5, 1.4, 4), [64.6, 61.2, 8.4], '#e8c25a', [0, 0, Math.PI / 2]);
  deco(b, new BoxGeometry(0.05, 0.9, 1.1), [64.2, 61.4, 8.4], '#e8c25a');
  banner(b, [F[0], F[1] - 2, F[2] - 3.05], Math.PI, '#3f7a4a', '#e8c25a', 1.2, 2.6);
  b.add(
    { type: 'checkpoint', pos: [33.4, 45, 11.6], yaw: Math.PI / 2, zone: { min: [32.5, 44, 7.5], max: [37.5, 48, 12.5] } },
    { type: 'trigger', flag: 'tower-hint-spire', script: 'towerSpire', min: [32.5, 44, 7.5], max: [37.5, 48, 12.5] },
    { type: 'springPad', pos: [36.6, 45, 10], radius: 0.8, style: 'rune', duration: 6, fling: { yaw: Math.PI / 2, speed: 6 } },
    { type: 'springPad', pos: [C1[0], C1[1], C1[2]], radius: 1, style: 'rune', duration: 6, fling: { yaw: Math.atan2(6.5, -6), speed: 7.1 } },
    { type: 'springPad', pos: [C2[0], C2[1], C2[2]], radius: 1, style: 'moss', duration: 6 },
    { type: 'springPad', pos: [58, 53, 4], radius: 0.55, style: 'mushroom', height: 0.25, duration: 6, fling: { yaw: Math.atan2(5, 6), speed: 7.6 } },
    { type: 'hexling', pos: [47, 46, 7], height: 4, radius: 3, interval: 3 },
    { type: 'hexling', pos: [56, 50, 7], height: 4, radius: 3, interval: 3.3 },
    { type: 'sootling', pos: [64.6, 56, 11], yaw: -Math.PI / 2, wander: 0.6, range: 16, interval: 3.4 },
    { type: 'sweetLine', kind: 'bramble', from: [52.5, 53.6, 4], to: [56.5, 53.6, 4], count: 3 },
  );
}
