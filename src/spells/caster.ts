import {
  AdditiveBlending,
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import { SPELLS, type SpellId } from '../data/spells';
import type { Tuning } from '../data/tuning';
import type { EventBus } from '../engine/events';
import type { Input } from '../engine/input';
import type { Physics } from '../engine/physics';
import type { PlayerController } from '../player/controller';
import type { Puffs } from '../player/effects';
import type { GameState } from '../state/gameState';
import type { SpellTarget, TargetRegistry } from './targets';

interface Bolt {
  mesh: Mesh;
  pos: Vector3;
  target: SpellTarget | null;
  end: Vector3;
  spell: SpellId | null;
  charge: number;
  from: Vector3;
}

const tmp = new Vector3();
const tmp2 = new Vector3();

/**
 * Context-sensitive casting. Each frame the caster soft-locks the best target near
 * the crosshair; clicking casts whichever spell that target responds to. Holding
 * the button on a chargeable target charges the spell; releasing fires it.
 */
export class Caster {
  current: SpellTarget | null = null;
  /** 0..1 while charging, otherwise 0. */
  charge = 0;
  charging = false;
  private pressed: SpellTarget | null = null;
  private holdTime = 0;
  private cooldown = 0;
  private bolts: Bolt[] = [];
  private boltGeo = new IcosahedronGeometry(0.13, 1);
  /** Lets the HUD know why a target can't be cast at. */
  currentUnknown = false;

  constructor(
    private scene: Scene,
    private camera: PerspectiveCamera,
    private input: Input,
    private physics: Physics,
    private player: PlayerController,
    private state: GameState,
    private targets: TargetRegistry,
    private events: EventBus,
    private tuning: Tuning,
    private fx: Puffs,
    private wandTip: (out: Vector3) => Vector3,
  ) {}

  update(dt: number): void {
    if (dt <= 0) return;
    this.cooldown -= dt;
    this.pickTarget(dt);
    this.handleInput(dt);
    this.updateBolts(dt);
  }

  // ---------------------------------------------------------------- targeting

  private pickTarget(dt: number): void {
    const c = this.tuning.cast;
    const camPos = this.camera.position;
    const camDir = this.camera.getWorldDirection(new Vector3());
    const chest = new Vector3(this.player.pos.x, this.player.pos.y + 0.35, this.player.pos.z);
    const cone = (c.aimCone * Math.PI) / 180;
    const canAct = this.player.mode !== 'reset' && !this.player.frozen;

    let best: SpellTarget | null = null;
    let bestScore = Infinity;
    for (const t of this.targets.all) {
      t.marker.state = 'hidden';
      if (!t.enabled() || !canAct) continue;
      const p = t.aimPoint(tmp);
      const dist = p.distanceTo(chest);
      if (dist > Math.max(c.range, c.markerRange)) continue;

      const v = tmp2.subVectors(p, camPos);
      const along = v.dot(camDir);
      if (along <= 0.5) continue;
      if (!this.visible(chest, p, dist, t)) continue;
      t.marker.setUnknown(!this.state.knows(t.spell));
      if (dist <= c.markerRange) t.marker.state = 'idle';
      if (dist > c.range) continue;

      const perp = v.addScaledVector(camDir, -along).length();
      const angle = Math.atan2(Math.max(0, perp - t.radius), along);
      if (angle > cone) continue;
      const score = angle + dist * 0.004;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }

    // While charging, stay locked to the target we started on if it's still valid.
    if (this.charging && this.pressed && this.targets.all.has(this.pressed) && this.pressed.enabled()) best = this.pressed;
    this.current = best;
    this.currentUnknown = !!best && !this.state.knows(best.spell);
    if (best) best.marker.state = 'targeted';
    for (const t of this.targets.all) t.marker.update(dt);
  }

  private visible(from: Vector3, to: Vector3, dist: number, t: SpellTarget): boolean {
    const dir = new Vector3().subVectors(to, from).divideScalar(Math.max(dist, 1e-4));
    const hit = this.physics.raycast(from, dir, dist, this.player.collider);
    return !hit || t.owns(hit.collider) || hit.distance > dist - t.radius * 0.8;
  }

  // ---------------------------------------------------------------- input & charging

  private handleInput(dt: number): void {
    const c = this.tuning.cast;
    const press = this.input.consumeCastPress();
    const release = this.input.consumeCastRelease();
    const held = this.input.castHeld();

    if (press && this.cooldown <= 0 && this.player.mode !== 'reset' && !this.player.frozen) {
      const t = this.current;
      if (!t) {
        this.fizzle();
      } else if (!this.state.knows(t.spell)) {
        this.events.emit('toast', { text: `You haven't learned ${SPELLS[t.spell].name} yet.`, kind: 'hint' });
        this.fizzle(t.aimPoint(new Vector3()), 'unknownSpell');
      } else if (!SPELLS[t.spell].chargeable) {
        this.fire(t, 0);
      } else {
        this.pressed = t;
        this.holdTime = 0;
      }
    }

    if (this.pressed) {
      if (held && !release) {
        this.holdTime += dt;
        if (!this.charging && this.holdTime > c.tapTime) {
          this.charging = true;
          this.events.emit('chargeStart', { spell: this.pressed.spell });
        }
        if (this.charging) {
          this.charge = Math.min(1, (this.holdTime - c.tapTime) / c.chargeTime);
          this.player.faceOverride = this.faceYaw(this.pressed);
        }
      } else {
        const t = this.pressed.enabled() ? this.pressed : this.current;
        if (t && this.state.knows(t.spell)) this.fire(t, this.charging ? this.charge : 0);
        this.pressed = null;
        this.charging = false;
        this.charge = 0;
      }
    }
    this.player.speedScale = this.charging ? c.chargeMoveScale : 1;
    if (!this.charging && !this.pressed) this.player.faceOverride = null;
  }

  private faceYaw(t: SpellTarget): number {
    const p = t.aimPoint(new Vector3());
    return Math.atan2(p.x - this.player.pos.x, p.z - this.player.pos.z);
  }

  // ---------------------------------------------------------------- bolts

  private fire(t: SpellTarget, charge: number): void {
    this.cooldown = this.tuning.cast.cooldown;
    this.player.facing = this.faceYaw(t);
    const from = this.wandTip(new Vector3());
    const to = t.aimPoint(new Vector3());
    this.spawnBolt(from, to, t, t.spell, charge);
    this.events.emit('cast', { spell: t.spell, charge, from: from.clone(), to: to.clone() });
  }

  private fizzle(at?: Vector3, reason: 'noTarget' | 'unknownSpell' = 'noTarget'): void {
    this.cooldown = this.tuning.cast.cooldown;
    let end = at;
    if (!end) {
      const dir = this.camera.getWorldDirection(new Vector3());
      const hit = this.physics.raycast(this.camera.position, dir, 30, this.player.collider);
      end = hit ? hit.point : this.camera.position.clone().addScaledVector(dir, 18);
    }
    const from = this.wandTip(new Vector3());
    this.player.facing = Math.atan2(end.x - this.player.pos.x, end.z - this.player.pos.z);
    this.spawnBolt(from, end, null, null, 0);
    this.events.emit('fizzle', { pos: end.clone(), reason });
  }

  private spawnBolt(from: Vector3, to: Vector3, target: SpellTarget | null, spell: SpellId | null, charge: number): void {
    const color = new Color(spell ? SPELLS[spell].color : '#c8c0b8');
    const mesh = new Mesh(
      this.boltGeo,
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }),
    );
    mesh.scale.setScalar(1 + charge * 1.2);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.bolts.push({ mesh, pos: from.clone(), target, end: to.clone(), spell, charge, from: this.player.pos.clone() });
  }

  private updateBolts(dt: number): void {
    const speed = this.tuning.cast.boltSpeed;
    this.bolts = this.bolts.filter((b) => {
      if (b.target && this.targets.all.has(b.target)) b.target.aimPoint(b.end);
      const to = tmp.subVectors(b.end, b.pos);
      const d = to.length();
      const step = speed * dt;
      const color = (b.mesh.material as MeshBasicMaterial).color;
      if (d > step) {
        b.pos.addScaledVector(to, step / d);
        b.mesh.position.copy(b.pos);
        b.mesh.rotation.x += dt * 9;
        b.mesh.rotation.y += dt * 7;
        this.fx.burst(b.pos, 1, color, 0.3, 0.06 + b.charge * 0.05, 0.1);
        return true;
      }
      // Arrived.
      this.scene.remove(b.mesh);
      (b.mesh.material as MeshBasicMaterial).dispose();
      if (b.target && b.spell && this.targets.all.has(b.target)) {
        const dir = new Vector3(b.end.x - b.from.x, 0, b.end.z - b.from.z);
        if (dir.lengthSq() < 1e-6) dir.set(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
        dir.normalize();
        b.target.onSpell({ spell: b.spell, charge: b.charge, from: b.from, dir });
        this.events.emit('spellHit', { spell: b.spell, charge: b.charge, pos: b.end.clone() });
        this.fx.burst(b.end, 10 + Math.round(b.charge * 12), color, 3 + b.charge * 3, 0.12, 1.5);
      } else {
        this.fx.burst(b.end, 6, color, 1.5, 0.08, 0.8);
      }
      return false;
    });
  }
}
