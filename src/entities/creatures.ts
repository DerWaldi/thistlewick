import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, MathUtils, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dampAngle } from '../player/controller';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import { dressWith, modelIslands, type Island } from './models';
import type { Entity, SpecOf, WorldContext } from './types';

/** A vertex-coloured mesh in a shared material, so a creature's parts merge into few draw calls. */
function part(geo: THREE_Geo, color: string, mat: MeshStandardMaterial): Mesh {
  const g = geo.index ? geo.toNonIndexed() : geo;
  return new Mesh(paint(g, color, true), mat);
}
type THREE_Geo = BoxGeometry | ConeGeometry | CylinderGeometry | IcosahedronGeometry | SphereGeometry;

/** Something that a Snapweed's bite (or an exploding thing) can hurt besides the player. */
export interface Creature {
  readonly pos: Vector3;
  /** Bitten by something at `from`: the creature reacts (Gnarlings are banished). */
  bitten(from: Vector3): void;
}

const FLAME = new Color('#ff8a3c');
const FROST = new Color('#e8f8ff');
const flatMat = (color: string, emissive?: string, intensity = 0) =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, emissive: new Color(emissive ?? '#000000'), emissiveIntensity: intensity });

/** Pays out sweets the first time a placed creature is beaten (never again: nothing is farmable). */
function loot(ctx: WorldContext, id: string, at: Vector3, fizz = 3): void {
  const flag = `looted:${id}`;
  if (ctx.state.flags.has(flag)) return;
  ctx.state.flags.add(flag);
  ctx.sweets.burst('fizzwort', at, fizz);
  ctx.sweets.burst('bramble', at, 1);
}

type WeedState = 'idle' | 'windup' | 'snap' | 'rest' | 'burning' | 'gone';

/**
 * Snapweed: a rooted, biting plant. Anything that comes within `radius` (you, and Gnarlings
 * too) makes it rear back, jaws wide (the tell), then snap: everything still in reach gets
 * bitten. Thwackwort just bounces off; Cindersnap burns it away for good.
 */
export class Snapweed implements Entity, SpellTarget {
  readonly spell = 'cindersnap' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly stem = new Group();
  private readonly head = new Group();
  private readonly jawTop = new Group();
  private readonly jawBottom = new Group();
  private readonly fire: Mesh;
  private readonly base: Vector3;
  private readonly headPos = new Vector3();
  private state: WeedState = 'idle';
  private timer = 0;
  private time = Math.random() * 10;
  private lean = 0;
  private faceYaw = 0;
  private readonly reach: number;

  constructor(
    private spec: SpecOf<'snapweed'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.base = new Vector3(...spec.pos);
    this.reach = spec.radius ?? 2.4;
    const mat = worldMaterial();
    // A rosette of long spiky leaves, two rings, red-tipped, and roots splaying from the base.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const len = 0.8 + (i % 3) * 0.18;
      const leaf = part(new ConeGeometry(0.16, len, 4).scale(1, 1, 0.45), i % 2 ? '#4f8a34' : '#62a03e', mat);
      const at = new Vector3(Math.cos(a) * 0.26, 0.2 + len * 0.12, Math.sin(a) * 0.26);
      const dir = new Vector3(Math.cos(a) * 3, 2.2 + (i % 2) * 0.6, Math.sin(a) * 3).sub(at).normalize();
      leaf.position.copy(at);
      leaf.lookAt(at.clone().add(dir));
      leaf.rotateX(Math.PI / 2);
      this.root.add(leaf);
      // A red tip just past the leaf's point.
      const tip = part(new ConeGeometry(0.035, 0.12, 4), '#c8384a', mat);
      tip.position.copy(at).addScaledVector(dir, len / 2 - 0.02);
      tip.lookAt(tip.position.clone().add(dir));
      tip.rotateX(Math.PI / 2);
      this.root.add(tip);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const root = part(new ConeGeometry(0.06, 0.55, 4), '#6b4a2e', mat);
      root.position.set(Math.cos(a) * 0.22, 0.05, Math.sin(a) * 0.22);
      root.lookAt(new Vector3(Math.cos(a) * 2, -0.3, Math.sin(a) * 2));
      root.rotateX(Math.PI / 2);
      this.root.add(root);
    }
    // A thick stem with thorns, bending a little.
    const stalk = part(new CylinderGeometry(0.08, 0.13, 1.3, 6), '#4f8a34', mat);
    stalk.position.y = 0.65;
    stalk.rotation.z = 0.06;
    this.stem.add(stalk);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.3;
      const thorn = part(new ConeGeometry(0.03, 0.14, 4), '#b8384a', mat);
      thorn.position.set(Math.cos(a) * 0.1, 0.3 + i * 0.18, Math.sin(a) * 0.1);
      thorn.lookAt(new Vector3(Math.cos(a) * 2, 0.5 + i * 0.18, Math.sin(a) * 2));
      thorn.rotateX(Math.PI / 2);
      this.stem.add(thorn);
    }
    // The head: two faceted crimson jaw halves (a pod, like a bud when shut), each lined with fangs.
    for (const [jaw, sign] of [
      [this.jawTop, 1],
      [this.jawBottom, -1],
    ] as [Group, number][]) {
      const shell = part(new SphereGeometry(0.44, 8, 4, 0, Math.PI * 2, sign > 0 ? 0 : Math.PI / 2, Math.PI / 2).scale(1, sign > 0 ? 1.25 : 0.9, 1.05), sign > 0 ? '#b8243a' : '#a01e30', mat);
      shell.position.z = 0.32;
      const inner = part(new CylinderGeometry(0.4, 0.4, 0.03, 8), '#5a1020', mat);
      inner.position.set(0, -sign * 0.005, 0.32);
      jaw.add(shell, inner);
      // A ridge of spikes over the top of the pod.
      if (sign > 0) {
        for (let i = 0; i < 4; i++) {
          const ridge = part(new ConeGeometry(0.04, 0.14, 4), '#d84a5a', mat);
          ridge.position.set(0, 0.5 - i * 0.04, 0.12 + i * 0.13);
          ridge.rotation.x = -0.6 + i * 0.35;
          jaw.add(ridge);
        }
      }
      for (let t = 0; t < 10; t++) {
        const a = (t / 10) * Math.PI * 2;
        const front = Math.sin(a) > 0.2;
        const tooth = part(new ConeGeometry(front ? 0.055 : 0.045, front ? 0.2 : 0.14, 4), '#f4ecd8', mat);
        tooth.position.set(Math.cos(a) * 0.36, -sign * 0.07, 0.32 + Math.sin(a) * 0.36);
        if (sign > 0) tooth.rotation.x = Math.PI;
        jaw.add(tooth);
      }
      mergeChildren(jaw);
      this.head.add(jaw);
    }
    this.head.position.y = 1.35;
    this.head.position.z = -0.3;
    this.stem.add(this.head);
    this.root.add(this.stem);
    this.fire = new Mesh(new ConeGeometry(0.5, 1.4, 6), new MeshStandardMaterial({ color: '#ffb347', emissive: new Color('#ff7a1a'), emissiveIntensity: 2, transparent: true, opacity: 0.85 }));
    this.fire.position.y = 0.8;
    this.fire.visible = false;
    this.root.add(this.fire);
    mergeChildren(this.stem, [this.head]);
    mergeChildren(this.root, [this.stem, this.fire]);
    const model = modelIslands('snapweed');
    if (model) {
      // The model's jaws hinge at the back of its head, 1.55 m up; dressed at 0.9 scale.
      const S = 0.9;
      this.head.position.set(0, 1.55 * S, -0.15 * S);
      const head = (i: Island) => i.min.y > 1.2 && ['mat_a40e20', 'mat_3a0610', 'mat_f6ecd0', 'mat_d0162c', 'mat_e83244'].includes(i.mat);
      dressWith(this.root, model, new Matrix4().makeScale(S, S, S), (i) => {
        const near = Math.hypot(i.center.x, i.center.z) < 0.22;
        if (head(i)) return { part: i.center.y >= 1.53 ? this.jawTop : this.jawBottom };
        if (i.mat === 'mat_3f9a22' || i.mat === 'mat_2f7a18' || i.center.y > 1.1 || (i.mat === 'mat_d02030' && near && i.center.y > 0.4)) return { part: this.stem };
        return { part: this.root };
      }, [this.fire]);
    }
    this.root.position.copy(this.base);
    this.root.traverse((o) => (o.castShadow = true));
    ctx.scene.add(this.root);
    this.collider = ctx.physics.addStaticCylinder(this.base.clone().add(new Vector3(0, 0.75, 0)), 0.75, 0.35, { noGrab: true });
    this.marker = new RuneMarker(ctx.scene, 'cindersnap', 0.55);
    this.marker.sprite.position.copy(this.base).add(new Vector3(0, 2.4, 0));
    ctx.targets.add(this);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.base).add(new Vector3(0, 1.2, 0));
  }
  enabled(): boolean {
    return this.state !== 'burning' && this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    if (!this.enabled()) return;
    this.state = 'burning';
    this.timer = 1.2;
    this.fire.visible = true;
    this.ctx.events.emit('burn', { pos: this.base.clone().add(new Vector3(0, 1, 0)) });
  }

  private inReach(p: Vector3): boolean {
    return Math.hypot(p.x - this.base.x, p.z - this.base.z) < this.reach && p.y > this.base.y - 1 && p.y < this.base.y + 2.8;
  }

  private someoneNear(): Vector3 | null {
    const p = this.ctx.player.pos;
    if (this.inReach(p) && this.ctx.player.mode !== 'reset') return p;
    for (const c of this.ctx.creatures) if (this.inReach(c.pos)) return c.pos;
    return null;
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    switch (this.state) {
      case 'idle': {
        const who = this.someoneNear();
        if (who) {
          this.faceYaw = Math.atan2(who.x - this.base.x, who.z - this.base.z);
          this.state = 'windup';
          this.timer = 0.55;
          this.ctx.events.emit('weedNotice', { pos: this.base.clone() });
        }
        break;
      }
      case 'windup': {
        const who = this.someoneNear();
        if (who) this.faceYaw = Math.atan2(who.x - this.base.x, who.z - this.base.z);
        if (this.timer <= 0) {
          this.state = 'snap';
          this.timer = 0.18;
          this.bite();
        }
        break;
      }
      case 'snap':
        if (this.timer <= 0) {
          this.state = 'rest';
          this.timer = 0.9;
        }
        break;
      case 'rest':
        if (this.timer <= 0) this.state = 'idle';
        break;
      case 'burning':
        if (Math.random() < dt * 14) {
          const s = this.base.clone().add(new Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8));
          this.ctx.fx.burst(s, 2, Math.random() < 0.6 ? FLAME : new Color('#5a4a40'), 1.6, 0.12, 0.8);
        }
        if (this.timer <= 0) this.wither();
        break;
    }
  }

  private bite(): void {
    const head = this.base.clone().add(new Vector3(Math.sin(this.faceYaw) * 1.2, 1.2, Math.cos(this.faceYaw) * 1.2));
    this.ctx.events.emit('weedBite', { pos: head });
    if (this.inReach(this.ctx.player.pos)) this.ctx.health.damage(1, this.base.clone().add(new Vector3(0, 1, 0)));
    for (const c of [...this.ctx.creatures]) if (this.inReach(c.pos)) c.bitten(this.base);
  }

  private wither(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    const at = this.base.clone().add(new Vector3(0, 0.8, 0));
    this.ctx.fx.burst(at, 20, new Color('#5a4a40'), 2.4, 0.16, 1.4);
    if (this.spec.id) {
      this.ctx.signals.set(this.spec.id, true);
      if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    }
    loot(this.ctx, this.id, at, 2);
  }

  /** Something to bite is about: it opens up, the jaws twitching. */
  private get awake(): boolean {
    const p = this.ctx.player.pos;
    return Math.hypot(p.x - this.base.x, p.z - this.base.z) < this.reach * 3;
  }

  frameUpdate(dt: number): void {
    if (this.state === 'gone') return;
    // Face whoever it's after; sway when idle; rear back in the windup, lunge on the snap.
    const target = this.state === 'idle' || this.state === 'rest' ? Math.sin(this.time * 0.7) * 0.6 : this.faceYaw;
    this.stem.rotation.y += MathUtils.clamp(((target - this.stem.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -dt * 8, dt * 8);
    const wantLean = this.state === 'windup' ? -0.45 : this.state === 'snap' ? 0.75 : this.state === 'burning' ? 0.9 : Math.sin(this.time * 1.3) * 0.08;
    this.lean = MathUtils.damp(this.lean, wantLean, this.state === 'snap' ? 30 : 10, dt);
    this.stem.rotation.x = this.lean;
    // Shut like a bud while nothing's near; jaws apart (and twitching) once it's after you.
    const open = this.state === 'windup' ? 0.85 : this.state === 'snap' ? 0 : this.state === 'idle' ? (this.awake ? 0.35 + Math.abs(Math.sin(this.time * 3)) * 0.12 : 0.02) : 0.25;
    this.jawTop.rotation.x = MathUtils.damp(this.jawTop.rotation.x, -open, 20, dt);
    this.jawBottom.rotation.x = MathUtils.damp(this.jawBottom.rotation.x, open * 0.6, 20, dt);
    if (this.state === 'burning') {
      const s = Math.max(0.1, this.timer / 1.2);
      this.stem.scale.set(1, s, 1);
      this.fire.scale.setScalar(0.8 + Math.sin(this.time * 30) * 0.15);
    }
    this.headPos.copy(this.base);
  }
}

type CrabState = 'walk' | 'aim' | 'stunned' | 'frozen' | 'gone';

/** One fireball in flight. */
interface Fireball {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
}

/**
 * Ember Crab: scuttles sideways along its patrol and, whenever it can see you, stops and
 * lobs a fireball. Thwackwort flips it over for a few seconds; Rimewhistle freezes it into
 * a block of ice (solid: you can stand on it) and a Thwackwort then shatters it for good.
 * Until you know Rimewhistle, Thwackwort is all you've got.
 */
export class EmberCrab implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private iceCollider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly shellMat: MeshStandardMaterial;
  private readonly ice: Mesh;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private readonly axis: Vector3;
  private readonly balls: Fireball[] = [];
  private readonly ballMat = new MeshStandardMaterial({ color: '#ffb347', emissive: new Color('#ff6a1a'), emissiveIntensity: 2.4 });
  private state: CrabState = 'walk';
  private timer = 0;
  private reload = 1.5 + Math.random();
  private along = 0;
  private dir = 1;
  private facing = 0;
  private time = Math.random() * 10;
  private readonly legs: { g: Group; side: number; i: number }[] = [];
  private readonly claws: { arm: Group; jaw: Group; side: number }[] = [];
  private readonly flames: Object3D[] = [];

  constructor(
    private spec: SpecOf<'emberCrab'>,
    private ctx: WorldContext,
    private readonly id: string,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + 0.35, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    const yaw = spec.yaw ?? 0;
    this.axis = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.facing = yaw;
    this.shellMat = worldMaterial();
    this.shellMat.emissive = new Color('#ff5a1a');
    const glowMat = flatMat('#ffd27a', '#ff8a3c', 1.5);
    const sm = this.shellMat;
    // A lump of red rock for a shell, with lava glowing along every seam between its facets.
    const shellGeo = new IcosahedronGeometry(0.55, 1).scale(1.15, 0.62, 1);
    const shell = part(shellGeo.clone(), '#8a2814', sm);
    shell.position.y = 0.05;
    this.body.add(shell);
    {
      const pos = shellGeo.getAttribute('position');
      const seen = new Set<string>();
      const seams: BufferGeometry[] = [];
      const a = new Vector3();
      const b = new Vector3();
      for (let i = 0; i < pos.count; i += 3) {
        for (const [u, v] of [
          [i, i + 1],
          [i + 1, i + 2],
          [i + 2, i],
        ]) {
          a.fromBufferAttribute(pos, u);
          b.fromBufferAttribute(pos, v);
          if (a.y < -0.05 && b.y < -0.05) continue;
          const key = [a, b].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`).sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          // Not every seam: an irregular web of cracks, not a cage.
          if ((seen.size * 7919) % 10 < 4) continue;
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const len = a.distanceTo(b);
          const g = new BoxGeometry(0.02, 0.02, len * 0.95);
          g.lookAt(b.clone().sub(a));
          g.translate(mid.x * 1.015, mid.y * 1.015 + 0.05, mid.z * 1.015);
          seams.push(g);
        }
      }
      this.body.add(new Mesh(mergeGeometries(seams)!, flatMat('#ffb040', '#ff6a10', 1.1)));
    }
    // Eye stalks, each tipped with a little candle flame.
    for (const side of [-1, 1]) {
      const stalk = part(new CylinderGeometry(0.035, 0.045, 0.34, 5), '#5a2010', sm);
      stalk.position.set(side * 0.13, 0.48, 0.32);
      stalk.rotation.z = side * -0.12;
      this.body.add(stalk);
      const flame = new Mesh(new ConeGeometry(0.06, 0.18, 5), glowMat);
      flame.position.set(side * 0.15, 0.73, 0.32);
      const bulb = new Mesh(new SphereGeometry(0.06, 6, 4), glowMat);
      bulb.position.set(side * 0.15, 0.64, 0.32);
      this.flames.push(flame);
      this.body.add(flame, bulb);
    }
    // Three jointed legs a side, each its own pivot so it can scuttle.
    for (const side of [-1, 1]) {
      for (let l = 0; l < 3; l++) {
        const leg = new Group();
        leg.position.set(side * 0.5, 0.0, -0.22 + l * 0.22);
        leg.rotation.y = side * (l - 1) * -0.35;
        const upper = part(new CylinderGeometry(0.04, 0.05, 0.36, 5), '#8a2a14', sm);
        upper.position.set(side * 0.16, 0.08, 0);
        upper.rotation.z = side * -1.0;
        const lower = part(new ConeGeometry(0.045, 0.42, 5), '#6a2010', sm);
        lower.position.set(side * 0.36, -0.1, 0);
        lower.rotation.z = side * -2.7;
        leg.add(upper, lower);
        mergeChildren(leg);
        this.legs.push({ g: leg, side, i: l });
        this.body.add(leg);
      }
    }
    // Two big pincers on jointed arms: a fixed upper jaw and a lower one that snaps.
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.42, 0.02, 0.36);
      const fore = part(new CylinderGeometry(0.06, 0.08, 0.32, 5), '#8a2a14', sm);
      fore.position.set(side * 0.08, 0, 0.12);
      fore.rotation.set(Math.PI / 2, 0, side * 0.5);
      const palm = part(new IcosahedronGeometry(0.17, 0), '#c0441e', sm);
      palm.scale.set(1, 0.8, 1.2);
      palm.position.set(side * 0.18, 0.02, 0.32);
      const top = part(new ConeGeometry(0.1, 0.36, 5), '#c84a20', sm);
      top.position.set(side * 0.16, 0.08, 0.55);
      top.rotation.set(Math.PI / 2 - 0.25, 0, 0);
      arm.add(fore, palm, top);
      mergeChildren(arm);
      const jaw = new Group();
      jaw.position.set(side * 0.18, -0.02, 0.38);
      const low = part(new ConeGeometry(0.08, 0.3, 5), '#a83a1a', sm);
      low.position.set(0, -0.02, 0.15);
      low.rotation.set(Math.PI / 2 + 0.2, 0, 0);
      jaw.add(low);
      arm.add(jaw);
      this.claws.push({ arm, jaw, side });
      this.body.add(arm);
    }
    mergeChildren(this.body, [...this.legs.map((l) => l.g), ...this.claws.map((c) => c.arm), ...this.flames]);
    this.root.add(this.body);
    this.ice = new Mesh(new BoxGeometry(1.6, 1, 1.4), new MeshStandardMaterial({ color: '#cfeefa', transparent: true, opacity: 0.6, roughness: 0.1, emissive: new Color('#5aaed0'), emissiveIntensity: 0.3 }));
    this.ice.position.y = 0.15;
    this.ice.visible = false;
    this.root.add(this.ice);
    this.root.traverse((o) => (o.castShadow = true));
    const model = modelIslands('embercrab');
    if (model) this.wear(model);
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    // A sensor while alive (you walk into it and get pinched, like Gnarlings), a solid block of
    // ice while frozen.
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.3, 0.5).setTranslation(this.pos.x, this.pos.y, this.pos.z).setSensor(true));
    this.iceCollider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 0.5, 0.7).setTranslation(this.pos.x, this.pos.y + 0.15, this.pos.z));
    // Rough, frosted ice: slippery footing on a block this small would make it a slide, not a step.
    ctx.physics.setInfo(this.iceCollider, { temporary: true, noGrab: true });
    this.iceCollider.setEnabled(false);
    this.marker = new RuneMarker(ctx.scene, this.spell, 0.55);
    ctx.targets.add(this);
  }

  /** Rimewhistle while it's live (if you know it), Thwackwort to flip it or shatter the ice. */
  get spell(): 'thwackwort' | 'rimewhistle' {
    if (this.state === 'frozen') return 'thwackwort';
    return this.ctx.state.knows('rimewhistle') && this.state !== 'stunned' ? 'rimewhistle' : 'thwackwort';
  }

  /**
   * Wear the lava-crab model (dressed at 0.75, its feet on the ground: the crab's origin is
   * 0.35 up). Legs go to their pivots by side and by front-to-back slot, pincers to the arms
   * with their lower blades on the jaws, the flames on the eye stalks to groups that flicker.
   */
  private wear(model: Island[]): void {
    const S = 0.75;
    const toRoot = new Matrix4().makeTranslation(0, -0.35, 0).multiply(new Matrix4().makeScale(S, S, S));
    const at = (x: number, y: number, z: number) => new Vector3(x * S, y * S - 0.35, z * S);
    const LEG_Z = [-0.42, -0.2, 0.04];
    for (const l of this.legs) l.g.position.copy(at(l.side * 0.5, 0.42, LEG_Z[l.i])).sub(this.body.position);
    for (const c of this.claws) {
      c.arm.position.copy(at(c.side * 0.45, 0.4, 0.3)).sub(this.body.position);
      c.jaw.position.copy(at(c.side * 0.45, 0.15, 0.68)).sub(this.body.position).sub(c.arm.position);
    }
    this.flames.length = 0;
    const flameOf = new Map<number, Group>();
    for (const side of [-1, 1]) {
      const g = new Group();
      g.position.copy(at(side * 0.16, 0.89, 0.4)).sub(this.body.position);
      this.body.add(g);
      this.flames.push(g);
      flameOf.set(side, g);
    }
    dressWith(this.root, model, toRoot, (i) => {
      const { x, y, z } = i.center;
      const side = x > 0 ? 1 : -1;
      const solid = i.glow ? undefined : this.shellMat;
      if (i.glow && y > 0.92 && Math.abs(x) < 0.25) return { part: flameOf.get(side)! };
      if (z > 0.2 && Math.abs(x) > 0.25) {
        const c = this.claws.find((k) => k.side === side)!;
        return { part: y < 0.25 && z > 0.6 ? c.jaw : c.arm, material: solid };
      }
      if (Math.abs(x) > 0.45 && z <= 0.2) {
        let best = 0;
        for (let k = 1; k < 3; k++) if (Math.abs(z - LEG_Z[k]) < Math.abs(z - LEG_Z[best])) best = k;
        const l = this.legs.find((g) => g.side === side && g.i === best)!;
        return { part: l.g, material: solid };
      }
      return { part: this.body, material: solid };
    }, [this.ice]);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 0.2, 0));
  }
  enabled(): boolean {
    return this.state !== 'gone';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle || c.handle === this.iceCollider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (hit.spell === 'rimewhistle') {
      this.state = 'frozen';
      this.timer = 8 * (hit.charge > 0.5 ? 1.6 : 1);
      this.ice.visible = true;
      this.iceCollider.setTranslation(new Vector3(this.pos.x, this.pos.y + 0.15, this.pos.z));
      this.iceCollider.setEnabled(true);
      this.ctx.events.emit('freeze', { pos: this.pos.clone(), charged: hit.charge > 0.5 });
      this.ctx.fx.burst(this.pos.clone(), 16, FROST, 2.4, 0.14, 1);
      return;
    }
    if (this.state === 'frozen') {
      this.shatter();
      return;
    }
    // Flipped onto its back for a moment.
    this.state = 'stunned';
    this.timer = 3 + hit.charge * 2;
    this.ctx.events.emit('gnarlingStunned', { pos: this.pos.clone() });
  }

  private reformIn = 0;

  private shatter(): void {
    this.state = 'gone';
    this.root.visible = false;
    this.ctx.targets.remove(this);
    if (this.spec.reform) {
      // A stepping stone you need: it crawls back out of the water a few seconds later.
      this.collider.setEnabled(false);
      this.iceCollider.setEnabled(false);
      this.reformIn = this.spec.reform;
    } else {
      this.ctx.physics.world.removeCollider(this.collider, false);
      this.ctx.physics.world.removeCollider(this.iceCollider, false);
    }
    this.ctx.events.emit('crabShatter', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone(), 26, FROST, 4, 0.16, 2);
    if (this.spec.id) {
      this.ctx.signals.set(this.spec.id, true);
      if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    }
    loot(this.ctx, this.id, this.pos.clone());
  }

  private canSee(target: Vector3): boolean {
    const from = this.pos.clone().add(new Vector3(0, 0.4, 0));
    const to = target.clone().sub(from);
    const dist = to.length();
    const hit = this.ctx.physics.raycast(from, to.normalize(), dist, this.collider, (c) => c.handle !== this.ctx.player.collider.handle && !this.ctx.physics.getInfo(c)?.seeThrough);
    return !hit;
  }

  private shoot(): void {
    const p = this.ctx.player.pos;
    const from = this.pos.clone().add(new Vector3(Math.sin(this.facing) * 0.5, 0.45, Math.cos(this.facing) * 0.5));
    // Lead the target a little.
    const aim = p.clone().addScaledVector(this.ctx.player.vel, 0.35).sub(from);
    const vel = aim.normalize().multiplyScalar(this.spec.speed ?? 7);
    const mesh = new Mesh(new IcosahedronGeometry(0.22, 1), this.ballMat);
    mesh.position.copy(from);
    this.ctx.scene.add(mesh);
    this.balls.push({ mesh, pos: from, vel, life: 3.5 });
    this.ctx.events.emit('crabShoot', { pos: from.clone() });
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    this.updateBalls(dt);
    if (this.state === 'gone' && this.reformIn > 0) {
      this.reformIn -= dt;
      if (this.reformIn <= 0) {
        this.state = 'walk';
        this.pos.copy(this.home);
        this.prev.copy(this.home);
        this.root.visible = true;
        this.ice.visible = false;
        this.collider.setEnabled(true);
        this.ctx.targets.add(this);
        this.ctx.fx.burst(this.pos.clone(), 14, FLAME, 2, 0.12, 0.6);
      }
    }
    const p = this.ctx.player.pos;
    const range = this.spec.range ?? 13;
    const dist = p.distanceTo(this.pos);
    switch (this.state) {
      case 'walk': {
        const len = this.spec.patrol ?? 3;
        this.along += this.dir * dt * 1.2;
        if (Math.abs(this.along) > len) {
          this.along = Math.sign(this.along) * len;
          this.dir *= -1;
        }
        this.pos.copy(this.home).addScaledVector(this.axis, this.along);
        this.reload -= dt;
        if (this.reload <= 0 && dist < range && this.ctx.player.mode !== 'reset' && this.canSee(p)) {
          this.state = 'aim';
          this.timer = 0.6;
        }
        break;
      }
      case 'aim':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          this.shoot();
          this.state = 'walk';
          this.reload = this.spec.interval ?? 2.4;
        }
        break;
      case 'stunned':
        if (this.timer <= 0) this.state = 'walk';
        break;
      case 'frozen':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.ice.visible = false;
          this.iceCollider.setEnabled(false);
          this.ctx.events.emit('thaw', { pos: this.pos.clone() });
        }
        break;
    }
    if (this.state !== 'gone') {
      this.collider.setTranslation(this.pos);
      // Walking into a live crab gets you pinched.
      if (this.state === 'walk' || this.state === 'aim') {
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.9 && Math.abs(p.y - this.pos.y) < 1.2) this.ctx.health.damage(1, this.pos.clone());
      }
    }
  }

  private updateBalls(dt: number): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life -= dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const hitWall = this.ctx.physics.raycast(b.pos, step.clone().normalize(), len, this.collider, (c) => c.handle !== this.ctx.player.collider.handle);
      b.pos.add(step);
      const p = this.ctx.player.pos;
      const hitPlayer = b.pos.distanceTo(p) < 0.7 && this.ctx.player.mode !== 'reset';
      if (hitPlayer) this.ctx.health.damage(1, b.pos.clone());
      if (hitPlayer || hitWall || b.life <= 0) {
        this.ctx.fx.burst(b.pos.clone(), 10, FLAME, 2, 0.12, 0.8);
        this.ctx.events.emit('crabHit', { pos: b.pos.clone() });
        b.mesh.removeFromParent();
        b.mesh.geometry.dispose();
        this.balls.splice(i, 1);
      }
    }
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const b of this.balls) {
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y += dt * 8;
      if (Math.random() < dt * 20) this.ctx.fx.burst(b.pos.clone(), 1, FLAME, 0.6, 0.08, 0.4);
    }
    if (this.state === 'gone') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 8, dt);
    const walking = this.state === 'walk';
    const aiming = this.state === 'aim';
    this.body.position.y = walking ? Math.abs(Math.sin(this.time * 14)) * 0.04 : 0;
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, aiming ? -0.2 : walking ? Math.sin(this.time * 14) * 0.04 : 0, 10, dt);
    // A scuttle: legs lift and swing in two alternating sets of three.
    for (const l of this.legs) {
      const ph = this.time * 14 + (l.i % 2 === (l.side > 0 ? 0 : 1) ? 0 : Math.PI);
      l.g.rotation.z = walking ? Math.max(0, Math.sin(ph)) * 0.35 * -l.side : 0;
      l.g.rotation.x = walking ? Math.cos(ph) * 0.25 : 0;
    }
    // Claws: raised and snapping when it aims, idly clicking otherwise.
    for (const c of this.claws) {
      c.arm.rotation.x = MathUtils.damp(c.arm.rotation.x, aiming ? -0.7 : Math.sin(this.time * 2 + c.side) * 0.08, 10, dt);
      c.jaw.rotation.x = aiming ? 0.25 + Math.abs(Math.sin(this.time * 18)) * 0.3 : Math.abs(Math.sin(this.time * 1.5 + c.side * 2)) * 0.25;
    }
    for (const [i, f] of this.flames.entries()) f.scale.set(1, 0.85 + Math.sin(this.time * 17 + i * 2) * 0.15 + (aiming ? 0.3 : 0), 1);
    // Flipped over when stunned; still and glassy when frozen.
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, this.state === 'stunned' ? Math.PI : 0, 10, dt);
    // The rock barely glows; the seams carry it.
    this.shellMat.emissiveIntensity = this.state === 'frozen' ? 0 : this.state === 'aim' ? 0.5 : 0.12 + Math.sin(this.time * 3) * 0.05;
    this.shellMat.color.set(this.state === 'frozen' ? '#a8d8ec' : '#ffffff');
    this.marker.setSpell(this.spell);
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(0, 1.2, 0));
  }
}
