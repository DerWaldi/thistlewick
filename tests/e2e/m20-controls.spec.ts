import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

// Rebindable keys and a gamepad.

type Game = { options: { keys: Record<string, string> }; applyOptions(): void; input: { captureKey: unknown; virtual: unknown } };

test('a key rebound in Options moves you; the old one no longer does', async ({ page, browserName }) => {
  await boot(page, '?test&level=gym');
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as Game;
    const { Menu } = (await import(/* @vite-ignore */ '/src/ui/menu.ts' as string)) as { Menu: new (o: unknown) => { show(s: string): void; onOptions: () => void; captureKey: (fn: unknown) => void } };
    const menu = new Menu(g.options);
    menu.onOptions = () => g.applyOptions();
    menu.captureKey = (fn) => (g.input.captureKey = fn);
    menu.show('options');
    (window as unknown as { __menu: unknown }).__menu = menu;
  });
  await page.locator('#opt-keys .key-btn').first().click();
  await expect(page.locator('#opt-keys .key-btn').first()).toHaveText('Press a key…');
  await page.keyboard.press('KeyI');
  await expect(page.locator('#opt-keys .key-btn').first()).toHaveText('I');
  await page.screenshot({ path: `tests/e2e/__shots__/${browserName}-m20-keys.png` });
  const moved = async (key: string) => {
    await page.evaluate(() => {
      const tw = window.__tw;
      tw.teleport(0, 0, 0, 0);
      tw.setCamera(0, 0.2);
      tw.advance(0.2);
    });
    await page.keyboard.down(key);
    const z = await page.evaluate(() => {
      window.__tw.advance(0.6);
      return window.__tw.state().feet.z;
    });
    await page.keyboard.up(key);
    return z;
  };
  expect(await moved('KeyI')).toBeGreaterThan(1.5);
  expect(Math.abs(await moved('KeyW'))).toBeLessThan(0.2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('thistlewick.options') ?? '{}').keys.forward)).toBe('KeyI');
  void shot;
});

test('a gamepad: the left stick walks, A jumps, the right stick turns the camera', async ({ page }) => {
  await boot(page, '?test&level=gym');
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const pad = { connected: true, axes: [0, -1, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    tw.teleport(0, 0, 0, 0);
    tw.setCamera(0, 0.2);
    tw.advance(0.6);
    const walked = tw.state().feet.z;
    pad.axes = [0, 0, 0, 0];
    tw.advance(0.5);
    pad.buttons[0].pressed = true;
    tw.advance(0.15);
    const vy = tw.state().vel.y;
    pad.buttons[0].pressed = false;
    tw.advance(1);
    const yaw0 = tw.state().camera.yaw;
    pad.axes = [0, 0, 1, 0];
    tw.advance(0.5);
    return { walked, vy, turned: Math.abs(tw.state().camera.yaw - yaw0) };
  });
  expect(r.walked).toBeGreaterThan(1.5);
  expect(r.vy).toBeGreaterThan(1);
  expect(r.turned).toBeGreaterThan(0.3);
});
