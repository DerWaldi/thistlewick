import { DEFAULT_KEYS, type KeyBindings } from '../state/options';

/**
 * Keyboard + mouse (or a gamepad) input. Movement is read as a continuous axis; jump is
 * latched so a press between two fixed steps is never lost. Keys are rebindable
 * (`bindings`). Tests can override everything through `virtual`.
 *
 * Gamepad (standard mapping): left stick moves, right stick looks, A jumps (and advances
 * dialogue), X or RT casts (hold to charge), Y or B interacts, Back opens the album,
 * Start pauses.
 */
export interface VirtualInput {
  x: number; // strafe, -1..1 (right positive)
  y: number; // forward, -1..1
  jump: boolean;
  cast?: boolean;
}

export class Input {
  readonly keys = new Set<string>();
  private jumpLatch = false;
  private pressed = new Set<string>();
  private castDown = false;
  private castPressLatch = false;
  private castReleaseLatch = false;
  private mouseDX = 0;
  private mouseDY = 0;
  locked = false;
  /** From Options: multiplies mouse deltas; invertY flips vertical look. */
  sensitivityScale = 1;
  invertY = false;
  virtual: VirtualInput | null = null;
  bindings: KeyBindings = { ...DEFAULT_KEYS };
  private onLockChange: ((locked: boolean) => void)[] = [];
  // Gamepad state, polled once a frame.
  private pad = { x: 0, y: 0, jump: false, cast: false, interact: false, album: false, start: false, up: false, down: false };
  /** Fired on gamepad presses the menus and dialogue care about. */
  onPad: (button: 'start' | 'a' | 'up' | 'down') => void = () => {};
  /** Set while waiting for a key to rebind: the next key press goes here instead. */
  captureKey: ((code: string) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.captureKey) return;
        // Rebinding: this key is the answer, and nothing else should see it.
        e.preventDefault();
        e.stopImmediatePropagation();
        const fn = this.captureKey;
        this.captureKey = null;
        fn(e.code);
      },
      true,
    );
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === this.bindings.jump) {
        this.jumpLatch = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.locked) return;
      this.castDown = true;
      this.castPressLatch = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !this.castDown) return;
      this.castDown = false;
      this.castReleaseLatch = true;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      for (const fn of this.onLockChange) fn(this.locked);
    });
  }

  requestLock(): void {
    // Safari returns undefined, others a promise that may reject if requested too quickly.
    const res = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    res?.catch?.(() => {});
  }

  onLock(fn: (locked: boolean) => void): void {
    this.onLockChange.push(fn);
  }

  /** Movement axis in camera space: x = right, y = forward. Length is clamped to 1. */
  moveAxis(): { x: number; y: number } {
    if (this.virtual) return clampLen(this.virtual.x, this.virtual.y);
    if (Math.hypot(this.pad.x, this.pad.y) > 0.2) return clampLen(this.pad.x, this.pad.y);
    const k = this.keys;
    const b = this.bindings;
    const x = (k.has(b.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(b.left) || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has(b.forward) || k.has('ArrowUp') ? 1 : 0) - (k.has(b.back) || k.has('ArrowDown') ? 1 : 0);
    return clampLen(x, y);
  }

  jumpHeld(): boolean {
    if (this.virtual) return this.virtual.jump;
    return this.keys.has(this.bindings.jump) || this.pad.jump;
  }

  /** Once per press of a rebindable action key (or its gamepad button). */
  consumeAction(action: 'interact' | 'album'): boolean {
    return this.consumeKey(this.bindings[action]) || this.consumeKey(`Pad:${action}`);
  }

  /**
   * Reads the first connected gamepad (once a frame): sticks, and edges on its buttons.
   * The right stick turns the camera as if the mouse moved.
   */
  pollGamepad(dt: number): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads ?? []).find((p) => p && p.connected);
    if (!gp) {
      this.pad.x = this.pad.y = 0;
      return;
    }
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    this.pad.x = dz(gp.axes[0] ?? 0);
    this.pad.y = -dz(gp.axes[1] ?? 0);
    const rx = dz(gp.axes[2] ?? 0);
    const ry = dz(gp.axes[3] ?? 0);
    this.mouseDX += rx * 950 * dt;
    this.mouseDY += ry * 650 * dt;
    const down = (i: number) => !!gp.buttons[i]?.pressed;
    const edge = (key: keyof typeof this.pad, now: boolean): boolean => {
      const was = this.pad[key] as boolean;
      (this.pad[key] as boolean) = now;
      return now && !was;
    };
    if (edge('jump', down(0))) {
      this.jumpLatch = true;
      this.onPad('a');
    }
    const cast = down(2) || down(7);
    if (cast !== this.pad.cast) {
      this.pad.cast = cast;
      this.setCast(cast);
    }
    if (edge('interact', down(3) || down(1))) this.pressed.add('Pad:interact');
    if (edge('album', down(8))) this.pressed.add('Pad:album');
    if (edge('start', down(9))) this.onPad('start');
    if (edge('up', down(12))) this.onPad('up');
    if (edge('down', down(13))) this.onPad('down');
  }

  /** Returns true once per physical jump press. */
  consumeJump(): boolean {
    const v = this.jumpLatch;
    this.jumpLatch = false;
    return v;
  }

  castHeld(): boolean {
    if (this.virtual?.cast !== undefined) return this.virtual.cast;
    return this.castDown;
  }

  /** Returns true once per cast-button press. */
  consumeCastPress(): boolean {
    const v = this.castPressLatch;
    this.castPressLatch = false;
    return v;
  }

  /** Returns true once per cast-button release. */
  consumeCastRelease(): boolean {
    const v = this.castReleaseLatch;
    this.castReleaseLatch = false;
    return v;
  }

  /** Lets tests press/release the cast button. */
  setCast(down: boolean): void {
    if (down && !this.castDown) this.castPressLatch = true;
    if (!down && this.castDown) this.castReleaseLatch = true;
    this.castDown = down;
  }

  /** True once per press of a key since the last call (E to interact, C for the album...). */
  consumeKey(code: string): boolean {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  /** Forget pending key presses (e.g. after a dialogue swallowed them). */
  clearPressed(): void {
    this.pressed.clear();
    this.jumpLatch = false;
  }

  /** Lets tests trigger a jump press. */
  pressJump(): void {
    this.jumpLatch = true;
  }

  consumeMouse(): { dx: number; dy: number } {
    const k = this.sensitivityScale;
    const d = { dx: this.mouseDX * k, dy: this.mouseDY * k * (this.invertY ? -1 : 1) };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }
}

function clampLen(x: number, y: number): { x: number; y: number } {
  const l = Math.hypot(x, y);
  return l > 1 ? { x: x / l, y: y / l } : { x, y };
}
