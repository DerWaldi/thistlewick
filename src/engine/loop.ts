export const FIXED_DT = 1 / 60;

/**
 * Fixed-timestep simulation with a variable-rate frame update (camera, animation) and draw.
 * `alpha` (0..1) is how far the render frame sits between the last two fixed steps.
 */
export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  timeScale = 1;
  /** When true, the simulation only advances through `advance()` (used by tests). */
  manual = false;
  /** In manual mode, frames are only drawn on request (rendering is slow in headless browsers). */
  private drawRequested = true;

  constructor(
    private fixedUpdate: (dt: number) => void,
    private frameUpdate: (dt: number, alpha: number) => void,
    private draw: () => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      if (!this.manual) {
        this.acc += dt * this.timeScale;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 8) {
          this.fixedUpdate(FIXED_DT);
          this.acc -= FIXED_DT;
          steps++;
        }
        if (steps === 8) this.acc = 0;
      }
      if (!this.manual) this.frameUpdate(dt, this.acc / FIXED_DT);
      if (!this.manual || this.drawRequested) {
        this.draw();
        this.drawRequested = false;
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  requestDraw(): void {
    this.drawRequested = true;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** Deterministically advance the simulation (and frame-rate dependent updates) by `seconds`. */
  advance(seconds: number): void {
    const n = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < n; i++) {
      this.fixedUpdate(FIXED_DT);
      this.frameUpdate(FIXED_DT, 1);
    }
  }
}
