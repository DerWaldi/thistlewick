import { Vector3 } from 'three';
import { DIALOGUES } from './data/dialogues';
import { LEVELS } from './data/levels';
import { loadTuning, type Tuning } from './data/tuning';
import { EventBus } from './engine/events';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { Renderer } from './engine/render';
import { Sfx } from './engine/sfx';
import { LevelSession } from './session';
import { GameState } from './state/gameState';
import { apply, clearSave, loadSave, writeSave } from './state/save';
import { Album } from './ui/album';
import { Dialogue } from './ui/dialogue';
import { Hud } from './ui/hud';
import type { SpawnPoint } from './world/level';

export interface GameOptions {
  /** Simulation advances only through the test API. */
  manual?: boolean;
}

const FADE_TIME = 0.35;
const AUTOSAVE_EVERY = 30;

/**
 * Long-lived game shell: renderer, input, audio, UI, progress. Levels come and
 * go as LevelSessions.
 */
export class Game {
  readonly events = new EventBus();
  readonly tuning: Tuning = loadTuning();
  state = new GameState(this.events);
  readonly renderer: Renderer;
  readonly input: Input;
  readonly sfx: Sfx;
  readonly dialogue: Dialogue;
  readonly album: Album;
  readonly loop: Loop;
  session: LevelSession | null = null;
  private hud: Hud;
  private pending: { level: string; spawn: string } | null = null;
  private fade = 0; // 0 clear .. 1 black
  private fadeDir = 0;
  private fadeEl = document.getElementById('fade')!;
  private saveTimer = 0;
  private dirty = false;
  private sinceSave = 0;
  private rivalTimer = 0;
  /** Sandbox runs (the gym, tests with ?level=) never write the save. */
  sandbox = false;
  private fps = 60;
  private statsEl = document.getElementById('stats')!;
  showStats = false;
  private scriptRunning: Promise<void> | null = null;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sfx = new Sfx(this.events);
    this.dialogue = new Dialogue(this.events, (pitch) => this.sfx.blip(pitch));
    this.album = new Album(() => this.state);
    this.hud = new Hud(
      {
        state: () => this.state,
        caster: () => this.session?.caster ?? null,
        prompt: () => this.session?.focus?.prompt() ?? null,
        secretsIn: (area) => this.session?.world.secretsIn(area) ?? { found: 0, total: 0 },
      },
      this.events,
    );

    // Autosave on meaningful progress; sweets are batched.
    for (const e of ['card', 'secret', 'checkpoint', 'learned', 'levelLoaded'] as const) this.events.on(e, () => this.save());
    this.events.on('sweet', () => (this.dirty = true));
    this.events.on('points', () => (this.dirty = true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });

    this.loop = new Loop(
      (dt) => this.fixedUpdate(dt),
      (dt, alpha) => this.frameUpdate(dt, alpha),
      () => this.renderer.draw(),
    );
    this.loop.manual = !!opts.manual;
  }

  start(): void {
    this.loop.start();
  }

  // ---------------------------------------------------------------- session shortcuts (tests, debugging)

  get player() {
    return this.session!.player;
  }
  get physics() {
    return this.session!.physics;
  }
  get world() {
    return this.session!.world;
  }
  get level() {
    return this.session!.builder;
  }
  get camera() {
    return this.session!.camera;
  }
  get caster() {
    return this.session!.caster;
  }
  get rig() {
    return this.session!.rig;
  }
  get health() {
    return this.session!.health;
  }

  // ---------------------------------------------------------------- starting

  /** A sandbox level: fresh state, no saving (the gym, isolated tests). */
  startSandbox(level: string): void {
    this.sandbox = true;
    this.state = new GameState(this.events);
    this.loadLevel(level, 'default');
  }

  newGame(): void {
    this.sandbox = false;
    clearSave();
    this.state = new GameState(this.events);
    this.loadLevel('hub', 'start');
  }

  continueGame(): boolean {
    const data = loadSave();
    if (!data) return false;
    this.sandbox = false;
    this.state = new GameState(this.events);
    apply(this.state, data);
    const cp = this.state.checkpoint;
    const level = LEVELS[this.state.level] ? this.state.level : 'hub';
    if (cp && cp.level === level) this.loadLevel(level, { pos: cp.pos.toArray() as [number, number, number], yaw: cp.yaw });
    else this.loadLevel(level, 'default');
    return true;
  }

  /** Show something behind the title screen. */
  showBackdrop(): void {
    this.sandbox = true;
    this.state = new GameState(this.events);
    this.loadLevel('hub', 'title');
    this.session!.player.frozen = true;
  }

  // ---------------------------------------------------------------- levels

  loadLevel(id: string, spawn: string | SpawnPoint): void {
    const def = LEVELS[id];
    if (!def) throw new Error(`Unknown level ${id}`);
    this.session?.dispose();
    this.session = null;
    if (def.grants) for (const s of def.grants) this.state.known.add(s);
    const sp = typeof spawn === 'string' ? (def.spawns[spawn] ?? def.spawns.default) : spawn;
    this.session = new LevelSession(this, def, sp);
    this.state.level = id;
    this.input.clearPressed();
    this.events.emit('levelLoaded', { id });
    if (def.intro && !this.state.flags.has(def.intro.unlessFlag) && !this.sandbox) {
      this.state.flags.add(def.intro.unlessFlag);
      void this.runScript(def.intro.script);
    }
  }

  /** Fade out, swap level, fade in. */
  requestLevel(level: string, spawn: string): void {
    if (this.pending) return;
    this.pending = { level, spawn };
    this.fadeDir = 1;
    if (this.session) this.session.player.frozen = true;
  }

  // ---------------------------------------------------------------- dialogue

  /** Run a dialogue script by id. Ignored if one is already running. */
  runScript(id: string): Promise<number | null> {
    const script = DIALOGUES[id];
    if (!script || this.scriptRunning) return Promise.resolve(null);
    const run = script({ say: (lines) => this.dialogue.run(lines), state: this.state, events: this.events }).finally(() => {
      this.scriptRunning = null;
      this.input.clearPressed();
      // House colours may have changed (sorting).
      const hc = this.state.houseColor();
      this.session?.rig.setScarf(hc.color, hc.trim);
      this.save();
    });
    this.scriptRunning = run;
    return run.then(() => null);
  }

  /** Resolves when no dialogue script is running (tests). */
  async idle(): Promise<void> {
    while (this.scriptRunning) await this.scriptRunning;
  }

  // ---------------------------------------------------------------- saving

  save(): void {
    this.dirty = false;
    this.sinceSave = 0;
    if (this.sandbox) return;
    writeSave(this.state);
  }

  // ---------------------------------------------------------------- loop

  private fixedUpdate(dt: number): void {
    const s = this.session;
    if (!s) return;

    if (!this.dialogue.isOpen && !this.album.isOpen) {
      if (this.input.consumeKey('KeyE')) s.interact();
    } else {
      this.input.consumeKey('KeyE');
    }
    if (this.input.consumeKey('KeyC') && !this.dialogue.isOpen) {
      this.album.toggle();
      if (this.album.isOpen && this.input.locked) document.exitPointerLock();
    }

    // Time stands still while someone is talking (no Gnarling bites mid-sentence).
    if (!this.dialogue.isOpen) s.fixedUpdate(dt);

    this.state.playTime += dt;
    this.rivalTimer += dt;
    if (this.rivalTimer > 150) {
      this.rivalTimer = 0;
      this.state.rivalsTick();
    }
    this.sinceSave += dt;
    if (this.dirty) this.saveTimer += dt;
    if ((this.dirty && this.saveTimer > 2) || this.sinceSave > AUTOSAVE_EVERY) {
      this.saveTimer = 0;
      this.save();
    }

    // Level transitions.
    if (this.fadeDir !== 0) {
      this.fade = Math.min(1, Math.max(0, this.fade + (this.fadeDir * dt) / FADE_TIME));
      if (this.fade >= 1 && this.pending) {
        const p = this.pending;
        this.pending = null;
        this.loadLevel(p.level, p.spawn);
        this.fadeDir = -1;
      } else if (this.fade <= 0 && this.fadeDir < 0) {
        this.fadeDir = 0;
      }
      this.fadeEl.style.opacity = String(this.fade);
    }
  }

  private frameUpdate(dt: number, alpha: number): void {
    const s = this.session;
    if (!s) return;
    s.frameUpdate(dt, alpha);
    this.dialogue.update(dt);
    this.renderer.followShadow(s.player.pos);
    this.hud.update();

    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    if (this.showStats) {
      const p = s.player;
      this.statsEl.textContent =
        `${this.fps.toFixed(0)} fps  draw calls ${this.renderer.renderer.info.render.calls}\n` +
        `${s.def.id} · ${s.currentArea?.name ?? '-'}  ${p.mode}  speed ${p.horizontalSpeed.toFixed(2)}  vy ${p.vel.y.toFixed(2)}\n` +
        `feet ${fmt(p.feet)}`;
    }
  }

  get currentFps(): number {
    return this.fps;
  }
}

function fmt(v: Vector3): string {
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}
