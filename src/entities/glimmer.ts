import RAPIER from '@dimforge/rapier3d-compat';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  DoubleSide,
  Vector3,
} from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import type { GlimmerLight } from '../world/glimmer';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, SpecOf, WorldContext } from './types';

const IRON = new MeshStandardMaterial({ color: '#2a2230', metalness: 0.5, roughness: 0.6, flatShading: true });
const GOLD = new Color('#ffd27a');

/**
 * A wick lamp. Glimmerwick lights it for `duration` seconds (a charged cast lights a
 * wider circle); inside its glow, glimmer platforms turn solid and false walls fade.
 * A faint bubble shows how far the light reaches.
 */
export class WickLamp implements Entity, SpellTarget, GlimmerLight {
  readonly spell = 'glimmerwick' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.6;
  readonly pos: Vector3;
  private collider: RAPIER.Collider;
  private glass: MeshStandardMaterial;
  private bubble: Mesh;
  private light: PointLight | null = null;
  private litFor = 0;
  private litReach = 0;
  private shown = 0;
  private lastTick = 0;
  private time = Math.random() * 10;

  constructor(
    private spec: SpecOf<'wickLamp'>,
    private ctx: WorldContext,
  ) {
    const [x, y, z] = spec.pos;
    const style = spec.style ?? 'post';
    const group = new Group();
    group.position.set(x, y, z);
    group.rotation.y = spec.yaw ?? 0;
    const mat = worldMaterial();
    // The lantern head: an iron cage round a glass that glows when lit.
    let head: number;
    if (style === 'post') {
      head = 2.1;
      const post = new Mesh(paint(new CylinderGeometry(0.07, 0.1, 1.9, 6).toNonIndexed(), '#2a2230', true), mat);
      post.position.y = 0.95;
      const foot = new Mesh(paint(new CylinderGeometry(0.3, 0.36, 0.14, 8).toNonIndexed(), COLORS.stoneDark, true), mat);
      foot.position.y = 0.07;
      group.add(post, foot);
    } else if (style === 'wall') {
      head = 0;
      const arm = new Mesh(paint(new BoxGeometry(0.06, 0.06, 0.5).toNonIndexed(), '#2a2230', true), mat);
      arm.position.set(0, 0.3, 0.2);
      const plate = new Mesh(paint(new BoxGeometry(0.2, 0.3, 0.04).toNonIndexed(), '#2a2230', true), mat);
      plate.position.set(0, 0.3, 0.02);
      group.add(arm, plate);
    } else {
      head = 0;
      const chain = new Mesh(paint(new CylinderGeometry(0.02, 0.02, 3, 4).toNonIndexed(), '#3a3340', true), mat);
      chain.position.y = 1.8;
      group.add(chain);
    }
    const lantern = new Group();
    lantern.position.set(0, head, style === 'wall' ? 0.45 : 0);
    this.glass = new MeshStandardMaterial({ color: '#c8c0b0', roughness: 0.2, emissive: new Color('#000000'), transparent: true, opacity: 0.85 });
    const glass = new Mesh(new CylinderGeometry(0.16, 0.16, 0.36, 8), this.glass);
    const cap = new Mesh(new CylinderGeometry(0.04, 0.22, 0.16, 8), IRON);
    cap.position.y = 0.26;
    const base = new Mesh(new CylinderGeometry(0.2, 0.14, 0.08, 8), IRON);
    base.position.y = -0.22;
    const ring = new Mesh(new CylinderGeometry(0.17, 0.17, 0.36, 8, 1, true), new MeshStandardMaterial({ color: '#2a2230', wireframe: true }));
    lantern.add(glass, cap, base, ring);
    group.add(lantern);
    mergeChildren(group, [lantern]);
    ctx.scene.add(group);

    this.pos = new Vector3(x, y, z).add(lantern.position.clone().applyAxisAngle(new Vector3(0, 1, 0), spec.yaw ?? 0));
    // The edge of the glow: a bubble that's only visible at its rim.
    this.bubble = new Mesh(
      new SphereGeometry(1, 28, 16),
      new ShaderMaterial({
        uniforms: { opacity: { value: 0 }, color: { value: new Color('#ffe6a0') } },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float opacity;
          uniform vec3 color;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
            gl_FragColor = vec4(color, rim * opacity);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
    this.bubble.position.copy(this.pos);
    this.bubble.visible = false;
    ctx.scene.add(this.bubble);
    if (spec.light) {
      // Created up front at zero: adding lights later would force shader recompiles.
      this.light = new PointLight('#ffd890', 0, spec.lightRange ?? spec.radius * 1.8, 1.4);
      this.light.position.copy(this.pos);
      ctx.scene.add(this.light);
    }
    this.collider = ctx.physics.addStaticBox(this.pos, new Vector3(0.2, 0.3, 0.2));
    this.marker = new RuneMarker(ctx.scene, 'glimmerwick', 0.55);
    this.marker.sprite.position.copy(this.pos).add(new Vector3(0, 0.65, 0));
    ctx.targets.add(this);
    ctx.glimmer.add(this);
    if (spec.lit) this.ignite(0);
  }

  /** The lit radius right now (what glimmer blocks and false walls check against). */
  get reach(): number {
    return this.litReach;
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos);
  }
  /** Can be cast on again while lit, to top it up (or light it wider). */
  enabled(): boolean {
    return true;
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    this.ignite(hit.charge);
  }

  private ignite(charge: number): void {
    const wasLit = this.litFor > 0;
    const d = this.spec.duration ?? 8;
    this.litFor = d > 0 ? d : Infinity;
    this.litReach = this.spec.radius * (1 + 0.5 * charge);
    this.lastTick = Math.ceil(this.litFor);
    if (this.spec.id) this.ctx.signals.set(this.spec.id, true);
    if (!wasLit) this.ctx.events.emit('lampLit', { pos: this.pos.clone(), charged: charge > 0.5 });
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    if (!(this.litFor > 0) || !Number.isFinite(this.litFor)) return;
    this.litFor -= dt;
    const tick = Math.ceil(this.litFor);
    if (tick < this.lastTick) {
      this.lastTick = tick;
      if (tick > 0 && tick <= 3) this.ctx.events.emit('switchTick', { pos: this.pos.clone() });
    }
    if (this.litFor <= 0) {
      this.litFor = 0;
      this.litReach = 0;
      if (this.spec.id) this.ctx.signals.set(this.spec.id, false);
      this.ctx.events.emit('lampOut', { pos: this.pos.clone() });
    }
  }

  frameUpdate(dt: number): void {
    const lit = this.litFor > 0;
    const dying = lit && Number.isFinite(this.litFor) && this.litFor < 2.5;
    const flicker = dying ? (Math.sin(this.time * 22) > -0.2 ? 1 : 0.35) : 1 + Math.sin(this.time * 9) * 0.06;
    this.shown = MathUtils.damp(this.shown, lit ? this.litReach : 0, 8, dt);
    this.glass.emissive.copy(GOLD).multiplyScalar(lit ? 1.6 * flicker : 0);
    if (this.light) this.light.intensity = lit ? 7 * flicker : 0;
    // Lamps that are simply always on don't need their reach shown.
    this.bubble.visible = this.shown > 0.05 && this.spec.duration !== 0;
    this.bubble.scale.setScalar(Math.max(0.01, this.shown));
    (this.bubble.material as ShaderMaterial).uniforms.opacity.value = 0.38 * flicker;
  }
}

/**
 * A glimmerstone platform: only there (solid, and properly visible) while it's inside
 * a lit lamp's glow. In the dark, a faint outline is all that gives it away.
 */
export class GlimmerBlock implements Entity {
  private collider: RAPIER.Collider;
  private mat: MeshStandardMaterial;
  private edges: LineBasicMaterial;
  private readonly center: Vector3;
  private readonly slack: number;
  private solid = false;
  private fade = 0;

  constructor(
    spec: SpecOf<'glimmerBlock'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.center = new Vector3(...spec.pos);
    this.slack = Math.min(w, d) / 2;
    this.mat = new MeshStandardMaterial({ color: '#bfe8ff', emissive: new Color('#5aa8e0'), emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0, depthWrite: false });
    const box = new Mesh(new BoxGeometry(w, h, d), this.mat);
    box.position.copy(this.center);
    box.receiveShadow = true;
    this.edges = new LineBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.07, fog: true });
    const outline = new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)), this.edges);
    outline.position.copy(this.center);
    ctx.scene.add(box, outline);
    this.collider = ctx.physics.addStaticBox(this.center, new Vector3(w / 2, h / 2, d / 2));
    ctx.physics.setInfo(this.collider, { noGrab: !spec.grabbable });
    this.collider.setEnabled(false);
  }

  fixedUpdate(): void {
    const lit = this.ctx.glimmer.covers(this.center, this.slack);
    if (lit !== this.solid) {
      this.solid = lit;
      this.collider.setEnabled(lit);
    }
  }

  frameUpdate(dt: number): void {
    this.fade = MathUtils.damp(this.fade, this.solid ? 1 : 0, 10, dt);
    this.mat.opacity = this.fade * 0.92;
    this.mat.depthWrite = this.fade > 0.5;
    this.edges.opacity = 0.07 + this.fade * 0.5;
  }
}

/**
 * A false wall: plain stone to look at, solid to walk into, until a lit lamp's glow
 * reaches it. Then it shimmers away and you can walk through.
 */
export class IllusionWall implements Entity {
  private collider: RAPIER.Collider;
  private mat: MeshStandardMaterial;
  private readonly center: Vector3;
  private readonly slack: number;
  private open = false;
  private fade = 0;
  private time = 0;

  constructor(
    spec: SpecOf<'illusionWall'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.center = new Vector3(...spec.pos);
    this.slack = Math.max(w, d) / 2;
    this.mat = worldMaterial();
    this.mat.transparent = true;
    this.mat.emissive = new Color('#5aa8e0');
    this.mat.emissiveIntensity = 0;
    const wall = new Mesh(paint(new BoxGeometry(w, h, d).toNonIndexed(), spec.color ?? COLORS.stone, true, 'stone'), this.mat);
    wall.position.copy(this.center);
    wall.castShadow = true;
    wall.receiveShadow = true;
    ctx.scene.add(wall);
    this.collider = ctx.physics.addStaticBox(this.center, new Vector3(w / 2, h / 2, d / 2));
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const lit = this.ctx.glimmer.covers(this.center, this.slack);
    if (lit !== this.open) {
      this.open = lit;
      this.collider.setEnabled(!lit);
      if (lit) this.ctx.events.emit('wallFade', { pos: this.center.clone() });
    }
  }

  frameUpdate(dt: number): void {
    this.fade = MathUtils.damp(this.fade, this.open ? 1 : 0, 6, dt);
    this.mat.opacity = 1 - this.fade * (0.82 + Math.sin(this.time * 5) * 0.06);
    this.mat.depthWrite = this.fade < 0.5;
    this.mat.emissiveIntensity = this.fade * 0.6;
  }
}
