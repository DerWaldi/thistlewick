import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import type { Entity, SpecOf, WorldContext } from './types';
import { mergeChildren } from '../world/merge';

const brass = () => new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.7, roughness: 0.35, flatShading: true });
const iron = () => new MeshStandardMaterial({ color: '#3a3340', metalness: 0.5, roughness: 0.6, flatShading: true });

/**
 * A brass knocker plate on a wall. Thwackwort flips it; a timed one springs
 * back after a few seconds, ticking as it goes.
 */
export class KnockSwitch implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.6;
  revealRange?: number;
  private collider: RAPIER.Collider;
  private disc: Group;
  private glow: MeshStandardMaterial;
  private on = false;
  private timer = 0;
  private lastTick = 0;
  private spin = 0;
  private wobble = 0;
  private readonly center: Vector3;

  constructor(
    private spec: SpecOf<'knockSwitch'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    const out = new Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw));
    this.center = new Vector3(x, y, z).addScaledVector(out, 0.12);
    const group = new Group();
    group.position.set(x, y, z);
    group.rotation.y = spec.yaw;

    this.disc = new Group();
    if (spec.style === 'target' || spec.style === 'bell') {
      // Free-standing: a painted bullseye (practice target) or a brass bell, on a post.
      const stand = new Group();
      const postH = y;
      const post = new Mesh(paint(new CylinderGeometry(0.06, 0.08, postH, 6).toNonIndexed(), COLORS.wood, true), worldMaterial());
      post.position.y = -postH / 2;
      const foot = new Mesh(paint(new CylinderGeometry(0.35, 0.4, 0.1, 8).toNonIndexed(), COLORS.woodDark, true), worldMaterial());
      foot.position.y = -postH + 0.05;
      stand.add(post, foot);
      mergeChildren(stand);
      group.add(stand);
      if (spec.style === 'target') {
        this.glow = new MeshStandardMaterial({ color: '#f3e4c4', roughness: 0.7, flatShading: true });
        const rings = ['#b0362f', '#f3e4c4', '#b0362f', '#f2c14e'];
        rings.forEach((c, i) => {
          const r = 0.42 - i * 0.1;
          const m = new Mesh(new CylinderGeometry(r, r, 0.04, 20), i === 3 ? this.glow : new MeshStandardMaterial({ color: c, roughness: 0.8 }));
          m.rotation.x = Math.PI / 2;
          m.position.z = 0.02 + i * 0.012;
          this.disc.add(m);
        });
      } else {
        this.glow = brass();
        const bell = new Mesh(new CylinderGeometry(0.12, 0.3, 0.45, 10, 1, true), this.glow);
        bell.position.y = -0.2;
        const cap = new Mesh(new SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.glow);
        const yoke = new Mesh(new BoxGeometry(0.7, 0.08, 0.08), iron());
        yoke.position.y = 0.16;
        this.disc.add(bell, cap, yoke);
      }
      group.add(this.disc);
      ctx.scene.add(group);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spec.yaw);
      this.collider = ctx.physics.addStaticBox(new Vector3(x, y, z), new Vector3(0.4, 0.4, 0.15), q);
      ctx.physics.addStaticCylinder(new Vector3(x, y / 2, z), y / 2, 0.12);
      this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
      this.marker.sprite.position.set(x, y + 0.75, z);
      ctx.targets.add(this);
      return;
    }
    if (spec.style === 'book') {
      // A single fat book sticking out of a shelf, with a faint rune on its spine.
      this.revealRange = 6;
      this.glow = new MeshStandardMaterial({ color: '#7a2f3a', roughness: 0.8, flatShading: true });
      const book = new Mesh(new BoxGeometry(0.14, 0.36, 0.34), this.glow);
      book.position.z = 0.17;
      const band = new Mesh(new BoxGeometry(0.15, 0.04, 0.35), brass());
      band.position.set(0, 0.1, 0.17);
      this.disc.add(book, band);
      group.add(this.disc);
      ctx.scene.add(group);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spec.yaw);
      this.collider = ctx.physics.addStaticBox(this.center, new Vector3(0.1, 0.2, 0.2), q);
      this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.45);
      this.marker.sprite.position.copy(this.center).addScaledVector(out, 0.4).add(new Vector3(0, 0.45, 0));
      ctx.targets.add(this);
      return;
    }
    const back = new Mesh(paint(new BoxGeometry(1.1, 1.1, 0.12).toNonIndexed(), COLORS.wood, true), worldMaterial());
    back.position.z = 0.06;
    back.castShadow = true;
    group.add(back);

    this.disc.position.z = 0.16;
    this.glow = brass();
    const ring = new Mesh(new TorusGeometry(0.36, 0.07, 6, 16), this.glow);
    const plate = new Mesh(new CylinderGeometry(0.3, 0.3, 0.06, 16), this.glow);
    plate.rotation.x = Math.PI / 2;
    const bar = new Mesh(new BoxGeometry(0.62, 0.1, 0.1), iron());
    bar.position.z = 0.05;
    this.disc.add(ring, plate, bar);
    mergeChildren(this.disc);
    group.add(this.disc);
    if (spec.timed) {
      // A little hourglass badge marks timed switches.
      const hg = new Mesh(new CylinderGeometry(0.08, 0.0, 0.12, 6), brass());
      hg.position.set(0, 0.68, 0.12);
      const hg2 = hg.clone();
      hg2.rotation.z = Math.PI;
      hg2.position.y = 0.8;
      group.add(hg, hg2);
    }
    ctx.scene.add(group);

    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spec.yaw);
    this.collider = ctx.physics.addStaticBox(this.center, new Vector3(0.5, 0.5, 0.12), q);

    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.6);
    this.marker.sprite.position.copy(this.center).addScaledVector(out, 0.5).add(new Vector3(0, 0.75, 0));
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.center);
  }
  enabled(): boolean {
    // A latched target that's been hit is done.
    return !(this.spec.latch && this.on);
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    this.wobble = 1;
    if (this.spec.latch) {
      this.set(true);
      return;
    }
    if (this.spec.timed) {
      this.set(true);
      this.timer = this.spec.timed;
      this.lastTick = Math.ceil(this.timer);
    } else {
      this.set(!this.on);
    }
  }

  private set(on: boolean): void {
    this.on = on;
    this.ctx.signals.set(this.spec.id, on);
  }

  fixedUpdate(dt: number): void {
    if (this.spec.timed && this.on) {
      this.timer -= dt;
      const tick = Math.ceil(this.timer);
      if (tick < this.lastTick) {
        this.lastTick = tick;
        this.ctx.events.emit('switchTick', { pos: this.center.clone() });
      }
      if (this.timer <= 0) this.set(false);
    }
  }

  frameUpdate(dt: number): void {
    this.spin = MathUtils.damp(this.spin, this.on ? Math.PI / 2 : 0, 10, dt);
    if (this.spec.style === 'book') {
      // The book tips forward like a lever.
      this.disc.rotation.x = this.spin * 0.5;
      return;
    }
    if (this.spec.style === 'target' || this.spec.style === 'bell') {
      // Targets spin round once and light their centre; bells swing.
      this.wobble = Math.max(0, this.wobble - dt * 1.2);
      if (this.spec.style === 'target') {
        this.disc.rotation.y = (1 - this.wobble) * Math.PI * 2 * (this.wobble > 0 ? 1 : 0);
        this.glow.emissive = new Color(this.on ? '#ffd27a' : '#000000');
        this.glow.emissiveIntensity = this.on ? 1.2 : 0;
      } else {
        this.disc.rotation.z = Math.sin(this.wobble * 18) * this.wobble * 0.6;
      }
      return;
    }
    this.disc.rotation.z = this.spin;
    this.glow.emissive = new Color(this.on ? '#ffb347' : '#000000');
    this.glow.emissiveIntensity = this.on ? 0.6 + (this.spec.timed ? Math.sin(this.timer * 10) * 0.3 : 0) : 0;
  }
}

/** A flagstone that's held down by the player or a push block standing on it. */
export class Plate implements Entity {
  private mesh: Mesh;
  private pressed = false;
  private depth = 0;
  private readonly top: Vector3;

  constructor(
    private spec: SpecOf<'plate'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    this.top = new Vector3(x, y + 0.1, z);
    this.mesh = new Mesh(paint(new BoxGeometry(1.7, 0.12, 1.7).toNonIndexed(), '#c9b07a', true), worldMaterial());
    this.mesh.position.set(x, y + 0.06, z);
    this.mesh.receiveShadow = true;
    const rim = new Mesh(paint(new BoxGeometry(1.95, 0.04, 1.95).toNonIndexed(), COLORS.stoneDark, true), worldMaterial());
    rim.position.set(x, y + 0.02, z);
    ctx.scene.add(this.mesh, rim);
  }

  fixedUpdate(): void {
    // Anything solid (the player's capsule, a block) in the slab of air just above the plate.
    const hit = this.ctx.physics.world.intersectionWithShape(
      { x: this.top.x, y: this.top.y + 0.25, z: this.top.z },
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Cuboid(0.7, 0.2, 0.7),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    const pressed = hit !== null;
    if (pressed !== this.pressed) {
      this.pressed = pressed;
      this.ctx.signals.set(this.spec.id, pressed);
    }
  }

  frameUpdate(dt: number): void {
    this.depth = MathUtils.damp(this.depth, this.pressed ? -0.07 : 0, 14, dt);
    this.mesh.position.y = this.spec.pos[1] + 0.06 + this.depth;
  }
}

/**
 * A portcullis in a stone frame. Opens while all the signals in `when` are on.
 * It won't drop onto the player.
 */
export class Gate implements Entity {
  private bars: Group;
  private collider: RAPIER.Collider;
  private open = 0; // 0 closed .. 1 open
  private wantOpen = false;
  private readonly base: Vector3;
  private readonly q: Quaternion;
  private prevOpen = 0;

  constructor(
    private spec: SpecOf<'gate'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    const { width: w, height: h, yaw } = spec;
    this.base = new Vector3(x, y, z);
    this.q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    const frame = new Group();
    frame.position.copy(this.base);
    frame.rotation.y = yaw;
    const stone = worldMaterial();
    const post = (side: number) => {
      const m = new Mesh(paint(new BoxGeometry(0.6, h + 0.6, 0.8).toNonIndexed(), COLORS.stoneDark, true), stone);
      m.position.set(side * (w / 2 + 0.3), (h + 0.6) / 2, 0);
      m.castShadow = true;
      return m;
    };
    const lintel = new Mesh(paint(new BoxGeometry(w + 1.2, 0.6, 0.8).toNonIndexed(), COLORS.stoneDark, true), stone);
    lintel.position.y = h + 0.3;
    frame.add(post(-1), post(1), lintel);
    ctx.scene.add(frame);
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const side of [-1, 1]) {
      ctx.physics.addStaticBox(
        this.base.clone().addScaledVector(right, side * (w / 2 + 0.3)).add(new Vector3(0, (h + 0.6) / 2, 0)),
        new Vector3(0.3, (h + 0.6) / 2, 0.4),
        this.q,
      );
    }
    ctx.physics.addStaticBox(this.base.clone().add(new Vector3(0, h + 0.3, 0)), new Vector3(w / 2 + 0.6, 0.3, 0.4), this.q);

    // The bars.
    this.bars = new Group();
    const ironMat = iron();
    const n = Math.max(3, Math.round(w / 0.4));
    for (let i = 0; i < n; i++) {
      const bar = new Mesh(new CylinderGeometry(0.05, 0.05, h, 6), ironMat);
      bar.position.set(-w / 2 + (i + 0.5) * (w / n), h / 2, 0);
      bar.castShadow = true;
      this.bars.add(bar);
    }
    for (const yy of [0.25, h * 0.5, h - 0.2]) {
      const cross = new Mesh(new BoxGeometry(w, 0.08, 0.08), ironMat);
      cross.position.y = yy;
      this.bars.add(cross);
    }
    for (let i = 0; i < n; i++) {
      const spike = new Mesh(new CylinderGeometry(0, 0.07, 0.18, 5), ironMat);
      spike.rotation.x = Math.PI;
      spike.position.set(-w / 2 + (i + 0.5) * (w / n), -0.05, 0);
      this.bars.add(spike);
    }
    frame.add(this.bars);
    mergeChildren(this.bars);
    mergeChildren(frame);
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, 0.12)
        .setTranslation(x, y + h / 2, z)
        .setRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w }),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true });

    const update = () => (this.wantOpen = ctx.signals.all(spec.when));
    ctx.signals.onChange(spec.when, update);
    update();
  }

  fixedUpdate(dt: number): void {
    this.prevOpen = this.open;
    const h = this.spec.height;
    const target = this.wantOpen ? 1 : 0;
    if (target === this.open) return;
    // Don't close on the player.
    if (target < this.open && this.blockedBelow()) return;
    const speed = target > this.open ? 1.6 : 2.2;
    const wasMoving = this.open !== 0 && this.open !== 1;
    this.open = target > this.open ? Math.min(1, this.open + speed * dt) : Math.max(0, this.open - speed * dt);
    if (!wasMoving) this.ctx.events.emit('gateMove', { pos: this.base.clone(), opening: target > 0 });
    this.collider.setTranslation({ x: this.base.x, y: this.base.y + h / 2 + this.open * (h - 0.15), z: this.base.z });
  }

  private blockedBelow(): boolean {
    const h = this.spec.height;
    const hit = this.ctx.physics.world.intersectionWithShape(
      { x: this.base.x, y: this.base.y + h / 2, z: this.base.z },
      this.q,
      new RAPIER.Cuboid(this.spec.width / 2, h / 2, 0.3),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.collider,
    );
    return hit !== null && hit.handle === this.ctx.player.collider.handle;
  }

  frameUpdate(_dt: number, alpha: number): void {
    const o = MathUtils.lerp(this.prevOpen, this.open, alpha);
    this.bars.position.y = o * (this.spec.height - 0.15);
  }

  get isOpen(): boolean {
    return this.open > 0.95;
  }
}

/**
 * A reading lectern with a candle. Touch it to make it your respawn point; it
 * also restores your stamina.
 */
export class Checkpoint implements Entity {
  private flame: Mesh;
  private light = new PointLight('#ffb35c', 1, 6, 1.6);
  private lit = false;
  private flicker = Math.random() * 10;
  private readonly pos: Vector3;
  private readonly respawn: Vector3;

  constructor(
    private spec: SpecOf<'checkpoint'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    this.pos = new Vector3(x, y, z);
    const fwd = new Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw));
    this.respawn = this.pos.clone().addScaledVector(fwd, 1.3);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = spec.yaw;
    const wood = worldMaterial();
    const stand = new Mesh(paint(new CylinderGeometry(0.12, 0.16, 1.0, 6).toNonIndexed(), COLORS.wood, true), wood);
    stand.position.y = 0.5;
    const foot = new Mesh(paint(new CylinderGeometry(0.4, 0.45, 0.12, 8).toNonIndexed(), COLORS.wood, true), wood);
    foot.position.y = 0.06;
    const desk = new Mesh(paint(new BoxGeometry(0.8, 0.08, 0.55).toNonIndexed(), COLORS.wood, true), wood);
    desk.position.set(0, 1.05, 0.05);
    desk.rotation.x = 0.35;
    const book = new Mesh(paint(new BoxGeometry(0.62, 0.08, 0.42).toNonIndexed(), '#7a2f3a', true), wood);
    book.position.set(0, 1.11, 0.06);
    book.rotation.x = 0.35;
    const pages = new Mesh(paint(new BoxGeometry(0.56, 0.03, 0.38).toNonIndexed(), '#f3e4c4', true), wood);
    pages.position.set(0, 1.16, 0.04);
    pages.rotation.x = 0.35;
    const candle = new Mesh(paint(new CylinderGeometry(0.04, 0.045, 0.22, 6).toNonIndexed(), '#efe6d2', true), wood);
    candle.position.set(0.32, 1.2, -0.12);
    this.flame = new Mesh(
      new CylinderGeometry(0, 0.035, 0.12, 5),
      new MeshStandardMaterial({ color: '#ffd27a', emissive: new Color('#ff9a3c'), emissiveIntensity: 2 }),
    );
    this.flame.position.set(0.32, 1.37, -0.12);
    [stand, foot, desk, book, pages, candle].forEach((m) => (m.castShadow = true));
    g.add(stand, foot, desk, book, pages, candle, this.flame);
    mergeChildren(g, [this.flame]);
    ctx.scene.add(g);
    this.light.position.set(0.32, 1.5, -0.12);
    g.add(this.light);
    ctx.physics.addStaticCylinder(this.pos.clone().add(new Vector3(0, 0.6, 0)), 0.6, 0.35);
  }

  fixedUpdate(): void {
    const p = this.ctx.player.feet;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const near = dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(p.y - this.pos.y) < 1.5;
    if (!near) return;
    if (!this.isCurrent()) {
      this.ctx.state.setCheckpoint(this.ctx.levelId, this.respawn, this.spec.yaw);
      this.ctx.events.emit('toast', { text: 'Checkpoint', kind: 'info' });
      this.ctx.fx.burst(this.flame.getWorldPosition(new Vector3()), 14, new Color('#ffd27a'), 1.5, 0.08, 1.5);
    }
    if (this.ctx.state.stamina < this.ctx.state.maxStamina) this.ctx.health.heal(true);
    this.lit = true;
  }

  private isCurrent(): boolean {
    const cp = this.ctx.state.checkpoint;
    return !!cp && cp.level === this.ctx.levelId && cp.pos.distanceToSquared(this.respawn) < 0.01;
  }

  frameUpdate(dt: number): void {
    this.flicker += dt;
    const isCurrent = this.isCurrent();
    const base = isCurrent ? 2.2 : this.lit ? 0.8 : 0.35;
    this.light.intensity = base * (0.85 + Math.sin(this.flicker * 11) * 0.08 + Math.sin(this.flicker * 17.3) * 0.07);
    const s = isCurrent ? 1.6 : 1;
    this.flame.scale.set(s, s * (1 + Math.sin(this.flicker * 13) * 0.12), s);
  }
}
