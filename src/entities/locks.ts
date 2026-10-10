import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import { CardPickup } from './hubObjects';
import type { Entity, SpecOf, WorldContext } from './types';

const UP = new Vector3(0, 1, 0);
// Shared, so every lock in a level batches into the same few programs and materials.
const BRASS = new MeshStandardMaterial({ color: '#d4a94a', metalness: 0.75, roughness: 0.3, flatShading: true });
const IRON = new MeshStandardMaterial({ color: '#3a3340', metalness: 0.5, roughness: 0.6, flatShading: true });
const KEYHOLE = new MeshStandardMaterial({ color: '#1b120c' });
const brass = () => BRASS;
const iron = () => IRON;
const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(UP, yaw);

/** A chunky brass padlock, built facing +Z with its body centred on the origin. */
function padlockModel(scale = 1): { group: Group; shackle: Group } {
  const group = new Group();
  const b = brass();
  const body = new Mesh(new BoxGeometry(0.34, 0.3, 0.14), b);
  const rim = new Mesh(new CylinderGeometry(0.17, 0.17, 0.14, 12, 1, false, 0, Math.PI), b);
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  rim.position.y = -0.15;
  const hole = new Mesh(new CylinderGeometry(0.035, 0.035, 0.02, 8), KEYHOLE);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, -0.02, 0.071);
  const slot = new Mesh(new BoxGeometry(0.025, 0.07, 0.02), hole.material);
  slot.position.set(0, -0.07, 0.071);
  group.add(body, rim, hole, slot);
  const shackle = new Group();
  const arc = new Mesh(new TorusGeometry(0.11, 0.032, 6, 12, Math.PI), iron());
  arc.position.y = 0.17;
  for (const side of [-1, 1]) {
    const leg = new Mesh(new CylinderGeometry(0.032, 0.032, 0.14, 6), arc.material);
    leg.position.set(side * 0.11, 0.12, 0);
    shackle.add(leg);
  }
  shackle.add(arc);
  mergeChildren(shackle);
  group.add(shackle);
  mergeChildren(group, [shackle]);
  group.scale.setScalar(scale);
  for (const m of [body, rim, arc]) m.castShadow = true;
  return { group, shackle };
}

/**
 * A padlock: Latchkin pops it open and turns its signal on. It can relock after a
 * while (`relock`), remember being opened (`persist`, for the castle), or ride round
 * a wheel (`orbit`). Spells need a clear line of sight to it, so where it hangs is
 * the puzzle.
 */
export class Padlock implements Entity, SpellTarget {
  readonly spell = 'latchkin' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.45;
  private collider: RAPIER.Collider;
  private root = new Group();
  private lock: Group;
  private shackle: Group;
  private readonly out: Vector3;
  private readonly pos = new Vector3();
  private readonly prev = new Vector3();
  private time = 0;
  private open = false;
  private openAnim = 0;
  private relockTimer = 0;
  private lastTick = 0;
  private signalDelay = -1;
  private falling = -1;
  private gone = false;

  constructor(
    private spec: SpecOf<'padlock'>,
    private ctx: WorldContext,
  ) {
    this.out = new Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw));
    this.place(0);
    this.prev.copy(this.pos);
    const { group, shackle } = padlockModel(1.15);
    this.lock = group;
    this.shackle = shackle;
    // An iron staple fixing it to whatever it hangs on.
    const staple = new Mesh(new BoxGeometry(0.12, 0.08, 0.12), iron());
    staple.position.set(0, 0.3, -0.06);
    this.lock.add(staple);
    this.lock.position.z = 0.1;
    this.root.add(this.lock);
    this.root.rotation.y = spec.yaw;
    ctx.scene.add(this.root);
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.22, 0.24, 0.1)
        .setTranslation(this.pos.x, this.pos.y, this.pos.z)
        .setRotation(yawQ(spec.yaw)),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true, cameraIgnore: true });
    this.marker = new RuneMarker(ctx.scene, 'latchkin', 0.55);
    ctx.targets.add(this);
  }

  /** Where the lock's body sits at time t (orbiting locks ride round their wheel). */
  private place(t: number): void {
    const o = this.spec.orbit;
    if (!o) {
      this.pos.set(...this.spec.pos).addScaledVector(this.out, 0.1);
      return;
    }
    const right = new Vector3(Math.cos(this.spec.yaw), 0, -Math.sin(this.spec.yaw));
    const a = o.phase + o.speed * t;
    this.pos
      .set(...o.center)
      .addScaledVector(right, Math.cos(a) * o.radius)
      .addScaledVector(UP, Math.sin(a) * o.radius)
      .addScaledVector(this.out, 0.1);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos);
  }
  enabled(): boolean {
    return !this.open;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (this.open) return;
    this.open = true;
    this.ctx.events.emit('unlock', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos, 14, new Color('#ffe58a'), 1.6, 0.06, 0.8);
    // A beat after the click, so you see the lock open before the gate moves.
    this.signalDelay = 0.3;
    if (this.spec.persist) this.ctx.state.flags.add(`unlocked:${this.spec.id}`);
    if (this.spec.relock) {
      this.relockTimer = this.spec.relock;
      this.lastTick = Math.ceil(this.relockTimer);
    } else {
      this.falling = 0;
    }
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    this.time += dt;
    if (this.spec.orbit && !this.gone) {
      this.place(this.time);
      this.collider.setTranslation(this.pos);
    }
    if (this.signalDelay >= 0) {
      this.signalDelay -= dt;
      if (this.signalDelay < 0) this.ctx.signals.set(this.spec.id, true);
    }
    if (this.open && this.spec.relock) {
      this.relockTimer -= dt;
      const tick = Math.ceil(this.relockTimer);
      if (tick < this.lastTick) {
        this.lastTick = tick;
        if (tick > 0 && tick <= 3) this.ctx.events.emit('switchTick', { pos: this.pos.clone() });
      }
      if (this.relockTimer <= 0) {
        this.open = false;
        this.signalDelay = -1;
        this.ctx.signals.set(this.spec.id, false);
        this.ctx.events.emit('relock', { pos: this.pos.clone() });
      }
    }
    if (this.falling >= 0) {
      this.falling += dt;
      if (this.falling > 1.6) {
        this.root.visible = false;
        this.ctx.targets.remove(this);
        this.ctx.physics.world.removeCollider(this.collider, false);
        this.gone = true;
        this.falling = -1;
      }
    }
  }

  frameUpdate(dt: number, alpha: number): void {
    const p = new Vector3().lerpVectors(this.prev, this.pos, alpha);
    this.openAnim = MathUtils.damp(this.openAnim, this.open ? 1 : 0, this.open ? 14 : 20, dt);
    // The shackle springs up and swings aside; the body tips on its staple.
    this.shackle.position.y = this.openAnim * 0.09;
    this.shackle.rotation.y = this.openAnim * 1.1;
    this.lock.rotation.z = this.openAnim * 0.35;
    if (this.falling > 0.45) {
      const t = this.falling - 0.45;
      p.y -= 4.9 * t * t;
      this.lock.rotation.x = t * 5;
    }
    this.root.position.copy(p).addScaledVector(this.out, -0.1);
    this.marker.sprite.position.copy(p).addScaledVector(this.out, 0.25).add(new Vector3(0, 0.55, 0));
    // Ticking down: the lock shivers.
    if (this.open && this.spec.relock && this.relockTimer < 2) this.lock.rotation.z += Math.sin(this.time * 50) * 0.06;
  }
}

/**
 * A padlocked chest, practice box or cabinet. Latchkin opens it (once: it's
 * remembered by id) and out comes its card and/or sweets; `signal` turns on too.
 */
export class Chest implements Entity, SpellTarget {
  readonly spell = 'latchkin' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.6;
  private collider: RAPIER.Collider;
  private group = new Group();
  private lid = new Group();
  private doors: Group[] = [];
  private lock: Group | null = null;
  private opened = false;
  private anim = 0;
  private card: CardPickup | null = null;
  private readonly lockPos: Vector3;
  private readonly top: Vector3;

  constructor(
    private spec: SpecOf<'chest'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    const style = spec.style ?? 'chest';
    const out = new Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw));
    this.group.position.set(x, y, z);
    this.group.rotation.y = spec.yaw;
    const q = yawQ(spec.yaw);
    const mat = worldMaterial();
    const part = (geo: BoxGeometry | CylinderGeometry, color: string, px: number, py: number, pz: number, parent: Group = this.group) => {
      const m = new Mesh(paint(geo.toNonIndexed(), color, true, 'planks'), mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    let half: Vector3;
    let lockLocal: Vector3;
    if (style === 'cabinet') {
      // A tall cupboard: two doors that swing open, a shelf inside.
      half = new Vector3(0.65, 1.05, 0.32);
      part(new BoxGeometry(1.3, 2.1, 0.06), COLORS.woodDark, 0, 1.05, -0.29);
      for (const side of [-1, 1]) part(new BoxGeometry(0.06, 2.1, 0.6), COLORS.woodDark, side * 0.62, 1.05, 0);
      part(new BoxGeometry(1.3, 0.08, 0.64), COLORS.woodDark, 0, 2.12, 0);
      part(new BoxGeometry(1.4, 0.12, 0.7), COLORS.wood, 0, 2.2, 0);
      part(new BoxGeometry(1.3, 0.1, 0.6), COLORS.woodDark, 0, 0.05, 0);
      part(new BoxGeometry(1.2, 0.04, 0.54), COLORS.wood, 0, 1.0, -0.02);
      for (const side of [-1, 1]) {
        const hinge = new Group();
        hinge.position.set(side * 0.6, 0, 0.3);
        part(new BoxGeometry(0.58, 1.96, 0.05), COLORS.wood, -side * 0.29, 1.08, 0, hinge);
        part(new BoxGeometry(0.4, 1.5, 0.02), '#6e4528', -side * 0.29, 1.08, 0.03, hinge);
        part(new BoxGeometry(0.06, 0.16, 0.05), '#c99a3e', -side * 0.52, 1.1, 0.05, hinge);
        this.doors.push(hinge);
        this.group.add(hinge);
      }
      lockLocal = new Vector3(0, 1.1, 0.42);
      this.top = new Vector3(x, y + 1.45, z).addScaledVector(out, -0.02);
    } else {
      const s = style === 'box' ? 0.55 : 1;
      half = new Vector3(0.6 * s, 0.45 * s, 0.42 * s);
      part(new BoxGeometry(1.2 * s, 0.6 * s, 0.84 * s), '#7a4a26', 0, 0.3 * s, 0);
      const bands = new Mesh(paint(new BoxGeometry(1.24 * s, 0.1 * s, 0.88 * s).toNonIndexed(), '#3a3340', true), mat);
      bands.position.y = 0.48 * s;
      this.group.add(bands);
      for (const side of [-1, 1]) part(new BoxGeometry(0.08 * s, 0.62 * s, 0.88 * s), '#3a3340', side * 0.42 * s, 0.31 * s, 0);
      this.lid.position.set(0, 0.6 * s, -0.42 * s);
      // (No world-space plank pattern on parts that move: it would slide as they swing.)
      const lidMesh = new Mesh(paint(new CylinderGeometry(0.42 * s, 0.42 * s, 1.2 * s, 8, 1, false, 0, Math.PI).toNonIndexed(), '#8a5a36', true), mat);
      lidMesh.rotation.z = Math.PI / 2;
      lidMesh.position.z = 0.42 * s;
      lidMesh.castShadow = true;
      // The half-cylinder is open underneath; this board closes it so an opened lid
      // (seen from the front, i.e. from below) doesn't vanish.
      const lidBoard = new Mesh(paint(new BoxGeometry(1.18 * s, 0.04, 0.82 * s).toNonIndexed(), '#5e3b22', true), mat);
      lidBoard.position.set(0, 0.02, 0.42 * s);
      this.lid.add(lidMesh, lidBoard);
      this.group.add(this.lid);
      lockLocal = new Vector3(0, 0.5 * s, 0.48 * s);
      this.top = new Vector3(x, y + 1.2 * s, z);
    }
    this.lockPos = new Vector3(x, y, z).add(lockLocal.clone().applyQuaternion(q));
    mergeChildren(this.group, [this.lid, ...this.doors]);
    for (const d of this.doors) mergeChildren(d);
    ctx.scene.add(this.group);
    this.collider = ctx.physics.addStaticBox(new Vector3(x, y + half.y, z), half, q, { noGrab: style !== 'chest' });
    this.marker = new RuneMarker(ctx.scene, 'latchkin', style === 'box' ? 0.45 : 0.6);
    this.marker.sprite.position.copy(this.lockPos).add(new Vector3(0, style === 'cabinet' ? 1.4 : 0.7, 0));

    if (ctx.state.collected.has(spec.id)) {
      // Opened on an earlier visit: stays open, its signal stays on.
      this.opened = true;
      this.anim = 1;
      this.pose();
      if (spec.signal) ctx.signals.set(spec.signal, true);
      if (spec.card && !ctx.state.cards.has(spec.card)) this.card = new CardPickup({ type: 'card', card: spec.card, pos: this.top.toArray() as [number, number, number] }, ctx);
      return;
    }
    const { group } = padlockModel(style === 'box' ? 0.7 : 0.9);
    this.lock = group;
    this.lock.position.copy(lockLocal);
    this.group.add(this.lock);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.lockPos);
  }
  enabled(): boolean {
    return !this.opened;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (this.opened) return;
    this.opened = true;
    this.ctx.targets.remove(this);
    this.ctx.state.collected.add(this.spec.id);
    this.ctx.events.emit('unlock', { pos: this.lockPos.clone() });
    this.ctx.events.emit('chestOpen', { pos: this.lockPos.clone() });
    this.ctx.fx.burst(this.top, 26, new Color('#ffe58a'), 2.4, 0.08, 1.2);
    for (const [kind, n] of this.spec.sweets ?? []) this.ctx.sweets.burst(kind, this.top.clone(), n);
    if (this.spec.card && !this.ctx.state.cards.has(this.spec.card)) {
      this.card = new CardPickup({ type: 'card', card: this.spec.card, pos: this.top.toArray() as [number, number, number] }, this.ctx);
    }
    if (this.spec.signal) this.ctx.signals.set(this.spec.signal, true);
  }

  private pose(): void {
    const a = this.anim;
    this.lid.rotation.x = -1.9 * a;
    this.doors.forEach((d, i) => (d.rotation.y = (i === 0 ? 1 : -1) * -1.9 * a));
    if (this.lock) {
      this.lock.visible = a < 0.6;
      this.lock.rotation.z = a * 1.5;
    }
  }

  fixedUpdate(dt: number): void {
    this.card?.fixedUpdate();
    void dt;
  }

  frameUpdate(dt: number): void {
    this.card?.frameUpdate(dt);
    if (!this.opened || this.anim >= 1) return;
    this.anim = Math.min(1, this.anim + dt * 1.6);
    this.pose();
  }
}

/**
 * A drawbridge hinged on the far side of a gap. It stands upright until its
 * signals are all on, then swings down to make a walkway (and stays down).
 * `yaw` points from the hinge back across the gap, towards the player.
 */
export class Drawbridge implements Entity {
  private collider: RAPIER.Collider;
  private pivot = new Group();
  private angle = Math.PI / 2;
  private prevAngle = Math.PI / 2;
  private down = false;
  private readonly hinge: Vector3;
  private readonly q: Quaternion;
  private readonly right: Vector3;

  constructor(
    private spec: SpecOf<'drawbridge'>,
    ctx: WorldContext,
  ) {
    const { length: L, width: W } = spec;
    this.hinge = new Vector3(...spec.pos);
    this.q = yawQ(spec.yaw);
    this.right = new Vector3(1, 0, 0).applyQuaternion(this.q);
    const outer = new Group();
    outer.position.copy(this.hinge);
    outer.rotation.y = spec.yaw;
    outer.add(this.pivot);
    const mat = worldMaterial();
    const planks = new Group();
    const n = Math.round(L / 0.5);
    for (let i = 0; i < n; i++) {
      const p = new Mesh(paint(new BoxGeometry(W, 0.2, L / n - 0.03).toNonIndexed(), i % 2 ? COLORS.wood : '#7a4e2e', true), mat);
      p.position.set(0, -0.1, (i + 0.5) * (L / n));
      p.castShadow = true;
      planks.add(p);
    }
    for (const side of [-1, 1]) {
      const rail = new Mesh(paint(new BoxGeometry(0.12, 0.12, L).toNonIndexed(), '#3a3340', true), mat);
      rail.position.set(side * (W / 2 - 0.1), 0.02, L / 2);
      planks.add(rail);
    }
    mergeChildren(planks);
    this.pivot.add(planks);
    ctx.scene.add(outer);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(W / 2, 0.1, L / 2));
    ctx.physics.setInfo(this.collider, { noGrab: true });
    this.applyCollider();
    const update = () => {
      if (!this.down && ctx.signals.all(spec.when)) {
        this.down = true;
        ctx.events.emit('bridgeMove', { pos: this.hinge.clone() });
      }
    };
    ctx.signals.onChange(spec.when, update);
    update();
  }

  private applyCollider(): void {
    const L = this.spec.length;
    const rot = new Quaternion().setFromAxisAngle(this.right, -this.angle).multiply(this.q);
    const along = new Vector3(0, 0, 1).applyQuaternion(rot);
    const up = new Vector3(0, 1, 0).applyQuaternion(rot);
    const c = this.hinge.clone().addScaledVector(along, L / 2).addScaledVector(up, -0.1);
    this.collider.setTranslation(c);
    this.collider.setRotation(rot);
  }

  fixedUpdate(dt: number): void {
    this.prevAngle = this.angle;
    if (!this.down || this.angle <= 0) return;
    this.angle = Math.max(0, this.angle - dt * 1.1);
    this.applyCollider();
  }

  frameUpdate(_dt: number, alpha: number): void {
    this.pivot.rotation.x = -MathUtils.lerp(this.prevAngle, this.angle, alpha);
  }
}

/**
 * A great round vault door. When its signals are all on it unbolts and rolls
 * aside along its wall.
 */
export class VaultDoor implements Entity {
  private collider: RAPIER.Collider;
  private door = new Group();
  private wheel = new Group();
  private open = 0;
  private prevOpen = 0;
  private want = false;
  private readonly base: Vector3;
  private readonly right: Vector3;

  constructor(
    private spec: SpecOf<'vaultDoor'>,
    ctx: WorldContext,
  ) {
    const R = spec.radius;
    this.base = new Vector3(...spec.pos);
    const q = yawQ(spec.yaw);
    this.right = new Vector3(1, 0, 0).applyQuaternion(q);
    const holder = new Group();
    holder.position.copy(this.base);
    holder.rotation.y = spec.yaw;
    const steel = new MeshStandardMaterial({ color: '#8a8f99', metalness: 0.6, roughness: 0.45, flatShading: true });
    const dark = new MeshStandardMaterial({ color: '#4a4f59', metalness: 0.6, roughness: 0.5, flatShading: true });
    const slab = new Mesh(new CylinderGeometry(R, R, 0.5, 32), steel);
    slab.rotation.x = Math.PI / 2;
    slab.castShadow = true;
    const ring = new Mesh(new TorusGeometry(R * 0.82, 0.08, 6, 32), dark);
    ring.position.z = 0.26;
    const ring2 = new Mesh(new TorusGeometry(R * 0.45, 0.06, 6, 24), dark);
    ring2.position.z = 0.26;
    this.door.add(slab, ring, ring2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bolt = new Mesh(new SphereGeometry(0.09, 6, 4), dark);
      bolt.position.set(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 0.25);
      this.door.add(bolt);
    }
    // The handle wheel spins as the door unbolts.
    const b = brass();
    this.wheel.add(new Mesh(new TorusGeometry(0.45, 0.05, 6, 20), b));
    for (let i = 0; i < 3; i++) {
      const spoke = new Mesh(new BoxGeometry(0.9, 0.06, 0.06), b);
      spoke.rotation.z = (i / 3) * Math.PI;
      this.wheel.add(spoke);
    }
    const hub = new Mesh(new CylinderGeometry(0.12, 0.12, 0.15, 10), b);
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(hub);
    this.wheel.position.z = 0.35;
    mergeChildren(this.wheel);
    mergeChildren(this.door);
    this.door.add(this.wheel);
    holder.add(this.door);
    ctx.scene.add(holder);
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(R, R, 0.25).setTranslation(this.base.x, this.base.y, this.base.z).setRotation(q),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true });
    const update = () => {
      if (!this.want && ctx.signals.all(spec.when)) {
        this.want = true;
        ctx.events.emit('vaultOpen', { pos: this.base.clone() });
      }
    };
    ctx.signals.onChange(spec.when, update);
    update();
  }

  fixedUpdate(dt: number): void {
    this.prevOpen = this.open;
    if (!this.want || this.open >= 1) return;
    this.open = Math.min(1, this.open + dt * 0.4);
    this.collider.setTranslation(this.base.clone().addScaledVector(this.right, -this.slide(this.open)));
  }

  /** First the wheel spins and the door backs out, then it rolls aside. */
  private slide(o: number): number {
    return MathUtils.smoothstep(o, 0.35, 1) * (this.spec.radius * 2 + 0.3);
  }

  frameUpdate(_dt: number, alpha: number): void {
    const o = MathUtils.lerp(this.prevOpen, this.open, alpha);
    const s = this.slide(o);
    this.door.position.x = -s;
    this.door.position.z = MathUtils.smoothstep(o, 0, 0.3) * 0.15;
    this.door.rotation.z = s / this.spec.radius;
    this.wheel.rotation.z = MathUtils.smoothstep(o, 0, 0.35) * Math.PI * 3;
  }
}
