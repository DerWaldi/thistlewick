import { HOUSES } from '../data/houses';
import { SPELLS } from '../data/spells';
import { SWEETS } from '../data/sweets';
import type { EventBus } from '../engine/events';
import type { Caster } from '../spells/caster';
import type { GameState } from '../state/gameState';

const $ = (id: string) => document.getElementById(id)!;

export interface HudSources {
  state(): GameState;
  caster(): Caster | null;
  prompt(): string | null;
  secretsIn(area: string): { found: number; total: number };
  /** The next goal, and where it is relative to the camera (null when there's nothing to point at). */
  guide(): { title: string; bearing: number | null; dist: number; dy: number } | null;
}

/**
 * DOM overlay: stamina pips, sweets, house points, target hint, charge ring,
 * interact prompt, area banner and toasts.
 */
export class Hud {
  private stamina = $('hud-stamina');
  private sweetsChip = $('hud-sweets');
  private sweetsN = $('hud-sweets-n');
  private house = $('hud-house');
  private houseName = $('hud-house-name');
  private housePts = $('hud-house-pts');
  private target = $('hud-target');
  private ring = $('charge-ring');
  private crosshair = $('crosshair');
  private toasts = $('toasts');
  private hurt = $('hurt-flash');
  private banner = $('area-banner');
  private promptEl = $('interact-prompt');
  private goal = $('hud-goal');
  private goalArrow = $('hud-goal-arrow');
  private goalText = $('hud-goal-text');
  private goalDist = $('hud-goal-dist');
  private goalShown = '';
  private shown = { stamina: -1, max: -1, sweets: -1, target: '', house: '', pts: -1, prompt: '' };
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private src: HudSources,
    events: EventBus,
  ) {
    events.on('toast', ({ text, kind }) => this.toast(text, kind));
    events.on('hurt', () => {
      this.hurt.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => this.hurt.classList.remove('on')));
    });
    events.on('sweet', ({ kind }) => {
      this.sweetsChip.classList.remove('pop');
      void this.sweetsChip.offsetWidth; // restart the animation
      this.sweetsChip.classList.add('pop');
      (this.sweetsChip.querySelector('.sweet-icon') as HTMLElement).style.background =
        `radial-gradient(circle at 35% 35%, #fff, ${SWEETS[kind].color} 55%, #222)`;
    });
    events.on('points', ({ house, amount, reason }) => this.toast(`+${amount} ${HOUSES[house].name} for ${reason}`));
    events.on('areaEnter', ({ id, name }) => this.showBanner(name, this.src.secretsIn(id)));
    events.on('secret', ({ found, total }) => this.toast(`Secret found! (${found}/${total} here)`));
    events.on('dialogueOpen', ({ open }) => document.body.classList.toggle('in-dialogue', open));
  }

  setVisible(v: boolean): void {
    $('hud').classList.toggle('hidden', !v);
    $('crosshair').style.display = v ? '' : 'none';
  }

  showBanner(name: string, secrets: { found: number; total: number }): void {
    (this.banner.querySelector('.name') as HTMLElement).textContent = name;
    (this.banner.querySelector('.sub') as HTMLElement).textContent = secrets.total ? `Secrets found ${secrets.found}/${secrets.total}` : '';
    this.banner.classList.add('show');
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), 3200);
  }

  toast(text: string, kind: 'info' | 'hint' = 'info'): void {
    // Don't stack the same message.
    for (const el of Array.from(this.toasts.children)) if (el.textContent === text && !el.classList.contains('out')) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  /** The goal line under the house chip, with a compass arrow and the distance. */
  private updateGoal(): void {
    const g = this.src.guide();
    this.goal.classList.toggle('hidden', !g);
    if (!g) return;
    if (g.title !== this.goalShown) {
      this.goalText.textContent = g.title;
      this.goal.classList.remove('fresh');
      void this.goal.offsetWidth;
      this.goal.classList.add('fresh');
      this.goalShown = g.title;
    }
    this.goalArrow.style.visibility = g.bearing === null ? 'hidden' : 'visible';
    if (g.bearing !== null) this.goalArrow.style.transform = `rotate(${(-g.bearing * 180) / Math.PI}deg)`;
    const v = g.dy > 2.5 ? ' up' : g.dy < -2.5 ? ' down' : '';
    this.goalDist.textContent = g.bearing === null ? '' : `${Math.round(g.dist)} m${v}`;
  }

  update(): void {
    this.updateGoal();
    const s = this.src.state();
    const sh = this.shown;
    if (s.stamina !== sh.stamina || s.maxStamina !== sh.max) {
      const lost = s.stamina < sh.stamina;
      this.stamina.innerHTML = '';
      for (let i = 0; i < s.maxStamina; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip' + (i >= s.stamina ? ' empty' : '') + (lost && i === s.stamina ? ' lost' : '');
        this.stamina.appendChild(pip);
      }
      sh.stamina = s.stamina;
      sh.max = s.maxStamina;
    }
    if (s.sweets !== sh.sweets) {
      this.sweetsN.textContent = String(s.sweets);
      sh.sweets = s.sweets;
    }
    const houseId = s.house ?? '';
    if (houseId !== sh.house || (s.house && s.housePoints[s.house] !== sh.pts)) {
      this.house.classList.toggle('hidden', !s.house);
      if (s.house) {
        const h = HOUSES[s.house];
        this.house.style.setProperty('--hc', h.color);
        this.house.style.setProperty('--hc-trim', h.trim);
        this.houseName.textContent = h.name;
        this.housePts.textContent = String(s.housePoints[s.house]);
        sh.pts = s.housePoints[s.house];
      }
      sh.house = houseId;
    }

    const caster = this.src.caster();
    const t = caster?.current ?? null;
    let html = '';
    if (t && caster) {
      const def = SPELLS[t.spell];
      html = caster.currentUnknown
        ? `<span class="unknown">${def.name} — not learned yet</span>`
        : `<span style="color:${def.color}">${def.name}</span>`;
    }
    if (html !== sh.target) {
      if (html) this.target.innerHTML = html;
      this.target.classList.toggle('show', !!html);
      sh.target = html;
    }
    this.crosshair.classList.toggle('locked', !!t && !caster?.currentUnknown);

    const charging = !!caster?.charging;
    this.ring.classList.toggle('show', charging);
    if (charging && caster) {
      this.ring.style.setProperty('--p', caster.charge.toFixed(3));
      if (t) this.ring.style.setProperty('--c', SPELLS[t.spell].color);
      this.ring.classList.toggle('full', caster.charge >= 1);
    }

    const prompt = this.src.prompt() ?? '';
    if (prompt !== sh.prompt) {
      if (prompt) (this.promptEl.querySelector('span') as HTMLElement).textContent = prompt;
      this.promptEl.classList.toggle('show', !!prompt);
      sh.prompt = prompt;
    }
  }
}
