import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The harder rooms added to each trial: platforming under fire from the new foes.

type Ent = { constructor: { name: string }; pos?: { x: number; y: number; z: number }; home?: { y: number }; state?: string; spec?: { id?: string } };
type G = {
  state: { flags: Set<string> };
  world: { entities: Ent[] };
  session: { builder: { movers: { cur: { x: number; y: number; z: number } }[] } };
};

export async function sandbox(page: Page, level: string, flags: string[] = []): Promise<void> {
  await boot(page, `?test&level=${level}`);
  await page.evaluate(
    async ({ flags }) => {
      const g = window.__tw.game as unknown as G;
      for (const f of flags) g.state.flags.add(f);
      await window.__tw.idle();
    },
    { flags },
  );
}

/** Takes the named foes out of the fight (moved far below), so a test can check the route alone. */
export const calm = (page: Page, names: string[]) =>
  page.evaluate((names) => {
    for (const e of (window.__tw.game as unknown as G).world.entities) {
      if (!names.includes(e.constructor.name) || !e.pos) continue;
      e.pos.y = -100;
      if (e.home) e.home.y = -100;
    }
  }, names);

/** From one spot, walk towards another and jump after `jumpAt` s; where you end up after settling. */
export const leap = (page: Page, from: [number, number, number], to: [number, number], jumpAt = 0.04, run = 0.5) =>
  page.evaluate(
    async ({ from, to, jumpAt, run }) => {
      const tw = window.__tw;
      const yaw = Math.atan2(to[0] - from[0], to[1] - from[2]);
      tw.teleport(from[0], from[1], from[2], yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.15);
      tw.input({ x: 0, y: 1 });
      tw.advance(jumpAt);
      tw.pressJump();
      tw.input({ x: 0, y: 1, jump: true });
      for (let t = jumpAt; t < run; t += 0.02) tw.advance(0.02);
      tw.input(null);
      tw.advance(0.8);
      await tw.idle();
      return tw.state().feet;
    },
    { from, to, jumpAt, run },
  );

export const castAt = (page: Page, from: [number, number, number], at: [number, number, number], hold = 0, wait = 0.6) =>
  page.evaluate(
    async ({ from, at, hold, wait }) => {
      const tw = window.__tw;
      tw.teleport(...from, 0);
      tw.advance(0.2);
      await tw.idle();
      tw.aimAt(...at);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(hold);
      tw.advance(wait);
      await tw.idle();
      return t;
    },
    { from, at, hold, wait },
  );

test("Thwackwort Trial, the Sootling's Leap: pillar to pillar, the riding slab, then banish the Sootling", async ({ page, browserName }) => {
  await sandbox(page, 'trial', ['trial-entered', 'trial-hint-leap']);
  await calm(page, ['Hexling', 'Sootling', 'Gnarling']);
  const pillars: [number, number][] = [
    [0, 108.2],
    [-2.7, 110.7],
    [-0.4, 113.2],
    [2.2, 115.4],
  ];
  let at: [number, number, number] = [0, 0, 105.3];
  for (const [x, z] of pillars) {
    const f = await leap(page, at, [x, z]);
    expect(f.y, `onto the pillar at ${x}, ${z}`).toBeGreaterThan(-0.2);
    expect(Math.hypot(f.x - x, f.z - z)).toBeLessThan(0.9);
    at = [x, 0, z];
  }
  // Wait for the slab to come close, then hop on, ride it, and hop off onto pillar 5.
  const ride = await page.evaluate(async () => {
    const tw = window.__tw;
    const m = (tw.game as unknown as G).session.builder.movers;
    const slab = m[m.length - 1];
    tw.teleport(2.2, 0, 115.4, 0);
    for (let i = 0; i < 400 && slab.cur.z > 117.6; i++) tw.advance(0.02);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.pressJump();
    tw.input({ x: 0, y: 1, jump: true });
    tw.advance(0.35);
    tw.input(null);
    for (let i = 0; i < 400 && slab.cur.z < 122.6; i++) tw.advance(0.02);
    const onSlab = tw.state().feet;
    // A short hop: the slab has carried you to its front edge.
    tw.pressJump();
    tw.input({ x: 0, y: 0.5, jump: true });
    tw.advance(0.25);
    tw.input({ x: 0, y: 0, jump: true });
    tw.advance(0.3);
    tw.input(null);
    tw.advance(0.8);
    return { onSlab, after: tw.state().feet };
  });
  expect(ride.onSlab.y).toBeGreaterThan(-0.3);
  expect(ride.after.y).toBeGreaterThan(-0.2);
  expect(Math.hypot(ride.after.x - 2.2, ride.after.z - 125)).toBeLessThan(0.9);
  at = [2.2, 0, 125];
  for (const [x, z] of [
    [-0.5, 127.5],
    [-2.8, 129.8],
    [-2.8, 133],
  ] as [number, number][]) {
    const f = await leap(page, at, [x, z]);
    expect(f.y, `onto ${x}, ${z}`).toBeGreaterThan(-0.2);
    at = [x, 0, z];
  }
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-5, 0, 104.5, 0.2);
    tw.setCamera(0.2, 0.25);
    tw.advance(0.3);
  });
  await shot(page, 'm18-leap', browserName);
  // The gate stays shut until the Sootling is banished; up on his ledge, two thwacks.
  expect(await page.evaluate(() => window.__tw.signal('t-soot'))).toBe(false);
  await page.evaluate(() => {
    for (const e of (window.__tw.game as unknown as G).world.entities) {
      if (e.constructor.name === 'Sootling' && e.pos && e.home) {
        e.pos.y = 2.2;
        e.home.y = 2.2;
      }
    }
  });
  for (let i = 0; i < 2; i++) expect(await castAt(page, [3, 2.2, 133.5], [5.5, 3, 135.5], 0, 0.4)).toBe('thwackwort');
  await page.evaluate(() => window.__tw.advance(0.5));
  expect(await page.evaluate(() => window.__tw.signal('t-soot'))).toBe(true);
});
