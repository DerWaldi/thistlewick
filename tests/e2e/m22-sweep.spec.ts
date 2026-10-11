import { expect, test } from '@playwright/test';
import { boot } from './helpers';
import type { Issue } from './sweep/lib';

// The level sweep (tests/e2e/sweep/lib.ts): every level is loaded and checked for flickering
// coplanar faces, overlapping or clipped signs, people inside the furniture and respawn spots
// without floor. Flicker over 0.25 m² fails; smaller patches are listed for information.

/** Known and fine, as `<level> <kind> @ x, y, z`, each with the reason. */
const ALLOW: Record<string, string> = {
  // The sign stands just in front of the hollow log's curved inner wall; the log's (straight,
  // invisible) collider runs under the curve, so the probe lands inside it. It looks right.
  'woods sign-clipped @ -5.94, 10.2, 81.6': 'in front of the log, inside its collider only',
};

const FLICKER_FAILS = 0.25;

test('every level passes the sweep', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'geometry checks: one browser is enough');
  test.setTimeout(300_000);
  await boot(page, '?test&level=hub');
  const report = await page.evaluate(async () => {
    const imp = (p: string) => import(/* @vite-ignore */ p);
    const { LEVELS } = await imp('/src/data/levels/index.ts');
    const { wanderers } = await imp('/src/data/students.ts');
    const { sweepLevel } = await imp('/tests/e2e/sweep/lib.ts');
    type Session = { root: unknown; physics: unknown; builder: { entities: unknown[] } };
    const game = window.__tw.game as unknown as { loadLevel(id: string, spawn: string): void; session: Session };
    const out: Record<string, Issue[]> = {};
    for (const id of Object.keys(LEVELS)) {
      game.loadLevel(id, 'default');
      window.__tw.advance(0.1);
      const s = game.session;
      const issues = sweepLevel(s.root, s.physics, LEVELS[id], [...s.builder.entities, ...wanderers(LEVELS[id])]) as Issue[];
      if (issues.length) out[id] = issues;
    }
    return out;
  });
  const failing: string[] = [];
  const minor: Record<string, number> = {};
  for (const [level, issues] of Object.entries(report)) {
    for (const i of issues) {
      const line = `${level} ${i.kind} @ ${i.at.join(', ')}`;
      if (ALLOW[line]) continue;
      const area = i.kind === 'flicker' ? Number(/([0-9.]+) m²/.exec(i.detail)?.[1] ?? 0) : Infinity;
      if (area < FLICKER_FAILS) minor[level] = (minor[level] ?? 0) + 1;
      else failing.push(`${line}: ${i.detail}`);
    }
  }
  console.log(`small coplanar patches (under ${FLICKER_FAILS} m², not failing): ${JSON.stringify(minor)}`);
  expect(failing).toEqual([]);
});
