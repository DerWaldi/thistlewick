import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

// The Practice Yard in the gym (x -44..-18, z 22..54) exercises every Thwackwort mechanic.

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test('aiming at a knock switch locks on, and casting opens the gate', async ({ page, browserName }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-31, 0, 26.5, 0);
    tw.advance(0.3);
    tw.aimAt(-36, 1.9, 29.7);
    const target = tw.state().target;
    tw.cast(0);
    tw.advance(0.5);
    const on = tw.signal('yard-a');
    tw.advance(2.5);
    return { target, on };
  });
  expect(r.target).toBe('thwackwort');
  expect(r.on).toBe(true);
  // The gate is open: walk through it.
  const z = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-31, 0, 28, 0);
    tw.input({ y: 1 });
    tw.advance(0.8);
    tw.input(null);
    return tw.state().feet.z;
  });
  expect(z).toBeGreaterThan(31);
  await page.evaluate(() => {
    window.__tw.teleport(-31, 0, 25, 0);
    window.__tw.advance(0.4);
    window.__tw.aimAt(-36, 1.9, 29.7);
  });
  await shot(page, 'm1-switch-gate', browserName);
});

test('clicking with nothing targeted fizzles; holding charges', async ({ page, browserName }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 0, 0);
    tw.advance(0.3);
    tw.setCamera(Math.PI, -0.1);
    tw.advance(0.1);
    const noTarget = tw.state().target;
    tw.cast(0);
    tw.advance(0.5);
    // Open gate A, then charge at the push block from the gate opening.
    tw.teleport(-31, 0, 26.5, 0);
    tw.advance(0.3);
    tw.aimAt(-36, 1.9, 29.7);
    tw.cast(0);
    tw.advance(2.5);
    tw.teleport(-31, 0, 29.6, 0);
    tw.advance(0.3);
    tw.aimAt(-31, 1, 32.5);
    return { noTarget };
  });
  expect(r.noTarget).toBeNull();
  // Hold and look at the charge ring mid-charge.
  const charging = await page.evaluate(() => {
    const tw = window.__tw as unknown as { game: { input: { setCast(d: boolean): void } } } & typeof window.__tw;
    tw.game.input.setCast(true);
    tw.advance(0.7);
    return tw.state().charging;
  });
  expect(charging).toBe(true);
  await shot(page, 'm1-charging', browserName);
  const pos = await page.evaluate(() => {
    const tw = window.__tw as unknown as { game: { input: { setCast(d: boolean): void } } } & typeof window.__tw;
    tw.game.input.setCast(false);
    tw.advance(3);
    const g = tw.game as unknown as { world: { entities: { constructor: { name: string }; pos?: { z: number; y: number } }[] } };
    const block = g.world.entities.find((e) => e.constructor.name === 'PushBlock')!;
    return { z: block.pos!.z, y: block.pos!.y };
  });
  // A charged shove carries the block past the first tile and into the pit.
  expect(pos.z).toBeCloseTo(36.5, 1);
  expect(pos.y).toBeCloseTo(-1, 1);
});

test('push block fills the pit and makes the crossing possible', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-31, 0, 26.5, 0);
    tw.advance(0.3);
    tw.aimAt(-36, 1.9, 29.7);
    tw.cast(0);
    tw.advance(2.5);
    tw.teleport(-31, 0, 29.6, 0);
    tw.advance(0.3);
    tw.aimAt(-31, 1, 32.5);
    tw.cast(0);
    tw.advance(1.2);
    tw.aimAt(-31, 1, 34.5);
    tw.cast(0);
    tw.advance(1.5);
    // Run and jump across: block top is flush with the floor, 2.5 m of water remains.
    tw.teleport(-31, 0, 34.6, 0);
    tw.advance(0.2);
    tw.input({ y: 1 });
    for (let i = 0; i < 120; i++) {
      tw.advance(1 / 60);
      const s = tw.state();
      if (s.feet.z > 37.2 && s.grounded) {
        tw.pressJump();
        tw.input({ y: 1, jump: true });
      }
    }
    tw.input(null);
    tw.advance(0.5);
    return tw.state();
  });
  expect(r.feet.z).toBeGreaterThan(40);
  expect(r.stamina).toBe(5);
});

test('timed switch opens the gate long enough to run through', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-23, 0, 43, Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(-18.3, 1.9, 42);
    tw.cast(0);
    tw.advance(0.2);
    const opened = tw.signal('yard-timed');
    // Steer to just past the gate.
    tw.setCamera(0, -0.2);
    for (let i = 0; i < 300; i++) {
      const s = tw.state();
      const dx = -31 - s.feet.x;
      const dz = 48 - s.feet.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.3) break;
      // Camera yaw 0: forward is +z, right is -x.
      tw.input({ x: -dx / l, y: dz / l });
      tw.advance(1 / 60);
    }
    tw.input(null);
    const through = tw.state().feet.z;
    tw.advance(6);
    return { opened, through, closedAgain: !tw.signal('yard-timed') };
  });
  expect(r.opened).toBe(true);
  expect(r.through).toBeGreaterThan(47);
  expect(r.closedAgain).toBe(true);
});

test('a block on the pressure plate holds the side gate open', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const before = tw.signal('yard-plate');
    tw.teleport(-33, 0, 43.5, -Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(-36.5, 1, 43.5);
    tw.cast(0);
    tw.advance(3);
    const after = tw.signal('yard-plate');
    tw.teleport(-41.5, 0, 44.6, 0);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(1);
    tw.input(null);
    return { before, after, z: tw.state().feet.z };
  });
  expect(r.before).toBe(false);
  expect(r.after).toBe(true);
  expect(r.z).toBeGreaterThan(48);
});

test('gnarlings attack, get stunned by Thwackwort and banished by a second hit', async ({ page, browserName }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    type G = { state: string; pos: { x: number; y: number; z: number; distanceTo(o: unknown): number } };
    const g = tw.game as unknown as {
      world: { entities: ({ constructor: { name: string } } & G)[] };
      player: { pos: unknown };
    };
    const gn = g.world.entities.filter((e) => e.constructor.name === 'Gnarling');
    tw.teleport(-30, 0, 47.2, 0);
    let attacked = false;
    for (let i = 0; i < 240 && !attacked; i++) {
      tw.advance(1 / 60);
      attacked = tw.state().stamina < 5;
    }
    const near = gn.filter((x) => x.state !== 'gone').sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0];
    tw.aimAt(near.pos.x, near.pos.y, near.pos.z);
    tw.cast(0);
    tw.advance(0.4);
    const stunned = near.state;
    tw.advance(0.8);
    tw.aimAt(near.pos.x, near.pos.y, near.pos.z);
    tw.cast(0);
    tw.advance(0.5);
    const marker = (near as unknown as { marker: { sprite: { parent: unknown } } }).marker.sprite.parent;
    return { attacked, stunned, after: near.state, markerGone: marker === null };
  });
  expect(r.attacked).toBe(true);
  expect(r.stunned).toBe('stunned');
  expect(r.after).toBe('gone');
  expect(r.markerGone).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-34, 0, 47.5, Math.PI / 2);
    tw.advance(0.8);
    tw.setCamera(Math.PI / 2 + 0.3, -0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm1-garden', browserName);
});

test('fainting returns you to the last checkpoint with full stamina', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-35.5, 0, 26, 0);
    tw.advance(0.5);
    const cp = tw.state().checkpoint;
    (tw.game as unknown as { state: { stamina: number } }).state.stamina = 1;
    tw.teleport(-36, 0, 33, 0);
    tw.advance(0.6);
    tw.input({ y: 1 });
    tw.advance(1);
    tw.input(null);
    tw.advance(3);
    return { cp, s: tw.state() };
  });
  expect(r.cp).not.toBeNull();
  expect(r.s.stamina).toBe(5);
  expect(r.s.feet.x).toBeCloseTo(r.cp![0], 0);
  expect(r.s.feet.z).toBeCloseTo(r.cp![2], 0);
});

test('sweets are collected, with a magnet pull', async ({ page }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const s0 = tw.state().sweets;
    // Walk alongside (not through) the line of Fizzwort Drops at x=-31, z 23.5..28.5.
    tw.teleport(-32.3, 0, 22.8, 0);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(0.9);
    tw.input(null);
    tw.advance(0.5);
    return tw.state().sweets - s0;
  });
  expect(r).toBe(5);
});

test('targets for spells you have not learned say so instead of casting', async ({ page, browserName }) => {
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const toasts: string[] = [];
    (tw.game as unknown as { events: { on(e: string, f: (x: { text: string }) => void): void } }).events.on('toast', (t) => toasts.push(t.text));
    tw.teleport(-23.5, 0, 47.5, Math.PI / 2);
    tw.advance(0.2);
    tw.aimAt(-20.2, 0.45, 47.5);
    const s = tw.state();
    tw.cast(0);
    tw.advance(0.2);
    return { target: s.target, unknown: s.targetUnknown, toasts };
  });
  expect(r.target).toBe('latchkin');
  expect(r.unknown).toBe(true);
  expect(r.toasts.some((t) => t.includes('Latchkin'))).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-23, 0, 46, Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(-20.2, 0.6, 47.5);
  });
  await shot(page, 'm1-chest', browserName);
});
