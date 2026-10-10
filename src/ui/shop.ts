import { CARD_BY_ID } from '../data/cards';
import { SHOP_ITEMS, type ShopItem } from '../data/shop';
import type { GameState } from '../state/gameState';
import { drawCardFace } from './cardArt';

const $ = (id: string) => document.getElementById(id)!;

const QUIPS = [
  'Pleasure doing business!',
  'No refunds. Or receipts. Or questions.',
  "Moss, write that down. Moss? He's eating the stock again.",
  'A fine choice. Our finest. Our only, really.',
];

/** Crumbleton's Cupboard: buy cards and charms with sweets. */
export class Shop {
  private root = $('shop');
  private grid = $('shop-grid');
  private balance = $('shop-balance');
  private quip = $('shop-quip');
  private icons = new Map<string, string>();
  private resolve: (() => void) | null = null;
  isOpen = false;
  /** Called after closing (re-lock the mouse). */
  onClose: (() => void) | null = null;

  constructor(private getState: () => GameState) {
    $('shop-close').addEventListener('click', () => this.close());
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.isOpen) return;
        if (e.code === 'Escape' || e.code === 'KeyE') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.close();
        }
      },
      true,
    );
  }

  open(): Promise<void> {
    this.isOpen = true;
    this.quip.textContent = '"Everything\'s on sale. Nothing\'s discounted."';
    this.render();
    this.root.classList.remove('hidden');
    return new Promise((r) => (this.resolve = r));
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.resolve?.();
    this.resolve = null;
    this.onClose?.();
  }

  /** Test hook. */
  buy(id: string): boolean {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    const ok = this.getState().buy(item);
    if (ok) this.quip.textContent = `"${QUIPS[Math.floor(Math.random() * QUIPS.length)]}"`;
    this.render();
    return ok;
  }

  private icon(item: ShopItem): string {
    const hit = this.icons.get(item.id);
    if (hit) return hit;
    let url: string;
    if (item.kind === 'card') {
      url = drawCardFace(CARD_BY_ID.get(item.ref)!, 128, 180).toDataURL();
    } else {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      drawUpgradeIcon(c.getContext('2d')!, item.ref);
      url = c.toDataURL();
    }
    this.icons.set(item.id, url);
    return url;
  }

  private render(): void {
    const s = this.getState();
    this.balance.textContent = String(s.sweets);
    this.grid.innerHTML = '';
    for (const item of SHOP_ITEMS) {
      const owned = s.owns(item);
      const afford = s.sweets >= item.price;
      const el = document.createElement('div');
      el.className = 'shop-item' + (owned ? ' owned' : '') + (item.soon ? ' soon' : '');
      el.innerHTML = `
        <img src="${this.icon(item)}" alt="" class="${item.kind}" />
        <div class="shop-info">
          <div class="shop-name">${item.name}</div>
          <div class="shop-blurb">${item.blurb}</div>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.dataset.id = item.id;
      if (owned) {
        btn.textContent = 'Owned';
        btn.disabled = true;
      } else if (item.soon) {
        btn.textContent = 'Coming soon';
        btn.disabled = true;
      } else {
        btn.innerHTML = `<span class="sweet-icon"></span> ${item.price}`;
        btn.disabled = !afford;
        btn.title = afford ? 'Buy' : 'Not enough sweets';
        btn.addEventListener('click', () => this.buy(item.id));
      }
      el.appendChild(btn);
      this.grid.appendChild(el);
    }
  }
}

function drawUpgradeIcon(g: CanvasRenderingContext2D, id: string): void {
  const bg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  bg.addColorStop(0, '#fff3d6');
  bg.addColorStop(1, '#d9c18f');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  switch (id) {
    case 'stout-heart': {
      // An acorn on a string.
      g.strokeStyle = '#5a3a1e';
      g.beginPath();
      g.moveTo(64, 14);
      g.lineTo(64, 40);
      g.stroke();
      g.fillStyle = '#8a5a36';
      g.beginPath();
      g.ellipse(64, 80, 24, 30, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5a3a1e';
      g.beginPath();
      g.ellipse(64, 52, 30, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0563a';
      g.beginPath();
      g.arc(64, 84, 9, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'quick-wand': {
      g.strokeStyle = '#7a4a26';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(30, 100);
      g.lineTo(90, 36);
      g.stroke();
      g.fillStyle = '#ffd27a';
      g.beginPath();
      g.arc(94, 32, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ff9a3c';
      g.lineWidth = 4;
      for (const [x1, y1, x2, y2] of [
        [100, 50, 116, 56],
        [104, 22, 118, 14],
        [78, 18, 76, 4],
      ]) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      break;
    }
    case 'sweet-tooth': {
      g.fillStyle = '#a24fd0';
      g.beginPath();
      g.arc(64, 64, 22, 0, Math.PI * 2);
      g.fill();
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(64 + d * 20, 64);
        g.lineTo(64 + d * 44, 46);
        g.lineTo(64 + d * 44, 82);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      for (const r of [32, 42]) {
        g.beginPath();
        g.arc(64, 64, r, -0.6, 0.6);
        g.stroke();
        g.beginPath();
        g.arc(64, 64, r, Math.PI - 0.6, Math.PI + 0.6);
        g.stroke();
      }
      break;
    }
    default: {
      g.fillStyle = '#f3e4c4';
      g.fillRect(28, 32, 72, 64);
      g.strokeStyle = '#8a5a36';
      g.lineWidth = 3;
      g.strokeRect(28, 32, 72, 64);
      g.strokeStyle = '#b0362f';
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(36, 86);
      g.bezierCurveTo(54, 50, 74, 90, 88, 44);
      g.stroke();
      g.setLineDash([]);
      g.font = 'bold 26px Georgia, serif';
      g.fillStyle = '#b0362f';
      g.fillText('✕', 80, 52);
    }
  }
}
