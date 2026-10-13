import { loadModels } from './entities/models';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { createTuningPanel } from './engine/debug';
import { Game } from './game';
import { device, detectTouch } from './state/device';
import { loadSave } from './state/save';
import { Menu } from './ui/menu';
import { TouchControls } from './ui/touch';

const params = new URLSearchParams(location.search);
/**
 * Dev tools (the test API, sandboxes, trial resets, the tuning panel) only exist in dev
 * builds, or a build made with VITE_E2E=1: on the live site they'd let anyone skip the game
 * or wreck their save. `?debug` (the FPS readout) works everywhere.
 */
const devTools = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';
const debug = params.has('debug') || import.meta.env.DEV;
const testMode = devTools && params.has('test');
/** `?level=gym` (or any level id) starts a sandbox there: no title, no saving. */
const sandboxLevel = devTools ? params.get('level') : null;
// Phones and tablets (or `?touch`): on-screen controls instead of mouse and keyboard.
device.touch = detectTouch(params);
if (device.touch) document.body.classList.add('touch');

/** On a phone: the whole screen, held sideways (Android; iOS Safari keeps its bars). */
function fullscreen(): void {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as unknown as { lock?(o: string): Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}

async function boot(): Promise<void> {
  // Physics and the foe models load together; the game starts once both are in.
  await Promise.all([RAPIER.init(), loadModels()]);
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas, { manual: testMode });
  game.debugStats = debug;
  game.applyOptions();
  if (testMode) game.dialogue.autoAdvance = true;
  // Aiming with a thumb is coarser than with a mouse: a little more forgiveness.
  if (device.touch) game.tuning.cast.aimCone = 16;

  const menu = new Menu(game.options);
  menu.captureKey = (fn) => (game.input.captureKey = fn);
  menu.cancelCapture = () => (game.input.captureKey = null);
  menu.onOptions = () => game.applyOptions();
  let playing = false;

  // A mouse is captured to steer the camera; a touch screen has nothing to capture.
  const lock = () => (device.touch ? (testMode ? undefined : fullscreen()) : game.input.requestLock());
  const start = (how: 'new' | 'continue') => {
    if (how === 'new' || !game.continueGame()) game.newGame();
    game.beginPlay();
    playing = true;
    menu.hide();
    lock();
  };
  const pause = () => {
    game.paused = true;
    menu.show('pause', { state: game.state });
  };
  const resume = () => {
    // Whatever was pressed in the menus (a gamepad A, say) mustn't carry into play.
    game.input.clearPressed();
    menu.hide();
    game.paused = false;
    lock();
  };

  menu.onAction = (a) => {
    switch (a) {
      case 'continue':
        start('continue');
        break;
      case 'new':
        if (loadSave() && !confirm('Start a new game? Your current progress will be lost.')) return;
        start('new');
        break;
      case 'resume':
        resume();
        break;
      case 'album':
        menu.hide();
        game.album.open();
        break;
      case 'quit':
        game.save();
        location.reload();
        break;
    }
  };

  // Dev: `?resetTrial=glimmerwick` makes a finished trial playable again in your save.
  const reset = devTools ? params.get('resetTrial') : null;
  if (reset) {
    const ok = game.resetTrialInSave(reset);
    history.replaceState(null, '', location.pathname);
    game.events.emit('toast', { text: ok ? `The ${reset} trial is ready to play again.` : `Couldn't reset "${reset}".`, kind: 'info' });
  }

  if (sandboxLevel) {
    game.startSandbox(sandboxLevel);
    game.beginPlay();
    playing = true;
    if (!testMode) menu.show('pause', { state: game.state });
  } else if (testMode) {
    if (params.has('new') || !game.continueGame()) game.newGame();
    game.beginPlay();
    playing = true;
  } else {
    game.showBackdrop();
    menu.show('title', { canContinue: !!loadSave() });
  }
  game.start();
  const loading = document.getElementById('loading');
  loading?.classList.add('done');
  setTimeout(() => loading?.remove(), 600);
  if (testMode) loading?.remove();

  canvas.addEventListener('click', () => {
    if (!device.touch && playing && !game.input.locked && !menu.isOpen) lock();
  });
  if (device.touch) {
    new TouchControls(game.input, {
      prompt: () => (playing ? (game.session?.focus?.prompt() ?? null) : null),
      active: () => playing && !menu.isOpen && !game.isHalted,
      onPause: () => {
        if (playing && !menu.isOpen) pause();
      },
    });
    // The options screen talks about the mouse and keys; on a phone it's the look speed.
    const sens = document.querySelector('label[for="opt-sens"]');
    if (sens) sens.textContent = 'Look sensitivity';
    const inv = document.querySelector('label[for="opt-invert"]');
    if (inv) inv.textContent = 'Invert look';
  }
  // Losing the mouse mid-game (Esc, alt-tab) pauses, unless a UI that needs the mouse is up.
  game.input.onLock((locked) => {
    if (!playing || testMode) return;
    if (locked) {
      menu.hide();
      game.paused = false;
    } else if (!game.album.isOpen && !game.shop.isOpen && !menu.isOpen) {
      pause();
    }
  });
  // The Golden Thistle: the end-of-year summary and credits; Back leads to the pause menu.
  game.events.on('yearComplete', () => {
    if (testMode) return;
    game.paused = true;
    document.exitPointerLock();
    menu.showEnding(game.state);
  });
  // A gamepad's Start pauses and resumes.
  game.onPadStart = () => {
    if (!playing || testMode || game.shop.isOpen || game.album.isOpen) return;
    if (menu.screen === 'pause') resume();
    else if (!menu.isOpen) {
      pause();
      if (game.input.locked) document.exitPointerLock();
    }
  };
  game.album.onClose = () => {
    // With a mouse, closing the album left the pointer free: pause until it's captured again.
    if (!playing || testMode || device.touch) return;
    pause();
  };
  game.shop.onClose = () => {
    if (playing && !testMode) lock();
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && playing && !e.repeat) game.screenshot();
  });

  let panel: { toggle(): void } | null = null;
  window.addEventListener('keydown', async (e) => {
    if (e.code !== 'Backquote' || !devTools) return;
    panel ??= await createTuningPanel(game.tuning);
    panel.toggle();
    if (game.input.locked) document.exitPointerLock();
  });

  if (devTools) exposeTestApi(game);
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
    /** Draw the next frame (tests only draw on request). */
    render: () => game.loop.requestDraw(),
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
