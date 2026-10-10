import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The second lesson end to end: the Long Gallery, Quince's class, the Latchkin Vaults,
// and what Latchkin opens back in the castle.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type V = { x: number; y: number; z: number };
type Ent = { constructor: { name: string }; spec?: { id?: string }; pos?: V; state?: string; isOpen?: boolean; aimPoint?(o: V): V };
type G = {
  state: { house: string | null; flags: Set<string>; lessons: Set<string>; cards: Set<string>; secrets: Set<string> };
  world: { entities: Ent[] };
  session: { world: { entities: Ent[] } };
};

/** Skip ahead: sorted, Thwackwort done; optionally Latchkin known; then load a level. */
async function prepared(page: Page, level: string, opts: { latchkin?: boolean; flags?: string[]; spawn?: string } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'nettleby';
      for (const f of ['sorted', 'lesson-started', 'practice-done', 'gorse-reward', 'quince-lesson-started', 'vault-entered', ...(opts.flags ?? [])]) g.state.flags.add(f);
      tw.learn('thwackwort');
      g.state.lessons.add('thwackwort');
      if (opts.latchkin) tw.learn('latchkin');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts },
  );
}

/** Cast at whatever's at `at` from `from` (feet), facing `facing`; returns the targeted spell. */
const castFrom = (page: Page, from: [number, number, number], facing: number, at: [number, number, number], hold = 0) =>
  page.evaluate(
    async ({ from, facing, at, hold }) => {
      const tw = window.__tw;
      tw.teleport(...from, facing);
      tw.advance(0.3);
      tw.aimAt(...at);
      tw.advance(0.05);
      const target = tw.state().target;
      tw.cast(hold);
      tw.advance(0.8);
      await tw.idle();
      return target;
    },
    { from, facing, at, hold },
  );

test('a Thwackwort on the winch raises the Long Gallery portcullis, and it stays up', async ({ page, browserName }) => {
  await prepared(page, 'hub', { spawn: 'fromClassroom' });
  expect(await castFrom(page, [37, 3, 20.5], 0, [35.6, 4.7, 22.95])).toBe('thwackwort');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(2.5);
    tw.teleport(38.5, 3, 21.5, 0);
    tw.input({ y: 1 });
    tw.advance(2);
    tw.input(null);
    const walkedIn = tw.state().area;
    tw.loadLevel('hub', 'fromClassroom');
    await tw.idle();
    tw.advance(0.3);
    tw.teleport(38.5, 3, 21.5, 0);
    tw.input({ y: 1 });
    tw.advance(2);
    tw.input(null);
    return { walkedIn, again: tw.state().area };
  });
  expect(r.walkedIn).toBe('gallery');
  expect(r.again).toBe('gallery');
  await page.evaluate(() => {
    window.__tw.teleport(38.5, 3, 25.5, 0);
    window.__tw.advance(0.4);
  });
  await shot(page, 'm6-gallery', browserName);
});

test('Quince teaches Latchkin; the barred box is opened through the bars', async ({ page, browserName }) => {
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.house = 'nettleby';
    for (const f of ['sorted', 'lesson-started', 'practice-done', 'gorse-reward']) g.state.flags.add(f);
    tw.learn('thwackwort');
    g.state.lessons.add('thwackwort');
    tw.loadLevel('quince');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('latchkin');
  // Can't leave mid-lesson.
  const stayed = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 1.4, Math.PI);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return tw.state().level;
  });
  expect(stayed).toBe('quince');
  expect(await castFrom(page, [-4, 0, 4], 0, [-4, 1.25, 6.75])).toBe('latchkin');
  expect(await castFrom(page, [3.2, 0, 4], 0, [3.2, 1.25, 6.75])).toBe('latchkin');
  expect(await castFrom(page, [-3, 0, 10.5], -Math.PI / 2, [-6.34, 1.48, 10.5])).toBe('latchkin');
  await page.evaluate(async () => {
    window.__tw.advance(0.5);
    await window.__tw.idle();
  });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const practice = g.state.flags.has('practice-latchkin');
    tw.teleport(5.3, 0, 11.2, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.level).toBe('vault');
  await shot(page, 'm6-vault-antechamber', browserName);
});

test('the Lockwork Hall: each padlock is only visible from its own spot', async ({ page, browserName }) => {
  await prepared(page, 'vault', { latchkin: true });
  expect(await castFrom(page, [0, 0, 5], 0, [0.5, 1.5, 9.28])).toBe('latchkin');
  await page.evaluate(() => window.__tw.advance(2.5));
  const P2: [number, number, number] = [-8.85, 5.2, 24.5];
  const P3: [number, number, number] = [6.32, 1.7, 28.4];
  const seen = await page.evaluate(
    ({ P2, P3 }) => {
      const tw = window.__tw;
      const look = (from: [number, number, number], at: [number, number, number], facing: number) => {
        tw.teleport(...from, facing);
        tw.advance(0.3);
        tw.aimAt(...at);
        tw.advance(0.05);
        return tw.state().target;
      };
      return {
        p2Floor: look([0, 0, 20], P2, -Math.PI / 2),
        p3Hall: look([3, 0, 25], P3, Math.PI / 2),
      };
    },
    { P2, P3 },
  );
  expect(seen.p2Floor).toBeNull();
  expect(seen.p3Hall).toBeNull();
  // Climb: floor → step block → platform.
  const top = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2.2, 0, 16, -Math.PI / 2);
    tw.advance(0.3);
    for (let i = 0; i < 40; i++) {
      if (i % 10 === 0) tw.pressJump();
      tw.input({ y: 1, jump: i % 10 < 6 });
      tw.advance(0.1);
    }
    tw.input(null);
    tw.advance(0.5);
    return tw.state().feet.y;
  });
  expect(top).toBeGreaterThan(4.3);
  expect(await castFrom(page, [-7.3, 4.4, 20], 0, P2)).toBe('latchkin');
  expect(await castFrom(page, [11.5, 0, 28.3], -Math.PI / 2, P3)).toBe('latchkin');
  expect(await castFrom(page, [0, 0, 26], 0, [-0.6, 1.5, 30.28])).toBe('latchkin');
  await page.evaluate(() => window.__tw.advance(3));
  const through = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 29, 0);
    tw.input({ y: 1 });
    tw.advance(1.5);
    tw.input(null);
    return tw.state().area;
  });
  expect(through).toBe('pantry');
  await shot(page, 'm6-pantry', browserName);
});

test('Snapcaskets: Latchkin locks them, Thwackwort finishes them, and the gate opens', async ({ page }) => {
  await prepared(page, 'vault', { latchkin: true, flags: ['vault-hint-pantry'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const snaps = () => g.session.world.entities.filter((e) => e.constructor.name === 'Snapcasket' && e.spec?.id?.match(/v-snap[123]/));
    const spells: string[] = [];
    for (const s of snaps()) {
      for (let i = 0; i < 10 && s.state !== 'gone'; i++) {
        const p = s.pos!;
        // Stand a few metres off, on whichever side has room.
        tw.teleport(p.x > 0 ? p.x - 3.5 : p.x + 3.5, 0, p.z, p.x > 0 ? Math.PI / 2 : -Math.PI / 2);
        tw.advance(0.2);
        tw.aimAt(p.x, p.y, p.z);
        tw.advance(0.05);
        spells.push(`${s.state}:${tw.state().target}`);
        tw.cast(0);
        tw.advance(0.5);
        await tw.idle();
      }
    }
    tw.advance(3);
    const gate = g.session.world.entities.find((e) => e.constructor.name === 'Gate' && (e as unknown as { spec: { pos: number[] } }).spec.pos[2] === 48.5);
    return { states: snaps().map((s) => s.state), gateOpen: gate?.isOpen, spells };
  });
  expect(r.states).toEqual(['gone', 'gone', 'gone']);
  expect(r.spells.some((s) => s.startsWith('locked:thwackwort'))).toBe(true);
  expect(r.gateOpen).toBe(true);
});

test('the pantry book opens a shelf-door to the Snapcasket card', async ({ page }) => {
  await prepared(page, 'vault', { latchkin: true, flags: ['vault-hint-pantry'] });
  expect(await castFrom(page, [-5, 0, 37.8], -Math.PI / 2, [-7.4, 1.95, 37.8])).toBe('thwackwort');
  await page.evaluate(() => window.__tw.advance(2));
  expect(await castFrom(page, [-8.2, 0, 41], -Math.PI / 2, [-9.78, 0.5, 41])).toBe('latchkin');
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.advance(1);
    tw.teleport(-9.9, 0, 41, -Math.PI / 2);
    tw.advance(1);
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(r.cards).toContain('snapcasket');
  expect(r.secrets).toContain('vault-pantry');
});

test('the Shutter Run: locks seen through open shutters, relocking, and the drawbridge', async ({ page, browserName }) => {
  await prepared(page, 'vault', { latchkin: true, flags: ['vault-hint-shutters'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const cast = (at: [number, number, number]) => {
      tw.aimAt(...at);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      return t;
    };
    tw.teleport(0, 0, 51.5, 0);
    tw.advance(0.3);
    const seenL2Closed = (() => {
      tw.aimAt(-3.2, 1.8, 59.9);
      tw.advance(0.05);
      return tw.state().target;
    })();
    const t1 = cast([-3.2, 1.8, 53.9]);
    tw.advance(1.4);
    const t2 = cast([-3.2, 1.8, 59.9]);
    tw.advance(0.6);
    // Through the first shutter; the third lock only shows through the second from here.
    // (Aiming turned the camera, and the stick is camera-relative: face up the run again.)
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(0.9);
    tw.input(null);
    tw.advance(0.3);
    const t3 = cast([3.2, 1.8, 65.9]);
    tw.advance(1.2);
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(2);
    tw.input(null);
    const past = tw.state().feet.z;
    tw.advance(6);
    const relocked = tw.signal('v-l1');
    tw.teleport(0, 0, 67.6, 0);
    tw.advance(0.3);
    const t4 = cast([3.88, 2.4, 70.5]);
    tw.advance(3);
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(3);
    tw.input(null);
    return { seenL2Closed, t1, t2, t3, past, relocked, t4, end: tw.state().feet, area: tw.state().area };
  });
  expect(r.seenL2Closed).toBeNull();
  expect([r.t1, r.t2, r.t3, r.t4]).toEqual(['latchkin', 'latchkin', 'latchkin', 'latchkin']);
  expect(r.past).toBeGreaterThan(66.6);
  expect(r.relocked).toBe(false);
  expect(r.end.y).toBeGreaterThan(-0.2);
  expect(r.area).toBe('great');
  await shot(page, 'm6-great-vault', browserName);
});

test('the Great Vault: four riding padlocks open the door, and the Star ends the lesson', async ({ page, browserName }) => {
  await prepared(page, 'vault', { latchkin: true, flags: ['vault-hint-great', 'vault-hint-strongroom'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const locks = g.session.world.entities.filter((e) => e.constructor.name === 'Padlock' && e.spec?.id?.startsWith('v-w'));
    const hits: (string | null)[] = [];
    // Stand back in the room and catch each lock as it comes round.
    tw.teleport(0, 0, 82, 0);
    tw.advance(0.3);
    for (let tries = 0; tries < 12 && locks.some((l) => !(l as unknown as { open: boolean }).open); tries++) {
      const l = locks.find((k) => !(k as unknown as { open: boolean }).open)!;
      const p = l.pos!;
      tw.aimAt(p.x, p.y, p.z);
      tw.advance(0.05);
      hits.push(tw.state().target);
      tw.cast(0);
      tw.advance(0.8);
    }
    const allOpen = locks.every((l) => (l as unknown as { open: boolean }).open);
    tw.advance(4);
    // Through the vault door; the Strongroom beyond has its own test.
    tw.teleport(0, 0, 90, 0);
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.2);
    tw.input(null);
    const through = tw.state().feet.z > 93;
    // (The Strongroom and the Counting House have their own tests.)
    tw.teleport(0, 0, 156, 0);
    tw.input({ y: 1 });
    tw.advance(1.2);
    tw.input(null);
    await tw.idle();
    tw.advance(0.5);
    return { hits, allOpen, lessons: [...g.state.lessons], z: tw.state().feet.z, through };
  });
  expect(r.allOpen).toBe(true);
  expect(r.hits.length).toBeLessThanOrEqual(6);
  expect(r.through).toBe(true);
  expect(r.z).toBeGreaterThan(156.5);
  expect(r.lessons).toContain('latchkin');
  await shot(page, 'm6-star-chamber', browserName);
});

test('Latchkin opens the castle: court chest, hall cabinet, gallery store-room (remembered)', async ({ page, browserName }) => {
  await prepared(page, 'hub', { latchkin: true, flags: ['greeted', 'on:hub-portcullis'] });
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    g.state.lessons.add('latchkin');
  });
  expect(await castFrom(page, [-11.2, 0, 60], -Math.PI / 2, [-13.72, 0.5, 60])).toBe('latchkin');
  await page.evaluate(() => {
    window.__tw.advance(1);
    window.__tw.teleport(-13.3, 0, 60, -Math.PI / 2);
    window.__tw.advance(1);
  });
  expect(await castFrom(page, [9, 0, 19.6], Math.PI / 2, [11.18, 1.1, 19.6])).toBe('latchkin');
  await page.evaluate(() => {
    window.__tw.advance(1);
    window.__tw.teleport(10.8, 0, 19.6, Math.PI / 2);
    window.__tw.advance(1);
  });
  await shot(page, 'm6-cabinet', browserName);
  expect(await castFrom(page, [40, 3, 35.5], Math.PI / 2, [42.3, 4.5, 36.2])).toBe('latchkin');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(3);
    tw.teleport(44.5, 3, 35.5, Math.PI / 2);
    tw.advance(0.5);
    const inside = tw.state().area;
    tw.loadLevel('hub', 'fromQuince');
    await tw.idle();
    tw.advance(0.3);
    tw.teleport(40.5, 3, 35.5, Math.PI / 2);
    tw.input({ y: 1 });
    tw.advance(2);
    tw.input(null);
    return { cards: tw.state().cards, secrets: tw.state().secrets, inside, again: tw.state().feet.x };
  });
  expect(r.cards).toEqual(expect.arrayContaining(['lumley-lockjaw', 'brass-mouse']));
  expect(r.secrets).toContain('hub-storeroom');
  expect(r.inside).toBe('gallery');
  expect(r.again).toBeGreaterThan(43);
});

test('Quince hands out her card once the Vaults are done, and the Vault door stays shut', async ({ page }) => {
  await prepared(page, 'quince', { latchkin: true, flags: ['practice-latchkin'] });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.lessons.add('latchkin');
    tw.teleport(0, 0, 9.4, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.teleport(5.3, 0, 11.2, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { cards: [...g.state.cards], level: tw.state().level };
  });
  expect(r.cards).toContain('ottoline-quince');
  expect(r.level).toBe('quince');
});
