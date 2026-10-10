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
  const rnd = seeded(JSON.stringify(s));
  backdrop(g, s, w, h, rnd);
  const cx = w / 2;
  switch (s.kind) {
    case 'person':
      if (s.robe) person(g, s, cx, w, h, rnd);
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
    case 'snapcasket':
      snapcasket(g, cx, w, h);
      break;
    case 'mouse':
      mouse(g, cx, w, h);
      break;
    case 'mushroom':
      mushroom(g, cx, w, h);
      break;
    case 'wisp':
      wisp(g, cx, w, h);
      break;
  }
  if (s.kind !== 'lantern') varnish(g, w, h, rnd);
}

/** Deterministic random numbers from a string, so a portrait always paints the same. */
function seeded(key: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < key.length; i++) a = Math.imul(a ^ key.charCodeAt(i), 16777619);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Oil-painting backdrop: dark gradient, a draped curtain, a glow behind the sitter, brushwork. */
function backdrop(g: CanvasRenderingContext2D, s: PortraitSpec, w: number, h: number, rnd: () => number): void {
  const bg = g.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, shade(s.bg[0], 0.85));
  bg.addColorStop(1, shade(s.bg[1], 0.55));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Warm glow behind the head.
  const glow = g.createRadialGradient(w * 0.5, h * 0.38, 4, w * 0.5, h * 0.4, w * 0.7);
  glow.addColorStop(0, 'rgba(255,236,200,0.55)');
  glow.addColorStop(1, 'rgba(255,236,200,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  if (s.kind === 'person' || s.kind === 'ghost') {
    // A swag of curtain on one side, with folds.
    const left = rnd() < 0.5;
    const cw = w * 0.28;
    const x0 = left ? 0 : w - cw;
    const curtain = shade(s.bg[1], 0.7);
    for (let i = 0; i < 5; i++) {
      const fx = x0 + (i / 5) * cw;
      const fold = g.createLinearGradient(fx, 0, fx + cw / 5, 0);
      fold.addColorStop(0, shade(s.bg[1], 0.45));
      fold.addColorStop(0.5, curtain);
      fold.addColorStop(1, shade(s.bg[1], 0.45));
      g.fillStyle = fold;
      g.beginPath();
      g.moveTo(fx, 0);
      g.lineTo(fx + cw / 5, 0);
      g.quadraticCurveTo(fx + cw / 5 + (left ? 6 : -6), h * 0.5, fx + cw / 5, h);
      g.lineTo(fx, h);
      g.fill();
    }
    // The tie-back cord.
    g.strokeStyle = '#c99a3e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, h * 0.62);
    g.quadraticCurveTo(x0 + cw / 2, h * 0.7, x0 + cw, h * 0.6);
    g.stroke();
  }
  // Brushwork.
  for (let i = 0; i < 140; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 6 + rnd() * 14;
    const a = rnd() * Math.PI;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,240,210,0.05)' : 'rgba(30,15,10,0.06)';
    g.lineWidth = 2 + rnd() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
}

/** Canvas grain, a darkened edge and a faint varnish sheen. */
function varnish(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number): void {
  for (let i = 0; i < w * h * 0.03; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    g.fillRect(rnd() * w, rnd() * h, 1, 1);
  }
  const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,10,5,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, w, h);
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

function person(g: CanvasRenderingContext2D, s: PortraitSpec, cx: number, w: number, h: number, rnd: () => number): void {
  const skin = s.skin ?? '#f0c9a0';
  const robe = s.robe ?? '#46395f';
  const hair = s.hair ?? '#5a3a1e';
  const headY = h * 0.42;
  const R = w * 0.19; // head radius
  const style = s.hairStyle ?? (s.hat === 'bonnet' ? 'bun' : s.beard ? 'short' : rnd() < 0.5 ? 'long' : 'short');
  const expr = s.expression ?? (s.beard ? 'kind' : 'smile');

  // Long hair falls behind the shoulders.
  if (style === 'long' && s.hat !== 'bonnet') {
    g.fillStyle = shade(hair, 0.8);
    g.beginPath();
    g.ellipse(cx, headY + R * 0.9, R * 1.25, R * 1.9, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Shoulders: a robe with folds and lit shoulder edges.
  const body = g.createLinearGradient(cx - w * 0.45, 0, cx + w * 0.45, 0);
  body.addColorStop(0, shade(robe, 0.55));
  body.addColorStop(0.35, shade(robe, 1.15));
  body.addColorStop(1, shade(robe, 0.6));
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - w * 0.46, h);
  g.quadraticCurveTo(cx - w * 0.44, h * 0.66, cx - R * 0.6, h * 0.6);
  g.lineTo(cx + R * 0.6, h * 0.6);
  g.quadraticCurveTo(cx + w * 0.44, h * 0.66, cx + w * 0.46, h);
  g.fill();
  g.strokeStyle = shade(robe, 0.45);
  g.lineWidth = 1.5;
  for (const dx of [-0.25, -0.12, 0.14, 0.27]) {
    g.beginPath();
    g.moveTo(cx + w * dx, h * 0.72);
    g.quadraticCurveTo(cx + w * dx * 1.1, h * 0.86, cx + w * dx * 1.2, h);
    g.stroke();
  }
  // Neck.
  g.fillStyle = shade(skin, 0.82);
  g.fillRect(cx - R * 0.38, headY + R * 0.7, R * 0.76, R * 0.75);

  // Collar.
  const collar = s.collar ?? (s.kind === 'person' && s.hat === 'tall' ? 'ruff' : 'plain');
  if (collar === 'ruff') {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      blob(g, cx + Math.cos(a) * R * 0.95, headY + R * 1.5 + Math.sin(a) * R * 0.32, R * 0.22, R * 0.16, i % 2 ? '#f6f1e6' : '#ddd5c4');
    }
  } else if (collar === 'scarf') {
    g.fillStyle = s.jewel ?? '#b0362f';
    g.beginPath();
    g.ellipse(cx, headY + R * 1.5, R * 0.95, R * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = shade(robe, 0.7);
    g.beginPath();
    g.moveTo(cx - R * 0.9, h * 0.6);
    g.lineTo(cx, h * 0.72);
    g.lineTo(cx + R * 0.9, h * 0.6);
    g.lineTo(cx + R * 0.5, h * 0.6);
    g.lineTo(cx, h * 0.66);
    g.lineTo(cx - R * 0.5, h * 0.6);
    g.fill();
  }
  // A brooch.
  const jewel = s.jewel ?? (rnd() < 0.6 ? '#c99a3e' : '#7aa8c8');
  blob(g, cx, h * 0.735, 4.5, 4.5, '#c99a3e');
  blob(g, cx, h * 0.735, 2.8, 2.8, jewel);
  blob(g, cx - 1, h * 0.73, 1, 1, 'rgba(255,255,255,0.8)');

  // The back of a bonnet frames the head.
  if (s.hat === 'bonnet') blob(g, cx, headY - R * 0.05, R * 1.32, R * 1.3, shade(s.hatColor ?? '#3b2c55', 0.7));
  // Hair behind the head.
  if (style !== 'bald') blob(g, cx, headY - R * 0.12, R * 1.1, R * 1.06, shade(hair, 0.85));

  // Ears.
  blob(g, cx - R * 0.98, headY + R * 0.08, R * 0.16, R * 0.24, shade(skin, 0.88));
  blob(g, cx + R * 0.98, headY + R * 0.08, R * 0.16, R * 0.24, shade(skin, 0.88));
  // Head, lit from the upper left.
  const face = g.createRadialGradient(cx - R * 0.35, headY - R * 0.4, R * 0.2, cx, headY, R * 1.15);
  face.addColorStop(0, shade(skin, 1.08));
  face.addColorStop(0.7, skin);
  face.addColorStop(1, shade(skin, 0.78));
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(cx, headY, R * 0.95, R * 1.08, 0, 0, Math.PI * 2);
  g.fill();
  // Cheeks.
  blob(g, cx - R * 0.5, headY + R * 0.32, R * 0.2, R * 0.13, 'rgba(220,90,80,0.22)');
  blob(g, cx + R * 0.5, headY + R * 0.32, R * 0.2, R * 0.13, 'rgba(220,90,80,0.22)');

  // Eyes: whites, iris, pupil, highlight, a lid line.
  const eyeY = headY - R * 0.05;
  for (const side of [-1, 1]) {
    const ex = cx + side * R * 0.38;
    blob(g, ex, eyeY, R * 0.17, R * 0.1, '#f7f2ea');
    blob(g, ex, eyeY, R * 0.09, R * 0.09, s.eyes ?? '#5a7a4a');
    blob(g, ex, eyeY, R * 0.045, R * 0.045, '#1b120c');
    blob(g, ex - R * 0.03, eyeY - R * 0.03, R * 0.022, R * 0.022, '#ffffff');
    g.strokeStyle = shade(skin, 0.45);
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(ex, eyeY + R * 0.01, R * 0.18, R * 0.11, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    // Brows.
    const tilt = expr === 'stern' ? 0.22 : expr === 'smirk' && side > 0 ? -0.2 : -0.06;
    g.strokeStyle = shade(hair, 0.7);
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(ex - R * 0.18, eyeY - R * 0.22 + side * tilt * R * -0.3);
    g.quadraticCurveTo(ex, eyeY - R * 0.3, ex + R * 0.18, eyeY - R * 0.22 - side * tilt * R * -0.3);
    g.stroke();
  }
  // Nose: a shaded side and a highlight.
  g.strokeStyle = shade(skin, 0.68);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx + R * 0.05, eyeY + R * 0.08);
  g.quadraticCurveTo(cx + R * 0.16, headY + R * 0.3, cx - R * 0.02, headY + R * 0.36);
  g.stroke();
  blob(g, cx - R * 0.05, headY + R * 0.22, R * 0.04, R * 0.07, 'rgba(255,255,255,0.35)');
  // Mouth.
  const my = headY + R * 0.58;
  g.strokeStyle = '#8a3a2a';
  g.lineWidth = 2;
  g.beginPath();
  if (expr === 'stern') {
    g.moveTo(cx - R * 0.22, my);
    g.lineTo(cx + R * 0.22, my);
  } else if (expr === 'smirk') {
    g.moveTo(cx - R * 0.22, my);
    g.quadraticCurveTo(cx + R * 0.05, my + R * 0.06, cx + R * 0.26, my - R * 0.1);
  } else {
    g.moveTo(cx - R * 0.26, my - R * 0.04);
    g.quadraticCurveTo(cx, my + (expr === 'kind' ? R * 0.1 : R * 0.18), cx + R * 0.26, my - R * 0.04);
  }
  g.stroke();
  blob(g, cx, my + R * 0.1, R * 0.12, R * 0.04, 'rgba(180,80,70,0.25)');

  // Hair on top, with strands.
  if (style !== 'bald') {
    g.fillStyle = hair;
    g.beginPath();
    if (style === 'wild') {
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        const r = R * (1.05 + (i % 2) * 0.22);
        const x = cx + Math.cos(a) * r;
        const y = headY - R * 0.15 + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    } else {
      g.ellipse(cx, headY - R * 0.42, R * 0.98, R * 0.62, 0, Math.PI, Math.PI * 2);
      g.quadraticCurveTo(cx + R * 0.3, headY - R * 0.55, cx - R * 0.2, headY - R * 0.62);
    }
    g.fill();
    g.strokeStyle = shade(hair, 1.35);
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const x = cx - R * 0.8 + (i / 8) * R * 1.6;
      g.beginPath();
      g.moveTo(x, headY - R * 0.95);
      g.quadraticCurveTo(x + R * 0.1, headY - R * 0.7, x - R * 0.05, headY - R * 0.48);
      g.stroke();
    }
    if (style === 'bun' && s.hat !== 'bonnet') blob(g, cx, headY - R * 1.15, R * 0.42, R * 0.32, hair);
  } else if (style === 'bald') {
    blob(g, cx - R * 0.85, headY - R * 0.05, R * 0.2, R * 0.35, hair);
    blob(g, cx + R * 0.85, headY - R * 0.05, R * 0.2, R * 0.35, hair);
    blob(g, cx - R * 0.3, headY - R * 0.75, R * 0.25, R * 0.12, 'rgba(255,255,255,0.3)');
  }
  if (s.beard) {
    const bg = g.createLinearGradient(0, headY, 0, headY + R * 2);
    bg.addColorStop(0, hair);
    bg.addColorStop(1, shade(hair, 0.8));
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(cx - R * 0.85, headY + R * 0.2);
    g.quadraticCurveTo(cx - R * 0.7, headY + R * 1.9, cx, headY + R * 2.1);
    g.quadraticCurveTo(cx + R * 0.7, headY + R * 1.9, cx + R * 0.85, headY + R * 0.2);
    g.quadraticCurveTo(cx + R * 0.4, headY + R * 0.75, cx, headY + R * 0.72);
    g.quadraticCurveTo(cx - R * 0.4, headY + R * 0.75, cx - R * 0.85, headY + R * 0.2);
    g.fill();
    g.strokeStyle = shade(hair, 0.65);
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const x = cx - R * 0.5 + (i / 6) * R;
      g.beginPath();
      g.moveTo(x, headY + R * 0.85);
      g.quadraticCurveTo(x + R * 0.05, headY + R * 1.4, x, headY + R * 1.9);
      g.stroke();
    }
    // Moustache.
    blob(g, cx - R * 0.2, headY + R * 0.5, R * 0.24, R * 0.09, shade(hair, 0.9));
    blob(g, cx + R * 0.2, headY + R * 0.5, R * 0.24, R * 0.09, shade(hair, 0.9));
  }
  if (s.glasses) {
    g.strokeStyle = '#3a2617';
    g.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(cx + side * R * 0.38, eyeY, R * 0.22, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(cx + side * R * 0.38, eyeY, R * 0.15, Math.PI * 1.1, Math.PI * 1.4);
      g.stroke();
      g.strokeStyle = '#3a2617';
    }
    g.beginPath();
    g.moveTo(cx - R * 0.16, eyeY);
    g.lineTo(cx + R * 0.16, eyeY);
    g.stroke();
  }

  // Hats, shaded.
  const hc = s.hatColor ?? '#3b2c55';
  const hatGrad = (x0: number, x1: number) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, shade(hc, 1.25));
    gr.addColorStop(1, shade(hc, 0.6));
    return gr;
  };
  switch (s.hat) {
    case 'pointy':
      g.fillStyle = hatGrad(cx - R, cx + R);
      g.beginPath();
      g.moveTo(cx - R * 0.85, headY - R * 0.8);
      g.quadraticCurveTo(cx - R * 0.2, headY - R * 2.2, cx + R * 0.9, headY - R * 2.6);
      g.quadraticCurveTo(cx + R * 0.4, headY - R * 1.6, cx + R * 0.85, headY - R * 0.8);
      g.fill();
      g.fillStyle = hatGrad(cx - R * 1.5, cx + R * 1.5);
      g.beginPath();
      g.ellipse(cx, headY - R * 0.75, R * 1.55, R * 0.3, -0.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c99a3e';
      g.fillRect(cx - R * 0.82, headY - R * 1.05, R * 1.64, R * 0.16);
      break;
    case 'tall':
      g.fillStyle = hatGrad(cx - R * 0.75, cx + R * 0.75);
      g.fillRect(cx - R * 0.75, headY - R * 2.1, R * 1.5, R * 1.3);
      g.beginPath();
      g.ellipse(cx, headY - R * 0.8, R * 1.3, R * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c99a3e';
      g.fillRect(cx - R * 0.75, headY - R * 1.1, R * 1.5, R * 0.2);
      blob(g, cx, headY - R, R * 0.12, R * 0.1, '#e8c25a');
      break;
    case 'bonnet': {
      // A ruffled brim arching round the face, tied under the chin with a bow.
      g.strokeStyle = hatGrad(cx - R * 1.3, cx + R * 1.3);
      g.lineWidth = R * 0.42;
      g.beginPath();
      g.arc(cx, headY + R * 0.05, R * 1.12, Math.PI * 0.92, Math.PI * 2.08);
      g.stroke();
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * (0.95 + (i / 12) * 1.1);
        blob(g, cx + Math.cos(a) * R * 0.92, headY + R * 0.05 + Math.sin(a) * R * 0.92, R * 0.1, R * 0.1, '#f6f1e6');
      }
      g.strokeStyle = shade(hc, 1.3);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(cx - R * 1.05, headY + R * 0.4);
      g.quadraticCurveTo(cx - R * 0.7, headY + R * 1.2, cx, headY + R * 1.2);
      g.quadraticCurveTo(cx + R * 0.7, headY + R * 1.2, cx + R * 1.05, headY + R * 0.4);
      g.stroke();
      blob(g, cx - R * 0.18, headY + R * 1.22, R * 0.2, R * 0.12, shade(hc, 1.3));
      blob(g, cx + R * 0.18, headY + R * 1.22, R * 0.2, R * 0.12, shade(hc, 1.3));
      break;
    }
    case 'cap':
      g.fillStyle = hatGrad(cx - R, cx + R);
      g.beginPath();
      g.arc(cx, headY - R * 0.35, R * 1.02, Math.PI, Math.PI * 2);
      g.fill();
      g.fillRect(cx, headY - R * 0.42, R * 1.4, R * 0.16);
      blob(g, cx, headY - R * 1.32, R * 0.12, R * 0.12, shade(hc, 1.4));
      break;
    default:
      break;
  }

  // Prop, bottom right.
  const px = cx + w * 0.3;
  const py = h * 0.8;
  g.save();
  g.translate(px, py);
  g.scale(w / 160, w / 160);
  g.translate(-px, -py);
  switch (s.prop) {
    case 'cauldron':
      blob(g, px, py, 16, 13, '#2a2230');
      blob(g, px - 5, py - 4, 5, 4, 'rgba(255,255,255,0.15)');
      blob(g, px, py - 10, 15, 4, '#7ac86a');
      for (let i = 0; i < 3; i++) blob(g, px - 6 + i * 6, py - 16 - i * 4, 3, 3, 'rgba(180,240,160,0.6)');
      break;
    case 'scroll':
      g.fillStyle = '#f3e4c4';
      g.fillRect(px - 10, py - 18, 20, 30);
      g.strokeStyle = 'rgba(80,50,30,0.5)';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(px - 6, py - 12 + i * 6);
        g.lineTo(px + 6, py - 12 + i * 6);
        g.stroke();
      }
      blob(g, px, py - 18, 12, 4, '#d9c18f');
      blob(g, px, py + 12, 12, 4, '#d9c18f');
      blob(g, px + 6, py + 4, 4, 4, '#b0362f');
      break;
    case 'wand':
      g.strokeStyle = '#7a4a26';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(px - 14, py + 14);
      g.lineTo(px + 10, py - 18);
      g.stroke();
      blob(g, px + 11, py - 20, 6, 6, 'rgba(255,240,180,0.5)');
      blob(g, px + 11, py - 20, 3, 3, '#fff3c4');
      break;
    case 'book':
      g.fillStyle = '#7a2f3a';
      g.fillRect(px - 14, py - 12, 28, 22);
      g.fillStyle = '#c99a3e';
      g.fillRect(px - 14, py - 12, 4, 22);
      g.fillStyle = '#f3e4c4';
      g.fillRect(px - 10, py - 10, 22, 3);
      break;
    case 'thistle':
      g.strokeStyle = '#4f7a34';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(px, py + 16);
      g.lineTo(px, py - 8);
      g.stroke();
      blob(g, px, py - 10, 8, 7, '#6f8a3a');
      for (let i = -3; i <= 3; i++) blob(g, px + i * 2, py - 19 + Math.abs(i), 1.6, 6, '#b05aa8');
      break;
    case 'pocket':
      g.fillStyle = '#5a3a1e';
      g.beginPath();
      g.moveTo(px - 14, py - 14);
      g.lineTo(px + 14, py - 14);
      g.quadraticCurveTo(px + 14, py + 16, px, py + 16);
      g.quadraticCurveTo(px - 14, py + 16, px - 14, py - 14);
      g.fill();
      blob(g, px, py, 5, 5, 'rgba(255,210,120,0.5)');
      blob(g, px, py, 3, 3, '#ffd27a');
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
  g.restore();
}

/** A blob lit from the upper left, with a soft rim of shadow. */
function orb(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.4, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.05);
  gr.addColorStop(0, shade(color, 1.3));
  gr.addColorStop(0.6, color);
  gr.addColorStop(1, shade(color, 0.55));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

/** An eye with a white, an iris, a pupil and a glint. */
function eye(g: CanvasRenderingContext2D, x: number, y: number, r: number, iris: string, white = '#f7f2ea'): void {
  blob(g, x, y, r, r * 1.1, white);
  blob(g, x + r * 0.1, y + r * 0.1, r * 0.6, r * 0.65, iris);
  blob(g, x + r * 0.15, y + r * 0.15, r * 0.3, r * 0.35, '#120c08');
  blob(g, x - r * 0.15, y - r * 0.2, r * 0.18, r * 0.18, '#ffffff');
}

function ghost(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  // A cold halo.
  const halo = g.createRadialGradient(cx, h * 0.5, 4, cx, h * 0.5, w * 0.55);
  halo.addColorStop(0, 'rgba(200,230,255,0.45)');
  halo.addColorStop(1, 'rgba(200,230,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  const body = g.createLinearGradient(0, h * 0.2, 0, h);
  body.addColorStop(0, 'rgba(250,252,255,0.95)');
  body.addColorStop(0.7, 'rgba(220,235,245,0.75)');
  body.addColorStop(1, 'rgba(200,220,240,0.1)');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - w * 0.3, h * 0.95);
  g.quadraticCurveTo(cx - w * 0.34, h * 0.25, cx, h * 0.22);
  g.quadraticCurveTo(cx + w * 0.34, h * 0.25, cx + w * 0.3, h * 0.95);
  for (let i = 0; i < 5; i++) {
    const x = cx + w * 0.3 - (i + 1) * (w * 0.6) / 5;
    g.quadraticCurveTo(x + w * 0.06, h * (i % 2 ? 0.85 : 1), x, h * 0.92);
  }
  g.fill();
  // Folds of a shroud and a shawl.
  g.strokeStyle = 'rgba(140,170,200,0.35)';
  g.lineWidth = 2 * u;
  for (const dx of [-0.15, 0, 0.14]) {
    g.beginPath();
    g.moveTo(cx + w * dx, h * 0.6);
    g.quadraticCurveTo(cx + w * dx * 1.3, h * 0.78, cx + w * dx * 1.1, h * 0.92);
    g.stroke();
  }
  g.fillStyle = 'rgba(190,215,235,0.6)';
  g.beginPath();
  g.moveTo(cx - w * 0.28, h * 0.5);
  g.quadraticCurveTo(cx, h * 0.66, cx + w * 0.28, h * 0.5);
  g.quadraticCurveTo(cx, h * 0.58, cx - w * 0.28, h * 0.5);
  g.fill();
  // Sad, kindly eyes.
  for (const side of [-1, 1]) {
    blob(g, cx + side * 12 * u, h * 0.4, 5 * u, 7 * u, '#2f3e4e');
    blob(g, cx + side * 12 * u - u, h * 0.39, 1.6 * u, 1.6 * u, 'rgba(255,255,255,0.9)');
    g.strokeStyle = '#5a6a7a';
    g.lineWidth = 1.5 * u;
    g.beginPath();
    g.moveTo(cx + side * 6 * u, h * 0.34 - 2 * u);
    g.lineTo(cx + side * 18 * u, h * 0.34 + 2 * u);
    g.stroke();
  }
  blob(g, cx, h * 0.5, 5 * u, 3 * u, '#7a8a9a');
  // A prim little bun.
  orb(g, cx, h * 0.22, 14 * u, 10 * u, '#e8eef2');
}

function gnarling(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  blob(g, cx, h * 0.9, w * 0.32, h * 0.05, 'rgba(20,10,5,0.35)');
  // Root legs and arms.
  g.strokeStyle = '#4a3220';
  g.lineCap = 'round';
  g.lineWidth = 6 * u;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + side * w * 0.12, h * 0.82);
    g.quadraticCurveTo(cx + side * w * 0.16, h * 0.9, cx + side * w * 0.24, h * 0.9);
    g.moveTo(cx + side * w * 0.26, h * 0.6);
    g.quadraticCurveTo(cx + side * w * 0.38, h * 0.55, cx + side * w * 0.36, h * 0.44);
    g.stroke();
  }
  g.lineCap = 'butt';
  orb(g, cx, h * 0.62, w * 0.3, h * 0.27, '#7a5434');
  // Bark texture.
  g.strokeStyle = 'rgba(40,25,12,0.5)';
  g.lineWidth = 1.5 * u;
  for (let i = 0; i < 7; i++) {
    const x = cx - w * 0.2 + i * w * 0.065;
    g.beginPath();
    g.moveTo(x, h * 0.42 + Math.abs(i - 3) * 4 * u);
    g.quadraticCurveTo(x + 4 * u, h * 0.62, x - 2 * u, h * 0.84 - Math.abs(i - 3) * 4 * u);
    g.stroke();
  }
  orb(g, cx - w * 0.18, h * 0.5, 8 * u, 6 * u, '#4a3220');
  orb(g, cx + w * 0.2, h * 0.75, 9 * u, 7 * u, '#4a3220');
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(cx, h * 0.37);
    g.rotate(-0.9 + i * 0.45);
    const leaf = g.createLinearGradient(0, -36 * u, 0, 0);
    leaf.addColorStop(0, '#9cc85a');
    leaf.addColorStop(1, '#4f7a2e');
    g.fillStyle = leaf;
    g.beginPath();
    g.ellipse(0, -18 * u, 6 * u, 18 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,70,20,0.6)';
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(0, -32 * u);
    g.lineTo(0, -2 * u);
    g.stroke();
    g.restore();
  }
  // Glowering brows over yellow eyes.
  for (const side of [-1, 1]) {
    eye(g, cx + side * 14 * u, h * 0.56, 7 * u, '#1b120c', '#ffd84a');
    g.fillStyle = '#3a2414';
    g.beginPath();
    g.moveTo(cx + side * 4 * u, h * 0.53);
    g.lineTo(cx + side * 24 * u, h * 0.5 - 4 * u);
    g.lineTo(cx + side * 22 * u, h * 0.5 + 1 * u);
    g.fill();
  }
  g.fillStyle = '#1b0f08';
  g.beginPath();
  g.moveTo(cx - 14 * u, h * 0.68);
  g.quadraticCurveTo(cx, h * 0.74, cx + 14 * u, h * 0.67);
  g.quadraticCurveTo(cx, h * 0.7, cx - 14 * u, h * 0.68);
  g.fill();
  g.fillStyle = '#efe6c8';
  g.fillRect(cx - 7 * u, h * 0.685, 3 * u, 3 * u);
  g.fillRect(cx + 5 * u, h * 0.68, 3 * u, 3 * u);
}

function puddlewump(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  // A little pond with ripples.
  blob(g, cx, h * 0.86, w * 0.44, h * 0.09, 'rgba(30,70,110,0.6)');
  g.strokeStyle = 'rgba(200,230,255,0.35)';
  g.lineWidth = 1.2 * u;
  for (let i = 1; i <= 3; i++) {
    g.beginPath();
    g.ellipse(cx, h * 0.86, w * 0.14 * i, h * 0.025 * i, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // A translucent body with something glinting inside.
  const body = g.createRadialGradient(cx - w * 0.1, h * 0.55, 4, cx, h * 0.66, w * 0.34);
  body.addColorStop(0, 'rgba(190,230,250,0.95)');
  body.addColorStop(0.65, 'rgba(100,170,215,0.92)');
  body.addColorStop(1, 'rgba(50,110,160,0.95)');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, h * 0.66, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  blob(g, cx + w * 0.12, h * 0.76, 4 * u, 3 * u, 'rgba(255,220,120,0.8)');
  for (let i = 0; i < 5; i++) blob(g, cx - w * 0.15 + i * w * 0.07, h * (0.72 + (i % 2) * 0.05), 1.5 * u, 1.5 * u, 'rgba(255,255,255,0.5)');
  blob(g, cx - w * 0.1, h * 0.55, w * 0.12, h * 0.05, 'rgba(255,255,255,0.45)');
  eye(g, cx - 16 * u, h * 0.6, 11 * u, '#1b2a3a', '#ffffff');
  eye(g, cx + 16 * u, h * 0.6, 11 * u, '#1b2a3a', '#ffffff');
  g.strokeStyle = '#1b2a3a';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.arc(cx, h * 0.68, 6 * u, 0.2, Math.PI - 0.2);
  g.stroke();
  // Musical notes: it hums.
  g.fillStyle = '#2b1d14';
  g.font = `${Math.round(22 * u)}px Georgia, serif`;
  g.fillText('♪', cx + w * 0.22, h * 0.3);
  g.fillText('♫', cx - w * 0.34, h * 0.24);
}

function moth(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  // Candle glow first, so the moth is silhouetted against it.
  const glow = g.createRadialGradient(cx, h * 0.88, 2, cx, h * 0.88, w * 0.45);
  glow.addColorStop(0, 'rgba(255,220,120,0.95)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = glow;
  g.fillRect(0, h * 0.5, w, h * 0.5);
  g.fillStyle = '#efe0c0';
  g.fillRect(cx - 5 * u, h * 0.9, 10 * u, h * 0.1);
  blob(g, cx, h * 0.87, 3 * u, 6 * u, '#ffe08a');
  const wing = (dir: number, y: number, rx: number, ry: number, color: string) => {
    g.save();
    g.translate(cx + dir * rx * 0.8, y);
    g.rotate(dir * 0.35);
    orb(g, 0, 0, rx, ry, color);
    // Veins and an eye-spot.
    g.strokeStyle = 'rgba(80,50,20,0.45)';
    g.lineWidth = u;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(-dir * rx * 0.8, 0);
      g.lineTo(dir * rx * 0.7, i * ry * 0.35);
      g.stroke();
    }
    blob(g, dir * rx * 0.2, 0, rx * 0.36, ry * 0.36, '#5a3a1e');
    blob(g, dir * rx * 0.2, 0, rx * 0.26, ry * 0.26, '#fff3c4');
    g.restore();
  };
  wing(-1, h * 0.42, w * 0.25, h * 0.15, '#d9a24a');
  wing(1, h * 0.42, w * 0.25, h * 0.15, '#d9a24a');
  wing(-1, h * 0.62, w * 0.18, h * 0.1, '#b9823e');
  wing(1, h * 0.62, w * 0.18, h * 0.1, '#b9823e');
  orb(g, cx, h * 0.52, 8 * u, h * 0.18, '#6a4a2e');
  for (let i = 0; i < 5; i++) blob(g, cx, h * (0.42 + i * 0.05), 7 * u, 1.2 * u, 'rgba(40,25,10,0.4)');
  orb(g, cx, h * 0.33, 9 * u, 9 * u, '#6a4a2e');
  eye(g, cx - 4 * u, h * 0.33, 3 * u, '#1b120c', '#2a1a0c');
  eye(g, cx + 4 * u, h * 0.33, 3 * u, '#1b120c', '#2a1a0c');
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.moveTo(cx - 3 * u, h * 0.3);
  g.quadraticCurveTo(cx - 14 * u, h * 0.18, cx - 20 * u, h * 0.2);
  g.moveTo(cx + 3 * u, h * 0.3);
  g.quadraticCurveTo(cx + 14 * u, h * 0.18, cx + 20 * u, h * 0.2);
  g.stroke();
}

function lantern(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
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
  g.fillRect(cx - w * 0.25, h * 0.8, w * 0.5, 8 * u);
  g.strokeStyle = '#2a2230';
  g.lineWidth = 5 * u;
  g.strokeRect(cx - w * 0.2, h * 0.3, w * 0.4, h * 0.5);
  g.lineWidth = 2.5 * u;
  g.beginPath();
  g.moveTo(cx, h * 0.3);
  g.lineTo(cx, h * 0.8);
  g.stroke();
  g.lineWidth = 5 * u;
  g.beginPath();
  g.arc(cx, h * 0.12, 8 * u, 0, Math.PI * 2);
  g.stroke();
  // Brass highlights.
  g.strokeStyle = 'rgba(255,210,140,0.5)';
  g.lineWidth = 1.5 * u;
  g.strokeRect(cx - w * 0.2 - 2 * u, h * 0.3 - 2 * u, w * 0.4 + 4 * u, 2 * u);
  // A face in the flame.
  orb(g, cx, h * 0.56, w * 0.15, h * 0.18, '#ffcf6a');
  blob(g, cx - 9 * u, h * 0.52, 4 * u, 5 * u, '#5a2a10');
  blob(g, cx + 9 * u, h * 0.52, 4 * u, 5 * u, '#5a2a10');
  blob(g, cx - 10 * u, h * 0.51, 1.2 * u, 1.2 * u, '#fff3c4');
  blob(g, cx + 8 * u, h * 0.51, 1.2 * u, 1.2 * u, '#fff3c4');
  g.strokeStyle = '#5a2a10';
  g.lineWidth = 2 * u;
  g.beginPath();
  g.arc(cx, h * 0.6, 8 * u, 0.3, Math.PI - 0.3);
  g.stroke();
}

function snapcasket(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  blob(g, cx, h * 0.88, w * 0.36, h * 0.05, 'rgba(20,10,5,0.35)');
  // Body.
  const bx = cx - w * 0.3;
  const by = h * 0.56;
  const bw = w * 0.6;
  const bh = h * 0.3;
  const body = g.createLinearGradient(bx, 0, bx + bw, 0);
  body.addColorStop(0, '#8a5a36');
  body.addColorStop(1, '#5a3a20');
  g.fillStyle = body;
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#3a3340';
  g.fillRect(bx - 3 * u, by + bh * 0.25, bw + 6 * u, 6 * u);
  g.fillRect(bx + bw * 0.15, by, 6 * u, bh);
  g.fillRect(bx + bw * 0.85 - 6 * u, by, 6 * u, bh);
  // Open mouth and the lid tipped back.
  g.fillStyle = '#5a1420';
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(bx + bw, by);
  g.lineTo(bx + bw * 0.95, by - h * 0.16);
  g.lineTo(bx + bw * 0.05, by - h * 0.16);
  g.fill();
  const lid = g.createLinearGradient(0, by - h * 0.32, 0, by - h * 0.14);
  lid.addColorStop(0, '#a06a3e');
  lid.addColorStop(1, '#6e4226');
  g.fillStyle = lid;
  g.beginPath();
  g.ellipse(cx, by - h * 0.17, bw * 0.52, h * 0.1, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(bx - bw * 0.02, by - h * 0.18, bw * 1.04, h * 0.03);
  // Teeth top and bottom.
  g.fillStyle = '#f3ead8';
  for (let i = 0; i < 7; i++) {
    const x = bx + bw * (0.08 + i * 0.14);
    g.beginPath();
    g.moveTo(x - 5 * u, by);
    g.lineTo(x + 5 * u, by);
    g.lineTo(x, by - 10 * u);
    g.fill();
    g.beginPath();
    g.moveTo(x - 5 * u + 7 * u, by - h * 0.15);
    g.lineTo(x + 5 * u + 7 * u, by - h * 0.15);
    g.lineTo(x + 7 * u, by - h * 0.15 + 10 * u);
    g.fill();
  }
  // Glowing eyes in the dark of the lid, and a lolling tongue.
  for (const side of [-1, 1]) eye(g, cx + side * 14 * u, by - h * 0.09, 6 * u, '#1b120c', '#ffd84a');
  blob(g, cx + 12 * u, by + 6 * u, 12 * u, 6 * u, '#e0607a');
  blob(g, cx + 10 * u, by + 4 * u, 4 * u, 2 * u, 'rgba(255,255,255,0.4)');
}

function mouse(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  blob(g, cx, h * 0.84, w * 0.34, h * 0.05, 'rgba(20,10,5,0.35)');
  // A long curling tail.
  g.strokeStyle = '#a07a3a';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.moveTo(cx - w * 0.22, h * 0.72);
  g.bezierCurveTo(cx - w * 0.45, h * 0.7, cx - w * 0.42, h * 0.45, cx - w * 0.3, h * 0.42);
  g.stroke();
  orb(g, cx, h * 0.66, w * 0.27, h * 0.16, '#c99a3e');
  // Riveted seams.
  g.strokeStyle = 'rgba(90,60,20,0.6)';
  g.lineWidth = 1.5 * u;
  g.beginPath();
  g.ellipse(cx, h * 0.66, w * 0.2, h * 0.16, 0, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  for (let i = 0; i < 5; i++) blob(g, cx - w * 0.12 + i * w * 0.06, h * 0.56, 1.6 * u, 1.6 * u, '#7a5a20');
  // Head, ears, a pink nose, whiskers.
  orb(g, cx + w * 0.24, h * 0.62, w * 0.12, h * 0.09, '#d4a94a');
  orb(g, cx + w * 0.2, h * 0.5, w * 0.07, w * 0.07, '#d4a94a');
  blob(g, cx + w * 0.2, h * 0.5, w * 0.04, w * 0.04, '#e8a0a0');
  blob(g, cx + w * 0.35, h * 0.63, 4 * u, 4 * u, '#e0607a');
  eye(g, cx + w * 0.27, h * 0.59, 4 * u, '#1b120c', '#1b120c');
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = u;
  for (const dy of [-3, 0, 3]) {
    g.beginPath();
    g.moveTo(cx + w * 0.34, h * 0.64);
    g.lineTo(cx + w * 0.46, h * 0.64 + dy * u * 2);
    g.stroke();
  }
  // The wind-up key on its back, and a stolen key in its mouth.
  g.fillStyle = '#e8c25a';
  g.fillRect(cx - 3 * u, h * 0.42, 6 * u, h * 0.08);
  blob(g, cx - 9 * u, h * 0.41, 8 * u, 6 * u, '#e8c25a');
  blob(g, cx + 9 * u, h * 0.41, 8 * u, 6 * u, '#e8c25a');
  g.strokeStyle = '#b0b8c0';
  g.lineWidth = 3 * u;
  g.beginPath();
  g.arc(cx + w * 0.42, h * 0.7, 6 * u, 0, Math.PI * 2);
  g.moveTo(cx + w * 0.36, h * 0.7);
  g.lineTo(cx + w * 0.3, h * 0.72);
  g.stroke();
  // Little wheels for feet.
  for (const x of [-0.12, 0.12]) blob(g, cx + w * x, h * 0.8, 6 * u, 6 * u, '#3a3340');
}

function mushroom(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  blob(g, cx, h * 0.9, w * 0.3, h * 0.04, 'rgba(20,10,5,0.35)');
  // Motion lines: it has just bounced.
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2 * u;
  for (const dx of [-0.32, 0.32]) {
    g.beginPath();
    g.moveTo(cx + w * dx, h * 0.62);
    g.lineTo(cx + w * dx * 1.15, h * 0.8);
    g.stroke();
  }
  // A squat, springy stem with a coiled band.
  const stem = g.createLinearGradient(cx - w * 0.12, 0, cx + w * 0.12, 0);
  stem.addColorStop(0, '#f6ecd8');
  stem.addColorStop(1, '#d8c8a8');
  g.fillStyle = stem;
  g.beginPath();
  g.moveTo(cx - w * 0.11, h * 0.88);
  g.quadraticCurveTo(cx - w * 0.16, h * 0.7, cx - w * 0.1, h * 0.5);
  g.lineTo(cx + w * 0.1, h * 0.5);
  g.quadraticCurveTo(cx + w * 0.16, h * 0.7, cx + w * 0.11, h * 0.88);
  g.fill();
  g.strokeStyle = '#8ef06a';
  g.lineWidth = 2 * u;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(cx, h * (0.58 + i * 0.07), w * 0.12, h * 0.015, 0, 0, Math.PI);
    g.stroke();
  }
  // Cap, spotted, with a cheeky face.
  const cap = g.createRadialGradient(cx - w * 0.1, h * 0.32, 4, cx, h * 0.4, w * 0.4);
  cap.addColorStop(0, '#f07a98');
  cap.addColorStop(1, '#a8304e');
  g.fillStyle = cap;
  g.beginPath();
  g.ellipse(cx, h * 0.48, w * 0.38, h * 0.24, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f3dcc8';
  g.fillRect(cx - w * 0.38, h * 0.47, w * 0.76, h * 0.03);
  for (const [x, y, r] of [
    [-0.2, 0.36, 9],
    [0.05, 0.3, 11],
    [0.24, 0.39, 8],
    [-0.04, 0.42, 6],
  ]) {
    blob(g, cx + w * x, h * y, r * u, r * u * 0.8, '#fff4dc');
  }
  for (const side of [-1, 1]) eye(g, cx + side * 9 * u, h * 0.6, 5 * u, '#1b120c');
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = 1.5 * u;
  g.beginPath();
  g.arc(cx, h * 0.64, 6 * u, 0.2, Math.PI - 0.2);
  g.stroke();
}

function wisp(g: CanvasRenderingContext2D, cx: number, w: number, h: number): void {
  const u = w / 160;
  // A soft halo in the dark.
  const halo = g.createRadialGradient(cx, h * 0.5, 4, cx, h * 0.5, w * 0.5);
  halo.addColorStop(0, 'rgba(200,235,255,0.7)');
  halo.addColorStop(1, 'rgba(120,170,230,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  // A teardrop of light with a wavering tail.
  const body = g.createRadialGradient(cx - w * 0.05, h * 0.46, 2, cx, h * 0.5, w * 0.2);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.6, '#cfeeff');
  body.addColorStop(1, 'rgba(150,200,255,0.2)');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx, h * 0.3);
  g.bezierCurveTo(cx + w * 0.22, h * 0.36, cx + w * 0.2, h * 0.6, cx, h * 0.62);
  g.bezierCurveTo(cx - w * 0.06, h * 0.72, cx + w * 0.08, h * 0.8, cx - w * 0.04, h * 0.88);
  g.bezierCurveTo(cx - w * 0.14, h * 0.76, cx - w * 0.22, h * 0.6, cx - w * 0.18, h * 0.48);
  g.bezierCurveTo(cx - w * 0.16, h * 0.38, cx - w * 0.08, h * 0.31, cx, h * 0.3);
  g.fill();
  // Wide, nervous eyes and a worried little mouth.
  for (const side of [-1, 1]) eye(g, cx + side * 9 * u, h * 0.47, 5 * u, '#2a4a7a', '#ffffff');
  g.strokeStyle = '#4a6a9a';
  g.lineWidth = 1.5 * u;
  g.beginPath();
  g.arc(cx, h * 0.58, 4 * u, Math.PI + 0.4, -0.4);
  g.stroke();
  // Sparkles.
  for (const [x, y] of [
    [-0.32, 0.3],
    [0.3, 0.26],
    [0.34, 0.66],
    [-0.28, 0.72],
  ]) {
    blob(g, cx + w * x, h * y, 2 * u, 2 * u, '#ffffff');
  }
}
