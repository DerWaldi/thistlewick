import { Vector3 } from 'three';
import { loadTuning, type Tuning } from './data/tuning';
import { buildGym } from './data/levels/gym';
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
import { buildStudent } from './player/model';
import { LevelBuilder } from './world/builder';

export interface GameOptions {
  /** Simulation advances only through the test API. */
  manual?: boolean;
}

export class Game {
  readonly events = new EventBus();
  readonly tuning: Tuning = loadTuning();
  readonly renderer: Renderer;
  readonly physics = new Physics();
  readonly input: Input;
  readonly level: LevelBuilder;
  readonly player: PlayerController;
  readonly camera: OrbitCamera;
  readonly loop: Loop;
  private animator: StudentAnimator;
  private shadow: BlobShadow;
  private puffs: Puffs;
  private fps = 60;
  private statsEl = document.getElementById('stats')!;
  showStats = false;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    new Sfx(this.events);

    this.level = new LevelBuilder(this.renderer.scene, this.physics);
    const { spawn, yaw } = buildGym(this.level);

    this.player = new PlayerController(this.physics, this.input, this.events, this.tuning, this.level, spawn);
    this.player.facing = yaw;
    const rig = buildStudent();
    this.renderer.scene.add(rig.root);
    this.animator = new StudentAnimator(rig, this.player, this.events);
    this.camera = new OrbitCamera(this.renderer.camera, this.input, this.physics, this.tuning, this.player);
    this.shadow = new BlobShadow(this.renderer.scene, this.physics, this.player);
    this.puffs = new Puffs(this.renderer.scene, this.events, this.player);

    const fade = document.getElementById('fade')!;
    this.events.on('splash', () => (fade.style.opacity = '0.85'));
    this.events.on('respawn', () => {
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
    this.player.update(dt, this.camera.yaw);
    this.level.applyMovers();
    this.physics.step();
  }

  private frameUpdate(dt: number, alpha: number): void {
    this.camera.update(dt, alpha);
    this.animator.update(dt, alpha);
    this.level.frameUpdate(dt, alpha);
    this.puffs.update(dt);
    this.shadow.update(alpha);
    this.renderer.followShadow(this.player.pos);

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
