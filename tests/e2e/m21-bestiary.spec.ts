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

type V = { x: number; y: number; z: number };
type PE = { constructor: { name: string }; state?: string; pos?: V; base?: V; facing?: number; t?: number; time?: number };
const SUBJECTS: [string, string, [number, number, number], number, number][] = [
  // class, pose, room centre, camera distance, look height
  ['Gnarling', 'chase', [-12, 0, 9], 1.9, 0.45],
  ['Rattlecoat', 'approach', [15, 0, 9], 3.6, 1.2],
  ['Snapcasket', 'chase', [-9, 0, 25], 2.3, 0.45],
  ['Snapweed', 'idle', [12, 0, 25], 3.2, 1.1],
  ['EmberCrab', 'walk', [-16, 0, 41], 2.3, 0.35],
  ['Hexling', 'fly', [12, 0, 41], 2.6, 0.1],
  ['Sootling', 'idle', [-17.5, 2.2, 57], 2.2, 0.5],
  ['Examiner', 'stalk', [0, 0, 88], 9, 3],
];

// A portrait of every foe (three-quarter view, no HUD) into __shots__/renders, for art review.
test('portraits of every foe', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'art review shots: one browser is enough');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1000, height: 1000 });
  await boot(page, '?test&level=bestiary');
  await page.addStyleTag({ content: '#hud, #stats, #area-banner, .prompt, #prompt, .toasts, #toasts, #boss-bar { display: none !important; }' });
  for (const [cls, pose, room, dist, look] of SUBJECTS) {
    await page.evaluate(
      ({ cls, pose, room, dist, look }) => {
        const tw = window.__tw;
        const g = tw.game as unknown as { world: { entities: PE[]; held: Set<PE> }; renderer: { camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void }; draw(): void } };
        let e: PE | undefined;
        let best = Infinity;
        for (const c of g.world.entities) {
          const p = c.pos ?? c.base;
          if (c.constructor.name !== cls || !p) continue;
          const d = Math.hypot(p.x - room[0], p.z - room[2]);
          if (d < best) {
            best = d;
            e = c;
          }
        }
        const p = (e!.pos ?? e!.base)!;
        // A three-quarter view from the gallery side, the foe turned to face the camera.
        const side = room[0] < 0 ? 1 : room[0] > 0 ? -1 : 0;
        const a = side === 0 ? Math.PI : Math.atan2(side, 0) + (side > 0 ? -0.55 : 0.55);
        const cx = p.x + Math.sin(a) * dist;
        const cz = p.z + Math.cos(a) * dist;
        tw.teleport(p.x + Math.sin(a) * (dist + 2), room[1], p.z + Math.cos(a) * (dist + 2), 0);
        e!.facing = Math.atan2(cx - p.x, cz - p.z);
        g.world.held.add(e!);
        e!.state = pose;
        for (let i = 0; i < 40; i++) tw.advance(1 / 30);
        const fy = p.y + look;
        g.renderer.camera.position.set(cx, fy + dist * 0.18, cz);
        g.renderer.camera.lookAt(p.x, fy, p.z);
        // No rune markers in a portrait.
        for (const c of g.world.entities) {
          const m = (c as unknown as { marker?: { sprite: { visible: boolean } } }).marker;
          if (m) m.sprite.visible = false;
        }
        g.renderer.draw();
      },
      { cls, pose, room, dist, look },
    );
    await page.screenshot({ path: `tests/e2e/__shots__/renders/${cls}.png` });
  }
});
