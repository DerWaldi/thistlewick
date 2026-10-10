import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The first lesson end to end: classroom, practice, the Thwackwort Trial, reward.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string> };
  world: { entities: ({ constructor: { name: string } } & Record<string, never>)[] };
  player: { feet: { x: number; y: number; z: number }; grounded: boolean; pos: { x: number; y: number; z: number } };
};

/** Skip ahead: sorted, taught, practice done; then load a level. */
async function prepared(page: Page, level: string, extraFlags: string[] = []): Promise<void> {
  await page.evaluate(
    async ({ level, extraFlags }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'mallowmere';
      for (const f of ['sorted', 'lesson-started', 'practice-done', ...extraFlags]) g.state.flags.add(f);
      tw.learn('thwackwort');
      tw.loadLevel(level);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, extraFlags },
  );
}

test('Gorse teaches Thwackwort and three targets unlock the Trial door', async ({ page, browserName }) => {
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    tw.teleport(-4.8, 0, 9, -Math.PI / 2);
    tw.advance(0.3);
    tw.choose(1, 1, 1, 0);
    tw.interact();
    await tw.idle();
    // Up the corridor to the classroom door.
    tw.teleport(40.6, 3, 20.5, -Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    tw.advance(1);
    await tw.idle();
    tw.advance(0.3);
    const level = tw.state().level;
    const known = tw.state().known;
    const lockedBefore = !g.state.flags.has('practice-done');
    const hit = (x: number, y: number, z: number, from: [number, number, number]) => {
      tw.teleport(...from, 0);
      tw.advance(0.3);
      tw.aimAt(x, y, z);
      tw.cast(0);
      tw.advance(0.6);
    };
    hit(-5.6, 1.6, 9.8, [-3, 0, 5]);
    hit(5.6, 1.6, 9.8, [3, 0, 5]);
    hit(0, 4.9, 13.75, [0, 0, 6]);
    tw.advance(0.3);
    await tw.idle();
    return { level, known, lockedBefore, practiceDone: g.state.flags.has('practice-done') };
  });
  expect(r.level).toBe('classroom');
  expect(r.known).toContain('thwackwort');
  expect(r.lockedBefore).toBe(true);
  expect(r.practiceDone).toBe(true);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2, 0, 3, 0.3);
    tw.advance(0.6);
  });
  await shot(page, 'm3-classroom', browserName);

  const level = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(6.4, 0, 11.2, -Math.PI / 2);
    tw.advance(0.3);
    tw.interact();
    tw.advance(1);
    await tw.idle();
    tw.advance(0.3);
    return tw.state().level;
  });
  expect(level).toBe('trial');
});

test('the Shoving Room: block A bridges the pit, block B holds the gate', async ({ page, browserName }) => {
  await prepared(page, 'trial');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const step = async (fn: () => void) => {
      fn();
      await tw.idle();
    };
    await step(() => {
      tw.teleport(1, 0, 6, 0);
      tw.advance(0.3);
      tw.aimAt(3.5, 2, 9.45);
      tw.cast(0);
      tw.advance(2.5);
    });
    await step(() => {
      tw.teleport(-5.3, 0, 12, Math.PI / 2);
      tw.advance(0.3);
    });
    type B = { pos: { x: number; y: number; z: number } };
    const [A, Bk] = g.world.entities.filter((e) => e.constructor.name === 'PushBlock') as unknown as B[];
    const shove = async (from: [number, number, number, number], b: B, hold: number) =>
      step(() => {
        tw.teleport(...from);
        tw.advance(0.3);
        tw.aimAt(b.pos.x, b.pos.y, b.pos.z);
        tw.cast(hold);
        tw.advance(2);
      });
    await shove([-5.3, 0, 12, Math.PI / 2], A, 0); // east one tile
    await shove([-1, 0, 10.6, 0], A, 1.2); // charged north into the pit
    await shove([3, 0, 10.6, 0], Bk, 0); // north one tile
    await shove([0.6, 0, 14, Math.PI / 2], Bk, 1.2); // east to the wall, onto the plate
    const a = { ...A.pos };
    const plate = tw.signal('r2-plate');
    tw.advance(2);
    await step(() => {
      tw.teleport(-1, 0, 15.5, 0);
      tw.advance(0.3);
      tw.input({ y: 1 });
      for (let i = 0; i < 150; i++) {
        tw.advance(1 / 60);
        const s = tw.state();
        if (s.feet.z > 18.7 && s.grounded) {
          tw.pressJump();
          tw.input({ y: 1, jump: true });
        }
        if (s.feet.z > 27.5) break;
      }
      tw.input(null);
      tw.advance(0.3);
    });
    return { a, plate, s: tw.state() };
  });
  expect(r.a.y).toBeCloseTo(-1, 1);
  expect(r.a.z).toBeCloseTo(18, 1);
  expect(r.plate).toBe(true);
  expect(r.s.area).toBe('run');
  expect(r.s.stamina).toBe(5);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6, 0, 11.5, 0.5);
    tw.advance(0.6);
  });
  await shot(page, 'm3-shoving-room', browserName);
});

test('the bell sends misplaced blocks home', async ({ page }) => {
  await prepared(page, 'trial', ['trial-entered', 'trial-hint-blocks']);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    tw.teleport(1, 0, 6, 0);
    tw.advance(0.3);
    tw.aimAt(3.5, 2, 9.45);
    tw.cast(0);
    tw.advance(2.5);
    type B = { pos: { x: number; y: number; z: number }; home: { x: number; y: number; z: number } };
    const [, Bk] = g.world.entities.filter((e) => e.constructor.name === 'PushBlock') as unknown as B[];
    // Overshoot: charge block B straight into the pit.
    tw.teleport(3, 0, 10.6, 0);
    tw.advance(0.3);
    tw.aimAt(Bk.pos.x, Bk.pos.y, Bk.pos.z);
    tw.cast(1.2);
    tw.advance(2.5);
    const sunk = { ...Bk.pos };
    tw.teleport(-5, 0, 11.2, -Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(-7.2, 2.1, 11.2);
    tw.cast(0);
    tw.advance(0.5);
    return { sunk, back: { ...Bk.pos } };
  });
  expect(r.sunk.y).toBeLessThan(0);
  expect(r.back).toEqual({ x: 3, y: 1, z: 12 });
});

test('the Gauntlet can be run inside the timer', async ({ page, browserName }) => {
  await prepared(page, 'trial', ['trial-entered', 'trial-hint-run', 'trial-hint-garden']);
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(1.5, 0, 28.6, Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(4.0, 2, 28.6);
    tw.cast(0);
    tw.advance(0.1);
    tw.setCamera(0, -0.2);
    const fronts = [30.75, 35, 40, 45.55];
    const leads = [0.6, 0.35, 1.0, 0.6];
    let next = 0;
    let t = 0;
    tw.input({ y: 1 });
    for (let i = 0; i < 720; i++) {
      tw.advance(1 / 60);
      t += 1 / 60;
      const s = tw.state();
      if (next < fronts.length && s.feet.z > fronts[next] - leads[next] && s.grounded) {
        tw.pressJump();
        tw.input({ y: 1, jump: true });
        next++;
      } else if (s.grounded) tw.input({ y: 1 });
      if (s.feet.z > 49.5) break;
    }
    tw.input(null);
    return { t, s: tw.state() };
  });
  expect(r.s.area).toBe('garden');
  expect(r.t).toBeLessThan(8);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2.5, 0, 30, 0.2);
    tw.setCamera(0.2, -0.15);
    tw.advance(0.6);
  });
  await shot(page, 'm3-gauntlet', browserName);
});

test('the garden: hidden card up the ruin, Rattlecoat needs a charge, Star finishes the Trial', async ({ page, browserName }) => {
  await prepared(page, 'trial', ['trial-entered', 'trial-hint-garden']);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-3, 0, 64, 0.3);
    tw.advance(0.8);
  });
  await shot(page, 'm3-garden', browserName);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    type E = { pos: { x: number; y: number; z: number; set(x: number, y: number, z: number): void }; home: { z: number; set(x: number, y: number, z: number): void }; prev: { copy(v: unknown): void }; state: string; hp: number };
    const ents = g.world.entities as unknown as ({ constructor: { name: string } } & E)[];
    for (const x of ents.filter((e) => e.constructor.name === 'Gnarling')) {
      x.home.set(8, 0.5, 52);
      x.pos.set(8, 0.5, 52);
      x.prev.copy(x.pos);
    }
    // Push the garden block against the ruin, climb it, grab the top.
    const blk = ents.find((e) => e.constructor.name === 'PushBlock' && e.home.z === 57)!;
    tw.teleport(-1.6, 0, 57, -Math.PI / 2);
    tw.advance(0.3);
    tw.aimAt(blk.pos.x, blk.pos.y, blk.pos.z);
    tw.cast(1);
    tw.advance(2);
    tw.teleport(-5.6, 2, 57, -Math.PI / 2);
    tw.advance(0.4);
    tw.input({ y: 1 });
    tw.pressJump();
    tw.input({ y: 1, jump: true });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.4);
    const cards = tw.state().cards;

    // The Rattlecoat: a tap clangs, two charged shoves knock it apart.
    const rc = ents.find((e) => e.constructor.name === 'Rattlecoat')!;
    tw.teleport(0, 0, 63.2, 0);
    tw.advance(1);
    tw.aimAt(rc.pos.x, rc.pos.y + 0.4, rc.pos.z);
    tw.cast(0);
    tw.advance(0.3);
    const afterTap = rc.state;
    for (let i = 0; i < 2; i++) {
      tw.teleport(0, 0, 63, 0);
      tw.advance(0.1);
      tw.aimAt(rc.pos.x, rc.pos.y + 0.4, rc.pos.z);
      tw.cast(1);
      tw.advance(i === 0 ? 5 : 0.6);
    }
    const afterCharged = rc.state;
    tw.advance(3);
    tw.teleport(0, 0, 73.5, 0);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(0.5);
    tw.input(null);
    tw.advance(0.2);
    await tw.idle();
    return { cards, afterTap, afterCharged, lessons: [...g.state.lessons], secrets: tw.state().secrets };
  });
  expect(r.cards).toContain('gnarling');
  expect(r.secrets).toContain('trial-ruin');
  expect(r.afterTap).toBe('stagger');
  expect(r.afterCharged).toBe('collapsed');
  expect(r.lessons).toContain('thwackwort');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 73, 0);
    tw.advance(0.5);
  });
  await shot(page, 'm3-star-chamber', browserName);

  // Back up to Gorse for the reward, then the hub has changed.
  const after = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 76.3, 0);
    tw.advance(0.3);
    tw.interact();
    tw.advance(1);
    await tw.idle();
    tw.advance(0.3);
    const level = tw.state().level;
    tw.teleport(0, 0, 9.5, Math.PI);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    const cards = tw.state().cards;
    tw.loadLevel('hub', 'fromClassroom');
    tw.advance(0.3);
    const g = tw.game as unknown as G;
    const gnarlings = g.world.entities.filter((e) => e.constructor.name === 'Gnarling').length;
    return { level, cards, gnarlings, pts: tw.state().housePoints };
  });
  expect(after.level).toBe('classroom');
  expect(after.cards).toContain('agnes-thistlewick');
  expect(after.gnarlings).toBe(2);
  expect(after.pts.mallowmere).toBeGreaterThanOrEqual(95);
});

test('a beaten Rattlecoat and taken Star stay that way on a return visit', async ({ page }) => {
  await prepared(page, 'trial', ['trial-entered', 'down:rattle']);
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    (g.state as unknown as { collected: Set<string> }).collected.add('trial-star');
    tw.loadLevel('trial');
    tw.advance(1);
    return {
      rattle: g.world.entities.filter((e) => e.constructor.name === 'Rattlecoat').length,
      star: g.world.entities.filter((e) => e.constructor.name === 'ThistleStar').length,
      gate: tw.signal('rattle'),
    };
  });
  expect(r).toEqual({ rattle: 0, star: 0, gate: true });
});

test('the world holds still while someone is talking', async ({ page }) => {
  await prepared(page, 'trial', ['trial-entered']);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as { dialogue: { autoAdvance: boolean }; world: { entities: ({ constructor: { name: string } } & { pos: { x: number; z: number } })[] } };
    g.dialogue.autoAdvance = false;
    // Walk into the garden: the hint dialogue opens, with Gnarlings nearby.
    tw.teleport(0, 0, 49.6, 0);
    tw.advance(0.2);
    const gn = g.world.entities.find((e) => e.constructor.name === 'Gnarling')!;
    const before = { x: gn.pos.x, z: gn.pos.z };
    const open = tw.state().dialogueOpen;
    tw.advance(3);
    return { open, moved: Math.hypot(gn.pos.x - before.x, gn.pos.z - before.z), stamina: tw.state().stamina };
  });
  expect(r.open).toBe(true);
  expect(r.moved).toBe(0);
  expect(r.stamina).toBe(5);
});

test('checkpoints activate as you walk into a room', async ({ page }) => {
  await prepared(page, 'trial', ['trial-entered', 'trial-hint-blocks', 'trial-hint-run']);
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    // Just inside the Shoving Room and the Gauntlet, nowhere near the lecterns.
    tw.teleport(1, 0, 11, 0);
    tw.advance(0.3);
    const blocks = tw.state().checkpoint;
    tw.teleport(2.5, 0, 27, 0);
    tw.advance(0.3);
    const run = tw.state().checkpoint;
    return { blocks, run };
  });
  expect(r.blocks![2]).toBeLessThan(16);
  expect(r.blocks![2]).toBeGreaterThan(10);
  expect(r.run![2]).toBeGreaterThan(26);
});

test('the Rattlecoat comes for you and swings', async ({ page }) => {
  await prepared(page, 'trial', ['trial-entered', 'trial-hint-garden']);
  const hurt = await page.evaluate(() => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const ents = g.world.entities as unknown as ({ constructor: { name: string } } & { home: { set(x: number, y: number, z: number): void }; pos: { set(x: number, y: number, z: number): void }; prev: { copy(v: unknown): void } })[];
    for (const x of ents.filter((e) => e.constructor.name === 'Gnarling')) {
      x.home.set(8, 0.5, 52);
      x.pos.set(8, 0.5, 52);
      x.prev.copy(x.pos);
    }
    // Step into its yard and back away slowly: it should still catch you.
    tw.teleport(0, 0, 63.5, Math.PI);
    tw.input({ y: 0.25 });
    let hits = 0;
    for (let i = 0; i < 360 && hits === 0; i++) {
      tw.advance(1 / 60);
      hits = 5 - tw.state().stamina;
    }
    tw.input(null);
    return hits;
  });
  expect(hurt).toBeGreaterThan(0);
});
