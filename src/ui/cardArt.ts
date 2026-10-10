import type { CardDef } from '../data/cards';
import { paintPortrait } from './portraits';

const SET_COLORS: Record<string, string> = { Founders: '#c9973a', Oddballs: '#7a5aa8', Creatures: '#4f8a5a' };

/** Draw a card's face (frame, portrait, name plate) onto a canvas. */
export function drawCardFace(card: CardDef, w = 256, h = 360): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const frame = SET_COLORS[card.set];
  g.fillStyle = '#2b1d14';
  roundRect(g, 0, 0, w, h, 18);
  g.fill();
  g.fillStyle = frame;
  roundRect(g, 6, 6, w - 12, h - 12, 14);
  g.fill();
  g.fillStyle = '#f3e4c4';
  roundRect(g, 14, 14, w - 28, h - 28, 10);
  g.fill();

  const pw = w - 40;
  const ph = Math.round(h * 0.62);
  g.save();
  g.translate(20, 20);
  roundRect(g, 0, 0, pw, ph, 8);
  g.clip();
  paintPortrait(g, card.portrait, pw, ph);
  g.restore();
  g.strokeStyle = frame;
  g.lineWidth = 3;
  roundRect(g, 20, 20, pw, ph, 8);
  g.stroke();

  // Number medallion.
  g.fillStyle = frame;
  g.beginPath();
  g.arc(w - 34, 34, 17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff8e6';
  g.font = 'bold 18px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(card.number), w - 34, 35);

  g.fillStyle = '#2b1d14';
  g.font = `bold ${card.name.length > 20 ? 17 : 21}px Palatino, Georgia, serif`;
  g.fillText(card.name, w / 2, ph + 44);
  g.font = 'italic 13px Palatino, Georgia, serif';
  wrap(g, card.title, w / 2, ph + 68, w - 44, 15);
  g.font = 'bold 11px Georgia, serif';
  g.fillStyle = frame;
  g.fillText(card.set.toUpperCase() + ' · FABLED FOLK', w / 2, h - 26);
  return c;
}

/** The back of a card (shown for missing cards in the album and on spinning pickups). */
export function drawCardBack(w = 256, h = 360): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b1d14';
  roundRect(g, 0, 0, w, h, 18);
  g.fill();
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#5d4470');
  grad.addColorStop(1, '#2f2740');
  g.fillStyle = grad;
  roundRect(g, 8, 8, w - 16, h - 16, 12);
  g.fill();
  g.strokeStyle = '#c9973a';
  g.lineWidth = 3;
  roundRect(g, 18, 18, w - 36, h - 36, 8);
  g.stroke();
  // A thistle emblem.
  g.translate(w / 2, h / 2);
  g.strokeStyle = '#c9973a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 70);
  g.lineTo(0, -10);
  g.stroke();
  g.fillStyle = '#c9973a';
  g.beginPath();
  g.ellipse(0, -14, 26, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b05aa8';
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.ellipse(i * 7, -48 + Math.abs(i) * 4, 4, 18, i * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
  }
  g.fillText(line, x, y);
}
