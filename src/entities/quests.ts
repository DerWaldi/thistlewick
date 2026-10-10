import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPEAKERS } from '../data/characters';
import { QUEST_BY_ID, questStage, type QuestDef, type QuestItemKind } from '../data/quests';
import { paint } from '../world/builder';
import { worldMaterial } from '../world/materials';
import type { Entity, SpecOf, WorldContext } from './types';

const textures = new Map<string, CanvasTexture>();

/** A gold "!" or "?" in a little disc, floating over a student with an errand. */
export function questMarkerTexture(symbol: '!' | '?'): CanvasTexture {
  let t = textures.get(symbol);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(40, 24, 10, 0.85)';
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#e8c25a';
  g.stroke();
  g.fillStyle = '#ffd86a';
  g.font = 'bold 44px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, 32, 35);
  t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  textures.set(symbol, t);
  return t;
}

/** The marker over a quest giver: ! while the errand is on offer, ? once the thing is found. */
export class QuestMarker {
  readonly sprite: Sprite;
  private material = new SpriteMaterial({ transparent: true, depthWrite: false, fog: false });
  private t = 0;

  constructor(
    parent: Group,
    private quest: QuestDef,
    private ctx: WorldContext,
    private height: number,
  ) {
    this.sprite = new Sprite(this.material);
    this.sprite.scale.setScalar(0.55);
    this.sprite.renderOrder = 5;
    parent.add(this.sprite);
    this.refresh();
    ctx.events.on('quest', ({ id }) => id === quest.id && this.refresh());
  }

  refresh(): void {
    const stage = questStage(this.ctx.state, this.quest);
    const symbol = stage === 'offered' ? '!' : stage === 'found' ? '?' : null;
    this.sprite.visible = symbol !== null;
    if (symbol) {
      this.material.map = questMarkerTexture(symbol);
      this.material.needsUpdate = true;
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.sprite.position.set(0, this.height + Math.sin(this.t * 2.4) * 0.06, 0);
  }
}

/**
 * The lost thing itself: bobbing and turning where it was dropped, only while its quest is
 * accepted and it hasn't been picked up yet. Walk into it to pick it up.
 */
export class QuestItem implements Entity {
  private group = new Group();
  private readonly pos: Vector3;
  private readonly quest: QuestDef;
  private t = Math.random() * 6;

  constructor(
    spec: SpecOf<'questItem'>,
    private ctx: WorldContext,
  ) {
    this.quest = QUEST_BY_ID.get(spec.quest)!;
    this.pos = new Vector3(...spec.pos);
    const mesh = new Mesh(buildItem(this.quest.item.kind), worldMaterial());
    mesh.castShadow = true;
    this.group.add(mesh);
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
    this.refresh();
    ctx.events.on('quest', ({ id }) => id === this.quest.id && this.refresh());
  }

  private get waiting(): boolean {
    return questStage(this.ctx.state, this.quest) === 'active';
  }

  private refresh(): void {
    this.group.visible = this.waiting;
  }

  fixedUpdate(): void {
    if (!this.group.visible) return;
    if (this.ctx.player.pos.distanceTo(this.pos) > 1.3) return;
    const q = this.quest;
    this.ctx.state.flags.add(`quest:${q.id}:found`);
    this.group.visible = false;
    this.ctx.fx.burst(this.pos.clone(), 18, new Color('#ffd86a'), 2.4, 0.16);
    this.ctx.events.emit('toast', { text: `Found ${q.item.name}! Take it back to ${SPEAKERS[q.giver].name}.`, kind: 'info' });
    this.ctx.events.emit('quest', { id: q.id, stage: 'found' });
  }

  frameUpdate(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    this.group.position.y = this.pos.y + Math.sin(this.t * 2) * 0.08;
    this.group.rotation.y = this.t * 0.8;
  }
}

/** Little merged vertex-coloured models, one per kind of lost thing. */
function buildItem(kind: QuestItemKind): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (geo: BufferGeometry, color: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo).rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]).translate(...pos);
    g.deleteAttribute('uv');
    parts.push(paint(g, color, true));
  };
  switch (kind) {
    case 'kite':
      add(new CylinderGeometry(0.5, 0.5, 0.03, 4).scale(0.75, 1, 1.1), '#4f7fb8', [0, 0.6, 0], [Math.PI / 2, 0, 0]);
      add(new BoxGeometry(0.03, 0.85, 0.04), '#e8d8b0', [0, 0.6, 0.02]);
      add(new BoxGeometry(0.6, 0.03, 0.04), '#e8d8b0', [0, 0.65, 0.02]);
      for (let i = 0; i < 4; i++) add(new BoxGeometry(0.12, 0.06, 0.02), i % 2 ? '#e8c25a' : '#b0362f', [0.05 * (i % 2), 0.05 - i * 0.18, 0], [0, 0, 0.5]);
      break;
    case 'book':
      add(new BoxGeometry(0.5, 0.12, 0.38), '#7a2a2a', [0, 0.1, 0]);
      add(new BoxGeometry(0.46, 0.09, 0.36), '#f3e4c4', [0.02, 0.1, 0]);
      add(new BoxGeometry(0.05, 0.13, 0.39), '#c99a3e', [-0.23, 0.1, 0]);
      break;
    case 'toad':
      add(new SphereGeometry(0.22, 8, 6).scale(1, 0.7, 1.2), '#5f8a3a', [0, 0.16, 0]);
      add(new SphereGeometry(0.07, 6, 4), '#e8d860', [0.1, 0.3, 0.15]);
      add(new SphereGeometry(0.07, 6, 4), '#e8d860', [-0.1, 0.3, 0.15]);
      add(new SphereGeometry(0.035, 5, 4), '#1e1612', [0.1, 0.32, 0.2]);
      add(new SphereGeometry(0.035, 5, 4), '#1e1612', [-0.1, 0.32, 0.2]);
      add(new SphereGeometry(0.15, 6, 4).scale(1.4, 0.4, 1), '#c8d88a', [0, 0.08, 0.05]);
      break;
    case 'hat':
      add(new CylinderGeometry(0.45, 0.45, 0.04, 12), '#3a1a3a', [0, 0.05, 0]);
      add(new ConeGeometry(0.26, 0.7, 10), '#3a1a3a', [0, 0.42, 0], [0.15, 0, 0.1]);
      add(new CylinderGeometry(0.27, 0.27, 0.08, 10), '#b0362f', [0, 0.12, 0]);
      break;
    case 'float':
      add(new SphereGeometry(0.16, 8, 6), '#d83a2a', [0, 0.3, 0]);
      add(new SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#f3eee0', [0, 0.3, 0]);
      add(new CylinderGeometry(0.02, 0.02, 0.5, 5), '#e8c25a', [0, 0.35, 0]);
      add(new TorusGeometry(0.08, 0.015, 4, 8), '#c8c0b0', [0, 0.05, 0], [Math.PI / 2, 0, 0]);
      break;
    case 'hedgehog':
      add(new SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.25), '#6a4a2e', [0, 0.05, 0]);
      add(new SphereGeometry(0.12, 6, 5).scale(1, 0.8, 1.2), '#d8b890', [0, 0.1, 0.27]);
      add(new SphereGeometry(0.03, 4, 3), '#1e1612', [0, 0.12, 0.42]);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        add(new ConeGeometry(0.035, 0.16, 4), '#4a3220', [Math.cos(a) * 0.16, 0.22, Math.sin(a) * 0.2 - 0.03], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]);
      }
      add(new IcosahedronGeometry(0.02, 0), '#1e1612', [0.06, 0.15, 0.34]);
      add(new IcosahedronGeometry(0.02, 0), '#1e1612', [-0.06, 0.15, 0.34]);
      break;
  }
  return mergeGeometries(parts)!;
}
