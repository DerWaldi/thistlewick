import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The third lesson end to end: Hopgood's padlocked door, his gym, the Tumbledown Tower
// (every bounce of it), and the court balcony it finally opens.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type V = { x: number; y: number; z: number };
type Ent = { constructor: { name: string }; spec?: { id?: string }; state?: string; root?: { visible: boolean } };
type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string> };
  session: { world: { entities: Ent[] } };
};

async function prepared(page: Page, level: string, opts: { springwell?: boolean; flags?: string[]; spawn?: string } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'bramblecote';
      const flags = ['sorted', 'greeted', 'lesson-started', 'practice-done', 'gorse-reward', 'quince-lesson-started', 'practice-latchkin', 'quince-reward'];
      for (const f of [...flags, 'hopgood-lesson-started', 'tower-entered', ...(opts.flags ?? [])]) g.state.flags.add(f);
      tw.learn('thwackwort');
      tw.learn('latchkin');
      g.state.lessons.add('thwackwort');
      g.state.lessons.add('latchkin');
      if (opts.springwell) tw.learn('springwell');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts },
  );
}

/**
 * Stand at `from`, cast at `at` (holding `hold` seconds to charge), then push the stick
 * towards `yaw` for `push` seconds (optionally holding jump) and wait to land.
 */
const bounce = (page: Page, from: [number, number, number], at: [number, number, number], yaw: number, push: number, opts: { hold?: number; jump?: boolean; steer?: [number, number, number] } = {}) =>
  page.evaluate(
    async ({ from, at, yaw, push, opts }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.advance(0.4);
      await tw.idle();
      tw.advance(0.1);
      tw.aimAt(...at);
      tw.advance(0.05);
      const target = tw.state().target;
      tw.cast(opts.hold ?? 0);
      tw.advance(opts.hold ? 0.4 : 0.4);
      tw.setCamera(yaw, -0.2);
      tw.input({ y: 1, jump: opts.jump });
      for (let t = 0; t < push; t += 0.1) tw.advance(0.1);
      if (opts.steer) {
        // A second push mid-air (e.g. out of a hatch you've just bounced through).
        const [delay, yaw2, secs] = opts.steer;
        tw.input(opts.jump ? { jump: true } : null);
        for (let t = 0; t < delay; t += 0.1) tw.advance(0.1);
        tw.setCamera(yaw2, -0.2);
        tw.input({ y: 1 });
        for (let t = 0; t < secs; t += 0.1) tw.advance(0.1);
      }
      tw.input(opts.jump ? { jump: true } : null);
      tw.advance(0.5);
      tw.input(null);
      tw.advance(2);
      await tw.idle();
      const s = tw.state();
      return { target, feet: s.feet as V, area: s.area, level: s.level };
    },
    { from, at, yaw, push, opts },
  );

test("Latchkin opens Hopgood's door in Hollyhock Court, and it stays open", async ({ page }) => {
  await prepared(page, 'hub', { spawn: 'fromHopgood' });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-14.6, 0, 40, -Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const before = tw.state().level;
    tw.aimAt(-15.82, 1.5, 40.45);
    tw.advance(0.05);
    const target = tw.state().target;
    tw.cast(0);
    tw.advance(2);
    tw.teleport(-14.6, 0, 40, -Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { before, target, after: tw.state().level };
  });
  expect(r.before).toBe('hub');
  expect(r.target).toBe('latchkin');
  expect(r.after).toBe('hopgood');
});

test('Hopgood teaches Springwell; the tall platform needs a held jump', async ({ page, browserName }) => {
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.house = 'bramblecote';
    for (const f of ['sorted', 'greeted', 'practice-done', 'practice-latchkin']) g.state.flags.add(f);
    tw.learn('thwackwort');
    tw.learn('latchkin');
    g.state.lessons.add('thwackwort');
    g.state.lessons.add('latchkin');
    tw.loadLevel('hopgood');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('springwell');
  const p1 = await bounce(page, [-5.25, 0, 7.4], [-5.25, 0.3, 9.6], 0, 0.9);
  const p2 = await bounce(page, [0, 0, 7.2], [0, 0.55, 9.4], 0, 0.9);
  const p3plain = await bounce(page, [5.25, 0, 7.9], [5.25, 0.2, 10.1], 0, 0.9);
  const p3 = await bounce(page, [5.25, 0, 7.9], [5.25, 0.2, 10.1], 0, 0.9, { jump: true });
  const p3charged = await bounce(page, [5.25, 0, 7.9], [5.25, 0.2, 10.1], 0, 0.9, { hold: 1 });
  expect(p1.feet.y).toBeGreaterThan(4.9);
  expect(p2.feet.y).toBeGreaterThan(5.9);
  expect(p3plain.feet.y).toBeLessThan(7);
  expect(p3.feet.y).toBeGreaterThan(7.7);
  expect(p3charged.feet.y).toBeGreaterThan(7.7);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    await tw.idle();
    const practice = g.state.flags.has('practice-springwell');
    tw.teleport(0, 0, 1.4, Math.PI);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const stayed = tw.state().level;
    tw.teleport(6.3, 0, 3, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, stayed, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.stayed).toBe('hopgood');
  expect(r.level).toBe('tower');
  await shot(page, 'm7-tower-base', browserName);
});

test('the Tumbledown Tower can be climbed, bounce by bounce', async ({ page, browserName }) => {
  await prepared(page, 'tower', { springwell: true, flags: ['tower-hint-stair', 'tower-hint-bellfry', 'tower-hint-roof'] });
  // Base: pad A up onto the west block.
  const l1 = await bounce(page, [1.5, 0, 12], [-2.5, 0.3, 12], -Math.PI / 2, 1.6);
  expect(l1.feet.y).toBeGreaterThan(4.9);
  // Toadstool stair.
  const p2 = await bounce(page, [-6.2, 5, 17.5], [-2.5, 4, 17.5], Math.PI / 2, 1.1);
  expect(p2.feet.y).toBeGreaterThan(9.4);
  const p3 = await bounce(page, [4.2, 9.5, 16.6], [6.2, 8.65, 15], Math.atan2(2, -1.6), 0.5);
  expect(p3.feet.y).toBeGreaterThan(12.9);
  const bell = await bounce(page, [6.6, 13, 4], [3.5, 12.15, 4], -Math.PI / 2, 0.5, { steer: [0.4, -Math.PI / 2, 0.5] });
  expect(bell.area).toBe('bellfry');
  // Bellfry: a plain bounce doesn't reach the walkway; ring, charge, and through the gate.
  const plain = await bounce(page, [0, 17.5, 11.8], [0, 17.7, 15.2], 0, 0.6);
  expect(plain.feet.y).toBeLessThan(20);
  await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(7);
    tw.teleport(0, 17.5, 9, 0);
    tw.advance(0.3);
    tw.aimAt(0, 22.5, 19.83);
    tw.advance(0.05);
    tw.cast(0);
    tw.advance(0.4);
  });
  const walk = await bounce(page, [0, 17.5, 11.8], [0, 17.7, 15.2], 0, 0.6, { hold: 1 });
  expect(walk.feet.y).toBeGreaterThan(26.9);
  const pastGate = await page.evaluate(() => {
    const tw = window.__tw;
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.6);
    tw.input(null);
    tw.advance(0.3);
    return tw.state().feet.x;
  });
  expect(pastGate).toBeLessThan(-5);
  const roof = await bounce(page, [-4.9, 27, 18.75], [-8, 27.55, 18.75], -Math.PI / 2, 0.6, { steer: [0, Math.PI / 2, 0.6] });
  expect(roof.area).toBe('roof');
  await shot(page, 'm7-roof', browserName);
  // The rooftops, turret to turret.
  const t1 = await bounce(page, [6, 32.5, 10], [8.2, 32.7, 10], Math.PI / 2, 0.3);
  expect(t1.feet.y).toBeCloseTo(31, 0);
  const t2 = await bounce(page, [15, 31, 10], [16.5, 31.2, 10], Math.PI / 2, 0.5);
  expect(t2.feet.y).toBeCloseTo(34, 0);
  // Clear the last Snapcasket out of the way first (it's on the final turret).
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    const s = g.session.world.entities.find((e) => e.constructor.name === 'Snapcasket' && e.spec?.id === 't-snap3')!;
    s.state = 'gone';
    s.root!.visible = false;
  });
  const t3 = await bounce(page, [22, 34, 2.6], [23, 34.2, 4], 0.7, 0.3);
  expect(t3.feet.y).toBeCloseTo(37, 0);
  const spire = await bounce(page, [28, 37, 10], [29.5, 37.3, 10], Math.PI / 2, 2.4, { hold: 1 });
  expect(spire.feet.y).toBeGreaterThan(44.9);
  const lessons = await page.evaluate(() => [...(window.__tw.game as unknown as G).state.lessons]);
  expect(lessons).toContain('springwell');
  await shot(page, 'm7-spire', browserName);
});

test('pads go flat again, and only a charged, boosted bounce reaches the bell (and its card)', async ({ page }) => {
  await prepared(page, 'tower', { springwell: true, flags: ['tower-hint-stair', 'tower-hint-bellfry'] });
  const flat = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 17.5, 11.8, 0);
    tw.advance(0.3);
    tw.aimAt(0, 17.7, 15.2);
    tw.advance(0.05);
    tw.cast(0);
    tw.advance(7);
    // Walk onto it after it's gone flat: no launch.
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(0.6);
    tw.input(null);
    let maxY = 0;
    for (let i = 0; i < 15; i++) {
      tw.advance(0.1);
      maxY = Math.max(maxY, tw.state().feet.y);
    }
    return maxY;
  });
  expect(flat).toBeLessThan(18.5);
  const top = await bounce(page, [0, 17.5, 17.6], [0, 17.7, 15.2], Math.PI, 0.25, { hold: 1, jump: true, steer: [0.3, Math.PI, 0.35] });
  const cards = await page.evaluate(() => window.__tw.state().cards);
  expect(top.feet.y).toBeGreaterThan(28.9);
  expect(cards).toContain('bouncewort');
});

test("the court balcony: Springwell the cloister roof's moss and bounce up", async ({ page, browserName }) => {
  await prepared(page, 'hub', { springwell: true });
  const r = await bounce(page, [-14.2, 5, 44.6], [-14.2, 5.3, 47], 0, 1.4);
  const cards = await page.evaluate(() => window.__tw.state().cards);
  expect(r.feet.y).toBeGreaterThan(9.2);
  expect(cards).toContain('griselda-gusset');
  await shot(page, 'm7-balcony', browserName);
});

test('Hopgood gives his card after the Tower, and the Tower door stays shut', async ({ page }) => {
  await prepared(page, 'hopgood', { springwell: true, flags: ['practice-springwell'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.lessons.add('springwell');
    tw.teleport(-3, 0, 2.2, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.teleport(6.3, 0, 3, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { cards: [...g.state.cards], level: tw.state().level };
  });
  expect(r.cards).toContain('tobias-hopgood');
  expect(r.level).toBe('hopgood');
});
