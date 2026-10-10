import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { SPELLS, type SpellId } from '../data/spells';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';

type State = 'dormant' | 'stalk' | 'windup' | 'stuck' | 'stagger' | 'volley' | 'down';

/**
 * The Brass Examiner, the Final Examinations' last test: a great suit of brass armour all
 * seven professors built together. It stalks you round the Thistle Hall; up close it raises
 * both fists (the visor flares and a ring glows on the floor) and slams a shockwave across
 * the floor that only a jump clears. Its fists then stick in the flagstones for a moment and
 * a seal on its chest lights up with a rune: that's the moment to hit it with that spell
 * (charged, where the spell can be). Six seals, six spells; it gets faster and angrier as
 * they break, and throws hex volleys when you keep your distance.
 */
const SEALS: SpellId[] = ['thwackwort', 'latchkin', 'glimmerwick', 'cindersnap', 'rimewhistle', 'thistledown'];
const SEAL_NAMES: Record<string, string> = {
  thwackwort: 'Seal of Knocks',
  latchkin: 'Seal of Locks',
  glimmerwick: 'Seal of Lamps',
  cindersnap: 'Seal of Embers',
  rimewhistle: 'Seal of Frost',
  thistledown: 'Seal of Feathers',
};
const SCALE = 2.5;
const SLAM_RANGE = 3.8;
const SHOCK_RADIUS = 5.2;

interface Orb {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
}

export class Examiner implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 1.6;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly armL = new Group();
  private readonly armR = new Group();
  private readonly visor: MeshStandardMaterial;
  private readonly seal: MeshStandardMaterial;
  private readonly ring: Mesh;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly orbs: Orb[] = [];
  private readonly orbMat = new MeshStandardMaterial({ color: '#ffe08a', emissive: new Color('#ff9a20'), emissiveIntensity: 2.6 });
  private state: State = 'dormant';
  private timer = 0;
  private volleyIn = 5;
  private hp = SEALS.length;
  private facing = Math.PI;
  private t = 0;
  private pieces: { mesh: Mesh; vel: Vector3; spin: Vector3 }[] = [];

  constructor(
    private spec: SpecOf<'examiner'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    this.prev = this.pos.clone();
    this.visor = new MeshStandardMaterial({ color: '#2a2230', emissive: new Color('#ffb020'), emissiveIntensity: 0.3 });
    this.seal = new MeshStandardMaterial({ color: '#3a2a1a', emissive: new Color('#ffd86a'), emissiveIntensity: 0 });
    this.build();
    this.root.scale.setScalar(SCALE);
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    // The warning ring on the floor before a slam.
    this.ring = new Mesh(new RingGeometry(SHOCK_RADIUS - 0.35, SHOCK_RADIUS, 40), new MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    ctx.scene.add(this.ring);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.capsule(1.3, 1.1).setTranslation(this.pos.x, this.pos.y + 2.4, this.pos.z));
    ctx.physics.setInfo(this.collider, { noGrab: true });
    this.marker = new RuneMarker(ctx.scene, SEALS[0], 1.1);
    ctx.targets.add(this);
    ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: false });
  }

  private build(): void {
    const brass = new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.8, roughness: 0.35, flatShading: true });
    const dark = new MeshStandardMaterial({ color: '#5a4022', metalness: 0.6, roughness: 0.5, flatShading: true });
    const add = (parent: Group, geo: BufferGeometry, mat: MeshStandardMaterial, p: [number, number, number]) => {
      const m = new Mesh(geo, mat);
      m.position.set(...p);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    for (const x of [0.24, -0.24]) {
      const leg = new Group();
      leg.position.set(x, 0.85, 0);
      add(leg, new CylinderGeometry(0.14, 0.16, 0.8, 7), brass, [0, -0.38, 0]);
      add(leg, new BoxGeometry(0.28, 0.14, 0.42), dark, [0, -0.8, 0.06]);
      this.root.add(leg);
    }
    this.body.position.y = 0.85;
    this.root.add(this.body);
    add(this.body, new CylinderGeometry(0.4, 0.3, 0.32, 8), dark, [0, 0.1, 0]);
    add(this.body, new BoxGeometry(0.8, 0.78, 0.5), brass, [0, 0.62, 0]);
    // The seal on its chest, which lights with the rune of the spell that breaks it.
    add(this.body, new CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2), this.seal, [0, 0.66, 0.27]);
    add(this.body, new SphereGeometry(0.24, 8, 6), brass, [0.5, 0.95, 0]);
    add(this.body, new SphereGeometry(0.24, 8, 6), brass, [-0.5, 0.95, 0]);
    const helm = new Group();
    helm.position.y = 1.28;
    this.body.add(helm);
    add(helm, new CylinderGeometry(0.24, 0.26, 0.42, 10), brass, [0, 0.12, 0]);
    add(helm, new SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), brass, [0, 0.33, 0]);
    add(helm, new BoxGeometry(0.36, 0.06, 0.06), this.visor, [0, 0.16, 0.24]);
    // A crest of seven little thistles, one per professor.
    for (let i = 0; i < 7; i++) add(helm, new ConeGeometry(0.035, 0.22, 5), i % 2 ? dark : brass, [(i - 3) * 0.06, 0.6, -0.02]);
    for (const [arm, x] of [
      [this.armL, 0.58],
      [this.armR, -0.58],
    ] as const) {
      arm.position.set(x, 0.92, 0);
      add(arm, new CylinderGeometry(0.11, 0.12, 0.66, 7), brass, [0, -0.33, 0]);
      add(arm, new IcosahedronGeometry(0.2, 0), dark, [0, -0.72, 0]);
      this.body.add(arm);
    }
  }

  // ---------------------------------------------------------------- SpellTarget

  get spell(): SpellId {
    return SEALS[SEALS.length - this.hp] ?? 'thwackwort';
  }
  aimPoint(out: Vector3): Vector3 {
    return out.set(this.pos.x, this.pos.y + 2.4, this.pos.z);
  }
  /** Only while its fists are stuck in the floor (and only with the right spell, charged if it can be). */
  enabled(): boolean {
    return this.state === 'stuck';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    if (this.state !== 'stuck') return;
    if (SPELLS[this.spell].chargeable && hit.charge < 0.5) {
      // Glances off: this seal wants more than a tap.
      this.ctx.events.emit('rattleClang', { pos: this.pos.clone() });
      this.ctx.events.emit('toast', { text: `The ${SEAL_NAMES[this.spell]} holds. Charge it!`, kind: 'hint' });
      return;
    }
    const name = SEAL_NAMES[this.spell];
    this.hp--;
    this.ctx.events.emit('bossHit', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 2.4, 0.6)), 30, new Color('#ffd86a'), 4, 0.18, 0.4);
    this.ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: this.hp > 0 });
    if (this.hp <= 0) {
      this.fall();
      return;
    }
    this.ctx.events.emit('toast', { text: `The ${name} breaks! (${SEALS.length - this.hp} of ${SEALS.length})`, kind: 'info' });
    this.state = 'stagger';
    this.timer = 1.4;
    this.marker.setSpell(this.spell);
  }

  private fall(): void {
    this.state = 'down';
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    this.ctx.events.emit('bossDown', { pos: this.pos.clone() });
    this.ctx.signals.set(this.spec.id, true);
    this.ctx.state.flags.add(`down:${this.spec.id}`);
    this.ring.visible = false;
    // Falls apart: every part flies off and clatters down.
    this.root.updateMatrixWorld(true);
    const parts: Mesh[] = [];
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) parts.push(o as Mesh);
    });
    for (const m of parts) {
      const wp = new Vector3();
      m.getWorldPosition(wp);
      m.removeFromParent();
      m.position.copy(wp);
      m.scale.setScalar(SCALE);
      this.ctx.scene.add(m);
      this.pieces.push({ mesh: m, vel: new Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6), spin: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6) });
    }
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 2, 0)), 60, new Color('#ffd86a'), 6, 0.22, 0.5);
  }

  private shoot(count: number): void {
    const from = this.pos.clone().add(new Vector3(0, 3.6, 0));
    const p = this.ctx.player.pos;
    const base = Math.atan2(p.x - from.x, p.z - from.z);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.28;
      const flat = Math.hypot(p.x - from.x, p.z - from.z);
      const vel = new Vector3(Math.sin(a), (p.y - from.y) / Math.max(flat, 1), Math.cos(a)).normalize().multiplyScalar(8);
      const mesh = new Mesh(new IcosahedronGeometry(0.28, 1), this.orbMat);
      mesh.position.copy(from);
      this.ctx.scene.add(mesh);
      this.orbs.push({ mesh, pos: from.clone(), vel, life: 4 });
    }
    this.ctx.events.emit('hexCast', { pos: from.clone() });
  }

  private updateOrbs(dt: number): void {
    const p = this.ctx.player.pos;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      const step = o.vel.clone().multiplyScalar(dt);
      const wall = this.ctx.physics.raycast(o.pos, step.clone().normalize(), step.length(), this.collider, (c) => c.handle !== this.ctx.player.collider.handle);
      o.pos.add(step);
      const hit = o.pos.distanceTo(p) < 0.75 && this.ctx.player.mode !== 'reset';
      if (hit) this.ctx.health.damage(1, o.pos.clone());
      if (hit || wall || o.life <= 0) {
        this.ctx.fx.burst(o.pos.clone(), 12, new Color('#ffb020'), 2.4, 0.14, 0.6);
        this.ctx.events.emit('hexHit', { pos: o.pos.clone() });
        o.mesh.removeFromParent();
        o.mesh.geometry.dispose();
        this.orbs.splice(i, 1);
      }
    }
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.timer -= dt;
    this.prev.copy(this.pos);
    this.updateOrbs(dt);
    for (const pc of this.pieces) {
      pc.vel.y -= 20 * dt;
      pc.mesh.position.addScaledVector(pc.vel, dt);
      if (pc.mesh.position.y < 0.3) {
        pc.mesh.position.y = 0.3;
        pc.vel.multiplyScalar(0.4);
        pc.vel.y = Math.abs(pc.vel.y) * 0.3;
      }
      pc.mesh.rotation.x += pc.spin.x * dt;
      pc.mesh.rotation.z += pc.spin.z * dt;
      pc.spin.multiplyScalar(0.98);
    }
    if (this.state === 'down') return;
    const p = this.ctx.player.pos;
    const flat = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    const angry = this.hp <= 2 ? 2 : this.hp <= 4 ? 1 : 0;
    const arena = this.spec.arena;
    const inArena = p.x > arena.min[0] && p.x < arena.max[0] && p.z > arena.min[2] && p.z < arena.max[2];
    switch (this.state) {
      case 'dormant':
        if (inArena && this.ctx.state.flags.has(this.spec.wakeFlag)) {
          this.state = 'stalk';
          this.ctx.events.emit('bossRoar', { pos: this.pos.clone() });
          this.ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: true });
        }
        break;
      case 'stalk': {
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        const speed = [2.2, 2.9, 3.6][angry];
        if (flat > SLAM_RANGE - 0.8) {
          this.pos.x += Math.sin(this.facing) * speed * dt;
          this.pos.z += Math.cos(this.facing) * speed * dt;
        }
        this.pos.x = MathUtils.clamp(this.pos.x, arena.min[0] + 1.5, arena.max[0] - 1.5);
        this.pos.z = MathUtils.clamp(this.pos.z, arena.min[2] + 1.5, arena.max[2] - 1.5);
        this.volleyIn -= dt;
        if (flat < SLAM_RANGE && this.ctx.player.mode !== 'reset') {
          this.state = 'windup';
          this.timer = [1.0, 0.85, 0.7][angry];
        } else if (this.volleyIn <= 0 && flat > 6) {
          this.state = 'volley';
          this.timer = 0.7;
        }
        break;
      }
      case 'volley':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          this.shoot(3 + angry * 2);
          this.volleyIn = [6, 5, 4][angry];
          this.state = 'stalk';
        }
        break;
      case 'windup':
        if (this.timer <= 0) this.slam();
        break;
      case 'stuck':
      case 'stagger':
        if (this.timer <= 0) {
          this.state = 'stalk';
          this.volleyIn = Math.max(this.volleyIn, 1.5);
        }
        break;
    }
    this.collider.setTranslation(new Vector3(this.pos.x, this.pos.y + 2.4, this.pos.z));
  }

  /** The shockwave: anyone on the floor within reach is knocked flat; a jump clears it. */
  private slam(): void {
    const p = this.ctx.player.pos;
    const flat = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    const airborne = this.ctx.player.feet.y > this.pos.y + 0.45;
    if (flat < SHOCK_RADIUS && !airborne && this.ctx.player.mode !== 'reset') this.ctx.health.damage(2, this.pos.clone());
    this.ctx.events.emit('bombBlast', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 0.3, 0)), 40, new Color('#c8b090'), 6, 0.25, 0.2);
    this.state = 'stuck';
    this.timer = [2.6, 2.3, 2][this.hp <= 2 ? 2 : this.hp <= 4 ? 1 : 0];
    this.marker.setSpell(this.spell);
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const o of this.orbs) {
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y += dt * 5;
    }
    if (this.state === 'down') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = MathUtils.damp(this.root.rotation.y, this.facing, 5, dt);
    const raise = this.state === 'windup' ? 1 : 0;
    const stuck = this.state === 'stuck';
    const armX = stuck ? -0.9 : MathUtils.lerp(Math.sin(this.t * 2) * 0.2, -2.9, raise);
    this.armL.rotation.x = MathUtils.damp(this.armL.rotation.x, armX, 12, dt);
    this.armR.rotation.x = MathUtils.damp(this.armR.rotation.x, armX, 12, dt);
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, stuck ? 0.45 : this.state === 'stagger' ? -0.3 : 0, 8, dt);
    this.body.position.y = 0.85 + (this.state === 'stalk' ? Math.abs(Math.sin(this.t * 5)) * 0.04 : 0);
    this.visor.emissiveIntensity = this.state === 'windup' ? 3 + Math.sin(this.t * 30) : this.state === 'dormant' ? 0.3 : 1.2;
    this.seal.emissiveIntensity = stuck ? 2.5 + Math.sin(this.t * 10) * 0.8 : 0.2;
    const ringMat = this.ring.material as MeshBasicMaterial;
    ringMat.opacity = this.state === 'windup' ? 0.35 + Math.sin(this.t * 20) * 0.2 : 0;
    this.ring.position.set(this.root.position.x, this.pos.y + 0.05, this.root.position.z);
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(Math.sin(this.root.rotation.y) * 1.2, 2.5, Math.cos(this.root.rotation.y) * 1.2));
  }
}
