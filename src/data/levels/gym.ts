import { ConeGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { paint, type LevelBuilder } from '../../world/builder';
import { COLORS, worldMaterial } from '../../world/materials';

/**
 * The feel gym: a greybox playground for tuning the controller and camera.
 * Spawn at the origin facing +Z. Rough map (top-down, +Z is "north"):
 *
 *   ramps (-30..-18)   stairs (-10)   ice (-14..-4)   bounce pad (0,22)   gaps (8)   pool (14..26)
 *   corridor & low tunnel in the south-west, ledge walls south of spawn, movers in the east.
 */
export function buildGym(b: LevelBuilder): { spawn: Vector3; yaw: number } {
  // ---------------------------------------------------------------- floor with a pool hole
  const FT = 3.5; // floor thickness so the pool has walls
  const floor = (minX: number, maxX: number, minZ: number, maxZ: number) =>
    b.box([(minX + maxX) / 2, -FT / 2, (minZ + maxZ) / 2], [maxX - minX, FT, maxZ - minZ], { color: COLORS.floor });
  floor(-45, 14, -40, 55);
  floor(26, 45, -40, 55);
  floor(14, 26, -40, 18);
  floor(14, 26, 34, 55);
  b.pool(14, 26, 18, 34, -0.5, -3.5);
  // Stepping stones across the pool.
  [
    [20, 20.8],
    [18.6, 23.6],
    [21, 26.8],
    [19, 30.6],
  ].forEach(([x, z]) => b.cylinder([x, -1.75, z], 0.85, 3.5, COLORS.stoneLight));
  b.label('Pool: fall in to test the water reset', [20, 2.2, 17]);

  b.label('Thistlewick Feel Gym', [0, 3, 6], 1.4);

  // ---------------------------------------------------------------- stairs & ramps
  b.stairs([-10, 0, 4], 0, 8, 0.25, 0.45, 3);
  b.box([-10, 1, 9.6], [3, 2, 4], { color: COLORS.stone });
  b.stairs([-6, 0, 4], 0, 5, 0.3, 0.5, 2);
  b.box([-6, 0.75, 7.5], [2, 1.5, 2], { color: COLORS.stone });
  b.label('Stairs (0.25 / 0.30 rise)', [-8, 3.2, 3]);

  const ramps: [number, number][] = [
    [15, -18],
    [30, -22],
    [45, -26],
    [56, -30],
  ];
  for (const [deg, x] of ramps) {
    const len = 6;
    const a = (deg * Math.PI) / 180;
    b.ramp([x, 0, 4], len, 3, deg, 0, deg > 50 ? COLORS.ochre : COLORS.stoneLight);
    const topY = Math.sin(a) * len;
    const endZ = 4 + Math.cos(a) * len;
    b.box([x, topY / 2, endZ + 1.5], [3, topY, 3], { color: COLORS.stone });
    b.label(`${deg}°`, [x, topY + 1.5, endZ + 1.5]);
  }

  // ---------------------------------------------------------------- ice
  b.box([-9, 0.05, 22], [10, 0.1, 12], { color: COLORS.ice, info: { surface: 'ice' } });
  b.label('Ice', [-9, 2, 16]);

  // ---------------------------------------------------------------- bounce pad + high shelf
  b.bouncePad([0, 0, 22], 1.2);
  b.box([0, 2.75, 27], [5, 5.5, 4], { color: COLORS.stone });
  b.box([0, 5.6, 27], [5, 0.2, 4], { color: COLORS.moss, noCollide: true });
  b.label('Bounce! (hold Space for higher)', [0, 3, 19]);
  b.lantern([2.6, 6.6, 25.2]);

  // ---------------------------------------------------------------- gap course
  const gapY = 1.5;
  b.stairs([8, 0, -2], 0, 6, 0.25, 0.5, 3);
  let z = 1;
  b.box([8, gapY / 2, z + 1.5], [3, gapY, 3], { color: COLORS.stoneLight });
  z += 3;
  for (const gap of [2, 3, 4, 5]) {
    z += gap;
    b.label(`${gap} m`, [8, gapY + 2, z - gap / 2]);
    b.box([8, gapY / 2, z + 1.5], [3, gapY, 3], { color: gap === 5 ? COLORS.ochre : COLORS.stoneLight });
    z += 3;
  }
  b.label('Gaps (5 m needs a ledge grab)', [8, 4.2, 0]);

  // ---------------------------------------------------------------- ledge walls
  const walls = [1.5, 2.2, 2.8, 3.2, 4];
  walls.forEach((h, i) => {
    const x = -8 + i * 4;
    b.box([x, h / 2, -10], [3, h, 2], { color: i % 2 ? COLORS.stone : COLORS.stoneLight });
    b.label(`${h} m`, [x, h + 0.9, -10]);
  });
  b.label('Ledges: jump at a wall to grab; W climb, S drop, A/D shimmy', [0, 5.6, -10], 1.1);
  // A long wall for shimmying.
  b.box([-20, 1.4, -10], [10, 2.8, 2], { color: COLORS.stoneDark });
  b.label('Shimmy wall', [-20, 3.8, -10]);

  // ---------------------------------------------------------------- narrow corridor & low tunnel
  const corridor = (x0: number, z0: number) => {
    const h = 2.6;
    const w = 2;
    // Leg 1 runs north along +Z, then turns east.
    b.box([x0 - w / 2 - 0.25, h / 2, z0 + 6], [0.5, h, 12], { color: COLORS.stone });
    b.box([x0 + w / 2 + 0.25, h / 2, z0 + 5], [0.5, h, 10], { color: COLORS.stone });
    b.box([x0 + 5, h / 2, z0 + 12.25], [10 + w + 0.5, h, 0.5], { color: COLORS.stone });
    b.box([x0 + 6, h / 2, z0 + 9.75], [10, h, 0.5], { color: COLORS.stone });
    b.box([x0, h + 0.25, z0 + 6], [w + 1, 0.5, 12.5], { color: COLORS.stoneDark });
    b.box([x0 + 6, h + 0.25, z0 + 11], [11, 0.5, w + 1], { color: COLORS.stoneDark });
    b.lantern([x0 + 0.6, 2.1, z0 + 6], 3, 6);
  };
  corridor(-34, -34);
  b.label('Narrow corridor (camera test)', [-34, 3.6, -35]);

  const tunnelH = 1.9;
  b.box([-42.5, tunnelH / 2, -18], [0.5, tunnelH, 8], { color: COLORS.stone });
  b.box([-38.5, tunnelH / 2, -18], [0.5, tunnelH, 8], { color: COLORS.stone });
  b.box([-40.5, tunnelH + 0.3, -18], [4.5, 0.6, 8], { color: COLORS.stoneDark });
  b.label('Low tunnel', [-40.5, 3.2, -22.5]);

  // ---------------------------------------------------------------- moving platforms
  b.box([32, 1.5, -6], [3, 3, 3], { color: COLORS.stone });
  b.box([32, 1.5, 12], [3, 3, 3], { color: COLORS.stone });
  b.stairs([32, 0, -12], 0, 12, 0.25, 0.4, 2.5);
  b.mover([2.5, 0.4, 2.5], COLORS.wood, (t) => new Vector3(32, 2.8, 3 + Math.sin(t * 0.8) * 5.2));
  b.label('Moving platform', [32, 5.5, 3]);

  b.mover([2.5, 0.4, 2.5], COLORS.wood, (t) => new Vector3(38, 0.2 + (1 - Math.cos(t * 0.7)) * 2.6, 3));
  b.box([38, 2.75, 7.5], [3, 5.5, 3], { color: COLORS.stone });
  b.label('Lift', [38, 7, 3]);

  // ---------------------------------------------------------------- set dressing
  b.prop(crookedTower(new Vector3(-6, 0, 50)));
  b.prop(crookedTower(new Vector3(30, 0, 48), 0.8));
  b.lantern([-2.5, 2.2, 3]);
  b.lantern([10.5, 3.6, 12]);

  b.finish();
  return { spawn: new Vector3(0, 0, 0), yaw: 0 };
}

/** A leaning castle tower to give the horizon some character. */
function crookedTower(at: Vector3, scale = 1): Group {
  const g = new Group();
  const mat = worldMaterial();
  let y = 0;
  let r = 3.2;
  let lean = 0;
  for (let i = 0; i < 4; i++) {
    const h = 4 + (i % 2);
    const seg = new Mesh(paint(new CylinderGeometry(r * 0.94, r, h, 9).toNonIndexed(), i % 2 ? COLORS.stone : COLORS.stoneLight, true), mat);
    lean += 0.06;
    seg.position.set(Math.sin(lean) * y * 0.15, y + h / 2, 0);
    seg.rotation.z = -lean * 0.4;
    seg.castShadow = true;
    g.add(seg);
    y += h - 0.1;
    r *= 0.9;
  }
  const roof = new Mesh(paint(new ConeGeometry(r * 1.35, 6, 9).toNonIndexed(), COLORS.roof, true), mat);
  roof.position.set(Math.sin(lean) * y * 0.15 + 0.3, y + 2.8, 0);
  roof.rotation.z = -0.22;
  g.add(roof);
  g.position.copy(at);
  g.scale.setScalar(scale);
  return g;
}
