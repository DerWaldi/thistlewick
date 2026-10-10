import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// Students' errands: givers appear once their lesson is done, lost things only while the
// errand is accepted, and each one is hidden behind a new climb or spell puzzle.

type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string>; sweets: number };
  world: { entities: { constructor: { name: string }; spec?: { speaker?: string; quest?: string } }[] };
};
const ALL = ['thwackwort', 'latchkin', 'springwell', 'glimmerwick', 'cindersnap', 'rimewhistle', 'thistledown'];

/** A fresh, sorted game with lessons done up to and including `upTo`, in `level`. */
async function start(page: Page, upTo: string, level: string, spawn = 'default'): Promise<void> {
  await boot(page, '?test&new');
  await page.evaluate(
    async ({ all, upTo, level, spawn }) => {
      const tw = window.__tw;
      await tw.idle();
      const g = tw.game as unknown as G;
      g.state.house = 'yarrowdown';
      for (const f of ['sorted', 'greeted', 'upper-hint-leads']) g.state.flags.add(f);
      for (const s of all.slice(0, all.indexOf(upTo) + 1)) {
        tw.learn(s);
        g.state.lessons.add(s);
      }
      tw.loadLevel(level, spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { all: ALL, upTo, level, spawn },
  );
}

const givers = (page: Page) =>
  page.evaluate(() => (window.__tw.game as unknown as G).world.entities.filter((e) => e.spec?.quest).map((e) => e.spec!.quest!));

/** Walk up to a giver and talk; `choice` 0 accepts. */
const talk = (page: Page, at: [number, number, number], choice = 0) =>
  page.evaluate(
    async ({ at, choice }) => {
      const tw = window.__tw;
      tw.teleport(...at, 0);
      tw.advance(0.3);
      tw.choose(choice);
      tw.interact();
      await tw.idle();
      tw.advance(0.2);
      return tw.state().focus;
    },
    { at, choice },
  );

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

const walk = (page: Page, from: [number, number, number], yaw: number, seconds: number, jump = false) =>
  page.evaluate(
    async ({ from, yaw, seconds, jump }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.2);
      tw.input({ x: 0, y: 1, jump });
      for (let t = 0; t < seconds; t += 0.25) {
        tw.advance(0.25);
        await tw.idle();
      }
      tw.input(null);
      tw.advance(0.3);
      await tw.idle();
      const s = tw.state();
      return { ...s.feet, area: s.area };
    },
    { from, yaw, seconds, jump },
  );

/** Walk, pressing jump after `jumpAt` seconds (to grab a ledge or clear a gap). */
const hop = (page: Page, from: [number, number, number], yaw: number, jumpAt: number, seconds: number) =>
  page.evaluate(
    async ({ from, yaw, jumpAt, seconds }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.2);
      tw.input({ x: 0, y: 1 });
      tw.advance(jumpAt);
      // Pressed and held, like a real jump: a bare tap would cut it short.
      tw.pressJump();
      tw.input({ x: 0, y: 1, jump: true });
      for (let t = jumpAt; t < seconds; t += 0.1) tw.advance(0.1);
      tw.input(null);
      tw.advance(0.6);
      await tw.idle();
      return tw.state().feet;
    },
    { from, yaw, jumpAt, seconds },
  );

const standOn = (page: Page, at: [number, number, number]) =>
  page.evaluate(async (at) => {
    const tw = window.__tw;
    tw.teleport(at[0], at[1] + 0.4, at[2], 0);
    tw.advance(0.5);
    await tw.idle();
    return tw.state().feet.y;
  }, at);

const flags = (page: Page) => page.evaluate(() => [...(window.__tw.game as unknown as G).state.flags].filter((f) => f.startsWith('quest:')));

test("Pip's kite: no Pip before Thwackwort; accept, fetch it off the north walkway, get a card", async ({ page, browserName }) => {
  await start(page, 'latchkin', 'hub');
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.lessons.delete('thwackwort');
    g.state.lessons.delete('latchkin');
    tw.loadLevel('hub');
    await tw.idle();
  });
  expect(await givers(page)).toEqual([]);
  await page.evaluate(async () => {
    const tw = window.__tw;
    (tw.game as unknown as G).state.lessons.add('thwackwort');
    tw.loadLevel('hub');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await givers(page)).toEqual(['kite']);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(3.5, 0, 36.5, 0);
    tw.setCamera(0, 0.15);
    tw.advance(0.4);
  });
  await shot(page, 'm15-pip', browserName);
  // Saying "not now" leaves it on offer.
  await talk(page, [3.5, 0, 38.2], 1);
  expect(await flags(page)).toEqual([]);
  await talk(page, [3.5, 0, 38.2], 0);
  expect(await flags(page)).toEqual(['quest:kite']);
  // Up on the walkway behind the clock.
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(10, 8, 63.2, Math.PI / 2);
    tw.advance(0.4);
  });
  expect(await walk(page, [10, 8, 63.2], Math.PI / 2, 0.8).then((p) => p.y)).toBeGreaterThan(7.9);
  expect(await flags(page)).toContain('quest:kite:found');
  const before = await page.evaluate(() => (window.__tw.game as unknown as G).state.sweets);
  await talk(page, [3.5, 0, 38.2]);
  const after = await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    return { sweets: g.state.sweets, card: g.state.cards.has('ignatius-peel') };
  });
  expect(await flags(page)).toContain('quest:kite:done');
  expect(after.card).toBe(true);
  expect(after.sweets).toBeGreaterThan(before);
});

test("Oswin's book: a rune tile on the mezzanine bounces you onto the bookcase tops", async ({ page, browserName }) => {
  await start(page, 'springwell', 'upper');
  expect(await givers(page)).toEqual(['book']);
  await talk(page, [-28, 0, 15.6]);
  expect(await flags(page)).toEqual(['quest:book']);
  expect(await castAt(page, [-30, 5, 37.3], [-30, 5.1, 37.7], 0, 0.3)).toBe('springwell');
  const up = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-30, 5, 37.2, 0);
    tw.setCamera(0, 0.2);
    tw.advance(0.2);
    tw.input({ x: 0, y: 0.35, jump: true });
    for (let i = 0; i < 12; i++) tw.advance(0.25);
    tw.input(null);
    tw.advance(0.4);
    return tw.state().feet;
  });
  expect(up.y).toBeGreaterThan(9);
  // Along the planks, over the gaps, to the book.
  const gap1 = await hop(page, [-27, 9.2, 39.45], Math.PI / 2, 0.18, 0.9);
  expect(gap1.y).toBeGreaterThan(9);
  expect(gap1.x).toBeGreaterThan(-23.8);
  const gap2 = await hop(page, [-17.6, 9.2, 39.45], Math.PI / 2, 0.18, 0.9);
  expect(gap2.y).toBeGreaterThan(9);
  expect(gap2.x).toBeGreaterThan(-14.6);
  expect(await walk(page, [-11.5, 9.2, 39.45], Math.PI / 2, 0.4).then((p) => p.y)).toBeGreaterThan(9);
  expect(await flags(page)).toContain('quest:book:found');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-26, 5, 38.2, Math.PI / 2);
    tw.setCamera(Math.PI / 2 + 0.25, 0.45);
    tw.advance(0.3);
  });
  await shot(page, 'm15-library-ledge', browserName);
  await talk(page, [-28, 0, 15.6]);
  expect(await flags(page)).toContain('quest:book:done');
});

test("Tilda's toad: a false wall in the Undercroft, a flooded cellar crossed on lamplit stones", async ({ page, browserName }) => {
  await start(page, 'glimmerwick', 'hub');
  await talk(page, [2.6, 0, 9.5]);
  expect(await flags(page)).toEqual(['quest:toad']);
  // The corridor's north wall is solid until its lamp is lit.
  expect((await walk(page, [24.5, -7.5, 2.5], 0, 0.8)).z).toBeLessThan(4);
  expect(await castAt(page, [24.5, -7.5, 3], [24.5, -5.1, 1.2], 0, 0.3)).toBe('glimmerwick');
  const inside = await walk(page, [24.5, -7.5, 2.5], 0, 0.8);
  expect(inside.z).toBeGreaterThan(5.5);
  expect(inside.area).toBe('cellar');
  expect(await castAt(page, [26, -7.5, 6.5], [26.8, -5.9, 7.6], 0, 0.3)).toBe('glimmerwick');
  expect(await standOn(page, [27, -7.5, 13.8])).toBeGreaterThan(-7.7);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(27, -7.5, 6, 0);
    tw.setCamera(0, 0.15);
    tw.advance(0.2);
  });
  await shot(page, 'm15-cellar', browserName);
  expect((await walk(page, [27, -7.5, 15.5], 0, 0.6)).z).toBeGreaterThan(17);
  expect(await flags(page)).toContain('quest:toad:found');
  // And back out: the inside lamp opens the false wall from this side.
  await page.evaluate(() => window.__tw.advance(12));
  expect(await castAt(page, [23.5, -7.5, 7.5], [22.3, -5.9, 6.3], 0, 0.3)).toBe('glimmerwick');
  expect((await walk(page, [24.5, -7.5, 5.8], Math.PI, 0.8)).z).toBeLessThan(3.5);
});

test("Hattie's hat: burn the hay, bounce off the moss, glimmer steps up the dovecote", async ({ page, browserName }) => {
  await start(page, 'cindersnap', 'hub');
  await talk(page, [13.5, 0, 50.5]);
  expect(await flags(page)).toEqual(['quest:hat']);
  // The yard gate's ice first.
  expect(await castAt(page, [14.5, 0, 32.5], [14.5, 1.2, 30.45], 0, 2)).toBe('cindersnap');
  expect((await walk(page, [14.5, 0, 32], Math.PI, 1)).z).toBeLessThan(29);
  // The shed roof can be climbed straight from the yard; the walkway can't, for the hay.
  expect((await hop(page, [19.5, 0, 25.8], 0, 0.15, 1.5)).y).toBeGreaterThan(2.7);
  expect(await castAt(page, [19.5, 2.8, 28.2], [22.6, 5.4, 29.2], 0, 3)).toBe('cindersnap');
  const walkway = await hop(page, [20.4, 2.8, 29.2], Math.PI / 2, 0.1, 1.5);
  expect(walkway.y).toBeGreaterThan(4.1);
  // Moss on the walkway up to the annex.
  expect(await castAt(page, [23.2, 4.2, 29.2], [25.4, 4.3, 29.2], 0, 0.3)).toBe('springwell');
  const annex = await walk(page, [23.8, 4.2, 29.2], Math.PI / 2, 1.5);
  expect(annex.y).toBeGreaterThan(7.9);
  // The lamp on the annex, then the glimmer steps.
  expect(await castAt(page, [28.8, 8, 29.3], [27.4, 9.6, 29.3], 0, 0.3)).toBe('glimmerwick');
  expect(await standOn(page, [28.3, 9.2, 26.5])).toBeGreaterThan(9.1);
  expect(await standOn(page, [29.8, 10.4, 25.5])).toBeGreaterThan(10.3);
  const top = await hop(page, [29.6, 10.4, 25.8], Math.PI / 2 + 0.4, 0.1, 0.9);
  expect(top.y).toBeGreaterThan(11.5);
  expect((await walk(page, [31.2, 11.6, 26.2], 0.6, 0.4)).y).toBeGreaterThan(11.5);
  expect(await flags(page)).toContain('quest:hat:found');
  // The barriers keep you off the corridor roof and in the yard.
  const off = await hop(page, [32, 11.6, 26.5], Math.PI, 0.25, 1.5);
  expect(off.z).toBeGreaterThan(24.8);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(18, 0, 18, 0.7);
    tw.setCamera(0.7, 0.3);
    tw.advance(0.3);
  });
  await shot(page, 'm15-well-yard', browserName);
});

test("Ned's float: freeze between the old moorings (charged for the long one), burn the Snapweed", async ({ page, browserName }) => {
  await start(page, 'rimewhistle', 'grounds');
  await talk(page, [11, -3, -43.5]);
  expect(await flags(page)).toEqual(['quest:float']);
  expect(await castAt(page, [42, -3, -42.2], [42, -3.6, -46], 0, 0.3)).toBe('rimewhistle');
  expect((await walk(page, [42, -3, -42.6], Math.PI, 1.3)).z).toBeLessThan(-49.2);
  // A plain freeze on the long stretch melts under you; a charged one holds.
  expect(await castAt(page, [42, -3.2, -50], [42, -3.6, -55.5], 1.2, 0.3)).toBe('rimewhistle');
  const r2 = await walk(page, [42, -3.2, -50.2], Math.PI, 1.9);
  expect(r2.z).toBeLessThan(-60);
  expect(r2.y).toBeGreaterThan(-3.4);
  expect(await castAt(page, [42, -3.2, -61], [48.4, -2.6, -61.2], 0, 2)).toBe('cindersnap');
  expect(await castAt(page, [42, -3.2, -61], [45, -3.6, -60.8], 0, 0.3)).toBe('rimewhistle');
  const bank = await walk(page, [42.6, -3.2, -60.8], Math.PI / 2, 1.2);
  expect(bank.x).toBeGreaterThan(47);
  expect((await walk(page, [48.6, -3.2, -60], 0, 0.6)).z).toBeGreaterThan(-58.8);
  expect(await flags(page)).toContain('quest:float:found');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(42, -3, -42.3, Math.PI + 0.25);
    tw.setCamera(Math.PI + 0.25, 0.3);
    tw.advance(0.3);
  });
  await shot(page, 'm15-moorings', browserName);
  await talk(page, [11, -3, -43.5]);
  expect(await page.evaluate(() => (window.__tw.game as unknown as G).state.cards.has('ebbing-rooke'))).toBe(true);
});

/** Aim at a sky lift's feather-stone (wherever its post is) and cast. */
const callLift = (page: Page, from: [number, number, number], id: string, wait: number) =>
  page.evaluate(
    async ({ from, id, wait }) => {
      const tw = window.__tw;
      type Lift = { constructor: { name: string }; spec?: { id?: string }; aimPoint(out: unknown): { x: number; y: number; z: number } };
      const g = tw.game as unknown as { world: { entities: Lift[] }; session: { player: { pos: { clone(): unknown } } } };
      tw.teleport(...from, 0);
      tw.advance(0.3);
      await tw.idle();
      const lift = g.world.entities.find((e) => e.constructor.name === 'SkyLift' && e.spec?.id === id)!;
      const p = lift.aimPoint(g.session.player.pos.clone());
      tw.aimAt(p.x, p.y, p.z);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      tw.advance(wait);
      return t;
    },
    { from, id, wait },
  );

test("Mabel's hedgehog: the Old Woods, from the thicket to the Old Oak, and home", async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await start(page, 'thistledown', 'grounds');
  // The gate stays shut until Mabel asks.
  const shut = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(48.9, -3, -27, Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return tw.state().level;
  });
  expect(shut).toBe('grounds');
  await talk(page, [45, -3, -25]);
  expect(await flags(page)).toEqual(['quest:hedgehog']);
  const inside = await page.evaluate(async () => {
    const tw = window.__tw;
    (tw.game as unknown as G).state.flags.add('woods-entered');
    for (const h of ['thicket', 'dell', 'basket', 'hollow', 'falls', 'oak']) (tw.game as unknown as G).state.flags.add(`woods-hint-${h}`);
    tw.teleport(48.9, -3, -27, Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    await tw.idle();
    return tw.state().level;
  });
  expect(inside).toBe('woods');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 3, 0);
    tw.setCamera(0, 0.15);
    tw.advance(0.3);
  });
  await shot(page, 'm15-woods-wicket', browserName);
  // The thicket: too tall to climb, burns.
  expect((await hop(page, [0, 0, 8], 0, 0.1, 1)).z).toBeLessThan(10);
  expect(await castAt(page, [0, 0, 7.5], [0, 2, 11], 0, 3)).toBe('cindersnap');
  for (const x of [-1.6, 1.6]) expect(await castAt(page, [x * 0.4, 0, 13.5], [x, 1, 19.3], 0, 2)).toBe('cindersnap');
  await page.evaluate(() => {
    for (const e of (window.__tw.game as unknown as { world: { entities: { constructor: { name: string }; pos?: { y: number } }[] } }).world.entities) {
      if (e.constructor.name === 'Gnarling' && e.pos) e.pos.y = -100;
    }
  });
  expect((await walk(page, [0, 0, 8], 0, 2.4)).z).toBeGreaterThan(21);
  // The dell: up onto the west shelf, then flung onto the ridge.
  expect(await castAt(page, [-1, 0, 31], [-3.6, 0.5, 34], 0, 0.3)).toBe('springwell');
  const shelf = await walk(page, [-1, 0, 34], -Math.PI / 2, 1.6);
  expect(shelf.y).toBeGreaterThan(4.4);
  expect(await castAt(page, [-13, 4.5, 35.5], [-11, 5, 38], 0, 0.3)).toBe('springwell');
  await walk(page, [-11, 4.5, 36.4], 0, 1);
  const ridge = await page.evaluate(() => {
    window.__tw.advance(1);
    return window.__tw.state().feet;
  });
  expect(ridge.y).toBeGreaterThan(7.9);
  expect(ridge.z).toBeGreaterThan(44);
  // The canopy: a bridge, then call the basket over the gap.
  const p2 = await walk(page, [1.2, 8, 52.2], Math.atan2(3.5, 3.7), 1.1);
  expect(p2.y).toBeGreaterThan(7.9);
  expect(await callLift(page, [-1, 8, 64], 'wd-basket', 4)).toBe('thistledown');
  expect(await callLift(page, [-1.6, 8.2, 67.7], 'wd-basket', 4.5)).toBe('thistledown');
  const p4 = await walk(page, [-2.6, 8.2, 72.5], 0, 0.6);
  expect(p4.y).toBeGreaterThan(7.9);
  expect(p4.z).toBeGreaterThan(73.4);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 8, 49.5, 0.15);
    tw.setCamera(0.15, 0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm15-woods-canopy', browserName);
  // The hollow log: a plain lamp shows two stones, a charged one all three.
  expect(await castAt(page, [-2.5, 8, 81], [-1.2, 9.6, 81.4], 0, 0.3)).toBe('glimmerwick');
  expect(await standOn(page, [-2.2, 8, 86.2])).toBeGreaterThan(7.8);
  expect(await standOn(page, [-3.2, 8, 88.4])).toBeLessThan(7.5);
  await page.evaluate(() => window.__tw.advance(10));
  expect(await castAt(page, [-2.5, 8, 81], [-1.2, 9.6, 81.4], 1.2, 0.3)).toBe('glimmerwick');
  expect(await standOn(page, [-3.2, 8, 88.4])).toBeGreaterThan(7.8);
  expect((await walk(page, [-3.2, 8, 88.6], 0, 1.2)).z).toBeGreaterThan(93);
  // The brook: freeze the falls, climb the ice, then the cliff.
  await page.evaluate(() => {
    for (const e of (window.__tw.game as unknown as { world: { entities: { constructor: { name: string }; pos?: { y: number }; home?: { y: number } }[] } }).world.entities) {
      if (e.constructor.name === 'EmberCrab' && e.pos) {
        e.pos.y = -100;
        if (e.home) e.home.y = -100;
      }
    }
  });
  expect((await hop(page, [0, 8, 101], 0, 0.2, 2)).y).toBeLessThan(9);
  expect(await castAt(page, [0, 8, 99.5], [0, 10, 104], 0, 0.6)).toBe('rimewhistle');
  const pillar = await hop(page, [0, 8, 101], 0, 0.2, 1.6);
  expect(pillar.y).toBeGreaterThan(10.4);
  const top = await hop(page, [0, pillar.y, pillar.z], 0, 0.1, 1.6);
  expect(top.y).toBeGreaterThan(12.9);
  // The Old Oak: unlock the root-gate; Thimble's inside.
  await page.evaluate(() => {
    for (const e of (window.__tw.game as unknown as { world: { entities: { constructor: { name: string }; pos?: { y: number }; home?: { y: number } }[] } }).world.entities) {
      if (e.constructor.name === 'Snapcasket' && e.pos) {
        e.pos.y = -100;
        if (e.home) e.home.y = -100;
      }
    }
  });
  expect((await walk(page, [0, 13, 114], 0, 1)).z).toBeLessThan(117);
  expect(await castAt(page, [0.5, 13, 113.5], [0.75, 14.3, 116.75], 0, 1)).toBe('latchkin');
  expect((await walk(page, [0, 13, 114], 0, 1)).z).toBeGreaterThan(117.5);
  expect(await flags(page)).toContain('quest:hedgehog:found');
  // The bough: a plain bounce falls short; a charged one makes it.
  expect(await castAt(page, [-6.4, 13, 121.5], [-6.4, 13.1, 124], 1.2, 0.3)).toBe('springwell');
  const bough = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-5.2, 13, 124, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, 0.2);
    tw.advance(0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(0.25);
    tw.input({ x: 0, y: 0.6 });
    for (let i = 0; i < 10; i++) tw.advance(0.2);
    tw.input(null);
    tw.advance(0.5);
    await tw.idle();
    return { y: tw.state().feet.y, secrets: tw.state().secrets };
  });
  expect(bough.y).toBeGreaterThan(21.8);
  expect(bough.secrets).toContain('woods-bough');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-4, 13, 108, 0.2);
    tw.setCamera(0.2, 0.35);
    tw.advance(0.3);
  });
  await shot(page, 'm15-woods-oak', browserName);
  // Home by the east door, and back to Mabel.
  const home = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(14, 13, 112, Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    await tw.idle();
    return tw.state().level;
  });
  expect(home).toBe('grounds');
  await talk(page, [45, -3, -25]);
  expect(await page.evaluate(() => (window.__tw.game as unknown as G).state.cards.has('mother-hazelrigg'))).toBe(true);
});

test('pupils wander the castle and chat; Wren and Otto have errands of their own', async ({ page, browserName }) => {
  await start(page, 'thistledown', 'hub');
  // Fitz paces the east cloister.
  const walk1 = await page.evaluate(() => {
    const tw = window.__tw;
    type W = { constructor: { name: string }; spec: { speaker: string }; pos: { x: number; z: number } };
    const ws = (tw.game as unknown as { world: { entities: W[] } }).world.entities.filter((e) => e.constructor.name === 'Wanderer');
    const fitz = ws.find((w) => w.spec.speaker === 'fitz')!;
    const a = { ...fitz.pos };
    tw.teleport(0, 0, 3, 0);
    for (let i = 0; i < 40; i++) tw.advance(0.25);
    return { n: ws.length, moved: Math.hypot(fitz.pos.x - a.x, fitz.pos.z - a.z) };
  });
  expect(walk1.n).toBe(3);
  expect(walk1.moved).toBeGreaterThan(2);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 34.6, Math.PI / 2);
    tw.setCamera(Math.PI / 2 + 0.3, 0.15);
    tw.advance(0.5);
  });
  await shot(page, 'm15-wanderers', browserName);
  // Wren's scarf, on the court's west balcony.
  await talk(page, [-13.4, 0, 42.6]);
  const items = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as { session: { physics: { raycast(o: unknown, d: unknown, l: number): { point: { y: number } } | null } }; state: G['state'] };
    const { Vector3 } = await import(/* @vite-ignore */ '/node_modules/.vite/deps/three.js');
    const ground = g.session.physics.raycast(new Vector3(-14, 10.5, 52), new Vector3(0, -1, 0), 3);
    tw.teleport(-14, ground ? ground.point.y + 0.05 : 9.5, 51.2, 0);
    tw.advance(0.6);
    return { ground: ground?.point.y ?? null, flags: [...g.state.flags].filter((f) => f.startsWith('quest:scarf')) };
  });
  expect(items.ground).toBeGreaterThan(8.8);
  expect(items.flags).toContain('quest:scarf:found');
  // Otto's watch, on the observatory top.
  await page.evaluate(async () => {
    const tw = window.__tw;
    tw.loadLevel('upper');
    await tw.idle();
    tw.advance(0.3);
  });
  await talk(page, [31.5, 0, 23]);
  const watch = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as { session: { physics: { raycast(o: unknown, d: unknown, l: number): { point: { y: number } } | null } }; state: G['state'] };
    const { Vector3 } = await import(/* @vite-ignore */ '/node_modules/.vite/deps/three.js');
    const ground = g.session.physics.raycast(new Vector3(21.3, 15.5, 76.9), new Vector3(0, -1, 0), 4);
    tw.teleport(21.3, ground ? ground.point.y + 0.05 : 14, 76.2, 0);
    tw.advance(0.6);
    return { ground: ground?.point.y ?? null, flags: [...g.state.flags].filter((f) => f.startsWith('quest:watch')) };
  });
  expect(watch.ground).toBeGreaterThan(13);
  expect(watch.flags).toContain('quest:watch:found');
});
