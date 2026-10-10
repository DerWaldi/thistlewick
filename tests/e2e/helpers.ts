import type { Page } from '@playwright/test';

export interface TwState {
  mode: string;
  grounded: boolean;
  feet: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  facing: number;
  camera: { x: number; y: number; z: number; yaw: number; pitch: number };
  cameraInsideSolid: boolean;
  fps: number;
  stamina: number;
  sweets: number;
  target: string | null;
  targetUnknown: boolean;
  charging: boolean;
  checkpoint: [number, number, number] | null;
  level: string;
  area: string | null;
  house: string | null;
  housePoints: Record<string, number>;
  cards: string[];
  secrets: string[];
  known: string[];
  focus: string | null;
  dialogueOpen: boolean;
}

/** Shape of `window.__tw` as seen from tests (see src/main.ts). */
export interface TwApi {
  state(): TwState;
  input(v: { x?: number; y?: number; jump?: boolean } | null): void;
  pressJump(): void;
  teleport(x: number, y: number, z: number, facing?: number): void;
  setCamera(yaw: number, pitch?: number): void;
  advance(seconds: number): void;
  aimAt(x: number, y: number, z: number): void;
  cast(hold?: number): void;
  learn(spell: string): void;
  signal(id: string): boolean;
  interact(): void;
  choose(...indices: number[]): void;
  idle(): Promise<void>;
  newGame(): void;
  continueGame(): boolean;
  save(): void;
  loadLevel(id: string, spawn?: string): void;
  render(): void;
  game: unknown;
}

declare global {
  interface Window {
    __tw: TwApi;
  }
}

/** Load the game in test mode. Default: the gym sandbox. Use '?test&new' for a fresh hub game. */
export async function boot(page: Page, query = '?test&level=gym'): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/' + query);
  await page.waitForFunction(() => !!window.__tw, null, { timeout: 30_000 });
  if (errors.length) throw new Error('Page errors: ' + errors.join('\n'));
}

export async function shot(page: Page, name: string, browserName: string): Promise<void> {
  // Tests only draw on request: draw, then let the frame reach the screen.
  await page.evaluate(() => {
    (window.__tw as unknown as { render(): void }).render();
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.screenshot({ path: `tests/e2e/__shots__/${browserName}-${name}.png` });
}
