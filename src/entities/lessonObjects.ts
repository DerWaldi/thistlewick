import { Color, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Shape, Vector3 } from 'three';
import type { Entity, SpecOf, WorldContext } from './types';

/**
 * Runs a dialogue script once (per save) when the player walks into a box and/or
 * when a set of signals are all on. Sets `flag` so it never repeats.
 */
export class Trigger implements Entity {
  private fired = false;
  private held = 0;

  constructor(
    private spec: SpecOf<'trigger'>,
    private ctx: WorldContext,
  ) {}

  private conditionsHold(): boolean {
    const { spec, ctx } = this;
    if (spec.when && !ctx.signals.all(spec.when)) return false;
    if (spec.unlessSignals && spec.unlessSignals.some((id) => ctx.signals.get(id))) return false;
    if (spec.min && spec.max) {
      const p = ctx.player.pos;
      const [a, b] = [spec.min, spec.max];
      if (p.x < a[0] || p.x > b[0] || p.y < a[1] || p.y > b[1] || p.z < a[2] || p.z > b[2]) return false;
    }
    return true;
  }

  fixedUpdate(dt: number): void {
    const { spec, ctx } = this;
    if (this.fired || (!spec.perVisit && ctx.state.flags.has(spec.flag))) return;
    this.held = this.conditionsHold() ? this.held + dt : 0;
    if (this.held < (spec.delay ?? 0) || this.held === 0 || ctx.dialogue.isOpen) return;
    this.fired = true;
    if (!spec.perVisit) ctx.state.flags.add(spec.flag);
    if (spec.signal) ctx.signals.set(spec.signal, true);
    if (spec.script) void ctx.talk(spec.script);
  }
}

/** A five-pointed star, extruded and bevelled. */
function starGeometry(outer = 0.42, inner = 0.18): ExtrudeGeometry {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 });
  g.center();
  return g;
}

/** The Thistle Star at the end of a trial. Collecting it finishes the trial. */
export class ThistleStar implements Entity {
  private group = new Group();
  private light = new PointLight('#ffe08a', 4, 7, 1.5);
  private readonly pos: Vector3;
  private taken = false;
  private t = 0;

  constructor(
    private spec: SpecOf<'star'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const star = new Mesh(
      starGeometry(),
      new MeshStandardMaterial({ color: '#f5c04a', emissive: new Color('#ffb020'), emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.3, flatShading: true }),
    );
    star.castShadow = true;
    this.group.add(star, this.light);
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
  }

  fixedUpdate(): void {
    if (this.taken) return;
    // Generous: it floats over a pedestal, and walking up to it should be enough.
    const p = this.ctx.player.pos;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.3 && Math.abs(p.y - this.pos.y) < 1.8) {
      this.taken = true;
      this.group.visible = false;
      // Keep the light in the scene (dimmed) rather than removing it: no shader recompiles.
      this.light.intensity = 0;
      this.ctx.state.collected.add(this.spec.id);
      this.ctx.fx.burst(this.pos, 40, new Color('#ffe08a'), 4, 0.12, 2.5);
      this.ctx.events.emit('toast', { text: 'You found the Thistle Star!', kind: 'info' });
      if (this.spec.script) void this.ctx.talk(this.spec.script);
    }
  }

  frameUpdate(dt: number): void {
    if (this.taken) return;
    this.t += dt;
    this.group.rotation.y = this.t * 1.4;
    this.group.position.y = this.pos.y + Math.sin(this.t * 2) * 0.12;
    if (Math.random() < dt * 8) {
      const p = this.pos.clone().add(new Vector3((Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1));
      this.ctx.fx.burst(p, 1, new Color('#fff3c4'), 0.3, 0.05, 0.4);
    }
  }
}
