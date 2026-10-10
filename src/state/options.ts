/** Rebindable keys (KeyboardEvent.code values). Arrow keys always move too. */
export interface KeyBindings {
  forward: string;
  back: string;
  left: string;
  right: string;
  jump: string;
  interact: string;
  album: string;
}

export const DEFAULT_KEYS: KeyBindings = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', interact: 'KeyE', album: 'KeyC' };

/** The bindings in force (kept in step by Game.applyOptions), for the dialogue, shop and prompts. */
export const liveKeys: KeyBindings = { ...DEFAULT_KEYS };

/** Keys that can't be rebound: they already do something fixed. */
export const RESERVED_KEYS = new Set(['Escape', 'KeyP', 'Backquote', 'Enter', 'NumpadEnter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`)]);

/** 'KeyW' → 'W', 'Space' → 'Space', 'ArrowUp' → 'Up', 'Digit1' → '1'. */
export function keyName(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '');
}

/** Player-facing settings (the Options menu). Stored separately from the save. */
export interface Options {
  /** Multiplies the tuned mouse sensitivity. */
  sensitivity: number;
  invertY: boolean;
  music: number;
  sfx: number;
  quality: 'high' | 'low';
  showFps: boolean;
  /** The next-goal line and compass in the HUD. */
  guide: boolean;
  keys: KeyBindings;
}

const KEY = 'thistlewick.options';

export const DEFAULT_OPTIONS: Options = {
  sensitivity: 1,
  invertY: false,
  music: 0.5,
  sfx: 0.7,
  quality: 'high',
  showFps: false,
  guide: true,
  keys: { ...DEFAULT_KEYS },
};

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<Options>;
      return { ...DEFAULT_OPTIONS, ...o, keys: { ...DEFAULT_KEYS, ...(o.keys ?? {}) } };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_OPTIONS };
}

export function saveOptions(o: Options): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    // ignore
  }
}
