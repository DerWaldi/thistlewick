import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The fourth lesson: the Undercroft door, Lamplough's study, the Lamplit Catacombs, and
// what light reveals back in the castle.

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
};

async function prepared(
  page: Page,
  level: string,
  opts: {
    glimmer?: boolean;
    flags?: string[];
    spawn?: string;
    springwellDone?: boolean;
  } = {},
): Promise<void> {
  await page.evaluate(
    async ({ level, opts }) => {
      const tw = window.__tw;
      const g = tw.game as unknown as G;
      g.state.house = 'yarrowdown';
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
      ];
      for (const f of [...flags, 'lamplough-lesson-started', 'catacombs-entered', ...(opts.flags ?? [])]) g.state.flags.add(f);
      for (const s of ['thwackwort', 'latchkin', 'springwell'] as const) {
        tw.learn(s);
        if (s !== 'springwell' || opts.springwellDone !== false) g.state.lessons.add(s);
      }
      if (opts.glimmer) tw.learn('glimmerwick');
      tw.loadLevel(level, opts.spawn);
      await tw.idle();
      tw.advance(0.3);
    },
    { level, opts },
  );
}

/** Light a lamp from where you stand (optionally charged); returns the targeted spell. */
const light = (page: Page, from: [number, number, number], lamp: [number, number, number], hold = 0) =>
  page.evaluate(
    async ({ from, lamp, hold }) => {
      const tw = window.__tw;
      tw.teleport(...from, 0);
      tw.advance(0.3);
      await tw.idle();
      tw.aimAt(...lamp);
      tw.advance(0.05);
      const t = tw.state().target;
      tw.cast(hold);
      tw.advance(0.5);
      return t;
    },
    { from, lamp, hold },
  );

/** Drop the player just above a spot: does something solid hold them there? */
const standOn = (page: Page, at: [number, number, number]) =>
  page.evaluate((at) => {
    const tw = window.__tw;
    tw.teleport(at[0], at[1] + 0.6, at[2], 0);
    tw.advance(0.6);
    return tw.state().feet.y;
  }, at);

test('the Undercroft door, down the stair, opens once Springwell is passed', async ({ page }) => {
  await prepared(page, 'hub', { springwellDone: false });
  const tryDoor = () =>
    page.evaluate(async () => {
      const tw = window.__tw;
      tw.teleport(31.9, -8.5, 2.5, Math.PI / 2);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    });
  expect(await tryDoor()).toBe('hub');
  await page.evaluate(() => (window.__tw.game as unknown as G).state.lessons.add('springwell'));
  expect(await tryDoor()).toBe('lamplough');
});

test('Lamplough teaches Glimmerwick; light reveals steps, bridges and (charged) the far step', async ({ page, browserName }) => {
  await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.house = 'yarrowdown';
    for (const f of ['sorted', 'greeted']) g.state.flags.add(f);
    for (const s of ['thwackwort', 'latchkin', 'springwell'] as const) {
      tw.learn(s);
      g.state.lessons.add(s);
    }
    tw.loadLevel('lamplough');
    await tw.idle();
    tw.advance(0.3);
  });
  expect(await page.evaluate(() => window.__tw.state().known)).toContain('glimmerwick');
  // Unlit: the step isn't there.
  expect(await standOn(page, [-3.2, 1.1, 8])).toBeLessThan(0.5);
  expect(await light(page, [0, 0, 4], [-2.5, 2.1, 5.2])).toBe('glimmerwick');
  expect(await standOn(page, [-3.2, 1.1, 8])).toBeGreaterThan(1);
  expect(await standOn(page, [-5.2, 2.2, 8])).toBeGreaterThan(2.1);
  expect(await standOn(page, [-7.75, 3.3, 8])).toBeGreaterThan(3.2);
  // The bridge.
  expect(await light(page, [0, 0, 6], [1, 2.1, 3.5])).toBe('glimmerwick');
  expect(await standOn(page, [4.3, 0, 7])).toBeGreaterThan(-0.1);
  expect(await standOn(page, [7.75, 0, 6])).toBeGreaterThan(-0.1);
  // The far step: plain light doesn't reach it, a charged one does.
  await light(page, [-1, 0, 18], [-4, 2.1, 18.8]);
  expect(await standOn(page, [1.5, 1.2, 18.5])).toBeLessThan(0.5);
  await page.evaluate(() => window.__tw.advance(11));
  await light(page, [-1, 0, 18], [-4, 2.1, 18.8], 1);
  expect(await standOn(page, [1.5, 1.2, 18.5])).toBeGreaterThan(1.1);
  expect(await standOn(page, [6.2, 2.4, 18.5])).toBeGreaterThan(2.3);
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(0.5);
    await tw.idle();
    const g = tw.game as unknown as G;
    const practice = g.state.flags.has('practice-glimmerwick');
    tw.teleport(7.4, 0, 15, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { practice, level: tw.state().level };
  });
  expect(r.practice).toBe(true);
  expect(r.level).toBe('catacombs');
  await shot(page, 'm8-catacombs', browserName);
});

test('the Glimmer Bridge: lamp by lamp across the dark, the last stone only in a charged glow', async ({ page, browserName }) => {
  await prepared(page, 'catacombs', {
    glimmer: true,
    flags: ['catacomb-hint-bridge'],
  });
  // In the dark, the first stone isn't there: you fall (and come back to the checkpoint).
  expect(await standOn(page, [0.6, 0, 12.2])).toBeLessThan(-1);
  await page.evaluate(() => window.__tw.advance(4));
  expect(await light(page, [0, 0, 10.4], [2.6, 2.1, 10.2])).toBe('glimmerwick');
  for (const [x, z] of [
    [0.6, 12.2],
    [-0.6, 14],
    [0.3, 15.8],
  ]) {
    expect(await standOn(page, [x, 0, z])).toBeGreaterThan(-0.1);
  }
  expect(await standOn(page, [0, 0, 18])).toBeGreaterThan(-0.1);
  await light(page, [0, 0, 17.6], [0.8, 2.1, 18.4]);
  expect(await standOn(page, [-0.4, 0, 23.4])).toBeGreaterThan(-0.1);
  expect(await standOn(page, [0.7, 0, 25.2])).toBeLessThan(-1);
  await page.evaluate(() => window.__tw.advance(8));
  await light(page, [0, 0, 17.6], [0.8, 2.1, 18.4], 1);
  for (const [x, z] of [
    [-0.5, 19.8],
    [0.7, 21.6],
    [-0.4, 23.4],
    [0.7, 25.2],
    [-0.2, 27],
  ]) {
    expect(await standOn(page, [x, 0, z])).toBeGreaterThan(-0.1);
  }
  await page.evaluate(() => {
    window.__tw.teleport(0, 0, 18, 0);
    window.__tw.setCamera(0, -0.25);
    window.__tw.advance(0.3);
  });
  await shot(page, 'm8-bridge', browserName);
  // Without the charged stones the gap to the far side is too wide to jump.
  const jump = await page.evaluate(() => {
    const tw = window.__tw;
    tw.advance(9);
    tw.teleport(-0.4, 0, 22.8, 0);
    tw.setCamera(0, -0.2);
    tw.advance(0.2);
    tw.input({ y: 1 });
    tw.advance(0.15);
    tw.pressJump();
    tw.input({ y: 1, jump: true });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.5);
    return tw.state().feet;
  });
  expect(jump.z).toBeLessThan(29.2);
});

test('the Hall of False Walls: only light shows which walls lie', async ({ page }) => {
  await prepared(page, 'catacombs', {
    glimmer: true,
    flags: ['catacomb-hint-walls'],
  });
  // The Gnarlings wander at random; out of the way, so walking into walls is all that's tested.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as {
      session: {
        world: {
          entities: {
            constructor: { name: string };
            state?: string;
            root?: { visible: boolean };
          }[];
        };
      };
    };
    for (const e of g.session.world.entities)
      if (e.constructor.name === 'Gnarling') {
        e.state = 'gone';
        e.root!.visible = false;
      }
  });
  const walk = (from: [number, number, number], secs: number) =>
    page.evaluate(
      ({ from, secs }) => {
        const tw = window.__tw;
        tw.teleport(...from, 0);
        tw.setCamera(0, -0.2);
        tw.advance(0.2);
        tw.input({ y: 1 });
        tw.advance(secs);
        tw.input(null);
        return tw.state().feet.z;
      },
      { from, secs },
    );
  // Dark: the false section of the near wall is as solid as the rest.
  expect(await walk([-5, 0, 34.5], 1.2)).toBeLessThan(35.8);
  // The section's lamp, plain, lights the hall but doesn't reach it; charged, it does.
  expect(await light(page, [-2, 0, 32], [0, 2.1, 33.5])).toBe('glimmerwick');
  expect(await walk([-5, 0, 34.5], 1.2)).toBeLessThan(35.8);
  await light(page, [-2, 0, 32], [0, 2.1, 33.5], 1);
  expect(await walk([-5, 0, 34.5], 1.2)).toBeGreaterThan(36.5);
  // Middle and far walls: their lamps show them with a plain cast.
  await light(page, [-3, 0, 37.2], [-1, 2.1, 38.5]);
  expect(await walk([3, 0, 38.5], 1)).toBeGreaterThan(41.5);
  await light(page, [0, 0, 42.2], [2, 2.1, 43.5]);
  expect(await walk([-1, 0, 43.5], 1)).toBeGreaterThan(46.5);
  // The middle lamp, charged, also unmasks the west wall.
  await page.evaluate(() => window.__tw.advance(11));
  await light(page, [-3, 0, 37.2], [-1, 2.1, 38.5], 1);
  // ...and the west wall's false bit, with the card behind it. Then wait in there till the
  // lamp outside goes out: the alcove has its own lamp, so you can always get back out.
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(-6.5, 0, 39, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.6);
    tw.input(null);
    tw.advance(0.4);
    const deep = tw.state().feet.x;
    tw.advance(12);
    tw.aimAt(-10.6, 2.1, 39.6);
    tw.advance(0.05);
    const inside = tw.state().target;
    tw.cast(0);
    tw.advance(0.6);
    tw.setCamera(Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.4);
    tw.input(null);
    return { deep, inside, out: tw.state().feet.x, cards: tw.state().cards, secrets: tw.state().secrets };
  });
  expect(r.deep).toBeLessThan(-9);
  expect(r.cards).toContain('gloomwisp');
  expect(r.secrets).toContain('catacomb-alcove');
  expect(r.inside).toBe('glimmerwick');
  expect(r.out).toBeGreaterThan(-8);
});

test("Lamplough's Lantern: all four lamps at once open the gate; the Star ends the lesson", async ({ page, browserName }) => {
  await prepared(page, 'catacombs', {
    glimmer: true,
    flags: ['catacomb-hint-lantern'],
  });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    // Snapcaskets aside (they're tested elsewhere): this is about the timing.
    const g0 = tw.game as unknown as {
      session: {
        world: {
          entities: {
            constructor: { name: string };
            state?: string;
            root?: { visible: boolean };
          }[];
        };
      };
    };
    for (const e of g0.session.world.entities)
      if (e.constructor.name === 'Snapcasket') {
        e.state = 'gone';
        e.root!.visible = false;
      }
    const lampAt = (from: [number, number, number], lamp: [number, number, number]) => {
      tw.teleport(...from, 0);
      tw.advance(0.15);
      tw.aimAt(...lamp);
      tw.advance(0.05);
      tw.cast(0);
      tw.advance(0.4);
    };
    lampAt([-4, 0, 60.5], [-8.53, 2.4, 56]);
    lampAt([-4, 0, 60.5], [-8.53, 2.4, 65]);
    const halfway = tw.signal('cL1') && tw.signal('cL2');
    // Round the divider to the east half.
    lampAt([4, 0, 60.5], [8.53, 2.4, 56]);
    lampAt([4, 0, 60.5], [8.53, 2.4, 65]);
    tw.advance(2.5);
    tw.teleport(0, 0, 69, 0);
    tw.setCamera(0, -0.2);
    tw.input({ y: 1 });
    tw.advance(2.2);
    tw.input(null);
    await tw.idle();
    tw.advance(0.5);
    const g = tw.game as unknown as G;
    return { halfway, z: tw.state().feet.z, lessons: [...g.state.lessons] };
  });
  expect(r.halfway).toBe(true);
  expect(r.z).toBeGreaterThan(73);
  expect(r.lessons).toContain('glimmerwick');
  await shot(page, 'm8-star', browserName);
});

test('light in the castle: glimmer steps to a hall ledge (charged), and a false wall in the gallery', async ({ page, browserName }) => {
  await prepared(page, 'hub', { glimmer: true, flags: ['on:hub-portcullis'] });
  await light(page, [8.5, 5, 26], [10.8, 7.1, 27.5]);
  expect(await standOn(page, [10.6, 7.6, 22.4])).toBeGreaterThan(7.5);
  expect(await standOn(page, [10.6, 8.9, 20.2])).toBeLessThan(8);
  await page.evaluate(() => window.__tw.advance(9));
  await light(page, [8.5, 5, 26], [10.8, 7.1, 27.5], 1);
  expect(await standOn(page, [10.6, 8.9, 20.2])).toBeGreaterThan(8.8);
  const ledge = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(11.4, 10.3, 18.6, Math.PI);
    tw.advance(0.6);
    return {
      y: tw.state().feet.y,
      cards: tw.state().cards,
      secrets: tw.state().secrets,
    };
  });
  expect(ledge.y).toBeGreaterThan(10.1);
  expect(ledge.cards).toContain('ambrose-wick');
  expect(ledge.secrets).toContain('hub-wick-ledge');
  await shot(page, 'm8-hall-ledge', browserName);
  await light(page, [37, 3, 46.5], [37, 5.1, 48.6]);
  const niche = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(36.5, 3, 50.5, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(1.2);
    tw.input(null);
    tw.advance(0.3);
    return { x: tw.state().feet.x, secrets: tw.state().secrets };
  });
  expect(niche.x).toBeLessThan(34.2);
  expect(niche.secrets).toContain('hub-gallery-niche');
});

test('Lamplough gives his card after the Catacombs, and the Catacomb door stays shut', async ({ page }) => {
  await prepared(page, 'lamplough', {
    glimmer: true,
    flags: ['practice-glimmerwick'],
  });
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    g.state.lessons.add('glimmerwick');
    tw.teleport(-1.5, 0, 12.4, 0);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.teleport(7.4, 0, 15, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return { cards: [...g.state.cards], level: tw.state().level };
  });
  expect(r.cards).toContain('fennick-lamplough');
  expect(r.level).toBe('lamplough');
});

test('a glimmer bridge going out under you drops you in the water once, then back on solid ground', async ({ page }) => {
  await prepared(page, 'lamplough', { glimmer: true, flags: ['practice-glimmerwick-trigger'] });
  await light(page, [0, 0, 6], [1, 2.1, 3.5]);
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    // Walk out onto the bridge and wait there until the lamp burns out.
    tw.teleport(0.5, 0, 7, Math.PI / 2);
    tw.advance(0.6);
    tw.setCamera(Math.PI / 2, -0.2);
    // Dawdle along it, as you do, almost to the island.
    for (let i = 0; i < 8; i++) {
      tw.input({ y: 1 });
      tw.advance(0.1);
      tw.input(null);
      tw.advance(0.4);
    }
    const onBridge = tw.state().feet.x;
    const resets: string[] = [];
    for (let i = 0; i < 150; i++) {
      tw.advance(0.1);
      const m = tw.state().mode;
      if (m === 'reset' && resets[resets.length - 1] !== 'reset') resets.push(m);
      if (m !== 'reset' && resets[resets.length - 1] === 'reset') resets.push('back');
    }
    return { onBridge, resets, feet: tw.state().feet, mode: tw.state().mode };
  });
  expect(r.onBridge).toBeGreaterThan(4.5);
  expect(r.onBridge).toBeLessThan(6.4);
  expect(r.resets.filter((x) => x === 'reset').length).toBe(1);
  expect(r.mode).toBe('ground');
  expect(r.feet.y).toBeGreaterThan(-0.1);
  expect(r.feet.x).toBeLessThan(2);
});

test('a card missed in a finished trial turns up in the Lost & Found', async ({ page }) => {
  await prepared(page, 'hub', { glimmer: true });
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    const g = tw.game as unknown as G & { state: { sweets: number }; shop: { buy(id: string): boolean } };
    g.state.lessons.add('glimmerwick');
    g.state.sweets = 100;
    const bought = g.shop.buy('lost-gloomwisp');
    const again = g.shop.buy('lost-gloomwisp');
    return { bought, again, cards: [...g.state.cards], sweets: g.state.sweets };
  });
  expect(r.bought).toBe(true);
  expect(r.again).toBe(false);
  expect(r.cards).toContain('gloomwisp');
  expect(r.sweets).toBe(60);
});

test('sandbox runs know every spell taught up to that level', async ({ page }) => {
  await boot(page, '?test&level=catacombs');
  expect((await page.evaluate(() => window.__tw.state().known)).sort()).toEqual(['glimmerwick', 'latchkin', 'springwell', 'thwackwort']);
  await boot(page, '?test&level=vault');
  expect((await page.evaluate(() => window.__tw.state().known)).sort()).toEqual(['latchkin', 'thwackwort']);
});

test('?resetTrial makes a finished trial playable again in the save', async ({ page }) => {
  await prepared(page, 'lamplough', { glimmer: true, flags: ['practice-glimmerwick', 'catacomb-hint-walls', 'down:c-snap1'] });
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as G & { state: { collected: Set<string> } };
    g.state.lessons.add('glimmerwick');
    g.state.collected.add('catacomb-star');
    g.state.collected.add('catacombs/sweetLine3.1');
    g.state.cards.add('gloomwisp');
    window.__tw.save();
  });
  await boot(page, '?test&resetTrial=glimmerwick');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as G & { state: { collected: Set<string> } };
    tw.teleport(7.4, 0, 15, Math.PI / 2);
    tw.advance(0.2);
    tw.interact();
    await tw.idle();
    tw.advance(1.5);
    return {
      lessons: [...g.state.lessons],
      flags: [...g.state.flags],
      collected: [...g.state.collected],
      cards: [...g.state.cards],
      level: tw.state().level,
    };
  });
  expect(r.lessons).not.toContain('glimmerwick');
  expect(r.flags).not.toContain('catacomb-hint-walls');
  expect(r.flags).not.toContain('down:c-snap1');
  expect(r.collected).not.toContain('catacomb-star');
  expect(r.collected).not.toContain('catacombs/sweetLine3.1');
  expect(r.cards).toContain('gloomwisp');
  expect(r.level).toBe('catacombs');
});

test('the Undercroft stair spirals down from the Lantern Hall to Lamplough\'s door, and it gets dark', async ({ page, browserName }) => {
  await prepared(page, 'hub', { glimmer: true });
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(10.5, 0, 2.5, Math.PI / 2);
    tw.advance(0.4);
    const cx = 16.2;
    const cz = 2.5;
    const way: [number, number][] = [
      [13.4, 2.5],
      [cx - 1.8, cz],
    ];
    for (let i = 0; i < 24; i++) {
      const a = Math.PI + ((i + 1) * Math.PI) / 8;
      way.push([cx + Math.cos(a) * 1.9, cz + Math.sin(a) * 1.9]);
    }
    way.push([19, 2.5], [25, 2.5], [31, 2.5]);
    for (const [x, z] of way) {
      for (let k = 0; k < 30; k++) {
        const f = tw.state().feet;
        if (Math.hypot(x - f.x, z - f.z) < 0.45) break;
        tw.setCamera(Math.atan2(x - f.x, z - f.z), -0.2);
        tw.input({ y: 0.8 });
        tw.advance(0.05);
      }
    }
    tw.input(null);
    tw.advance(2);
    const g = tw.game as unknown as { renderer: { dark: number } };
    const down = { feet: tw.state().feet, area: tw.state().area, dark: g.renderer.dark };
    // ...and back up again, without snagging on a step.
    let stuck = 0;
    for (const [x, z] of [...way].reverse().concat([[10.5, 2.5]])) {
      for (let k = 0; k < 30; k++) {
        const f = tw.state().feet;
        if (Math.hypot(x - f.x, z - f.z) < 0.45) break;
        tw.setCamera(Math.atan2(x - f.x, z - f.z), -0.2);
        tw.input({ y: 0.8 });
        tw.advance(0.05);
        if (k === 29) stuck++;
      }
    }
    tw.input(null);
    tw.advance(0.5);
    return { ...down, up: tw.state().feet, stuck };
  });
  expect(r.stuck).toBe(0);
  expect(r.up.x).toBeLessThan(11);
  expect(r.up.y).toBeGreaterThan(-0.1);
  expect(r.feet.x).toBeGreaterThan(30);
  expect(r.feet.y).toBeLessThan(-7.3);
  expect(r.area).toBe('undercroft');
  expect(r.dark).toBeGreaterThan(0.9);
  await shot(page, 'm8-undercroft', browserName);
});

test('the nook under the Undercroft stair has a card, and no way out of the world', async ({ page }) => {
  await prepared(page, 'hub', { glimmer: true });
  const r = await page.evaluate(() => {
    const tw = window.__tw;
    // From the foot of the stair, round under it to the nook...
    tw.teleport(18.6, -7.5, 2.5, 0);
    tw.advance(0.4);
    for (const [x, z] of [
      [17.5, 4.6],
      [15.3, 4.3],
    ]) {
      for (let k = 0; k < 40; k++) {
        const f = tw.state().feet;
        if (Math.hypot(x - f.x, z - f.z) < 0.4) break;
        tw.setCamera(Math.atan2(x - f.x, z - f.z), -0.2);
        tw.input({ y: 0.8 });
        tw.advance(0.05);
      }
    }
    tw.input(null);
    tw.advance(0.5);
    const cards = tw.state().cards;
    const secrets = tw.state().secrets;
    // ...then push hard west, where the stairwell wall must hold.
    tw.teleport(14, -7.5, 2.5, -Math.PI / 2);
    tw.setCamera(-Math.PI / 2, -0.2);
    tw.input({ y: 1 });
    tw.advance(2);
    tw.input(null);
    tw.advance(0.5);
    return { cards, secrets, west: tw.state().feet };
  });
  expect(r.cards).toContain('stair-sprite');
  expect(r.secrets).toContain('hub-under-stair');
  expect(r.west.x).toBeGreaterThan(13.2);
  expect(r.west.y).toBeGreaterThan(-7.6);
});
