import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { createTuningPanel } from './engine/debug';
import { Game } from './game';

const params = new URLSearchParams(location.search);
const debug = params.has('debug') || import.meta.env.DEV;
const testMode = params.has('test');

async function boot(): Promise<void> {
  await RAPIER.init();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas, { manual: testMode });
  game.showStats = debug;
  game.start();

  const overlay = document.getElementById('click-to-play')!;
  overlay.addEventListener('click', () => game.input.requestLock());
  canvas.addEventListener('click', () => {
    if (!game.input.locked) game.input.requestLock();
  });
  game.input.onLock((locked) => overlay.classList.toggle('hidden', locked || testMode));
  if (testMode) overlay.classList.add('hidden');

  let panel: { toggle(): void } | null = null;
  window.addEventListener('keydown', async (e) => {
    if (e.code !== 'Backquote') return;
    panel ??= await createTuningPanel(game.tuning);
    panel.toggle();
    if (game.input.locked) document.exitPointerLock();
  });

  if (debug || testMode) exposeTestApi(game);
}

/** `window.__tw`: hooks for Playwright and console poking. */
function exposeTestApi(game: Game): void {
  const api = {
    game,
    state: () => {
      const p = game.player;
      const cam = game.renderer.camera.position;
      return {
        mode: p.mode,
        grounded: p.grounded,
        feet: { x: p.feet.x, y: p.feet.y, z: p.feet.z },
        vel: { x: p.vel.x, y: p.vel.y, z: p.vel.z },
        facing: p.facing,
        camera: { x: cam.x, y: cam.y, z: cam.z, yaw: game.camera.yaw, pitch: game.camera.pitch },
        cameraInsideSolid: game.physics.pointInsideSolid(cam),
        fps: game.currentFps,
        stamina: game.state.stamina,
        sweets: game.state.sweets,
        target: game.caster.current ? game.caster.current.spell : null,
        targetUnknown: game.caster.currentUnknown,
        charging: game.caster.charging,
        checkpoint: game.state.checkpoint ? game.state.checkpoint.pos.toArray() : null,
      };
    },
    /** Point the crosshair at a world position (the camera looks through its pivot). */
    aimAt: (x: number, y: number, z: number) => {
      const p = game.player;
      const c = game.tuning.camera;
      const pivot = new Vector3(p.pos.x - Math.cos(game.camera.yaw) * c.shoulder, p.feet.y + c.height, p.pos.z + Math.sin(game.camera.yaw) * c.shoulder);
      const d = new Vector3(x, y, z).sub(pivot);
      game.camera.yaw = Math.atan2(d.x, d.z);
      game.camera.pitch = Math.max(game.tuning.camera.minPitch, Math.min(game.tuning.camera.maxPitch, Math.asin(d.y / d.length())));
      game.loop.advance(1 / 60);
      // Second pass: the camera has moved, so re-aim through the actual camera position.
      const cam = game.renderer.camera.position;
      const d2 = new Vector3(x, y, z).sub(cam);
      game.camera.yaw = Math.atan2(d2.x, d2.z);
      game.camera.pitch = Math.max(game.tuning.camera.minPitch, Math.min(game.tuning.camera.maxPitch, Math.asin(d2.y / d2.length())));
      game.loop.advance(1 / 60);
    },
    /** Press the cast button, hold it for `hold` seconds of game time, release. */
    cast: (hold = 0) => {
      game.input.setCast(true);
      game.loop.advance(Math.max(1 / 60, hold));
      game.input.setCast(false);
      game.loop.advance(1 / 60);
    },
    learn: (spell: string) => game.state.learn(spell as never),
    signal: (id: string) => game.world.ctx.signals.get(id),
    /** Hold a virtual stick (camera-relative) and jump button; pass null to release. */
    input: (v: { x?: number; y?: number; jump?: boolean } | null) => {
      game.input.virtual = v ? { x: v.x ?? 0, y: v.y ?? 0, jump: v.jump ?? false } : null;
    },
    pressJump: () => game.input.pressJump(),
    teleport: (x: number, y: number, z: number, facing?: number) => {
      game.player.teleport(new Vector3(x, y, z), facing);
      if (facing !== undefined) game.camera.yaw = facing;
      game.camera.snap();
    },
    setCamera: (yaw: number, pitch?: number) => {
      game.camera.yaw = yaw;
      if (pitch !== undefined) game.camera.pitch = pitch;
    },
    advance: (seconds: number) => game.loop.advance(seconds),
    setManual: (m: boolean) => (game.loop.manual = m),
  };
  (window as unknown as { __tw: typeof api }).__tw = api;
}

void boot();
