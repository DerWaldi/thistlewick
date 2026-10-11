import RAPIER from '@dimforge/rapier3d-compat';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Points,
  PointsMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
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
    // Unlit lamps keep a faint ember so they read as lamps in the dark.
    this.glass.emissive.copy(GOLD).multiplyScalar(lit ? 1.6 * flicker : 0.12 + Math.sin(this.time * 1.5) * 0.04);
    if (this.light) this.light.intensity = lit ? 7 * flicker : 0;
    // Lamps that are simply always on don't need their reach shown.
    this.bubble.visible = this.shown > 0.05 && this.spec.duration !== 0;
    this.bubble.scale.setScalar(Math.max(0.01, this.shown));
    (this.bubble.material as ShaderMaterial).uniforms.opacity.value = 0.38 * flicker;
  }
}

const LIGHT_VERTEX = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vLocal = position;
    vN = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const LIGHT_FRAGMENT = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uHalf;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vN;
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    // Distance (in metres) to the nearest edge of this face: the rim glows brightest.
    vec3 d = uHalf - abs(vLocal);
    float lo = min(d.x, min(d.y, d.z));
    float hi = max(d.x, max(d.y, d.z));
    float edge = d.x + d.y + d.z - lo - hi;
    float rim = 1.0 - smoothstep(0.0, 0.14, edge);
    // Slow swirling light through the body.
    vec2 p = (abs(vN.y) > 0.5 ? vWorld.xz : vec2(vWorld.x + vWorld.z, vWorld.y)) * 1.6;
    float sw = n2(p + vec2(uTime * 0.35, -uTime * 0.2)) * 0.6 + n2(p * 2.3 - vec2(uTime * 0.5, uTime * 0.3)) * 0.4;
    // Twinkling motes on the top face.
    vec2 cell = floor(vWorld.xz * 6.0);
    float tw = step(0.93, h2(cell)) * (0.5 + 0.5 * sin(uTime * 4.0 + h2(cell + 3.1) * 40.0));
    float top = step(0.5, vN.y);
    // Kept below 1 except at the rim, so bloom doesn't bleach it white: it should read gold.
    vec3 col = mix(vec3(0.95, 0.55, 0.1), vec3(1.0, 0.82, 0.35), sw);
    col *= 0.55 + rim * 0.55 + top * 0.1;
    col += vec3(1.0, 0.85, 0.45) * tw * top * 0.6;
    float a = uFade * clamp(0.38 + sw * 0.3 + rim * 0.55 + top * 0.12 + tw * top * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

let sparkTexture: CanvasTexture | null = null;
function sparkMap(): CanvasTexture {
  if (sparkTexture) return sparkTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.35, 'rgba(255,200,90,0.6)');
  grad.addColorStop(1, 'rgba(255,190,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  sparkTexture = new CanvasTexture(c);
  return sparkTexture;
}

/**
 * Gold magic sparks drifting up through a box (`min`..`max`), each fading in and out as it
 * rises and wraps. Hidden while `fade` is ~0, so unlit ones cost no draw call.
 */
class GoldSparks {
  private readonly points: Points;
  private readonly mat: PointsMaterial;
  private readonly base: Float32Array;
  private readonly pos: Float32Array;
  private readonly glow: Float32Array;
  private readonly seed: Float32Array;

  constructor(
    scene: Object3D,
    private readonly min: Vector3,
    private readonly max: Vector3,
    count: number,
    size = 0.16,
  ) {
    this.base = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = min.x + Math.random() * (max.x - min.x);
      this.base[i * 3 + 2] = min.z + Math.random() * (max.z - min.z);
      this.seed[i] = Math.random() * 10;
    }
    this.pos = Float32Array.from(this.base);
    // Additive: a darker vertex colour is a fainter spark.
    this.glow = new Float32Array(count * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new BufferAttribute(this.glow, 3));
    this.mat = new PointsMaterial({ size, map: sparkMap(), color: '#ffd27a', vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
    this.mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', 'gl_PointSize = min(gl_PointSize, 8.0);\n#include <fog_vertex>');
    };
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  update(t: number, fade: number): void {
    this.points.visible = fade > 0.05;
    if (!this.points.visible) return;
    this.mat.opacity = fade * 0.9;
    const rise = this.max.y - this.min.y;
    for (let i = 0; i < this.seed.length; i++) {
      const s = this.seed[i];
      const k = (t * (0.35 / Math.max(0.6, rise)) * 1.3 + s) % 1;
      this.pos[i * 3] = this.base[i * 3] + Math.sin(t * 1.7 + s * 5) * 0.08;
      this.pos[i * 3 + 1] = this.min.y + k * rise;
      this.pos[i * 3 + 2] = this.base[i * 3 + 2] + Math.cos(t * 1.3 + s * 7) * 0.08;
      this.glow[i * 3] = this.glow[i * 3 + 1] = this.glow[i * 3 + 2] = Math.sin(k * Math.PI);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/**
 * A glimmerstone platform: only there (solid, and glowing) while it's inside a lit lamp's
 * glow. Solid, it's a slab of golden light with a bright rim, swirling inside, motes
 * twinkling on top and magic sparks drifting up off it. In the dark, a faint gold outline
 * is all that gives it away.
 */
export class GlimmerBlock implements Entity {
  private collider: RAPIER.Collider;
  private mat: ShaderMaterial;
  private edges: LineBasicMaterial;
  private readonly center: Vector3;
  private readonly slack: number;
  private solid = false;
  private fade = 0;
  private t = Math.random() * 20;
  private sparks: GoldSparks;

  constructor(
    spec: SpecOf<'glimmerBlock'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.center = new Vector3(...spec.pos);
    this.slack = Math.min(w, d) / 2;
    this.mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uFade: { value: 0 }, uHalf: { value: new Vector3(w / 2, h / 2, d / 2) } }]),
      vertexShader: LIGHT_VERTEX,
      fragmentShader: LIGHT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const box = new Mesh(new BoxGeometry(w, h, d), this.mat);
    box.position.copy(this.center);
    box.renderOrder = 2;
    this.edges = new LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.08, fog: true });
    const outline = new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)), this.edges);
    outline.position.copy(this.center);

    ctx.scene.add(box, outline);
    // Sparks rising off the top while it's solid.
    const top = this.center.y + h / 2;
    this.sparks = new GoldSparks(ctx.scene, new Vector3(this.center.x - w / 2, top, this.center.z - d / 2), new Vector3(this.center.x + w / 2, top + 0.9, this.center.z + d / 2), Math.max(6, Math.min(36, Math.round(w * d * 5))));

    this.collider = ctx.physics.addStaticBox(this.center, new Vector3(w / 2, h / 2, d / 2));
    ctx.physics.setInfo(this.collider, { noGrab: !spec.grabbable, temporary: true });
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
    this.t += dt;
    this.fade = MathUtils.damp(this.fade, this.solid ? 1 : 0, 10, dt);
    this.mat.uniforms.uFade.value = this.fade;
    this.mat.uniforms.uTime.value = this.t;
    this.mat.depthWrite = this.fade > 0.5;
    this.edges.opacity = 0.08 + this.fade * 0.45;
    this.sparks.update(this.t, this.fade);
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
  private readonly half: Vector3;
  private edges: LineBasicMaterial;
  private sparks: GoldSparks;

  constructor(
    spec: SpecOf<'illusionWall'>,
    private ctx: WorldContext,
  ) {
    const [w, h, d] = spec.size;
    this.center = new Vector3(...spec.pos);
    this.half = new Vector3(w / 2, h / 2, d / 2);
    this.slack = Math.max(w, d) / 2;
    this.mat = worldMaterial();
    this.mat.transparent = true;
    // Revealed, it goes the way of the glimmerstone: a ghost of golden light with sparks.
    this.mat.emissive = new Color('#ffc65a');
    this.mat.emissiveIntensity = 0;
    const wall = new Mesh(paint(new BoxGeometry(w, h, d).toNonIndexed(), spec.color ?? COLORS.stone, true, 'stone'), this.mat);
    wall.position.copy(this.center);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.edges = new LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, fog: true });
    const outline = new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)), this.edges);
    outline.position.copy(this.center);
    ctx.scene.add(wall, outline);
    this.sparks = new GoldSparks(ctx.scene, this.center.clone().sub(this.half), this.center.clone().add(this.half), Math.max(10, Math.min(40, Math.round(Math.max(w, d) * h * 3))));
    this.collider = ctx.physics.addStaticBox(this.center, new Vector3(w / 2, h / 2, d / 2));
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    // Never turn solid round someone standing in the gap.
    const lit = this.ctx.glimmer.covers(this.center, this.slack) || (this.open && this.playerInside());
    if (lit !== this.open) {
      this.open = lit;
      this.collider.setEnabled(!lit);
      if (lit) this.ctx.events.emit('wallFade', { pos: this.center.clone() });
    }
  }

  private playerInside(): boolean {
    const p = this.ctx.player.pos;
    const h = this.half;
    return Math.abs(p.x - this.center.x) < h.x + 0.4 && Math.abs(p.z - this.center.z) < h.z + 0.4 && Math.abs(p.y - this.center.y) < h.y + 1;
  }

  frameUpdate(dt: number): void {
    this.fade = MathUtils.damp(this.fade, this.open ? 1 : 0, 6, dt);
    this.mat.opacity = 1 - this.fade * (0.9 + Math.sin(this.time * 5) * 0.04);
    this.mat.depthWrite = this.fade < 0.5;
    this.mat.emissiveIntensity = this.fade * (0.7 + Math.sin(this.time * 3) * 0.1);
    this.edges.opacity = this.fade * 0.6;
    this.sparks.update(this.time, this.fade);
  }
}
