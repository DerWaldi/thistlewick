import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('spawns grounded and renders the gym', async ({ page, browserName }) => {
  const s = await page.evaluate(() => {
    window.__tw.advance(1);
    return window.__tw.state();
  });
  expect(s.mode).toBe('ground');
  expect(s.feet.y).toBeCloseTo(0, 1);
  await shot(page, 'spawn', browserName);
});

test('running jump has the intended arc', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-38, 0, 30, Math.PI / 2);
    tw.input({ y: 1 });
    tw.advance(1);
    const startX = tw.state().feet.x;
    tw.pressJump();
    tw.input({ y: 1, jump: true });
    tw.advance(1 / 60);
    let maxY = 0;
    for (let i = 0; i < 120; i++) {
      tw.advance(1 / 60);
      const s = tw.state();
      maxY = Math.max(maxY, s.feet.y);
      if (s.grounded) return { maxY, dist: s.feet.x - startX };
    }
    return { maxY, dist: -1 };
  });
  expect(r.maxY).toBeGreaterThan(1.3);
  expect(r.maxY).toBeLessThan(1.7);
  expect(r.dist).toBeGreaterThan(3);
  expect(r.dist).toBeLessThan(4.2);
});

test('tapping jump gives a short hop', async ({ page }) => {
  const maxY = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-38, 0, 30, 0);
    tw.advance(0.3);
    tw.pressJump();
    tw.input({ jump: true });
    tw.advance(2 / 60);
    tw.input(null);
    let m = 0;
    for (let i = 0; i < 90; i++) {
      tw.advance(1 / 60);
      m = Math.max(m, tw.state().feet.y);
    }
    return m;
  });
  expect(maxY).toBeLessThan(0.9);
});

test('grabs a 2.8 m ledge, hangs, then climbs', async ({ page, browserName }) => {
  const hang = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, -5.5, Math.PI);
    tw.input({ y: 1 });
    tw.advance(0.35);
    tw.pressJump();
    tw.input({ y: 0, jump: true });
    for (let i = 0; i < 90; i++) {
      tw.advance(1 / 60);
      if (tw.state().mode === 'hang') break;
    }
    tw.input(null);
    tw.advance(0.3);
    tw.setCamera(Math.PI - 0.5, -0.1);
    tw.advance(0.5);
    return tw.state();
  });
  expect(hang.mode).toBe('hang');
  await shot(page, 'ledge-hang', browserName);

  const top = await page.evaluate(() => {
    const tw = window.__tw;
    tw.input({ y: 1 });
    tw.advance(0.6);
    tw.input(null);
    tw.advance(0.3);
    return tw.state();
  });
  expect(top.feet.y).toBeCloseTo(2.8, 1);
  expect(top.mode).toBe('ground');
});

test('a 4 m wall is out of reach', async ({ page }) => {
  const s = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(8, 0, -5.5, Math.PI);
    tw.input({ y: 1 });
    tw.advance(0.35);
    tw.pressJump();
    tw.input({ y: 1, jump: true });
    tw.advance(1.5);
    tw.input(null);
    return tw.state();
  });
  expect(s.feet.y).toBeLessThan(0.1);
});

test('camera never ends up inside geometry in the narrow corridor', async ({ page, browserName }) => {
  const inside = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-34, 0, -37, 0);
    tw.input({ y: 1 });
    let bad = 0;
    for (let i = 0; i < 240; i++) {
      tw.advance(1 / 60);
      const s = tw.state();
      if (s.feet.z > -23.2) tw.setCamera(Math.min(Math.PI / 2, s.camera.yaw + 0.08));
      if (s.cameraInsideSolid) bad++;
    }
    tw.input(null);
    tw.teleport(-34, 0, -28, 0);
    for (let i = 0; i < 160; i++) {
      tw.setCamera(i * 0.21, -0.9 + (i % 10) * 0.15);
      tw.advance(1 / 60);
      if (tw.state().cameraInsideSolid) bad++;
    }
    tw.setCamera(0.4, -0.2);
    tw.advance(0.5);
    return bad;
  });
  expect(inside).toBe(0);
  await shot(page, 'corridor', browserName);
});

test('falling into water respawns on safe ground', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(9, 0, 22, Math.PI / 2);
    tw.advance(0.6);
    tw.input({ y: 1 });
    tw.advance(1.3);
    tw.input(null);
    tw.advance(1.5);
    return tw.state();
  });
  expect(r.mode).toBe('ground');
  expect(r.feet.x).toBeLessThan(13);
  expect(r.feet.y).toBeCloseTo(0, 1);
});

test('bounce pad launches higher when jump is held', async ({ page, browserName }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const measure = (hold: boolean) => {
      tw.teleport(0, 2, 22, 0);
      tw.input(hold ? { jump: true } : null);
      let m = 0;
      for (let i = 0; i < 90; i++) {
        tw.advance(1 / 60);
        m = Math.max(m, tw.state().feet.y);
      }
      tw.input(null);
      return m;
    };
    const plain = measure(false);
    const held = measure(true);
    tw.teleport(0, 2, 22, Math.PI);
    tw.setCamera(Math.PI, -0.35);
    tw.advance(0.75);
    return { plain, held };
  });
  expect(r.plain).toBeGreaterThan(5.5);
  expect(r.held).toBeGreaterThan(r.plain + 1);
  await shot(page, 'bounce', browserName);
});

test('rides horizontal and vertical moving platforms', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    // Find the platforms by probing their known paths: horizontal at x=32, lift at x=38.
    tw.advance(0.5);
    const g = tw.game as { level: { movers: { cur: { x: number; y: number; z: number } }[] } };
    const [h, lift] = g.level.movers;
    tw.teleport(32, 3.2, h.cur.z, 0);
    tw.advance(0.3);
    const rel0 = tw.state().feet.z - h.cur.z;
    let drift = 0;
    for (let i = 0; i < 400; i++) {
      tw.advance(1 / 60);
      drift = Math.max(drift, Math.abs(tw.state().feet.z - h.cur.z - rel0));
    }
    tw.teleport(38, lift.cur.y + 0.4, 3, 0);
    tw.advance(0.3);
    let minGap = 9;
    for (let i = 0; i < 600; i++) {
      tw.advance(1 / 60);
      minGap = Math.min(minGap, tw.state().feet.y - (lift.cur.y + 0.2));
    }
    return { drift, minGap };
  });
  expect(r.drift).toBeLessThan(0.05);
  expect(r.minGap).toBeGreaterThan(-0.03);
});

test('ice keeps momentum', async ({ page }) => {
  const slide = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-13, 0.1, 22, Math.PI / 2);
    tw.input({ y: 1 });
    tw.advance(1);
    const x0 = tw.state().feet.x;
    tw.input(null);
    tw.advance(2);
    return tw.state().feet.x - x0;
  });
  expect(slide).toBeGreaterThan(3);
});
