import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { ColliderInfo } from '../engine/physics';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

const UP = new Vector3(0, 1, 0);
const GLOW = new Color('#8ef06a');

/**
 * Something Springwell can make springy: a mossy cushion, a giant toadstool, an
 * old mattress or a carved rune tile. Until it's cast on, it's just something to
 * stand on. Springwell makes it launch you for `duration` seconds (a charged cast
 * launches higher); angled toadstools (`fling`) throw you sideways too.
 */
export class SpringPad implements Entity, SpellTarget {
  readonly spell = 'springwell' as const;
  readonly marker: RuneMarker;
  readonly radius: number;
  private collider: RAPIER.Collider;
  private group = new Group();
  private top = new Group();
  private glow: MeshStandardMaterial;
  private readonly pos: Vector3;
  /** Where the bouncy surface is. */
  private readonly surface: Vector3;
  private active = 0;
  private scale = 1;
  private lastTick = 0;
  private squash = 0;
  private squashVel = 0;
  private time = Math.random() * 10;
  private readonly fling?: Vector3;

  constructor(
    private spec: SpecOf<'springPad'>,
    private ctx: WorldContext,
  ) {
    const r = spec.radius;
    const style = spec.style ?? 'moss';
    this.radius = Math.max(0.8, r);
    this.pos = new Vector3(...spec.pos);
    this.group.position.copy(this.pos);
    this.group.rotation.y = spec.yaw ?? 0;
    this.glow = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, roughness: 0.85, emissive: new Color('#000000') });
    const mat = worldMaterial();
    const add = (parent: Group, geo: BoxGeometry | CylinderGeometry | SphereGeometry, color: string, x: number, y: number, z: number, m: MeshStandardMaterial = mat) => {
      const mesh = new Mesh(paint(geo.toNonIndexed(), color, true), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    if (spec.fling) {
      this.fling = new Vector3(Math.sin(spec.fling.yaw), 0, Math.cos(spec.fling.yaw)).multiplyScalar(spec.fling.speed);
    }
    const q = new Quaternion().setFromAxisAngle(UP, spec.yaw ?? 0);
    let topY: number;
    let shape: RAPIER.ColliderDesc;
    let shapeCenter: Vector3;
    switch (style) {
      case 'mushroom': {
        // A giant toadstool: a stem up to `height`, a spotted cap on top.
        const h = spec.height ?? 1;
        topY = h + 0.15;
        add(this.group, new CylinderGeometry(r * 0.28, r * 0.36, h, 8), '#efe2c8', 0, h / 2, 0);
        this.ctx.physics.addStaticCylinder(this.pos.clone().add(new Vector3(0, h / 2, 0)), h / 2, r * 0.3);
        this.top.position.y = h - 0.35;
        add(this.top, new CylinderGeometry(r * 0.85, r, 0.4, 14), '#c4486a', 0, 0.2, 0, this.glow);
        add(this.top, new SphereGeometry(r * 0.85, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), '#d4587a', 0, 0.38, 0, this.glow);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.4;
          add(this.top, new CylinderGeometry(r * 0.12, r * 0.12, 0.05, 6), '#fff4dc', Math.cos(a) * r * 0.55, 0.5, Math.sin(a) * r * 0.55);
        }
        // Gills underneath.
        add(this.top, new CylinderGeometry(r * 0.95, r * 0.3, 0.12, 14), '#f3dcc8', 0, -0.04, 0);
        if (this.fling) {
          // Lean the cap the way it throws you.
          const lean = Math.min(0.45, this.fling.length() * 0.05);
          this.top.rotation.x = lean;
        }
        shape = RAPIER.ColliderDesc.cylinder(0.25, r);
        shapeCenter = this.pos.clone().add(new Vector3(0, h - 0.1, 0));
        break;
      }
      case 'mattress': {
        // An old striped mattress on a low frame: `radius` is half its length.
        topY = 0.55;
        add(this.group, new BoxGeometry(r * 2 + 0.1, 0.25, 1.5), COLORS.woodDark, 0, 0.12, 0);
        this.top.position.y = 0.25;
        add(this.top, new BoxGeometry(r * 2, 0.3, 1.4), '#e8dcc0', 0, 0.15, 0, this.glow);
        for (let i = 0; i < 5; i++) add(this.top, new BoxGeometry(0.12, 0.31, 1.41), '#6a8ab0', -r + (i + 0.5) * (r * 2 / 5), 0.15, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(this.top, new SphereGeometry(0.05, 4, 3), '#4a5a7a', sx * r * 0.5, 0.31, sz * 0.4);
        shape = RAPIER.ColliderDesc.cuboid(r, 0.275, 0.75).setRotation(q);
        shapeCenter = this.pos.clone().add(new Vector3(0, 0.275, 0));
        break;
      }
      case 'rune': {
        // A carved stone tile set into the floor.
        topY = 0.2;
        add(this.group, new BoxGeometry(r * 2 + 0.2, 0.12, r * 2 + 0.2), COLORS.stoneDark, 0, 0.06, 0);
        this.top.position.y = 0.1;
        add(this.top, new BoxGeometry(r * 2, 0.1, r * 2), COLORS.stoneLight, 0, 0.05, 0, this.glow);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          add(this.top, new BoxGeometry(0.08, 0.02, r * 0.7), '#5a8a4a', Math.cos(a) * r * 0.35, 0.11, Math.sin(a) * r * 0.35).rotation.y = -a + Math.PI / 2;
        }
        shape = RAPIER.ColliderDesc.cuboid(r, 0.1, r).setRotation(q);
        shapeCenter = this.pos.clone().add(new Vector3(0, 0.1, 0));
        break;
      }
      default: {
        // A cushion of springy moss.
        topY = 0.3;
        this.top.position.y = 0;
        add(this.top, new CylinderGeometry(r, r * 1.05, 0.25, 14), COLORS.moss, 0, 0.125, 0, this.glow);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          add(this.top, new SphereGeometry(r * 0.25, 6, 4).scale(1, 0.5, 1), '#6f8a4a', Math.cos(a) * r * 0.6, 0.26, Math.sin(a) * r * 0.6, this.glow);
        }
        shape = RAPIER.ColliderDesc.cylinder(0.15, r);
        shapeCenter = this.pos.clone().add(new Vector3(0, 0.15, 0));
        break;
      }
    }
    this.surface = this.pos.clone().add(new Vector3(0, topY, 0));
    mergeChildren(this.group, [this.top]);
    mergeChildren(this.top);
    this.group.add(this.top);
    ctx.scene.add(this.group);
    this.collider = ctx.physics.world.createCollider(shape.setTranslation(shapeCenter.x, shapeCenter.y, shapeCenter.z));
    ctx.physics.setInfo(this.collider, { noGrab: true });
    this.marker = new RuneMarker(ctx.scene, 'springwell', 0.7);
    this.marker.sprite.position.copy(this.surface).add(new Vector3(0, 0.9, 0));
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.surface);
  }
  /** Can be cast on again while springy, to top it up (or charge it higher). */
  enabled(): boolean {
    return true;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    const wasActive = this.active > 0;
    const duration = this.spec.duration ?? 8;
    // A duration of 0 means it stays springy for the rest of the visit.
    this.active = duration > 0 ? duration : Infinity;
    this.lastTick = Math.ceil(this.active);
    this.scale = 1 + hit.charge * 0.6;
    const info: ColliderInfo = {
      noGrab: true,
      bounce: {
        scale: this.scale,
        fling: this.fling,
        onBounce: () => {
          this.squashVel -= 9;
        },
      },
    };
    this.ctx.physics.setInfo(this.collider, info);
    this.squashVel += 6;
    if (!wasActive) this.ctx.events.emit('springOn', { pos: this.surface.clone(), charged: hit.charge > 0.5 });
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    if (!(this.active > 0) || !Number.isFinite(this.active)) return;
    this.active -= dt;
    const tick = Math.ceil(this.active);
    if (tick < this.lastTick) {
      this.lastTick = tick;
      if (tick > 0 && tick <= 2) this.ctx.events.emit('switchTick', { pos: this.surface.clone() });
    }
    if (this.active <= 0) {
      this.active = 0;
      this.ctx.physics.setInfo(this.collider, { noGrab: true });
      this.ctx.events.emit('springOff', { pos: this.surface.clone() });
    }
  }

  frameUpdate(dt: number): void {
    const on = this.active > 0;
    // Springy wobble.
    this.squashVel += (-this.squash * 120 - this.squashVel * 9) * dt;
    this.squash += this.squashVel * dt;
    const breathe = on ? Math.sin(this.time * 6) * 0.04 : 0;
    const sy = MathUtils.clamp(1 + this.squash * 0.08 + breathe, 0.5, 1.5);
    this.top.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    // Glow while springy; flicker as it runs out.
    const fading = on && Number.isFinite(this.active) && this.active < 2;
    const k = on ? (fading ? (Math.sin(this.time * 18) > 0 ? 0.55 : 0.15) : 0.55 + Math.sin(this.time * 4) * 0.1) : 0;
    this.glow.emissive.copy(GLOW).multiplyScalar(k * (this.scale > 1.3 ? 1.4 : 1));
  }
}
