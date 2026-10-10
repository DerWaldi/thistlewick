import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { CARD_BY_ID } from '../data/cards';
import { SPEAKERS } from '../data/characters';
import { HOUSE_ORDER, HOUSES } from '../data/houses';
import { buildStudent, type StudentRig } from '../player/model';
import { drawCardBack, drawCardFace } from '../ui/cardArt';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, Interactable, SpecOf, WorldContext } from './types';

const UP = new Vector3(0, 1, 0);
const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(UP, yaw);
/** Local +X (right) for something facing `yaw`. */
const rightOf = (yaw: number) => new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

// ---------------------------------------------------------------- cards

/** A Fabled Folk card spinning in the air, sparkling. Collected on touch. */
export class CardPickup implements Entity {
  private group = new Group();
  private readonly pos: Vector3;
  private taken = false;
  private t = Math.random() * 10;

  constructor(
    private spec: SpecOf<'card'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const card = CARD_BY_ID.get(spec.card);
    if (!card) throw new Error(`Unknown card ${spec.card}`);
    const face = new CanvasTexture(drawCardFace(card));
    face.colorSpace = SRGBColorSpace;
    const back = new CanvasTexture(drawCardBack());
    back.colorSpace = SRGBColorSpace;
    const geo = new PlaneGeometry(0.5, 0.7);
    const front = new Mesh(geo, new MeshBasicMaterial({ map: face, fog: true }));
    const rear = new Mesh(geo, new MeshBasicMaterial({ map: back, fog: true }));
    rear.rotation.y = Math.PI;
    // No point light here: adding/removing lights forces shader recompiles (a hitch on pickup).
    this.group.add(front, rear);
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
  }

  fixedUpdate(): void {
    if (this.taken) return;
    const p = this.ctx.player.pos;
    if (p.distanceTo(this.pos) < 1.1) {
      this.taken = true;
      this.group.removeFromParent();
      this.ctx.fx.burst(this.pos, 24, new Color('#ffe58a'), 2.5, 0.08, 1.5);
      this.ctx.state.collectCard(this.spec.card);
    }
  }

  frameUpdate(dt: number): void {
    if (this.taken) return;
    this.t += dt;
    this.group.rotation.y = this.t * 1.6;
    this.group.position.y = this.pos.y + Math.sin(this.t * 2) * 0.1;
    if (Math.random() < dt * 6) {
      const s = this.pos.clone().add(new Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.7));
      this.ctx.fx.burst(s, 1, new Color('#fff3c4'), 0.2, 0.04, 0.3);
    }
  }
}

// ---------------------------------------------------------------- secrets

/** An invisible volume: stepping inside counts the secret as found. */
export class SecretVolume implements Entity {
  private readonly min: Vector3;
  private readonly max: Vector3;

  constructor(
    private spec: SpecOf<'secret'>,
    private ctx: WorldContext,
  ) {
    this.min = new Vector3(...spec.min);
    this.max = new Vector3(...spec.max);
  }

  fixedUpdate(): void {
    if (this.ctx.state.secrets.has(this.spec.id)) return;
    const p = this.ctx.player.pos;
    if (p.x > this.min.x && p.x < this.max.x && p.y > this.min.y && p.y < this.max.y && p.z > this.min.z && p.z < this.max.z) {
      const { total } = this.ctx.secretsIn(this.spec.area);
      this.ctx.state.findSecret(this.spec.id, this.spec.area, total, () => this.ctx.secretsIn(this.spec.area).found);
    }
  }
}

/**
 * A woven hanging. Decorative ones hang flat against walls; a `sway` one covers a
 * gap in the wall and stirs when you come close: a hint that there's air behind it.
 */
export class Tapestry implements Entity {
  private cloth: Mesh;
  private t = Math.random() * 10;
  private sway = 0;
  private readonly center: Vector3;

  constructor(
    private spec: SpecOf<'tapestry'>,
    private ctx: WorldContext,
  ) {
    const { width: w, height: h, color, trim = '#c9973a' } = spec;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = Math.round((128 * h) / w);
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = trim;
    g.lineWidth = 6;
    g.strokeRect(8, 8, c.width - 16, c.height - 16);
    // A woven thistle-and-lantern motif.
    g.fillStyle = trim;
    const cx = c.width / 2;
    const cy = c.height * 0.45;
    g.beginPath();
    g.ellipse(cx, cy, 18, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - 3, cy + 20, 6, 40);
    for (let i = 0; i < 6; i++) {
      g.fillRect(14 + i * ((c.width - 28) / 6), c.height - 30, 10, 18);
    }
    for (let y = 30; y < c.height - 40; y += 24) {
      g.globalAlpha = 0.25;
      g.fillRect(16, y, c.width - 32, 3);
      g.globalAlpha = 1;
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const geo = new PlaneGeometry(w, h, 6, 8);
    geo.translate(0, -h / 2, 0); // hang from the top edge
    this.cloth = new Mesh(geo, new MeshStandardMaterial({ map: tex, side: DoubleSide, roughness: 1 }));
    this.cloth.castShadow = true;
    const [x, y, z] = spec.pos;
    this.cloth.position.set(x, y + h, z);
    this.cloth.rotation.y = spec.yaw;
    const rod = new Mesh(new CylinderGeometry(0.05, 0.05, w + 0.4, 6), new MeshStandardMaterial({ color: '#3a2617' }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 0.02, 0.02);
    this.cloth.add(rod);
    ctx.scene.add(this.cloth);
    this.center = new Vector3(x, y + h / 2, z);
  }

  frameUpdate(dt: number): void {
    this.t += dt;
    const near = this.spec.sway && this.ctx.player.pos.distanceTo(this.center) < 3.2 ? 1 : 0;
    this.sway = MathUtils.damp(this.sway, near, 3, dt);
    const base = this.spec.sway ? 0.02 : 0;
    this.cloth.rotation.x = Math.sin(this.t * 1.7) * (base + this.sway * 0.12);
  }
}

/**
 * A bookshelf. With `when`, it slides sideways by `slide` metres while those
 * signals are on (a hidden door).
 */
export class Bookshelf implements Entity {
  private group = new Group();
  private collider: RAPIER.Collider;
  private open = 0;
  private prevOpen = 0;
  private readonly base: Vector3;
  private readonly right: Vector3;
  private announced = false;

  constructor(
    private spec: SpecOf<'bookshelf'>,
    private ctx: WorldContext,
  ) {
    const { width: w, height: h, yaw } = spec;
    this.base = new Vector3(...spec.pos);
    this.right = rightOf(yaw);
    this.group.position.copy(this.base);
    this.group.rotation.y = yaw;
    this.group.add(buildShelfMesh(w, h, spec.pos[0] * 7.1 + spec.pos[2] * 3.3));
    ctx.scene.add(this.group);
    const q = yawQ(yaw);
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, 0.25)
        .setTranslation(this.base.x, this.base.y + h / 2, this.base.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true });
  }

  fixedUpdate(dt: number): void {
    this.prevOpen = this.open;
    if (!this.spec.when) return;
    const want = this.ctx.signals.all(this.spec.when) ? 1 : 0;
    if (want === this.open) return;
    if (want && !this.announced) {
      this.announced = true;
      this.ctx.events.emit('gateMove', { pos: this.base.clone(), opening: true });
    }
    this.open = want > this.open ? Math.min(1, this.open + dt * 0.7) : Math.max(0, this.open - dt * 0.7);
    const p = this.base.clone().addScaledVector(this.right, this.open * (this.spec.slide ?? this.spec.width));
    this.collider.setTranslation({ x: p.x, y: p.y + this.spec.height / 2, z: p.z });
  }

  frameUpdate(_dt: number, alpha: number): void {
    const o = MathUtils.lerp(this.prevOpen, this.open, alpha);
    this.group.position.copy(this.base).addScaledVector(this.right, o * (this.spec.slide ?? this.spec.width));
  }
}

/** Frame, shelves and rows of colourful books, merged into one mesh. Faces +Z. */
export function buildShelfMesh(w: number, h: number, seed = 1): Mesh {
  const parts: Mesh[] = [];
  const g = new Group();
  const wood = worldMaterial();
  const add = (size: [number, number, number], pos: [number, number, number], color: string) => {
    const m = new Mesh(paint(new BoxGeometry(...size).toNonIndexed(), color, true, 'planks'), wood);
    m.position.set(...pos);
    m.castShadow = true;
    parts.push(m);
    g.add(m);
  };
  const d = 0.5;
  add([w, h, 0.06], [0, h / 2, -d / 2 + 0.03], COLORS.woodDark);
  add([0.08, h, d], [-w / 2 + 0.04, h / 2, 0], COLORS.wood);
  add([0.08, h, d], [w / 2 - 0.04, h / 2, 0], COLORS.wood);
  const shelves = Math.max(3, Math.round(h / 0.55));
  const bookColors = ['#7a2f3a', '#2f5a6a', '#5a6a3a', '#8a5a36', '#4a2c4f', '#a0522d', '#2b2b4a', '#c99a3e', '#3f7a4a'];
  let r = seed;
  const rand = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (let i = 0; i <= shelves; i++) {
    const y = (i / shelves) * (h - 0.06) + 0.03;
    add([w - 0.1, 0.05, d - 0.04], [0, y, 0], COLORS.wood);
    if (i === shelves) break;
    const rowH = h / shelves - 0.1;
    let x = -w / 2 + 0.1;
    while (x < w / 2 - 0.15) {
      const bw = 0.05 + rand() * 0.06;
      const bh = rowH * (0.6 + rand() * 0.35);
      const lean = rand() < 0.08;
      add([bw, bh, 0.3 + rand() * 0.08], [x + bw / 2, y + 0.025 + bh / 2, 0.02], bookColors[Math.floor(rand() * bookColors.length)]);
      if (lean) parts[parts.length - 1].rotation.z = 0.25;
      x += bw + 0.005 + (rand() < 0.1 ? 0.15 : 0);
    }
  }
  mergeChildren(g);
  const mesh = g.children[0] as Mesh;
  return mesh;
}

// ---------------------------------------------------------------- characters

/** A student or teacher you can talk to. Turns to face you when you're near. */
export class Npc implements Entity, Interactable {
  private rig: StudentRig;
  private t = Math.random() * 10;
  private readonly pos: Vector3;
  private yaw: number;
  readonly radius = 3.2; // shopkeepers stand behind a counter

  constructor(
    private spec: SpecOf<'npc'>,
    private ctx: WorldContext,
  ) {
    const l = spec.look ?? {};
    this.rig = buildStudent(l);
    this.pos = new Vector3(...spec.pos);
    this.yaw = spec.yaw;
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.scale.setScalar(l.scale ?? 1);
    ctx.scene.add(this.rig.root);
    ctx.physics.addStaticCylinder(this.pos.clone().add(new Vector3(0, 0.8, 0)), 0.8, 0.35);
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.2, 0));
  }
  prompt(): string {
    return `Talk to ${SPEAKERS[this.spec.speaker].name}`;
  }
  interact(): void {
    void this.ctx.talk(this.spec.talk);
  }

  frameUpdate(dt: number): void {
    this.t += dt;
    const p = this.ctx.player.pos;
    const near = p.distanceTo(this.pos) < 6;
    const want = near ? Math.atan2(p.x - this.pos.x, p.z - this.pos.z) : this.spec.yaw;
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-4 * dt));
    this.rig.root.rotation.y = this.yaw;
    this.rig.torso.position.y = 0.08 + Math.sin(this.t * 2.1) * 0.012;
    this.rig.head.rotation.z = Math.sin(this.t * 0.7) * 0.06;
    this.rig.armR.rotation.x = -0.3 + Math.sin(this.t * 1.3) * 0.15;
  }
}

/** The Sorting Lantern: an old brass lantern on a lectern, with a face in its flame. */
export class SortingLantern implements Entity, Interactable {
  private flame: Mesh;
  private light = new PointLight('#ffb35c', 3, 9, 1.5);
  private t = 0;
  private readonly pos: Vector3;
  readonly radius = 3;

  constructor(
    spec: SpecOf<'sortingLantern'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = spec.yaw;
    const wood = worldMaterial();
    const brass = new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.7, roughness: 0.35, flatShading: true });
    const stand = new Mesh(paint(new CylinderGeometry(0.18, 0.3, 1.1, 8).toNonIndexed(), COLORS.wood, true, 'planks'), wood);
    stand.position.y = 0.55;
    const top = new Mesh(paint(new CylinderGeometry(0.45, 0.45, 0.1, 8).toNonIndexed(), COLORS.wood, true, 'planks'), wood);
    top.position.y = 1.15;
    const cage = new Group();
    cage.position.y = 1.2;
    for (let i = 0; i < 4; i++) {
      const bar = new Mesh(new BoxGeometry(0.04, 0.7, 0.04), brass);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      bar.position.set(Math.cos(a) * 0.22, 0.35, Math.sin(a) * 0.22);
      cage.add(bar);
    }
    const roof = new Mesh(new CylinderGeometry(0.05, 0.36, 0.3, 4), brass);
    roof.position.y = 0.85;
    roof.rotation.y = Math.PI / 4;
    const ring = new Mesh(new CylinderGeometry(0.3, 0.3, 0.06, 4), brass);
    ring.rotation.y = Math.PI / 4;
    cage.add(roof, ring);
    this.flame = new Mesh(
      new SphereGeometry(0.15, 8, 6),
      new MeshStandardMaterial({ color: '#ffd27a', emissive: new Color('#ff9a3c'), emissiveIntensity: 2.2 }),
    );
    this.flame.position.y = 0.35;
    this.flame.scale.set(1, 1.4, 1);
    // Two dark eyes in the flame.
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.025, 5, 4), new MeshBasicMaterial({ color: '#5a2a10' }));
      eye.position.set(side * 0.06, 0.04, 0.13);
      this.flame.add(eye);
    }
    cage.add(this.flame);
    this.light.position.y = 0.4;
    cage.add(this.light);
    g.add(stand, top, cage);
    mergeChildren(cage, [this.flame]);
    mergeChildren(g);
    ctx.scene.add(g);
    ctx.physics.addStaticCylinder(this.pos.clone().add(new Vector3(0, 0.7, 0)), 0.7, 0.45);
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.6, 0));
  }
  prompt(): string {
    return this.ctx.state.house ? 'Talk to the Sorting Lantern' : 'Be sorted';
  }
  interact(): void {
    void this.ctx.talk('sorting');
  }

  frameUpdate(dt: number): void {
    this.t += dt;
    const f = 1 + Math.sin(this.t * 9) * 0.06 + Math.sin(this.t * 13.7) * 0.05;
    this.flame.scale.set(f, 1.4 * f, f);
    this.light.intensity = 3 * f;
  }
}

// ---------------------------------------------------------------- doors

/** A wooden door. Press E to go through (or be told why you can't). */
export class Door implements Interactable {
  private readonly pos: Vector3;
  readonly radius = 2.4;

  constructor(
    private spec: SpecOf<'door'>,
    private ctx: WorldContext,
  ) {
    const { width: w, height: h, yaw } = spec;
    this.pos = new Vector3(...spec.pos);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = yaw;
    const isIron = spec.style === 'iron';
    const mat = isIron ? worldMaterial({ metalness: 0.55, roughness: 0.5 }) : worldMaterial();
    const leaf = (x: number) => {
      const m = new Mesh(paint(new BoxGeometry(w / 2 - 0.02, h, 0.12).toNonIndexed(), isIron ? '#4a4d57' : COLORS.wood, true, isIron ? 'plain' : 'planks'), mat);
      m.position.set(x, h / 2, 0);
      m.castShadow = true;
      return m;
    };
    const iron = new MeshStandardMaterial({ color: '#2a2230', metalness: 0.5, roughness: 0.6, flatShading: true });
    g.add(leaf(-w / 4), leaf(w / 4));
    if (isIron) {
      // Riveted plates: a raised border on each leaf and rows of rivets.
      const plate = new MeshStandardMaterial({ color: '#5a5e68', metalness: 0.6, roughness: 0.45, flatShading: true });
      const rivet = new MeshStandardMaterial({ color: '#7a7e88', metalness: 0.7, roughness: 0.35, flatShading: true });
      const studs = new Group();
      for (const side of [-1, 1]) {
        const cx = (side * w) / 4;
        for (const [bw, bh, bx, by] of [
          [w / 2 - 0.14, 0.08, cx, h - 0.12],
          [w / 2 - 0.14, 0.08, cx, 0.12],
          [0.08, h - 0.2, cx - side * (w / 4 - 0.1), h / 2],
          [0.08, h - 0.2, cx + side * (w / 4 - 0.1), h / 2],
        ] as const) {
          const m = new Mesh(new BoxGeometry(bw, bh, 0.04), plate);
          m.position.set(bx, by, 0.075);
          studs.add(m);
        }
        for (let i = 0; i < 7; i++) {
          for (const dx of [-0.32, 0.32]) {
            const r = new Mesh(new SphereGeometry(0.035, 5, 4), rivet);
            r.position.set(cx + dx * (w / 2.4), 0.35 + i * ((h - 0.7) / 6), 0.08);
            studs.add(r);
          }
        }
      }
      mergeChildren(studs);
      g.add(studs);
    }
    // A dark panel behind the leaves, so the gap between them never shows the hole in the wall.
    const backing = new Mesh(paint(new BoxGeometry(w, h, 0.02).toNonIndexed(), '#1b120c', true), mat);
    backing.position.set(0, h / 2, -0.075);
    g.add(backing);
    for (const y of [h * 0.2, h * 0.75]) {
      const band = new Mesh(new BoxGeometry(w, 0.1, 0.15), iron);
      band.position.y = y;
      g.add(band);
    }
    for (const side of [-1, 1]) {
      const ringM = new Mesh(new CylinderGeometry(0.1, 0.1, 0.03, 10), new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.7, roughness: 0.4 }));
      ringM.rotation.x = Math.PI / 2;
      ringM.position.set(side * 0.18, h * 0.48, 0.09);
      g.add(ringM);
    }
    // A chunky frame that overlaps the wall around the opening, so no seams show.
    const frameMat = worldMaterial();
    const fw = 0.32;
    const jamb = (side: number) => {
      const m = new Mesh(paint(new BoxGeometry(fw, h + fw, 0.42).toNonIndexed(), COLORS.woodDark, true, 'planks'), frameMat);
      m.position.set(side * (w / 2 + fw / 2 - 0.08), (h + fw) / 2, 0.02);
      m.castShadow = true;
      return m;
    };
    const lintel = new Mesh(paint(new BoxGeometry(w + fw * 2 - 0.16, fw, 0.42).toNonIndexed(), COLORS.woodDark, true, 'planks'), frameMat);
    lintel.position.set(0, h + fw / 2 - 0.08, 0.02);
    const step = new Mesh(paint(new BoxGeometry(w + 0.3, 0.06, 0.5).toNonIndexed(), COLORS.stoneLight, true), frameMat);
    step.position.set(0, 0.03, 0.1);
    g.add(jamb(-1), jamb(1), lintel, step);
    if (spec.label) g.add(labelPlate(spec.label, w, h + fw));
    mergeChildren(g);
    ctx.scene.add(g);
    ctx.physics.addStaticBox(this.pos.clone().add(new Vector3(0, h / 2, 0)), new Vector3(w / 2, h / 2, 0.1), yawQ(yaw), { noGrab: true });
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.4, 0));
  }
  prompt(): string {
    return this.spec.to && !this.isLocked ? 'Open' : this.spec.talk ? 'Read' : 'Try the door';
  }
  private get isLocked(): boolean {
    if (this.spec.closedAfter && this.ctx.state.lessons.has(this.spec.closedAfter)) return true;
    if (this.spec.afterLesson && !this.ctx.state.lessons.has(this.spec.afterLesson)) return true;
    const during = this.spec.lockedDuring;
    if (during && this.ctx.state.knows(during) && !this.ctx.state.lessons.has(during)) return true;
    if (this.spec.lockedUnless) return !this.ctx.state.flags.has(this.spec.lockedUnless);
    return !!this.spec.locked || !this.spec.to;
  }

  interact(): void {
    if (this.spec.to && !this.isLocked) this.ctx.changeLevel(this.spec.to.level, this.spec.to.spawn);
    else if (this.spec.talk) void this.ctx.talk(this.spec.talk);
    else this.ctx.events.emit('toast', { text: this.spec.locked ?? 'Locked.', kind: 'hint' });
  }
}

function labelPlate(text: string, _w: number, h: number): Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c99a3e';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#2b1d14';
  g.fillRect(6, 6, 500, 84);
  g.fillStyle = '#f3e4c4';
  g.font = 'bold 40px Palatino, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(1.6, 0.3), new MeshBasicMaterial({ map: tex }));
  // Just in front of the frame (0.21 deep), so it never sinks into a thick lintel or gable.
  m.position.set(0, h + 0.25, 0.23);
  return m;
}

// ---------------------------------------------------------------- house points

/** Four giant hourglasses filled with gem-sweets in house colours. */
export class Hourglasses implements Entity, Interactable {
  private fills: Mesh[] = [];
  private shown = [0, 0, 0, 0];
  private readonly pos: Vector3;
  readonly radius = 3.5;

  constructor(
    spec: SpecOf<'hourglasses'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = spec.yaw;
    const glass = new MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const wood = worldMaterial();
    const cloth = worldMaterial({ roughness: 1 });
    HOUSE_ORDER.forEach((id, i) => {
      const x = (i - 1.5) * 1.6;
      const house = HOUSES[id];
      const base = new Mesh(paint(new CylinderGeometry(0.62, 0.7, 0.3, 10).toNonIndexed(), COLORS.woodDark, true, 'planks'), wood);
      base.position.set(x, 0.15, 0);
      const top = base.clone();
      top.position.y = 3.15;
      const tube = new Mesh(new CylinderGeometry(0.5, 0.5, 2.7, 14, 1, true), glass);
      tube.position.set(x, 1.65, 0);
      const fill = new Mesh(
        new CylinderGeometry(0.46, 0.46, 1, 12),
        new MeshStandardMaterial({ color: house.color, emissive: new Color(house.color), emissiveIntensity: 0.35, roughness: 0.4, flatShading: true }),
      );
      fill.position.set(x, 0.3, 0);
      fill.scale.y = 0.001;
      this.fills.push(fill);
      const banner = new Mesh(paint(new BoxGeometry(0.9, 1.3, 0.02).toNonIndexed(), house.color), cloth);
      banner.position.set(x, 4.2, -0.1);
      const stripe = new Mesh(paint(new BoxGeometry(0.9, 0.12, 0.03).toNonIndexed(), house.trim), cloth);
      stripe.position.set(x, 3.9, -0.09);
      [base, top, fill].forEach((m) => (m.castShadow = true));
      g.add(base, top, tube, fill, banner, stripe);
    });
    mergeChildren(g, this.fills);
    ctx.scene.add(g);
    ctx.physics.addStaticBox(this.pos.clone().add(new Vector3(0, 1.65, 0)), new Vector3(3.3, 1.65, 0.7), yawQ(spec.yaw));
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.5, 0));
  }
  prompt(): string {
    return 'Read the house points';
  }
  interact(): void {
    void this.ctx.talk('hourglasses');
  }

  frameUpdate(dt: number): void {
    const pts = HOUSE_ORDER.map((h) => this.ctx.state.housePoints[h]);
    const max = Math.max(150, ...pts.map((p) => p * 1.25));
    this.fills.forEach((f, i) => {
      this.shown[i] = MathUtils.damp(this.shown[i], pts[i] / max, 2, dt);
      const h = Math.max(0.001, this.shown[i] * 2.6);
      f.scale.y = h;
      f.position.y = 0.3 + h / 2;
    });
  }
}
