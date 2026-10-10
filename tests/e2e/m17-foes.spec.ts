import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The Hexling (a bad fairy with homing hex orbs) and the Sootling (an imp that lobs fuse bombs).

type Foe = { constructor: { name: string }; pos: { x: number; y: number; z: number }; state: string; bombs?: { pos: { x: number; y: number; z: number }; grounded: boolean }[] };
type G = { world: { entities: Foe[]; spawn(spec: object, index: number): Foe | null } };

async function gym(page: Page): Promise<{ x: number; y: number; z: number }> {
  await boot(page, '?test&level=gym');
  return page.evaluate(() => {
    const tw = window.__tw;
    tw.learn('thwackwort');
    tw.advance(0.3);
    return tw.state().feet;
  });
}

const foe = (page: Page, name: string) =>
  page.evaluate((name) => {
    const f = (window.__tw.game as unknown as G).world.entities.find((e) => e.constructor.name === name)!;
    return { state: f.state, pos: { ...f.pos }, bombs: f.bombs?.map((b) => ({ pos: { ...b.pos }, grounded: b.grounded })) };
  }, name);

const castAtFoe = (page: Page, name: string, hold = 0) =>
  page.evaluate(
    ({ name, hold }) => {
      const tw = window.__tw;
      const f = (tw.game as unknown as G).world.entities.find((e) => e.constructor.name === name)!;
      tw.aimAt(f.pos.x, f.pos.y + 0.5, f.pos.z);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(hold);
      tw.advance(0.5);
      return t;
    },
    { name, hold },
  );

test('the Hexling circles overhead throwing hex orbs; one thwack knocks her down, a second banishes her', async ({ page, browserName }) => {
  const p = await gym(page);
  const hurt = await page.evaluate((p) => {
    const tw = window.__tw;
    (tw.game as unknown as G).world.spawn({ type: 'hexling', pos: [p.x, p.y, p.z + 7], height: 3, radius: 2.5, interval: 1.6 }, 9000);
    const before = tw.state().stamina;
    tw.setCamera(0, 0.4);
    for (let i = 0; i < 20; i++) tw.advance(0.25);
    return before - tw.state().stamina;
  }, p);
  expect(hurt).toBeGreaterThan(0);
  await shot(page, 'm17-hexling', browserName);
  // Back off so she can be aimed at, and knock her down.
  await page.evaluate((p) => {
    window.__tw.teleport(p.x, p.y, p.z - 3, 0);
    window.__tw.advance(0.3);
  }, p);
  expect(await castAtFoe(page, 'Hexling')).toBe('thwackwort');
  const down = await foe(page, 'Hexling');
  expect(down.state).toBe('down');
  await page.evaluate(() => window.__tw.advance(1));
  expect((await foe(page, 'Hexling')).pos.y).toBeLessThan(p.y + 1);
  expect(await castAtFoe(page, 'Hexling')).toBe('thwackwort');
  expect((await foe(page, 'Hexling')).state).toBe('gone');
});

test('the Sootling lobs fuse bombs that explode after a moment; a bomb kicked back banishes him', async ({ page, browserName }) => {
  const p = await gym(page);
  // Standing still where the bombs land hurts.
  const hurt = await page.evaluate((p) => {
    const tw = window.__tw;
    (tw.game as unknown as G).world.spawn({ type: 'sootling', pos: [p.x, p.y, p.z + 9], yaw: Math.PI, wander: 0, interval: 2 }, 9001);
    const before = tw.state().stamina;
    for (let i = 0; i < 36; i++) tw.advance(0.25);
    return before - tw.state().stamina;
  }, p);
  expect(hurt).toBeGreaterThan(0);
  // Wait for a fresh bomb to land, then kick it straight back at him.
  const kicked = await page.evaluate(async (p) => {
    const tw = window.__tw;
    tw.teleport(p.x, p.y, p.z, 0);
    tw.advance(0.2);
    const s = (tw.game as unknown as G).world.entities.find((e) => e.constructor.name === 'Sootling')!;
    for (let i = 0; i < 80; i++) {
      tw.advance(0.05);
      const b = s.bombs!.find((x) => x.grounded);
      if (b) {
        // Step behind the bomb (on the far side from him) and knock it his way.
        tw.teleport(b.pos.x, p.y, b.pos.z - 2.2, 0);
        tw.advance(0.05);
        tw.aimAt(b.pos.x, b.pos.y, b.pos.z);
        tw.advance(0.02);
        const t = tw.state().target;
        tw.cast(0);
        tw.advance(0.1);
        tw.teleport(p.x - 6, p.y, p.z - 4, 0);
        for (let j = 0; j < 12; j++) tw.advance(0.25);
        return { t, state: s.state };
      }
    }
    return { t: null, state: s.state };
  }, p);
  expect(kicked.t).toBe('thwackwort');
  expect(kicked.state).toBe('gone');
  await shot(page, 'm17-sootling', browserName);
});

test('a thwacked Sootling is dazed; a second thwack banishes him', async ({ page }) => {
  const p = await gym(page);
  await page.evaluate((p) => {
    const tw = window.__tw;
    (tw.game as unknown as G).world.spawn({ type: 'sootling', pos: [p.x, p.y, p.z + 6], yaw: Math.PI, wander: 0, interval: 8 }, 9002);
    tw.setCamera(0, 0.1);
    tw.advance(0.3);
  }, p);
  expect(await castAtFoe(page, 'Sootling')).toBe('thwackwort');
  expect((await foe(page, 'Sootling')).state).toBe('dazed');
  expect(await castAtFoe(page, 'Sootling')).toBe('thwackwort');
  expect((await foe(page, 'Sootling')).state).toBe('gone');
});
