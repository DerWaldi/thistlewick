import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The seventh lesson: the Clock Tower, Underbough's rooftop, the Great Clockworks, and
// what floating things open up back in the castle.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string>; sweets: number };
  world: { entities: { constructor: { name: string }; pos?: { x: number; y: number; z: number } }[] };
  shop: { buy(id: string): boolean };
};

const EARLIER = ['thwackwort', 'latchkin', 'springwell', 'glimmerwick', 'cindersnap', 'rimewhistle'] as const;

async function prepared(page: Page, level: string, opts: { air?: boolean; flags?: string[]; spawn?: string; rimeDone?: boolean } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts, earlier }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'bramblecote';
      const flags = ['sorted', 'greeted', 'gorse-reward', 'quince-reward', 'hopgood-reward', 'lamplough-reward', 'ashcombe-reward', 'coldharbour-reward', 'underbough-lesson-started', 'clockworks-entered'];
      for (const f of [...flags, ...(opts.flags ?? [])]) g.state.flags.add(f);
      for (const s of earlier) {
        tw.learn(s);
        if (s !== 'rimewhistle' || opts.rimeDone !== false) g.state.lessons.add(s);
      }
      if (opts.air) tw.learn('thistledown');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts, earlier: [...EARLIER] },
  );
}

/** Cast at something from where you stand; returns what was targeted. */
const castAt = (page: Page, from: [number, number, number], at: [number, number, number], wait = 0.6, facing = 0) =>
  page.evaluate(
    async ({ from, at, wait, facing }) => {
      const tw = window.__tw;
      tw.teleport(...from, facing);
      tw.advance(0.3);
      await tw.idle();
      tw.aimAt(...at);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      tw.advance(wait);
      await tw.idle();
      return t;
    },
    { from, at, wait, facing },
  );

/** Cast at what you're standing on (aiming at its feather-stone) and ride it; where do you end up? */
const ride = (page: Page, stone: [number, number, number], seconds: number) =>
  page.evaluate(
    async ({ stone, seconds }) => {
      const tw = window.__tw;
      tw.aimAt(...stone);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      for (let s = 0; s < seconds; s += 0.25) {
        tw.advance(0.25);
        await tw.idle();
      }
      return { target: t, feet: tw.state().feet };
    },
    { stone, seconds },
  );

const stand = (page: Page, at: [number, number, number], facing = 0) =>
  page.evaluate(
    ({ at, facing }) => {
      const tw = window.__tw;
      tw.teleport(at[0], at[1] + 0.3, at[2], facing);
      tw.advance(0.5);
      return tw.state().feet;
    },
    { at, facing },
  );

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
      return { ...s.feet, level: s.level, area: s.area, stamina: s.stamina };
    },
    { from, yaw, seconds },
  );

test('the Clock Tower opens once Rimewhistle is passed; seven flights up to Airs & Graces', async ({ page, browserName }) => {
  await prepared(page, 'hub', { rimeDone: false });
  const tryDoor = () =>
    page.evaluate(async () => {
      const tw = window.__tw;
      tw.teleport(0, 0, 60.4, Math.PI);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    });
  expect(await tryDoor()).toBe('hub');
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('rimewhistle'));
  expect(await tryDoor()).toBe('clocktower');
  // Walk the whole climb: up each flight in turn.
  const flights: [[number, number, number], number][] = [
    [[6, 0, 2.5], 0],
    [[6, 3.6, 14], -Math.PI / 2],
    [[-6, 7.2, 14], Math.PI],
    [[-6, 10.8, 2], Math.PI / 2],
    [[6, 14.4, 2.5], 0],
    [[6, 18, 14], -Math.PI / 2],
    [[-6, 21.6, 14], Math.PI],
  ];
  let top = 0;
  for (const [from, yaw] of flights) top = (await walk(page, from, yaw, 2.2)).y;
  expect(top).toBeGreaterThan(25);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(6, 14.4, 2, 0);
    tw.setCamera(-2.4, -0.35);
    tw.advance(0.3);
  });
  await shot(page, 'm11-tower', browserName);
  // Nobody falls down the shaft.
  const edge = await walk(page, [-6, 23.5, 8], Math.PI / 2, 2);
  expect(edge.y).toBeGreaterThan(20);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-6.6, 25.2, 2, -Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return tw.state().level;
  });
  expect(r).toBe('underbough');
});

test('Underbough teaches Thistledown: float the crate, ferry over the light-well, call the basket', async ({ page, browserName }) => {
  await prepared(page, 'underbough');
  await page.evaluate(async () => {
    const g = window.__tw.game as unknown as G;
    g.state.flags.delete('underbough-lesson-started');
    window.__tw.loadLevel('underbough');
    await window.__tw.idle();
    window.__tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('thistledown');
  // U1: on the crate, cast at its stone, and it floats you up to the dais.
  await stand(page, [5.3, 1.2, 6], Math.PI / 2);
  const up = await ride(page, [4.85, 2.5, 5.55], 2.5);
  expect(up.target).toBe('thistledown');
  expect(up.feet.y).toBeGreaterThan(3.5);
  const onDais = await walk(page, [5.3, 3.65, 6], Math.PI / 2, 1);
  expect(onDais.y).toBeGreaterThan(3.5);
  // U2: the light-well is too wide to jump; the platform ferries you over.
  await stand(page, [-4, 0, 13.3]);
  const over = await ride(page, [-2.95, 1.3, 14.25], 3);
  expect(over.target).toBe('thistledown');
  expect(over.feet.z).toBeGreaterThan(16.5);
  expect((await walk(page, [-4, 0.05, 17.7], 0, 0.8)).z).toBeGreaterThan(19.3);
  // U3: the basket waits up on the chimney; call it from across the roof, then ride it up.
  expect(await castAt(page, [3, 0, 4], [-5.95, 6.45, 4.65], 4, -Math.PI / 2)).toBe('thistledown');
  await stand(page, [-6.6, 0.3, 4]);
  const chimney = await ride(page, [-5.95, 1.75, 4.65], 3.5);
  expect(chimney.feet.y).toBeGreaterThan(4.9);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 9, 0);
    tw.setCamera(-2.3, -0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm11-rooftop', browserName);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    for (const [x, y, z] of [
      [8.3, 3.6, 6],
      [-4, 0, 20.6],
      [-8.6, 5, 4.6],
    ]) {
      tw.teleport(x, y, z, 0);
      tw.advance(0.4);
      await tw.idle();
    }
    tw.advance(0.5);
    await tw.idle();
    const g = tw.game as unknown as G;
    const practice = g.state.flags.has('practice-thistledown');
    tw.teleport(8.4, 0, 10, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.level).toBe('clockworks');
});

test('the Escapement Gallery: pendulums knock you off the walkway; in their gaps you get across', async ({ page, browserName }) => {
  await prepared(page, 'clockworks', { air: true, flags: ['clockworks-hint-gallery'] });
  // Stand in a pendulum's path: it hits.
  const hit = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 8, 0);
    const before = tw.state().stamina;
    for (let i = 0; i < 12; i++) {
      tw.advance(0.25);
      await tw.idle();
    }
    return before - tw.state().stamina;
  });
  expect(hit).toBeGreaterThan(0);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 5, 0);
    tw.setCamera(0, -0.1);
    tw.advance(0.3);
  });
  await shot(page, 'm11-gallery', browserName);
  // Timed right, a run straight down the walkway gets through untouched.
  const run = await page.evaluate(async () => {
    const tw = window.__tw;
    for (let attempt = 0; attempt < 30; attempt++) {
      tw.teleport(0, 0, 4.5, 0);
      tw.setCamera(0, 0.2);
      tw.advance(0.1 * attempt);
      const before = tw.state().stamina;
      tw.input({ x: 0, y: 1 });
      for (let i = 0; i < 16; i++) tw.advance(0.25);
      tw.input(null);
      const f = tw.state().feet;
      if (f.z > 22 && f.y > -0.5 && tw.state().stamina === before) return { attempt, ok: true };
      tw.advance(3);
      await tw.idle();
    }
    return { attempt: -1, ok: false };
  });
  expect(run.ok).toBe(true);
});

test('the Weights Shaft: ride lift A, call lift B from far enough to see it, ferry C before it floats home', async ({ page, browserName }) => {
  await prepared(page, 'clockworks', { air: true, flags: ['clockworks-hint-shaft', 'clockworks-hint-call'] });
  await stand(page, [0, 0, 32.8]);
  const a = await ride(page, [1.05, 1.3, 33.75], 3.5);
  expect(a.feet.y).toBeGreaterThan(5.9);
  expect((await walk(page, [0, 6.05, 32.8], 0, 0.6)).z).toBeGreaterThan(34);
  // From right underneath, B's stone is too steep to aim at; from the far corner it comes.
  expect(await castAt(page, [4.5, 6, 35], [5.55, 13.3, 33.75])).toBeNull();
  expect(await castAt(page, [-5.5, 6, 39.5], [5.55, 13.3, 33.75], 3.5)).toBe('thistledown');
  await stand(page, [4.5, 6, 32.8]);
  const b2 = await ride(page, [5.55, 7.3, 33.75], 3.5);
  expect(b2.feet.y).toBeGreaterThan(11.9);
  expect((await walk(page, [4.5, 12.05, 32.8], Math.PI, 0.6)).z).toBeLessThan(31.6);
  // C ferries north and floats home after 3 s: get off in time.
  // C crosses under a pendulum: time the ride between its swings (retrying, as a player would).
  const crossed = await page.evaluate(async () => {
    const tw = window.__tw;
    for (let attempt = 0; attempt < 12; attempt++) {
      tw.advance(4 + attempt * 0.27);
      await tw.idle();
      tw.teleport(-4, 12.3, 32.8, 0);
      tw.advance(0.4);
      tw.aimAt(-3.05, 13.15, 33.75);
      tw.advance(0.05);
      tw.cast(0);
      tw.advance(2.2);
      await tw.idle();
      const f = tw.state().feet;
      if (f.z > 37.5 && f.y > 11.9) return true;
    }
    return false;
  });
  expect(crossed).toBe(true);
  const off = await walk(page, [-4, 12.05, 38.6], 0, 0.8);
  expect(off.z).toBeGreaterThan(40.2);
  expect(off.area).toBe('wheel');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-5.5, 6, 39.5, 0);
    tw.setCamera(2.6, -0.35);
    tw.advance(0.3);
  });
  await shot(page, 'm11-shaft', browserName);
});

test('the Great Wheel carries you over; lift D brings fallers back; the crate to the owl', async ({ page, browserName }) => {
  await prepared(page, 'clockworks', { air: true, flags: ['clockworks-hint-wheel'] });
  // Wait on the south ledge for a platform to come up level, step on, ride, step off north.
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as { session: { builder: { movers: { cur: { y: number; z: number } }[] } } };
    tw.teleport(0, 12, 42.4, 0);
    tw.advance(0.3);
    await tw.idle();
    // Step onto a platform as it rises past the ledge.
    for (let i = 0; i < 400; i++) {
      tw.advance(1 / 60);
      const m = g.session.builder.movers.find((p) => Math.abs(p.cur.y - 11.9) < 0.15 && p.cur.z < 47);
      if (m) break;
    }
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(0.35);
    tw.input(null);
    // Ride over the top; hop off when it comes level with the north ledge.
    let left = false;
    for (let i = 0; i < 600 && !left; i++) {
      tw.advance(1 / 60);
      const f = tw.state().feet;
      if (f.z > 53.5 && f.y > 11.6 && f.y < 12.6) {
        tw.input({ x: 0, y: 1 });
        tw.advance(0.5);
        tw.input(null);
        left = true;
      }
    }
    tw.advance(0.5);
    return tw.state().feet;
  });
  expect(r.z).toBeGreaterThan(57);
  expect(r.y).toBeGreaterThan(11.5);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-5, 12, 42, 0);
    tw.setCamera(0.4, -0.3);
    tw.advance(0.3);
  });
  await shot(page, 'm11-wheel', browserName);
  // Fallen to the floor: lift D takes you back up, then floats home on its own.
  await stand(page, [3.5, 0, 41.8]);
  const d = await ride(page, [4.45, 1.3, 42.45], 5);
  expect(d.feet.y).toBeGreaterThan(11.9);
  expect((await walk(page, [3.5, 12.05, 41.8], -Math.PI / 2, 0.8)).x).toBeLessThan(2.3);
  await page.evaluate(() => window.__tw.advance(8));
  expect(await castAt(page, [0, 0, 47], [4.45, 1.3, 42.45])).toBe('thistledown');
  // The secret: float the crate up to the alcove.
  await stand(page, [-5.3, 1.2, 50], -Math.PI / 2);
  const crate = await ride(page, [-4.85, 2.5, 49.55], 2.5);
  expect(crate.feet.y).toBeGreaterThan(3.5);
  const found = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-7.8, 3.7, 50, -Math.PI / 2);
    tw.advance(0.8);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(found.cards).toContain('clockwork-owl');
  expect(found.secrets).toContain('clockworks-alcove');
});

test('the Bell Chamber: crate to the gallery, call the basket, ride past the clapper to the Star', async ({ page, browserName }) => {
  await prepared(page, 'clockworks', { air: true, flags: ['clockworks-hint-bell'] });
  await stand(page, [-4.5, 13.2, 69.3]);
  const e = await ride(page, [-4.05, 14.5, 68.85], 3);
  expect(e.feet.y).toBeGreaterThan(15.9);
  expect((await walk(page, [-4.5, 16.05, 69.3], 0, 0.6)).z).toBeGreaterThan(70);
  expect(await castAt(page, [-5, 16, 72.5], [3.75, 20.3, 69.45], 3)).toBe('thistledown');
  // Ride up just as the clapper swings away to the far side, the way a player times it.
  const up = await page.evaluate(async () => {
    const tw = window.__tw;
    type P = { constructor: { name: string }; spec: { pos: number[]; period: number }; time: number };
    const g = tw.game as unknown as { world: { entities: P[] } };
    const clapper = g.world.entities.find((e) => e.constructor.name === 'Pendulum' && e.spec.pos[2] === 68.8)!;
    tw.teleport(3, 16.3, 68.8, Math.PI);
    tw.advance(0.4);
    await tw.idle();
    const before = tw.state().stamina;
    for (let i = 0; i < 600 && Math.sin((clapper.time / clapper.spec.period) * Math.PI * 2) > -0.97; i++) tw.advance(1 / 60);
    tw.aimAt(3.75, 17.3, 69.45);
    tw.advance(0.05);
    tw.cast(0);
    tw.advance(2.4);
    await tw.idle();
    return tw.state().feet.y > 18.9 && tw.state().stamina === before;
  });
  expect(up).toBe(true);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(3, 19, 65.6, Math.PI);
    tw.advance(1);
    await tw.idle();
    const g = tw.game as unknown as G;
    const done = g.state.lessons.has('thistledown');
    tw.teleport(-3, 16, 75.2, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const level = tw.state().level;
    tw.teleport(0, 0, 8.5, Math.PI);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    return { done, level, cards: tw.state().cards };
  });
  expect(r.done).toBe(true);
  expect(r.level).toBe('underbough');
  expect(r.cards).toContain('hazel-underbough');
  await shot(page, 'm11-reward', browserName);
});

test('the Clock Tower nook: a crate floats up to it (Thistledown)', async ({ page }) => {
  await prepared(page, 'clocktower', { air: true });
  await stand(page, [-6, 8.4, 15.3], 0);
  const up = await ride(page, [-5.55, 9.7, 14.85], 3);
  expect(up.feet.y).toBeGreaterThan(10.1);
  const nook = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-6, 10.3, 17.3, 0);
    tw.advance(0.8);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(nook.cards).toContain('cornelius-cogwhistle');
  expect(nook.secrets).toContain('tower-nook');
});

test('Lost & Found has the Clockwork Owl; the Clockworks sandbox knows Thistledown', async ({ page }) => {
  await prepared(page, 'hub', { air: true });
  const cards = await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    g.state.lessons.add('thistledown');
    g.state.sweets = 100;
    g.shop.buy('lost-clockwork-owl');
    return [...g.state.cards];
  });
  expect(cards).toContain('clockwork-owl');
  await boot(page, '?test&level=clockworks');
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('thistledown');
});
