import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import { mergeChildren } from '../world/merge';
import type { Entity, Interactable, SpecOf, WorldContext } from './types';

/*
 * The Bestiary's fittings, for looking at and fighting each foe in a room of its own (a dev
 * wing off the gym): a lever that drops or raises a room's portcullis, a bell that starts the
 * whole wing over (every foe fresh), and a lectern that holds a foe in one pose after another.
 */

function piece(g: Group, geo: BufferGeometry, color: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]): Mesh {
  const m = new Mesh(paint(geo.index ? geo.toNonIndexed() : geo, color, true), worldMaterial());
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = true;
  g.add(m);
  return m;
}

/** A lever on a post: E toggles its signal (a room's portcullis is shut while it's on). */
export class BestiaryLever implements Entity, Interactable {
  readonly radius = 1.5;
  private readonly pos: Vector3;
  private readonly handle = new Group();
  private on = false;

  constructor(
    private spec: SpecOf<'bestiaryLever'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = spec.yaw;
    piece(g, new BoxGeometry(0.3, 1.1, 0.3), COLORS.stoneDark, [0, 0.55, 0]);
    piece(g, new BoxGeometry(0.36, 0.08, 0.36), COLORS.stone, [0, 1.12, 0]);
    this.handle.position.set(0, 1.12, 0);
    piece(this.handle, new CylinderGeometry(0.035, 0.035, 0.7, 6), '#3a3340', [0, 0.35, 0]);
    piece(this.handle, new SphereGeometry(0.08, 8, 6), '#b0362f', [0, 0.72, 0]);
    g.add(this.handle);
    mergeChildren(g, [this.handle]);
    ctx.scene.add(g);
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.2, 0));
  }
  prompt(): string {
    return this.on ? 'Raise the portcullis' : 'Drop the portcullis';
  }
  interact(): void {
    this.on = !this.on;
    this.ctx.signals.set(this.spec.signal, this.on);
  }
  frameUpdate(): void {
    this.handle.rotation.x = this.on ? 0.7 : -0.7;
  }
}

/** A hand bell on a stand: E starts the wing over at this room (every foe fresh). */
export class BestiaryBell implements Interactable {
  readonly radius = 1.5;
  private readonly pos: Vector3;

  constructor(
    private spec: SpecOf<'bestiaryBell'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    const g = new Group();
    g.position.copy(this.pos);
    piece(g, new CylinderGeometry(0.05, 0.07, 1.3, 6), '#3a3340', [0, 0.65, 0]);
    piece(g, new BoxGeometry(0.5, 0.05, 0.05), '#3a3340', [0, 1.3, 0]);
    piece(g, new CylinderGeometry(0.06, 0.2, 0.28, 10, 1, true), '#c99a3e', [0.2, 1.12, 0]);
    piece(g, new TorusGeometry(0.2, 0.025, 4, 12), '#a07a2e', [0.2, 0.98, 0], [Math.PI / 2, 0, 0]);
    mergeChildren(g);
    ctx.scene.add(g);
    ctx.interactables.add(this);
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.1, 0));
  }
  prompt(): string {
    return 'Ring: start this room over';
  }
  interact(): void {
    this.ctx.events.emit('rattleClang', { pos: this.pos.clone() });
    this.ctx.changeLevel(this.ctx.levelId, this.spec.spawn);
  }
}

/** What the lectern drives on a foe: its AI state, or a pose of its own if it has one. */
interface Poseable extends Entity {
  /** Where it is (rooted ones, like the Snapweed, keep a `base` instead). */
  pos?: Vector3;
  base?: Vector3;
  state?: string;
  debugPose?(pose: string | null): void;
}

/**
 * A lectern with an open book: E holds the nearest foe of its kind in the next pose (its AI
 * paused, its animation still running), and after the last one lets it loose again.
 */
export class BestiaryPose implements Interactable {
  readonly radius = 1.5;
  private readonly pos: Vector3;
  private readonly at: Vector3;
  private index = -1;

  constructor(
    private spec: SpecOf<'bestiaryPose'>,
    private ctx: WorldContext,
  ) {
    this.pos = new Vector3(...spec.pos);
    this.at = new Vector3(...spec.at);
    const g = new Group();
    g.position.copy(this.pos);
    g.rotation.y = spec.yaw;
    piece(g, new CylinderGeometry(0.08, 0.14, 1.0, 6), COLORS.woodDark, [0, 0.5, 0]);
    piece(g, new BoxGeometry(0.6, 0.06, 0.42), COLORS.wood, [0, 1.03, 0], [-0.35, 0, 0]);
    piece(g, new BoxGeometry(0.54, 0.03, 0.36), '#f3e4c4', [0, 1.07, 0.01], [-0.35, 0, 0]);
    piece(g, new ConeGeometry(0.05, 0.1, 6), '#b0362f', [0.22, 1.13, -0.12]);
    mergeChildren(g);
    ctx.scene.add(g);
    ctx.interactables.add(this);
  }

  private subject(): Poseable | null {
    let best: Poseable | null = null;
    let bestD = Infinity;
    for (const e of this.ctx.world?.entities ?? []) {
      const p = e as Poseable;
      const at = p.pos ?? p.base;
      if (e.constructor.name !== this.spec.subject || !at) continue;
      const d = at.distanceTo(this.at);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  position(out: Vector3): Vector3 {
    return out.copy(this.pos).add(new Vector3(0, 1.1, 0));
  }
  prompt(): string {
    const now = this.index < 0 ? 'free' : this.spec.poses[this.index];
    const next = this.index + 1 < this.spec.poses.length ? this.spec.poses[this.index + 1] : 'free';
    return `${this.spec.subject}: ${now} (next: ${next})`;
  }
  interact(): void {
    const e = this.subject();
    const world = this.ctx.world;
    if (!e || !world) return;
    this.index = this.index + 1 < this.spec.poses.length ? this.index + 1 : -1;
    const pose = this.index < 0 ? null : this.spec.poses[this.index];
    if (e.debugPose) e.debugPose(pose);
    else if (pose) e.state = pose;
    if (pose) world.held.add(e);
    else world.held.delete(e);
    this.ctx.fx.burst(this.pos.clone().add(new Vector3(0, 1.2, 0)), 8, new Color('#ffd86a'), 1.4, 0.08, 0.6);
  }
}
