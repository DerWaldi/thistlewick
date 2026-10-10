import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

type Shopish = {
  state: { sweets: number; maxStamina: number; stamina: number; lessons: Set<string>; house: string | null; flags: Set<string>; chargeTimeScale: number; magnetScale: number; upgrades: Set<string> };
  shop: { isOpen: boolean; buy(id: string): boolean; close(): void };
  paused: boolean;
  player: { pos: { x: number; z: number } };
};

test('the Cupboard opens after the lesson and sells cards and upgrades', async ({ page, browserName }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
  const before = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as Shopish;
    g.state.house = 'nettleby';
    g.state.flags.add('sorted');
    tw.teleport(-14.2, 0, 8, -Math.PI / 2);
    tw.advance(0.3);
    // Before the lesson: shut.
    tw.interact();
    await tw.idle();
    const openedEarly = g.shop.isOpen;
    tw.learn('thwackwort');
    g.state.lessons.add('thwackwort');
    g.state.sweets = 120;
    tw.interact();
    // The script waits for the shop to close.
    await new Promise((r) => setTimeout(r, 50));
    return { openedEarly, open: g.shop.isOpen };
  });
  expect(before.openedEarly).toBe(false);
  expect(before.open).toBe(true);
  // Seven on the shelves, plus the Trial's Gnarling card in the Lost & Found (it wasn't picked up).
  await expect(page.locator('.shop-item')).toHaveCount(8);
  await shot(page, 'm4-shop', browserName);

  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as Shopish;
    const bought = ['card-puddlewump', 'up-stout', 'up-quick', 'up-tooth'].map((id) => g.shop.buy(id));
    const tooPoor = g.shop.buy('card-hester'); // 120 - 25 - 50 - 35 = 10 left
    const soon = g.shop.buy('up-map');
    g.shop.close();
    await tw.idle();
    tw.advance(0.1);
    return {
      bought,
      tooPoor,
      soon,
      sweets: g.state.sweets,
      max: g.state.maxStamina,
      stamina: g.state.stamina,
      charge: g.state.chargeTimeScale,
      magnet: g.state.magnetScale,
      cards: tw.state().cards,
    };
  });
  expect(r.bought).toEqual([true, true, true, false]);
  expect(r.tooPoor).toBe(false);
  expect(r.soon).toBe(false);
  expect(r.sweets).toBe(10);
  expect(r.max).toBe(6);
  expect(r.stamina).toBe(6);
  expect(r.charge).toBeLessThan(1);
  expect(r.cards).toContain('puddlewump');
  await expect(page.locator('#hud-stamina .pip')).toHaveCount(6);
});

test('pausing stops the world', async ({ page }) => {
  await boot(page, '?test&level=gym');
  const moved = await page.evaluate(() => {
    const tw = window.__tw;
    const g = tw.game as unknown as Shopish;
    tw.teleport(-43, 0, -5, Math.PI / 2);
    tw.advance(0.2);
    g.paused = true;
    tw.input({ y: 1 });
    tw.advance(1);
    tw.input(null);
    const x0 = g.player.pos.x;
    g.paused = false;
    tw.input({ y: 1 });
    tw.advance(0.5);
    tw.input(null);
    return { whilePaused: x0, after: g.player.pos.x };
  });
  expect(moved.whilePaused).toBeCloseTo(-43, 1);
  expect(moved.after).toBeGreaterThan(-42);
});

test('the title screen offers Continue only when there is a save', async ({ page, browserName }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-action="continue"]')).toBeHidden();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `tests/e2e/__shots__/${browserName}-m4-title.png` });
  await page.evaluate(() => localStorage.setItem('thistlewick.save.v1', JSON.stringify({ version: 1, savedAt: 0, maxStamina: 5, sweets: 3, sweetCounts: { fizzwort: 3, bramble: 0, humbug: 0 }, known: [], checkpoint: null, house: null, housePoints: { bramblecote: 0, mallowmere: 0, nettleby: 0, yarrowdown: 0 }, cards: [], secrets: [], collected: [], flags: [], lessons: [], upgrades: [], level: 'hub', playTime: 0 })));
  await page.goto('/');
  await expect(page.locator('[data-action="continue"]')).toBeVisible({ timeout: 30_000 });
  // Options persist.
  await page.locator('[data-action="options"]').first().click();
  await page.locator('#opt-quality').selectOption('low');
  await page.locator('[data-screen="options"] [data-action="back"]').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('thistlewick.options') ?? '{}').quality);
  expect(stored).toBe('low');
});
