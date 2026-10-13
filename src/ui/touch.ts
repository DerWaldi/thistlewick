import type { Input } from '../engine/input';

/**
 * On-screen controls for phones and tablets. The left side of the screen is a floating stick
 * (it appears under your thumb); dragging anywhere else turns the camera; buttons jump, cast
 * (hold to charge), interact (only when there's something to talk to or open), open the album
 * and pause. Pointer events, so several thumbs work at once.
 */
export interface TouchHooks {
  /** What pressing interact would do right now ("Talk to Tansy"), or null. */
  prompt(): string | null;
  /** False while a menu, dialogue, the shop or the album is up: the controls hide. */
  active(): boolean;
  onPause(): void;
}

const STICK_R = 58;

export class TouchControls {
  readonly root: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly act: HTMLElement;
  private readonly actLabel: HTMLElement;
  private stickId: number | null = null;
  private stickAt = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookAt = { x: 0, y: 0 };
  private shown = { active: true, prompt: '' };

  constructor(
    private readonly input: Input,
    private readonly hooks: TouchHooks,
  ) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <button class="t-btn t-jump" aria-label="Jump"><span>⤒</span></button>
      <button class="t-btn t-cast" aria-label="Cast (hold to charge)"><span>✦</span></button>
      <button class="t-btn t-act" aria-label="Interact"><span>✋</span><small></small></button>
      <button class="t-btn t-small t-album" aria-label="Cards"><span>▤</span></button>
      <button class="t-btn t-small t-pause" aria-label="Pause"><span>❚❚</span></button>`;
    document.getElementById('ui')!.appendChild(root);
    this.root = root;
    const q = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.stick = q('.t-stick');
    this.knob = q('.t-knob');
    this.act = q('.t-act');
    this.actLabel = q('.t-act small');

    this.hold(q('.t-jump'), (down) => input.setTouchJump(down));
    this.hold(q('.t-cast'), (down) => input.setCast(down));
    this.tap(this.act, () => input.touchAction('interact'));
    this.tap(q('.t-album'), () => input.touchAction('album'));
    this.tap(q('.t-pause'), () => hooks.onPause());

    // Everything that isn't a button: the left part is the stick, the rest turns the camera.
    root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.t-btn')) return;
      e.preventDefault();
      if (e.clientX < window.innerWidth * 0.42 && this.stickId === null) {
        this.stickId = e.pointerId;
        // Not so close to the edge that the stick can't be pushed all the way.
        this.stickAt = { x: Math.max(STICK_R + 12, e.clientX), y: Math.min(window.innerHeight - STICK_R - 12, Math.max(STICK_R + 12, e.clientY)) };
        this.stick.style.left = `${this.stickAt.x}px`;
        this.stick.style.top = `${this.stickAt.y}px`;
        this.stick.classList.add('on');
        this.moveStick(e.clientX, e.clientY);
      } else if (this.lookId === null) {
        this.lookId = e.pointerId;
        this.lookAt = { x: e.clientX, y: e.clientY };
      } else return;
      capture(root, e.pointerId);
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
      else if (e.pointerId === this.lookId) {
        input.touchLook(e.clientX - this.lookAt.x, e.clientY - this.lookAt.y);
        this.lookAt = { x: e.clientX, y: e.clientY };
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null;
        this.stick.classList.remove('on');
        input.setTouchStick(0, 0);
      } else if (e.pointerId === this.lookId) this.lookId = null;
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    // No long-press menus, no text selection.
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    const frame = () => {
      this.update();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private moveStick(x: number, y: number): void {
    let dx = x - this.stickAt.x;
    let dy = y - this.stickAt.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.setTouchStick(dx / STICK_R, -dy / STICK_R);
  }

  /** A button held down while pressed (jump, cast). */
  private hold(el: HTMLElement, set: (down: boolean) => void): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(el, e.pointerId);
      el.classList.add('down');
      set(true);
    });
    const release = () => {
      if (!el.classList.contains('down')) return;
      el.classList.remove('down');
      set(false);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  private tap(el: HTMLElement, fn: () => void): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('down');
      fn();
    });
    const lift = () => el.classList.remove('down');
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
  }

  private update(): void {
    const active = this.hooks.active();
    if (active !== this.shown.active) {
      this.shown.active = active;
      this.root.classList.toggle('off', !active);
      if (!active) this.releaseAll();
    }
    const prompt = active ? (this.hooks.prompt() ?? '') : '';
    if (prompt !== this.shown.prompt) {
      this.shown.prompt = prompt;
      this.act.classList.toggle('show', !!prompt);
      // "Talk to Tansy" → "Talk": the full prompt is on the HUD already.
      this.actLabel.textContent = prompt.split(' ')[0] ?? '';
    }
  }

  /** A menu opened mid-press: let go of everything, so nothing sticks. */
  private releaseAll(): void {
    this.stickId = null;
    this.lookId = null;
    this.stick.classList.remove('on');
    this.input.setTouchStick(0, 0);
    this.input.setTouchJump(false);
    this.input.setCast(false);
    for (const b of this.root.querySelectorAll('.t-btn.down')) b.classList.remove('down');
  }
}

/** Keep a finger's moves even when it slides off the element (not every pointer can be captured). */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // A pointer the browser doesn't consider active: the moves still bubble here.
  }
}
