import RAPIER from '@dimforge/rapier3d-compat';
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { dampAngle } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import { dressWith, modelIslands } from './models';
import type { Entity, SpecOf, WorldContext } from './types';

/**
 * Two foes that fight from a distance, so you can't just walk up and thwack them:
 *
 * Hexling: a bad fairy. She circles high over her patch, and when she can see you she
 * winds up (a purple glow) and throws a hex orb that drifts after you for a moment. A
 * Thwackwort knocks her out of the air; while she's down, a second one banishes her (a
 * charged hit does both at once). High up she's hard to aim at: back off, or wait for her
 * to swoop.
 *
 * Sootling: a chimney imp with a sack of soot-bombs. He lobs them in an arc to where you're
 * heading; a bomb lands, fizzes and blinks, and goes off after its fuse. Thwackwort a
 * fizzing bomb and it goes flying (back at him, if you aim well: his own blast knocks him
 * out). Thwackwort him and he's dazed, and drops whatever he was about to throw; a second
 * thwack while he's dazed banishes him.
 */

const HEX = new Color('#c86aff');
const SOOT = new Color('#3a3036');
const SPARK = new Color('#ffb347');
const BLAST = new Color('#ff7a2a');

function part(geo: BufferGeometry, color: string, mat: MeshStandardMaterial): Mesh {
  const g = geo.index ? geo.toNonIndexed() : geo;
  return new Mesh(paint(g, color, true), mat);
}

/** Pays out sweets the first time a placed foe is beaten (never again), on solid ground. */
function loot(ctx: WorldContext, id: string, at: Vector3): void {
  const flag = `looted:${id}`;
  if (ctx.state.flags.has(flag)) return;
  ctx.state.flags.add(flag);
  // Banished over a chasm? The sweets land where you can reach them.
  const ground = ctx.physics.raycast(at, new Vector3(0, -1, 0), 8);
  at = ground ? ground.point.clone().add(new Vector3(0, 0.6, 0)) : ctx.player.pos.clone();
  ctx.sweets.burst('fizzwort', at, 3);
  ctx.sweets.burst('bramble', at, 1);
}

function canSee(ctx: WorldContext, from: Vector3, target: Vector3, ignore: RAPIER.Collider): boolean {
  const to = target.clone().sub(from);
  const dist = to.length();
  return !ctx.physics.raycast(from, to.normalize(), dist, ignore, (c) => c.handle !== ctx.player.collider.handle && !ctx.physics.getInfo(c)?.seeThrough);
}

/** Banished in a puff: it's gone for this visit (and for good with `persist`). */
function banish(ctx: WorldContext, spec: { id?: string; persist?: boolean }, id: string, at: Vector3): void {
  ctx.fx.burst(at.clone(), 26, HEX, 3.4, 0.16, 0.5);
  ctx.events.emit('foeBanished', { pos: at.clone() });
  if (spec.id) {
    ctx.signals.set(spec.id, true);
    if (spec.persist) ctx.state.flags.add(`down:${spec.id}`);
  }
  loot(ctx, id, at);
}

// ================================================================ Hexling

type HexState = 'fly' | 'windup' | 'down' | 'gone';

interface Orb {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
  homing: number;
}

export class Hexling implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.8;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly wings: { pivot: Group; side: number; lower: boolean }[] = [];
  private readonly glow: MeshStandardMaterial;
  private readonly home: Vector3;
  readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly orbs: Orb[] = [];
  private readonly orbMat = new MeshStandardMaterial({ color: '#e0a8ff', emissive: new Color('#a040ff'), emissiveIntensity: 2.6 });
  private state: HexState = 'fly';
  private timer = 0;
  private reload: number;
  private t = Math.random() * 20;
  private vy = 0;

  constructor(
    private spec: SpecOf<'hexling'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.home = new Vector3(spec.pos[0], spec.pos[1] + (spec.height ?? 3.2), spec.pos[2]);
    this.pos = this.home.clone();
    this.prev = this.pos.clone();
    this.reload = 1.2 + Math.random() * 1.5;
    this.glow = new MeshStandardMaterial({ color: '#f0d0ff', emissive: new Color('#b050ff'), emissiveIntensity: 1, flatShading: true });
    buildHexling(this.body, this.wings, this.glow);
    this.root.add(this.body);
    // Bigger than a real fairy, so she reads from across a room.
    this.body.scale.setScalar(1.4);
    this.root.traverse((o) => (o.castShadow = o instanceof Mesh && !(o.material instanceof MeshBasicMaterial)));
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.55).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true));
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.3, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state === 'down' || hit.charge > 0.5) {
      this.gone();
      return;
    }
    // Knocked out of the air: she drops, and lies dazed for a moment.
    this.state = 'down';
    this.timer = 3.2;
    this.vy = 1.5;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone(), 12, HEX, 2.2, 0.12, 0.8);
  }

  private gone(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    banish(this.ctx, this.spec, this.id, this.pos);
  }

  private throwOrb(): void {
    const from = this.pos.clone().add(new Vector3(0, 0.4, 0));
    const aim = this.ctx.player.pos.clone().add(new Vector3(0, 0.3, 0)).addScaledVector(this.ctx.player.vel, 0.3).sub(from);
    const vel = aim.normalize().multiplyScalar(this.spec.speed ?? 6.5);
    const mesh = new Mesh(new IcosahedronGeometry(0.2, 1), this.orbMat);
    mesh.position.copy(from);
    this.ctx.scene.add(mesh);
    this.orbs.push({ mesh, pos: from, vel, life: 4, homing: 1.4 });
    this.ctx.events.emit('hexCast', { pos: from.clone() });
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    this.updateOrbs(dt);
    if (this.state === 'gone') return;
    const p = this.ctx.player.pos;
    const r = this.spec.radius ?? 3.5;
    switch (this.state) {
      case 'fly':
      case 'windup': {
        // A lazy figure-of-eight over her patch, bobbing; she slows to throw.
        const speed = this.state === 'windup' ? 0.15 : 0.55;
        this.t += dt * (speed - 1);
        const a = this.t * 0.9;
        const target = this.home.clone().add(new Vector3(Math.sin(a) * r, Math.sin(this.t * 2.3) * 0.35, Math.sin(a * 2) * r * 0.5));
        this.pos.lerp(target, 1 - Math.exp(-3 * dt));
        if (this.state === 'fly') {
          this.reload -= dt;
          const range = this.spec.range ?? 15;
          if (this.reload <= 0 && p.distanceTo(this.pos) < range && this.ctx.player.mode !== 'reset' && canSee(this.ctx, this.pos, p, this.collider)) {
            this.state = 'windup';
            this.timer = 0.75;
          }
        } else if (this.timer <= 0) {
          this.throwOrb();
          this.state = 'fly';
          this.reload = this.spec.interval ?? 2.6;
        }
        break;
      }
      case 'down': {
        // Falls to the ground (or whatever's under her), lies dazed, then flutters back up.
        const ground = this.ctx.physics.raycast(this.pos, new Vector3(0, -1, 0), 80, this.collider);
        const floor = ground ? ground.point.y + 0.35 : this.pos.y;
        this.vy -= 18 * dt;
        this.pos.y = Math.max(floor, this.pos.y + this.vy * dt);
        if (this.pos.y <= floor) this.vy = 0;
        if (this.timer <= 0) {
          this.state = 'fly';
          this.reload = 1.5;
        }
        break;
      }
    }
    this.collider.setTranslation(this.pos);
    // Brushing past her stings.
    if (this.state !== 'down' && this.pos.distanceTo(p) < 0.8) this.ctx.health.damage(1, this.pos.clone());
  }

  private updateOrbs(dt: number): void {
    const p = this.ctx.player.pos;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      // Drifts after you for its first moments, then flies straight: sidestep late.
      if (o.homing > 0) {
        o.homing -= dt;
        const want = p.clone().add(new Vector3(0, 0.3, 0)).sub(o.pos).normalize().multiplyScalar(o.vel.length());
        o.vel.lerp(want, 1 - Math.exp(-1.6 * dt));
      }
      const step = o.vel.clone().multiplyScalar(dt);
      const hitWall = this.ctx.physics.raycast(o.pos, step.clone().normalize(), step.length(), this.collider, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
      o.pos.add(step);
      const hitPlayer = o.pos.distanceTo(p) < 0.65 && this.ctx.player.mode !== 'reset';
      if (hitPlayer) this.ctx.health.damage(1, o.pos.clone());
      if (hitPlayer || hitWall || o.life <= 0) {
        this.ctx.fx.burst(o.pos.clone(), 12, HEX, 2.2, 0.12, 0.6);
        this.ctx.events.emit('hexHit', { pos: o.pos.clone() });
        o.mesh.removeFromParent();
        o.mesh.geometry.dispose();
        this.orbs.splice(i, 1);
      }
    }
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const o of this.orbs) {
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y += dt * 6;
      if (Math.random() < dt * 24) this.ctx.fx.burst(o.pos.clone(), 1, HEX, 0.5, 0.07, 0.2);
    }
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    // A faint trail of hex-dust where she flies.
    if (this.state !== 'down' && Math.random() < dt * 14) this.ctx.fx.burst(this.root.position.clone().add(new Vector3(0, 0.2, 0)), 1, HEX, 0.3, 0.06, -0.1);
    const p = this.ctx.player.pos;
    this.root.rotation.y = dampAngle(this.root.rotation.y, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 5, dt);
    const down = this.state === 'down';
    // Quick shallow beats; the lower pair a touch behind the upper. Down, they droop and twitch.
    for (const w of this.wings) {
      const beat = down ? Math.sin(this.t * 9) * 0.05 : Math.sin(this.t * 24 - (w.lower ? 0.6 : 0)) * 0.55;
      w.pivot.rotation.y = w.side * (0.3 + beat);
      w.pivot.rotation.x = down ? 0.5 : 0;
    }
    const legs = this.body.getObjectByName('legs');
    if (legs) legs.rotation.x = MathUtils.damp(legs.rotation.x, down ? 0 : 0.25 + Math.sin(this.t * 3) * 0.12, 6, dt);
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, down ? 1.4 : Math.sin(this.t * 1.3) * 0.12, 8, dt);
    this.glow.emissiveIntensity = this.state === 'windup' ? 3 + Math.sin(this.t * 40) : down ? 0.3 : 1;
    const hand = this.body.getObjectByName('hand')!;
    hand.scale.setScalar(this.state === 'windup' ? 1 + (0.75 - Math.max(0, this.timer)) * 2.2 : 0.45);
    const aura = this.body.getObjectByName('aura') as Sprite | undefined;
    if (aura) (aura.material as SpriteMaterial).opacity = down ? 0.12 : this.state === 'windup' ? 0.55 : 0.3;
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.3, 0));
  }
}

// ---------------------------------------------------------------- Hexling model

let wingTexture: CanvasTexture | null = null;

/** Moth-and-dragonfly wing: violet into teal, dark veins fanning from the root, an eye-spot, a tattered edge. */
function hexWingTexture(): CanvasTexture {
  if (wingTexture) return wingTexture;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  // UV (0, 0.5) is the root, at the left middle.
  const grad = g.createRadialGradient(0, S / 2, 4, 0, S / 2, S);
  // Violet at the root into bright blue and pale cyan at the tips, like a dragonfly's.
  grad.addColorStop(0, 'rgba(120,40,200,0.95)');
  grad.addColorStop(0.3, 'rgba(130,90,240,0.85)');
  grad.addColorStop(0.65, 'rgba(90,170,250,0.75)');
  grad.addColorStop(1, 'rgba(170,230,255,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // Veins.
  g.strokeStyle = 'rgba(30,20,70,0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8;
    g.lineWidth = 3.5 - i * 0.2;
    g.beginPath();
    g.moveTo(0, S / 2);
    g.quadraticCurveTo(S * 0.45, S / 2 + Math.sin(a) * S * 0.25, S * Math.cos(a * 0.6), S / 2 + Math.sin(a) * S * 0.62);
    g.stroke();
  }
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(30,20,70,0.5)';
  for (let r = 0.35; r < 1; r += 0.2) {
    g.beginPath();
    g.arc(0, S / 2, S * r, -1, 1);
    g.stroke();
  }
  // Magenta spots dotted near the edge: a warning.
  for (const [fx, fy, r] of [
    [0.72, 0.36, 15],
    [0.86, 0.55, 11],
    [0.55, 0.7, 10],
    [0.42, 0.28, 8],
  ]) {
    const ex = S * fx;
    const ey = S * fy;
    g.fillStyle = 'rgba(40,10,60,0.95)';
    g.beginPath();
    g.arc(ex, ey, r + 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,70,200,1)';
    g.beginPath();
    g.arc(ex, ey, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,220,250,1)';
    g.beginPath();
    g.arc(ex + r * 0.25, ey - r * 0.25, r * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  // Ragged holes and nicks out of the edge.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * S * 0.5, S / 2 + Math.sin(a) * S * 0.5, 7 + ((i * 37) % 9), 0, Math.PI * 2);
    g.fill();
  }
  wingTexture = new CanvasTexture(c);
  wingTexture.colorSpace = SRGBColorSpace;
  return wingTexture;
}

/** A leaf-shaped wing in the XY plane, root at the origin, reaching along +x, UVs over its bounds. */
function wingGeometry(length: number, width: number, droop: number): BufferGeometry {
  const sh = new Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(length * 0.2, width * 0.9, length * 0.75, width * 1.0 + droop, length, width * 0.35 + droop);
  sh.bezierCurveTo(length * 1.04, -width * 0.05 + droop, length * 0.6, -width * 0.45, 0, 0);
  const geo = new ShapeGeometry(sh, 10);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const h = Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y));
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / length, 0.5 + pos.getY(i) / (2 * h));
  return geo;
}

/**
 * The bad fairy: slight and spiky. A dark bodice and a skirt of plum petals, thin dangling
 * legs, ashen-lilac skin, pointed ears, a wild crown of hair, glowing green eyes under a
 * frown, a crooked wand (its tip is the wind-up glow), four tattered wings and a faint aura.
 */
function buildHexling(body: Group, wings: { pivot: Group; side: number; lower: boolean }[], glow: MeshStandardMaterial): void {
  const mat = worldMaterial();
  // Dark violet skin, so the green eyes glare out of it.
  const SKIN = '#5a3a72';
  const add = (geo: BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): Mesh => {
    const m = part(geo, color, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    body.add(m);
    return m;
  };
  // Bodice and a collar of points.
  add(new CylinderGeometry(0.07, 0.1, 0.3, 7), '#3a1658', 0, 0.3, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(new ConeGeometry(0.035, 0.12, 4), '#7a2f7e', Math.sin(a) * 0.075, 0.46, Math.cos(a) * 0.075, Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2);
  }
  // A skirt of petals, alternating plum and magenta, flaring out and down.
  // Two layers, long and pointed, hanging down to a sting of a point: wasp more than flower.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const len = 0.5 + (i % 3) * 0.08;
    const geo = new ConeGeometry(0.08, len, 4).scale(1, 1, 0.4).rotateX(Math.PI).translate(0, -len * 0.42, 0).rotateX(-0.28 - (i % 2) * 0.1).rotateY(a);
    add(geo, i % 2 ? '#b0309a' : '#6a2090', 0, 0.17, 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const geo = new ConeGeometry(0.07, 0.32, 4).scale(1, 1, 0.4).rotateX(Math.PI).translate(0, -0.14, 0).rotateX(-0.75).rotateY(a);
    add(geo, '#d048b0', 0, 0.2, 0);
  }
  // Head: long-ish face, pointed chin, pointed ears.
  add(new SphereGeometry(0.13, 10, 8), SKIN, 0, 0.62, 0.0, 0, 0, 0, 0.92, 1.12, 0.95);
  add(new ConeGeometry(0.07, 0.12, 6), SKIN, 0, 0.5, 0.02, Math.PI, 0, 0);
  for (const side of [-1, 1]) {
    add(new ConeGeometry(0.035, 0.2, 4), SKIN, side * 0.14, 0.67, -0.01, 0, 0, -side * 1.15);
    // Slanted brows: she's cross.
    add(new BoxGeometry(0.07, 0.016, 0.02), '#2a1030', side * 0.05, 0.7, 0.115, 0, 0, side * 0.45);
  }
  add(new BoxGeometry(0.06, 0.012, 0.01), '#4a1838', 0, 0.55, 0.12, 0, 0, 0.1);
  // A wild crown of hair: spikes thrown back and up, and a little thorn tiara.
  for (let i = 0; i < 9; i++) {
    const a = -1.4 + (i / 8) * 2.8;
    const len = 0.22 + ((i * 7) % 4) * 0.05;
    add(new ConeGeometry(0.05, len, 5), i % 3 ? '#2b1236' : '#5a2266', Math.sin(a) * 0.08, 0.72 + Math.cos(a) * 0.03, -0.06, -0.9 + Math.cos(a) * 0.4, 0, -a * 0.75);
  }
  add(new SphereGeometry(0.135, 8, 6), '#2b1236', 0, 0.66, -0.035, 0, 0, 0, 1, 1.05, 0.95);
  // Antennae: two thin feelers arching up and out from the brow, tipped with a bead.
  for (const side of [-1, 1]) {
    add(new CylinderGeometry(0.007, 0.011, 0.2, 4), '#1a0c14', side * 0.06, 0.82, 0.03, -0.3, 0, -side * 0.4);
    add(new CylinderGeometry(0.005, 0.007, 0.12, 4), '#1a0c14', side * 0.13, 0.94, 0.0, 0.3, 0, -side * 1.0);
    add(new SphereGeometry(0.02, 5, 4), '#d048b0', side * 0.18, 0.97, -0.02);
  }
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + (i / 4) * 1.8;
    add(new ConeGeometry(0.018, 0.08, 4), '#1a0c14', Math.sin(a) * 0.11, 0.76, Math.cos(a) * 0.07, 0.2, 0, -a * 0.6);
  }
  // Arms: the left on her hip, the right holding the wand out in front.
  add(new CylinderGeometry(0.022, 0.026, 0.3, 5), SKIN, -0.13, 0.32, 0.02, 0, 0, 0.5);
  add(new CylinderGeometry(0.022, 0.026, 0.28, 5), SKIN, 0.12, 0.36, 0.1, -1.0, 0, -0.5);
  add(new CylinderGeometry(0.012, 0.016, 0.36, 4), '#3a2416', 0.19, 0.44, 0.27, -1.2, 0, -0.2);
  for (const side of [-1, 1]) add(new SphereGeometry(0.03, 5, 4), SKIN, side * (side < 0 ? 0.19 : 0.17), side < 0 ? 0.2 : 0.3, side < 0 ? 0.02 : 0.2);
  mergeChildren(body);

  // Legs dangle from under the skirt and swing a little as she flies (one group, so they swing together).
  const legs = new Group();
  legs.name = 'legs';
  legs.position.set(0, 0.06, 0);
  for (const side of [-1, 1]) {
    const leg = part(new CylinderGeometry(0.02, 0.026, 0.36, 5), '#241226', mat);
    leg.position.set(side * 0.045, -0.18, side * 0.03);
    leg.rotation.x = side * 0.15;
    const shoe = part(new ConeGeometry(0.03, 0.12, 5), '#120a10', mat);
    shoe.position.set(side * 0.045, -0.37, 0.04 + side * 0.03);
    shoe.rotation.x = Math.PI / 2 + 0.3;
    legs.add(leg, shoe);
  }
  mergeChildren(legs);
  body.add(legs);

  // Glowing eyes.
  const eyeMat = new MeshStandardMaterial({ color: '#e8ffb0', emissive: new Color('#a8f040'), emissiveIntensity: 2.2 });
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.026, 6, 4), eyeMat);
    eye.position.set(side * 0.05, 0.65, 0.115);
    eye.scale.set(1.4, 0.75, 0.6);
    eye.rotation.z = side * 0.3;
    body.add(eye);
  }
  // The wand's tip: the wind-up glow.
  const hand = new Mesh(new IcosahedronGeometry(0.08, 1), glow);
  hand.position.set(0.215, 0.52, 0.43);
  hand.name = 'hand';
  body.add(hand);

  // Four wings: big upper ones angled up, smaller lower ones angled down.
  const wingMat = new MeshBasicMaterial({ map: hexWingTexture(), transparent: true, side: DoubleSide, depthWrite: false, alphaTest: 0.04 });
  for (const lower of [false, true]) {
    for (const side of [-1, 1]) {
      // Long and narrow, dragonfly-like.
      const geo = lower ? wingGeometry(0.66, 0.24, -0.06) : wingGeometry(0.92, 0.34, 0.08);
      if (side < 0) geo.scale(-1, 1, 1);
      const wing = new Mesh(geo, wingMat);
      wing.rotation.z = side * (lower ? -0.55 : 0.4);
      const pivot = new Group();
      pivot.position.set(side * 0.03, lower ? 0.32 : 0.4, -0.08);
      pivot.add(wing);
      body.add(pivot);
      wings.push({ pivot, side, lower });
    }
  }

  // A soft violet aura, so she reads against dark stone.
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(200,120,255,0.7)');
  grad.addColorStop(1, 'rgba(200,120,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const aura = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.3 }));
  aura.name = 'aura';
  aura.position.set(0, 0.42, -0.05);
  aura.scale.setScalar(1.5);
  body.add(aura);
}

// ================================================================ Sootling

type SootState = 'idle' | 'windup' | 'dazed' | 'gone';

/** A soot-bomb: in the air, then fizzing on the ground until its fuse runs out. */
class SootBomb implements SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.45;
  readonly mesh: Group;
  private readonly fuseMat: MeshStandardMaterial;
  readonly pos: Vector3;
  readonly vel: Vector3;
  fuse: number;
  grounded = false;
  done = false;
  private t = 0;

  constructor(
    private ctx: WorldContext,
    from: Vector3,
    vel: Vector3,
    fuse: number,
    private onBlast: (at: Vector3) => void,
    /** Where a kick in this direction should send it (the thrower, if he's roughly that way). */
    private kickTarget: (dir: Vector3, from: Vector3) => Vector3 | null,
  ) {
    this.pos = from.clone();
    this.vel = vel.clone();
    this.fuse = fuse;
    this.mesh = new Group();
    const shell = new Mesh(new IcosahedronGeometry(0.26, 1), new MeshStandardMaterial({ color: '#2a2428', roughness: 0.7, flatShading: true }));
    this.fuseMat = new MeshStandardMaterial({ color: '#ffd27a', emissive: new Color('#ff8a3c'), emissiveIntensity: 2 });
    const spark = new Mesh(new SphereGeometry(0.07, 6, 4), this.fuseMat);
    spark.position.y = 0.3;
    const cord = new Mesh(new CylinderGeometry(0.02, 0.02, 0.14, 4), new MeshStandardMaterial({ color: '#c8b090' }));
    cord.position.y = 0.24;
    this.mesh.add(shell, cord, spark);
    this.mesh.position.copy(this.pos);
    ctx.scene.add(this.mesh);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.4);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos);
  }
  enabled(): boolean {
    return !this.done && this.grounded;
  }
  owns(): boolean {
    return false;
  }

  /** Knocked away, off in the direction of the hit (back at whoever threw it, with luck). */
  onSpell(hit: SpellHit): void {
    const d = new Vector3(hit.dir.x, 0, hit.dir.z).normalize();
    const target = this.kickTarget(d, this.pos);
    if (target) {
      // Kicked his way: it arcs back and lands on him, just as the fuse runs out.
      const flight = MathUtils.clamp(target.distanceTo(this.pos) / 12, 0.45, 1.1);
      this.vel.set((target.x - this.pos.x) / flight, (target.y - this.pos.y) / flight + 10 * flight, (target.z - this.pos.z) / flight);
      this.fuse = flight + 0.12;
    } else {
      this.vel.copy(d.multiplyScalar(10 + hit.charge * 5)).add(new Vector3(0, 5, 0));
      this.fuse = Math.max(this.fuse, 0.9);
    }
    this.grounded = false;
    this.ctx.events.emit('bombKick', { pos: this.pos.clone() });
  }

  update(dt: number): void {
    this.t += dt;
    this.fuse -= dt;
    if (!this.grounded) {
      this.vel.y -= 20 * dt;
      const step = this.vel.clone().multiplyScalar(dt);
      const hit = this.ctx.physics.raycast(this.pos, step.clone().normalize(), step.length() + 0.25, undefined, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
      if (hit) {
        // Lands (or thuds against a wall and drops).
        this.pos.copy(hit.point).add(new Vector3(0, 0.26, 0));
        if (hit.normal.y > 0.5) {
          this.grounded = true;
          this.vel.set(0, 0, 0);
          this.ctx.events.emit('bombLand', { pos: this.pos.clone() });
        } else {
          this.vel.set(hit.normal.x * 1.5, Math.min(this.vel.y, 0), hit.normal.z * 1.5);
        }
      } else {
        this.pos.add(step);
      }
      if (this.pos.y < -60) this.fuse = 0;
    }
    if (this.fuse <= 0) this.blast();
  }

  private blast(): void {
    this.done = true;
    this.mesh.removeFromParent();
    this.marker.sprite.removeFromParent();
    this.ctx.targets.remove(this);
    this.onBlast(this.pos.clone());
  }

  frame(dt: number): void {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y += dt * (this.grounded ? 1 : 8);
    // The fuse blinks faster as it burns down.
    const rate = this.fuse < 0.8 ? 18 : this.fuse < 1.6 ? 9 : 4;
    this.fuseMat.emissiveIntensity = Math.sin(this.t * rate) > 0 ? 3.2 : 0.6;
    if (Math.random() < dt * 16) this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 0.32, 0)), 1, SPARK, 0.8, 0.05, 0.3);
    this.marker.sprite.position.copy(this.pos).add(new Vector3(0, 0.7, 0));
  }
}

export class Sootling implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly arm = new Group();
  private readonly eyeMat: MeshStandardMaterial;
  readonly pos: Vector3;
  private readonly home: Vector3;
  private readonly prev: Vector3;
  private readonly bombs: SootBomb[] = [];
  private state: SootState = 'idle';
  private timer = 0;
  private reload: number;
  private t = Math.random() * 10;
  private facing = 0;
  private hop = 0;
  private readonly smoke: Mesh[] = [];
  /** The model's smoke spire (when it has one), swaying as a whole. */
  private readonly spire = new Group();
  private readonly smokeMat = new MeshStandardMaterial({ color: '#4a4246', roughness: 1, flatShading: true, transparent: true, opacity: 0.85 });

  constructor(
    private spec: SpecOf<'sootling'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1], spec.pos[2]);
    this.home = this.pos.clone();
    this.prev = this.pos.clone();
    this.reload = 1 + Math.random() * 1.5;
    this.facing = spec.yaw ?? 0;
    const mat = worldMaterial();
    this.eyeMat = new MeshStandardMaterial({ color: '#ffd080', emissive: new Color('#ff9a20'), emissiveIntensity: 1.2 });
    // A smoke spirit: a round lump of faceted soot with ember cracks, glowing eyes, and a curl
    // of smoke rising off the top of it. It conjures its bombs out of a smoky tendril.
    const blob = part(new IcosahedronGeometry(0.5, 1), '#3a3437', mat);
    blob.scale.set(1, 0.9, 0.95);
    blob.position.y = 0.52;
    const brow = part(new IcosahedronGeometry(0.2, 0), '#36302f', mat);
    brow.scale.set(1.8, 0.45, 0.8);
    brow.position.set(0, 0.74, 0.32);
    // Stubby little feet under it.
    for (const side of [-1, 1]) {
      const foot = part(new IcosahedronGeometry(0.11, 0), '#1e1a1c', mat);
      foot.scale.set(1, 0.6, 1.3);
      foot.position.set(side * 0.2, 0.05, 0.12);
      this.body.add(foot);
    }
    this.body.add(blob, brow);
    mergeChildren(this.body);
    // Embers glowing through the soot: specks set into its surface, mostly low down.
    const ember = new MeshStandardMaterial({ color: '#ff8a2a', emissive: new Color('#ff6a10'), emissiveIntensity: 1.6 });
    for (const [a, h, r] of [
      [0.5, 0.18, 0.045],
      [1.1, 0.1, 0.035],
      [-0.4, 0.22, 0.04],
      [-1.0, 0.12, 0.03],
      [2.4, 0.3, 0.035],
      [-2.2, 0.26, 0.04],
      [0.1, 0.06, 0.03],
    ]) {
      const dir = new Vector3(Math.sin(a), h * 2 - 0.6, Math.cos(a)).normalize();
      const c = new Mesh(new IcosahedronGeometry(r * 0.65, 0), ember);
      c.position.set(dir.x * 0.47, 0.46 + dir.y * 0.42, dir.z * 0.45);
      this.body.add(c);
    }
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.07, 8, 6), this.eyeMat);
      eye.position.set(side * 0.15, 0.6, 0.41);
      eye.scale.set(1.2, 1, 0.55);
      eye.rotation.z = side * -0.3;
      this.body.add(eye);
    }
    // The smoke curl: a jagged flame of faceted spikes, thinning as it rises, swaying.
    for (let i = 0; i < 6; i++) {
      const puff = new Mesh(new ConeGeometry(0.22 - i * 0.032, 0.36, 5), this.smokeMat);
      this.smoke.push(puff);
      this.body.add(puff);
    }
    // The tendril it conjures a bomb on (the wind-up): smoke puffs, a bomb at the tip.
    for (let i = 0; i < 4; i++) {
      const puff = new Mesh(new IcosahedronGeometry(0.11 - i * 0.015, 0), this.smokeMat);
      puff.position.y = 0.08 + i * 0.13;
      this.arm.add(puff);
    }
    const held = new Mesh(new IcosahedronGeometry(0.2, 1), new MeshStandardMaterial({ color: '#2a2428', flatShading: true }));
    held.position.y = 0.62;
    held.name = 'held';
    this.arm.add(held);
    this.arm.position.set(0.34, 0.5, 0.05);
    this.body.add(this.arm);
    this.root.add(this.body);
    const model = modelIslands('sootling');
    if (model) {
      // The smoke spire sways as one, from the top of its head; the eyes keep their own glow.
      this.smoke.length = 0;
      this.spire.position.set(0, 0.86, -0.05);
      this.body.add(this.spire);
      const keep: Object3D[] = [];
      this.arm.traverse((o) => keep.push(o));
      dressWith(this.root, model, new Matrix4(), (i) => {
        if (i.mat === 'glow_ff9a14') return { part: this.body, material: this.eyeMat };
        if (i.center.y > 0.86 && Math.abs(i.center.x) < 0.3) return { part: this.spire };
        return { part: this.body };
      }, keep);
    }
    this.root.traverse((o) => (o.castShadow = o instanceof Mesh && !(o.material instanceof MeshBasicMaterial)));
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(0.5).setTranslation(this.pos.x, this.pos.y + 0.6, this.pos.z).setSensor(true));
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.55);
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.7, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state === 'dazed') {
      this.gone();
      return;
    }
    // Caught mid-throw: the bomb drops at his feet.
    if (this.state === 'windup') this.lob(this.pos.clone().add(new Vector3(Math.sin(this.facing) * 0.4, 0, Math.cos(this.facing) * 0.4)), 1.4, 0.5);
    this.state = 'dazed';
    this.timer = 2.6 + hit.charge * 1.5;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private gone(): void {
    if (this.state === 'gone') return;
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    banish(this.ctx, this.spec, this.id, this.pos.clone().add(new Vector3(0, 0.6, 0)));
  }

  /** Throws a bomb to land at `at` after `flight` seconds. */
  private lob(at: Vector3, fuse: number, flight: number): void {
    const from = this.pos.clone().add(new Vector3(0, 1.2, 0));
    const g = 20;
    const vel = new Vector3((at.x - from.x) / flight, (at.y - from.y) / flight + 0.5 * g * flight, (at.z - from.z) / flight);
    this.bombs.push(
      new SootBomb(this.ctx, from, vel, fuse + flight, (p) => this.blast(p), (dir, at) => {
        if (this.state === 'gone') return null;
        const to = this.pos.clone().sub(at);
        to.y = 0;
        const dist = to.length();
        return dist < 16 && to.normalize().dot(dir) > Math.cos(0.45) ? this.pos.clone().add(new Vector3(0, 0.3, 0)) : null;
      }),
    );
    this.ctx.events.emit('bombThrow', { pos: from.clone() });
  }

  /** Everything in reach gets knocked about: you, Gnarlings, and the thrower himself. */
  private blast(at: Vector3): void {
    const r = this.spec.blastRadius ?? 2.4;
    this.ctx.events.emit('bombBlast', { pos: at.clone() });
    this.ctx.fx.burst(at.clone(), 30, BLAST, 5, 0.2, 0.6);
    this.ctx.fx.burst(at.clone().add(new Vector3(0, 0.4, 0)), 22, SOOT, 2.4, 0.3, -0.2);
    const p = this.ctx.player.pos;
    if (p.distanceTo(at) < r && this.ctx.player.mode !== 'reset') this.ctx.health.damage(p.distanceTo(at) < r * 0.45 ? 2 : 1, at.clone());
    for (const c of this.ctx.creatures) if (c.pos.distanceTo(at) < r) c.bitten(at);
    if (this.state !== 'gone' && this.pos.clone().add(new Vector3(0, 0.6, 0)).distanceTo(at) < r) this.gone();
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      this.bombs[i].update(dt);
      if (this.bombs[i].done) this.bombs.splice(i, 1);
    }
    if (this.state === 'gone') return;
    const p = this.ctx.player.pos;
    switch (this.state) {
      case 'idle': {
        // Shuffles about his spot, then turns to throw when he sees you.
        const wander = this.spec.wander ?? 1.2;
        this.pos.x = this.home.x + Math.sin(this.t * 0.7) * wander;
        this.pos.z = this.home.z + Math.sin(this.t * 0.45) * wander * 0.6;
        this.reload -= dt;
        const range = this.spec.range ?? 16;
        const eye = this.pos.clone().add(new Vector3(0, 1, 0));
        if (this.reload <= 0 && p.distanceTo(this.pos) < range && this.ctx.player.mode !== 'reset' && canSee(this.ctx, eye, p, this.collider)) {
          this.state = 'windup';
          this.timer = 0.8;
        }
        break;
      }
      case 'windup':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          // Aims where you're going, give or take.
          const flight = MathUtils.clamp(p.distanceTo(this.pos) / 9, 0.6, 1.4);
          const at = p.clone().addScaledVector(this.ctx.player.vel, flight * 0.8);
          at.y = p.y - 0.9;
          at.x += (Math.random() - 0.5) * 1.2;
          at.z += (Math.random() - 0.5) * 1.2;
          this.lob(at, this.spec.fuse ?? 1.6, flight);
          this.state = 'idle';
          this.reload = this.spec.interval ?? 3;
        }
        break;
      case 'dazed':
        if (this.timer <= 0) {
          this.state = 'idle';
          this.reload = 1.2;
        }
        break;
    }
    this.collider.setTranslation(new Vector3(this.pos.x, this.pos.y + 0.6, this.pos.z));
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const b of this.bombs) b.frame(dt);
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 6, dt);
    const dazed = this.state === 'dazed';
    const windup = this.state === 'windup';
    // It bobs and breathes rather than hops: a smoke spirit sits on its own soot.
    this.hop += dt * (dazed ? 1 : windup ? 7 : 2.4);
    this.body.position.y = dazed ? 0 : Math.abs(Math.sin(this.hop)) * (windup ? 0.08 : 0.04);
    const breathe = 1 + Math.sin(this.hop * 0.8) * 0.03;
    this.body.scale.set(breathe, 2 - breathe, breathe);
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, dazed ? 0.9 : 0, 8, dt);
    // The smoke curl sways up off its head; dazed, it slumps and thins.
    for (const [i, puff] of this.smoke.entries()) {
      const k = i / this.smoke.length;
      const sway = Math.sin(this.t * 2.2 - i * 0.7) * (0.04 + k * 0.22);
      puff.position.set(sway + Math.sin(k * 3) * 0.12, 0.92 + i * (dazed ? 0.12 : 0.21), -0.08 - Math.sin(k * Math.PI) * 0.18 + Math.cos(this.t * 1.7 - i) * k * 0.08);
      // Each spike leans the other way from the one below: a zigzag flame.
      puff.rotation.set(Math.sin(this.t * 1.3 + i) * 0.15, i * 0.9, (i % 2 ? 0.4 : -0.4) + sway * 1.5);
    }
    this.smokeMat.opacity = dazed ? 0.45 : 0.85;
    this.spire.rotation.z = Math.sin(this.t * 2.2) * (dazed ? 0.25 : 0.12);
    this.spire.rotation.x = Math.cos(this.t * 1.7) * 0.08 + (dazed ? 0.3 : 0);
    if (!dazed && Math.random() < dt * 5) {
      const top = (this.smoke[this.smoke.length - 1] ?? this.spire).getWorldPosition(new Vector3()).add(new Vector3(0, this.smoke.length ? 0 : 0.9, 0));
      this.ctx.fx.burst(top, 1, SPARK, 0.4, 0.05, 0.8);
    }
    // The wind-up: the tendril rises over its head and a bomb swells at the tip.
    this.arm.rotation.x = MathUtils.damp(this.arm.rotation.x, windup ? -2.4 : 0.3, 10, dt);
    this.arm.rotation.z = MathUtils.damp(this.arm.rotation.z, windup ? 0.3 : -0.6, 10, dt);
    const held = this.arm.getObjectByName('held')!;
    held.visible = windup;
    // The tendril only forms to throw; the rest of the time it's just a round lump of soot.
    const reach = MathUtils.damp(this.arm.scale.y, windup ? 1 : 0.01, 8, dt);
    this.arm.scale.set(reach, reach, reach);
    this.arm.visible = reach > 0.05;
    held.scale.setScalar(windup ? MathUtils.damp(held.scale.x, 1, 6, dt) : 0.1);
    this.eyeMat.emissiveIntensity = dazed ? 0.2 : windup ? 2.6 : 1.2;
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.75, 0));
  }
}
