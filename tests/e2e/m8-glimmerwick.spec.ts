import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The fourth lesson: the Undercroft door, Lamplough's study, the Lamplit Catacombs, and
// what light reveals back in the castle.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type G = { state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string> } };

async function prepared(page: Page, level: string, opts: { glimmer?: boolean; flags?: string[]; spawn?: string; springwellDone?: boolean } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'yarrowdown';
      const flags = ['sorted', 'greeted', 'lesson-started', 'practice-done', 'gorse-reward', 'quince-lesson-started', 'practice-latchkin', 'quince-reward', 'hopgood-lesson-started', 'practice-springwell', 'hopgood-reward'];
      for (const f of [...flags, 'lamplough-lesson-started', 'catacombs-entered', ...(opts.flags ?? [])]) g.state.flags.add(f);
      for (const s of ['thwackwort', 'latchkin', 'springwell'] as const) {
        tw.learn(s);
        if (s !== 'springwell' || opts.springwellDone !== false) g.state.lessons.add(s);
      }
      if (opts.glimmer) tw.learn('glimmerwick');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts },
  );
}

/** Light a lamp from where you stand (optionally charged); returns the targeted spell. */
const light = (page: Page, from: [number, number, number], lamp: [number, number, number], hold = 0) =>
  page.evaluate(
    async ({ from, lamp, hold }) => {
      const tw = window.__tw;
      tw.teleport(...from, 0);
      tw.advance(0.3);
      await tw.idle();
      tw.aimAt(...lamp);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(hold);
      tw.advance(0.5);
      return t;
    },
    { from, lamp, hold },
  );

/** Drop the player just above a spot: does something solid hold them there? */
const standOn = (page: Page, at: [number, number, number]) =>
  page.evaluate((at) => {
    const tw = window.__tw;
    tw.teleport(at[0], at[1] + 0.6, at[2], 0);
    tw.advance(0.6);
    return tw.state().feet.y;
  }, at);

test('the Undercroft door opens once Springwell is passed', async ({ page }) => {
  await prepared(page, 'hub', { springwellDone: false });
  const tryDoor = () =>
    page.evaluate(async () => {
      const tw = window.__tw;
      tw.teleport(10.6, 0, 2.5, Math.PI / 2);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    });
  expect(await tryDoor()).toBe('hub');
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('springwell'));
  expect(await tryDoor()).toBe('lamplough');
});

test('Lamplough teaches Glimmerwick; light reveals steps, bridges and (charged) the far step', async ({ page, browserName }) => {
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.house = 'yarrowdown';
    for (const f of ['sorted', 'greeted']) g.state.flags.add(f);
    for (const s of ['thwackwort', 'latchkin', 'springwell'] as const) {
      tw.learn(s);
      g.state.lessons.add(s);
    }
    tw.loadLevel('lamplough');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('glimmerwick');
  // Unlit: the step isn't there.
  expect(await standOn(page, [-3.2, 1.1, 8])).toBeLessThan(0.5);
  expect(await light(page, [0, 0, 4], [-2.5, 2.1, 5.2])).toBe('glimmerwick');
  expect(await standOn(page, [-3.2, 1.1, 8])).toBeGreaterThan(1);
  expect(await standOn(page, [-5.2, 2.2, 8])).toBeGreaterThan(2.1);
  expect(await standOn(page, [-7.75, 3.3, 8])).toBeGreaterThan(3.2);
  // The bridge.
  expect(await light(page, [0, 0, 6], [1, 2.1, 3.5])).toBe('glimmerwick');
  expect(await standOn(page, [4.3, 0, 7])).toBeGreaterThan(-0.1);
  expect(await standOn(page, [7.75, 0, 6])).toBeGreaterThan(-0.1);
  // The far step: plain light doesn't reach it, a charged one does.
  await light(page, [-1, 0, 18], [-4, 2.1, 18.8]);
  expect(await standOn(page, [1.5, 1.2, 18.5])).toBeLessThan(0.5);
  await page.evaluate(() => window.__tw.advance(11));
  await light(page, [-1, 0, 18], [-4, 2.1, 18.8], 1);
  expect(await standOn(page, [1.5, 1.2, 18.5])).toBeGreaterThan(1.1);
  expect(await standOn(page, [6.2, 2.4, 18.5])).toBeGreaterThan(2.3);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(0.5);
    await tw.idle();
    const g = tw.game as unknown as G;
    const practice = g.state.flags.has('practice-glimmerwick');
    tw.teleport(7.4, 0, 15, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.level).toBe('catacombs');
  await shot(page, 'm8-catacombs', browserName);
});

test('the Glimmer Bridge: lamp by lamp across the dark, the last stone only in a charged glow', async ({ page, browserName }) => {
  await prepared(page, 'catacombs', { glimmer: true, flags: ['catacomb-hint-bridge'] });
  // In the dark, the first stone isn't there: you fall (and come back to the checkpoint).
  expect(await standOn(page, [0.6, 0, 12.2])).toBeLessThan(-1);
  await page.evaluate(() => window.__tw.advance(4));
  expect(await light(page, [0, 0, 10.4], [2.6, 2.1, 10.2])).toBe('glimmerwick');
  for (const [x, z] of [
    [0.6, 12.2],
    [-0.6, 14],
    [0.3, 15.8],
  ]) {
    expect(await standOn(page, [x, 0, z])).toBeGreaterThan(-0.1);
  }
  expect(await standOn(page, [0, 0, 18])).toBeGreaterThan(-0.1);
  await light(page, [0, 0, 17.6], [0.8, 2.1, 18.4]);
  expect(await standOn(page, [-0.4, 0, 23.4])).toBeGreaterThan(-0.1);
  expect(await standOn(page, [0.7, 0, 25.2])).toBeLessThan(-1);
  await page.evaluate(() => window.__tw.advance(8));
  await light(page, [0, 0, 17.6], [0.8, 2.1, 18.4], 1);
  for (const [x, z] of [
    [-0.5, 19.8],
    [0.7, 21.6],
    [-0.4, 23.4],
    [0.7, 25.2],
    [-0.2, 27],
  ]) {
    expect(await standOn(page, [x, 0, z])).toBeGreaterThan(-0.1);
  }
  await page.evaluate(() => {
    window.__tw.teleport(0, 0, 18, 0);
    window.__tw.setCamera(0, -0.25);
    window.__tw.advance(0.3);
  });
  await shot(page, 'm8-bridge', browserName);
  // Without the charged stones the gap to the far side is too wide to jump.
  const jump = await page.evaluate(() => {
    const tw = window.__tw;
    tw.advance(9);
    tw.teleport(-0.4, 0, 22.8, 0);
    tw.setCamera(0, -0.2);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(0.15);
    tw.pressJump();
    tw.input({ y: 1, jump: true });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.5);
    return tw.state().feet;
  });
  expect(jump.z).toBeLessThan(29.2);
});

test('the Hall of False Walls: only light shows which walls lie', async ({ page }) => {
  await prepared(page, 'catacombs', { glimmer: true, flags: ['catacomb-hint-walls'] });
  // The Gnarlings wander at random; out of the way, so walking into walls is all that's tested.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as { session: { world: { entities: { constructor: { name: string }; state?: string; root?: { visible: boolean } }[] } } };
    for (const e of g.session.world.entities) if (e.constructor.name === 'Gnarling') ((e.state = 'gone'), (e.root!.visible = false));
  });
  const walk = (from: [number, number, number], secs: number) =>
    page.evaluate(
      ({ from, secs }) => {
        const tw = window.__tw;
        tw.teleport(...from, 0);
        tw.setCamera(0, -0.2);
        tw.advance(0.2);
        tw.input({ y: 1 });
        tw.advance(secs);
        tw.input(null);
        return tw.state().feet.z;
      },
      { from, secs },
    );
  // Dark: the false section of the near wall is as solid as the rest.
  expect(await walk([-5, 0, 33], 1.2)).toBeLessThan(35.8);
  // A plain light shows the middle and far walls but not the near one.
  expect(await light(page, [0, 0, 33], [0, 6.8, 41])).toBe('glimmerwick');
  expect(await walk([-5, 0, 33], 1.2)).toBeLessThan(35.8);
  expect(await walk([3, 0, 38.5], 1)).toBeGreaterThan(41.5);
  await page.evaluate(() => window.__tw.advance(11));
  await light(page, [0, 0, 33], [0, 6.8, 41], 1);
  expect(await walk([-5, 0, 33], 1.2)).toBeGreaterThan(36.5);
  expect(await walk([-1, 0, 43.5], 1)).toBeGreaterThan(46.5);
  // ...and the west wall's false bit, with the card behind it.
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6.5, 0, 39, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.6);
    tw.input(null);
    tw.advance(0.4);
    return { x: tw.state().feet.x, cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(r.x).toBeLessThan(-9);
  expect(r.cards).toContain('gloomwisp');
  expect(r.secrets).toContain('catacomb-alcove');
});

test("Lamplough's Lantern: all four lamps at once open the gate; the Star ends the lesson", async ({ page, browserName }) => {
  await prepared(page, 'catacombs', { glimmer: true, flags: ['catacomb-hint-lantern'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    // Snapcaskets aside (they're tested elsewhere): this is about the timing.
    const g0 = tw.game as unknown as { session: { world: { entities: { constructor: { name: string }; state?: string; root?: { visible: boolean } }[] } } };
    for (const e of g0.session.world.entities) if (e.constructor.name === 'Snapcasket') ((e.state = 'gone'), (e.root!.visible = false));
    const lampAt = (from: [number, number, number], lamp: [number, number, number]) => {
      tw.teleport(...from, 0);
      tw.advance(0.15);
      tw.aimAt(...lamp);
      tw.advance(0.05);
      tw.cast(0);
      tw.advance(0.4);
    };
    lampAt([-4, 0, 60.5], [-8.53, 2.4, 56]);
    lampAt([-4, 0, 60.5], [-8.53, 2.4, 65]);
    const halfway = tw.signal('cL1') && tw.signal('cL2');
    // Round the divider to the east half.
    lampAt([4, 0, 60.5], [8.53, 2.4, 56]);
    lampAt([4, 0, 60.5], [8.53, 2.4, 65]);
    tw.advance(2.5);
    tw.teleport(0, 0, 69, 0);
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(2.2);
    tw.input(null);
    await tw.idle();
    tw.advance(0.5);
    const g = tw.game as unknown as G;
    return { halfway, z: tw.state().feet.z, lessons: [...g.state.lessons] };
  });
  expect(r.halfway).toBe(true);
  expect(r.z).toBeGreaterThan(73);
  expect(r.lessons).toContain('glimmerwick');
  await shot(page, 'm8-star', browserName);
});

test('light in the castle: glimmer steps to a hall ledge (charged), and a false wall in the gallery', async ({ page, browserName }) => {
  await prepared(page, 'hub', { glimmer: true, flags: ['on:hub-portcullis'] });
  await light(page, [8.5, 5, 26], [10.8, 7.1, 27.5]);
  expect(await standOn(page, [10.6, 7.6, 22.4])).toBeGreaterThan(7.5);
  expect(await standOn(page, [10.6, 8.9, 20.2])).toBeLessThan(8);
  await page.evaluate(() => window.__tw.advance(9));
  await light(page, [8.5, 5, 26], [10.8, 7.1, 27.5], 1);
  expect(await standOn(page, [10.6, 8.9, 20.2])).toBeGreaterThan(8.8);
  const ledge = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(11.4, 10.3, 18.6, Math.PI);
    tw.advance(0.6);
    return { y: tw.state().feet.y, cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(ledge.y).toBeGreaterThan(10.1);
  expect(ledge.cards).toContain('ambrose-wick');
  expect(ledge.secrets).toContain('hub-wick-ledge');
  await shot(page, 'm8-hall-ledge', browserName);
  await light(page, [37, 3, 46.5], [37, 5.1, 48.6]);
  const niche = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(36.5, 3, 50.5, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.3);
    return { x: tw.state().feet.x, secrets: tw.state().secrets };
  });
  expect(niche.x).toBeLessThan(34.2);
  expect(niche.secrets).toContain('hub-gallery-niche');
});

test('Lamplough gives his card after the Catacombs, and the Catacomb door stays shut', async ({ page }) => {
  await prepared(page, 'lamplough', { glimmer: true, flags: ['practice-glimmerwick'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.lessons.add('glimmerwick');
    tw.teleport(-1.5, 0, 12.4, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.teleport(7.4, 0, 15, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { cards: [...g.state.cards], level: tw.state().level };
  });
  expect(r.cards).toContain('fennick-lamplough');
  expect(r.level).toBe('lamplough');
});
