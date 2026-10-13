import { liveKeys } from '../state/options';
import { SPEAKERS, type SpeakerId } from '../data/characters';
import type { EventBus } from '../engine/events';
import { portraitURL } from './portraits';

export interface DialogueLine {
  speaker: SpeakerId;
  text: string;
  /** Offer choices; the run resolves with the chosen index. */
  choices?: string[];
}

const CHARS_PER_SEC = 55;

/**
 * Storybook dialogue box: portrait, name, typewriter text, keyboard choices.
 * Space / Enter / E / click advance (first press finishes the line); W/S or
 * arrows move between choices, 1-4 pick directly. The mouse stays locked.
 */
export class Dialogue {
  private root = document.getElementById('dialogue')!;
  private portrait = document.getElementById('dlg-portrait') as HTMLImageElement;
  private name = document.getElementById('dlg-name')!;
  private text = document.getElementById('dlg-text')!;
  private choicesEl = document.getElementById('dlg-choices')!;
  private more = document.getElementById('dlg-more')!;
  private open = false;
  private full = '';
  private shown = 0;
  private typing = false;
  private choice = 0;
  private choices: string[] | null = null;
  private resolveLine: ((v: number | null) => void) | null = null;
  private lastBlip = 0;
  private voice = 0;
  private timer = 0;
  /** In tests, lines resolve as soon as they're shown... */
  autoAdvance = false;
  /** ...picking these choice indices in order (then 0). */
  autoChoices: number[] = [];

  constructor(
    private events: EventBus,
    private blip: (pitch: number) => void,
  ) {
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.open) return;
        const k = e.code;
        if (['Space', 'Enter', 'KeyE', 'NumpadEnter', liveKeys.interact, liveKeys.jump].includes(k)) this.press();
        else if (this.choices && (k === liveKeys.forward || k === 'ArrowUp')) this.move(-1);
        else if (this.choices && (k === liveKeys.back || k === 'ArrowDown')) this.move(1);
        else if (this.choices && /^Digit[1-9]$/.test(k)) {
          const i = Number(k.slice(5)) - 1;
          if (i < this.choices.length) {
            this.choice = i;
            this.renderChoices();
            this.press();
          }
        } else return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
    // A click or a tap anywhere advances; clicking or tapping a choice picks it. (Mice keep
    // mousedown: swallowing it is what stops the click from also casting a spell.)
    const advance = (e: MouseEvent) => {
      if (!this.open || e.button !== 0) return;
      const pick = (e.target as HTMLElement).closest?.('.dlg-choice') as HTMLElement | null;
      if (pick && this.choices) {
        if (this.typing) this.finishTyping();
        this.choice = Number(pick.dataset.i);
        this.renderChoices();
      }
      this.press();
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('mousedown', advance, true);
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'mouse') advance(e);
      },
      true,
    );
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Show lines in order. Resolves with the last choice made (or null). */
  async run(lines: DialogueLine[]): Promise<number | null> {
    this.setOpen(true);
    let last: number | null = null;
    try {
      for (const line of lines) {
        const r = await this.show(line);
        if (line.choices) last = r;
      }
    } finally {
      this.setOpen(false);
    }
    return last;
  }

  /**
   * Paint the open dialogue box onto a screenshot. The box is HTML over the WebGL canvas,
   * so a canvas grab alone misses it; this redraws it from the live layout.
   */
  drawOnto(g: CanvasRenderingContext2D, view: DOMRect, scale: number): void {
    if (!this.open) return;
    const rel = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - view.left) * scale, y: (r.top - view.top) * scale, w: r.width * scale, h: r.height * scale };
    };
    const box = rel(this.root);
    const css = getComputedStyle(this.root);
    g.save();
    g.fillStyle = css.backgroundColor || '#f3e4c4';
    g.strokeStyle = css.borderTopColor || '#c99a3e';
    g.lineWidth = Math.max(2, parseFloat(css.borderTopWidth) * scale);
    g.beginPath();
    g.roundRect(box.x, box.y, box.w, box.h, 12 * scale);
    g.fill();
    g.stroke();
    if (this.portrait.style.display !== 'none' && this.portrait.complete) {
      const p = rel(this.portrait);
      g.drawImage(this.portrait, p.x, p.y, p.w, p.h);
    }
    const textOf = (el: HTMLElement, color?: string) => {
      if (!el.textContent || el.style.display === 'none') return;
      const r = rel(el);
      const st = getComputedStyle(el);
      const size = parseFloat(st.fontSize) * scale;
      g.font = `${st.fontStyle} ${st.fontWeight} ${size}px ${st.fontFamily}`;
      g.fillStyle = color ?? st.color;
      g.textBaseline = 'top';
      const lh = (parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.3) * scale;
      let line = '';
      let y = r.y;
      for (const word of el.textContent.split(' ')) {
        const next = line ? line + ' ' + word : word;
        if (g.measureText(next).width > r.w && line) {
          g.fillText(line, r.x, y);
          line = word;
          y += lh;
        } else line = next;
      }
      g.fillText(line, r.x, y);
    };
    textOf(this.name);
    textOf(this.text);
    for (const el of Array.from(this.choicesEl.children) as HTMLElement[]) textOf(el);
    g.restore();
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.root.classList.toggle('show', open);
    this.events.emit('dialogueOpen', { open });
  }

  private show(line: DialogueLine): Promise<number | null> {
    const sp = SPEAKERS[line.speaker];
    this.portrait.src = portraitURL(sp.portrait, 120, 150);
    this.portrait.style.display = line.speaker === 'sign' ? 'none' : '';
    this.name.textContent = sp.name;
    this.name.style.display = sp.name ? '' : 'none';
    this.voice = sp.voice;
    this.full = line.text;
    this.shown = 0;
    this.typing = true;
    this.timer = 0;
    this.text.textContent = '';
    this.choices = line.choices ?? null;
    this.choice = 0;
    this.choicesEl.innerHTML = '';
    this.more.style.visibility = 'hidden';
    return new Promise((resolve) => {
      this.resolveLine = resolve;
      if (this.autoAdvance) {
        this.finishTyping();
        if (this.choices) this.choice = Math.min(this.choices.length - 1, this.autoChoices.shift() ?? 0);
        queueMicrotask(() => this.press());
      }
    });
  }

  /** Called every frame. */
  update(dt: number): void {
    if (!this.open || !this.typing) return;
    this.timer += dt;
    const target = Math.min(this.full.length, Math.floor(this.timer * CHARS_PER_SEC));
    if (target > this.shown) {
      this.shown = target;
      this.text.textContent = this.full.slice(0, this.shown);
      const ch = this.full[this.shown - 1];
      if (this.voice && ch && /[a-z0-9]/i.test(ch) && this.timer - this.lastBlip > 0.06) {
        this.lastBlip = this.timer;
        this.blip(this.voice * (0.9 + Math.random() * 0.2));
      }
    }
    if (this.shown >= this.full.length) this.finishTyping();
  }

  private finishTyping(): void {
    this.typing = false;
    this.text.textContent = this.full;
    if (this.choices) this.renderChoices();
    else this.more.style.visibility = 'visible';
  }

  private renderChoices(): void {
    this.choicesEl.innerHTML = '';
    this.choices!.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'dlg-choice' + (i === this.choice ? ' sel' : '');
      el.dataset.i = String(i);
      el.textContent = `${i + 1}. ${c}`;
      this.choicesEl.appendChild(el);
    });
  }

  /** From a gamepad: A advances (or picks), the d-pad moves between choices. */
  padButton(b: 'a' | 'up' | 'down'): void {
    if (!this.open) return;
    if (b === 'a') this.press();
    else if (this.choices) this.move(b === 'up' ? -1 : 1);
  }

  private move(d: number): void {
    if (this.typing || !this.choices) return;
    this.choice = (this.choice + d + this.choices.length) % this.choices.length;
    this.renderChoices();
  }

  private press(): void {
    if (this.typing) {
      this.finishTyping();
      return;
    }
    const r = this.resolveLine;
    this.resolveLine = null;
    r?.(this.choices ? this.choice : null);
  }

  /** Test hook: pick a choice on the current line. */
  choose(i: number): void {
    if (this.typing) this.finishTyping();
    if (this.choices) this.choice = i;
    this.press();
  }
}
