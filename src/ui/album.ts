import { CARDS, type CardDef } from '../data/cards';
import { device } from '../state/device';
import type { GameState } from '../state/gameState';
import { drawCardBack, drawCardFace } from './cardArt';

const $ = (id: string) => document.getElementById(id)!;

/** The Fabled Folk album: found cards in colour, missing ones as numbered backs. */
export class Album {
  private root = $('album');
  private grid = $('album-grid');
  private count = $('album-count');
  private detail = $('album-detail');
  private faces = new Map<string, string>();
  private back = '';
  isOpen = false;
  /** Called when the album closes (to re-lock the mouse). */
  onClose: (() => void) | null = null;

  constructor(private getState: () => GameState) {
    $('album-close').addEventListener('click', () => this.close());
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.isOpen = true;
    this.render();
    this.root.classList.remove('hidden');
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  private faceURL(card: CardDef): string {
    let url = this.faces.get(card.id);
    if (!url) {
      url = drawCardFace(card).toDataURL();
      this.faces.set(card.id, url);
    }
    return url;
  }

  private render(): void {
    const state = this.getState();
    if (!this.back) this.back = drawCardBack().toDataURL();
    const found = CARDS.filter((c) => state.cards.has(c.id)).length;
    this.count.textContent = `${found} of ${CARDS.length} found`;
    this.grid.innerHTML = '';
    // Two rows, however many cards there are (the stylesheet drops to 4 across on narrow screens).
    this.grid.style.setProperty('--cols', String(Math.max(7, Math.ceil(CARDS.length / 2))));
    for (const card of CARDS) {
      const have = state.cards.has(card.id);
      const el = document.createElement('div');
      el.className = 'album-card' + (have ? '' : ' missing');
      const img = document.createElement('img');
      img.src = have ? this.faceURL(card) : this.back;
      img.alt = have ? card.name : `Card ${card.number}`;
      el.appendChild(img);
      if (!have) {
        const num = document.createElement('div');
        num.className = 'num';
        num.textContent = String(card.number);
        el.appendChild(num);
      }
      el.addEventListener('click', () => this.showDetail(card, have));
      this.grid.appendChild(el);
    }
    this.detail.innerHTML = `<i>${device.touch ? 'Tap' : 'Click'} a card to read it.</i>`;
  }

  private showDetail(card: CardDef, have: boolean): void {
    this.detail.innerHTML = have
      ? `<h3>#${card.number} ${card.name}</h3><div><i>${card.title}</i> · ${card.set}</div><p>${card.text}</p>`
      : `<h3>#${card.number} ???</h3><p><i>${card.hint}</i></p>`;
  }
}
