/**
 * Keyboard + mouse input. Movement is read as a continuous axis; jump is latched
 * so a press between two fixed steps is never lost. Tests can override everything
 * through `virtual`.
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
  private onLockChange: ((locked: boolean) => void)[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') {
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
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    return clampLen(x, y);
  }

  jumpHeld(): boolean {
    if (this.virtual) return this.virtual.jump;
    return this.keys.has('Space');
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
