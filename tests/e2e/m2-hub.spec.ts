import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

// The castle hub: a fresh game each test (?test&new clears the save).

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

test('a new game starts in the Lantern Hall, unsorted, with no spells', async ({ page, browserName }) => {
  const s = await page.evaluate(() => {
    window.__tw.advance(0.5);
    return window.__tw.state();
  });
  expect(s.level).toBe('hub');
  expect(s.area).toBe('hall');
  expect(s.house).toBeNull();
  expect(s.known).toEqual([]);
  await shot(page, 'm2-hall', browserName);
});

test('the Sorting Lantern sorts you by your answers, and the scarf follows', async ({ page, browserName }) => {
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-4.8, 0, 9, -Math.PI / 2);
    tw.advance(0.3);
    const focus = tw.state().focus;
    tw.choose(3, 3, 3, 0); // Yarrowdown answers, then accept
    tw.interact();
    await tw.idle();
    return { focus, house: tw.state().house };
  });
  expect(r.focus).toBe('Be sorted');
  expect(r.house).toBe('yarrowdown');
  // Show a dialogue line on screen for the screenshot.
  await page.evaluate(() => {
    const tw = window.__tw as unknown as { game: { dialogue: { autoAdvance: boolean } } } & typeof window.__tw;
    tw.game.dialogue.autoAdvance = false;
    tw.teleport(2, 0, 4.5, 0.4);
    tw.advance(0.3);
    tw.interact();
    tw.advance(2);
  });
  await shot(page, 'm2-dialogue', browserName);
});

test('the three hub secrets: tapestry alcove, sliding bookshelf, behind the clock', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const walk = (secs: number) => {
      tw.input({ y: 1 });
      tw.advance(secs);
      tw.input(null);
      tw.advance(0.3);
    };
    // 1: walk through the swaying tapestry in the hall's west wall.
    tw.teleport(-9.5, 0, 23.5, -Math.PI / 2);
    tw.advance(0.2);
    walk(1.4);
    const afterTapestry = tw.state().secrets.length;

    // 2: the disguised book switch (beside the shelf it opens) needs Thwackwort.
    tw.teleport(19.5, 0, 7.4, 0);
    tw.advance(0.3);
    tw.aimAt(17.4, 1.95, 9.3);
    const unknownFirst = tw.state().targetUnknown;
    tw.learn('thwackwort');
    tw.aimAt(17.4, 1.95, 9.3);
    tw.cast(0);
    tw.advance(3.5);
    tw.teleport(20, 0, 8.6, 0);
    tw.advance(0.2);
    walk(1);

    // 3: from the cloister roof, crate -> grab the north wall -> walk behind the tower.
    tw.teleport(-4.5, 5, 60.3, -Math.PI / 2);
    tw.advance(0.3);
    const hop = (secs: number) => {
      tw.input({ y: 1 });
      tw.pressJump();
      tw.input({ y: 1, jump: true });
      tw.advance(secs);
      tw.input(null);
      tw.advance(0.25);
    };
    hop(0.4);
    const f = tw.state().feet;
    tw.teleport(f.x, f.y, f.z, 0);
    tw.advance(0.2);
    hop(1.2);
    const onWall = tw.state().feet.y;
    tw.setCamera(Math.PI / 2, -0.3);
    tw.input({ y: 1 });
    for (let i = 0; i < 150 && tw.state().feet.x < 0; i++) tw.advance(1 / 60);
    tw.input(null);
    tw.advance(0.3);
    const s = tw.state();
    return { afterTapestry, unknownFirst, onWall, secrets: s.secrets, cards: s.cards };
  });
  expect(r.afterTapestry).toBe(1);
  expect(r.unknownFirst).toBe(true);
  expect(r.onWall).toBeGreaterThan(7.9);
  expect(r.secrets.sort()).toEqual(['hub-bookshelf', 'hub-clock', 'hub-tapestry']);
  expect(r.cards).toEqual(expect.arrayContaining(['mother-wortle', 'barnaby-gorse', 'grey-lady']));
});

test('platforming cards: the west chandelier and the gallery window', async ({ page }) => {
  const cards = await page.evaluate(() => {
    const tw = window.__tw;
    const hop = (secs: number) => {
      tw.input({ y: 1 });
      tw.pressJump();
      tw.input({ y: 1, jump: true });
      tw.advance(secs);
      tw.input(null);
      tw.advance(0.25);
    };
    // From the gallery, jump the railing onto the chandelier and walk to its middle.
    tw.teleport(-7, 5, 22.2, Math.PI);
    tw.advance(0.3);
    tw.input({ y: 1 });
    tw.advance(0.12);
    hop(0.8);
    tw.input({ y: 1 });
    tw.advance(0.25);
    tw.input(null);
    tw.advance(0.3);
    // Crate -> grab the window bay -> card.
    tw.teleport(-8, 5, 26.6, -Math.PI / 2);
    tw.advance(0.3);
    hop(0.35);
    hop(0.6);
    hop(1);
    return tw.state().cards;
  });
  expect(cards).toEqual(expect.arrayContaining(['lantern-moth', 'pellam-fogg']));
});

test('progress survives a reload: house, cards, secrets, sweets, checkpoint', async ({ page }) => {
  const before = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-4.8, 0, 9, -Math.PI / 2);
    tw.advance(0.3);
    tw.choose(0, 0, 0, 0);
    tw.interact();
    await tw.idle();
    tw.teleport(-9.5, 0, 23.5, -Math.PI / 2);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(1.4);
    tw.input(null);
    tw.advance(0.5);
    // Corridor checkpoint.
    tw.teleport(40.5, 3, 20.3, 0);
    tw.advance(0.5);
    tw.save();
    return tw.state();
  });
  expect(before.house).toBe('bramblecote');
  expect(before.sweets).toBeGreaterThan(0);

  await boot(page, '?test');
  const after = await page.evaluate(async () => {
    await window.__tw.idle();
    window.__tw.advance(0.3);
    return window.__tw.state();
  });
  expect(after.house).toBe(before.house);
  expect(after.cards).toEqual(before.cards);
  expect(after.secrets).toEqual(before.secrets);
  expect(after.sweets).toBe(before.sweets);
  expect(after.housePoints).toEqual(before.housePoints);
  // Continue puts you at the last checkpoint (corridor landing).
  expect(after.feet.x).toBeGreaterThan(38);
  expect(after.feet.y).toBeGreaterThan(2.9);
  // Collected cards don't respawn.
  const cardsInWorld = await page.evaluate(() => {
    const g = window.__tw.game as unknown as { world: { entities: { constructor: { name: string } }[] } };
    return g.world.entities.filter((e) => e.constructor.name === 'CardPickup').length;
  });
  // Eight placed in the hub (tapestry alcove, chandelier, window bay, clock, corridor shelf, court
  // balcony, the hall's glimmer ledge, under the Undercroft stair, the orchard shed); the tapestry
  // one was collected.
  expect(cardsInWorld).toBe(9 - 1);
});

test('doors and shopkeepers talk; the album lists found cards', async ({ page, browserName }) => {
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-14.2, 0, 8, -Math.PI / 2);
    tw.advance(0.3);
    const shopFocus = tw.state().focus;
    tw.interact();
    await tw.idle();
    tw.teleport(40.6, 3, 20.5, -Math.PI / 2);
    tw.advance(0.3);
    const doorFocus = tw.state().focus;
    // Collect a card, then open the album.
    tw.teleport(-9.5, 0, 23.5, -Math.PI / 2);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(1.4);
    tw.input(null);
    const g = tw.game as unknown as { album: { open(): void } };
    g.album.open();
    tw.advance(0.2);
    return { shopFocus, doorFocus };
  });
  expect(r.shopFocus).toMatch(/Talk to/);
  expect(r.doorFocus).toBe('Read');
  await expect(page.locator('#album-count')).toHaveText('1 of 34 found');
  await expect(page.locator('.album-card:not(.missing)')).toHaveCount(1);
  await shot(page, 'm2-album', browserName);
});

test('court and corridor look right', async ({ page, browserName }) => {
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 36, 0);
    tw.advance(0.4);
    tw.setCamera(0.3, -0.05);
    tw.advance(0.6);
  });
  await shot(page, 'm2-court', browserName);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(14, 0, 8, Math.PI / 2);
    tw.advance(0.4);
    tw.setCamera(Math.PI / 2, -0.1);
    tw.advance(0.6);
  });
  await shot(page, 'm2-corridor', browserName);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-13.6, 0, 8, -Math.PI / 2);
    tw.advance(0.4);
    tw.setCamera(-Math.PI / 2, -0.1);
    tw.advance(0.6);
  });
  await shot(page, 'm2-cupboard', browserName);
});
