import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The fifth lesson: the Kitchen Yard, Ashcombe's kitchen, the Overgrown Glasshouse, and
// what fire opens up back in the castle.

test.beforeEach(async ({ page }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
});

type G = {
  state: {
    house: string | null;
    flags: Set<string>;
    lessons: Set<string>;
    cards: Set<string>;
  };
  world: { entities: { constructor: { name: string }; pos?: { x: number; y: number; z: number } }[] };
};

async function prepared(page: Page, level: string, opts: { cinder?: boolean; flags?: string[]; spawn?: string; glimmerDone?: boolean } = {}): Promise<void> {
  await page.evaluate(
    async ({ level, opts }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'nettleby';
      const flags = [
        'sorted',
        'greeted',
        'lesson-started',
        'practice-done',
        'gorse-reward',
        'quince-lesson-started',
        'practice-latchkin',
        'quince-reward',
        'hopgood-lesson-started',
        'practice-springwell',
        'hopgood-reward',
        'lamplough-lesson-started',
        'practice-glimmerwick',
        'lamplough-reward',
        'ashcombe-lesson-started',
        'glasshouse-entered',
      ];
      for (const f of [...flags, ...(opts.flags ?? [])]) g.state.flags.add(f);
      for (const s of ['thwackwort', 'latchkin', 'springwell', 'glimmerwick'] as const) {
        tw.learn(s);
        if (s !== 'glimmerwick' || opts.glimmerDone !== false) g.state.lessons.add(s);
      }
      if (opts.cinder) tw.learn('cindersnap');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts },
  );
}

/** Cast at a target from where you stand; returns what was targeted. Waits for it to burn. */
const burn = (page: Page, from: [number, number, number], at: [number, number, number], wait = 2) =>
  page.evaluate(
    async ({ from, at, wait }) => {
      const tw = window.__tw;
      tw.teleport(...from, 0);
      tw.advance(0.3);
      await tw.idle();
      tw.aimAt(...at);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(0);
      tw.advance(wait);
      await tw.idle();
      return t;
    },
    { from, at, wait },
  );

/** Drop the player just above a spot: does something solid hold them there? */
const standOn = (page: Page, at: [number, number, number]) =>
  page.evaluate((at) => {
    const tw = window.__tw;
    tw.teleport(at[0], at[1] + 0.6, at[2], 0);
    tw.advance(0.6);
    return tw.state().feet.y;
  }, at);

/** Walk in a direction for a while; returns where you end up. */
const walk = (page: Page, from: [number, number, number], yaw: number, seconds: number) =>
  page.evaluate(
    async ({ from, yaw, seconds }) => {
      const tw = window.__tw;
      tw.teleport(...from, yaw);
      tw.setCamera(yaw, 0.2);
      tw.advance(0.2);
      tw.input({ x: 0, y: 1 });
      for (let t = 0; t < seconds; t += 0.25) {
        tw.advance(0.25);
        await tw.idle();
      }
      tw.input(null);
      tw.advance(0.2);
      const s = tw.state();
      return { ...s.feet, level: s.level, area: s.area, mode: s.mode, stamina: s.stamina };
    },
    { from, yaw, seconds },
  );

test('the Kitchen Yard: through the corner arch, walled in, and Ashcombe opens once Glimmerwick is passed', async ({ page, browserName }) => {
  await prepared(page, 'hub', { glimmerDone: false });
  // From the court, round the corner and through the arch.
  const into = await walk(page, [-14.5, 0, 31], Math.PI, 0.6);
  expect(into.z).toBeLessThan(30.5);
  const yard = await walk(page, [-15, 0, 28.2], -Math.PI / 2, 2);
  expect(yard.area).toBe('yard');
  // The west edge used to be open to the drop: now there's a wall all the way along.
  for (const z of [15, 22, 28, 35]) {
    const w = await walk(page, [-25, 0, z], -Math.PI / 2, 3);
    expect(w.x).toBeGreaterThan(-32.2);
    expect(w.y).toBeGreaterThan(-0.2);
  }
  const corner = await walk(page, [-17.5, 0, 28], Math.PI, 3);
  expect(corner.y).toBeGreaterThan(-0.2);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-21, 0, 28, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2 - 0.25, 0.3);
    tw.advance(0.5);
  });
  await shot(page, 'm9-kitchen-yard', browserName);
  const tryDoor = () =>
    page.evaluate(async () => {
      const tw = window.__tw;
      tw.teleport(-30.6, 0, 25, -Math.PI / 2);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    });
  expect(await tryDoor()).toBe('hub');
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('glimmerwick'));
  expect(await tryDoor()).toBe('ashcombe');
});

test('Ashcombe teaches Cindersnap: the cobweb, the rope and crate, the braziers in order', async ({ page, browserName }) => {
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.house = 'nettleby';
    for (const f of ['sorted', 'greeted']) g.state.flags.add(f);
    for (const s of ['thwackwort', 'latchkin', 'springwell', 'glimmerwick'] as const) {
      tw.learn(s);
      g.state.lessons.add(s);
    }
    tw.loadLevel('ashcombe');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('cindersnap');
  // The pantry: blocked by its cobweb until it burns.
  const blocked = await walk(page, [-4.5, 0, 14], -Math.PI / 2, 2);
  expect(blocked.x).toBeGreaterThan(-6.5);
  expect(await burn(page, [-3, 0, 14], [-6.5, 1.4, 14])).toBe('cindersnap');
  const inPantry = await walk(page, [-4.5, 0, 14], -Math.PI / 2, 1.2);
  expect(inPantry.x).toBeLessThan(-7.5);
  // The shelf is too high to jump onto from the floor.
  const jumpUp = (from: [number, number, number]) =>
    page.evaluate(async (from) => {
      const tw = window.__tw;
      tw.teleport(...from, Math.PI / 2);
      tw.setCamera(Math.PI / 2, 0.2);
      tw.advance(0.3);
      tw.input({ x: 0, y: 1, jump: true });
      tw.pressJump();
      for (let i = 0; i < 8; i++) tw.advance(0.15);
      tw.input(null);
      tw.advance(0.5);
      await tw.idle();
      return tw.state().feet.y;
    }, from);
  expect(await jumpUp([6.4, 0, 9])).toBeLessThan(0.5);
  // Burn the rope: the crate drops and becomes a step.
  expect(await burn(page, [0, 0, 8], [6.1, 4.45, 11.5], 2.5)).toBe('cindersnap');
  expect(await standOn(page, [6.1, 1.2, 11.5])).toBeGreaterThan(1.1);
  expect(await jumpUp([6.1, 1.25, 11.5])).toBeGreaterThan(2.3);
  await page.evaluate(async () => {
    window.__tw.advance(0.5);
    await window.__tw.idle();
  });
  // Braziers out of order: they all go out, and Ashcombe explains the notches.
  expect(await burn(page, [-1, 0, 15], [-5.5, 1.3, 19.8], 0.3)).toBe('cindersnap');
  expect(await page.evaluate(() => window.__tw.signal('ab2'))).toBe(false);
  await burn(page, [-1, 0, 15], [3.5, 1.3, 19.8], 0.3);
  await burn(page, [-1, 0, 15], [-5.5, 1.3, 19.8], 0.3);
  await burn(page, [-1, 0, 15], [-1, 1.3, 20], 0.3);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-1, 0, 13, 0);
    tw.setCamera(0, 0.2);
    tw.advance(0.4);
  });
  await shot(page, 'm9-braziers', browserName);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    // P1: step onto the pantry plate.
    tw.teleport(-8.4, 0, 14, 0);
    tw.advance(0.5);
    await tw.idle();
    tw.advance(0.5);
    await tw.idle();
    const g = tw.game as unknown as G;
    const lit = ['ab1', 'ab2', 'ab3'].map((s) => tw.signal(s));
    const practice = g.state.flags.has('practice-cindersnap');
    tw.teleport(8.6, 0, 17.5, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { lit, practice, level: tw.state().level };
  });
  expect(r.lit).toEqual([true, true, true]);
  expect(r.practice).toBe(true);
  expect(r.level).toBe('glasshouse');
});

test('the Briar Maze: briars bite, burn away, and Gnarlings keep clear of a lit brazier', async ({ page, browserName }) => {
  await prepared(page, 'glasshouse', { cinder: true, flags: ['glasshouse-hint-maze', 'glasshouse-hint-gnarlings'] });
  // The vines out of the shed.
  expect(await burn(page, [0, 0, 5], [0, 1.6, 8.5])).toBe('cindersnap');
  // Walking into the first briar plug hurts.
  const hurt = await walk(page, [6.5, 0, 11.5], 0, 1.5);
  expect(hurt.z).toBeLessThan(13);
  expect(hurt.stamina).toBeLessThan(5);
  // Burn the plugs and the clump; the way through opens.
  await page.evaluate(() => window.__tw.advance(2));
  expect(await burn(page, [6.5, 0, 10.5], [6.5, 1.5, 13.5])).toBe('cindersnap');
  expect((await walk(page, [6.5, 0, 11.5], 0, 0.8)).z).toBeGreaterThan(14.5);
  expect(await burn(page, [4, 0, 16], [0, 1.5, 16])).toBe('cindersnap');
  expect(await burn(page, [-4, 0, 16], [-6.5, 1.5, 18.5])).toBe('cindersnap');
  // Lane B-C: light the brazier, stand by it, and the Gnarlings won't come near.
  expect(await burn(page, [-5, 0, 20.5], [0.5, 1.3, 21], 0.5)).toBe('cindersnap');
  const near = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-0.6, 0, 21, 0);
    const before = tw.state().stamina;
    let closest = 99;
    for (let i = 0; i < 40; i++) {
      tw.advance(0.25);
      await tw.idle();
      const g = tw.game as unknown as G;
      for (const e of g.world.entities) {
        if (e.constructor.name !== 'Gnarling' || !e.pos) continue;
        closest = Math.min(closest, Math.hypot(e.pos.x - 0.5, e.pos.z - 21));
      }
    }
    return { closest, lost: before - tw.state().stamina };
  });
  expect(near.closest).toBeGreaterThan(3);
  expect(near.lost).toBe(0);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-2.5, 0, 20, 0);
    tw.setCamera(1.2, 0.25);
    tw.advance(0.3);
  });
  await shot(page, 'm9-maze', browserName);
  expect(await burn(page, [3, 0, 21], [6.5, 1.5, 23.5])).toBe('cindersnap');
  expect(await burn(page, [-3, 0, 26], [-6.5, 1.6, 28.5])).toBe('cindersnap');
  const out = await walk(page, [-6.5, 0, 26], 0, 1.2);
  expect(out.area).toBe('pond');
});

test('the Lily Pond: a rope bridge, crates dropped as stepping stones, and the secret ledge', async ({ page, browserName }) => {
  await prepared(page, 'glasshouse', { cinder: true, flags: ['glasshouse-hint-pond'] });
  // Too far to jump from the island to the far bank without the crates.
  expect(await burn(page, [0, 0, 29.5], [1.55, 2.1, 31.1], 2.5)).toBe('cindersnap');
  expect(await standOn(page, [0, 0, 33.5])).toBeGreaterThan(-0.1);
  expect(await standOn(page, [0, 0, 37.5])).toBeGreaterThan(-0.1);
  // The crate ropes are too steep to aim at from the island, but fine from the bank.
  const fromIsland = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-1, 0, 38.5, 0);
    tw.advance(0.3);
    tw.aimAt(-1, 4.4, 40.3);
    tw.advance(0.05);
    return tw.state().camera.pitch;
  });
  expect(fromIsland).toBeLessThan(0.6);
  expect(await burn(page, [-1, 0, 30], [-1, 4.4, 40.3], 2.5)).toBe('cindersnap');
  expect(await burn(page, [1, 0, 30], [1, 4.4, 42.6], 2.5)).toBe('cindersnap');
  expect(await standOn(page, [-1, 0.2, 40.3])).toBeGreaterThan(0);
  expect(await standOn(page, [1, 0.2, 42.6])).toBeGreaterThan(0);
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 30, 0);
    tw.setCamera(0, 0.2);
    tw.advance(0.3);
  });
  await shot(page, 'm9-pond', browserName);
  // The secret: drop the bank crate, climb to the ledge, burn the cobweb, take the card.
  expect(await burn(page, [-4, 0, 29.5], [-8, 4.45, 30.5], 2.5)).toBe('cindersnap');
  expect(await standOn(page, [-8, 1.2, 30.5])).toBeGreaterThan(1.1);
  const up = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-8, 1.25, 30.4, 0);
    tw.setCamera(0, 0.2);
    tw.advance(0.3);
    tw.input({ x: 0, y: 1, jump: true });
    tw.pressJump();
    for (let i = 0; i < 8; i++) tw.advance(0.15);
    tw.input(null);
    tw.advance(0.4);
    await tw.idle();
    return tw.state().feet.y;
  });
  expect(up).toBeGreaterThan(2.3);
  expect(await burn(page, [-8, 2.4, 34.5], [-9.5, 3.6, 37.5])).toBe('cindersnap');
  const found = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(-11, 2.4, 37.5, -Math.PI / 2);
    tw.advance(0.8);
    await tw.idle();
    return { cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(found.cards).toContain('ember-newt');
  expect(found.secrets).toContain('glasshouse-alcove');
});

test('the Palm House: braziers I to IV in order and in time open the gate; out of turn, all go out', async ({ page, browserName }) => {
  await prepared(page, 'glasshouse', { cinder: true, flags: ['glasshouse-hint-palm'] });
  await page.evaluate(() => {
    // Gnarlings out of the way: this test is about the braziers.
    const g = window.__tw.game as unknown as G;
    for (const e of g.world.entities) if (e.constructor.name === 'Gnarling' && e.pos) e.pos.y = -100;
  });
  const lit = () => page.evaluate(() => ['h1', 'h2', 'h3', 'h4'].map((s) => window.__tw.signal(s)));
  // Count dialogues, to see Ashcombe's hint after a wrong guess.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as { events: { on(e: string, f: (p: { open: boolean }) => void): void } };
    const w = window as unknown as { talks: number };
    w.talks = 0;
    g.events.on('dialogueOpen', ({ open }) => {
      if (open) w.talks++;
    });
  });
  // Wrong order.
  expect(await burn(page, [0, 0, 49.5], [-7, 1.3, 50.6], 0.2)).toBe('cindersnap');
  expect(await burn(page, [0, 0, 49.5], [7, 1.3, 50.6], 0.6)).toBe('cindersnap');
  expect(await lit()).toEqual([false, false, false, false]);
  expect(await page.evaluate(() => (window as unknown as { talks: number }).talks)).toBe(1);
  // From the entrance, II (NE) is hidden behind the planter.
  const hidden = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(0, 0, 49.3, 0);
    tw.advance(0.2);
    tw.aimAt(7, 1.3, 66.2);
    tw.advance(0.05);
    return tw.state().target;
  });
  expect(hidden).toBeNull();
  // The right order, moving round as you go.
  await burn(page, [0, 0, 49.5], [-7, 1.3, 50.6], 0.1);
  await burn(page, [5.2, 0, 51.5], [7, 1.3, 66.2], 0.1);
  await burn(page, [5.2, 0, 52.5], [7, 1.3, 50.6], 0.1);
  await burn(page, [5.2, 0, 65.5], [-7, 1.3, 66.2], 0.6);
  expect(await lit()).toEqual([true, true, true, true]);
  await page.evaluate(() => window.__tw.advance(1.5));
  const through = await walk(page, [0, 0, 66.5], 0, 1.2);
  expect(through.area).toBe('beds');
  await shot(page, 'm9-heart', browserName);
  // ...and once they burn out, the gate shuts again.
  await page.evaluate(() => window.__tw.advance(10));
  expect(await lit()).toEqual([false, false, false, false]);
  const shut = await walk(page, [0, 0, 66], 0, 1.5);
  expect(shut.z).toBeLessThan(68.5);
});

test('the Bramble Heart: briars too green to burn until both braziers dry them; the Star; the reward', async ({ page, browserName }) => {
  await prepared(page, 'glasshouse', { cinder: true, flags: ['glasshouse-hint-heart'] });
  // The Snapweed Beds' Gnarlings (tested on their own) out of the way.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as G;
    for (const e of g.world.entities as unknown as { constructor: { name: string }; bitten?: () => void }[]) if (e.constructor.name === 'Gnarling') e.bitten?.();
  });
  const tryRing = () => burn(page, [0, 0, 90.5], [0, 1.6, 93.1], 2);
  expect(await tryRing()).toBeNull();
  await burn(page, [-2, 0, 90], [-5, 1.3, 91.5], 0.2);
  expect(await tryRing()).toBeNull();
  await burn(page, [2, 0, 90], [5, 1.3, 91.5], 1.5);
  expect(await tryRing()).toBe('cindersnap');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(0, 0, 94.4, 0);
    tw.advance(1);
    await tw.idle();
    tw.advance(0.5);
    const g = tw.game as unknown as G;
    const done = g.state.lessons.has('cindersnap');
    tw.teleport(0, 0, 99.3, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    const level = tw.state().level;
    // Ashcombe's reward.
    tw.teleport(0, 0, 10, Math.PI);
    tw.advance(0.3);
    tw.interact();
    await tw.idle();
    return { done, level, cards: tw.state().cards };
  });
  expect(r.done).toBe(true);
  expect(r.level).toBe('ashcombe');
  expect(r.cards).toContain('wilhelmina-ashcombe');
  await shot(page, 'm9-reward', browserName);
});

test('back in the castle: the arch vines burn for good, and the orchard shed hides a card', async ({ page, browserName }) => {
  await prepared(page, 'hub', { cinder: true });
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('cindersnap'));
  const blocked = await walk(page, [13, 0, 46], Math.PI / 2, 1.5);
  expect(blocked.x).toBeLessThan(16);
  expect(await burn(page, [12, 0, 46], [16.5, 1.75, 46])).toBe('cindersnap');
  const through = await walk(page, [13, 0, 46], Math.PI / 2, 1.8);
  expect(through.area).toBe('orchard');
  await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(18.5, 0, 42, 0);
    tw.setCamera(0.7, 0.3);
    tw.advance(0.4);
  });
  await shot(page, 'm9-orchard', browserName);
  expect(await burn(page, [20.5, 0, 51], [23.85, 1.2, 51])).toBe('cindersnap');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(26.2, 0, 51, Math.PI / 2);
    tw.advance(0.8);
    await tw.idle();
    tw.save();
    tw.loadLevel('hub', 'fromAshcombe');
    tw.advance(0.3);
    const g = tw.game as unknown as G;
    const vines = g.world.entities.filter((e) => e.constructor.name === 'Burnable').length;
    return { cards: tw.state().cards, secrets: tw.state().secrets, vines };
  });
  expect(r.cards).toContain('silas-applegarth');
  expect(r.secrets).toContain('hub-orchard-shed');
  // The arch vines and the shed's cobweb stay burnt; the yard's hay and the Well Yard's ice are left.
  expect(r.vines).toBe(3);
  // The Well Yard's gate stays shut until its frozen lock is thawed.
  const gated = await walk(page, [14.5, 0, 33], Math.PI, 2);
  expect(gated.z).toBeGreaterThan(30);
});

test('Lost & Found has the Ember Newt; the Glasshouse sandbox grants Cindersnap', async ({ page }) => {
  await prepared(page, 'hub', { cinder: true });
  const stock = await page.evaluate(() => {
    const g = window.__tw.game as unknown as G & { state: { sweets: number }; shop: { buy(id: string): boolean } };
    g.state.lessons.add('cindersnap');
    g.state.sweets = 100;
    g.shop.buy('lost-ember-newt');
    return [...g.state.cards];
  });
  expect(stock).toContain('ember-newt');
  await boot(page, '?test&level=glasshouse');
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('cindersnap');
});
