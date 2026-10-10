import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { createTuningPanel } from './engine/debug';
import { Game } from './game';
import { loadSave } from './state/save';

const params = new URLSearchParams(location.search);
const debug = params.has('debug') || import.meta.env.DEV;
const testMode = params.has('test');
/** `?level=gym` (or any level id) starts a sandbox there: no title, no saving. */
const sandboxLevel = params.get('level');

async function boot(): Promise<void> {
  await RAPIER.init();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas, { manual: testMode });
  game.showStats = debug;
  if (testMode) game.dialogue.autoAdvance = true;

  const overlay = document.getElementById('click-to-play')!;
  const titleButtons = document.getElementById('title-buttons')!;
  const resumeHint = document.getElementById('resume-hint')!;
  const btnContinue = document.getElementById('btn-continue')!;
  const btnNew = document.getElementById('btn-new')!;
  let playing = false;

  const showOverlay = (show: boolean) => overlay.classList.toggle('hidden', !show || testMode);
  const beginPlay = () => {
    playing = true;
    titleButtons.classList.add('hidden');
    resumeHint.classList.remove('hidden');
    showOverlay(false);
    game.input.requestLock();
  };

  if (sandboxLevel) {
    game.startSandbox(sandboxLevel);
    playing = true;
    titleButtons.classList.add('hidden');
  } else if (testMode) {
    if (params.has('new') || !game.continueGame()) game.newGame();
    playing = true;
  } else {
    game.showBackdrop();
    resumeHint.classList.add('hidden');
    btnContinue.classList.toggle('hidden', !loadSave());
    btnContinue.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!game.continueGame()) game.newGame();
      beginPlay();
    });
    btnNew.addEventListener('click', (e) => {
      e.stopPropagation();
      if (loadSave() && !confirm('Start a new game? Your current progress will be lost.')) return;
      game.newGame();
      beginPlay();
    });
  }
  game.start();

  overlay.addEventListener('click', () => {
    if (playing) game.input.requestLock();
  });
  canvas.addEventListener('click', () => {
    if (playing && !game.input.locked) game.input.requestLock();
  });
  game.input.onLock((locked) => {
    if (playing) showOverlay(!locked && !game.album.isOpen);
  });
  game.album.onClose = () => {
    if (!game.input.locked) showOverlay(true);
  };
  if (testMode) showOverlay(false);

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
      const s = game.session!;
      const p = s.player;
      const st = game.state;
      const cam = game.renderer.camera.position;
      return {
        level: s.def.id,
        area: s.currentArea?.id ?? null,
        mode: p.mode,
        grounded: p.grounded,
        feet: { x: p.feet.x, y: p.feet.y, z: p.feet.z },
        vel: { x: p.vel.x, y: p.vel.y, z: p.vel.z },
        facing: p.facing,
        camera: { x: cam.x, y: cam.y, z: cam.z, yaw: s.camera.yaw, pitch: s.camera.pitch },
        cameraInsideSolid: s.physics.pointInsideSolid(cam),
        fps: game.currentFps,
        stamina: st.stamina,
        sweets: st.sweets,
        target: s.caster.current ? s.caster.current.spell : null,
        targetUnknown: s.caster.currentUnknown,
        charging: s.caster.charging,
        checkpoint: st.checkpoint ? st.checkpoint.pos.toArray() : null,
        house: st.house,
        housePoints: { ...st.housePoints },
        cards: [...st.cards],
        secrets: [...st.secrets],
        known: [...st.known],
        focus: s.focus?.prompt() ?? null,
        dialogueOpen: game.dialogue.isOpen,
      };
    },
    /** Point the crosshair at a world position (the camera looks through its pivot). */
    aimAt: (x: number, y: number, z: number) => {
      const s = game.session!;
      const p = s.player;
      const c = game.tuning.camera;
      const pivot = new Vector3(p.pos.x - Math.cos(s.camera.yaw) * c.shoulder, p.feet.y + c.height, p.pos.z + Math.sin(s.camera.yaw) * c.shoulder);
      const aim = (from: Vector3) => {
        const d = new Vector3(x, y, z).sub(from);
        s.camera.yaw = Math.atan2(d.x, d.z);
        s.camera.pitch = Math.max(c.minPitch, Math.min(c.maxPitch, Math.asin(d.y / d.length())));
        game.loop.advance(1 / 60);
      };
      aim(pivot);
      // Second pass: the camera has moved, so re-aim through the actual camera position.
      aim(game.renderer.camera.position.clone());
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
      const s = game.session!;
      s.player.teleport(new Vector3(x, y, z), facing);
      if (facing !== undefined) s.camera.yaw = facing;
      s.camera.snap();
    },
    setCamera: (yaw: number, pitch?: number) => {
      game.camera.yaw = yaw;
      if (pitch !== undefined) game.camera.pitch = pitch;
    },
    advance: (seconds: number) => game.loop.advance(seconds),
    setManual: (m: boolean) => (game.loop.manual = m),
    /** Press E on whatever is in front of the player. */
    interact: () => game.session!.interact(),
    /** Pick these choice indices, in order, in upcoming dialogues. */
    choose: (...indices: number[]) => {
      game.dialogue.autoChoices.push(...indices);
    },
    idle: () => game.idle(),
    newGame: () => game.newGame(),
    continueGame: () => game.continueGame(),
    save: () => game.save(),
    loadLevel: (id: string, spawn = 'default') => game.loadLevel(id, spawn),
  };
  (window as unknown as { __tw: typeof api }).__tw = api;
}

void boot();
