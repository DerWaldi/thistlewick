import { expect, test } from '@playwright/test';
import { boot } from './helpers';

// A performance budget: draw calls (shadow pass included) and triangles at each level's default
// spawn, with Fast graphics (Fancy adds about 15 draws of post-processing). The budgets are what
// the levels cost when this was written, plus about 15%, so a change that blows one up shows here.
// Raise a budget only on purpose, and say why in the commit.

const BUDGET: Record<string, { draws: number; ktris: number }> = {
  hub: { draws: 560, ktris: 315 },
  gym: { draws: 180, ktris: 20 },
  bestiary: { draws: 600, ktris: 50 },
  classroom: { draws: 150, ktris: 30 },
  trial: { draws: 310, ktris: 115 },
  quince: { draws: 160, ktris: 30 },
  vault: { draws: 370, ktris: 80 },
  hopgood: { draws: 130, ktris: 20 },
  tower: { draws: 160, ktris: 25 },
  lamplough: { draws: 165, ktris: 32 },
  catacombs: { draws: 420, ktris: 35 },
  ashcombe: { draws: 145, ktris: 36 },
  glasshouse: { draws: 480, ktris: 165 },
  grounds: { draws: 130, ktris: 190 },
  coldharbour: { draws: 120, ktris: 22 },
  cisterns: { draws: 370, ktris: 48 },
  clocktower: { draws: 65, ktris: 20 },
  underbough: { draws: 115, ktris: 22 },
  clockworks: { draws: 220, ktris: 33 },
  upper: { draws: 240, ktris: 195 },
  exams: { draws: 775, ktris: 110 },
  woods: { draws: 250, ktris: 225 },
};

test('every level stays within its draw-call and triangle budget', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one browser is enough to count draw calls');
  // Every level compiles its shaders once here; with the suite running alongside that's slow.
  test.setTimeout(480_000);
  await boot(page, '?test&level=hub');
  const cost = await page.evaluate(async (ids) => {
    type R = { renderer: { info: { render: { calls: number; triangles: number } } }; draw(): void; setQuality(q: string): void };
    const game = window.__tw.game as unknown as { loadLevel(id: string, spawn: string): void; renderer: R };
    game.renderer.setQuality('low');
    const out: Record<string, { draws: number; ktris: number }> = {};
    for (const id of ids) {
      game.loadLevel(id, 'default');
      window.__tw.advance(0.3);
      game.renderer.draw();
      game.renderer.draw();
      const r = game.renderer.renderer.info.render;
      out[id] = { draws: r.calls, ktris: Math.round(r.triangles / 1000) };
    }
    return out;
  }, Object.keys(BUDGET));
  console.log(Object.entries(cost).map(([id, c]) => `${id}: ${c.draws} draws, ${c.ktris}k triangles (budget ${BUDGET[id].draws}, ${BUDGET[id].ktris}k)`).join('\n'));
  const over = Object.entries(cost).filter(([id, c]) => c.draws > BUDGET[id].draws || c.ktris > BUDGET[id].ktris);
  expect(over).toEqual([]);
  // Every level is in the budget table.
  const { LEVELS } = await page.evaluate(async () => ({ LEVELS: Object.keys((await import(/* @vite-ignore */ '/src/data/levels/index.ts' as string)).LEVELS) }));
  expect(LEVELS.filter((id: string) => !BUDGET[id])).toEqual([]);
});
