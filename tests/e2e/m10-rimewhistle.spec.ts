import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The sixth lesson: the great doors and the Castle Grounds, Coldharbour's boathouse, the
// Flooded Cisterns, and what ice does back in the castle.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string>; sweets: number };
  world: { entities: { constructor: { name: string }; pos?: { x: number; y: number; z: number } }[] };
  shop: { buy(id: string): boolean };
};

const EARLIER = ['thwackwort', 'latchkin', 'springwell', 'glimmerwick', 'cindersnap'] as const;

async function prepared(page: Page, level: string, opts: { rime?: boolean; flags?: string[]; spawn?: string; cinderDone?: boolean } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts, earlier }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'mallowmere';
      const flags = ['sorted', 'greeted', 'gorse-reward', 'quince-reward', 'hopgood-reward', 'lamplough-reward', 'ashcombe-reward', 'coldharbour-lesson-started', 'cisterns-entered'];
      for (const f of [...flags, ...(opts.flags ?? [])]) g.state.flags.add(f);
      for (const s of earlier) {
        tw.learn(s);
        if (s !== 'cindersnap' || opts.cinderDone !== false) g.state.lessons.add(s);
      }
      if (opts.rime) tw.learn('rimewhistle');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts, earlier: [...EARLIER] },
  );
}

/** Cast at something from where you stand (hold > 0 charges); returns what was targeted. */
const castAt = (page: Page, from: [number, number, number], at: [number, number, number], hold = 0, wait = 0.6) =>
  page.evaluate(
    async ({ from, at, hold, wait }) => {
      const tw = window.__tw;
      tw.teleport(...from, 0);
      tw.advance(0.3);
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

const standOn = (page: Page, at: [number, number, number]) =>
  page.evaluate((at) => {
    const tw = window.__tw;
    tw.teleport(at[0], at[1] + 0.6, at[2], 0);
    tw.advance(0.6);
    return tw.state().feet.y;
  }, at);

/** Is there solid ground (ice) under this spot? Probes with a ray, without anyone falling in. */
const solidAt = (page: Page, at: [number, number, number]) =>
  page.evaluate((at) => {
    type V = { x: number; y: number; z: number };
    const s = (window.__tw.game as unknown as { session: { player: { pos: { constructor: new (x: number, y: number, z: number) => V } }; physics: { raycast(o: V, d: V, m: number): { point: V } | null } } }).session;
    const V3 = s.player.pos.constructor;
    const hit = s.physics.raycast(new V3(at[0], at[1] + 2, at[2]), new V3(0, -1, 0), 2.5);
    return hit !== null;
  }, at);

const walk = (page: Page, from: [number, number, number], yaw: number, seconds: number) =>
  page.evaluate(
    async ({ from, yaw, seconds }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.2);
      tw.input({ x: 0, y: 1 });
      for (let t = 0; t < seconds; t += 0.25) {
        tw.advance(0.25);
        await tw.idle();
      }
      tw.input(null);
      tw.advance(0.2);
      const s = tw.state();
      return { ...s.feet, level: s.level, area: s.area };
    },
    { from, yaw, seconds },
  );

/** Run at a wall or pillar and jump: with ledge grab and auto-climb, where do you end up? */
const climb = (page: Page, from: [number, number, number], yaw: number) =>
  page.evaluate(
    async ({ from, yaw }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.3);
      tw.input({ x: 0, y: 1, jump: true });
      tw.pressJump();
      for (let i = 0; i < 12; i++) tw.advance(0.15);
      tw.input(null);
      tw.advance(0.5);
      await tw.idle();
      return tw.state().feet.y;
    },
    { from, yaw },
  );

test('the great doors open onto the grounds once Cindersnap is passed, and lead back in', async ({ page, browserName }) => {
  await prepared(page, 'hub', { cinderDone: false });
  const tryDoors = () =>
    page.evaluate(async () => {
      const tw = window.__tw;
      tw.teleport(0, 0, 1.6, Math.PI);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    });
  expect(await tryDoors()).toBe('hub');
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('cindersnap'));
  expect(await tryDoors()).toBe('grounds');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, -10, Math.PI);
    tw.setCamera(Math.PI + 0.25, -0.35);
    tw.advance(0.5);
  });
  await shot(page, 'm10-grounds', browserName);
  // Down the stairs to the lawn, and the boathouse door.
  const down = await walk(page, [0, 0, -11], Math.PI, 2.5);
  expect(down.y).toBeLessThan(-2.8);
  expect(down.area).toBe('lawn');
  const back = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, -1.6, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { level: tw.state().level, z: tw.state().feet.z };
  });
  expect(back.level).toBe('hub');
  expect(back.z).toBeGreaterThan(1);
});

test('the Well Yard: Cindersnap thaws the frozen lock and the gate stays open', async ({ page }) => {
  await prepared(page, 'hub');
  const shut = await walk(page, [14.5, 0, 33], Math.PI, 1.5);
  expect(shut.z).toBeGreaterThan(30);
  expect(await castAt(page, [14.5, 0, 34], [14.5, 1.2, 30.45], 0, 2.5)).toBe('cindersnap');
  await page.evaluate(() => window.__tw.advance(2));
  const open = await walk(page, [14.5, 0, 33], Math.PI, 1.5);
  expect(open.z).toBeLessThan(29);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.save();
    tw.loadLevel('hub', 'fromGrounds');
    tw.advance(2);
  });
  const still = await walk(page, [14.5, 0, 33], Math.PI, 1.5);
  expect(still.z).toBeLessThan(29);
});

test('Coldharbour teaches Rimewhistle: freeze the pool, climb the frozen falls, charge for the long dock', async ({ page, browserName }) => {
  await prepared(page, 'coldharbour', { flags: ['hint-coldharbour-climb'] });
  await page.evaluate(async () => {
    const g = window.__tw.game as unknown as G;
    g.state.flags.delete('coldharbour-lesson-started');
    window.__tw.loadLevel('coldharbour');
    await window.__tw.idle();
    window.__tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('rimewhistle');
  // P1: the pool is too wide to jump; frozen, you walk across.
  expect(await standOn(page, [-6, -0.5, 8])).toBeLessThan(-0.5);
  expect(await castAt(page, [-2, 0, 8], [-6, -0.5, 8])).toBe('rimewhistle');
  expect(await standOn(page, [-6, -0.3, 8])).toBeGreaterThan(-0.4);
  const p1 = await walk(page, [-3, 0, 8], -Math.PI / 2, 1.6);
  expect(p1.x).toBeLessThan(-8.6);
  // It melts again: then it's water. While frozen it isn't a target at all.
  expect(await castAt(page, [-2, 0, 8], [-6, -0.5, 8])).toBeNull();
  await page.evaluate(() => window.__tw.advance(7));
  expect(await solidAt(page, [-6, -0.5, 8])).toBe(false);
  // P2: the ledge is out of reach until the waterfall freezes into a pillar to climb.
  expect(await climb(page, [4, 0, 9.5], Math.PI / 2)).toBeLessThan(1);
  expect(await castAt(page, [2, 0, 9.5], [5.9, 1.4, 9.5])).toBe('rimewhistle');
  expect(await climb(page, [4.2, 0, 9.5], Math.PI / 2)).toBeGreaterThan(2);
  expect(await climb(page, [5.5, 2.25, 9.5], Math.PI / 2)).toBeGreaterThan(3.5);
  await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(8.4, 3.6, 9.5, 0);
    tw.advance(0.5);
    await tw.idle();
  });
  // P3: a tap freeze melts in 1.2 s, too soon to cross; a charged one lasts 4 s.
  expect(await castAt(page, [0, 0, 12.5], [0, -0.5, 19])).toBe('rimewhistle');
  await page.evaluate(() => window.__tw.advance(4));
  expect(await solidAt(page, [0, -0.5, 19])).toBe(false);
  expect(await castAt(page, [0, 0, 12.5], [0, -0.5, 19], 1.2)).toBe('rimewhistle');
  await page.evaluate(() => window.__tw.advance(2.5));
  expect(await solidAt(page, [0, -0.5, 19])).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 12, 0);
    tw.setCamera(0, -0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm10-boathouse', browserName);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-9.3, 0, 8, 0);
    tw.advance(0.5);
    await tw.idle();
    tw.teleport(0, 0, 25.3, 0);
    tw.advance(0.5);
    await tw.idle();
    tw.advance(0.5);
    await tw.idle();
    const g = tw.game as unknown as G;
    const practice = g.state.flags.has('practice-rimewhistle');
    tw.teleport(8.4, 0, 3, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.level).toBe('cisterns');
});

test('the Long Canal: patch by patch over the water, then up the frozen falls', async ({ page, browserName }) => {
  await prepared(page, 'cisterns', { rime: true, flags: ['cistern-hint-canal', 'cistern-hint-falls'] });
  const patches: [number, number][] = [
    [-2, 13.5],
    [2, 17.3],
    [-2, 21.1],
    [2, 24.9],
    [0, 28.7],
  ];
  // Freeze the first two from the landing, then each next one from the patch before.
  expect(await castAt(page, [0, 0, 10], [-2, -0.5, 13.5])).toBe('rimewhistle');
  for (let i = 0; i < patches.length; i++) {
    const [x, z] = patches[i];
    expect(await standOn(page, [x, -0.3, z])).toBeGreaterThan(-0.4);
    if (i + 1 < patches.length) {
      const [nx, nz] = patches[i + 1];
      expect(await castAt(page, [x, -0.3, z], [nx, -0.5, nz], 0, 0.4)).toBe('rimewhistle');
    }
  }
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(2, -0.3, 24.9, 0);
    tw.setCamera(0, -0.2);
    tw.advance(0.2);
  });
  await shot(page, 'm10-canal', browserName);
  // The cliff: too high to climb until the waterfall freezes.
  expect(await climb(page, [0, 0, 31], 0)).toBeLessThan(1);
  expect(await castAt(page, [0, 0, 30.5], [0, 1.4, 33.4])).toBe('rimewhistle');
  expect(await climb(page, [0, 0, 31.4], 0)).toBeGreaterThan(2);
  expect(await climb(page, [0, 2.3, 33], 0)).toBeGreaterThan(3.1);
});

test('the Floe Ferry: shove floe A into the first gap, freeze round to push B into the second, ring to reset', async ({ page, browserName }) => {
  await prepared(page, 'cisterns', { rime: true, flags: ['cistern-hint-ferry'] });
  const floes = () =>
    page.evaluate(() => {
      const g = window.__tw.game as unknown as G;
      return g.world.entities.filter((e) => e.constructor.name === 'Floe').map((e) => ({ x: e.pos!.x, z: e.pos!.z }));
    });
  // A wrong shove (from the south bank) sends A north into the corner; the bell brings it back.
  expect(await castAt(page, [-5.5, 3.2, 35.5], [-5.5, 3, 41.5], 0, 4)).toBe('thwackwort');
  expect((await floes())[0].z).toBeGreaterThan(44);
  await castAt(page, [2, 3.2, 35.5], [4, 4.8, 34.9], 0, 1);
  expect((await floes())[0].z).toBeCloseTo(41.5, 1);
  // From the west walkway, A slides east until the post stops it in gap 1.
  expect(await castAt(page, [-9.2, 3.2, 41.5], [-5.5, 3, 41.5], 0, 4)).toBe('thwackwort');
  const a = (await floes())[0];
  expect(Math.abs(a.x)).toBeLessThan(0.6);
  expect(await standOn(page, [a.x, 3.2, 41.5])).toBeGreaterThan(2.9);
  expect(await standOn(page, [0, 3.4, 44.5])).toBeGreaterThan(3.3);
  // Floe B: freeze the patch to the east islet, stand east of B, shove it west.
  expect(await castAt(page, [0, 3.4, 44.5], [4.5, 2.7, 45.2])).toBe('rimewhistle');
  expect(await standOn(page, [4.5, 2.9, 45.2])).toBeGreaterThan(2.8);
  expect(await castAt(page, [9, 3.4, 48], [5.5, 3, 48], 0, 4)).toBe('thwackwort');
  const bFloe = (await floes())[1];
  expect(Math.abs(bFloe.x)).toBeLessThan(0.6);
  // Across: stone, floe, stone, to the north bank.
  expect(await standOn(page, [bFloe.x, 3.2, 48])).toBeGreaterThan(2.9);
  const over = await walk(page, [0, 3.4, 49], 0, 1.5);
  expect(over.z).toBeGreaterThan(53);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 3.4, 44.5, 0);
    tw.setCamera(0, -0.3);
    tw.advance(0.3);
  });
  await shot(page, 'm10-ferry', browserName);
  // The secret: walk through the waterfall on the north wall.
  const found = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(7.5, 3.2, 55, Math.PI / 2);
    tw.setCamera(Math.PI / 2, 0.2);
    tw.input({ x: 0, y: 1 });
    for (let i = 0; i < 8; i++) {
      tw.advance(0.25);
      await tw.idle();
    }
    tw.input(null);
    tw.advance(0.5);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(found.cards).toContain('rime-toad');
  expect(found.secrets).toContain('cistern-falls');
});

test('the Frost Hall: fire melts the ice wall, charged patches cross the channel, the Star thaws out', async ({ page, browserName }) => {
  await prepared(page, 'cisterns', { rime: true, flags: ['cistern-hint-frost', 'cistern-hint-charge'] });
  // The Boiler Hall's crabs (tested on their own) out of the way.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as { world: { entities: { constructor: { name: string }; home?: { y: number }; pos?: { y: number } }[] } };
    for (const e of g.world.entities) if (e.constructor.name === 'EmberCrab' && e.home && e.pos) e.home.y = e.pos.y = -100;
  });
  const blocked = await walk(page, [0, 3.2, 77.9], 0, 1.5);
  expect(blocked.z).toBeLessThan(78.6);
  expect(await castAt(page, [0, 3.2, 77.9], [0, 4.9, 79], 0, 2.5)).toBe('cindersnap');
  const through = await walk(page, [0, 3.2, 77.9], 0, 1.2);
  expect(through.z).toBeGreaterThan(79.5);
  // Plain patches melt before you're over; charged ones hold.
  expect(await castAt(page, [0, 3.2, 81], [0, 2.7, 83.6], 1.2)).toBe('rimewhistle');
  expect(await castAt(page, [0, 3.2, 81], [0, 2.7, 87.6], 1.2)).toBe('rimewhistle');
  expect(await standOn(page, [0, 2.9, 83.6])).toBeGreaterThan(2.8);
  expect(await standOn(page, [0, 2.9, 87.6])).toBeGreaterThan(2.8);
  expect(await standOn(page, [0, 3.2, 90])).toBeGreaterThan(3.1);
  // The sluice lever is frozen in; melt it out and knock it to open the way on.
  expect(await castAt(page, [0, 3.2, 90], [0, 5.1, 93], 0, 2.5)).toBe('cindersnap');
  expect(await castAt(page, [0, 3.2, 90.5], [0, 4.8, 93], 0, 0.6)).toBe('thwackwort');
  expect(await page.evaluate(() => window.__tw.signal('c-sluice'))).toBe(true);
  // (The Sluice Canal beyond has its own test.)
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 4.2, 138.8, 0);
    tw.advance(1);
    await tw.idle();
    const g = tw.game as unknown as G;
    const done = g.state.lessons.has('rimewhistle');
    tw.teleport(0, 3.2, 141.4, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const level = tw.state().level;
    tw.teleport(0, 0, 9.5, Math.PI);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    return { done, level, cards: tw.state().cards };
  });
  expect(r.done).toBe(true);
  expect(r.level).toBe('coldharbour');
  expect(r.cards).toContain('elspeth-coldharbour');
  await shot(page, 'm10-reward', browserName);
});

test('ice in the castle: across the lake to the folly, up the frozen spout to the balcony, out to the fountain', async ({ page, browserName }) => {
  await prepared(page, 'grounds', { rime: true });
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('rimewhistle'));
  for (const [x, z] of [
    [11.5, -55.5],
    [15, -61.5],
    [17.5, -67.5],
  ]) {
    expect(await castAt(page, [11, -3, -50.5], [x, -3.6, z], 0, 0.4)).toBe('rimewhistle');
  }
  for (const [x, z] of [
    [11.5, -55.5],
    [15, -61.5],
    [17.5, -67.5],
  ]) {
    expect(await standOn(page, [x, -3.4, z])).toBeGreaterThan(-3.5);
  }
  const folly = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(22, -3, -75, 0);
    tw.advance(0.8);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(folly.cards).toContain('isolde-fairweather');
  expect(folly.secrets).toContain('grounds-folly');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(11, -3, -50, Math.PI);
    tw.setCamera(Math.PI + 0.3, -0.25);
    tw.advance(0.3);
  });
  await shot(page, 'm10-lake', browserName);
  // The balcony: out of reach, until the spout's water freezes.
  expect(await climb(page, [-14.5, 0, -7.2], 0)).toBeLessThan(1.5);
  expect(await castAt(page, [-14.5, 0, -9], [-14.5, 1.8, -4.4])).toBe('rimewhistle');
  expect(await climb(page, [-14.5, 0, -6.6], 0)).toBeGreaterThan(2.2);
  expect(await climb(page, [-14.5, 2.5, -4.6], 0)).toBeGreaterThan(3.7);
  // The court fountain freezes over (and stays frozen for the visit).
  await page.evaluate(async () => {
    window.__tw.loadLevel('hub', 'fromGrounds');
    await window.__tw.idle();
    window.__tw.advance(0.3);
  });
  expect(await castAt(page, [0, 0, 39.5], [0, -0.35, 43.2])).toBe('rimewhistle');
  await page.evaluate(() => window.__tw.advance(20));
  expect(await standOn(page, [0, -0.2, 44.5])).toBeGreaterThan(-0.3);
});

test('Lost & Found has the Rime Toad; the Cisterns and the grounds sandboxes know Rimewhistle', async ({ page }) => {
  await prepared(page, 'hub', { rime: true });
  const cards = await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    g.state.lessons.add('rimewhistle');
    g.state.sweets = 100;
    g.shop.buy('lost-rime-toad');
    return [...g.state.cards];
  });
  expect(cards).toContain('rime-toad');
  await boot(page, '?test&level=cisterns');
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('rimewhistle');
  await boot(page, '?test&level=grounds');
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('rimewhistle');
});
