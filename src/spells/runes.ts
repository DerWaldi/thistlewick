import { AdditiveBlending, CanvasTexture, MathUtils, NormalBlending, Sprite, SpriteMaterial, SRGBColorSpace, type Object3D } from 'three';
import { SPELLS, type SpellId } from '../data/spells';

const SIZE = 128;
const cache = new Map<string, CanvasTexture>();

/** Draw a spell's rune glyph (white strokes on transparent) into a canvas texture. */
export function runeTexture(spell: SpellId, unknown = false): CanvasTexture {
  const key = spell + (unknown ? ':grey' : '');
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const color = unknown ? '#9a9494' : SPELLS[spell].color;
  g.translate(SIZE / 2, SIZE / 2);

  // Soft disc behind the glyph.
  const grad = g.createRadialGradient(0, 0, 8, 0, 0, 60);
  grad.addColorStop(0, unknown ? 'rgba(60,55,60,0.55)' : 'rgba(40,20,50,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = unknown ? 0 : 10;
  g.beginPath();
  g.arc(0, 0, 50, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 6;
  drawGlyph(g, spell);
  if (unknown) {
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowBlur = 0;
    g.fillStyle = '#f3e4c4';
    g.fillText('?', 34, 34);
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function drawGlyph(g: CanvasRenderingContext2D, spell: SpellId): void {
  g.beginPath();
  switch (spell) {
    case 'thwackwort': {
      // A burst: a fist-like knot with radiating strikes.
      g.arc(0, 0, 11, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r0 = i % 2 ? 20 : 18;
        const r1 = i % 2 ? 32 : 40;
        g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      break;
    }
    case 'latchkin': {
      g.arc(0, -16, 12, 0, Math.PI * 2);
      g.moveTo(0, -4);
      g.lineTo(0, 34);
      g.moveTo(0, 20);
      g.lineTo(12, 20);
      g.moveTo(0, 30);
      g.lineTo(10, 30);
      break;
    }
    case 'glimmerwick': {
      g.moveTo(-34, 0);
      g.quadraticCurveTo(0, -30, 34, 0);
      g.quadraticCurveTo(0, 30, -34, 0);
      g.moveTo(9, 0);
      g.arc(0, 0, 9, 0, Math.PI * 2);
      break;
    }
    case 'cindersnap': {
      g.moveTo(0, 34);
      g.bezierCurveTo(-30, 26, -22, -4, -6, -14);
      g.bezierCurveTo(-8, -2, 2, 2, 4, -6);
      g.bezierCurveTo(4, -20, 10, -28, 6, -38);
      g.bezierCurveTo(28, -18, 30, 22, 0, 34);
      break;
    }
    case 'springwell': {
      for (let t = 0; t < 6 * Math.PI; t += 0.2) {
        const r = 3 + t * 1.75;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      break;
    }
    case 'rimewhistle': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        g.moveTo(0, 0);
        g.lineTo(cx * 36, cy * 36);
        const bx = cx * 22;
        const by = cy * 22;
        g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(a + 0.7) * 10, by + Math.sin(a + 0.7) * 10);
        g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(a - 0.7) * 10, by + Math.sin(a - 0.7) * 10);
      }
      break;
    }
    case 'thistledown': {
      g.moveTo(-26, 30);
      g.quadraticCurveTo(0, 0, 24, -30);
      for (let i = 0; i < 5; i++) {
        const t = 0.2 + i * 0.16;
        const x = -26 + 50 * t;
        const y = 30 - 60 * t;
        g.moveTo(x, y);
        g.lineTo(x - 14, y - 6);
        g.moveTo(x, y);
        g.lineTo(x + 6, y + 14);
      }
      break;
    }
  }
  g.stroke();
}

export type MarkerState = 'hidden' | 'idle' | 'targeted';

/**
 * Floating rune shown over a spell target. Idle markers are small and faint so
 * the world stays readable; the current target's marker grows and pulses.
 */
export class RuneMarker {
  readonly sprite: Sprite;
  private material: SpriteMaterial;
  private scale = 0;
  private pulse = 0;
  state: MarkerState = 'hidden';
  private spell: SpellId;
  private unknown = false;

  constructor(parent: Object3D, spell: SpellId, private baseSize = 0.7) {
    this.spell = spell;
    this.material = new SpriteMaterial({
      map: runeTexture(spell),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    this.sprite = new Sprite(this.material);
    this.sprite.renderOrder = 5;
    this.sprite.visible = false;
    parent.add(this.sprite);
  }

  /** Targets whose spell changes (a Snapcasket: Latchkin while snapping, Thwackwort once locked). */
  setSpell(spell: SpellId): void {
    if (spell === this.spell) return;
    this.spell = spell;
    this.material.map = runeTexture(spell, this.unknown);
    this.material.needsUpdate = true;
  }

  setUnknown(unknown: boolean): void {
    if (unknown === this.unknown) return;
    this.unknown = unknown;
    this.material.map = runeTexture(this.spell, unknown);
    this.material.blending = unknown ? NormalBlending : AdditiveBlending;
    this.material.needsUpdate = true;
  }

  update(dt: number): void {
    const target = this.state === 'hidden' ? 0 : this.state === 'idle' ? 0.55 : 1;
    this.scale = MathUtils.damp(this.scale, target, 12, dt);
    this.pulse += dt * 6;
    this.sprite.visible = this.scale > 0.02;
    const pulse = this.state === 'targeted' ? 1 + Math.sin(this.pulse) * 0.08 : 1;
    const s = this.baseSize * this.scale * pulse;
    this.sprite.scale.set(s, s, 1);
    this.material.opacity = this.state === 'targeted' ? 1 : 0.55;
  }
}
