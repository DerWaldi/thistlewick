import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  CircleGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { SPELLS, type SpellId } from '../data/spells';
import { mergeChildren } from '../world/merge';
import { angleDiff, dampAngle } from '../player/controller';
import { RuneMarker, runeTexture } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { dressWith, modelIslands, type Island } from './models';
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

const STAFF_UP = new Vector3();

export class Examiner implements Entity, SpellTarget {
  readonly marker: RuneMarker;
  readonly radius = 1.6;
  private collider: RAPIER.Collider;
  private readonly root = new Group();
  private readonly body = new Group();
  private readonly armL = new Group();
  private readonly armR = new Group();
  private readonly legs: Group[] = [];
  /** The model's staff (its own group, so it stays upright in the hand). */
  private readonly staff = new Group();
  private readonly staffGrip = new Vector3();
  private staffVel = 0;
  private staffSlide = 0;
  private stride = 0;
  private helm: Object3D | null = null;
  /** Where the body (hips) sits in root space: the model's hips are lower than the built body's. */
  private bodyY = 0.85;
  private readonly crystal = new MeshStandardMaterial({ color: '#ffb060', emissive: new Color('#ff7a10'), emissiveIntensity: 1.8, flatShading: true });
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
    const model = modelIslands('examiner');
    if (model) this.wear(model);
    this.body.traverse((o) => {
      if ((o as Mesh).material === this.visor) this.helm = o.parent;
    });
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
    // (Moderate metalness: there's no environment map, and very metallic brass renders brown.)
    const brass = new MeshStandardMaterial({ color: '#d8a53e', metalness: 0.45, roughness: 0.38, flatShading: true });
    const dark = new MeshStandardMaterial({ color: '#4a3420', metalness: 0.3, roughness: 0.55, flatShading: true });
    const add = (parent: Group, geo: BufferGeometry, mat: MeshStandardMaterial, p: [number, number, number]) => {
      const m = new Mesh(geo, mat);
      m.position.set(...p);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // Boxy plated legs: thigh, knee joint, shin, a big flat foot.
    for (const x of [0.24, -0.24]) {
      const leg = new Group();
      leg.position.set(x, 0.85, 0);
      add(leg, new BoxGeometry(0.22, 0.34, 0.24), brass, [0, -0.17, 0]);
      add(leg, new CylinderGeometry(0.08, 0.08, 0.26, 8).rotateZ(Math.PI / 2), dark, [0, -0.38, 0]);
      add(leg, new BoxGeometry(0.24, 0.3, 0.26), brass, [0, -0.58, 0]);
      add(leg, new BoxGeometry(0.3, 0.12, 0.44), dark, [0, -0.8, 0.07]);
      add(leg, new BoxGeometry(0.26, 0.04, 0.2), brass, [0, -0.72, 0.17]);
      mergeChildren(leg);
      this.legs.push(leg);
      this.root.add(leg);
    }
    this.body.position.y = 0.85;
    this.root.add(this.body);
    add(this.body, new BoxGeometry(0.62, 0.28, 0.4), dark, [0, 0.1, 0]);
    add(this.body, new BoxGeometry(0.8, 0.78, 0.5), brass, [0, 0.62, 0]);
    // Plate seams and rivets, and a gear set in each side of the chest.
    add(this.body, new BoxGeometry(0.82, 0.03, 0.52), dark, [0, 0.3, 0]);
    add(this.body, new BoxGeometry(0.82, 0.03, 0.52), dark, [0, 0.94, 0]);
    for (const x of [-0.36, 0.36]) for (const y of [0.36, 0.88]) add(this.body, new SphereGeometry(0.025, 4, 3), dark, [x, y, 0.26]);
    for (const x of [-0.41, 0.41]) {
      add(this.body, new CylinderGeometry(0.15, 0.15, 0.04, 10).rotateZ(Math.PI / 2), dark, [x, 0.62, 0]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(this.body, new BoxGeometry(0.04, 0.06, 0.06), dark, [x, 0.62 + Math.sin(a) * 0.17, Math.cos(a) * 0.17]);
      }
    }
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
    // Square stacked pauldrons.
    for (const x of [0.5, -0.5]) {
      add(this.body, new BoxGeometry(0.34, 0.2, 0.42), brass, [x, 0.98, 0]);
      add(this.body, new BoxGeometry(0.3, 0.12, 0.38), brass, [x * 1.06, 0.84, 0]);
    }
    const helm = new Group();
    helm.position.y = 1.28;
    this.body.add(helm);
    // A boxy helm with a glowing visor slit and a crest of seven little spikes, one per professor.
    add(helm, new BoxGeometry(0.42, 0.44, 0.44), brass, [0, 0.14, 0]);
    add(helm, new BoxGeometry(0.36, 0.08, 0.4), brass, [0, 0.4, 0]);
    add(helm, new BoxGeometry(0.46, 0.05, 0.48), dark, [0, -0.06, 0]);
    add(helm, new BoxGeometry(0.34, 0.07, 0.05), this.visor, [0, 0.18, 0.22]);
    for (const x of [-0.23, 0.23]) add(helm, new BoxGeometry(0.06, 0.2, 0.2), brass, [x, 0.14, 0.04]);
    for (let i = 0; i < 7; i++) add(helm, new ConeGeometry(0.03, 0.18 + (i === 3 ? 0.08 : 0), 4), brass, [(i - 3) * 0.05, 0.53, -0.02]);
    for (const [arm, x] of [
      [this.armL, 0.58],
      [this.armR, -0.58],
    ] as const) {
      arm.position.set(x, 0.92, 0);
      add(arm, new BoxGeometry(0.18, 0.3, 0.2), brass, [0, -0.17, 0]);
      add(arm, new CylinderGeometry(0.07, 0.07, 0.22, 8).rotateZ(Math.PI / 2), dark, [0, -0.36, 0]);
      add(arm, new BoxGeometry(0.2, 0.28, 0.22), brass, [0, -0.52, 0]);
      add(arm, new BoxGeometry(0.22, 0.18, 0.24), dark, [0, -0.74, 0]);
      for (let f = 0; f < 3; f++) add(arm, new BoxGeometry(0.05, 0.1, 0.05), dark, [(f - 1) * 0.07, -0.86, 0.06]);
      this.body.add(arm);
    }
    // A brass staff in the left hand, topped with a glowing orange crystal.
    add(this.armL, new CylinderGeometry(0.03, 0.035, 1.9, 6), brass, [0.02, -0.74, 0.12]);
    add(this.armL, new CylinderGeometry(0.06, 0.04, 0.1, 6), dark, [0.02, 0.18, 0.12]);
    const crystal = new Mesh(new OctahedronGeometry(0.11, 0).scale(1, 1.6, 1), this.crystal);
    crystal.position.set(0.02, 0.34, 0.12);
    this.armL.add(crystal);
    mergeChildren(this.armL, [crystal]);
    mergeChildren(this.armR);
  }

  /**
   * Wear the clockwork model. Built before the root is scaled, so the model goes in at 1/SCALE
   * (it's already full size). Legs and arms swing from its hips and shoulders, the body leans
   * from the hips; each seal's gem takes that seal's material (it darkens when broken), with the
   * seal's rune laid over it; the visor and the staff's crystal keep their animated glow.
   */
  private wear(model: Island[]): void {
    const k = 1 / SCALE;
    const toRoot = new Matrix4().makeScale(k, k, k);
    let helm: Object3D = this.body;
    this.body.traverse((o) => {
      if ((o as Mesh).material === this.visor) helm = o.parent!;
    });
    const HIP = 1.45;
    this.bodyY = HIP * k;
    this.body.position.y = this.bodyY;
    for (const [i, leg] of this.legs.entries()) leg.position.set((i === 0 ? 0.35 : -0.35) * k, HIP * k, 0);
    this.armL.position.set(0.84 * k, (2.72 - HIP) * k, 0);
    this.armR.position.set(-0.84 * k, (2.72 - HIP) * k, 0);
    helm.position.set(0, (2.9 - HIP) * k, 0);
    // Which gem is which seal, by colour.
    const GEM: Record<string, SpellId> = {
      mat_f08a1a: 'thwackwort',
      mat_f0d020: 'latchkin',
      mat_9af4f4: 'glimmerwick',
      mat_e82a2a: 'cindersnap',
      mat_2a7cf0: 'rimewhistle',
      mat_a040e8: 'thistledown',
    };
    const keep: Object3D[] = [];
    for (const [i, spell] of SEALS.entries()) {
      const gem = model.find((g) => GEM[g.mat] === spell);
      if (!gem) continue;
      const sl = this.seals[i];
      sl.glyph.position.set(gem.center.x * k, (gem.center.y - HIP) * k, (gem.max.z + 0.02) * k);
      sl.glyph.scale.setScalar(0.45);
      keep.push(sl.glyph);
    }
    // The staff hangs from its grip in the right hand and stays upright as the arm moves.
    this.root.updateMatrixWorld(true);
    this.staff.position.copy(this.armR.worldToLocal(this.root.localToWorld(new Vector3(-0.88 * k, 1.1 * k, 0.54 * k))));
    this.armR.add(this.staff);
    this.staffGrip.copy(this.staff.position);
    // The pole and its bands below and above the grip, and the lantern up top (not the fingers).
    const isStaff = (i: Island) => (i.center.z > 0.47 || i.center.y > 3.45) && Math.abs(i.center.x + 0.88) < 0.15 && !(i.center.y > 0.95 && i.center.y < 1.16 && i.max.x - i.min.x < 0.09);
    this.root.updateMatrixWorld(true);
    dressWith(this.root, model, toRoot, (i) => {
      const { x, y, z } = i.center;
      const seal = GEM[i.mat];
      if (seal) return { part: this.body, material: this.seals[SEALS.indexOf(seal)].mat };
      if (i.mat === 'glow_ffb81a') return { part: helm, material: this.visor };
      if (i.mat === 'glow_ffd060') return { part: this.staff, material: this.crystal };
      if (isStaff(i)) return { part: this.staff };
      if (y > 2.88 && Math.abs(x) < 0.3) return { part: helm };
      if (x < -0.6 && z > 0.3) return { part: this.armR };
      if (Math.abs(x) > 0.62 && y > 0.9 && y < 2.86) return { part: x > 0 ? this.armL : this.armR };
      if (y < HIP && Math.abs(x) > 0.14 && Math.abs(x) < 0.56) return { part: x > 0 ? this.legs[0] : this.legs[1] };
      return { part: this.body };
    }, keep, { metalness: 0.35, roughness: 0.45 });
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
    const st = this.state;
    const stuck = st === 'stuck';
    const moving = st === 'stalk' || st === 'charge';
    // The walk: heavy strides, arms swinging against the legs, the torso twisting and rolling
    // into each step, a dip on every footfall.
    const pace = st === 'charge' ? 12 : 5;
    this.stride = moving ? this.stride + dt * pace : this.stride;
    const sw = moving ? Math.sin(this.stride) : 0;
    const legAmp = st === 'charge' ? 0.7 : 0.45;
    this.legs[0].rotation.x = MathUtils.damp(this.legs[0].rotation.x, sw * legAmp, 14, dt);
    this.legs[1].rotation.x = MathUtils.damp(this.legs[1].rotation.x, -sw * legAmp, 14, dt);
    const breathe = Math.sin(this.t * 1.6);
    // Arms: x (forward/back) and z (out from the side) for each pose. armL is the free hand,
    // armR carries the staff.
    let lx = breathe * 0.04;
    let lz = 0.05;
    let rx = -0.25 + breathe * 0.03;
    let rz = -0.08;
    if (moving) {
      lx = -sw * (st === 'charge' ? 0.9 : 0.55);
      rx = -0.35 + sw * (st === 'charge' ? 0.5 : 0.3);
      if (st === 'charge') {
        lz = 0.25;
        rz = -0.25;
      }
    }
    if (st === 'windup') {
      // Both fists high, the staff hoisted with them.
      lx = -2.9;
      rx = -2.7;
      lz = 0.15;
      rz = -0.15;
    } else if (st === 'rain') {
      // Staff thrust up to call the hexes down, the free hand spread.
      rx = -2.9;
      lx = -1.2;
      lz = 0.7;
    } else if (st === 'volley') {
      // Staff levelled at you, the free hand drawn back.
      rx = -1.45;
      lx = 0.4;
      lz = 0.3;
    } else if (stuck) {
      lx = -0.9;
      rx = -0.9;
    } else if (st === 'stagger') {
      lx = -0.6 + Math.sin(this.t * 18) * 0.3;
      rx = -0.6 + Math.cos(this.t * 18) * 0.3;
      lz = 0.8;
      rz = -0.8;
    } else if (st === 'brace') {
      lx = 0.5;
      rx = 0.3;
      lz = 0.35;
      rz = -0.35;
    }
    const k = st === 'windup' || st === 'volley' ? 10 : 7;
    this.armL.rotation.x = MathUtils.damp(this.armL.rotation.x, lx, k, dt);
    this.armR.rotation.x = MathUtils.damp(this.armR.rotation.x, rx, k, dt);
    this.armL.rotation.z = MathUtils.damp(this.armL.rotation.z, lz, k, dt);
    this.armR.rotation.z = MathUtils.damp(this.armR.rotation.z, rz, k, dt);
    // Torso: twists and rolls into the stride; the head looks for you.
    this.body.rotation.y = MathUtils.damp(this.body.rotation.y, sw * 0.14, 10, dt);
    this.body.rotation.z = MathUtils.damp(this.body.rotation.z, moving ? Math.cos(this.stride) * 0.05 : breathe * 0.01, 10, dt);
    if (this.helm) {
      const p = this.ctx.player.pos;
      const look = MathUtils.clamp(angleDiff(this.root.rotation.y, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)), -0.7, 0.7);
      this.helm.rotation.y = MathUtils.damp(this.helm.rotation.y, st === 'dormant' ? breathe * 0.1 : look - this.body.rotation.y, 6, dt);
    }
    // The staff: upright in the hand, but on a spring, so it sways and lags behind the arm and
    // swings forward on each step; levelled at you for a volley; it slides down through the
    // grip when hoisted, so the lantern rides just over the helm.
    const level = st === 'volley' ? 1.35 : 0;
    const upright = -this.armR.rotation.x - this.body.rotation.x;
    const target = upright + level + (moving ? Math.cos(this.stride) * 0.18 : 0) + (stuck ? -0.25 : 0);
    this.staffVel += ((target - this.staff.rotation.x) * 90 - this.staffVel * 11) * dt;
    this.staff.rotation.x += this.staffVel * dt;
    this.staff.rotation.z = MathUtils.damp(this.staff.rotation.z, -this.armR.rotation.z + (moving ? sw * 0.06 : 0), 8, dt);
    const hoisted = st === 'windup' || st === 'rain' ? 1 : 0;
    this.staffSlide = MathUtils.damp(this.staffSlide, hoisted, 6, dt);
    // Along the staff's own axis (the arm's frame is upside down when it's raised overhead).
    this.staff.position.copy(this.staffGrip).addScaledVector(STAFF_UP.set(0, 1, 0).applyEuler(this.staff.rotation), -this.staffSlide * (1.7 / SCALE));
    // The staff's crystal glows for the hex rain and volleys.
    this.crystal.emissiveIntensity = this.state === 'rain' || this.state === 'volley' ? 4 + Math.sin(this.t * 25) : 1.8;
    const lean = stuck ? 0.45 : this.state === 'stagger' ? -0.3 : this.state === 'brace' || this.state === 'charge' ? 0.5 : 0;
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, lean, 8, dt);
    // A dip on every footfall; a slow breath standing still.
    this.body.position.y = this.bodyY + (this.state === 'stalk' || this.state === 'charge' ? (Math.abs(Math.cos(this.stride)) - 1) * 0.05 : Math.sin(this.t * 1.6) * 0.012);
    const flare = this.state === 'windup' || this.state === 'brace' || this.state === 'charge';
    this.visor.emissiveIntensity = flare ? 3 + Math.sin(this.t * 30) : this.state === 'dormant' ? 0.3 : 1.2;
    // The visor reddens as it gets angrier.
    this.visor.emissive.set(this.hp <= 2 ? '#ff3a18' : this.hp <= 4 ? '#ff6a18' : '#ff9a20');
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
