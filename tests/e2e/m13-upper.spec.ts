import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The First Floor: the Long Hall, the Great Library, the House Wing and the Leads.

type G = { state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string> } };
const ALL = ['thwackwort', 'latchkin', 'springwell', 'glimmerwick', 'cindersnap', 'rimewhistle', 'thistledown'];

async function upstairs(page: Page, house = 'nettleby'): Promise<void> {
  await boot(page, '?test&new');
  await page.evaluate(
    async ({ house, all }) => {
      const tw = window.__tw;
      await tw.idle();
      const g = tw.game as unknown as G;
      g.state.house = house;
      for (const f of ['sorted', 'greeted', 'upper-hint-leads']) g.state.flags.add(f);
      for (const s of all) {
        tw.learn(s);
        g.state.lessons.add(s);
      }
      tw.loadLevel('upper');
      await tw.idle();
      tw.advance(0.3);
    },
    { house, all: ALL },
  );
}

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
    tw.teleport(at[0], at[1] + 0.5, at[2], 0);
    tw.advance(0.5);
    return tw.state().feet.y;
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
      return { ...s.feet, area: s.area, level: s.level };
    },
    { from, yaw, seconds },
  );

test('a door off the Lantern Hall gallery leads up to the First Floor (once sorted), and back', async ({ page, browserName }) => {
  await boot(page, '?test&new');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const tryDoor = async () => {
      tw.teleport(10.6, 5, 25.5, Math.PI / 2);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    };
    const before = await tryDoor();
    (tw.game as unknown as G).state.flags.add('sorted');
    const after = await tryDoor();
    tw.teleport(0, 0, 1.6, Math.PI);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { before, after, back: tw.state().level, y: tw.state().feet.y };
  });
  expect(r.before).toBe('hub');
  expect(r.after).toBe('upper');
  expect(r.back).toBe('hub');
  expect(r.y).toBeGreaterThan(4.5);
  await upstairs(page);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 4, 0);
    tw.setCamera(0, 0.05);
    tw.advance(0.4);
  });
  await shot(page, 'm13-long-hall', browserName);
});

test('the Great Library: up the stair or the book lift; the stacks need a charged lamp; the Forbidden Section', async ({ page, browserName }) => {
  await upstairs(page);
  expect((await walk(page, [-7, 0, 21.5], Math.PI, 3)).y).toBeGreaterThan(4.8);
  expect(await castAt(page, [-20, 0, 32], [-18.95, 1.3, 36.55], 0, 3)).toBe('thistledown');
  // The stacks: a plain lamp lights two steps; the third only in a charged glow.
  expect(await castAt(page, [-34.5, 5, 21], [-34.6, 7.1, 24], 0, 0.4)).toBe('glimmerwick');
  expect(await standOn(page, [-31, 6.35, 24])).toBeGreaterThan(6.2);
  expect(await standOn(page, [-25.6, 8.6, 24])).toBeLessThan(8);
  await page.evaluate(() => window.__tw.advance(13));
  expect(await castAt(page, [-34.5, 5, 21], [-34.6, 7.1, 24], 1.2, 0.4)).toBe('glimmerwick');
  expect(await standOn(page, [-25.6, 8.6, 24])).toBeGreaterThan(8.5);
  const top = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-20, 9.3, 24, 0);
    tw.advance(0.8);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(top.cards).toContain('orla-vellum');
  expect(top.secrets).toContain('upper-stacks');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-8, 0, 30, -2.0);
    tw.setCamera(-2.1, 0.35);
    tw.advance(0.4);
  });
  await shot(page, 'm13-library', browserName);
  // The odd book slides the shelf; the Snapweed behind it burns; the chest opens.
  expect(await castAt(page, [-29.4, 0, 35], [-29.4, 1.95, 39.45])).toBe('thwackwort');
  await page.evaluate(() => window.__tw.advance(2));
  expect(await castAt(page, [-32, 0, 38.5], [-31.5, 1.2, 45], 0, 2)).toBe('cindersnap');
  expect(await castAt(page, [-32, 0, 44], [-35, 0.6, 46.8], 0, 2)).toBe('latchkin');
  const forbidden = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-34, 0, 46.8, 0);
    tw.advance(1.2);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(forbidden.cards).toContain('snapweed');
  expect(forbidden.secrets).toContain('upper-forbidden');
});

test('the House Wing: only your own common room opens', async ({ page, browserName }) => {
  await upstairs(page, 'yarrowdown');
  const tryRoom = (doorX: number, _doorZ: number, north: boolean) => walk(page, [doorX, 0, north ? 27 : 23], north ? 0 : Math.PI, 1.6);
  const own = await tryRoom(28.5, 20.5, false);
  expect(own.z).toBeLessThan(19.5);
  const other = await tryRoom(13, 20.5, false);
  expect(other.z).toBeGreaterThan(20.5);
  const north = await tryRoom(13, 29.5, true);
  expect(north.z).toBeLessThan(29.5);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(28.6, 0, 18, Math.PI);
    tw.setCamera(Math.PI, 0.1);
    tw.advance(0.4);
  });
  await shot(page, 'm13-common-room', browserName);
});

test('the Leads: up the roof stair, chimneys to the ridge, freeze or fling over the cistern, the lookout card', async ({ page, browserName }) => {
  await upstairs(page);
  const roof = await walk(page, [0, 0, 42], 0, 3.8);
  expect(roof.y).toBeGreaterThan(7);
  expect(roof.area).toBe('leads');
  expect(await standOn(page, [3, 11.4, 65])).toBeGreaterThan(11.3);
  // Over the cistern on frozen water...
  expect(await castAt(page, [6, 7.2, 76], [12.5, 6.8, 76], 1.2, 0.5)).toBe('rimewhistle');
  const iced = await walk(page, [7, 7.2, 76], Math.PI / 2, 2);
  expect(iced.x).toBeGreaterThan(17);
  // ...up the drum on the crate, then a bounce to the lookout.
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(23, 8.6, 71.4, 0);
    tw.advance(0.5);
  });
  expect(await page.evaluate(() => window.__tw.state().feet.y)).toBeGreaterThan(8.3);
  const lift = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.aimAt(23.45, 9.9, 70.95);
    tw.advance(0.05);
    const t = tw.state().target;
    tw.cast(0);
    tw.advance(3);
    await tw.idle();
    return { t, y: tw.state().feet.y };
  });
  expect(lift.t).toBe('thistledown');
  expect(lift.y).toBeGreaterThan(11.2);
  const card = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(21.3, 14.1, 76, 0);
    tw.advance(1);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(card.cards).toContain('chimney-imp');
  expect(card.secrets).toContain('upper-lookout');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2, 7.2, 58, 0.9);
    tw.setCamera(0.9, -0.2);
    tw.advance(0.4);
  });
  await shot(page, 'm13-leads', browserName);
});

test('castle levels list named NPC spots for later quests', async ({ page }) => {
  await boot(page, '?test&new');
  const spots = await page.evaluate(async () => {
    const path = '/src/data/levels/index.ts';
    const { LEVELS } = (await import(/* @vite-ignore */ path)) as { LEVELS: Record<string, { npcSpots?: object }> };
    return Object.fromEntries(['upper', 'hub', 'grounds'].map((id) => [id, Object.keys(LEVELS[id].npcSpots ?? {}).length]));
  });
  expect(spots.upper).toBeGreaterThan(6);
  expect(spots.hub).toBeGreaterThan(3);
  expect(spots.grounds).toBeGreaterThan(3);
});
