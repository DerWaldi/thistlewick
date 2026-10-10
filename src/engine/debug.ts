import { DEFAULT_TUNING, saveTuning, TUNING_KEY, type Tuning } from '../data/tuning';

type Range = [number, number, number?];

/** Slider ranges for the tuning panel; anything not listed gets a sensible default. */
const RANGES: Record<string, Range> = {
  runSpeed: [2, 14],
  groundAccel: [5, 150],
  groundDecel: [5, 150],
  turnaroundAccel: [5, 200],
  airAccel: [0, 80],
  airDecel: [0, 40],
  turnRate: [2, 40],
  maxSlope: [20, 70, 1],
  iceAccelScale: [0.01, 1],
  iceDecelScale: [0.005, 1],
  height: [0.5, 4],
  gravity: [5, 80],
  fallGravityScale: [1, 4],
  cutGravityScale: [1, 6],
  maxFallSpeed: [5, 60],
  coyoteTime: [0, 0.4, 0.01],
  bufferTime: [0, 0.4, 0.01],
  bounceHeight: [1, 15],
  bounceBoostScale: [1, 2.5],
  reach: [0.1, 1.2],
  minAbove: [-1, 0.5],
  maxAbove: [0.3, 2],
  climbTime: [0.1, 1.2],
  regrabCooldown: [0, 1],
  shimmySpeed: [0.3, 5],
  distance: [2, 12],
  minPitch: [-1.5, 0],
  maxPitch: [0, 1.4],
  sensitivity: [0.0005, 0.006, 0.0001],
  followSharpness: [1, 40],
  verticalSharpness: [0.5, 20],
  lookAhead: [0, 1],
  recenterDelay: [0, 5],
  recenterSpeed: [0, 6],
  baseFov: [40, 90, 1],
  speedFov: [0, 15],
};

/**
 * Live tuning panel (toggle with the backquote key). Loaded lazily so lil-gui
 * stays out of the main bundle's critical path.
 */
export async function createTuningPanel(tuning: Tuning): Promise<{ toggle(): void }> {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'Thistlewick tuning' });
  gui.domElement.style.zIndex = '20';
  const onChange = () => saveTuning(tuning);

  for (const [section, values] of Object.entries(tuning) as [string, Record<string, number | boolean>][]) {
    const folder = gui.addFolder(section);
    for (const key of Object.keys(values)) {
      const v = values[key];
      if (typeof v === 'boolean') {
        folder.add(values, key).onChange(onChange);
      } else {
        const [min, max, step] = RANGES[key] ?? [0, v * 3 || 1];
        folder.add(values, key, min, max, step ?? (max - min) / 200).onChange(onChange);
      }
    }
    if (section !== 'move') folder.close();
  }

  const actions = {
    copy: () => {
      void navigator.clipboard?.writeText(JSON.stringify(tuning, null, 2));
    },
    reset: () => {
      localStorage.removeItem(TUNING_KEY);
      const d = structuredClone(DEFAULT_TUNING) as unknown as Record<string, Record<string, unknown>>;
      const t = tuning as unknown as Record<string, Record<string, unknown>>;
      for (const s of Object.keys(d)) Object.assign(t[s], d[s]);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
  gui.add(actions, 'copy').name('Copy tuning JSON');
  gui.add(actions, 'reset').name('Reset to defaults');
  gui.hide();

  return {
    toggle: () => (gui._hidden ? gui.show() : gui.hide()),
  };
}
