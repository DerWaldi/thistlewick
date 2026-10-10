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

  constructor(events: EventBus) {
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

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
