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

test('Latchkin Vaults, the Counting House: three padlocks open at once from the walkway, under fire', async ({ page, browserName }) => {
  await sandbox(page, 'vault', ['vault-entered', 'vault-hint-counting']);
  await calm(page, ['Hexling', 'Sootling', 'Snapcasket']);
  // Up the stair onto the walkway.
  const up = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-7.25, 0, 123, 0);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(1.6);
    tw.input(null);
    tw.advance(0.3);
    return tw.state().feet;
  });
  expect(up.y).toBeGreaterThan(3.1);
  // From the walkway's north end: the alcove lock across the room, then down for the other two.
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const shoot = (from: [number, number, number], at: [number, number, number]) => {
      tw.teleport(...from, 0);
      tw.advance(0.15);
      tw.aimAt(...at);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      tw.advance(0.35);
      return t;
    };
    type Lock = { constructor: { name: string }; spec?: { id?: string }; pos?: { x: number; y: number; z: number } };
    const orbit = (tw.game as unknown as { world: { entities: Lock[] } }).world.entities.find((e) => e.spec?.id === 'v-c3')!;
    const t2 = shoot([-6.5, 3.2, 138], [10.9, 6, 132]);
    const t1 = shoot([1.5, 0, 149], [0, 1.6, 146.06]);
    const o = orbit.pos!;
    const t3 = shoot([0, 0, 149.5], [o.x, o.y, o.z]);
    tw.advance(0.4);
    const open = ['v-c1', 'v-c2', 'v-c3'].map((id) => tw.signal(id));
    tw.teleport(0, 0, 153, 0);
    tw.input({ x: 0, y: 1 });
    tw.advance(1);
    tw.input(null);
    return { t: [t1, t2, t3], open, z: tw.state().feet.z };
  });
  expect(r.t).toEqual(['latchkin', 'latchkin', 'latchkin']);
  expect(r.open).toEqual([true, true, true]);
  expect(r.z).toBeGreaterThan(155.5);
  // They snap shut again after 5.5 s.
  await page.evaluate(() => window.__tw.advance(6));
  expect(await page.evaluate(() => window.__tw.signal('v-c1'))).toBe(false);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(4, 0, 125, -0.3);
    tw.setCamera(-0.3, 0.3);
    tw.advance(0.3);
  });
  await shot(page, 'm18-counting', browserName);
});

test('Tumbledown Tower, the Weathercock Run: rune to rune, up to the beam, flung onto the Weathercock', async ({ page, browserName }) => {
  await sandbox(page, 'tower', ['tower-entered', 'tower-hint-spire', 'tower-hint-roof']);
  await calm(page, ['Hexling', 'Sootling', 'Snapcasket']);
  /** Spring a pad, then walk onto it from `from` (facing `yaw`) and let the bounce play out. */
  const bounce = (pad: [number, number, number], from: [number, number, number], yaw: number, settle = 2.2, steer = 0) =>
    page.evaluate(
      async ({ pad, from, yaw, settle, steer }) => {
        const tw = window.__tw;
        tw.teleport(from[0], from[1], from[2], yaw);
        tw.advance(0.2);
        tw.aimAt(pad[0], pad[1] + 0.1, pad[2]);
        tw.advance(0.05);
        const t = tw.state().target;
        tw.cast(0);
        tw.advance(0.3);
        tw.teleport(from[0], from[1], from[2], yaw);
        tw.setCamera(yaw, 0.2);
        tw.input({ x: 0, y: 1 });
        tw.advance(0.35);
        tw.input(steer ? { x: 0, y: steer } : null);
        for (let i = 0; i < settle / 0.1; i++) tw.advance(0.1);
        tw.input(null);
        tw.advance(0.4);
        return { t, feet: tw.state().feet };
      },
      { pad, from, yaw, settle, steer },
    );
  const c1 = await bounce([36.6, 45, 10], [34.6, 45, 10], Math.PI / 2);
  expect(c1.t).toBe('springwell');
  expect(c1.feet.y).toBeGreaterThan(46.9);
  const c2 = await bounce([43, 47, 10], [42.2, 47, 10.8], Math.atan2(0.8, -0.8));
  expect(c2.feet.y).toBeGreaterThan(49.9);
  // Moss on C2: straight up, then steer east onto the beam.
  const beam = await bounce([49.5, 50, 4], [48.7, 50, 4], Math.PI / 2, 1.6, 0.35);
  expect(beam.feet.y).toBeGreaterThan(52.9);
  const end = await bounce([58, 53, 4], [56.4, 53, 4], Math.PI / 2, 2);
  expect(end.feet.y).toBeGreaterThan(55.9);
  expect(Math.hypot(end.feet.x - 63, end.feet.z - 10)).toBeLessThan(3);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(34, 45, 9, Math.PI / 2 + 0.2);
    tw.setCamera(Math.PI / 2 + 0.2, 0.15);
    tw.advance(0.3);
  });
  await shot(page, 'm18-weathercock', browserName);
});

test('Lamplit Catacombs, the Moth Ossuary: three short lamps, a charged last stone, a charged way out', async ({ page, browserName }) => {
  await sandbox(page, 'catacombs', ['catacombs-entered', 'catacomb-hint-ossuary']);
  await calm(page, ['Hexling']);
  const stand = (at: [number, number, number]) =>
    page.evaluate(async (at) => {
      const tw = window.__tw;
      tw.teleport(at[0], at[1] + 0.4, at[2], 0);
      tw.advance(0.4);
      return tw.state().feet.y;
    }, at);
  // L1 from the landing: the first two stones.
  expect(await castAt(page, [0, 0, 99.6], [-1, 2.1, 100.6], 0, 0.3)).toBe('glimmerwick');
  expect(await stand([0.8, 0, 105.4])).toBeGreaterThan(-0.2);
  // L2, hanging over the chasm, lit from the second stone.
  expect(await castAt(page, [0.8, 0, 105.4], [2.5, 3.4, 108.5], 0, 0.3)).toBe('glimmerwick');
  expect(await stand([2, 0, 112.2])).toBeGreaterThan(-0.2);
  // L3 from the fifth: plain lights up to the ninth stone, not the tenth.
  expect(await castAt(page, [2, 0, 112.2], [-2.5, 3.4, 117], 0, 0.3)).toBe('glimmerwick');
  expect(await stand([-2.2, 0, 121.6])).toBeGreaterThan(-0.2);
  expect(await stand([-0.4, 0, 124.2])).toBeLessThan(-1);
  // ...the lamps go out after their few seconds: the stones with them.
  await page.evaluate(() => window.__tw.advance(8));
  expect(await stand([2, 0, 112.2])).toBeLessThan(-1);
  // Charged L3 reaches the tenth.
  await page.evaluate(() => window.__tw.advance(4));
  expect(await castAt(page, [-2, 0, 127.4], [-2.5, 3.4, 117], 1.2, 0.3)).toBe('glimmerwick');
  expect(await stand([-0.4, 0, 124.2])).toBeGreaterThan(-0.2);
  // The way out: the false wall only fades in a charged lamp.
  const walkOut = () =>
    page.evaluate(() => {
      const tw = window.__tw;
      tw.teleport(0, 0, 129.2, 0);
      tw.setCamera(0, 0.1);
      tw.input({ x: 0, y: 1 });
      tw.advance(1.2);
      tw.input(null);
      return tw.state().feet.z;
    });
  expect(await castAt(page, [3, 0, 127.4], [5, 2.1, 127.2], 0, 0.3)).toBe('glimmerwick');
  expect(await walkOut()).toBeLessThan(131);
  await page.evaluate(() => window.__tw.advance(9));
  expect(await castAt(page, [3, 0, 127.4], [5, 2.1, 127.2], 1.2, 0.3)).toBe('glimmerwick');
  expect(await walkOut()).toBeGreaterThan(132);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-4, 0, 100, 0.25);
    tw.setCamera(0.25, 0.15);
    tw.advance(0.3);
  });
  await shot(page, 'm18-ossuary', browserName);
});

test('Overgrown Glasshouse, the Hothouse Pool: burn your way across the pillars, then the two Sootlings', async ({ page, browserName }) => {
  await sandbox(page, 'glasshouse', ['glasshouse-entered', 'glasshouse-hint-hothouse']);
  await calm(page, ['Hexling', 'Sootling', 'Gnarling']);
  const pillars: [number, number][] = [
    [0, 106.2],
    [-2.4, 108.8],
    [0, 111.4],
    [2.6, 114],
    [0.4, 116.8],
    [-2.2, 119.4],
    [0, 122],
    [2.4, 124.6],
    [0.4, 127.2],
  ];
  // The briar and the Snapweed on the next pillar burn from the one before.
  const burnNext: Record<number, [number, number, number]> = { 1: [-2.4, 1.3, 108.8], 3: [2.6, 0.9, 114], 5: [-2.2, 1.3, 119.4], 6: [0, 0.9, 122] };
  let at: [number, number, number] = [0, 0, 103.3];
  for (const [i, [x, z]] of pillars.entries()) {
    if (burnNext[i]) expect(await castAt(page, at, burnNext[i], 0, 2.2), `burn what's on pillar ${i + 1}`).toBe('cindersnap');
    const f = await leap(page, at, [x, z]);
    expect(f.y, `onto pillar ${i + 1}`).toBeGreaterThan(-0.2);
    at = [x, 0, z];
  }
  const bank = await leap(page, at, [0.4, 130.6]);
  expect(bank.z).toBeGreaterThan(129.6);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-5, 0, 102, 0.3);
    tw.setCamera(0.3, 0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm18-hothouse', browserName);
  // Both Sootlings banished: the gate opens.
  await page.evaluate(() => {
    for (const e of (window.__tw.game as unknown as G).world.entities) {
      if (e.constructor.name === 'Sootling' && e.pos && e.home) {
        e.pos.y = 1.6;
        e.home.y = 1.6;
      }
    }
  });
  for (const x of [-6, 6]) for (let i = 0; i < 2; i++) expect(await castAt(page, [x * 0.5, 0, 131], [x, 2.3, 134], 0, 0.4)).toBe('thwackwort');
  await page.evaluate(() => window.__tw.advance(0.5));
  expect(await page.evaluate(() => [window.__tw.signal('g-soot1'), window.__tw.signal('g-soot2')])).toEqual([true, true]);
});

test('Flooded Cisterns, the Sluice Canal: charged ice, frozen crabs as stepping stones, a long charged patch', async ({ page, browserName }) => {
  await sandbox(page, 'cisterns', ['cisterns-entered', 'cistern-hint-sluice']);
  await calm(page, ['Hexling', 'Sootling']);
  const UP = 3.2;
  // A tap melts under you; a charged freeze carries you to the first stone.
  expect(await castAt(page, [0, UP, 98.6], [0, UP - 0.5, 101.4], 1.2, 0.2)).toBe('rimewhistle');
  const s1 = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 3.2, 99.2, 0);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.5);
    return tw.state().feet;
  });
  expect(s1.y).toBeGreaterThan(UP - 0.1);
  expect(s1.z).toBeGreaterThan(105.6);
  // The crabs: freeze each, hop on.
  let at: [number, number, number] = [0, UP, 107.4];
  for (const [x, z] of [
    [0, 110.1],
    [1.8, 112.7],
    [-0.6, 115.3],
  ] as [number, number][]) {
    expect(await castAt(page, at, [x, UP - 0.4, z], 0, 0.2), `freeze the crab at ${z}`).toBe('rimewhistle');
    const f = await leap(page, at, [x, z]);
    expect(f.y, `onto the crab at ${z}`).toBeGreaterThan(UP - 0.1);
    at = [x, f.y, z];
  }
  const s2 = await leap(page, at, [0, 118]);
  expect(s2.y).toBeGreaterThan(UP - 0.1);
  // The long patch, charged, to the far landing.
  expect(await castAt(page, [0, UP, 118.4], [0, UP - 0.5, 123], 1.2, 0.2)).toBe('rimewhistle');
  const far = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 3.2, 118.6, 0);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(2.6);
    tw.input(null);
    tw.advance(0.5);
    return tw.state().feet;
  });
  expect(far.z).toBeGreaterThan(128.2);
  expect(far.y).toBeGreaterThan(UP - 0.1);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-5, 3.2, 98, 0.25);
    tw.setCamera(0.25, 0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm18-sluice', browserName);
});
