import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The Final Examinations: seven professors' rooms in one long hall, then the Golden Thistle.

type Ent = { constructor: { name: string }; pos?: { x: number; y: number; z: number }; home?: { y: number }; state?: string; bitten?: () => void };
type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; housePoints: Record<string, number> };
  world: { entities: Ent[] };
};
const ALL = ['thwackwort', 'latchkin', 'springwell', 'glimmerwick', 'cindersnap', 'rimewhistle', 'thistledown'];
const WHO = ['gorse', 'quince', 'hopgood', 'lamplough', 'ashcombe', 'coldharbour', 'underbough'];
const QUIET = [...WHO.flatMap((w) => [`exam-brief-${w}`, `exam-hint-${w}`]), 'exam-hint-lamplough2', 'exams-entered'];

async function exams(page: Page): Promise<void> {
  await boot(page, '?test&level=exams');
  await page.evaluate(async (flags) => {
    const g = window.__tw.game as unknown as G;
    for (const f of flags) g.state.flags.add(f);
    await window.__tw.idle();
    window.__tw.advance(0.3);
  }, QUIET);
}

const castAt = (page: Page, from: [number, number, number], at: [number, number, number], hold = 0, wait = 0.8) =>
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

const walk = (page: Page, from: [number, number, number], yaw: number, seconds: number, jump = false) =>
  page.evaluate(
    async ({ from, yaw, seconds, jump }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.2);
      tw.input({ x: 0, y: 1, jump });
      for (let t = 0; t < seconds; t += 0.25) {
        tw.advance(0.25);
        await tw.idle();
      }
      tw.input(null);
      tw.advance(0.3);
      const s = tw.state();
      return { ...s.feet, area: s.area };
    },
    { from, yaw, seconds, jump },
  );

const signal = (page: Page, id: string) => page.evaluate((id) => window.__tw.signal(id), id);

/** Removes every creature of a kind (Gnarlings, Snapcaskets...) so a test can get on with it. */
const clear = (page: Page, name: string) =>
  page.evaluate((name) => {
    for (const e of (window.__tw.game as unknown as G).world.entities) {
      if (e.constructor.name !== name || !e.pos) continue;
      e.pos.y = -100;
      if (e.home) e.home.y = -100;
    }
  }, name);

test('the Examination Hall opens at the top of the Lantern Hall stair once all seven lessons are done', async ({ page, browserName }) => {
  await boot(page, '?test&new');
  const r = await page.evaluate(async (all) => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as G;
    g.state.house = 'mallowmere';
    for (const f of ['sorted', 'greeted', 'exams-entered']) g.state.flags.add(f);
    tw.loadLevel('hub');
    await tw.idle();
    tw.advance(0.3);
    const tryDoor = async () => {
      tw.teleport(0, 5, 28.6, 0);
      tw.advance(0.3);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    };
    const before = await tryDoor();
    for (const s of all) {
      tw.learn(s);
      g.state.lessons.add(s);
    }
    const after = await tryDoor();
    tw.teleport(0, 0, 1.2, Math.PI);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { before, after, back: tw.state().level, at: tw.state().feet };
  }, ALL);
  expect(r.before).toBe('hub');
  expect(r.after).toBe('exams');
  // ...and back out onto the gallery, in front of the door.
  expect(r.back).toBe('hub');
  expect(r.at.y).toBeGreaterThan(4.5);
  expect(r.at.z).toBeGreaterThan(26);
  await exams(page);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 2, 0);
    tw.setCamera(0, 0.1);
    tw.advance(0.4);
  });
  await shot(page, 'm14-entrance', browserName);
});

test('I. Gorse: three blocks bridge the trough; the Rattlecoat opens the gate', async ({ page, browserName }) => {
  await exams(page);
  await clear(page, 'Gnarling');
  // (The room's Hexling has its own tests; out of the way, she'd soak up the thwacks.)
  await clear(page, 'Hexling');
  // The middle block: three shoves north and it drops into the trough.
  for (let i = 0; i < 3; i++) expect(await castAt(page, [0, 0, 10.5], [0, 1, 14 + i * 2], 0, 1.4)).toBe('thwackwort');
  expect(await signal(page, 'ex-g1')).toBe(true);
  // The east block: west into the lane, then north over the first.
  for (let i = 0; i < 2; i++) await castAt(page, [-7, 0, 16], [-4 + i * 2, 1, 16]);
  for (let i = 0; i < 4; i++) await castAt(page, [0, 0, 12.5], [0, 1, 16 + i * 2], 0, 1.4);
  // The west block: east into the lane, then north over both.
  for (let i = 0; i < 2; i++) await castAt(page, [7, 0, 16], [4 - i * 2, 1, 16]);
  for (let i = 0; i < 5; i++) await castAt(page, [0, 0, 12.5], [0, 1, 16 + i * 2], 0, 1.4);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2.5, 0, 17, 0.4);
    tw.setCamera(0.4, 0.45);
    tw.advance(0.4);
  });
  await shot(page, 'm14-gorse', browserName);
  const over = await walk(page, [0, 0, 17], 0, 1.6);
  expect(over.z).toBeGreaterThan(26.5);
  expect(over.y).toBeGreaterThan(-0.1);
  // The Rattlecoat: charged knocks until it falls apart.
  for (let i = 0; i < 12 && !(await signal(page, 'ex-rattle')); i++) {
    await page.evaluate(() => {
      const tw = window.__tw;
      const r = (tw.game as unknown as G).world.entities.find((e) => e.constructor.name === 'Rattlecoat');
      const p = r?.pos ?? { x: 0, z: 31 };
      tw.teleport(p.x, 0, p.z - 3, 0);
      tw.advance(0.1);
      // It charges about now: aim where it is, not where it was.
      const q = r?.pos ?? p;
      tw.aimAt(q.x, 1.2, q.z);
      tw.advance(0.05);
      tw.cast(1.2);
      tw.advance(1.2);
    });
  }
  expect(await signal(page, 'ex-rattle')).toBe(true);
});

test('II. Quince: all three padlocks open at once', async ({ page }) => {
  await exams(page);
  await clear(page, 'Snapcasket');
  // From the south-west, two locks are in view; the third round the west side.
  expect(await castAt(page, [3.5, 0, 44.5], [0, 1.9, 46.45], 0, 0.4)).toBe('latchkin');
  expect(await castAt(page, [3.5, 0, 44.5], [1.55, 1.9, 48], 0, 0.4)).toBe('latchkin');
  expect(await castAt(page, [3, 0, 52], [0, 1.9, 49.55], 0, 0.8)).toBe('latchkin');
  expect(await signal(page, 'ex-q1')).toBe(true);
  expect(await signal(page, 'ex-q3')).toBe(true);
  const through = await walk(page, [0, 0, 57], 0, 1);
  expect(through.z).toBeGreaterThan(60.5);
  // ...and they snap shut again.
  await page.evaluate(() => window.__tw.advance(7));
  expect(await signal(page, 'ex-q1')).toBe(false);
});

test('III. Hopgood: moss, a flinging toadstool, and a charged rune tile to the seal', async ({ page, browserName }) => {
  await exams(page);
  expect(await castAt(page, [-3.6, 0, 68], [-3.6, 0.2, 72], 0, 0.3)).toBe('springwell');
  const east = await walk(page, [-1.2, 0, 72], -Math.PI / 2, 2);
  expect(east.y).toBeGreaterThan(4.9);
  expect(await castAt(page, [-9, 5, 71.5], [-7.5, 5.8, 74.5], 0, 0.3)).toBe('springwell');
  // (Players hop onto the cap; the test starts on it.)
  const west = await walk(page, [-7.5, 6.2, 74.5], Math.PI / 2, 2);
  expect(west.y).toBeGreaterThan(8.9);
  expect(west.x).toBeGreaterThan(0.5);
  // A plain bounce falls short of the shelf; a charged one with jump held makes it.
  expect(await castAt(page, [8, 9, 73], [8, 9.1, 77.8], 0, 0.3)).toBe('springwell');
  const plain = await walk(page, [8, 9, 75.6], 0, 3);
  expect(plain.y).toBeLessThan(16.5);
  expect(await signal(page, 'ex-h3')).toBe(false);
  await page.evaluate(() => window.__tw.advance(7));
  expect(await castAt(page, [8, 9, 73], [8, 9.1, 77.8], 1.2, 0.3)).toBe('springwell');
  const top = await walk(page, [8, 9, 75.6], 0, 3, true);
  expect(top.y).toBeGreaterThan(16.9);
  expect(await signal(page, 'ex-h3')).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 64, 0.3);
    tw.setCamera(0.3, 0.5);
    tw.advance(0.4);
  });
  await shot(page, 'm14-hopgood', browserName);
});

test('IV. Lamplough: stones in lamplight, two lamps at once for the false wall', async ({ page, browserName }) => {
  await exams(page);
  expect(await castAt(page, [-1.6, 0, 89], [-1.6, 1.6, 90.8], 0, 0.3)).toBe('glimmerwick');
  const stone = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0.8, 0.5, 95.6, 0);
    tw.advance(0.4);
    return tw.state().feet.y;
  });
  expect(stone).toBeGreaterThan(-0.1);
  expect(await castAt(page, [0.8, 0, 95.6], [4.3, 1.6, 97.7], 0, 0.3)).toBe('glimmerwick');
  const far = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(3.2, 0.5, 103.2, 0);
    tw.advance(0.4);
    return tw.state().feet.y;
  });
  expect(far).toBeGreaterThan(-0.1);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-1.5, 0, 89.5, 0.3);
    tw.setCamera(0.3, 0.35);
    tw.advance(0.2);
  });
  await shot(page, 'm14-lamplough', browserName);
  // The wall is solid until its lamp burns; the gate wants that lamp and the far one together.
  expect(await walk(page, [0, 0, 105.5], 0, 0.8).then((p) => p.z)).toBeLessThan(106.8);
  expect(await castAt(page, [-1, 0, 104.8], [2.6, 1.6, 105.3], 0, 0.3)).toBe('glimmerwick');
  expect(await walk(page, [0, 0, 105.5], 0, 0.6).then((p) => p.z)).toBeGreaterThan(108);
  expect(await signal(page, 'ex-l4')).toBe(false);
  expect(await castAt(page, [1, 0, 109.5], [-2.4, 1.6, 108.8], 0, 0.3)).toBe('glimmerwick');
  const through = await walk(page, [0, 0, 109.5], 0, 1);
  expect(through.z).toBeGreaterThan(112.5);
  // Nobody gets shut in: with both out, the near lamp still opens the wall from the far side.
  await page.evaluate(() => window.__tw.advance(10));
  expect(await walk(page, [0, 0, 109.5], Math.PI, 0.6).then((p) => p.z)).toBeGreaterThan(107.4);
  expect(await castAt(page, [1, 0, 109.5], [-2.4, 1.6, 108.8], 0, 0.3)).toBe('glimmerwick');
  expect(await walk(page, [0, 0, 109.5], Math.PI, 0.8).then((p) => p.z)).toBeLessThan(106.5);
});

test('V. Ashcombe: burn the weeds and the rope, then four braziers in order', async ({ page, browserName }) => {
  await exams(page);
  for (const [x, z] of [
    [-4, 119.5],
    [4, 121.5],
    [-0.5, 124.5],
  ]) {
    expect(await castAt(page, [x * 0.3, 0, 115.5], [x, 1, z], 0, 2)).toBe('cindersnap');
  }
  expect(await castAt(page, [0, 0, 122], [1.7, 2.4, 126.4], 0, 3)).toBe('cindersnap');
  const over = await walk(page, [0, 0, 124], 0, 1.4);
  expect(over.z).toBeGreaterThan(131.5);
  expect(over.y).toBeGreaterThan(-0.1);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2.5, 0, 115, 0.1);
    tw.setCamera(0.1, 0.35);
    tw.advance(0.2);
  });
  await shot(page, 'm14-ashcombe', browserName);
  // Out of order: they all go out.
  expect(await castAt(page, [-6, 0, 132], [-8.5, 1, 133], 0, 0.3)).toBe('cindersnap');
  await castAt(page, [-6, 0, 136.8], [-8.5, 1, 136.5], 0, 0.6);
  expect(await signal(page, 'ex-b1')).toBe(false);
  await page.evaluate(() => window.__tw.advance(2));
  for (const [from, at] of [
    [[-6, 0, 132], [-8.5, 1, 133]],
    [[6, 0, 136.8], [8.5, 1, 136.5]],
    [[-6, 0, 136.8], [-8.5, 1, 136.5]],
    [[6, 0, 132], [8.5, 1, 133]],
  ] as [[number, number, number], [number, number, number]][]) {
    await castAt(page, from, at, 0, 0.3);
  }
  expect(await signal(page, 'ex-b4')).toBe(true);
  expect((await walk(page, [0, 0, 136.6], 0, 0.8)).z).toBeGreaterThan(138.5);
});

test('VI. Coldharbour: shatter the crabs, shove the floe, a charged freeze, the gate crab', async ({ page, browserName }) => {
  await exams(page);
  // Freeze the first crab, then knock it to pieces.
  expect(await castAt(page, [-5, 0, 140.6], [-5, -0.3, 143.8], 0, 0.3)).toBe('rimewhistle');
  expect(await castAt(page, [-5, 0, 140.6], [-5, -0.3, 143.8], 0, 0.8)).toBe('thwackwort');
  expect(await castAt(page, [-5, -0.3, 143.8], [-3, -0.3, 146.2], 0, 0.3)).toBe('rimewhistle');
  expect(await castAt(page, [-5, -0.3, 143.8], [-3, -0.3, 146.2], 0, 0.8)).toBe('thwackwort');
  expect(await signal(page, 'ex-crab2')).toBe(true);
  // Hop the stones to the island.
  const island = await walk(page, [-3, -0.3, 146.2], 0, 0.6);
  expect(island.y).toBeGreaterThan(-0.1);
  expect(island.z).toBeGreaterThan(147.9);
  // The floe, knocked north from the bank, stops at the post beside the island.
  expect(await castAt(page, [1.2, 0, 141], [1.2, -0.3, 146.4], 1.2, 3)).toBe('thwackwort');
  const floe = await page.evaluate(() => (window.__tw.game as unknown as G).world.entities.find((e) => e.constructor.name === 'Floe')!.pos!.z);
  expect(floe).toBeGreaterThan(151.8);
  expect(floe).toBeLessThan(152.8);
  const onFloe = await walk(page, [-1.2, 0, 150.6], Math.PI / 2 - 0.5, 0.5);
  expect(onFloe.x).toBeGreaterThan(0);
  expect(onFloe.y).toBeGreaterThan(-0.6);
  // A charged freeze carries you over to the bank.
  expect(await castAt(page, [0.8, -0.2, 152.4], [0.8, -0.5, 156], 1.2, 0.3)).toBe('rimewhistle');
  const bank = await walk(page, [0.8, -0.2, 152.4], 0, 1.6);
  expect(bank.z).toBeGreaterThan(158.2);
  expect(bank.y).toBeGreaterThan(-0.1);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6, 0, 140.5, 0.4);
    tw.setCamera(0.4, 0.4);
    tw.advance(0.2);
  });
  await shot(page, 'm14-coldharbour', browserName);
  // The gate crab.
  for (let i = 0; i < 4 && !(await signal(page, 'ex-crab3')); i++) {
    await page.evaluate(() => {
      const tw = window.__tw;
      const c = (tw.game as unknown as G).world.entities.find((e) => e.constructor.name === 'EmberCrab' && e.pos && e.pos.z > 159);
      if (!c?.pos) return;
      tw.teleport(c.pos.x - 3, 0, 159.2, 0);
      tw.advance(0.1);
      tw.aimAt(c.pos.x, c.pos.y + 0.3, c.pos.z);
      tw.advance(0.05);
      tw.cast(0);
      tw.advance(0.6);
    });
  }
  expect(await signal(page, 'ex-crab3')).toBe(true);
});

test('VII. Underbough: the ferry under the pendulum, then call the basket up to the seal', async ({ page, browserName }) => {
  await exams(page);
  expect(await castAt(page, [-6, 0, 168.8], [-5.2, 0.6, 172.2], 0, 2.2)).toBe('thistledown');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6, 0.6, 174.7, 0);
    tw.advance(0.4);
  });
  const landing = await walk(page, [-6, 0.2, 175.6], 0, 0.25);
  expect(landing.y).toBeGreaterThan(-0.1);
  // Call the basket down from the shelf, then ride it up.
  const call = await castAt(page, [-6, 0, 177.5], [4.9, 9.6, 186.9], 0, 6);
  expect(call).toBe('thistledown');
  const ride = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-2.4, 0.5, 177.5, 0);
    tw.advance(0.3);
    tw.aimAt(-1.9, 0.6, 177.9);
    tw.advance(0.05);
    const t = tw.state().target;
    tw.cast(0);
    tw.advance(6);
    return { t, y: tw.state().feet.y };
  });
  expect(ride.t).toBe('thistledown');
  expect(ride.y).toBeGreaterThan(8.8);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(8.5, 9.3, 187, 0);
    tw.advance(0.5);
  });
  expect(await signal(page, 'ex-u2')).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6, 0, 166, 0.2);
    tw.setCamera(0.2, 0.3);
    tw.advance(0.2);
  });
  await shot(page, 'm14-underbough', browserName);
});

test('the Golden Thistle ends the year: points, the House Cup, the ending', async ({ page, browserName }) => {
  await boot(page, '?test&new');
  const r = await page.evaluate(async (all) => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as G;
    g.state.house = 'nettleby';
    for (const f of ['sorted', 'greeted', 'exams-entered']) g.state.flags.add(f);
    for (const s of all) {
      tw.learn(s);
      g.state.lessons.add(s);
    }
    // Behind on points, so the Headmistress has to step in.
    g.state.housePoints.bramblecote = 900;
    // The Brass Examiner (tested on its own) already beaten: the cage over the Thistle is open.
    g.state.flags.add('down:exam-boss');
    g.state.flags.add('exam-boss-woken');
    tw.loadLevel('exams');
    await tw.idle();
    let ended = false;
    (tw.game as unknown as { events: { on(t: string, f: () => void): void } }).events.on('yearComplete', () => (ended = true));
    // The way home stays shut until the Thistle is taken.
    tw.teleport(0, 0, 205, 0);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const shutBefore = tw.state().level === 'exams';
    tw.teleport(0, 0, 196, 0);
    tw.setCamera(0, 0.15);
    tw.advance(0.3);
    tw.render();
    tw.teleport(0, 1.6, 202, 0);
    tw.advance(0.6);
    await tw.idle();
    tw.advance(0.3);
    const p = g.state.housePoints;
    return { shutBefore, ended, done: g.state.flags.has('year-complete'), mine: p.nettleby, best: Math.max(p.bramblecote, p.mallowmere, p.yarrowdown) };
  }, ALL);
  expect(r.shutBefore).toBe(true);
  expect(r.done).toBe(true);
  expect(r.ended).toBe(true);
  expect(r.mine).toBeGreaterThan(r.best);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 194, 0);
    tw.setCamera(0, 0.15);
    tw.advance(0.3);
  });
  await shot(page, 'm14-thistle-hall', browserName);
  // Home through the door behind the plinth, straight to the Lantern Hall.
  const home = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 205, 0);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    await tw.idle();
    return { level: tw.state().level, area: tw.state().area };
  });
  expect(home.level).toBe('hub');
});
