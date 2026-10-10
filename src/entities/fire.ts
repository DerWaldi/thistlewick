import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { FOOT_OFFSET } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import type { HeatSource } from '../world/heat';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

const UP = new Vector3(0, 1, 0);
const FLAME = new Color('#ff8a3c');
const DRY = new Color('#e8b878');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

function numeralSprite(text: string): Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2230';
  g.beginPath();
  g.roundRect(4, 4, 120, 88, 14);
  g.fill();
  g.strokeStyle = '#c99a3e';
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#ffd27a';
  g.font = 'bold 60px Palatino, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 52);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: tex, fog: true }));
  sprite.scale.set(0.53, 0.4, 1);
  return sprite;
}

/** Flat shading wants unshared vertices; some three.js shapes come that way already. */
const flat = (geo: BufferGeometry) => (geo.index ? geo.toNonIndexed() : geo);

const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(UP, yaw);

/** Flickering flame cones (shared by braziers and things on fire). */
function flames(n: number, r: number, h: number): { group: Group; mat: MeshStandardMaterial } {
  const mat = new MeshStandardMaterial({ color: '#ffb347', emissive: new Color('#ff7a1a'), emissiveIntensity: 2.2, transparent: true, opacity: 0.9, depthWrite: false });
  const group = new Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = new Mesh(new ConeGeometry(r * (0.5 + (i % 2) * 0.3), h * (0.7 + (i % 3) * 0.2), 5), mat);
    c.position.set(Math.cos(a) * r * 0.5, h * 0.35, Math.sin(a) * r * 0.5);
    group.add(c);
  }
  return { group, mat };
}

/**
 * Something Cindersnap burns away: a vine curtain, a thorny briar (which hurts to
 * brush against), a cobweb, a hay bale, or a rope (whose signal drops whatever it held).
 * `fireproofUntil` keeps it from catching until those signals are on.
 */
export class Burnable implements Entity, SpellTarget {
  readonly spell = 'cindersnap' as const;
  readonly marker: RuneMarker;
  readonly radius: number;
  private collider: RAPIER.Collider;
  private group = new Group();
  private body = new Group();
  private fire: { group: Group; mat: MeshStandardMaterial };
  private char: MeshStandardMaterial;
  private burning = -1;
  private done = false;
  private readonly center: Vector3;
  private readonly half: Vector3;
  private hurtCooldown = 0;
  private dryness = 0;

  constructor(
    private spec: SpecOf<'burnable'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.center = new Vector3(...spec.pos);
    this.half = new Vector3(w / 2, h / 2, d / 2);
    this.radius = Math.min(1.2, Math.max(0.5, Math.min(w, h) / 2));
    this.group.position.copy(this.center);
    this.group.rotation.y = spec.yaw ?? 0;
    this.char = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, roughness: 0.9, emissive: new Color('#000000') });
    this.build(w, h, d);
    this.group.add(this.body);
    this.fire = flames(Math.max(4, Math.round((w + d) * 2)), Math.max(w, d) * 0.45, Math.min(1.6, h * 0.8));
    this.fire.group.visible = false;
    this.fire.group.position.y = -h / 2;
    this.group.add(this.fire.group);
    ctx.scene.add(this.group);
    const desc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(this.center.x, this.center.y, this.center.z)
      .setRotation(yawQ(spec.yaw ?? 0));
    // A rope doesn't stop you walking past it; everything else blocks the way until it burns.
    if (spec.style === 'rope') desc.setSensor(true);
    this.collider = ctx.physics.world.createCollider(desc);
    ctx.physics.setInfo(this.collider, { noGrab: true, cameraIgnore: spec.style === 'rope' || spec.style === 'cobweb' });
    this.marker = new RuneMarker(ctx.scene, 'cindersnap', 0.6);
    this.marker.sprite.position.copy(this.center).add(new Vector3(0, Math.min(h / 2, 1.2) + 0.5, 0));
    ctx.targets.add(this);
  }

  private part(geo: BoxGeometry | CylinderGeometry | ConeGeometry | IcosahedronGeometry | TorusGeometry, color: string, x: number, y: number, z: number, rx = 0, rz = 0): void {
    const m = new Mesh(paint(flat(geo), color, true), this.char);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    this.body.add(m);
  }

  private build(w: number, h: number, d: number): void {
    const style = this.spec.style;
    let seed = Math.abs(Math.round(this.center.x * 13 + this.center.z * 7));
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    if (style === 'vines' || style === 'briar') {
      const briar = style === 'briar';
      const strands = Math.max(4, Math.round(w / 0.32));
      for (let i = 0; i < strands; i++) {
        const x = -w / 2 + (i + 0.5) * (w / strands);
        const sh = h * (0.85 + rnd() * 0.15);
        this.part(new CylinderGeometry(0.05, 0.08, sh, 5), briar ? '#5a3a2a' : '#4f7a34', x, -h / 2 + sh / 2, (rnd() - 0.5) * d * 0.6, 0, (rnd() - 0.5) * 0.15);
        for (let j = 0; j < Math.round(sh / 0.5); j++) {
          const y = -h / 2 + 0.3 + j * 0.5 + rnd() * 0.2;
          if (briar) this.part(new ConeGeometry(0.04, 0.18, 4), '#c8b8a0', x + (j % 2 ? 0.07 : -0.07), y, 0.05, 0, j % 2 ? -1.3 : 1.3);
          else this.part(new ConeGeometry(0.1, 0.24, 4), j % 3 ? '#79a84a' : '#a33a5a', x + (j % 2 ? 0.08 : -0.08), y, 0.06, 0, j % 2 ? -1 : 1);
        }
      }
      if (briar) for (let i = 0; i < 5; i++) this.part(new IcosahedronGeometry(0.22 + rnd() * 0.15, 0), '#4a3022', (rnd() - 0.5) * w * 0.9, (rnd() - 0.5) * h * 0.8, 0, rnd(), rnd());
    } else if (style === 'hay') {
      this.part(new BoxGeometry(w, h, d), '#d9b85a', 0, 0, 0);
      for (const y of [-h * 0.25, h * 0.25]) this.part(new BoxGeometry(w + 0.02, 0.05, d + 0.02), '#8a5a36', 0, y, 0);
    } else if (style === 'cobweb') {
      for (let i = 0; i < 6; i++) this.part(new BoxGeometry(w, 0.015, 0.015), '#e8e8f0', 0, 0, 0, 0, (i / 6) * Math.PI);
      for (let r = 1; r <= 3; r++) this.part(new TorusGeometry((r / 3) * Math.min(w, h) * 0.48, 0.008, 3, 12), '#e8e8f0', 0, 0, 0, 0, 0);
    } else {
      // A rope: a twisted cord with a knot.
      this.part(new CylinderGeometry(0.05, 0.05, h, 6), '#b89a68', 0, 0, 0);
      for (let y = -h / 2 + 0.2; y < h / 2; y += 0.3) this.part(new TorusGeometry(0.055, 0.015, 3, 8), '#8a6a3a', 0, y, 0, Math.PI / 2, 0);
      this.part(new IcosahedronGeometry(0.11, 0), '#8a6a3a', 0, -h / 2 + 0.15, 0);
    }
    mergeChildren(this.body);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.center);
  }
  enabled(): boolean {
    return !this.done && this.burning < 0 && (!this.spec.fireproofUntil || this.ctx.signals.all(this.spec.fireproofUntil));
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (!this.enabled()) return;
    this.burning = 0;
    this.fire.group.visible = true;
    this.ctx.events.emit('burn', { pos: this.center.clone() });
  }

  fixedUpdate(dt: number): void {
    this.hurtCooldown -= dt;
    if (this.spec.style === 'briar' && !this.done && this.burning < 0.6 && this.hurtCooldown <= 0) {
      // Thorns: brushing against a briar hurts.
      const p = this.ctx.player.pos;
      const local = p.clone().sub(this.center).applyQuaternion(yawQ(-(this.spec.yaw ?? 0)));
      if (Math.abs(local.x) < this.half.x + 0.45 && Math.abs(local.z) < this.half.z + 0.45 && Math.abs(local.y) < this.half.y + 0.9) {
        if (this.ctx.health.damage(1, this.center.clone())) this.hurtCooldown = 1;
      }
    }
    if (this.burning < 0 || this.done) return;
    this.burning += dt;
    if (Math.random() < dt * 12) {
      const s = this.center.clone().add(new Vector3((Math.random() - 0.5) * this.half.x * 2, (Math.random() - 0.3) * this.half.y * 2, (Math.random() - 0.5) * this.half.z * 2));
      this.ctx.fx.burst(s, 2, Math.random() < 0.5 ? FLAME : new Color('#5a4a40'), 1.6, 0.12, 0.8);
    }
    if (this.burning > 0.6 && this.collider.isEnabled()) this.collider.setEnabled(false);
    if (this.burning > 1.4) {
      this.done = true;
      this.group.visible = false;
      this.ctx.targets.remove(this);
      if (this.spec.id) this.ctx.signals.set(this.spec.id, true);
      if (this.spec.persist && this.spec.id) this.ctx.state.flags.add(`burnt:${this.spec.id}`);
    }
  }

  frameUpdate(dt: number): void {
    if (this.burning < 0) {
      if (this.spec.fireproofUntil) {
        // Green and damp until the braziers dry it out: then it turns straw-brown, and the rune shows.
        const dry = this.ctx.signals.all(this.spec.fireproofUntil);
        this.dryness = MathUtils.damp(this.dryness, dry ? 1 : 0, 2, dt);
        this.char.color.setRGB(1, 1, 1).lerp(DRY, this.dryness);
        if (!dry) this.marker.state = 'hidden';
      }
      return;
    }
    const t = this.burning;
    this.char.emissive.copy(FLAME).multiplyScalar(Math.min(1, t * 2) * 0.8);
    this.char.color.setScalar(MathUtils.lerp(1, 0.25, Math.min(1, t)));
    const s = Math.max(0.05, 1 - Math.max(0, t - 0.5) * 1.1);
    this.body.scale.set(1, s, 1);
    this.body.position.y = -this.half.y * (1 - s);
    this.fire.mat.opacity = 0.9 * Math.min(1, (1.4 - t) * 2);
    this.fire.group.scale.setScalar(0.8 + Math.sin(t * 30) * 0.15);
    void dt;
  }
}

/**
 * A brazier. Cindersnap lights it (for `duration` seconds, or for good), turning its
 * signal on. Braziers sharing a `group` must be lit in `order`: a wrong one puts the
 * whole group out.
 */
export class Brazier implements Entity, SpellTarget, HeatSource {
  private static groups = new WeakMap<WorldContext, Brazier[]>();
  readonly spell = 'cindersnap' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.6;
  private collider: RAPIER.Collider;
  private fire: { group: Group; mat: MeshStandardMaterial };
  private light: PointLight | null = null;
  private litFor = 0;
  /** Lit (litFor counts down to 0 just before it goes out, so it can't say on its own). */
  private burning = false;
  private lastTick = 0;
  private time = Math.random() * 10;
  private readonly top: Vector3;
  readonly pos: Vector3;

  constructor(
    private spec: SpecOf<'brazier'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    const group = new Group();
    group.position.set(x, y, z);
    const mat = worldMaterial();
    const iron = '#2a2230';
    const add = (geo: CylinderGeometry | BoxGeometry | TorusGeometry, color: string, py: number, rx = 0) => {
      const m = new Mesh(paint(flat(geo), color, true), mat);
      m.position.y = py;
      m.rotation.x = rx;
      m.castShadow = true;
      group.add(m);
    };
    add(new CylinderGeometry(0.34, 0.44, 0.12, 8), iron, 0.06);
    add(new CylinderGeometry(0.08, 0.11, 0.8, 6), iron, 0.5);
    // Three curled legs holding up a wide bowl, with a gilt rim and a bed of coals.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new Mesh(paint(flat(new BoxGeometry(0.07, 0.6, 0.07)), iron, true), mat);
      leg.position.set(Math.sin(a) * 0.3, 0.7, Math.cos(a) * 0.3);
      leg.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      group.add(leg);
    }
    add(new CylinderGeometry(0.55, 0.3, 0.36, 12), iron, 1.02);
    add(new TorusGeometry(0.55, 0.05, 4, 14), '#c99a3e', 1.2, Math.PI / 2);
    add(new CylinderGeometry(0.5, 0.5, 0.05, 12), '#4a2a1e', 1.17);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const coal = new Mesh(paint(flat(new IcosahedronGeometry(0.1, 0)), i % 2 ? '#3a2a24' : '#5a2a1a', true), mat);
      coal.position.set(Math.cos(a) * 0.25 * (i % 3) * 0.6, 1.22, Math.sin(a) * 0.25 * (i % 3) * 0.6);
      group.add(coal);
    }
    mergeChildren(group);
    ctx.scene.add(group);
    // Its place in the order, as a gilt numeral that faces you from anywhere.
    if (spec.order) {
      const plaque = numeralSprite(ROMAN[spec.order] ?? String(spec.order));
      plaque.position.set(x, y + 0.42, z);
      ctx.scene.add(plaque);
    }
    this.top = new Vector3(x, y + 1.2, z);
    this.pos = new Vector3(x, y, z);
    ctx.heat.add(this);
    this.fire = flames(7, 0.36, 0.8);
    this.fire.group.position.copy(this.top);
    this.fire.group.visible = false;
    ctx.scene.add(this.fire.group);
    if (spec.light) {
      this.light = new PointLight('#ff9a50', 0, 9, 1.5);
      this.light.position.copy(this.top).add(new Vector3(0, 0.6, 0));
      ctx.scene.add(this.light);
    }
    this.collider = ctx.physics.addStaticCylinder(new Vector3(x, y + 0.65, z), 0.6, 0.55);
    this.marker = new RuneMarker(ctx.scene, 'cindersnap', 0.55);
    this.marker.sprite.position.copy(this.top).add(new Vector3(0, 0.8, 0));
    ctx.targets.add(this);
    if (spec.group) {
      const list = Brazier.groups.get(ctx) ?? [];
      list.push(this);
      Brazier.groups.set(ctx, list);
    }
    if (spec.lit) this.ignite();
  }

  get lit(): boolean {
    return this.burning;
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.top);
  }
  enabled(): boolean {
    return !this.lit;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (this.spec.group) {
      const group = (Brazier.groups.get(this.ctx) ?? []).filter((b) => b.spec.group === this.spec.group);
      const litCount = group.filter((b) => b.lit).length;
      if ((this.spec.order ?? 1) !== litCount + 1) {
        // Out of turn: the whole lot gutters out.
        for (const b of group) b.snuff();
        // Hint triggers listen for this: a wrong guess is the moment to explain the notches.
        this.ctx.signals.set(`${this.spec.group}:fail`, true);
        this.ctx.fx.burst(this.top, 18, new Color('#6a5a50'), 2, 0.14, 1);
        this.ctx.events.emit('brazierFail', { pos: this.top.clone() });
        return;
      }
    }
    this.ignite();
  }

  private ignite(): void {
    const d = this.spec.duration ?? 0;
    this.litFor = d > 0 ? d : Infinity;
    this.lastTick = Math.ceil(this.litFor);
    this.burning = true;
    this.fire.group.visible = true;
    this.ctx.signals.set(this.spec.id, true);
    this.ctx.events.emit('burn', { pos: this.top.clone() });
  }

  snuff(): void {
    if (!this.burning) return;
    this.burning = false;
    this.litFor = 0;
    this.fire.group.visible = false;
    this.ctx.signals.set(this.spec.id, false);
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    if (!this.lit || !Number.isFinite(this.litFor)) return;
    this.litFor -= dt;
    const tick = Math.ceil(this.litFor);
    if (tick < this.lastTick) {
      this.lastTick = tick;
      if (tick > 0 && tick <= 3) this.ctx.events.emit('switchTick', { pos: this.top.clone() });
    }
    if (this.litFor <= 0) {
      // One going out puts the whole sequence out: start again from the first.
      if (this.spec.group) for (const b of Brazier.groups.get(this.ctx) ?? []) if (b.spec.group === this.spec.group) b.snuff();
      this.snuff();
    }
  }

  frameUpdate(): void {
    if (!this.lit) {
      if (this.light) this.light.intensity = 0;
      return;
    }
    const f = 1 + Math.sin(this.time * 17) * 0.08 + Math.sin(this.time * 5.3) * 0.06;
    this.fire.group.scale.set(f, f * (1 + Math.sin(this.time * 11) * 0.1), f);
    this.fire.group.rotation.y = this.time * 0.8;
    if (this.light) this.light.intensity = 6 * f;
  }
}

/**
 * Something hanging on a rope (a crate, a cage): when its signals are on, it drops to
 * `floorY` and stays there, solid, as a step.
 */
export class Dropper implements Entity {
  private collider: RAPIER.Collider;
  private group = new Group();
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private vy = 0;
  private falling = false;
  private landed = false;
  private chain: Mesh;

  constructor(
    private spec: SpecOf<'dropper'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.pos = new Vector3(...spec.pos);
    this.prev = this.pos.clone();
    const mat = worldMaterial();
    const box = new Mesh(paint(flat(new BoxGeometry(w, h, d)), COLORS.wood, true, 'planks'), mat);
    box.castShadow = true;
    const bands = new Mesh(paint(flat(new BoxGeometry(w + 0.04, 0.1, d + 0.04)), COLORS.woodDark, true), mat);
    bands.position.y = h / 2 - 0.15;
    const bands2 = bands.clone();
    bands2.position.y = -h / 2 + 0.15;
    this.group.add(box, bands, bands2);
    mergeChildren(this.group);
    this.chain = new Mesh(paint(flat(new CylinderGeometry(0.03, 0.03, 1, 4)), '#3a3340', true), mat);
    this.group.add(this.chain);
    this.chain.position.y = h / 2 + 0.5;
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(this.pos.x, this.pos.y, this.pos.z));
    const update = () => {
      if (!this.falling && !this.landed && ctx.signals.all(spec.when)) {
        this.falling = true;
        this.chain.visible = false;
      }
    };
    ctx.signals.onChange(spec.when, update);
    update();
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    if (!this.falling) return;
    this.vy -= 25 * dt;
    this.pos.y += this.vy * dt;
    const rest = this.spec.floorY + this.spec.size[1] / 2;
    if (this.pos.y <= rest) {
      this.pos.y = rest;
      this.falling = false;
      this.landed = true;
      // Landed on someone: they end up standing on top rather than inside it.
      const feet = this.ctx.player.pos.clone().setY(this.ctx.player.pos.y - FOOT_OFFSET);
      const [w, h, d] = this.spec.size;
      if (Math.abs(feet.x - this.pos.x) < w / 2 + 0.3 && Math.abs(feet.z - this.pos.z) < d / 2 + 0.3 && feet.y < this.pos.y + h / 2) {
        this.ctx.player.teleport(new Vector3(feet.x, this.pos.y + h / 2 + 0.05, feet.z));
      }
      this.ctx.events.emit('blockStop', { pos: this.pos.clone(), fell: true });
      this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, -this.spec.size[1] / 2, 0)), 16, new Color('#c8b8a0'), 2.5, 0.15, 0.8);
    }
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(_dt: number, alpha: number): void {
    this.group.position.lerpVectors(this.prev, this.pos, alpha);
  }
}
