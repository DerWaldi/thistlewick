import { CARDS } from '../data/cards';
import { HOUSES } from '../data/houses';
import type { GameState } from '../state/gameState';
import type { Options } from '../state/options';

export type Screen = 'title' | 'pause' | 'options' | 'credits';
export type MenuAction = 'continue' | 'new' | 'options' | 'credits' | 'resume' | 'album' | 'quit' | 'back';

const $ = (id: string) => document.getElementById(id)!;

/** Title, pause, options and credits screens (DOM). */
export class Menu {
  private root = $('menu');
  screen: Screen | null = null;
  private previous: Screen = 'title';
  onAction: (a: MenuAction) => void = () => {};
  onOptions: (o: Options) => void = () => {};

  constructor(private options: Options) {
    this.root.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.dataset.action as MenuAction;
        if (a === 'options' || a === 'credits') {
          this.previous = this.screen ?? 'title';
          this.show(a);
        } else if (a === 'back') {
          this.show(this.previous);
        } else {
          this.onAction(a);
        }
      }),
    );
    this.bindOptions();
  }

  get isOpen(): boolean {
    return this.screen !== null;
  }

  show(screen: Screen, ctx?: { canContinue?: boolean; state?: GameState }): void {
    this.screen = screen;
    this.root.classList.add('show');
    this.root.classList.toggle('dim', screen !== 'title');
    this.root.querySelectorAll<HTMLElement>('.menu-screen').forEach((el) => el.classList.toggle('show', el.dataset.screen === screen));
    if (screen === 'title' && ctx) {
      (this.root.querySelector('[data-action="continue"]') as HTMLElement).classList.toggle('hidden', !ctx.canContinue);
    }
    if (screen === 'pause' && ctx?.state) this.renderProgress(ctx.state);
    if (screen === 'options') this.syncOptions();
  }

  hide(): void {
    this.screen = null;
    this.root.classList.remove('show');
  }

  private renderProgress(s: GameState): void {
    const house = s.house ? `${HOUSES[s.house].name}: ${s.housePoints[s.house]} points · ` : '';
    $('pause-progress').textContent = `${house}Cards ${s.cards.size}/${CARDS.length} · Secrets ${s.secrets.size} · Sweets ${s.sweets}`;
  }

  private bindOptions(): void {
    const o = this.options;
    const range = (id: string, key: 'sensitivity' | 'music' | 'sfx') =>
      $(id).addEventListener('input', (e) => {
        o[key] = Number((e.target as HTMLInputElement).value);
        this.onOptions(o);
      });
    range('opt-sens', 'sensitivity');
    range('opt-music', 'music');
    range('opt-sfx', 'sfx');
    $('opt-invert').addEventListener('change', (e) => {
      o.invertY = (e.target as HTMLInputElement).checked;
      this.onOptions(o);
    });
    $('opt-fps').addEventListener('change', (e) => {
      o.showFps = (e.target as HTMLInputElement).checked;
      this.onOptions(o);
    });
    $('opt-quality').addEventListener('change', (e) => {
      o.quality = (e.target as HTMLSelectElement).value as Options['quality'];
      this.onOptions(o);
    });
  }

  private syncOptions(): void {
    const o = this.options;
    ($('opt-sens') as HTMLInputElement).value = String(o.sensitivity);
    ($('opt-music') as HTMLInputElement).value = String(o.music);
    ($('opt-sfx') as HTMLInputElement).value = String(o.sfx);
    ($('opt-invert') as HTMLInputElement).checked = o.invertY;
    ($('opt-fps') as HTMLInputElement).checked = o.showFps;
    ($('opt-quality') as HTMLSelectElement).value = o.quality;
  }
}
