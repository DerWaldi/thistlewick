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
};

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_OPTIONS, ...(JSON.parse(raw) as Partial<Options>) };
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
