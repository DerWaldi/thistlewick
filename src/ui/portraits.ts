import type { PortraitSpec } from '../data/portraits';

const cache = new Map<string, string>();

/** Paint a portrait into a data URL (cached). Width/height in CSS pixels; drawn at 2x. */
export function portraitURL(spec: PortraitSpec, w = 160, h = 200): string {
  const key = JSON.stringify(spec) + w + 'x' + h;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  paintPortrait(g, spec, w, h);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/**
 * A storybook bust: gradient backdrop, shoulders in a robe, a round face, hat or
 * hair, and a little prop. Creatures get their own drawings.
 */
export function paintPortrait(g: CanvasRenderingContext2D, s: PortraitSpec, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, s.bg[0]);
  bg.addColorStop(1, s.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Soft vignette rays.
  g.save();
  g.globalAlpha = 0.12;
  g.translate(w / 2, h * 0.45);
  for (let i = 0; i < 12; i++) {
    g.rotate(Math.PI / 6);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-8, -h);
    g.lineTo(8, -h);
    g.fill();
  }
  g.restore();

  const cx = w / 2;
  switch (s.kind) {
    case 'person':
      if (s.robe) person(g, s, cx, w, h);
      break;
    case 'ghost':
      ghost(g, cx, w, h);
      break;
    case 'gnarling':
      gnarling(g, cx, w, h);
      break;
    case 'puddlewump':
      puddlewump(g, cx, w, h);
      break;
    case 'moth':
      moth(g, cx, w, h);
      break;
    case 'lantern':
      lantern(g, cx, w, h);
      break;
  }
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${gg},${b})`;
}

function person(g: CanvasRenderingContext2D, s: PortraitSpec, cx: number, w: number, h: number): void {
  const skin = s.skin ?? '#f0c9a0';
  const robe = s.robe ?? '#46395f';
  const headY = h * 0.42;
  const headR = w * 0.2;

  // Shoulders.
  g.fillStyle = robe;
  g.beginPath();
  g.moveTo(cx - w * 0.42, h);
  g.quadraticCurveTo(cx - w * 0.4, h * 0.62, cx, h * 0.6);
  g.quadraticCurveTo(cx + w * 0.4, h * 0.62, cx + w * 0.42, h);
  g.fill();
  g.fillStyle = shade(robe, 0.75);
  g.beginPath();
  g.moveTo(cx - 10, h * 0.62);
  g.lineTo(cx, h * 0.8);
  g.lineTo(cx + 10, h * 0.62);
  g.fill();

  // Hair behind the head.
  if (s.hair && s.hat !== 'bonnet') blob(g, cx, headY - 4, headR * 1.12, headR * 1.08, s.hair);
  // Head.
  blob(g, cx, headY, headR, headR * 1.05, skin);
  blob(g, cx - headR * 0.55, headY + headR * 0.3, headR * 0.18, headR * 0.12, 'rgba(220,90,80,0.25)');
  blob(g, cx + headR * 0.55, headY + headR * 0.3, headR * 0.18, headR * 0.12, 'rgba(220,90,80,0.25)');
  // Eyes and smile.
  blob(g, cx - headR * 0.35, headY - headR * 0.05, 2.6, 3.2, '#1b120c');
  blob(g, cx + headR * 0.35, headY - headR * 0.05, 2.6, 3.2, '#1b120c');
  g.strokeStyle = '#7a3a2a';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(cx, headY + headR * 0.28, headR * 0.28, 0.2, Math.PI - 0.2);
  g.stroke();
  blob(g, cx, headY + headR * 0.1, 2.6, 2, shade(skin, 0.85));
  if (s.glasses) {
    g.strokeStyle = '#3a2617';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx - headR * 0.35, headY - headR * 0.05, 6, 0, Math.PI * 2);
    g.moveTo(cx + headR * 0.35 + 6, headY - headR * 0.05);
    g.arc(cx + headR * 0.35, headY - headR * 0.05, 6, 0, Math.PI * 2);
    g.moveTo(cx - headR * 0.35 + 6, headY - headR * 0.05);
    g.lineTo(cx + headR * 0.35 - 6, headY - headR * 0.05);
    g.stroke();
  }
  if (s.beard) {
    g.fillStyle = s.hair ?? '#ddd';
    g.beginPath();
    g.moveTo(cx - headR * 0.8, headY + headR * 0.2);
    g.quadraticCurveTo(cx, headY + headR * 2.2, cx + headR * 0.8, headY + headR * 0.2);
    g.quadraticCurveTo(cx, headY + headR * 0.75, cx - headR * 0.8, headY + headR * 0.2);
    g.fill();
  }

  // Hats.
  const hc = s.hatColor ?? '#3b2c55';
  g.fillStyle = hc;
  switch (s.hat) {
    case 'pointy':
      g.beginPath();
      g.ellipse(cx, headY - headR * 0.75, headR * 1.5, headR * 0.28, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(cx - headR * 0.85, headY - headR * 0.8);
      g.quadraticCurveTo(cx - headR * 0.2, headY - headR * 2.2, cx + headR * 0.9, headY - headR * 2.6);
      g.quadraticCurveTo(cx + headR * 0.4, headY - headR * 1.6, cx + headR * 0.85, headY - headR * 0.8);
      g.fill();
      break;
    case 'tall':
      g.fillRect(cx - headR * 0.75, headY - headR * 2.1, headR * 1.5, headR * 1.3);
      g.beginPath();
      g.ellipse(cx, headY - headR * 0.8, headR * 1.3, headR * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c99a3e';
      g.fillRect(cx - headR * 0.75, headY - headR * 1.1, headR * 1.5, headR * 0.2);
      break;
    case 'bonnet':
      g.beginPath();
      g.arc(cx, headY - headR * 0.1, headR * 1.25, Math.PI * 0.95, Math.PI * 2.05);
      g.fill();
      g.fillStyle = shade(hc, 0.85);
      g.fillRect(cx - headR * 1.25, headY - headR * 0.2, headR * 2.5, headR * 0.18);
      break;
    case 'cap':
      g.beginPath();
      g.arc(cx, headY - headR * 0.35, headR * 1.02, Math.PI, Math.PI * 2);
      g.fill();
      g.fillRect(cx, headY - headR * 0.42, headR * 1.4, headR * 0.16);
      break;
    default:
      break;
  }

  // Prop, bottom right.
  const px = cx + w * 0.3;
  const py = h * 0.8;
  switch (s.prop) {
    case 'cauldron':
      blob(g, px, py, 16, 13, '#2a2230');
      blob(g, px, py - 10, 15, 4, '#7ac86a');
      break;
    case 'scroll':
      g.fillStyle = '#f3e4c4';
      g.fillRect(px - 10, py - 18, 20, 30);
      blob(g, px, py - 18, 12, 4, '#d9c18f');
      blob(g, px, py + 12, 12, 4, '#d9c18f');
      break;
    case 'wand':
      g.strokeStyle = '#7a4a26';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(px - 14, py + 14);
      g.lineTo(px + 10, py - 18);
      g.stroke();
      blob(g, px + 11, py - 20, 4, 4, '#fff3c4');
      break;
    case 'book':
      g.fillStyle = '#7a2f3a';
      g.fillRect(px - 14, py - 12, 28, 22);
      g.fillStyle = '#f3e4c4';
      g.fillRect(px - 12, py - 10, 24, 3);
      break;
    case 'thistle':
      g.strokeStyle = '#4f7a34';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(px, py + 16);
      g.lineTo(px, py - 8);
      g.stroke();
      blob(g, px, py - 10, 8, 7, '#6f8a3a');
      blob(g, px, py - 18, 7, 6, '#b05aa8');
      break;
    case 'pocket':
      g.fillStyle = '#5a3a1e';
      g.beginPath();
      g.moveTo(px - 14, py - 14);
      g.lineTo(px + 14, py - 14);
      g.quadraticCurveTo(px + 14, py + 16, px, py + 16);
      g.quadraticCurveTo(px - 14, py + 16, px - 14, py - 14);
      g.fill();
      blob(g, px, py, 4, 4, '#ffd27a');
      break;
    case 'key':
      g.strokeStyle = '#c99a3e';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(px, py - 10, 7, 0, Math.PI * 2);
      g.moveTo(px, py - 3);
      g.lineTo(px, py + 16);
      g.lineTo(px + 6, py + 16);
      g.stroke();
      break;
    default:
      break;
  }
}

function ghost(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  g.globalAlpha = 0.85;
  g.fillStyle = '#f4f8fb';
  g.beginPath();
  g.moveTo(cx - w * 0.3, h * 0.95);
  g.quadraticCurveTo(cx - w * 0.34, h * 0.25, cx, h * 0.22);
  g.quadraticCurveTo(cx + w * 0.34, h * 0.25, cx + w * 0.3, h * 0.95);
  for (let i = 0; i < 5; i++) {
    const x = cx + w * 0.3 - (i + 1) * (w * 0.6) / 5;
    g.quadraticCurveTo(x + w * 0.06, h * (i % 2 ? 0.85 : 1), x, h * 0.92);
  }
  g.fill();
  g.globalAlpha = 1;
  blob(g, cx - 12, h * 0.42, 5, 7, '#3a4a5a');
  blob(g, cx + 12, h * 0.42, 5, 7, '#3a4a5a');
  blob(g, cx, h * 0.55, 6, 4, '#7a8a9a');
  // A prim little bun.
  blob(g, cx, h * 0.22, 14, 10, '#e8eef2');
}

function gnarling(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  blob(g, cx, h * 0.62, w * 0.3, h * 0.28, '#6b4a2e');
  blob(g, cx - w * 0.18, h * 0.5, 8, 6, '#4a3220');
  blob(g, cx + w * 0.2, h * 0.75, 9, 7, '#4a3220');
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(cx, h * 0.36);
    g.rotate(-0.8 + i * 0.5);
    g.fillStyle = '#6e9a3e';
    g.beginPath();
    g.ellipse(0, -18, 6, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  blob(g, cx - 14, h * 0.56, 7, 7, '#ffd84a');
  blob(g, cx + 14, h * 0.56, 7, 7, '#ffd84a');
  blob(g, cx - 14, h * 0.56, 2.5, 3.5, '#1b120c');
  blob(g, cx + 14, h * 0.56, 2.5, 3.5, '#1b120c');
  g.strokeStyle = '#1b0f08';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 12, h * 0.7);
  g.lineTo(cx - 4, h * 0.67);
  g.lineTo(cx + 4, h * 0.7);
  g.lineTo(cx + 12, h * 0.67);
  g.stroke();
}

function puddlewump(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  blob(g, cx, h * 0.86, w * 0.42, h * 0.08, 'rgba(40,80,120,0.5)');
  blob(g, cx, h * 0.66, w * 0.32, h * 0.22, '#6fb0d8');
  blob(g, cx - w * 0.08, h * 0.58, w * 0.12, h * 0.06, 'rgba(255,255,255,0.35)');
  blob(g, cx - 16, h * 0.6, 11, 12, '#fff');
  blob(g, cx + 16, h * 0.6, 11, 12, '#fff');
  blob(g, cx - 14, h * 0.62, 5, 6, '#1b2a3a');
  blob(g, cx + 18, h * 0.62, 5, 6, '#1b2a3a');
  // Musical notes: it hums.
  g.fillStyle = '#2b1d14';
  g.font = '22px Georgia, serif';
  g.fillText('♪', cx + w * 0.22, h * 0.3);
  g.fillText('♫', cx - w * 0.34, h * 0.24);
}

function moth(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const wing = (dir: number, y: number, rx: number, ry: number, color: string) => {
    g.save();
    g.translate(cx + dir * rx * 0.8, y);
    g.rotate(dir * 0.35);
    blob(g, 0, 0, rx, ry, color);
    blob(g, 0, 0, rx * 0.35, ry * 0.35, '#fff3c4');
    g.restore();
  };
  wing(-1, h * 0.42, w * 0.25, h * 0.15, '#d9a24a');
  wing(1, h * 0.42, w * 0.25, h * 0.15, '#d9a24a');
  wing(-1, h * 0.62, w * 0.18, h * 0.1, '#b9823e');
  wing(1, h * 0.62, w * 0.18, h * 0.1, '#b9823e');
  blob(g, cx, h * 0.52, 8, h * 0.18, '#5a3a1e');
  blob(g, cx, h * 0.33, 9, 9, '#5a3a1e');
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 3, h * 0.3);
  g.quadraticCurveTo(cx - 14, h * 0.18, cx - 20, h * 0.2);
  g.moveTo(cx + 3, h * 0.3);
  g.quadraticCurveTo(cx + 14, h * 0.18, cx + 20, h * 0.2);
  g.stroke();
  // Candle glow.
  const glow = g.createRadialGradient(cx, h * 0.88, 2, cx, h * 0.88, 40);
  glow.addColorStop(0, 'rgba(255,220,120,0.9)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = glow;
  g.fillRect(cx - 40, h * 0.7, 80, h * 0.3);
}

function lantern(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const glow = g.createRadialGradient(cx, h * 0.55, 6, cx, h * 0.55, w * 0.6);
  glow.addColorStop(0, 'rgba(255,200,110,0.95)');
  glow.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2230';
  g.beginPath();
  g.moveTo(cx - w * 0.22, h * 0.3);
  g.lineTo(cx + w * 0.22, h * 0.3);
  g.lineTo(cx, h * 0.16);
  g.fill();
  g.fillRect(cx - w * 0.25, h * 0.8, w * 0.5, 8);
  g.strokeStyle = '#2a2230';
  g.lineWidth = 5;
  g.strokeRect(cx - w * 0.2, h * 0.3, w * 0.4, h * 0.5);
  g.beginPath();
  g.arc(cx, h * 0.12, 8, 0, Math.PI * 2);
  g.stroke();
  // A face in the flame.
  blob(g, cx, h * 0.56, w * 0.15, h * 0.18, '#ffcf6a');
  blob(g, cx - 9, h * 0.52, 4, 5, '#5a2a10');
  blob(g, cx + 9, h * 0.52, 4, 5, '#5a2a10');
  g.strokeStyle = '#5a2a10';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, h * 0.6, 8, 0.3, Math.PI - 0.3);
  g.stroke();
}
