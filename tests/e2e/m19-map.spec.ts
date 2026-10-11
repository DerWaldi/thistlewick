import { expect, test } from '@playwright/test';
import { boot, shot } from './helpers';

// Snoop's Map: the atlas of cards and secrets must match the levels, and the map shows it.

test("the atlas matches every level's placed cards and secrets", async ({ page }) => {
  await boot(page, '?test&level=gym');
  const r = await page.evaluate(async () => {
    const imp = (p: string) => import(/* @vite-ignore */ p);
    const { LEVELS } = await imp('/src/data/levels/index.ts');
    const { LevelBuilder } = await imp('/src/world/builder.ts');
    const { Physics } = await imp('/src/engine/physics.ts');
    const { ATLAS } = await imp('/src/data/atlas.ts');
    const { Group } = await imp('/node_modules/.vite/deps/three.js');
    type Spec = { type: string; card?: string; id?: string };
    const live: Record<string, string[]> = {};
    for (const [id, def] of Object.entries(LEVELS) as [string, { sandbox?: boolean; build(b: unknown): void }][]) {
      if (def.sandbox || id === 'gym') continue;
      const b = new LevelBuilder(new Group(), new Physics(), id);
      def.build(b);
      const refs = (b.entities as Spec[]).flatMap((s) => (s.type === 'card' ? [s.card!] : s.type === 'chest' && s.card ? [s.card] : s.type === 'secret' ? [s.id!] : []));
      if (refs.length) live[id] = refs.sort();
    }
    const atlas: Record<string, string[]> = {};
    for (const l of ATLAS as { level: string; cards: { ref: string }[]; secrets: { ref: string }[] }[]) atlas[l.level] = [...l.cards, ...l.secrets].map((x) => x.ref).sort();
    return { live, atlas };
  });
  expect(r.atlas).toEqual(r.live);
});

test("Snoop's Map can be bought, and lists what's still hiding room by room", async ({ page, browserName }) => {
  await boot(page, '?test&new');
  const r = await page.evaluate(async () => {
    const tw = window.__tw;
    await tw.idle();
    const g = tw.game as unknown as { state: { sweets: number; upgrades: Set<string>; cards: Set<string>; secrets: Set<string>; buy(i: unknown): boolean }; options: unknown };
    const { SHOP_ITEMS } = await import(/* @vite-ignore */ '/src/data/shop.ts' as string);
    const map = (SHOP_ITEMS as { ref: string }[]).find((i) => i.ref === 'snoops-map')!;
    g.state.sweets = 1000;
    const bought = g.state.buy(map);
    g.state.cards.add('pellam-fogg');
    g.state.secrets.add('hub-tapestry');
    const { Menu } = await import(/* @vite-ignore */ '/src/ui/menu.ts' as string);
    const menu = new Menu(g.options);
    menu.show('pause', { state: g.state });
    const button = !document.querySelector('[data-action="map"]')!.classList.contains('hidden');
    menu.show('map', { state: g.state });
    const text = document.getElementById('map-list')!.textContent ?? '';
    return { bought, button, text };
  });
  expect(r.bought).toBe(true);
  expect(r.button).toBe(true);
  expect(r.text).toContain('The Lantern Hall');
  expect(r.text).toMatch(/Thistlewick Castle.*secrets 1\//);
  expect(r.text).toContain('Teachers, errands and the Cupboard');
  await page.screenshot({ path: `tests/e2e/__shots__/${browserName}-m19-map.png` });
  void shot;
});
