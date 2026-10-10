import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Vector3,
} from 'three';
import type { ColliderInfo } from '../engine/physics';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';

const UP = new Vector3(0, 1, 0);
const FROST = new Color('#e8f8ff');
const THAW_WARN = 2;
const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(UP, yaw);

function iceMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#cfeefa', roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.86, flatShading: true, emissive: new Color('#2a5a6a'), emissiveIntensity: 0.25 });
}

/**
 * A patch of water that Rimewhistle freezes into a slab of slippery ice for `duration`
 * seconds (a charged cast: `chargedDuration`, by default twice as long; 0 = for the visit). It creaks for
 * the last two seconds, then melts. A frosty shimmer on the water shows where it can form.
 */
export class IceSheet implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius: number;
  private collider: RAPIER.Collider;
  private ice: Mesh;
  private shimmer: Mesh;
  private frozenFor = 0;
  private frozen = false;
  private grow = 0;
  private lastTick = 0;
  private time = Math.random() * 10;
  private readonly center: Vector3;
  private readonly w: number;
  private readonly d: number;

  constructor(
    private spec: SpecOf<'iceSheet'>,
    private ctx: WorldContext,
  ) {
    const [x0, z0] = spec.min;
    const [x1, z1] = spec.max;
    this.w = x1 - x0;
    this.d = z1 - z0;
    this.center = new Vector3((x0 + x1) / 2, spec.y, (z0 + z1) / 2);
    this.radius = Math.min(1.6, Math.max(0.8, Math.min(this.w, this.d) / 2));
    // The slab: its top sits a little proud of the water.
    const geo = new BoxGeometry(this.w, 0.36, this.d, Math.max(1, Math.round(this.w)), 1, Math.max(1, Math.round(this.d)));
    const pos = geo.getAttribute('position');
    // Lumpy edges, so it reads as frozen water rather than a glass tile.
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const n = Math.sin(px * 5.1 + pz * 3.7) * 0.06;
      if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + n * 0.5);
    }
    this.ice = new Mesh(geo.toNonIndexed(), iceMaterial());
    this.ice.position.copy(this.center).add(new Vector3(0, -0.08, 0));
    this.ice.receiveShadow = true;
    this.ice.visible = false;
    ctx.scene.add(this.ice);
    this.shimmer = new Mesh(
      new PlaneGeometry(this.w * 0.9, this.d * 0.9),
      new MeshStandardMaterial({ color: FROST, transparent: true, opacity: 0.18, depthWrite: false, side: DoubleSide, emissive: new Color('#9fe6ff'), emissiveIntensity: 0.4 }),
    );
    this.shimmer.rotation.x = -Math.PI / 2;
    this.shimmer.position.copy(this.center).add(new Vector3(0, 0.03, 0));
    ctx.scene.add(this.shimmer);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(this.w / 2, 0.18, this.d / 2).setTranslation(this.center.x, this.center.y - 0.08, this.center.z));
    // Spells fly through it, to reach the next patch beyond.
    const info: ColliderInfo = { surface: 'ice', temporary: true, noGrab: true, seeThrough: true };
    ctx.physics.setInfo(this.collider, info);
    this.collider.setEnabled(false);
    this.marker = new RuneMarker(ctx.scene, 'rimewhistle', 0.6);
    this.marker.sprite.position.copy(this.center).add(new Vector3(0, 0.9, 0));
    ctx.targets.add(this);
    if (spec.frozen) this.freeze(0, true);
  }

  readonly spell = 'rimewhistle' as const;

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.center).add(new Vector3(0, 0.15, 0));
  }
  enabled(): boolean {
    // Frozen ice isn't a target, so freezing the next patch never hits the one underfoot.
    return !this.frozen;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (!this.frozen) this.freeze(hit.charge, false);
  }

  private freeze(charge: number, quiet: boolean): void {
    const d = this.spec.duration ?? 6;
    this.frozenFor = d > 0 ? (charge > 0.5 ? (this.spec.chargedDuration ?? d * 2) : d) : Infinity;
    this.lastTick = Math.ceil(this.frozenFor);
    this.frozen = true;
    this.grow = quiet ? 1 : 0;
    this.ice.visible = true;
    this.collider.setEnabled(true);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, true);
    if (!quiet) {
      this.ctx.events.emit('freeze', { pos: this.center.clone(), charged: charge > 0.5 });
      this.ctx.fx.burst(this.center.clone().add(new Vector3(0, 0.3, 0)), 14, FROST, 2.4, 0.14, 1);
    }
  }

  private melt(): void {
    this.frozen = false;
    this.frozenFor = 0;
    this.ice.visible = false;
    this.collider.setEnabled(false);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, false);
    this.ctx.events.emit('thaw', { pos: this.center.clone() });
    this.ctx.fx.burst(this.center.clone().add(new Vector3(0, 0.2, 0)), 18, new Color('#f4fbff'), 2, 0.16, 1.6);
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    if (!this.frozen || !Number.isFinite(this.frozenFor)) return;
    this.frozenFor -= dt;
    const tick = Math.ceil(this.frozenFor);
    if (tick < this.lastTick) {
      this.lastTick = tick;
      if (tick > 0 && tick <= THAW_WARN) this.ctx.events.emit('iceCreak', { pos: this.center.clone() });
    }
    if (this.frozenFor <= 0) this.melt();
  }

  frameUpdate(dt: number): void {
    this.shimmer.visible = !this.frozen;
    (this.shimmer.material as MeshStandardMaterial).opacity = 0.12 + Math.sin(this.time * 2.2) * 0.06;
    if (!this.frozen) return;
    this.grow = Math.min(1, this.grow + dt * 5);
    const warn = Number.isFinite(this.frozenFor) && this.frozenFor < THAW_WARN;
    const mat = this.ice.material as MeshStandardMaterial;
    // Creaking: the ice goes dark and wet-looking, and flickers, before it lets go.
    mat.opacity = warn ? 0.55 + Math.abs(Math.sin(this.time * 14)) * 0.25 : 0.86;
    mat.color.set(warn ? '#9fcfe0' : '#cfeefa');
    this.ice.scale.set(this.grow, 1, this.grow);
  }
}

/** Streaky falling water, scrolled down the face. */
let waterTex: CanvasTexture | null = null;
function fallingWaterTexture(): CanvasTexture {
  if (waterTex) return waterTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5fb0d4';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = i % 3 ? 'rgba(220,245,255,0.55)' : 'rgba(255,255,255,0.8)';
    const x = (i * 37) % 64;
    const y = (i * 53) % 128;
    g.fillRect(x, y, 2 + (i % 3), 18 + (i % 5) * 6);
  }
  waterTex = new CanvasTexture(c);
  waterTex.wrapS = waterTex.wrapT = RepeatWrapping;
  return waterTex;
}

/**
 * A waterfall pouring down a cliff face. Rimewhistle freezes it: the falling water turns
 * to ice and a solid pillar forms at its foot, `pillar` metres tall, which you can climb
 * onto (and grab the cliff top from). It thaws after `duration` s (0 = stays frozen).
 */
export class Waterfall implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 1;
  private collider: RAPIER.Collider;
  private sheet: Mesh;
  private sheetMat: MeshStandardMaterial;
  private frozenGroup = new Group();
  private frozen = false;
  private frozenFor = 0;
  private lastTick = 0;
  private time = Math.random() * 10;
  private readonly base: Vector3;
  private readonly pillarCenter: Vector3;

  constructor(
    private spec: SpecOf<'waterfall'>,
    private ctx: WorldContext,
  ) {
    const { width: W, height: H, pillar: P } = spec;
    const D = spec.depth ?? 1;
    this.base = new Vector3(...spec.pos);
    const q = yawQ(spec.yaw);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(q);
    // The falling sheet hugs the cliff face (pos is its foot, on the face).
    this.sheetMat = new MeshStandardMaterial({ map: fallingWaterTexture().clone(), transparent: true, opacity: 0.8, roughness: 0.2, side: DoubleSide, depthWrite: false });
    this.sheetMat.map!.repeat.set(W / 2, H / 3);
    this.sheetMat.map!.needsUpdate = true;
    this.sheet = new Mesh(new PlaneGeometry(W, H), this.sheetMat);
    this.sheet.position.copy(this.base).addScaledVector(fwd, 0.12).add(new Vector3(0, H / 2, 0));
    this.sheet.quaternion.copy(q);
    ctx.scene.add(this.sheet);
    // Frozen: an icy coat up the face and a pillar at the foot.
    const mat = iceMaterial();
    const coat = new Mesh(new BoxGeometry(W, H, 0.3), mat);
    coat.position.set(0, H / 2, 0.15);
    const pillar = new Mesh(new BoxGeometry(W, P, D).toNonIndexed(), mat);
    pillar.position.set(0, P / 2, D / 2);
    this.frozenGroup.add(coat, pillar);
    for (let i = 0; i < Math.round(W * 3); i++) {
      const ic = new Mesh(new ConeGeometry(0.07, 0.4 + (i % 3) * 0.2, 4), mat);
      ic.rotation.x = Math.PI;
      ic.position.set(-W / 2 + (i + 0.5) / 3, P - 0.25, D + 0.02);
      this.frozenGroup.add(ic);
    }
    this.frozenGroup.position.copy(this.base);
    this.frozenGroup.quaternion.copy(q);
    this.frozenGroup.visible = false;
    ctx.scene.add(this.frozenGroup);
    this.pillarCenter = this.base.clone().addScaledVector(fwd, D / 2).add(new Vector3(0, P / 2, 0));
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(W / 2, P / 2, D / 2).setTranslation(this.pillarCenter.x, this.pillarCenter.y, this.pillarCenter.z).setRotation(q),
    );
    ctx.physics.setInfo(this.collider, { surface: 'ice', temporary: true });
    this.collider.setEnabled(false);
    this.marker = new RuneMarker(ctx.scene, 'rimewhistle', 0.7);
    this.marker.sprite.position.copy(this.base).addScaledVector(fwd, 0.6).add(new Vector3(0, Math.min(H, P + 1.2), 0));
    ctx.targets.add(this);
    if (spec.frozen) this.freeze(0, true);
  }

  readonly spell = 'rimewhistle' as const;
  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pillarCenter).setY(this.base.y + Math.min(this.spec.height * 0.5, this.spec.pillar + 0.6));
  }
  enabled(): boolean {
    // Frozen ice isn't a target, so freezing the next patch never hits the one underfoot.
    return !this.frozen;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (!this.frozen) this.freeze(hit.charge, false);
  }

  private freeze(charge: number, quiet: boolean): void {
    const d = this.spec.duration ?? 0;
    this.frozenFor = d > 0 ? d * (charge > 0.5 ? 2 : 1) : Infinity;
    this.lastTick = Math.ceil(this.frozenFor);
    this.frozen = true;
    this.frozenGroup.visible = true;
    this.sheet.visible = false;
    this.collider.setEnabled(true);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, true);
    if (!quiet) {
      this.ctx.events.emit('freeze', { pos: this.pillarCenter.clone(), charged: charge > 0.5 });
      this.ctx.fx.burst(this.pillarCenter.clone(), 20, FROST, 3, 0.15, 1.5);
    }
  }

  private melt(): void {
    this.frozen = false;
    this.frozenGroup.visible = false;
    this.sheet.visible = true;
    this.collider.setEnabled(false);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, false);
    this.ctx.events.emit('thaw', { pos: this.pillarCenter.clone() });
    this.ctx.fx.burst(this.pillarCenter.clone(), 18, new Color('#f4fbff'), 2, 0.16, 1.6);
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    if (!this.frozen) {
      // Spray at the foot.
      if (Math.random() < dt * 8) this.ctx.fx.burst(this.base.clone().add(new Vector3((Math.random() - 0.5) * this.spec.width, 0.1, 0.3)), 1, FROST, 1.2, 0.1, 1);
      return;
    }
    if (!Number.isFinite(this.frozenFor)) return;
    this.frozenFor -= dt;
    const tick = Math.ceil(this.frozenFor);
    if (tick < this.lastTick) {
      this.lastTick = tick;
      if (tick > 0 && tick <= THAW_WARN) this.ctx.events.emit('iceCreak', { pos: this.pillarCenter.clone() });
    }
    if (this.frozenFor <= 0) this.melt();
  }

  frameUpdate(dt: number): void {
    if (!this.frozen) {
      this.sheetMat.map!.offset.y += dt * 1.6;
      return;
    }
    const warn = Number.isFinite(this.frozenFor) && this.frozenFor < THAW_WARN;
    const mat = (this.frozenGroup.children[0] as Mesh).material as MeshStandardMaterial;
    mat.opacity = warn ? 0.55 + Math.abs(Math.sin(this.time * 14)) * 0.25 : 0.86;
  }
}

/**
 * A floe: a raft of ice floating on water. Thwackwort shoves it along the dominant axis
 * until it bumps into something (a bank, a pillar, another floe); a charged shove sends
 * it faster. You can ride it.
 */
export class Floe implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius: number;
  private collider: RAPIER.Collider;
  private info: ColliderInfo & { mover: { delta: Vector3 } };
  private mesh: Mesh;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private moving: { dir: Vector3; speed: number } | null = null;
  private bob = Math.random() * 10;
  private readonly half: Vector3;

  constructor(
    spec: SpecOf<'floe'>,
    private ctx: WorldContext,
  ) {
    const [w, d] = spec.size;
    this.half = new Vector3(w / 2, 0.35, d / 2);
    // Its top sits 0.2 above the water.
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + 0.2 - this.half.y, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    this.radius = Math.min(w, d) * 0.45;
    const geo = new BoxGeometry(w, this.half.y * 2, d, 2, 1, 2);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 4 + p.getZ(i) * 3) * 0.04);
    this.mesh = new Mesh(geo.toNonIndexed(), iceMaterial());
    (this.mesh.material as MeshStandardMaterial).opacity = 0.95;
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.pos);
    ctx.scene.add(this.mesh);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(this.half.x, this.half.y, this.half.z).setTranslation(this.pos.x, this.pos.y, this.pos.z));
    this.info = { mover: { delta: new Vector3() }, surface: 'ice', temporary: true, noGrab: true };
    ctx.physics.setInfo(this.collider, this.info);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.6);
    ctx.targets.add(this);
    // A reset bell floats it home if a puzzle goes wrong (unless something's in the way).
    const reset = spec.resetOn;
    if (reset) {
      ctx.signals.onChange([reset], () => {
        if (!ctx.signals.get(reset) || this.pos.equals(this.home) || !this.free(this.home)) return;
        this.moving = null;
        ctx.fx.burst(this.pos.clone().add(new Vector3(0, this.half.y, 0)), 14, FROST, 2, 0.15);
        this.pos.copy(this.home);
        this.prev.copy(this.home);
        this.collider.setTranslation(this.pos);
      });
    }
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, this.half.y, 0));
  }
  enabled(): boolean {
    return !this.moving;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    const dir = Math.abs(hit.dir.x) > Math.abs(hit.dir.z) ? new Vector3(Math.sign(hit.dir.x), 0, 0) : new Vector3(0, 0, Math.sign(hit.dir.z));
    if (!this.free(this.pos.clone().addScaledVector(dir, 0.15))) {
      this.ctx.events.emit('blockStop', { pos: this.pos.clone(), fell: false });
      return;
    }
    this.moving = { dir, speed: hit.charge > 0.5 ? 6 : 3.5 };
    this.ctx.events.emit('floeSlide', { pos: this.pos.clone() });
  }

  /** Is there room for the floe's underwater body at `center` (ignoring itself and anyone riding it)? */
  private free(center: Vector3): boolean {
    const hit = this.ctx.physics.world.intersectionWithShape(
      center.clone().add(new Vector3(0, -0.12, 0)),
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Cuboid(this.half.x - 0.04, this.half.y - 0.15, this.half.z - 0.04),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.collider,
      undefined,
      (c) => c.handle !== this.ctx.player.collider.handle,
    );
    return hit === null;
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    const delta = this.info.mover.delta.set(0, 0, 0);
    if (!this.moving) return;
    const step = this.moving.dir.clone().multiplyScalar(this.moving.speed * dt);
    if (!this.free(this.pos.clone().add(step))) {
      this.moving = null;
      this.ctx.events.emit('blockStop', { pos: this.pos.clone(), fell: false });
      this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, this.half.y, 0)), 10, FROST, 1.8, 0.14);
      return;
    }
    delta.copy(step);
    this.pos.add(step);
  }

  lateFixedUpdate(): void {
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(dt: number, alpha: number): void {
    this.bob += dt;
    this.mesh.position.lerpVectors(this.prev, this.pos, alpha);
    this.mesh.rotation.z = Math.sin(this.bob * 1.3) * 0.012;
    this.marker.sprite.position.set(this.mesh.position.x, this.mesh.position.y + this.half.y + 0.6, this.mesh.position.z);
  }
}
