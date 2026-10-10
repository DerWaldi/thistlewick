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
      };
    },
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
