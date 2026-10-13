import { SWEETS } from '../data/sweets';
import type { EventBus } from './events';

/**
 * Tiny procedural sound effects via WebAudio. No files: every sound is a short
 * synthesised envelope. The context starts on the first user gesture.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.5;
  /** Where the player's ears are, for sounds that fade with distance (foe footsteps). */
  listener: (() => { x: number; y: number; z: number } | null) | null = null;

  constructor(events: EventBus) {
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // iOS Safari only lets sound start from some gestures; a finger lifting is one.
    window.addEventListener('touchend', unlock);

    events.on('jump', () => this.tone(330, 520, 0.12, 'triangle', 0.18));
    events.on('land', ({ impact }) => {
      if (impact > 3) this.thud(Math.min(1, impact / 16));
    });
    events.on('bounce', ({ power }) => this.tone(180, 720 + power * 200, 0.32, 'sine', 0.35));
    events.on('ledgeGrab', () => this.thud(0.35, 900));
    events.on('ledgeClimb', () => this.tone(260, 380, 0.1, 'triangle', 0.1));
    events.on('splash', () => this.splash());
    events.on('respawn', () => this.tone(600, 900, 0.25, 'sine', 0.12));
    events.on('skid', () => this.hiss(0.12, 2400, 0.08));

    // casting
    events.on('chargeStart', () => this.tone(220, 660, 0.9, 'triangle', 0.08));
    events.on('cast', ({ charge }) => {
      this.hiss(0.18, 1800 + charge * 1200, 0.18);
      this.tone(520 + charge * 200, 900 + charge * 400, 0.16, 'sawtooth', 0.05);
    });
    events.on('spellHit', ({ charge }) => {
      this.thud(0.7 + charge * 0.3, 120);
      this.tone(700, 300, 0.12, 'square', 0.05);
    });
    events.on('fizzle', () => this.tone(300, 120, 0.25, 'triangle', 0.1));
    // world
    events.on('sweet', ({ kind }) => {
      const base = SWEETS[kind].pitch;
      this.tone(base, base * 1.5, 0.09, 'sine', 0.14);
      setTimeout(() => this.tone(base * 1.5, base * 2, 0.12, 'sine', 0.1), 60);
    });
    events.on('card', ({ isNew }) => {
      if (isNew) [659, 784, 988, 1319].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.3, 'sine', 0.12), i * 80));
    });
    events.on('secret', () => [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f * 1.01, 0.4, 'triangle', 0.1), i * 70)));
    events.on('quest', ({ stage }) => {
      const notes = stage === 'start' ? [523, 659] : stage === 'found' ? [659, 784, 988] : [523, 659, 784, 1047];
      notes.forEach((f, i) => setTimeout(() => this.tone(f, f, 0.35, 'triangle', 0.11), i * 90));
    });
    events.on('points', () => this.tone(880, 1320, 0.15, 'sine', 0.06));
    events.on('checkpoint', () => [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.35, 'sine', 0.12), i * 90)));
    events.on('blockSlide', () => this.hiss(0.45, 380, 0.25));
    events.on('blockStop', ({ fell }) => this.thud(fell ? 1 : 0.6, fell ? 90 : 130));
    events.on('gateMove', () => {
      this.hiss(0.9, 260, 0.18);
      this.tone(90, 70, 0.9, 'sawtooth', 0.04);
    });
    events.on('signal', ({ on }) => this.tone(on ? 880 : 440, on ? 1320 : 330, 0.08, 'square', 0.05));
    events.on('switchTick', () => this.tone(1500, 1500, 0.04, 'square', 0.05));
    // Locks: a rising two-note chime and a click; relocking is a dull clack.
    events.on('unlock', () => {
      this.tone(1900, 1900, 0.04, 'square', 0.05);
      setTimeout(() => this.tone(784, 1046, 0.18, 'triangle', 0.1), 40);
      setTimeout(() => this.tone(1046, 1568, 0.25, 'sine', 0.08), 140);
    });
    events.on('relock', () => {
      this.tone(600, 300, 0.08, 'square', 0.07);
      this.thud(0.3, 220);
    });
    events.on('chestOpen', () => {
      this.tone(220, 330, 0.3, 'sawtooth', 0.03);
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.25, 'sine', 0.09), 200 + i * 70));
    });
    events.on('bridgeMove', () => {
      this.tone(110, 70, 1.4, 'sawtooth', 0.04);
      this.hiss(1.2, 300, 0.15);
    });
    events.on('vaultOpen', () => {
      this.thud(1, 60);
      this.tone(70, 55, 2, 'sawtooth', 0.06);
      setTimeout(() => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.6, 'triangle', 0.08), i * 110)), 900);
    });
    // Springwell: a rising boing as a pad wakes up, a sagging one as it gives out.
    events.on('springOn', ({ charged }) => {
      this.tone(220, charged ? 880 : 660, 0.35, 'sine', 0.12);
      setTimeout(() => this.tone(440, charged ? 1320 : 990, 0.25, 'triangle', 0.06), 90);
    });
    events.on('springOff', () => this.tone(500, 160, 0.4, 'sine', 0.08));
    // Glimmerwick: a soft whoomph and a shimmer; a little sigh as a lamp goes out.
    events.on('lampLit', ({ charged }) => {
      this.hiss(0.35, 1400, 0.08);
      [659, 988, charged ? 1568 : 1319].forEach((f, i) => setTimeout(() => this.tone(f, f * 1.01, 0.5, 'sine', 0.06), i * 60));
    });
    events.on('lampOut', () => this.tone(700, 260, 0.45, 'triangle', 0.05));
    events.on('wallFade', () => [1046, 1319, 1568].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.98, 0.35, 'sine', 0.04), i * 50)));
    // Cindersnap: a crackling whoosh as something catches; a sooty puff when braziers gutter out.
    events.on('burn', () => {
      this.hiss(0.9, 700, 0.22);
      this.tone(160, 90, 0.6, 'sawtooth', 0.04);
      for (let i = 0; i < 6; i++) setTimeout(() => this.hiss(0.05, 2500 + Math.random() * 2000, 0.12), 80 + i * 90 + Math.random() * 60);
    });
    events.on('brazierFail', () => {
      this.hiss(0.6, 400, 0.18);
      this.tone(420, 140, 0.5, 'triangle', 0.08);
    });
    // Rimewhistle: a glassy rising shimmer as water freezes; creaks, then a slushy sigh as it thaws.
    events.on('freeze', ({ charged }) => {
      this.hiss(0.4, 5000, 0.08);
      [1568, 2093, 2637, charged ? 3136 : 2349].forEach((f, i) => setTimeout(() => this.tone(f, f * 1.02, 0.4, 'sine', 0.05), i * 45));
    });
    events.on('iceCreak', () => this.tone(220 + Math.random() * 80, 160, 0.18, 'sawtooth', 0.05));
    events.on('thaw', () => {
      this.hiss(0.6, 900, 0.14);
      this.tone(600, 200, 0.5, 'sine', 0.06);
    });
    events.on('melt', () => {
      this.hiss(0.9, 2400, 0.2);
      this.tone(500, 150, 0.6, 'triangle', 0.05);
    });
    // Thistledown: a soft rising whoosh and a high, airy chime; a little bump on arrival.
    events.on('levitate', () => {
      this.hiss(0.8, 3200, 0.08);
      [784, 1175, 1568].forEach((f, i) => setTimeout(() => this.tone(f, f * 1.03, 0.5, 'sine', 0.04), i * 70));
    });
    events.on('levitateStop', () => this.tone(330, 300, 0.12, 'triangle', 0.05));
    // Snapweed: a leafy rustle as it rears back, then a wet snap.
    events.on('weedNotice', () => this.hiss(0.4, 1800, 0.08));
    events.on('weedBite', () => {
      this.thud(0.5, 200);
      this.tone(1200, 300, 0.1, 'square', 0.08);
    });
    // Ember Crab: a spitting whoosh for a fireball, a pop where it lands, glassy shattering.
    events.on('crabShoot', () => {
      this.hiss(0.35, 900, 0.12);
      this.tone(300, 600, 0.2, 'sawtooth', 0.04);
    });
    events.on('crabHit', () => this.hiss(0.25, 600, 0.1));
    events.on('crabShatter', () => {
      for (let i = 0; i < 6; i++) setTimeout(() => this.tone(2000 + Math.random() * 1500, 1500, 0.15, 'triangle', 0.05), i * 30);
      this.hiss(0.4, 5000, 0.12);
    });
    events.on('floeSlide', () => this.hiss(0.7, 1200, 0.16));
    // Hexling: a wicked little rising whine as she throws; a fizzing pop where it lands.
    events.on('hexCast', () => {
      this.tone(500, 1400, 0.3, 'sawtooth', 0.04);
      this.tone(760, 1900, 0.3, 'triangle', 0.05);
    });
    events.on('hexHit', () => {
      this.hiss(0.2, 2400, 0.08);
      this.tone(900, 300, 0.18, 'square', 0.04);
    });
    // Sootling: a grunt and a whoosh; a clunk where the bomb lands; a kick; the bang.
    events.on('bombThrow', () => {
      this.tone(180, 120, 0.12, 'square', 0.05);
      this.hiss(0.3, 700, 0.08);
    });
    events.on('bombLand', () => {
      this.thud(0.4, 220);
      this.hiss(0.9, 3200, 0.05);
    });
    events.on('bombKick', () => this.thud(0.5, 300));
    events.on('bombBlast', () => {
      this.thud(1.4, 70);
      this.hiss(0.8, 400, 0.3);
      this.tone(120, 40, 0.5, 'sawtooth', 0.08);
    });
    events.on('foeBanished', () => [880, 660, 440].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.7, 0.18, 'triangle', 0.06), i * 60)));
    events.on('bossRoar', () => {
      this.tone(110, 70, 1.1, 'sawtooth', 0.12);
      this.tone(165, 90, 1.1, 'square', 0.05);
      this.hiss(1, 300, 0.12);
    });
    events.on('bossHit', () => {
      this.thud(1.1, 120);
      this.tone(400, 200, 0.3, 'square', 0.06);
    });
    events.on('bossDown', () => {
      this.thud(1.6, 60);
      [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.5, 'triangle', 0.08), 300 + i * 110));
    });
    events.on('gnarlingScared', () => this.tone(1600, 2200, 0.1, 'square', 0.05));
    events.on('snapNotice', () => this.tone(300, 520, 0.12, 'square', 0.06));
    events.on('snapBite', () => {
      this.thud(0.5, 160);
      this.tone(900, 400, 0.08, 'square', 0.06);
    });
    events.on('snapLocked', () => {
      this.tone(1900, 1900, 0.04, 'square', 0.05);
      this.tone(500, 380, 0.3, 'triangle', 0.08);
    });
    events.on('snapBanished', () => {
      this.thud(0.8, 120);
      this.tone(700, 1400, 0.3, 'triangle', 0.08);
    });
    // A bronze bell: a strike plus inharmonic partials that ring on and fade at different rates.
    events.on('bellRing', () => {
      this.tone(2600, 1800, 0.05, 'triangle', 0.08);
      for (const [f, dur, vol] of [
        [587, 2.2, 0.14],
        [1174, 1.6, 0.06],
        [1621, 1.2, 0.07],
        [2389, 0.8, 0.04],
        [293, 2.6, 0.05],
      ] as const) {
        this.tone(f, f * 0.998, dur, 'sine', vol);
      }
    });
    events.on('hurt', () => {
      this.tone(320, 140, 0.25, 'sawtooth', 0.12);
      this.hiss(0.15, 900, 0.15);
    });
    events.on('faint', () => this.tone(500, 90, 1.2, 'triangle', 0.15));
    events.on('gnarlingNotice', () => this.tone(900, 1400, 0.12, 'square', 0.06));
    events.on('gnarlingStunned', () => {
      this.tone(1200, 500, 0.3, 'triangle', 0.1);
    });
    events.on('rattleClang', () => {
      this.tone(1800, 1700, 0.25, 'square', 0.06);
      this.tone(2400, 2300, 0.2, 'triangle', 0.06);
    });
    events.on('rattleTopple', () => {
      this.thud(1, 70);
      this.hiss(0.6, 1500, 0.2);
    });
    events.on('rattleCollapse', () => {
      for (let i = 0; i < 6; i++) setTimeout(() => this.tone(1200 + Math.random() * 1600, 900, 0.12, 'square', 0.05), i * 70);
    });
    events.on('foeStep', ({ pos, heavy }) => {
      const k = this.near(pos, 10 + heavy * 18);
      if (k <= 0) return;
      this.thud(k * (0.25 + heavy * 0.55), 110 - heavy * 50);
      // Armour clinks with every step.
      if (heavy < 0.9) this.tone(1500 + Math.random() * 300, 1300, 0.05, 'square', 0.015 * k);
    });
    events.on('foeWindup', ({ pos, kind }) => {
      const k = this.near(pos, 26);
      if (k <= 0) return;
      if (kind === 'pull') {
        this.hiss(0.3, 2600, 0.08 * k);
        return;
      }
      // A rising whoosh as the arm (or both fists) goes up.
      this.hiss(kind === 'slam' ? 0.7 : 0.35, kind === 'slam' ? 500 : 900, 0.14 * k);
      this.tone(kind === 'slam' ? 90 : 180, kind === 'slam' ? 260 : 520, kind === 'slam' ? 0.7 : 0.3, 'sawtooth', 0.03 * k);
    });
    events.on('gnarlingBanished', () => {
      this.hiss(0.3, 2600, 0.15);
      [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.15, 'sine', 0.08), i * 60));
    });
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private ready(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  tone(from: number, to: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** The shared audio context (music uses it too), created on the first user gesture. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** A short voice blip for dialogue typewriter text. */
  blip(pitch: number): void {
    this.tone(pitch, pitch * 1.06, 0.045, 'square', 0.035);
  }

  private hiss(dur: number, freq: number, vol: number): void {
    const ctx = this.ready();
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  /** 1 next to the listener, fading to 0 at `range` metres. */
  private near(pos: { x: number; y: number; z: number }, range: number): number {
    const at = this.listener?.();
    if (!at) return 1;
    const d = Math.hypot(pos.x - at.x, pos.y - at.y, pos.z - at.z);
    return Math.max(0, 1 - d / range);
  }

  private thud(k: number, freq = 160): void {
    this.tone(freq, freq * 0.45, 0.12, 'sine', 0.35 * k);
    this.hiss(0.08, 600, 0.15 * k);
  }

  private splash(): void {
    this.hiss(0.5, 1200, 0.3);
    this.hiss(0.3, 3000, 0.15);
    this.tone(500, 150, 0.25, 'sine', 0.12);
  }
}
