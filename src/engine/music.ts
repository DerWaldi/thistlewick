/**
 * Procedural music: two small original pieces, sequenced live with WebAudio.
 * Moods cross-fade; each has its own scheduler so it resumes where it left off.
 * Files in public/music/<mood>.mp3 (if present) are used instead of the
 * synthesised version, so CC0 recordings can be dropped in later.
 */
export type Mood = 'hub' | 'dungeon' | 'title';

type Note = [midi: number | null, beats: number];
interface Bar {
  chord: number[]; // accompaniment chord tones (MIDI)
  bass: number;
  melody: Note[];
}

/** How a section is played. The same bars sound different in different sections. */
interface Arrangement {
  lead: 'box' | 'flute' | 'bell' | 'none';
  /** Transpose the lead (semitones). */
  shift?: number;
  harp: 'chords' | 'arp' | 'none';
  bass: 'waltz' | 'pizz' | 'drone' | 'none';
  /** Soft flute counter-line on the chord's top note. */
  counter?: boolean;
  /** Chime on the last beat of every fourth bar. */
  chimes?: boolean;
  /** Little grace notes before some melody notes. */
  ornaments?: boolean;
  pad?: number;
  ticks?: boolean;
  /** Overall loudness of this section. */
  dyn?: number;
}

interface Section {
  bars: Bar[];
  arr: Arrangement;
}

interface Song {
  bpm: number;
  beatsPerBar: number;
  sections: Section[];
}

const DM = [62, 65, 69];
const G = [62, 67, 71];
const C = [60, 64, 67];
const AM = [60, 64, 69];
const BB = [62, 65, 70];
const A = [61, 64, 69];
const F = [60, 65, 69];
const GM = [62, 67, 70];

// "The Thistlewick Waltz" (D dorian, 3/4).
const WALTZ_A: Bar[] = [
  { chord: DM, bass: 38, melody: [[69, 1], [74, 1], [77, 1]] },
  { chord: G, bass: 43, melody: [[76, 2], [74, 1]] },
  { chord: C, bass: 36, melody: [[72, 1], [76, 1], [79, 1]] },
  { chord: AM, bass: 45, melody: [[76, 2], [72, 1]] },
  { chord: DM, bass: 38, melody: [[74, 1], [77, 1], [81, 1]] },
  { chord: G, bass: 43, melody: [[79, 1], [77, 1], [74, 1]] },
  { chord: BB, bass: 46, melody: [[77, 1.5], [76, 0.5], [74, 1]] },
  { chord: A, bass: 45, melody: [[73, 3]] },
];
const WALTZ_A2: Bar[] = [
  { chord: DM, bass: 38, melody: [[81, 1], [77, 1], [74, 1]] },
  { chord: G, bass: 43, melody: [[71, 1], [74, 1], [79, 1]] },
  { chord: C, bass: 36, melody: [[79, 2], [76, 1]] },
  { chord: F, bass: 41, melody: [[77, 1], [72, 1], [69, 1]] },
  { chord: BB, bass: 46, melody: [[74, 1], [77, 1], [82, 1]] },
  { chord: A, bass: 45, melody: [[81, 2], [79, 1]] },
  { chord: GM, bass: 43, melody: [[77, 1], [76, 1], [73, 1]] },
  { chord: DM, bass: 38, melody: [[74, 2], [null, 1]] },
];
// The middle section, in F major: brighter, flute-led.
const WALTZ_B: Bar[] = [
  { chord: F, bass: 41, melody: [[72, 1.5], [74, 0.5], [77, 1]] },
  { chord: C, bass: 36, melody: [[76, 2], [72, 1]] },
  { chord: DM, bass: 38, melody: [[74, 1], [77, 1], [81, 1]] },
  { chord: BB, bass: 46, melody: [[79, 2], [77, 1]] },
  { chord: F, bass: 41, melody: [[77, 1], [81, 1], [84, 1]] },
  { chord: C, bass: 36, melody: [[84, 1], [81, 1], [79, 1]] },
  { chord: GM, bass: 43, melody: [[77, 1], [79, 1], [74, 1]] },
  { chord: A, bass: 45, melody: [[76, 2], [73, 1]] },
];
const WALTZ_INTRO: Bar[] = [
  { chord: DM, bass: 38, melody: [] },
  { chord: A, bass: 45, melody: [] },
];

const WALTZ: Song = {
  bpm: 104,
  beatsPerBar: 3,
  sections: [
    { bars: WALTZ_INTRO, arr: { lead: 'none', harp: 'arp', bass: 'none', pad: 0.02, dyn: 0.8 } },
    { bars: WALTZ_A, arr: { lead: 'box', harp: 'chords', bass: 'waltz', pad: 0.02 } },
    { bars: WALTZ_A2, arr: { lead: 'box', harp: 'arp', bass: 'waltz', pad: 0.02, ornaments: true } },
    { bars: WALTZ_B, arr: { lead: 'flute', harp: 'arp', bass: 'pizz', pad: 0.025, dyn: 0.9 } },
    { bars: WALTZ_B, arr: { lead: 'box', shift: 12, harp: 'chords', bass: 'pizz', counter: true, pad: 0.02, dyn: 0.85 } },
    { bars: WALTZ_A, arr: { lead: 'box', harp: 'arp', bass: 'waltz', counter: true, chimes: true, pad: 0.022, dyn: 1.05 } },
    { bars: WALTZ_A2, arr: { lead: 'flute', harp: 'chords', bass: 'waltz', chimes: true, ornaments: true, pad: 0.022 } },
    { bars: WALTZ_INTRO, arr: { lead: 'none', harp: 'none', bass: 'none', pad: 0.03, dyn: 0.7 } },
  ],
};

const TITLE: Song = {
  bpm: 86,
  beatsPerBar: 3,
  sections: [
    { bars: WALTZ_INTRO, arr: { lead: 'none', harp: 'arp', bass: 'none', pad: 0.03 } },
    { bars: WALTZ_A, arr: { lead: 'box', harp: 'none', bass: 'none', pad: 0.03, dyn: 0.85 } },
    { bars: WALTZ_B, arr: { lead: 'flute', harp: 'arp', bass: 'none', pad: 0.03, dyn: 0.8 } },
    { bars: WALTZ_A2, arr: { lead: 'box', harp: 'chords', bass: 'none', pad: 0.03, chimes: true, dyn: 0.85 } },
  ],
};

const AMIN = [57, 60, 64];
const FMAJ = [57, 60, 65];
const GMAJ = [55, 59, 62];
const EMAJ = [56, 59, 64];
const DMIN = [57, 62, 65];

// "The Tumbling Vaults" (A minor, 4/4): pizzicato bass, sparse bells.
const VAULTS_A: Bar[] = [
  { chord: AMIN, bass: 45, melody: [[76, 2], [72, 2]] },
  { chord: FMAJ, bass: 41, melody: [[69, 3], [null, 1]] },
  { chord: GMAJ, bass: 43, melody: [[71, 1], [74, 1], [72, 2]] },
  { chord: EMAJ, bass: 40, melody: [[71, 2], [68, 2]] },
  { chord: AMIN, bass: 45, melody: [[76, 1], [77, 1], [76, 1], [72, 1]] },
  { chord: FMAJ, bass: 41, melody: [[69, 2], [72, 2]] },
  { chord: DMIN, bass: 38, melody: [[74, 2], [77, 1], [76, 1]] },
  { chord: EMAJ, bass: 40, melody: [[71, 4]] },
];
// A descending lament over the same ground.
const VAULTS_B: Bar[] = [
  { chord: AMIN, bass: 45, melody: [[81, 3], [79, 1]] },
  { chord: GMAJ, bass: 43, melody: [[77, 2], [74, 2]] },
  { chord: FMAJ, bass: 41, melody: [[76, 3], [72, 1]] },
  { chord: EMAJ, bass: 40, melody: [[71, 2], [null, 2]] },
  { chord: AMIN, bass: 45, melody: [[72, 1], [74, 1], [76, 2]] },
  { chord: GMAJ, bass: 43, melody: [[74, 1], [71, 1], [67, 2]] },
  { chord: FMAJ, bass: 41, melody: [[69, 2], [65, 2]] },
  { chord: EMAJ, bass: 40, melody: [[68, 4]] },
];

const VAULTS: Song = {
  bpm: 78,
  beatsPerBar: 4,
  sections: [
    { bars: VAULTS_A, arr: { lead: 'bell', harp: 'none', bass: 'pizz', pad: 0.03, ticks: true } },
    { bars: VAULTS_B, arr: { lead: 'flute', shift: -12, harp: 'none', bass: 'drone', pad: 0.035, ticks: true, dyn: 0.85 } },
    { bars: VAULTS_A, arr: { lead: 'bell', shift: 12, harp: 'none', bass: 'pizz', pad: 0.03, ticks: true, ornaments: true, dyn: 0.9 } },
    { bars: VAULTS_B, arr: { lead: 'bell', harp: 'none', bass: 'pizz', counter: true, pad: 0.03, ticks: true } },
  ],
};

export const SONGS: Record<Mood, Song> = {
  hub: WALTZ,
  title: TITLE,
  dungeon: VAULTS,
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Track {
  bus: GainNode;
  bar: number;
  nextBarTime: number;
  level: number; // target gain
  file?: AudioBufferSourceNode;
}

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private tracks = new Map<Mood, Track>();
  private mood: Mood | null = null;
  private files = new Map<Mood, AudioBuffer | null>();
  volume = 0.5;
  /** Lowered while dialogue is open. */
  private duck = 1;

  constructor(private getCtx: () => AudioContext | null) {}

  setVolume(v: number): void {
    this.volume = v;
    this.applyMaster();
  }

  setDuck(on: boolean): void {
    this.duck = on ? 0.55 : 1;
    this.applyMaster();
  }

  private applyMaster(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume * this.duck * 0.55, this.ctx.currentTime, 0.4);
  }

  setMood(mood: Mood): void {
    this.mood = mood;
    if (!this.ctx) return;
    for (const [m, t] of this.tracks) {
      t.level = m === mood ? 1 : 0;
      t.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      t.bus.gain.setTargetAtTime(t.level, this.ctx.currentTime, m === mood ? 1.2 : 0.8);
    }
    if (!this.tracks.has(mood)) this.addTrack(mood);
  }

  /** Call every frame; schedules notes a little ahead. */
  update(): void {
    if (!this.ctx) {
      const c = this.getCtx();
      if (!c || c.state !== 'running') return;
      this.init(c);
    }
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    for (const [mood, t] of this.tracks) {
      if (t.level === 0 && t.bus.gain.value < 0.01) {
        // Silent: park it, and restart from the top of the bar later.
        t.nextBarTime = 0;
        continue;
      }
      if (this.files.get(mood)) {
        this.ensureFile(mood, t);
        continue;
      }
      const song = SONGS[mood];
      const beat = 60 / song.bpm;
      if (t.nextBarTime < now) t.nextBarTime = now + 0.1;
      while (t.nextBarTime < now + 0.6) {
        const { bar, arr, index } = this.barAt(song, t.bar);
        this.scheduleBar(song, bar, arr, index, t.nextBarTime, beat, t.bus);
        t.nextBarTime += beat * song.beatsPerBar;
        t.bar++;
      }
    }
  }

  private init(c: AudioContext): void {
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    this.applyMaster();
    // A soft hall reverb from a synthesised impulse response.
    this.reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.6);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
    if (this.mood) this.setMood(this.mood);
    for (const m of ['hub', 'dungeon', 'title'] as Mood[]) void this.tryLoadFile(m);
  }

  private addTrack(mood: Mood): void {
    const c = this.ctx!;
    const bus = c.createGain();
    bus.gain.value = 0;
    bus.connect(this.master!);
    bus.connect(this.reverb!);
    bus.gain.setTargetAtTime(1, c.currentTime, 1.2);
    this.tracks.set(mood, { bus, bar: 0, nextBarTime: 0, level: 1 });
  }

  /** Optional recorded tracks: public/music/<mood>.mp3. */
  private async tryLoadFile(mood: Mood): Promise<void> {
    if (this.files.has(mood)) return;
    this.files.set(mood, null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}music/${mood}.mp3`);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) return;
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.files.set(mood, buf);
    } catch {
      // No file: keep the synthesised version.
    }
  }

  private ensureFile(mood: Mood, t: Track): void {
    if (t.file) return;
    const src = this.ctx!.createBufferSource();
    src.buffer = this.files.get(mood)!;
    src.loop = true;
    src.connect(t.bus);
    src.start();
    t.file = src;
  }

  // ---------------------------------------------------------------- arrangement

  private barAt(song: Song, n: number): { bar: Bar; arr: Arrangement; index: number } {
    const total = song.sections.reduce((a, sec) => a + sec.bars.length, 0);
    let i = n % total;
    for (const sec of song.sections) {
      if (i < sec.bars.length) return { bar: sec.bars[i], arr: sec.arr, index: i };
      i -= sec.bars.length;
    }
    return { bar: song.sections[0].bars[0], arr: song.sections[0].arr, index: 0 };
  }

  private scheduleBar(song: Song, bar: Bar, arr: Arrangement, index: number, t0: number, beat: number, out: GainNode): void {
    const dyn = (arr.dyn ?? 1) * (0.92 + Math.random() * 0.16); // a little human variation
    const shift = arr.shift ?? 0;
    const beats = song.beatsPerBar;

    // Lead melody.
    let t = t0;
    for (const [m, len] of bar.melody) {
      if (m !== null && arr.lead !== 'none') {
        const f = hz(m + shift);
        if (arr.ornaments && len >= 1 && Math.random() < 0.18) {
          // A quick grace note from a step above.
          this.musicBox(out, t - 0.07, hz(m + shift + 2), 0.1, 0.06 * dyn);
        }
        if (arr.lead === 'box') this.musicBox(out, t, f, len * beat, 0.16 * dyn);
        else if (arr.lead === 'flute') this.flute(out, t, f, len * beat, 0.09 * dyn);
        else this.bell(out, t, f, 0.11 * dyn);
      }
      t += len * beat;
    }

    // Counter-line: the chord's top note, an octave up, held softly.
    if (arr.counter) this.flute(out, t0 + beat, hz(bar.chord[2] + 12), (beats - 1) * beat, 0.035 * dyn);

    // Chimes at phrase ends.
    if (arr.chimes && index % 4 === 3) this.bell(out, t0 + (beats - 1) * beat, hz(bar.chord[0] + 24), 0.05 * dyn);

    // Harp.
    if (arr.harp === 'chords') {
      for (let b = 1; b < beats; b++) bar.chord.forEach((m, i) => this.pluck(out, t0 + b * beat + i * 0.025, hz(m - 12), 0.05 * dyn));
    } else if (arr.harp === 'arp') {
      const up = [...bar.chord.map((m) => m - 12), ...bar.chord];
      const steps = beats * 2;
      for (let i = 0; i < steps; i++) this.pluck(out, t0 + i * beat * 0.5, hz(up[i % up.length]), (i === 0 ? 0.06 : 0.04) * dyn);
    }

    // Bass.
    if (arr.bass === 'waltz') {
      this.bass(out, t0, hz(bar.bass), beat * 1.6, 0.22 * dyn);
    } else if (arr.bass === 'pizz') {
      const pattern = beats === 3 ? [0, 7, 12] : [0, 7, 12, 7, 0, 7, 12, 7];
      const step = beats === 3 ? beat : beat * 0.5;
      pattern.forEach((iv, i) => this.pluck(out, t0 + i * step, hz(bar.bass + iv - (beats === 3 ? 0 : 12)), (i % 4 === 0 ? 0.12 : 0.08) * dyn, 0.35));
    } else if (arr.bass === 'drone') {
      this.bass(out, t0, hz(bar.bass - 12), beat * beats, 0.16 * dyn);
    }

    if (arr.pad) this.pad(out, t0, bar.chord.map((m) => hz(m - 12)), beat * beats, arr.pad * dyn);
    if (arr.ticks) for (const b of [1, 3]) if (b < beats) this.tick(out, t0 + b * beat);
  }

  private flute(out: AudioNode, t: number, f: number, len: number, vol: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.1, len * 0.7));
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.15);
    const o = this.osc('sine', f, t, len + 0.2, g);
    // Gentle vibrato that fades in.
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.004, t + 0.4);
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + len + 0.25);
    const g2 = c.createGain();
    g2.gain.value = 0.18;
    g2.connect(g);
    this.osc('triangle', f * 2, t, len + 0.2, g2);
  }

  // ---------------------------------------------------------------- instruments

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, out: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private musicBox(out: AudioNode, t: number, f: number, len: number, vol: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    const decay = Math.max(1.2, len * 1.4);
    this.env(g, t, vol, 0.004, decay);
    this.osc('sine', f, t, decay, g);
    const g2 = this.ctx!.createGain();
    g2.gain.value = 0.3;
    g2.connect(g);
    this.osc('sine', f * 2.003, t, decay, g2);
    const g3 = this.ctx!.createGain();
    g3.gain.value = 0.08;
    g3.connect(g);
    this.osc('triangle', f * 4.01, t, decay * 0.5, g3);
  }

  private bell(out: AudioNode, t: number, f: number, vol: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    this.env(g, t, vol, 0.003, 2.6);
    this.osc('sine', f, t, 2.6, g);
    const g2 = this.ctx!.createGain();
    g2.gain.value = 0.25;
    g2.connect(g);
    this.osc('sine', f * 2.76, t, 1.4, g2);
  }

  private pluck(out: AudioNode, t: number, f: number, vol: number, decay = 0.7): void {
    const c = this.ctx!;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = c.createGain();
    lp.connect(g).connect(out);
    this.env(g, t, vol, 0.003, decay);
    this.osc('triangle', f, t, decay, lp);
  }

  private bass(out: AudioNode, t: number, f: number, len: number, vol: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    this.env(g, t, vol, 0.01, len);
    this.osc('sine', f, t, len, g);
  }

  private pad(out: AudioNode, t: number, freqs: number[], len: number, vol: number): void {
    const c = this.ctx!;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = c.createGain();
    lp.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + len * 1.05);
    for (const f of freqs) {
      this.osc('sawtooth', f * 0.997, t, len * 1.05, lp);
      this.osc('sawtooth', f * 1.003, t, len * 1.05, lp);
    }
  }

  private noiseBuf: AudioBuffer | null = null;

  private tick(out: AudioNode, t: number): void {
    const c = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 4;
    const g = c.createGain();
    src.connect(bp).connect(g).connect(out);
    this.env(g, t, 0.05, 0.002, 0.06);
    src.start(t);
    src.stop(t + 0.1);
  }
}
