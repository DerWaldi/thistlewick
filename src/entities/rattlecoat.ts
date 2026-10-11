import RAPIER from '@dimforge/rapier3d-compat';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  Matrix4,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeChildren } from '../world/merge';
import { dressWith, modelIslands, type Island } from './models';
import { POINTS } from '../data/houses';
import { angleDiff } from '../player/controller';
import { DizzyStars, HitFlash } from './creatureFx';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import type { Entity, SpecOf, WorldContext } from './types';

type State = 'dormant' | 'approach' | 'windup' | 'swing' | 'brace' | 'charge' | 'recover' | 'stagger' | 'toppled' | 'rising' | 'collapsed';

const HALF = 0.55;
const R = 0.45;
const CENTER_TO_FEET = HALF + R;
const WALK_SPEED = 2.8;
/** The charge: braced, then a straight dash at you from a few metres off. */
const CHARGE_SPEED = 9;
const CHARGE_RANGE: [number, number] = [4, 13];
const REACH = 2.3;
/** Once engaged, it keeps after you this far outside its arena (knockback shouldn't end the fight). */
const LEASH = 12;
/** Provoked (hit, or its Gnarlings are gone), it hunts you much further. */
const LEASH_PROVOKED = 30;
/** A tap just clangs off; it takes a charged Thwackwort to knock one over. */
const CHARGE_TO_TOPPLE = 0.6;
const MAX_HP = 2;

/**
 * Rattlecoat: an empty suit of armour that clanks after intruders. Telegraphed (it raises
 * its sword and its visor glows), and too sturdy for a quick Thwackwort: a charged one
 * topples it. Topple it twice and it falls apart for good, setting the signal `id`.
 * It wakes when you step into its arena, when a spell hits it, or when the last Gnarling in
 * its arena is gone; from a distance it braces and charges at you.
 */
export class Rattlecoat implements Entity, SpellTarget {
  readonly spell = 'thwackwort' as const;
  readonly marker: RuneMarker;
  readonly radius = 0.7;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private readonly pos: Vector3;
  private readonly prev: Vector3;
  private readonly home: Vector3;
  private facing: number;
  private state: State = 'dormant';
  private timer = 0;
  private hp = MAX_HP;
  private hitThisSwing = false;
  private toppleDir = new Vector3();
  private hintShown = false;
  private t = 0;
  private vy = 0;
  private provoked = false;
  private hadGnarlings = false;
  private chargeIn = 1.5;
  private chargeDir = new Vector3();

  private root = new Group();
  private body = new Group();
  private armR = new Group();
  private armL = new Group();
  private legL = new Group();
  private legR = new Group();
  private visor: MeshStandardMaterial;
  private tabard: Group[] = [];
  private readonly stars = new DizzyStars(0, 0.4, 1.4);
  private flash!: HitFlash;
  private stepSign = 0;
  private shownState = '';

  constructor(
    private spec: SpecOf<'rattlecoat'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(spec.pos[0], spec.pos[1] + CENTER_TO_FEET, spec.pos[2]);
    this.prev = this.pos.clone();
    this.home = this.pos.clone();
    this.facing = spec.yaw;
    this.collider = ctx.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF, R).setTranslation(this.pos.x, this.pos.y, this.pos.z),
    );
    ctx.physics.setInfo(this.collider, { noGrab: true });
    this.kcc = ctx.physics.world.createCharacterController(0.02);
    this.kcc.enableSnapToGround(0.3);
    this.visor = new MeshStandardMaterial({ color: '#2a2230', emissive: new Color('#ff8a2a'), emissiveIntensity: 0.6 });
    this.build();
    const model = modelIslands('rattlecoat');
    if (model) this.wear(model);
    this.flash = new HitFlash(this.root);
    ctx.scene.add(this.stars);
    ctx.scene.add(this.root);
    this.marker = new RuneMarker(ctx.scene, 'thwackwort', 0.7);
    ctx.targets.add(this);
  }

  /**
   * An undead knight: dark plate over pale bones (thighs, upper arms, ribs and neck show
   * between the plates), a tattered crimson tabard that swings as it walks, a crested helm with
   * an orange visor slit, an old sword and a kite shield.
   */
  private build(): void {
    // (Low metalness: there's no environment map, so very metallic plate renders black.)
    const plate = new MeshStandardMaterial({ color: '#676a7a', metalness: 0.35, roughness: 0.45, flatShading: true });
    const trim = new MeshStandardMaterial({ color: '#a8aab4', metalness: 0.4, roughness: 0.3, flatShading: true });
    const bone = new MeshStandardMaterial({ color: '#d9cdb0', roughness: 0.85, flatShading: true });
    const cloth = new MeshStandardMaterial({ color: '#8a1e2a', roughness: 0.95, flatShading: true, side: DoubleSide });
    const leather = new MeshStandardMaterial({ color: '#4a3020', roughness: 0.9, flatShading: true });
    const gold = new MeshStandardMaterial({ color: '#d4a548', metalness: 0.4, roughness: 0.35, flatShading: true });
    const add = (parent: Group, geo: BufferGeometry, mat: MeshStandardMaterial, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
      const m = new Mesh(geo, mat);
      m.position.set(...p);
      m.rotation.set(...r);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Legs: a bone thigh, a plated knee, a greave and an armoured boot.
    for (const [leg, x] of [
      [this.legL, 0.17],
      [this.legR, -0.17],
    ] as const) {
      leg.position.set(x, 0.85, 0);
      add(leg, new CylinderGeometry(0.045, 0.055, 0.36, 6), bone, [0, -0.2, 0]);
      add(leg, new SphereGeometry(0.075, 6, 5), bone, [0, -0.02, 0]);
      add(leg, new IcosahedronGeometry(0.1, 0), plate, [0, -0.4, 0.04]);
      add(leg, new CylinderGeometry(0.1, 0.085, 0.34, 7), plate, [0, -0.6, 0]);
      add(leg, new BoxGeometry(0.2, 0.11, 0.34), plate, [0, -0.8, 0.06]);
      add(leg, new ConeGeometry(0.035, 0.12, 4), trim, [0, -0.72, 0.21], [Math.PI / 2, 0, 0]);
      mergeChildren(leg);
      this.root.add(leg);
    }

    this.body.position.y = 0.85;
    this.root.add(this.body);
    // Pelvis and spine bones, a ribcage either side of the tabard.
    add(this.body, new CylinderGeometry(0.2, 0.16, 0.12, 7), bone, [0, 0.04, 0]);
    add(this.body, new CylinderGeometry(0.035, 0.035, 0.5, 5), bone, [0, 0.3, -0.12]);
    for (let i = 0; i < 4; i++) {
      const y = 0.32 + i * 0.09;
      add(this.body, new TorusGeometry(0.2 - i * 0.008, 0.018, 4, 10, Math.PI * 1.1), bone, [0, y, -0.02], [Math.PI / 2, 0, Math.PI * 0.95]);
    }
    // The breastplate over the top of the chest, a spiked gorget, a belt with a gold buckle.
    add(this.body, new BoxGeometry(0.58, 0.34, 0.36), plate, [0, 0.74, 0.02]);
    add(this.body, new BoxGeometry(0.6, 0.05, 0.38), trim, [0, 0.58, 0.02]);
    add(this.body, new CylinderGeometry(0.16, 0.22, 0.14, 8), plate, [0, 0.96, 0]);
    add(this.body, new BoxGeometry(0.5, 0.08, 0.32), leather, [0, 0.16, 0.02]);
    add(this.body, new BoxGeometry(0.1, 0.09, 0.04), gold, [0, 0.16, 0.19]);
    // Spiked pauldrons.
    for (const x of [0.36, -0.36]) {
      add(this.body, new SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.6), plate, [x, 0.86, 0], [0, 0, x > 0 ? -0.4 : 0.4]);
      add(this.body, new ConeGeometry(0.05, 0.22, 4), trim, [x * 1.15, 1.02, 0], [0, 0, x > 0 ? -0.5 : 0.5]);
    }

    // The tabard, front and back: a crimson cloth hanging from the belt, its hem torn into tongues.
    for (const [z, flip] of [
      [0.2, 0],
      [-0.17, Math.PI],
    ] as const) {
      const panel = new Group();
      panel.position.set(0, 0.62, z);
      panel.rotation.y = flip;
      add(panel, new PlaneGeometry(0.36, 0.5), cloth, [0, 0, 0]);
      add(panel, new PlaneGeometry(0.34, 0.62), cloth, [0, -0.6, 0]);
      for (let i = 0; i < 4; i++) {
        const len = 0.18 + ((i * 7) % 3) * 0.08;
        add(panel, new ConeGeometry(0.045, len, 3).scale(1, 1, 0.15).rotateX(Math.PI), cloth, [-0.13 + i * 0.087, -0.91 - len / 2, 0]);
      }
      add(panel, new BoxGeometry(0.05, 0.3, 0.01), gold, [0, -0.45, 0.01]);
      mergeChildren(panel);
      this.tabard.push(panel);
      this.body.add(panel);
    }

    // The helm: tall and dark, a crimson crest from brow to nape, an orange visor slit.
    const helm = new Group();
    helm.position.y = 1.18;
    this.body.add(helm);
    add(helm, new CylinderGeometry(0.035, 0.035, 0.14, 5), bone, [0, -0.08, 0]);
    add(helm, new CylinderGeometry(0.18, 0.2, 0.38, 8), plate, [0, 0.14, 0]);
    add(helm, new SphereGeometry(0.18, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), plate, [0, 0.33, 0]);
    add(helm, new BoxGeometry(0.08, 0.3, 0.06), trim, [0, 0.12, 0.18]);
    for (const x of [-0.1, 0.1]) add(helm, new BoxGeometry(0.1, 0.16, 0.05), trim, [x, 0.04, 0.17]);
    add(helm, new BoxGeometry(0.28, 0.05, 0.05), this.visor, [0, 0.17, 0.19]);
    // A tall crest of crimson bristles over the top, brow to nape.
    for (let i = 0; i < 7; i++) {
      const h = 0.42 - Math.abs(i - 3) * 0.06;
      add(helm, new ConeGeometry(0.06, h, 4).scale(0.5, 1, 1), cloth, [0, 0.42 + h / 2, 0.18 - i * 0.06], [-0.45 + i * 0.15, 0, 0]);
    }
    mergeChildren(helm, [helm.children.find((c) => (c as Mesh).material === this.visor)!]);

    // Arms: a bone upper arm, a plated elbow, a gauntlet.
    for (const [arm, x] of [
      [this.armL, 0.42],
      [this.armR, -0.42],
    ] as const) {
      arm.position.set(x, 0.85, 0);
      add(arm, new CylinderGeometry(0.035, 0.04, 0.28, 5), bone, [0, -0.15, 0]);
      add(arm, new IcosahedronGeometry(0.075, 0), plate, [0, -0.32, 0]);
      add(arm, new CylinderGeometry(0.08, 0.065, 0.28, 7), plate, [0, -0.48, 0]);
      add(arm, new SphereGeometry(0.075, 6, 4), plate, [0, -0.64, 0]);
      this.body.add(arm);
    }
    // An old notched sword in the right hand.
    add(this.armR, new BoxGeometry(0.06, 0.035, 1.05), trim, [0, -0.66, 0.58]);
    add(this.armR, new BoxGeometry(0.28, 0.05, 0.06), gold, [0, -0.66, 0.06]);
    add(this.armR, new CylinderGeometry(0.025, 0.025, 0.16, 5), leather, [0, -0.66, -0.04], [Math.PI / 2, 0, 0]);
    // A kite shield on the left arm, with a pale thistle on its face.
    const shield = new Shape();
    shield.moveTo(0, 0.3);
    shield.lineTo(0.22, 0.22);
    shield.lineTo(0.2, -0.05);
    shield.lineTo(0, -0.36);
    shield.lineTo(-0.2, -0.05);
    shield.lineTo(-0.22, 0.22);
    shield.closePath();
    const sg = new ExtrudeGeometry(shield, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    // Held across the front of the body, its face forward.
    add(this.armL, sg, plate, [-0.08, -0.5, 0.14]);
    // The thistle: a stem, two leaves, a round head with a spiky crown.
    add(this.armL, new BoxGeometry(0.03, 0.26, 0.02), bone, [-0.08, -0.6, 0.235]);
    for (const side of [-1, 1]) add(this.armL, new ConeGeometry(0.03, 0.14, 3).scale(1, 1, 0.3), bone, [-0.08 + side * 0.06, -0.62, 0.235], [0, 0, side * -1.1]);
    add(this.armL, new SphereGeometry(0.06, 6, 4).scale(1, 1, 0.4), bone, [-0.08, -0.44, 0.235]);
    for (let i = 0; i < 5; i++) add(this.armL, new ConeGeometry(0.018, 0.1, 3).scale(1, 1, 0.3), bone, [-0.08 + (i - 2) * 0.025, -0.36, 0.235], [0, 0, (i - 2) * -0.35]);
    mergeChildren(this.armL);
    mergeChildren(this.armR);
    mergeChildren(this.body, [helm, this.armL, this.armR, ...this.tabard]);
  }

  /** Wear the knight model: each piece goes to the limb, helm or tabard panel it belongs to. */
  private wear(model: Island[]): void {
    let helm: Object3D = this.body;
    this.body.traverse((o) => {
      if ((o as Mesh).material === this.visor) helm = o.parent!;
    });
    // Pivots at the model's own joints: hips at 1.0, shoulders at 1.55.
    this.legL.position.set(0.15, 1.0, 0);
    this.legR.position.set(-0.15, 1.0, 0);
    this.armL.position.set(0.42, 0.7, 0);
    this.armR.position.set(-0.42, 0.7, 0);
    const tabard = (i: Island) => (i.mat === 'mat_b01622' || i.mat === 'mat_840f1a') && Math.abs(i.center.z) >= 0.12 && i.center.y < 1.62 && Math.abs(i.center.x) < 0.14;
    dressWith(this.root, model, new Matrix4(), (i) => {
      const { x, y } = i.center;
      if (i.mat === 'glow_ff8a1a') return { part: helm, material: this.visor };
      if (tabard(i)) return { part: this.tabard[i.center.z > 0 ? 0 : 1] };
      if (y > 1.72 || (y > 1.64 && Math.abs(x) < 0.17)) return { part: helm };
      if (Math.abs(x) > 0.3 && y < 1.45) return { part: x > 0 ? this.armL : this.armR };
      if (Math.abs(x) > 0.05 && Math.abs(x) < 0.3 && y < 1.05 && !(y > 0.94 && i.mat === 'mat_eadcb6' && i.max.y - i.min.y < 0.2)) return { part: x > 0 ? this.legL : this.legR };
      return { part: this.body };
    });
  }

  // ---------------------------------------------------------------- SpellTarget

  aimPoint(out: Vector3): Vector3 {
    return out.set(this.pos.x, this.pos.y + 0.4, this.pos.z);
  }
  enabled(): boolean {
    return this.state !== 'collapsed' && this.state !== 'toppled' && this.state !== 'rising';
  }
  owns(c: RAPIER.Collider): boolean {
    return c.handle === this.collider.handle;
  }

  onSpell(hit: SpellHit): void {
    this.provoked = true;
    if (hit.charge < CHARGE_TO_TOPPLE) {
      // Clang! Just a stagger.
      this.state = 'stagger';
      this.timer = 0.45;
      this.flash.flash();
      this.ctx.events.emit('rattleClang', { pos: this.pos.clone() });
      if (!this.hintShown) {
        this.hintShown = true;
        this.ctx.events.emit('toast', { text: 'Too sturdy! Hold the button to charge Thwackwort.', kind: 'hint' });
      }
      return;
    }
    this.hp--;
    this.toppleDir.copy(hit.dir);
    this.flash.flash();
    this.facing = Math.atan2(-hit.dir.x, -hit.dir.z);
    this.ctx.events.emit('rattleTopple', { pos: this.pos.clone() });
    if (this.hp <= 0) {
      this.collapse();
      return;
    }
    this.state = 'toppled';
    this.timer = 3.2;
  }

  private collapse(): void {
    this.state = 'collapsed';
    this.ctx.targets.remove(this);
    this.ctx.physics.world.removeCollider(this.collider, false);
    this.ctx.signals.set(this.spec.id, true);
    // Only castle Rattlecoats stay down for good; in a trial it's back with its Gnarlings
    // whenever the room is (a reload at a checkpoint, say).
    if (this.spec.persist) this.ctx.state.flags.add(`down:${this.spec.id}`);
    this.ctx.state.award(POINTS.rattlecoat, 'toppling a Rattlecoat');
    this.ctx.sweets.burst('humbug', this.pos.clone(), 1);
    this.ctx.sweets.burst('bramble', this.pos.clone(), 2);
    // Every piece flies off on its own, and the heap lies there a while.
    this.stars.visible = false;
    this.ctx.debris.crumble(this.root, { from: this.pos.clone(), push: this.toppleDir.clone().multiplyScalar(2), speed: 3, up: 4.5, life: 7 });
    this.root.visible = false;
    this.ctx.events.emit('rattleCollapse', { pos: this.pos.clone() });
  }

  // ---------------------------------------------------------------- behaviour

  /** True once the Gnarlings of its room (any within 16 m of its post, if it had any) are all gone. */
  private gnarlingsGone(): boolean {
    let live = 0;
    for (const c of this.ctx.creatures) {
      if (c.constructor.name !== 'Gnarling') continue;
      if (Math.hypot(c.pos.x - this.home.x, c.pos.z - this.home.z) < 16 && Math.abs(c.pos.y - this.home.y) < 6) live++;
    }
    if (live > 0) this.hadGnarlings = true;
    return this.hadGnarlings && live === 0;
  }

  /** Is there floor (no more than a step down) just ahead in this direction? */
  private groundAhead(yaw: number): boolean {
    const o = new Vector3(this.pos.x + Math.sin(yaw) * (R + 0.35), this.pos.y, this.pos.z + Math.cos(yaw) * (R + 0.35));
    return this.ctx.physics.raycast(o, new Vector3(0, -1, 0), CENTER_TO_FEET + 0.7, this.collider, (c) => c.handle !== this.ctx.player.collider.handle) !== null;
  }

  private playerInArena(): boolean {
    const p = this.ctx.player.pos;
    const { min, max } = this.spec.arena;
    return p.x > min[0] && p.x < max[0] && p.y > min[1] && p.y < max[1] && p.z > min[2] && p.z < max[2];
  }

  fixedUpdate(dt: number): void {
    if (this.state === 'collapsed') return;
    this.prev.copy(this.pos);
    this.t += dt;
    this.timer -= dt;
    const player = this.ctx.player;
    const to = new Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = to.length();
    const faceYaw = Math.atan2(to.x, to.z);
    const available = player.mode !== 'reset' && !this.ctx.health.fainting;
    if (!this.provoked && this.gnarlingsGone()) this.provoked = true;
    const chasing = this.state !== 'dormant' && dist < (this.provoked ? LEASH_PROVOKED : LEASH);
    const engaged = available && (this.playerInArena() || chasing || (this.provoked && dist < LEASH_PROVOKED));
    this.chargeIn -= dt;
    let walk = 0;
    let walkYaw = this.facing;

    switch (this.state) {
      case 'dormant': {
        const back = new Vector3(this.home.x - this.pos.x, 0, this.home.z - this.pos.z);
        if (back.length() > 0.3) {
          walk = WALK_SPEED;
          walkYaw = Math.atan2(back.x, back.z);
        } else {
          walkYaw = this.spec.yaw;
        }
        if (engaged) this.state = 'approach';
        break;
      }
      case 'approach':
        if (!engaged) {
          this.state = 'dormant';
          break;
        }
        walkYaw = faceYaw;
        if (dist < REACH && Math.abs(angleDiff(this.facing, faceYaw)) < 0.5) {
          this.state = 'windup';
          this.timer = 0.75;
        } else if (this.chargeIn <= 0 && dist > CHARGE_RANGE[0] && dist < CHARGE_RANGE[1] && Math.abs(angleDiff(this.facing, faceYaw)) < 0.35) {
          // Lowers its sword, stamps, and comes at you.
          this.state = 'brace';
          this.timer = 0.6;
        } else if (dist > 1.5) {
          walk = WALK_SPEED;
        }
        break;
      case 'brace':
        walkYaw = faceYaw;
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 0.85;
          this.hitThisSwing = false;
          this.chargeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
        }
        break;
      case 'charge':
        walk = CHARGE_SPEED;
        walkYaw = this.facing;
        if (!this.hitThisSwing && dist < 1.4) this.hitThisSwing = this.ctx.health.damage(1, this.pos.clone());
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1;
          this.chargeIn = 3.5;
        }
        break;
      case 'windup':
        walkYaw = faceYaw;
        if (this.timer <= 0) {
          this.state = 'swing';
          this.timer = 0.25;
          this.hitThisSwing = false;
        }
        break;
      case 'swing':
        // It steps into the blow, so backing off slowly isn't enough.
        walk = WALK_SPEED * 1.6;
        walkYaw = this.facing;
        if (!this.hitThisSwing && dist < REACH + 0.4 && Math.abs(angleDiff(this.facing, faceYaw)) < 0.9) {
          this.hitThisSwing = this.ctx.health.damage(1, this.pos.clone());
        }
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1.1;
        }
        break;
      case 'recover':
      case 'stagger':
        if (this.timer <= 0) this.state = engaged ? 'approach' : 'dormant';
        break;
      case 'toppled':
        if (this.timer <= 0) {
          this.state = 'rising';
          this.timer = 0.9;
        }
        break;
      case 'rising':
        if (this.timer <= 0) this.state = engaged ? 'approach' : 'dormant';
        break;
    }

    if (this.state !== 'toppled' && this.state !== 'rising' && this.state !== 'swing' && this.state !== 'charge') {
      this.facing += MathUtils.clamp(angleDiff(this.facing, walkYaw), -2.5 * dt, 2.5 * dt);
    }
    this.vy = this.vy - 20 * dt;
    if (walk > 0 && !this.groundAhead(walkYaw)) {
      // It won't step off a ledge, not even mid-charge: armour doesn't climb back out of pits.
      walk = 0;
      if (this.state === 'charge') {
        this.state = 'recover';
        this.timer = 1;
        this.chargeIn = 3.5;
      }
    }
    const desired = new Vector3(Math.sin(walkYaw) * walk * dt, this.vy * dt, Math.cos(walkYaw) * walk * dt);
    if (this.state === 'toppled' && this.timer > 2.8) desired.addScaledVector(this.toppleDir, 4 * dt);
    const ph = player.collider.handle;
    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.handle !== ph);
    const mv = this.kcc.computedMovement();
    this.pos.add(new Vector3(mv.x, mv.y, mv.z));
    if (this.kcc.computedGrounded()) this.vy = 0;
    this.collider.setTranslation(this.pos);
  }

  frameUpdate(dt: number, alpha: number): void {
    if (this.state === 'collapsed') return;
    const p = new Vector3().lerpVectors(this.prev, this.pos, alpha);
    this.root.position.set(p.x, p.y - CENTER_TO_FEET, p.z);
    this.root.rotation.y = this.facing;
    this.marker.sprite.position.set(p.x, p.y + 1.5, p.z);

    const walking = this.state === 'approach' || this.state === 'charge' || (this.state === 'dormant' && this.prev.distanceToSquared(this.pos) > 1e-6);
    const s = walking ? Math.sin(this.t * (this.state === 'charge' ? 14 : 6)) : 0;
    this.legL.rotation.x = s * 0.4;
    this.legR.rotation.x = -s * 0.4;
    this.armL.rotation.x = -s * 0.3;
    // Breathes in its armour when it stands still.
    this.body.position.y = 0.85 + Math.abs(s) * 0.04 + (walking ? 0 : Math.sin(this.t * 1.5) * 0.015);

    const raise = this.state === 'windup' ? -2.6 : this.state === 'swing' ? 0.6 : this.state === 'brace' || this.state === 'charge' ? -1.5 : -0.2 - s * 0.2;
    this.body.rotation.x = MathUtils.damp(this.body.rotation.x, this.state === 'brace' || this.state === 'charge' ? 0.35 : 0, 10, dt);
    this.armR.rotation.x = MathUtils.damp(this.armR.rotation.x, raise, this.state === 'swing' ? 30 : 8, dt);
    const lying = this.state === 'toppled' ? -1.5 : 0;
    this.root.rotation.x = MathUtils.damp(this.root.rotation.x, lying, this.state === 'toppled' ? 9 : 4, dt);
    if (this.state === 'stagger') this.body.rotation.z = Math.sin(this.t * 40) * 0.08;
    else this.body.rotation.z = 0;
    this.visor.emissiveIntensity = this.state === 'windup' || this.state === 'swing' || this.state === 'brace' || this.state === 'charge' ? 3 : this.state === 'toppled' ? 0 : 1;
    // The tabard swings with its stride, trails behind a charge, and flaps when it staggers.
    const flap = this.state === 'charge' ? -0.5 : this.state === 'stagger' ? Math.sin(this.t * 30) * 0.2 : s * 0.18 + Math.sin(this.t * 1.7) * 0.03;
    for (const [i, panel] of this.tabard.entries()) panel.rotation.x = MathUtils.damp(panel.rotation.x, i === 0 ? flap : -flap, 10, dt);
    // Stars over the helm while it lies there (outside the root, which is tipped over).
    const down = this.state === 'toppled';
    if (down) this.stars.position.copy(this.root.localToWorld(new Vector3(0, 1.6, 0))).add(new Vector3(0, 0.45, 0));
    this.stars.update(dt, down, this.t);
    this.flash.update(dt);
    // Sounds: a clanking footfall each time a foot comes down, a whoosh as the sword goes up.
    if (walking && s !== 0 && Math.sign(s) !== this.stepSign) {
      this.stepSign = Math.sign(s);
      this.ctx.events.emit('foeStep', { pos: this.pos.clone(), heavy: this.state === 'charge' ? 0.7 : 0.5 });
    }
    if (this.state !== this.shownState) {
      if (this.state === 'windup') this.ctx.events.emit('foeWindup', { pos: this.pos.clone(), kind: 'swing' });
      this.shownState = this.state;
    }
  }
}
