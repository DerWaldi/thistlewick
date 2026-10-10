import { expect, test, type Page } from '@playwright/test';
import { boot, shot } from './helpers';

// The next-goal line and its compass: what the story wants, and which way to walk.

type G = { state: { house: string | null; flags: Set<string>; lessons: Set<string> } };

const goal = (page: Page) =>
  page.evaluate(() => {
    window.__tw.advance(0.6);
    window.__tw.render();
    const arrow = document.getElementById('hud-goal-arrow')!;
    return {
      text: document.getElementById('hud-goal-text')!.textContent,
      dist: document.getElementById('hud-goal-dist')!.textContent,
      hidden: document.getElementById('hud-goal')!.classList.contains('hidden'),
      rot: Number(/rotate\((-?[\d.e-]+)deg\)/.exec(arrow.style.transform)?.[1] ?? NaN),
    };
  });

test('from the Sorting Lantern to Gorse, the trial and back: the goal and its compass follow the story', async ({ page, browserName }) => {
  await boot(page, '?test&new');
  await page.evaluate(() => window.__tw.idle());
  expect((await goal(page)).text).toBe('Talk to the Sorting Lantern');
  await page.evaluate(() => {
    const tw = window.__tw;
    (tw.game as unknown as G).state.house = 'bramblecote';
    (tw.game as unknown as G).state.flags.add('sorted');
    // Facing east in the hall: the corridor arch is dead ahead.
    tw.teleport(0, 0, 8, Math.PI / 2);
    tw.setCamera(Math.PI / 2, 0.1);
  });
  const g1 = await goal(page);
  expect(g1.text).toBe('Practical Charms with Professor Gorse');
  expect(Math.abs(g1.rot)).toBeLessThan(5);
  expect(g1.dist).toMatch(/^1[34] m$/);
  await shot(page, 'm16-goal', browserName);
  // Facing north (+z) instead, the arch (+x) is off to the left, and so is the arrow.
  await page.evaluate(() => window.__tw.setCamera(0, 0.1));
  expect((await goal(page)).rot).toBeLessThan(-80);
  // In the corridor, the compass moves on to the classroom door.
  await page.evaluate(() => {
    window.__tw.teleport(20, 0, 8, Math.PI / 2);
    window.__tw.setCamera(Math.PI / 2, 0.1);
  });
  expect(Number((await goal(page)).dist.split(' ')[0])).toBeGreaterThan(20);
  // Learned, practised, trial: each step changes the goal.
  const steps = await page.evaluate(async () => {
    const tw = window.__tw;
    const g = tw.game as unknown as G;
    const read = () => {
      tw.advance(0.6);
      return document.getElementById('hud-goal-text')!.textContent;
    };
    tw.loadLevel('classroom');
    await tw.idle();
    tw.learn('thwackwort');
    const practice = read();
    g.state.flags.add('practice-done');
    const trial = read();
    g.state.lessons.add('thwackwort');
    const report = read();
    g.state.flags.add('gorse-reward');
    const next = read();
    return { practice, trial, report, next };
  });
  expect(steps.practice).toBe('Practical Charms: practice');
  expect(steps.trial).toBe('The Practical Charms trial: find the Thistle Star');
  expect(steps.report).toBe('Report back to Professor Gorse');
  expect(steps.next).toBe('Locks & Latches with Madam Quince');
  // The option hides it.
  await page.evaluate(() => {
    const g = window.__tw.game as unknown as { options: { guide: boolean } };
    g.options.guide = false;
  });
  expect((await goal(page)).hidden).toBe(true);
});
