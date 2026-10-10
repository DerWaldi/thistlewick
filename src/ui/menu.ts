import { CARDS } from '../data/cards';
import { SPEAKERS } from '../data/characters';
import { currentObjective } from '../data/objectives';
import { QUESTS, questStage } from '../data/quests';
import { HOUSES, type HouseId } from '../data/houses';
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

  /** The credits with the end-of-year summary on top; Back leads to the pause menu. */
  showEnding(s: GameState): void {
    const order = Object.keys(HOUSES).sort((a, b) => s.housePoints[b as HouseId] - s.housePoints[a as HouseId]) as HouseId[];
    $('year-end-cup').textContent = `House Cup: ${HOUSES[order[0]].name}, with ${s.housePoints[order[0]]} points.`;
    $('year-end-stats').textContent = `Cards ${s.cards.size} of ${CARDS.length} · Secrets ${s.secrets.size} · Stars ${s.lessons.size + (s.flags.has('year-complete') ? 1 : 0)} of 8 · Sweets ${s.sweets}`;
    $('year-end').classList.remove('hidden');
    this.previous = 'pause';
    this.show('credits');
  }

  hide(): void {
    $('year-end').classList.add('hidden');
    this.screen = null;
    this.root.classList.remove('show');
  }

  private renderProgress(s: GameState): void {
    const house = s.house ? `${HOUSES[s.house].name}: ${s.housePoints[s.house]} points · ` : '';
    const goal = currentObjective(s);
    ($('pause-goal').querySelector('b') as HTMLElement).textContent = `Next: ${goal.title}.`;
    ($('pause-goal').querySelector('span') as HTMLElement).textContent = goal.detail;
    $('pause-progress').textContent = `${house}Cards ${s.cards.size}/${CARDS.length} · Secrets ${s.secrets.size} · Sweets ${s.sweets}`;
    // The errand log: open ones first, with where to look; finished ones ticked off.
    const list = $('pause-quests');
    list.replaceChildren();
    const quests = QUESTS.map((q) => ({ q, stage: questStage(s, q) })).filter(({ stage }) => stage === 'active' || stage === 'found' || stage === 'done');
    quests.sort((a, b) => Number(a.stage === 'done') - Number(b.stage === 'done'));
    for (const { q, stage } of quests) {
      const li = document.createElement('li');
      li.className = stage === 'done' ? 'done' : '';
      const title = document.createElement('b');
      title.textContent = q.title;
      li.append(title, ' ', stage === 'done' ? 'Done.' : stage === 'found' ? `Found it: take it back to ${SPEAKERS[q.giver].name}.` : q.goal);
      list.append(li);
    }
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
    $('opt-guide').addEventListener('change', (e) => {
      o.guide = (e.target as HTMLInputElement).checked;
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
    ($('opt-guide') as HTMLInputElement).checked = o.guide;
    ($('opt-quality') as HTMLSelectElement).value = o.quality;
  }
}
