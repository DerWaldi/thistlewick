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
