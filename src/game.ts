import { Vector3 } from 'three';
import { loadTuning, type Tuning } from './data/tuning';
import { buildGym } from './data/levels/gym';
import { SweetField } from './entities/sweets';
import { EventBus } from './engine/events';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { Physics } from './engine/physics';
import { Renderer } from './engine/render';
import { Sfx } from './engine/sfx';
import { StudentAnimator } from './player/animator';
import { OrbitCamera } from './player/camera';
import { PlayerController } from './player/controller';
import { BlobShadow, Puffs } from './player/effects';
import { PlayerHealth } from './player/health';
import { buildStudent, type StudentRig } from './player/model';
import { Caster } from './spells/caster';
import { TargetRegistry } from './spells/targets';
import { GameState } from './state/gameState';
import { Hud } from './ui/hud';
import { LevelBuilder } from './world/builder';
import { Signals } from './world/signals';
import { World } from './world/world';

export interface GameOptions {
  /** Simulation advances only through the test API. */
  manual?: boolean;
}

export class Game {
  readonly events = new EventBus();
  readonly tuning: Tuning = loadTuning();
  readonly state = new GameState(this.events);
  readonly renderer: Renderer;
  readonly physics = new Physics();
  readonly input: Input;
  readonly level: LevelBuilder;
  readonly player: PlayerController;
  readonly health: PlayerHealth;
  readonly camera: OrbitCamera;
  readonly caster: Caster;
  readonly world: World;
  readonly loop: Loop;
  readonly rig: StudentRig;
  private animator: StudentAnimator;
  private shadow: BlobShadow;
  private puffs: Puffs;
  private hud: Hud;
  private fps = 60;
  private statsEl = document.getElementById('stats')!;
  showStats = false;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    new Sfx(this.events);
    const scene = this.renderer.scene;

    this.level = new LevelBuilder(scene, this.physics);
    const { spawn, yaw } = buildGym(this.level);

    this.player = new PlayerController(this.physics, this.input, this.events, this.tuning, this.level, spawn);
    this.player.facing = yaw;
    this.health = new PlayerHealth(this.player, this.state, this.events, { pos: spawn.clone(), yaw });
    this.rig = buildStudent();
    scene.add(this.rig.root);
    this.health.onBlink = (visible) => (this.rig.root.visible = visible);
    this.animator = new StudentAnimator(this.rig, this.player, this.events);
    this.camera = new OrbitCamera(this.renderer.camera, this.input, this.physics, this.tuning, this.player);
    this.shadow = new BlobShadow(scene, this.physics, this.player);
    this.puffs = new Puffs(scene, this.events, this.player);

    // The gym is a sandbox: you already know Thwackwort here.
    this.state.learn('thwackwort');

    const targets = new TargetRegistry();
    const sweets = new SweetField(scene, this.physics, this.player, this.state, this.tuning);
    this.world = new World({
      scene,
      physics: this.physics,
      events: this.events,
      tuning: this.tuning,
      player: this.player,
      health: this.health,
      state: this.state,
      signals: new Signals(this.events),
      targets,
      fx: this.puffs,
      sweets,
    });
    this.world.spawnAll(this.level.entities);

    this.caster = new Caster(
      scene,
      this.renderer.camera,
      this.input,
      this.physics,
      this.player,
      this.state,
      targets,
      this.events,
      this.tuning,
      this.puffs,
      (out) => this.rig.wandTip.getWorldPosition(out),
    );
    this.hud = new Hud(this.state, this.caster, this.events);

    const fade = document.getElementById('fade')!;
    this.events.on('splash', () => (fade.style.opacity = '0.85'));
    this.events.on('faint', () => (fade.style.opacity = '0.92'));
    this.events.on('respawn', () => {
      this.camera.snap();
      setTimeout(() => (fade.style.opacity = '0'), 120);
    });

    // Physics needs one step so the query pipeline knows about the static colliders.
    this.physics.step();

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

  private fixedUpdate(dt: number): void {
    this.level.fixedUpdate(dt);
    this.world.fixedUpdate(dt);
    this.player.update(dt, this.camera.yaw);
    this.health.update(dt);
    this.level.applyMovers();
    this.world.lateFixedUpdate();
    this.physics.step();
  }

  private frameUpdate(dt: number, alpha: number): void {
    this.camera.update(dt, alpha);
    this.animator.charge = this.caster.charge;
    this.animator.update(dt, alpha);
    this.level.frameUpdate(dt, alpha);
    this.world.frameUpdate(dt, alpha);
    this.caster.update(dt);
    this.puffs.update(dt);
    this.shadow.update(alpha);
    this.renderer.followShadow(this.player.pos);
    this.hud.update();

    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    if (this.showStats) {
      const p = this.player;
      this.statsEl.textContent =
        `${this.fps.toFixed(0)} fps  draw calls ${this.renderer.renderer.info.render.calls}\n` +
        `${p.mode}  speed ${p.horizontalSpeed.toFixed(2)}  vy ${p.vel.y.toFixed(2)}  surface ${p.groundSurface}\n` +
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
