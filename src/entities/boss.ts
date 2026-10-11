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
  CircleGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { SPELLS, type SpellId } from '../data/spells';
import { dampAngle } from '../player/controller';
import { RuneMarker, runeTexture } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';

type State = 'dormant' | 'stalk' | 'windup' | 'stuck' | 'stagger' | 'volley' | 'rain' | 'brace' | 'charge' | 'down';

/**
 * The Brass Examiner, the Final Examinations' last test: a great suit of brass armour all
 * seven professors built together. It stalks you round the Thistle Hall; up close it raises
 * both fists (the visor flares and a ring glows on the floor) and slams a shockwave across
 * the floor that only a jump clears. Its fists then stick in the flagstones for a moment and
 * a seal on its chest lights up with a rune: that's the moment to hit it with that spell
 * (charged, where the spell can be). Six seals, six spells, worn as six rune medallions
 * on its chest that go dark one by one. The fight has three phases by seals broken:
 *  - 0-1: it stalks and slams, and throws hex volleys when you keep your distance;
 *  - 2-3: every slam also sends a shockwave rolling out across the whole hall (jump it), and
 *    hexes rain down on glowing marks on the floor;
 *  - 4-5: two rolling shockwaves per slam, wider volleys, and a charge: it braces, then
 *    rushes at you; dodge, and it crashes into the wall and is stuck there for a moment.
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

/** A shockwave rolling out across the floor from a slam. */
interface Wave {
  cx: number;
  cz: number;
  r: number;
  delay: number;
  hit: boolean;
  mesh: Mesh;
}

/** A hex falling on a glowing mark. */
interface Drop {
  x: number;
  z: number;
  timer: number;
  mark: Mesh;
  orb: Mesh;
}

const WAVE_SPEED = 7;
const WAVE_REACH = 20;
const RAIN_FALL = 1.5;

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
  private readonly seals: { mat: MeshStandardMaterial; disc: Mesh; glyph: Mesh; color: Color }[] = [];
  private readonly waves: Wave[] = [];
  private readonly drops: Drop[] = [];
  private rainIn = 6;
  private chargeIn = 4;
  private readonly chargeDir = new Vector3();
  private chargeHit = false;
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
    this.build();
    this.root.scale.setScalar(SCALE);
    this.root.position.copy(this.pos);
    ctx.scene.add(this.root);
    // The warning ring on the floor before a slam.
    this.ring = new Mesh(new RingGeometry(SHOCK_RADIUS - 0.35, SHOCK_RADIUS, 40), new MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    ctx.scene.add(this.ring);
    this.collider = ctx.physics.world.createCollider(RAPIER.ColliderDesc.capsule(1.3, 1.1).setTranslation(this.pos.x, this.pos.y + 2.4, this.pos.z));
    ctx.physics.setInfo(this.collider, { noGrab: true, cameraIgnore: true });
    this.marker = new RuneMarker(ctx.scene, SEALS[0], 1.1);
    ctx.targets.add(this);
    ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: false });
    // Knocked out? The encounter starts again from the beginning: every seal whole, back at its post.
    ctx.events.on('respawn', ({ reason }) => {
      if (reason === 'faint' && this.state !== 'down') this.reset();
    });
  }

  private reset(): void {
    this.hp = SEALS.length;
    this.state = 'dormant';
    this.timer = 0;
    this.volleyIn = 5;
    this.rainIn = 6;
    this.chargeIn = 4;
    this.facing = Math.PI;
    this.pos.set(...this.spec.pos);
    this.prev.copy(this.pos);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    for (const sl of this.seals) {
      sl.mat.color.copy(sl.color).multiplyScalar(0.5);
      sl.mat.emissiveIntensity = 0.5;
      sl.glyph.visible = true;
      sl.disc.rotation.z = 0;
      sl.disc.scale.setScalar(1);
    }
    for (const o of this.orbs) o.mesh.removeFromParent();
    for (const w of this.waves) w.mesh.removeFromParent();
    for (const d of this.drops) {
      d.mark.removeFromParent();
      d.orb.removeFromParent();
    }
    this.orbs.length = 0;
    this.waves.length = 0;
    this.drops.length = 0;
    this.collider.setTranslation(new Vector3(this.pos.x, this.pos.y + 2.4, this.pos.z));
    this.marker.setSpell(SEALS[0]);
    this.ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: false });
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
    // Six seals on its chest, a rune medallion for each spell, in a ring round a brass boss.
    // The one to break next pulses while its fists are stuck; broken ones go dark and crack.
    add(this.body, new CylinderGeometry(0.1, 0.1, 0.05, 10).rotateX(Math.PI / 2), dark, [0, 0.62, 0.27]);
    SEALS.forEach((spell, i) => {
      const a = Math.PI / 2 + (i / SEALS.length) * Math.PI * 2;
      const x = Math.cos(a) * 0.25;
      const y = 0.62 + Math.sin(a) * 0.25;
      const color = new Color(SPELLS[spell].color);
      const mat = new MeshStandardMaterial({ color: color.clone().multiplyScalar(0.5), emissive: color, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.4 });
      const disc = add(this.body, new CylinderGeometry(0.09, 0.09, 0.05, 12).rotateX(Math.PI / 2), mat, [x, y, 0.27]);
      const glyph = new Mesh(new PlaneGeometry(0.15, 0.15), new MeshBasicMaterial({ map: runeTexture(spell), transparent: true, depthWrite: false }));
      glyph.position.set(x, y, 0.3);
      this.body.add(glyph);
      this.seals.push({ mat, disc, glyph, color });
    });
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
    const broken = this.seals[SEALS.length - this.hp];
    if (broken) {
      broken.mat.color.set('#2a2420');
      broken.mat.emissiveIntensity = 0;
      broken.glyph.visible = false;
      broken.disc.rotation.z = 0.5;
      broken.disc.scale.setScalar(0.85);
      const wp = new Vector3();
      broken.disc.getWorldPosition(wp);
      this.ctx.fx.burst(wp, 24, broken.color, 3, 0.12, 0.6);
    }
    this.hp--;
    this.ctx.events.emit('bossHit', { pos: this.pos.clone() });
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 2.4, 0.6)), 30, new Color('#ffd86a'), 4, 0.18, 0.4);
    this.ctx.events.emit('bossHealth', { name: 'The Brass Examiner', hp: this.hp, max: SEALS.length, active: this.hp > 0 });
    if (this.hp <= 0) {
      this.fall();
      return;
    }
    this.ctx.events.emit('toast', { text: `The ${name} breaks! (${SEALS.length - this.hp} of ${SEALS.length})`, kind: 'info' });
    if (this.hp === 4 || this.hp === 2) {
      // A new phase: it roars, and fights differently from here on.
      this.ctx.events.emit('bossRoar', { pos: this.pos.clone() });
      const text = this.hp === 4 ? 'The Examiner shakes the floor! Jump the shockwaves, and mind the hexes from above.' : 'The Examiner is furious! It charges now: dodge, and it hits the wall.';
      this.ctx.events.emit('toast', { text, kind: 'hint' });
      // Show off the new trick soon after the roar.
      if (this.hp === 4) this.rainIn = 2;
      else this.chargeIn = 2;
    }
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
    for (const w of this.waves) w.mesh.removeFromParent();
    for (const d of this.drops) {
      d.mark.removeFromParent();
      d.orb.removeFromParent();
    }
    this.waves.length = 0;
    this.drops.length = 0;
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

  private wave(delay: number): void {
    const mesh = new Mesh(new RingGeometry(0.96, 1, 72), new MeshBasicMaterial({ color: '#ffcf6a', transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    this.ctx.scene.add(mesh);
    this.waves.push({ cx: this.pos.x, cz: this.pos.z, r: SHOCK_RADIUS, delay, hit: false, mesh });
  }

  private updateWaves(dt: number): void {
    const p = this.ctx.player;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.delay -= dt;
      if (w.delay > 0) continue;
      w.r += WAVE_SPEED * dt;
      w.mesh.visible = true;
      w.mesh.scale.setScalar(w.r);
      w.mesh.position.set(w.cx, this.pos.y + 0.06, w.cz);
      (w.mesh.material as MeshBasicMaterial).opacity = 0.8 * (1 - w.r / WAVE_REACH);
      const d = Math.hypot(p.pos.x - w.cx, p.pos.z - w.cz);
      const grounded = p.feet.y < this.pos.y + 0.45;
      if (!w.hit && Math.abs(d - w.r) < 0.55 && grounded && p.mode !== 'reset') {
        w.hit = true;
        this.ctx.health.damage(1, new Vector3(w.cx, this.pos.y, w.cz));
      }
      if (w.r > WAVE_REACH) {
        w.mesh.removeFromParent();
        w.mesh.geometry.dispose();
        this.waves.splice(i, 1);
      }
    }
  }

  /** Hexes rain on the floor: one where you stand, more round about, each on a glowing mark. */
  private rain(count: number): void {
    const p = this.ctx.player.pos;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 1.8 + Math.random() * 2.2;
      const x = p.x + Math.sin(a) * r;
      const z = p.z + Math.cos(a) * r;
      const mark = new Mesh(new CircleGeometry(1.1, 20), new MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.1, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(x, this.pos.y + 0.05, z);
      const orb = new Mesh(new IcosahedronGeometry(0.32, 1), this.orbMat);
      this.ctx.scene.add(mark, orb);
      this.drops.push({ x, z, timer: RAIN_FALL + i * 0.18, mark, orb });
    }
    this.ctx.events.emit('hexCast', { pos: this.pos.clone().add(new Vector3(0, 4, 0)) });
  }

  private updateDrops(dt: number): void {
    const p = this.ctx.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.timer -= dt;
      d.orb.position.set(d.x, this.pos.y + 0.4 + Math.max(0, d.timer) * 7, d.z);
      (d.mark.material as MeshBasicMaterial).opacity = 0.15 + 0.45 * (1 - Math.min(1, d.timer / RAIN_FALL));
      if (d.timer > 0) continue;
      if (Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < 1.2 && p.feet.y < this.pos.y + 1.6 && p.mode !== 'reset') this.ctx.health.damage(1, new Vector3(d.x, this.pos.y, d.z));
      const at = new Vector3(d.x, this.pos.y + 0.4, d.z);
      this.ctx.fx.burst(at, 14, new Color('#ffb020'), 2.6, 0.14, 0.6);
      this.ctx.events.emit('hexHit', { pos: at });
      d.mark.removeFromParent();
      d.orb.removeFromParent();
      d.mark.geometry.dispose();
      d.orb.geometry.dispose();
      this.drops.splice(i, 1);
    }
  }

  /** Keeps it inside its hall (it moves without colliding); true if it had to be pushed back. */
  private confine(): boolean {
    const arena = this.spec.arena;
    const x0 = this.pos.x;
    const z0 = this.pos.z;
    this.pos.x = MathUtils.clamp(this.pos.x, arena.min[0] + 1.5, arena.max[0] - 1.5);
    this.pos.z = MathUtils.clamp(this.pos.z, arena.min[2] + 1.5, arena.max[2] - 1.5);
    if (this.spec.ring) {
      const [cx, cz] = this.spec.ring.center;
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      const d = Math.hypot(dx, dz);
      const r = this.spec.ring.radius;
      if (d > r) {
        this.pos.x = cx + (dx / d) * r;
        this.pos.z = cz + (dz / d) * r;
      }
    }
    if (this.spec.avoid) {
      const [ax, , az] = this.spec.avoid;
      const dx = this.pos.x - ax;
      const dz = this.pos.z - az;
      const d = Math.hypot(dx, dz);
      if (d < 3.4) {
        const k = 3.4 / Math.max(d, 0.01);
        this.pos.x = ax + dx * k;
        this.pos.z = az + dz * k;
      }
    }
    return Math.abs(this.pos.x - x0) > 1e-4 || Math.abs(this.pos.z - z0) > 1e-4;
  }

  fixedUpdate(dt: number): void {
    this.t += dt;
    this.updateWaves(dt);
    this.updateDrops(dt);
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
        this.confine();
        this.volleyIn -= dt;
        this.rainIn -= dt;
        this.chargeIn -= dt;
        if (flat < SLAM_RANGE && this.ctx.player.mode !== 'reset') {
          this.state = 'windup';
          this.timer = [1.0, 0.85, 0.7][angry];
        } else if (angry === 2 && this.chargeIn <= 0 && flat > 6) {
          this.state = 'brace';
          this.timer = 0.9;
          this.ctx.events.emit('bossRoar', { pos: this.pos.clone() });
        } else if (angry >= 1 && this.rainIn <= 0 && flat > 4) {
          this.state = 'rain';
          this.timer = 0.6;
        } else if (this.volleyIn <= 0 && flat > 6) {
          this.state = 'volley';
          this.timer = 0.7;
        }
        break;
      }
      case 'rain':
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          this.rain(angry === 2 ? 5 : 4);
          this.rainIn = angry === 2 ? 7 : 8;
          this.volleyIn = Math.max(this.volleyIn, 2);
          this.state = 'stalk';
        }
        break;
      case 'brace':
        // Stamps, lowers its head; turns to you until the last moment.
        this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        if (this.timer <= 0) {
          this.chargeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
          this.chargeHit = false;
          this.state = 'charge';
          this.timer = 2;
        }
        break;
      case 'charge': {
        this.pos.addScaledVector(this.chargeDir, 12 * dt);
        if (!this.chargeHit && flat < 2.2 && this.ctx.player.mode !== 'reset') this.chargeHit = this.ctx.health.damage(1, this.pos.clone());
        const crashed = this.confine();
        if (crashed) {
          // Into the wall: dazed, fists down, seal open.
          this.ctx.events.emit('bombBlast', { pos: this.pos.clone() });
          this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 2, 0)), 30, new Color('#c8b090'), 5, 0.22, 0.3);
          this.state = 'stuck';
          this.timer = 2.6;
          this.marker.setSpell(this.spell);
          this.chargeIn = 8;
        } else if (this.timer <= 0) {
          this.state = 'stalk';
          this.chargeIn = 6;
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
    const angry = this.hp <= 2 ? 2 : this.hp <= 4 ? 1 : 0;
    // Later phases: shockwaves roll on out across the hall (jump each as it reaches you).
    if (angry >= 1) this.wave(0);
    if (angry >= 2) this.wave(1.1);
    this.state = 'stuck';
    this.timer = [2.6, 2.3, 2][angry];
    this.marker.setSpell(this.spell);
  }

  frameUpdate(dt: number, alpha: number): void {
    for (const o of this.orbs) {
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y += dt * 5;
    }
    if (this.state === 'down') return;
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 5, dt);
    const raise = this.state === 'windup' || this.state === 'rain' ? 1 : 0;
    const stuck = this.state === 'stuck';
    const armX = stuck ? -0.9 : MathUtils.lerp(Math.sin(this.t * 2) * 0.2, -2.9, raise);
    this.armL.rotation.x = MathUtils.damp(this.armL.rotation.x, armX, 12, dt);
    this.armR.rotation.x = MathUtils.damp(this.armR.rotation.x, armX, 12, dt);
    const lean = stuck ? 0.45 : this.state === 'stagger' ? -0.3 : this.state === 'brace' || this.state === 'charge' ? 0.5 : 0;
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, lean, 8, dt);
    this.body.position.y = 0.85 + (this.state === 'stalk' ? Math.abs(Math.sin(this.t * 5)) * 0.04 : 0);
    const flare = this.state === 'windup' || this.state === 'brace' || this.state === 'charge';
    this.visor.emissiveIntensity = flare ? 3 + Math.sin(this.t * 30) : this.state === 'dormant' ? 0.3 : 1.2;
    // The visor reddens as it gets angrier.
    this.visor.emissive.set(this.hp <= 2 ? '#ff4a20' : this.hp <= 4 ? '#ff8020' : '#ffb020');
    const next = SEALS.length - this.hp;
    this.seals.forEach((sl, i) => {
      if (i < next) return;
      sl.mat.emissiveIntensity = i === next && stuck ? 2.6 + Math.sin(this.t * 10) * 0.9 : i === next ? 0.9 : 0.4;
    });
    const ringMat = this.ring.material as MeshBasicMaterial;
    ringMat.opacity = this.state === 'windup' ? 0.35 + Math.sin(this.t * 20) * 0.2 : 0;
    this.ring.position.set(this.root.position.x, this.pos.y + 0.05, this.root.position.z);
    this.marker.sprite.position.copy(this.root.position).add(new Vector3(Math.sin(this.root.rotation.y) * 1.2, 2.5, Math.cos(this.root.rotation.y) * 1.2));
  }
}
