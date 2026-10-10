import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

/** Hold forward and hop every 0.8 s for `seconds`; report where the player ends up and how high they got. */
async function hopAt(page: Page, at: [number, number, number], facing: number, seconds = 3) {
  return page.evaluate(
    async ({ at, facing, seconds }) => {
      const tw = window.__tw;
      await tw.idle();
      tw.teleport(at[0], at[1], at[2], facing);
      tw.advance(0.3);
      let maxY = -Infinity;
      for (let i = 0; i < seconds * 10; i++) {
        if (i % 8 === 0) tw.pressJump();
        tw.input({ y: 1, jump: i % 8 < 4 });
        tw.advance(0.1);
        maxY = Math.max(maxY, tw.state().feet.y);
      }
      tw.input(null);
      tw.advance(1);
      return { ...tw.state().feet, maxY, mode: tw.state().mode };
    },
    { at, facing, seconds },
  );
}

test.describe('nobody climbs out of the level', () => {
  test('the Trial garden wall is out of reach from the ruin', async ({ page }) => {
    await boot(page, '?test&level=trial');
    const p = await hopAt(page, [-9, 4.45, 57], -Math.PI / 2);
    expect(p.x).toBeGreaterThan(-10.05);
    expect(p.maxY).toBeLessThan(6.2);
  });

  test('the court side wall is out of reach from the walkway', async ({ page }) => {
    await boot(page, '?test&level=hub');
    const p = await hopAt(page, [-15, 8, 63], -Math.PI / 2);
    expect(p.maxY).toBeLessThan(10.3);
    expect(p.x).toBeGreaterThan(-16);
  });

  test('the parapet keeps you on the walkway', async ({ page }) => {
    await boot(page, '?test&level=hub');
    const p = await hopAt(page, [-8, 8, 62.9], 0);
    expect(p.z).toBeLessThan(64);
    expect(p.y).toBeGreaterThan(7.5);
  });
});

test('dressed rooms render and furniture is solid', async ({ page, browserName }) => {
  await boot(page, '?test&level=hub');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    // Drop onto the long table: its top holds you up.
    tw.teleport(8.6, 2, 14.8, 0);
    tw.advance(1);
    const onTable = tw.state().feet.y;
    tw.teleport(-2, 0, 3, 0.6);
    tw.setCamera(0.6, -0.15);
    tw.advance(0.5);
    return { onTable };
  });
  expect(r.onTable).toBeGreaterThan(0.8);
  expect(r.onTable).toBeLessThan(0.95);
  await shot(page, 'm5-hall', browserName);
});

test('the classroom keeps you in until the Trial is done', async ({ page }) => {
  await boot(page, '?test&new');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as { state: { flags: Set<string>; lessons: Set<string> } };
    g.state.flags.add('sorted');
    g.state.flags.add('lesson-started');
    tw.loadLevel('classroom');
    tw.advance(0.5);
    await tw.idle();
    const tryLeave = async () => {
      tw.teleport(0, 0, 1.4, Math.PI);
      tw.advance(0.2);
      tw.interact();
      await tw.idle();
      tw.advance(1.5);
      return tw.state().level;
    };
    const beforeLearning = await tryLeave();
    tw.learn('thwackwort');
    if (beforeLearning !== 'classroom') tw.loadLevel('classroom');
    tw.advance(0.5);
    const midLesson = await tryLeave();
    g.state.lessons.add('thwackwort');
    const afterTrial = await tryLeave();
    return { beforeLearning, midLesson, afterTrial };
  });
  expect(r.beforeLearning).toBe('hub');
  expect(r.midLesson).toBe('classroom');
  expect(r.afterTrial).toBe('hub');
});
