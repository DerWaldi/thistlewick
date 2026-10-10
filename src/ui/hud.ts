import { SPELLS } from '../data/spells';
import { SWEETS } from '../data/sweets';
import type { EventBus } from '../engine/events';
import type { Caster } from '../spells/caster';
import type { GameState } from '../state/gameState';

const $ = (id: string) => document.getElementById(id)!;

/** DOM overlay: stamina pips, sweets counter, target hint, charge ring and toasts. */
export class Hud {
  private stamina = $('hud-stamina');
  private sweetsChip = $('hud-sweets');
  private sweetsN = $('hud-sweets-n');
  private target = $('hud-target');
  private ring = $('charge-ring');
  private crosshair = $('crosshair');
  private toasts = $('toasts');
  private hurt = $('hurt-flash');
  private shownStamina = -1;
  private shownMax = -1;
  private shownSweets = -1;
  private shownTarget = '';

  constructor(
    private state: GameState,
    private caster: Caster,
    events: EventBus,
  ) {
    $('hud').classList.remove('hidden');
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
  }

  toast(text: string, kind: 'info' | 'hint' = 'info'): void {
    // Don't stack the same message.
    for (const el of Array.from(this.toasts.children)) if (el.textContent === text && !el.classList.contains('out')) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2700);
  }

  update(): void {
    const s = this.state;
    if (s.stamina !== this.shownStamina || s.maxStamina !== this.shownMax) {
      const lost = s.stamina < this.shownStamina;
      this.stamina.innerHTML = '';
      for (let i = 0; i < s.maxStamina; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip' + (i >= s.stamina ? ' empty' : '') + (lost && i === s.stamina ? ' lost' : '');
        this.stamina.appendChild(pip);
      }
      this.shownStamina = s.stamina;
      this.shownMax = s.maxStamina;
    }
    if (s.sweets !== this.shownSweets) {
      this.sweetsN.textContent = String(s.sweets);
      this.shownSweets = s.sweets;
    }

    const t = this.caster.current;
    let html = '';
    if (t) {
      const def = SPELLS[t.spell];
      html = this.caster.currentUnknown
        ? `<span class="unknown">${def.name} — not learned yet</span>`
        : `<span style="color:${def.color}">${def.name}</span>`;
    }
    if (html !== this.shownTarget) {
      if (html) this.target.innerHTML = html;
      this.target.classList.toggle('show', !!html);
      this.shownTarget = html;
    }
    this.crosshair.classList.toggle('locked', !!t && !this.caster.currentUnknown);

    const charging = this.caster.charging;
    this.ring.classList.toggle('show', charging);
    if (charging) {
      this.ring.style.setProperty('--p', this.caster.charge.toFixed(3));
      if (t) this.ring.style.setProperty('--c', SPELLS[t.spell].color);
      this.ring.classList.toggle('full', this.caster.charge >= 1);
    }
  }
}
