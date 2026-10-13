import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

// Phones and tablets: on-screen controls (src/ui/touch.ts). A floating stick on the left, drag
// to look, buttons to jump, cast (hold to charge), interact, open the album and pause.

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

/** A finger: pointer events as a touch screen sends them. */
const finger = (page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, id = 7, target?: string) =>
  page.evaluate(
    ({ type, x, y, id, target }) => {
      const el = (target ? document.querySelector(target) : document.elementFromPoint(x, y)) as HTMLElement;
      el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, isPrimary: id === 7 }));
    },
    { type, x, y, id, target },
  );

test('touch controls appear on a touch screen', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&level=gym&touch');
  expect(await page.locator('#touch').isVisible()).toBe(true);
  expect(await page.locator('.t-jump').isVisible()).toBe(true);
  expect(await page.locator('.t-cast').isVisible()).toBe(true);
});

test.describe('with a mouse', () => {
  test.use({ hasTouch: false });
  test('no touch controls on a desktop', async ({ page }) => {
    await boot(page, '?test&level=gym');
    expect(await page.locator('#touch').count()).toBe(0);
  });
});

test('the stick walks, a drag looks round, the jump button jumps', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&level=gym&touch');
  const start = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 0, 0);
    tw.advance(0.3);
    return tw.state();
  });
  // Thumb down on the left, pushed up: forward.
  await finger(page, 'pointerdown', 150, 260);
  await finger(page, 'pointermove', 150, 190);
  const walked = await page.evaluate(() => {
    window.__tw.advance(1);
    return window.__tw.state().feet;
  });
  await finger(page, 'pointerup', 150, 190);
  expect(walked.z - start.feet.z).toBeGreaterThan(2);
  const stopped = await page.evaluate(() => {
    const a = window.__tw.state().feet;
    window.__tw.advance(0.6);
    const b = window.__tw.state().feet;
    return Math.hypot(b.x - a.x, b.z - a.z);
  });
  expect(stopped).toBeLessThan(0.6);
  // A second finger drags across the right side: the camera turns.
  const yaw0 = await page.evaluate(() => window.__tw.state().camera.yaw);
  await finger(page, 'pointerdown', 600, 200, 8);
  await finger(page, 'pointermove', 500, 200, 8);
  await finger(page, 'pointerup', 500, 200, 8);
  const yaw1 = await page.evaluate(() => {
    window.__tw.advance(0.1);
    return window.__tw.state().camera.yaw;
  });
  expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(0.4);
  // The jump button.
  await finger(page, 'pointerdown', 0, 0, 9, '.t-jump');
  const up = await page.evaluate(() => {
    window.__tw.advance(0.25);
    return window.__tw.state().feet.y;
  });
  await finger(page, 'pointerup', 0, 0, 9, '.t-jump');
  expect(up).toBeGreaterThan(0.5);
});

test('the cast button casts on a tap and charges while held', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&level=gym&touch');
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-36, 0, 25, 0);
    tw.advance(0.3);
    tw.aimAt(-36, 1.2, 29);
    tw.advance(0.05);
    return tw.state().target;
  });
  expect(r).toBe('thwackwort');
  await finger(page, 'pointerdown', 0, 0, 10, '.t-cast');
  const charging = await page.evaluate(() => {
    window.__tw.advance(0.5);
    return window.__tw.state().charging;
  });
  await finger(page, 'pointerup', 0, 0, 10, '.t-cast');
  expect(charging).toBe(true);
  const after = await page.evaluate(() => {
    window.__tw.advance(0.1);
    return window.__tw.state().charging;
  });
  expect(after).toBe(false);
});

test('the interact button shows by someone to talk to, and taps move the dialogue on', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&new&touch');
  await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as { dialogue: { autoAdvance: boolean } };
    g.dialogue.autoAdvance = false;
    tw.teleport(1.5, 0, 6.4, 1.17);
    tw.advance(0.4);
  });
  await expect(page.locator('.t-act')).toBeVisible();
  await expect(page.locator('.t-act small')).toHaveText('Talk');
  await finger(page, 'pointerdown', 0, 0, 11, '.t-act');
  await finger(page, 'pointerup', 0, 0, 11, '.t-act');
  const open = await page.evaluate(() => {
    window.__tw.advance(0.2);
    return window.__tw.state().dialogueOpen;
  });
  expect(open).toBe(true);
  // The controls step aside while someone talks; a tap anywhere moves the dialogue on.
  await expect(page.locator('#touch')).toBeHidden();
  const text0 = await page.locator('#dlg-text').textContent();
  for (let i = 0; i < 2; i++) {
    await finger(page, 'pointerdown', 420, 120, 12);
    await page.evaluate(() => window.__tw.advance(0.1));
  }
  expect(await page.locator('#dlg-text').textContent()).not.toBe(text0);
});

test('the pause button opens the pause menu', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&level=gym&touch');
  await finger(page, 'pointerdown', 0, 0, 13, '.t-pause');
  await expect(page.locator('#menu [data-screen="pause"]')).toBeVisible();
});

test('held upright, the game asks for the phone on its side', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, '?test&level=gym&touch');
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotate')).toBeHidden();
});

test('Fancy graphics on a phone keep the look but not the cost', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no touch emulation');
  await boot(page, '?test&level=hub&touch');
  const r = await page.evaluate(() => {
    type R = { renderer: { getPixelRatio(): number; info: { render: { calls: number } } }; setQuality(q: string): void; draw(): void; sun: { shadow: { mapSize: { x: number } } } };
    const g = window.__tw.game as unknown as { renderer: R };
    window.__tw.advance(0.5);
    g.renderer.setQuality('high');
    g.renderer.draw();
    return { ratio: g.renderer.renderer.getPixelRatio(), shadow: g.renderer.sun.shadow.mapSize.x };
  });
  expect(r.ratio).toBe(1);
  expect(r.shadow).toBe(2048);
  await page.addStyleTag({ content: '#hud, #stats, #touch { display: none !important; }' });
  await page.screenshot({ path: 'tests/e2e/__shots__/m23-fancy-phone.png' });
});
