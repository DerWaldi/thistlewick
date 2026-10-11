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
    // Facing west in the hall: the corridor arch is dead ahead.
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

test('the goal chain runs through all seven lessons, the exams and the errands without a gap', async ({ page }) => {
  await boot(page, '?test&new');
  const chain = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    type S = { house: string | null; flags: Set<string>; lessons: Set<string>; knows(s: string): boolean; learn(s: string): void };
    const g = tw.game as unknown as { state: S };
    const { currentObjective, compassTarget } = await import(/* @vite-ignore */ '/src/data/objectives.ts' as string);
    const s = g.state;
    s.house = 'nettleby';
    s.flags.add('sorted');
    const steps: { title: string; hub: boolean }[] = [];
    const note = () => {
      const o = currentObjective(s);
      steps.push({ title: o.title, hub: compassTarget(o, 'hub', { x: 0, y: 0, z: 5 }, true) !== null });
    };
    const lessons = [
      ['thwackwort', 'practice-done', 'gorse-reward'],
      ['latchkin', 'practice-latchkin', 'quince-reward'],
      ['springwell', 'practice-springwell', 'hopgood-reward'],
      ['glimmerwick', 'practice-glimmerwick', 'lamplough-reward'],
      ['cindersnap', 'practice-cindersnap', 'ashcombe-reward'],
      ['rimewhistle', 'practice-rimewhistle', 'coldharbour-reward'],
      ['thistledown', 'practice-thistledown', 'underbough-reward'],
    ];
    for (const [spell, practice, reward] of lessons) {
      note();
      tw.learn(spell);
      note();
      s.flags.add(practice);
      note();
      s.lessons.add(spell);
      note();
      s.flags.add(reward);
    }
    note();
    s.flags.add('year-complete');
    s.flags.add('quest:kite');
    note();
    return steps;
  });
  const titles = chain.map((c) => c.title);
  // Every lesson: with the teacher, practice, the trial, report back.
  expect(titles.filter((t) => t.startsWith('Report back')).length).toBe(7);
  expect(titles.filter((t) => t.endsWith(': practice')).length).toBe(7);
  expect(titles.filter((t) => t.includes('trial: find the Thistle Star')).length).toBe(7);
  // From the castle, every new lesson and the exams have somewhere to point.
  for (const c of chain.filter((c) => / with |Final Examinations|Report back/.test(c.title))) expect(c.hub, c.title).toBe(true);
  expect(titles).toContain('The Final Examinations');
  expect(titles[titles.length - 1]).toBe("Pip's Kite");
});
