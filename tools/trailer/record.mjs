/*
 * Records the trailer: node tools/trailer/record.mjs [--stills]
 *
 * Drives a dev build of the game in headless Chromium (?test mode: the simulation only moves
 * when stepped), plays tools/trailer/director.js shot by shot at 30 fps, and pipes each frame
 * into ffmpeg; the soundtrack is the game's own music, rendered offline from its sequencer with
 * the moods changing on the shots' cues. Writes tools/trailer/out/thistlewick-trailer.mp4.
 * --stills writes three frames per shot to tools/trailer/out/stills/ instead (quick review).
 * Needs ffmpeg on the PATH. Uses the dev server on :5173 if it's up, else starts one.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const stills = process.argv.includes('--stills');
mkdirSync(join(out, 'stills'), { recursive: true });
const W = 1920;
const H = 1080;

async function server() {
  for (const url of ['http://localhost:5173', 'http://localhost:5198']) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => {} };
    } catch {
      // not running
    }
  }
  const vite = spawn('npx', ['vite', '--port', '5198', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      if ((await fetch('http://localhost:5198')).ok) return { url: 'http://localhost:5198', stop: () => vite.kill() };
    } catch {
      // still starting
    }
  }
  throw new Error('vite did not start');
}

const { url, stop } = await server();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${url}/?test&level=hub`);
await page.waitForFunction(() => window.__tw && window.__tw.game.session, null, { timeout: 120_000 });
await page.addScriptTag({ path: join(here, 'director.js') });
const timeline = await page.evaluate(() => window.trailer.timeline());
const total = timeline.reduce((t, s) => t + s.dur, 0);
console.log(`${timeline.length} shots, ${total.toFixed(1)} s`);

if (!stills) {
  // The soundtrack: the game's sequencer into an OfflineAudioContext, stepped a quarter
  // second at a time (it schedules a little ahead of the clock), moods on the shots' cues.
  const wav = await page.evaluate(
    async ({ timeline, total }) => {
      const { Music } = await import('/src/engine/music.ts');
      const rate = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil((total + 1) * rate), rate);
      const music = new Music(() => null);
      music.volume = 0.9;
      music.init(ctx);
      const cues = timeline.filter((s) => s.music).map((s) => ({ at: Math.max(0, s.start - 0.6), mood: s.music }));
      for (let t = 0; t < total + 1; t += 0.25) {
        ctx.suspend(t).then(() => {
          for (const c of cues) if (!c.done && c.at <= t + 1e-6) {
            c.done = true;
            music.setMood(c.mood);
          }
          music.update();
          ctx.resume();
        });
      }
      const buf = await ctx.startRendering();
      // 16-bit PCM WAV.
      const n = buf.length;
      const data = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
      str(0, 'RIFF');
      data.setUint32(4, 36 + n * 4, true);
      str(8, 'WAVEfmt ');
      data.setUint32(16, 16, true);
      data.setUint16(20, 1, true);
      data.setUint16(22, 2, true);
      data.setUint32(24, rate, true);
      data.setUint32(28, rate * 4, true);
      data.setUint16(32, 4, true);
      data.setUint16(34, 16, true);
      str(36, 'data');
      data.setUint32(40, n * 4, true);
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      for (let i = 0; i < n; i++) {
        data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
        data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
      }
      let bin = '';
      const bytes = new Uint8Array(data.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { timeline, total },
  );
  writeFileSync(join(out, 'music.wav'), Buffer.from(wav, 'base64'));
  console.log('soundtrack rendered');
}

const ffmpeg = stills
  ? null
  : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', join(out, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = ffmpeg ? new Promise((r) => ffmpeg.on('exit', r)) : null;

for (let i = 0; i < timeline.length; i++) {
  const { name, frames } = await page.evaluate((i) => window.trailer.begin(i), i);
  const keep = stills ? new Set([2, Math.floor(frames / 2), frames - 3]) : null;
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const render = !keep || keep.has(f);
    await page.evaluate(([i, f, render]) => window.trailer.step(i, f, render), [i, f, render]);
    if (!render) continue;
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (stills) writeFileSync(join(out, 'stills', `${String(i).padStart(2, '0')}-${name}-${f}.jpg`), jpg);
    else if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  }
  console.log(`${name}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
await browser.close();
stop();

if (ffmpeg) {
  ffmpeg.stdin.end();
  await done;
  // Music under the picture, at the usual online loudness, faded out over the end card.
  await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, 'video.mp4'), '-i', join(out, 'music.wav'), '-af', `afade=t=in:d=0.8,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '48000', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(out, 'thistlewick-trailer.mp4')], { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}`))));
  });
  console.log(`wrote ${join(out, 'thistlewick-trailer.mp4')}`);
}
