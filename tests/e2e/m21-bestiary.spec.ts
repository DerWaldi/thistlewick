import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

// The Bestiary: a dev wing off the gym with a room for every foe, a lever to drop each room's
// portcullis, a pose lectern and a reset bell. Also renders a contact sheet of every foe in
// every pose, for reviewing the art.

type E = { constructor: { name: string }; state?: string; pos?: { x: number; y: number; z: number }; base?: { x: number; y: number; z: number } };
type G = { world: { entities: E[]; held: Set<E> } };

const ROWS = [9, 25, 41, 57];

const press = (page: Page, at: [number, number, number], facing = 0) =>
  page.evaluate(
    async ({ at, facing }) => {
      const tw = window.__tw;
      tw.teleport(...at, facing);
      tw.advance(0.3);
      tw.interact();
      tw.advance(0.2);
      await tw.idle();
      return tw.state().focus;
    },
    { at, facing },
  );

test('the gym has a door into the Bestiary', async ({ page }) => {
  await boot(page, '?test&level=gym');
  const level = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.teleport(5, 0, 53.4, Math.PI);
    tw.advance(0.3);
    tw.interact();
    tw.advance(1.5);
    await tw.idle();
    return tw.state().level;
  });
  expect(level).toBe('bestiary');
});

test('a lever drops a room portcullis, the lectern holds a foe in a pose, the bell starts the room over', async ({ page }) => {
  await boot(page, '?test&level=bestiary');
  // The Rattlecoat's room (east, first row): drop the portcullis, and the way in is shut.
  await press(page, [2.6, 0, ROWS[0] + 2.8], -Math.PI / 2);
  const shut = await page.evaluate(() => {
    const tw = window.__tw;
    tw.teleport(1.5, 0, 9, Math.PI / 2);
    tw.setCamera(Math.PI / 2, 0);
    tw.input({ x: 0, y: 1 });
    tw.advance(1.5);
    tw.input(null);
    return tw.state().feet.x;
  });
  expect(shut).toBeLessThan(3.4);
  // The pose lectern: it holds the Rattlecoat in one pose after another, AI paused.
  await press(page, [2.6, 0, ROWS[0] - 2.8], -Math.PI / 2);
  await press(page, [2.6, 0, ROWS[0] - 2.8], -Math.PI / 2);
  const posed = await page.evaluate(() => {
    const tw = window.__tw;
    tw.advance(3);
    const g = tw.game as unknown as G;
    const r = g.world.entities.find((e) => e.constructor.name === 'Rattlecoat')!;
    return { state: r.state, held: g.world.held.has(r) };
  });
  expect(posed).toEqual({ state: 'approach', held: true });
  // The bell: the wing starts over at this room, every foe fresh.
  await press(page, [2.6, 0, ROWS[0] + 5.2], -Math.PI / 2);
  const after = await page.evaluate(async () => {
    const tw = window.__tw;
    tw.advance(2);
    await tw.idle();
    const g = tw.game as unknown as G;
    const r = g.world.entities.find((e) => e.constructor.name === 'Rattlecoat')!;
    return { level: tw.state().level, state: r.state, held: g.world.held.size, feet: tw.state().feet };
  });
  expect(after.level).toBe('bestiary');
  expect(after.held).toBe(0);
  expect(after.state).toBe('dormant');
  expect(after.feet.z).toBeCloseTo(ROWS[0], 0);
});

// Every foe in every pose, from the doorway of its room.
const SHEETS: { subject: string; side: -1 | 1; row: number; poses: number }[] = [
  { subject: 'Gnarling', side: -1, row: 0, poses: 7 },
  { subject: 'Rattlecoat', side: 1, row: 0, poses: 10 },
  { subject: 'Snapcasket', side: -1, row: 1, poses: 6 },
  { subject: 'Snapweed', side: 1, row: 1, poses: 5 },
  { subject: 'EmberCrab', side: -1, row: 2, poses: 4 },
  { subject: 'Hexling', side: 1, row: 2, poses: 3 },
  { subject: 'Sootling', side: -1, row: 3, poses: 3 },
];

for (const s of SHEETS) {
  test(`contact sheet: ${s.subject}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'art review shots: one browser is enough');
    await boot(page, '?test&level=bestiary');
    const z = ROWS[s.row];
    for (let i = 0; i < s.poses; i++) {
      const pose = await press(page, [s.side * 2.6, 0, z - 2.8], -s.side * (Math.PI / 2));
      await page.evaluate(
        ({ subject }) => {
          const tw = window.__tw;
          tw.advance(0.6);
          const g = tw.game as unknown as G & { renderer: { camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void }; draw(): void } };
          const e = [...g.world.held].find((x) => x.constructor.name === subject) ?? g.world.entities.find((x) => x.constructor.name === subject)!;
          const p = (e.pos ?? e.base)!;
          const dir = Math.sign(p.x) || 1;
          g.renderer.camera.position.set(p.x - dir * 4.5, Math.max(1.8, p.y + 1.2), p.z + 1.5);
          g.renderer.camera.lookAt(p.x, p.y + 0.6, p.z);
          g.renderer.draw();
        },
        { subject: s.subject },
      );
      const name = (pose ?? `${i}`).split(':')[1]?.trim().split(' ')[0] ?? `${i}`;
      await page.screenshot({ path: `tests/e2e/__shots__/bestiary-${s.subject}-${i}-${name}.png` });
    }
  });
}
