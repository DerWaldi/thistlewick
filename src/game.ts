import { Vector3 } from 'three';
import { DIALOGUES } from './data/dialogues';
import { LEVELS } from './data/levels';
import { loadTuning, type Tuning } from './data/tuning';
import { EventBus } from './engine/events';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { Renderer } from './engine/render';
import { Music } from './engine/music';
import { Sfx } from './engine/sfx';
import { loadOptions, saveOptions, type Options, liveKeys } from './state/options';
import { LevelSession } from './session';
import { GameState } from './state/gameState';
import { apply, clearSave, loadSave, writeSave } from './state/save';
import { LESSONS, resetTrial, spellsBy } from './data/lessons';
import { Album } from './ui/album';
import { Dialogue } from './ui/dialogue';
import { Hud } from './ui/hud';
import { compassTarget, currentObjective, type Objective } from './data/objectives';
import { Shop } from './ui/shop';
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
  readonly music: Music;
  readonly options: Options = loadOptions();
  /** The title screen: camera drifts around the hall, no HUD, no control. */
  titleMode = false;
  readonly dialogue: Dialogue;
  readonly album: Album;
  readonly shop: Shop;
  /** Paused by the menu (pointer unlocked mid-game). */
  paused = false;
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
    this.sfx.listener = () => this.session?.player.pos ?? null;
    this.music = new Music(() => this.sfx.context);
    this.events.on('dialogueOpen', ({ open }) => this.music.setDuck(open));
    this.dialogue = new Dialogue(this.events, (pitch) => this.sfx.blip(pitch));
    this.input.onPad = (b) => {
      if (b === 'start') this.onPadStart();
      else if (b === 'b' && this.shop.isOpen) this.shop.close();
      else if (b === 'b' && this.album.isOpen) this.album.toggle();
      else if (b !== 'b') this.dialogue.padButton(b);
    };
    this.album = new Album(() => this.state);
    this.shop = new Shop(() => this.state);
    this.hud = new Hud(
      {
        state: () => this.state,
        caster: () => this.session?.caster ?? null,
        prompt: () => this.session?.focus?.prompt() ?? null,
        secretsIn: (area) => this.session?.world.secretsIn(area) ?? { found: 0, total: 0 },
        guide: () => this.guide(),
      },
      this.events,
    );

    this.applyOptions();

    // Autosave on meaningful progress; sweets are batched.
    for (const e of ['card', 'secret', 'checkpoint', 'learned', 'levelLoaded', 'purchase'] as const) this.events.on(e, () => this.save());
    this.events.on('sweet', () => (this.dirty = true));
    for (const e of ['unlock', 'chestOpen'] as const) this.events.on(e, () => (this.dirty = true));
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

  /**
   * A sandbox level: fresh state, no saving (the gym, isolated tests). You know every
   * spell taught up to and including that level's lesson, as you would in a real game.
   */
  startSandbox(level: string): void {
    this.sandbox = true;
    this.state = new GameState(this.events);
    for (const s of spellsBy(level)) this.state.known.add(s);
    this.loadLevel(level, 'default');
  }

  /** Dev: undo a finished trial in the save, so it can be played again. */
  resetTrialInSave(spell: string): boolean {
    const data = loadSave();
    if (!data) return false;
    const s = new GameState(this.events);
    apply(s, data);
    if (!resetTrial(s, spell)) return false;
    // If the save left you standing in that trial, start back at its classroom.
    const l = LESSONS.find((x) => x.spell === spell)!;
    if (s.level === l.trial) {
      s.level = l.classroom;
      s.checkpoint = null;
    }
    return writeSave(s);
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
    this.titleMode = true;
    this.hud.setVisible(false);
    this.music.setMood('title');
  }

  /** Leave the title screen (after New Game / Continue). */
  beginPlay(): void {
    this.titleMode = false;
    this.hud.setVisible(true);
    if (this.session) this.music.setMood(this.session.def.music ?? 'hub');
  }

  private objective: Objective | null = null;
  private objectiveAge = Infinity;

  /** Where the story wants you next, as a bearing relative to the camera. */
  private guide(): { title: string; bearing: number | null; dist: number; dy: number } | null {
    const s = this.session;
    if (!s || !this.options.guide || this.titleMode || this.sandbox) return null;
    // Progress only changes in dialogues and on pickups: a few times a second is plenty.
    if (this.objectiveAge > 0.5 || !this.objective) {
      const next = currentObjective(this.state);
      if (this.objective && next.title !== this.objective.title) this.events.emit('toast', { text: `New goal: ${next.title}`, kind: 'hint' });
      this.objective = next;
      this.objectiveAge = 0;
    }
    const p = s.player.feet;
    const story = !this.state.flags.has('year-complete');
    const t = compassTarget(this.objective, s.def.id, p, story);
    if (!t) return { title: this.objective.title, bearing: null, dist: 0, dy: 0 };
    const dx = t[0] - p.x;
    const dz = t[2] - p.z;
    const bearing = Math.atan2(dx, dz) - s.camera.yaw;
    return { title: this.objective.title, bearing: Math.atan2(Math.sin(bearing), Math.cos(bearing)), dist: Math.hypot(dx, dz), dy: t[1] - p.y };
  }

  /** The gamepad's Start button (main.ts pauses and resumes with it). */
  onPadStart: () => void = () => {};

  applyOptions(): void {
    const o = this.options;
    Object.assign(liveKeys, o.keys);
    this.input.bindings = liveKeys;
    this.input.sensitivityScale = o.sensitivity;
    this.input.invertY = o.invertY;
    this.sfx.setVolume(o.sfx);
    this.music.setVolume(o.music);
    this.renderer.setQuality(o.quality);
    this.showStats = o.showFps || this.debugStats;
    this.statsEl.style.display = this.showStats ? '' : 'none';
    saveOptions(o);
  }

  /** Dev builds always show the stats line. */
  debugStats = false;

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
    if (!this.titleMode) this.music.setMood(def.music ?? 'hub');
    this.renderer.setAmbience(def.ambience ?? 'day');
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
    const run = script({
      say: (lines) => this.dialogue.run(lines),
      state: this.state,
      events: this.events,
      openShop: () => {
        if (this.input.locked) document.exitPointerLock();
        return this.shop.open();
      },
    }).finally(() => {
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

  /**
   * Save a PNG of the current view, stamped with where you are (P key). Handy for
   * bug reports: the stamp says exactly which level, area and position.
   */
  screenshot(): void {
    const s = this.session;
    if (!s) return;
    this.renderer.draw();
    const src = this.renderer.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    this.dialogue.drawOnto(g, src.getBoundingClientRect(), c.width / src.clientWidth);
    const f = s.player.feet;
    const stamp = `${s.def.id} · ${s.currentArea?.name ?? '-'} · feet ${f.x.toFixed(2)}, ${f.y.toFixed(2)}, ${f.z.toFixed(2)} · facing ${s.player.facing.toFixed(2)} · ${s.player.mode}`;
    const px = Math.max(14, Math.round(c.height / 48));
    g.font = `${px}px ui-monospace, Menlo, monospace`;
    const w = g.measureText(stamp).width + px;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, c.height - px * 1.8, w, px * 1.8);
    g.fillStyle = '#f3e4c4';
    g.fillText(stamp, px / 2, c.height - px * 0.6);
    const a = document.createElement('a');
    a.download = `thistlewick-${s.def.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
    this.events.emit('toast', { text: 'Screenshot saved to your downloads.', kind: 'info' });
  }

  get isHalted(): boolean {
    return this.paused || this.dialogue.isOpen || this.shop.isOpen || this.album.isOpen;
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
      if (this.input.consumeAction('interact')) s.interact();
    } else {
      this.input.consumeAction('interact');
    }
    if (this.input.consumeAction('album') && !this.dialogue.isOpen) {
      this.album.toggle();
      if (this.album.isOpen && this.input.locked) document.exitPointerLock();
    }

    // Time stands still while someone is talking, shopping, reading the album or paused.
    if (!this.isHalted) s.fixedUpdate(dt);
    else s.player.hold();

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
    this.input.pollGamepad(dt);
    const s = this.session;
    if (!s) return;
    if (this.titleMode) {
      // A slow drift around the hall behind the title.
      s.camera.yaw += dt * 0.07;
      s.camera.pitch = 0.08;
    }
    // Halted frames draw the latest state: interpolating between two frozen steps makes everything shake.
    s.frameUpdate(dt, this.isHalted ? 1 : alpha);
    if (!this.titleMode) this.renderer.setAmbience(s.currentArea?.ambience ?? s.def.ambience ?? 'day', false);
    this.renderer.updateAmbience(dt);
    if (this.titleMode) s.rig.root.visible = false;
    s.shadow.hidden = this.titleMode;
    this.dialogue.update(dt);
    this.music.update();
    this.renderer.followShadow(s.player.pos);
    this.objectiveAge += dt;
    this.hud.update();

    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.adaptQuality(dt);
    if (this.showStats) {
      const p = s.player;
      this.statsEl.textContent =
        `${this.fps.toFixed(0)} fps  draw calls ${this.renderer.renderer.info.render.calls}\n` +
        `${s.def.id} · ${s.currentArea?.name ?? '-'}  ${p.mode}  speed ${p.horizontalSpeed.toFixed(2)}  vy ${p.vel.y.toFixed(2)}\n` +
        `feet ${fmt(p.feet)}`;
    }
  }

  private slowTime = 0;
  private adapted = false;

  /** If Fancy graphics can't hold ~45 fps for a few seconds, drop to Fast (once per session). */
  private adaptQuality(dt: number): void {
    if (this.adapted || this.loop.manual || this.options.quality !== 'high' || dt <= 0 || document.hidden) return;
    this.slowTime = this.fps < 42 ? this.slowTime + dt : Math.max(0, this.slowTime - dt * 2);
    if (this.slowTime > 4) {
      this.adapted = true;
      this.options.quality = 'low';
      this.applyOptions();
      this.events.emit('toast', { text: 'Switched to Fast graphics for smoother play (see Options).', kind: 'hint' });
    }
  }

  get currentFps(): number {
    return this.fps;
  }
}

function fmt(v: Vector3): string {
  return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
}
