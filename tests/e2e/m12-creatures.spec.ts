import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// New enemies (Snapweed, Ember Crab) and the rooms that lengthen the trials.

type Ent = { constructor: { name: string }; pos?: { x: number; y: number; z: number }; state?: string; spec?: { id?: string }; bitten?: () => void };
type G = { state: { flags: Set<string>; lessons: Set<string> }; world: { entities: Ent[] }; session: { builder: { movers: { cur: { x: number; y: number; z: number } }[] } } };

async function sandbox(page: Page, level: string, flags: string[] = []): Promise<void> {
  await boot(page, `?test&level=${level}`);
  await page.evaluate(
    async ({ flags }) => {
      const g = window.__tw.game as unknown as G;
      for (const f of flags) g.state.flags.add(f);
      await window.__tw.idle();
    },
    { flags },
  );
}

const castAt = (page: Page, from: [number, number, number], at: [number, number, number], wait = 0.8, hold = 0) =>
  page.evaluate(
    async ({ from, at, wait, hold }) => {
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
    { from, at, wait, hold },
  );

const stamina = (page: Page) => page.evaluate(() => window.__tw.state().stamina);
const entities = (page: Page, name: string) =>
  page.evaluate((name) => (window.__tw.game as unknown as G).world.entities.filter((e) => e.constructor.name === name).map((e) => ({ pos: e.pos, state: e.state })), name);

test('Snapweed: rears back and bites anyone in reach, Gnarlings too; Cindersnap burns it away', async ({ page, browserName }) => {
  await sandbox(page, 'glasshouse', ['glasshouse-hint-weeds', 'glasshouse-entered']);
  // Out of reach: safe.
  await page.evaluate(() => {
    window.__tw.teleport(3.5, 0, 71.2, Math.PI / 2);
    window.__tw.advance(2);
  });
  expect(await stamina(page)).toBe(5);
  // In reach: after the tell, it bites.
  await page.evaluate(() => {
    window.__tw.teleport(5.6, 0, 71.2, Math.PI / 2);
    window.__tw.advance(1.2);
  });
  expect(await stamina(page)).toBeLessThan(5);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(4.4, 0, 70.4, Math.PI / 2);
    tw.setCamera(Math.PI / 2 + 0.5, 0);
    tw.advance(3);
  });
  await shot(page, 'm12-snapweed', browserName);
  // A Gnarling that wanders into reach gets bitten.
  const gnarlingBitten = await page.evaluate(() => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    tw.teleport(-6, 0, 70, 0);
    const gn = g.world.entities.find((e) => e.constructor.name === 'Gnarling')!;
    gn.pos!.x = -1;
    gn.pos!.y = 0.6;
    gn.pos!.z = 80.8;
    tw.advance(1.5);
    return gn.state;
  });
  expect(gnarlingBitten).toBe('gone');
  // Burnt from a safe distance, and the way past is clear.
  expect(await castAt(page, [2, 0, 71], [7, 1.2, 71.2], 2)).toBe('cindersnap');
  const weeds = await entities(page, 'Snapweed');
  expect(weeds.filter((w) => w.state === 'gone').length).toBeGreaterThanOrEqual(1);
  const walked = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(4, 0, 71.2, Math.PI / 2);
    tw.setCamera(Math.PI / 2, 0.2);
    const before = tw.state().stamina;
    tw.input({ x: 0, y: 1 });
    tw.advance(0.7);
    tw.input(null);
    tw.advance(1);
    return { x: tw.state().feet.x, lost: before - tw.state().stamina };
  });
  expect(walked.x).toBeGreaterThan(6);
  expect(walked.lost).toBe(0);
});

test('Ember Crab: spits fireballs; Rimewhistle freezes it into a block to stand on; Thwackwort shatters it', async ({ page, browserName }) => {
  await sandbox(page, 'cisterns', ['cistern-hint-crabs', 'cisterns-entered']);
  // On the south bank, the nearest crab in the water has you in range.
  await page.evaluate(() => {
    window.__tw.teleport(-2, 3.2, 60.2, 0);
    for (let i = 0; i < 40; i++) window.__tw.advance(0.25);
  });
  expect(await stamina(page)).toBeLessThan(5);
  await page.evaluate(() => window.__tw.advance(4));
  // Freeze the first: it's a block of ice you can stand on.
  expect(await castAt(page, [-2, 3.2, 60.4], [-2, 2.5, 63], 0.6)).toBe('rimewhistle');
  const top = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2, 3.4, 63, 0);
    tw.advance(0.6);
    return tw.state().feet.y;
  });
  // Just above the water (2.7), a hop below the banks.
  expect(top).toBeGreaterThan(2.8);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-1, 3.2, 60.4, 0);
    tw.setCamera(-0.2, -0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm12-crab-frozen', browserName);
  // Frozen, Thwackwort shatters it.
  expect(await castAt(page, [-2, 3.2, 60.4], [-2, 2.5, 63], 0.6)).toBe('thwackwort');
  const crabs = await entities(page, 'EmberCrab');
  expect(crabs.filter((c) => c.state === 'gone').length).toBe(1);
});

test('Ember Crab without Rimewhistle: Thwackwort flips it over for a while (the Ember Crypt)', async ({ page }) => {
  await sandbox(page, 'catacombs', ['catacomb-hint-crypt', 'catacombs-entered']);
  expect(await page.evaluate(() => window.__tw.state().known)).not.toContain('rimewhistle');
  const t = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    tw.teleport(0, 0, 87, 0);
    tw.advance(0.3);
    await tw.idle();
    const crab = g.world.entities.find((e) => e.constructor.name === 'EmberCrab')!;
    tw.aimAt(crab.pos!.x, crab.pos!.y + 0.2, crab.pos!.z);
    tw.advance(0.02);
    const target = tw.state().target;
    tw.cast(0);
    tw.advance(0.4);
    return target;
  });
  expect(t).toBe('thwackwort');
  const crabs = await entities(page, 'EmberCrab');
  expect(crabs.some((c) => c.state === 'stunned')).toBe(true);
});

test('the Ember Crypt: lamp-lit glimmer stones over the chasm to the Star', async ({ page, browserName }) => {
  await sandbox(page, 'catacombs', ['catacomb-hint-crypt', 'catacombs-entered']);
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    for (const e of g.world.entities) if (e.constructor.name === 'EmberCrab' && e.pos) e.pos.y = -100;
  });
  const standOn = (at: [number, number, number]) =>
    page.evaluate((at) => {
      const tw = window.__tw;
      tw.teleport(at[0], at[1] + 0.5, at[2], 0);
      tw.advance(0.5);
      return tw.state().feet.y;
    }, at);
  expect(await standOn([0.6, 0, 75])).toBeLessThan(-1);
  await page.evaluate(() => window.__tw.advance(3));
  expect(await castAt(page, [0, 0, 72], [3, 2.1, 72.4], 0.3)).toBe('glimmerwick');
  expect(await standOn([0.6, 0, 75])).toBeGreaterThan(-0.2);
  expect(await standOn([-0.4, 0, 77.4])).toBeGreaterThan(-0.2);
  expect(await standOn([-3, 0, 80])).toBeGreaterThan(-0.2);
  expect(await castAt(page, [-3, 0, 79.4], [-3.4, 2.1, 80.3], 0.3)).toBe('glimmerwick');
  expect(await standOn([-0.6, 0, 82.6])).toBeGreaterThan(-0.2);
  expect(await standOn([0.5, 0, 85])).toBeGreaterThan(-0.2);
  await shot(page, 'm12-crypt', browserName);
  const star = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 87.5, 0);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(1.8);
    tw.input(null);
    await tw.idle();
    return tw.state().area;
  });
  expect(star).toBe('lantern');
  // Through the doorway, the portcullis drops behind you: the crabs can't follow you with fire.
  const back = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.input({ x: 0, y: 1 });
    tw.advance(0.6);
    tw.input(null);
    tw.advance(2);
    await tw.idle();
    const shut = tw.signal('crypt-shut');
    const checkpoint = tw.state().checkpoint;
    tw.input({ x: 0, y: -1 });
    tw.advance(2.5);
    tw.input(null);
    return { shut, checkpoint, z: tw.state().feet.z };
  });
  expect(back.shut).toBe(true);
  expect(back.checkpoint?.[2]).toBeGreaterThan(90.5);
  expect(back.z).toBeGreaterThan(90.5);
});

test('the Clockwork Moat: three moving platforms over the pit, Gnarlings, and the switch to the Star', async ({ page, browserName }) => {
  await sandbox(page, 'trial', ['trial-hint-moat', 'trial-entered']);
  // The moat's three are the first movers in the trial (the Sootling's Leap has one more after them).
  const movers = () => page.evaluate(() => (window.__tw.game as unknown as G).session.builder.movers.slice(0, 3).map((m) => ({ ...m.cur })));
  const a = await movers();
  await page.evaluate(() => window.__tw.advance(1.3));
  const b = await movers();
  expect(Math.abs(a[0].x - b[0].x)).toBeGreaterThan(0.5);
  expect(Math.abs(a[1].z - b[1].z)).toBeGreaterThan(0.5);
  expect(Math.abs(a[2].y - b[2].y)).toBeGreaterThan(0.3);
  // Each platform carries you.
  for (let i = 0; i < 3; i++) {
    const ride = await page.evaluate((i) => {
      const tw = window.__tw;
      const m = (tw.game as unknown as G).session.builder.movers.slice(0, 3)[i];
      tw.teleport(m.cur.x, m.cur.y + 0.4, m.cur.z, 0);
      tw.advance(1.5);
      const f = tw.state().feet;
      return { y: f.y, dy: Math.abs(f.y - (m.cur.y + 0.2)), dx: Math.hypot(f.x - m.cur.x, f.z - m.cur.z) };
    }, i);
    expect(ride.dy).toBeLessThan(0.3);
    expect(ride.dx).toBeLessThan(1.3);
  }
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 73.4, 0);
    tw.setCamera(0, -0.3);
    tw.advance(0.4);
  });
  await shot(page, 'm12-moat', browserName);
  // The switch on the far landing opens the Star gate.
  expect(await castAt(page, [-4, 0, 93.5], [-7.95, 1.6, 93.5], 0.5)).toBe('thwackwort');
  const through = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    for (const e of g.world.entities) if (e.constructor.name === 'Gnarling') e.bitten?.();
    tw.advance(1.5);
    tw.teleport(0, 0, 94.5, 0);
    tw.setCamera(0, 0.2);
    tw.input({ x: 0, y: 1 });
    tw.advance(1.5);
    tw.input(null);
    await tw.idle();
    return tw.state().area;
  });
  // Through the gate and the passage beyond, into the Sootling's Leap.
  expect(through).toBe('leap');
});

test('the Strongroom: pendulums swing across, and the padlocked gates relock after 6 s', async ({ page, browserName }) => {
  await sandbox(page, 'vault', ['vault-hint-strongroom', 'vault-entered']);
  const hit = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 97, 0);
    const before = tw.state().stamina;
    for (let i = 0; i < 16; i++) tw.advance(0.25);
    return before - tw.state().stamina;
  });
  expect(hit).toBeGreaterThan(0);
  expect(await castAt(page, [-1, 0, 98.5], [-3.3, 1.8, 100.1], 0.5)).toBe('latchkin');
  expect(await page.evaluate(() => window.__tw.signal('v-g1'))).toBe(true);
  await page.evaluate(() => window.__tw.advance(7));
  expect(await page.evaluate(() => window.__tw.signal('v-g1'))).toBe(false);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 94, 0);
    tw.setCamera(0, -0.1);
    tw.advance(0.3);
  });
  await shot(page, 'm12-strongroom', browserName);
});

test('the Snapweed lunges at whoever is in reach, from a good way off', async ({ page }) => {
  await boot(page, '?test&level=bestiary');
  // Stand west-south-west of the Snapweed (12, 25), inside its new reach, and watch it lunge.
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as { world: { entities: { constructor: { name: string }; state: string; head: { getWorldPosition(v: unknown): { x: number; z: number } } }[] }; renderer: { camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void }; draw(): void } };
    const w = g.world.entities.find((e) => e.constructor.name === 'Snapweed')!;
    for (const e of g.world.entities) if (e.constructor.name === 'Gnarling') (e as unknown as { pos: { y: number } }).pos.y = -100;
    tw.teleport(9.4, 0, 24, 0);
    let headAt = null as null | { x: number; z: number };
    const before = tw.state().stamina;
    for (let i = 0; i < 120; i++) {
      tw.advance(1 / 60);
      if (w.state === 'snap') {
        tw.advance(0.12);
        const m = (w.head as unknown as { matrixWorld: { elements: number[] }; updateWorldMatrix(a: boolean, b: boolean): void });
        g.renderer.draw();
        m.updateWorldMatrix(true, false);
        headAt = { x: m.matrixWorld.elements[12], z: m.matrixWorld.elements[14] };
        g.renderer.camera.position.set(12, 3, 19);
        g.renderer.camera.lookAt(10.5, 1, 24.5);
        g.renderer.draw();
        break;
      }
    }
    tw.advance(0.3);
    return { headAt, hurt: before - tw.state().stamina };
  });
  await page.screenshot({ path: 'tests/e2e/__shots__/m12-snapweed-lunge.png' });
  expect(r.headAt!.x).toBeLessThan(11);
  expect(r.hurt).toBeGreaterThan(0);
});
