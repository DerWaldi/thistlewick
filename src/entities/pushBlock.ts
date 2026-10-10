import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, Group, Mesh, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ColliderInfo } from '../engine/physics';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint, type V3 } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import type { Entity, SpecOf, WorldContext } from './types';

const SLIDE_SPEED = 6;
const SLIDE_SPEED_CHARGED = 9;

/**
 * A heavy carved block. Thwackwort shoves it one tile (its own size) away from you;
 * a charged cast sends it sliding up to four tiles. It stops at walls and drops
 * into gaps, where it becomes a stepping stone.
 */
export class PushBlock implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius: number;
  private collider: RAPIER.Collider;
  private info: ColliderInfo & { mover: { delta: Vector3 } };
  private group = new Group();
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private readonly size: number;
  private moving: { dir: Vector3; to: Vector3; tilesLeft: number; speed: number } | null = null;
  private falling: { vy: number; landY: number } | null = null;

  constructor(
    spec: SpecOf<'pushBlock'>,
    private ctx: WorldContext,
  ) {
    this.size = spec.size ?? 2;
    this.radius = this.size * 0.45;
    const h = this.size / 2;
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + h, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();

    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(h, h, h).setTranslation(this.pos.x, this.pos.y, this.pos.z),
    );
    this.info = { mover: { delta: new Vector3() } };
    ctx.physics.setInfo(this.collider, this.info);

    this.group.add(this.buildMesh());
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort');
    ctx.targets.add(this);
    // A reset bell (or any signal) can send the block back home if a puzzle goes wrong.
    if (spec.resetOn) {
      const id = spec.resetOn;
      ctx.signals.onChange([id], () => {
        if (ctx.signals.get(id) && !this.pos.equals(this.home)) {
          this.moving = null;
          this.falling = null;
          this.reset();
        }
      });
    }
  }

  private buildMesh(): Mesh {
    const s = this.size;
    const body = paint(new BoxGeometry(s, s, s).toNonIndexed(), '#9d8a7a', true);
    const parts = [body];
    // Carved panels on each side and a mossy cap.
    const panel = (pos: V3, size: V3) => {
      const g = paint(new BoxGeometry(...size).toNonIndexed(), '#b8a690', true);
      g.translate(...pos);
      parts.push(g);
    };
    const inset = s * 0.62;
    panel([0, 0, s / 2 + 0.01], [inset, inset, 0.04]);
    panel([0, 0, -s / 2 - 0.01], [inset, inset, 0.04]);
    panel([s / 2 + 0.01, 0, 0], [0.04, inset, inset]);
    panel([-s / 2 - 0.01, 0, 0], [0.04, inset, inset]);
    const moss = paint(new BoxGeometry(s * 0.9, 0.06, s * 0.9).toNonIndexed(), COLORS.moss, true);
    moss.translate(0, s / 2 + 0.02, 0);
    parts.push(moss);
    const merged = mergeAll(parts);
    const mesh = new Mesh(merged, worldMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos);
  }

  enabled(): boolean {
    return !this.moving && !this.falling;
  }

  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    // Snap the push to the dominant horizontal axis so blocks stay on the grid.
    const dir = Math.abs(hit.dir.x) > Math.abs(hit.dir.z) ? new Vector3(Math.sign(hit.dir.x), 0, 0) : new Vector3(0, 0, Math.sign(hit.dir.z));
    const tiles = 1 + Math.round(hit.charge * 3);
    this.tryStep(dir, tiles, hit.charge > 0.5 ? SLIDE_SPEED_CHARGED : SLIDE_SPEED);
  }

  private tryStep(dir: Vector3, tilesLeft: number, speed: number): void {
    const to = this.pos.clone().addScaledVector(dir, this.size);
    if (!this.free(to)) {
      if (this.moving) this.stop(false);
      else this.ctx.events.emit('blockStop', { pos: this.pos.clone(), fell: false });
      this.moving = null;
      return;
    }
    if (!this.moving) this.ctx.events.emit('blockSlide', { pos: this.pos.clone() });
    this.moving = { dir, to, tilesLeft, speed };
  }

  /** Is the space at `center` empty (ignoring ourselves)? */
  private free(center: Vector3): boolean {
    const h = this.size / 2 - 0.06;
    const hit = this.ctx.physics.world.intersectionWithShape(
      center,
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Cuboid(h, h, h),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.collider,
    );
    return hit === null;
  }

  /** Height the block's centre would come to rest at if dropped from `at`. */
  private restingY(at: Vector3): number | null {
    const h = this.size / 2;
    // Probe the corners slightly inset; the highest support wins.
    let best: number | null = null;
    for (const [ox, oz] of [
      [0, 0],
      [-h * 0.7, -h * 0.7],
      [h * 0.7, -h * 0.7],
      [-h * 0.7, h * 0.7],
      [h * 0.7, h * 0.7],
    ]) {
      const o = new Vector3(at.x + ox, at.y - h + 0.05, at.z + oz);
      const hit = this.ctx.physics.raycast(o, new Vector3(0, -1, 0), 60, this.collider);
      if (hit && (best === null || hit.point.y > best)) best = hit.point.y;
    }
    return best === null ? null : best + h;
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.pos);
    const delta = this.info.mover.delta.set(0, 0, 0);

    if (this.moving) {
      const m = this.moving;
      const rem = new Vector3().subVectors(m.to, this.pos);
      const d = rem.length();
      const step = m.speed * dt;
      if (d > step) {
        delta.copy(rem).multiplyScalar(step / d);
      } else {
        delta.copy(rem);
        this.pos.add(delta);
        delta.set(0, 0, 0);
        this.arrive();
      }
      this.pos.add(delta);
    } else if (this.falling) {
      const f = this.falling;
      f.vy = Math.max(f.vy - 22 * dt, -25);
      const ny = Math.max(f.landY, this.pos.y + f.vy * dt);
      delta.set(0, ny - this.pos.y, 0);
      this.pos.y = ny;
      if (ny <= f.landY + 1e-4) this.stop(true);
    }
    // Descending: move the collider first so a rider follows it down.
    if (delta.y < 0) this.collider.setTranslation(this.pos);
  }

  lateFixedUpdate(): void {
    this.collider.setTranslation(this.pos);
  }

  private arrive(): void {
    const m = this.moving!;
    const rest = this.restingY(this.pos);
    if (rest === null) {
      // Nothing below at all: put it back where it started.
      this.moving = null;
      this.reset();
      return;
    }
    if (rest < this.pos.y - 0.05) {
      this.moving = null;
      this.falling = { vy: 0, landY: rest };
      return;
    }
    if (m.tilesLeft > 1) this.tryStep(m.dir, m.tilesLeft - 1, m.speed);
    else this.stop(false);
  }

  private stop(fell: boolean): void {
    this.moving = null;
    this.falling = null;
    this.ctx.events.emit('blockStop', { pos: this.pos.clone(), fell });
    this.ctx.fx.burst(new Vector3(this.pos.x, this.pos.y - this.size / 2, this.pos.z), fell ? 18 : 8, dustColor, fell ? 3 : 1.6, 0.18);
  }

  private reset(): void {
    this.ctx.fx.burst(this.pos, 16, dustColor, 2.5, 0.2);
    this.pos.copy(this.home);
    this.prev.copy(this.home);
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(_dt: number, alpha: number): void {
    this.group.position.lerpVectors(this.prev, this.pos, alpha);
    this.marker.sprite.position.set(this.group.position.x, this.group.position.y + this.size / 2 + 0.55, this.group.position.z);
  }
}

const dustColor = new Color('#d8c4a4');

function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  parts.forEach((p) => p.deleteAttribute('uv'));
  return mergeGeometries(parts)!;
}
