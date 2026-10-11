import { Group, Mesh, Vector3, type Material } from 'three';
import { SweetField } from './entities/sweets';
import { GlimmerField } from './world/glimmer';
import { HeatField } from './world/heat';
import type { Interactable } from './entities/types';
import type { EventBus } from './engine/events';
import { Physics } from './engine/physics';
import type { Game } from './game';
import { StudentAnimator } from './player/animator';
import { OrbitCamera } from './player/camera';
import { PlayerController } from './player/controller';
import { BlobShadow, Puffs } from './player/effects';
import { PlayerHealth } from './player/health';
import { buildStudent, type StudentRig } from './player/model';
import { Caster } from './spells/caster';
import { TargetRegistry } from './spells/targets';
import { LevelBuilder } from './world/builder';
import type { AreaDef, LevelDef, SpawnPoint } from './world/level';
import { Signals } from './world/signals';
import { World } from './world/world';
import { questGivers } from './data/quests';
import { wanderers } from './data/students';
import { Debris } from './entities/creatureFx';

/**
 * Everything that belongs to one loaded level: its physics world, geometry,
 * entities, the player body and camera rig. Disposing it removes all of that,
 * including event listeners (they're registered on a scoped bus).
 */
export class LevelSession {
  readonly events: EventBus;
  readonly root = new Group();
  readonly physics = new Physics();
  readonly builder: LevelBuilder;
  readonly player: PlayerController;
  readonly health: PlayerHealth;
  readonly rig: StudentRig;
  readonly camera: OrbitCamera;
  readonly caster: Caster;
  readonly world: World;
  readonly interactables = new Set<Interactable>();
  private animator: StudentAnimator;
  readonly shadow: BlobShadow;
  private puffs: Puffs;
  private debris: Debris;
  private area: AreaDef | null = null;
  /** The interactable whose prompt is showing. */
  focus: Interactable | null = null;
  private tooClose = false;

  constructor(
    private game: Game,
    readonly def: LevelDef,
    spawn: SpawnPoint,
  ) {
    this.events = game.events.scope();
    const scene = game.renderer.scene;
    scene.add(this.root);

    this.builder = new LevelBuilder(this.root, this.physics, def.id);
    def.build(this.builder);
    spawn = this.checkSavedCheckpoint(spawn, def.id);

    const feet = new Vector3(...spawn.pos);
    this.player = new PlayerController(this.physics, game.input, this.events, game.tuning, this.builder, feet);
    this.player.facing = spawn.yaw;
    this.health = new PlayerHealth(this.player, game.state, this.events, { pos: feet.clone(), yaw: spawn.yaw }, def.id);
    const hc = game.state.houseColor();
    this.rig = buildStudent({ scarf: hc.color, trim: hc.trim });
    this.root.add(this.rig.root);
    this.health.onBlink = (visible) => (this.rig.root.visible = visible && !this.tooClose);
    this.animator = new StudentAnimator(this.rig, this.player, this.events);
    this.camera = new OrbitCamera(game.renderer.camera, game.input, this.physics, game.tuning, this.player);
    this.camera.yaw = spawn.yaw;
    this.shadow = new BlobShadow(this.root, this.physics, this.player);
    this.puffs = new Puffs(this.root, this.events, this.player);
    this.debris = new Debris(this.root, this.physics);

    const targets = new TargetRegistry();
    const sweets = new SweetField(this.root, this.physics, this.player, game.state, game.tuning);
    this.world = new World({
      levelId: def.id,
      scene: this.root,
      physics: this.physics,
      events: this.events,
      tuning: game.tuning,
      player: this.player,
      health: this.health,
      state: game.state,
      signals: new Signals(this.events),
      targets,
      fx: this.puffs,
      debris: this.debris,
      sweets,
      glimmer: new GlimmerField(),
      heat: new HeatField(),
      creatures: new Set(),
      dialogue: game.dialogue,
      interactables: this.interactables,
      talk: (id) => game.runScript(id),
      say: (lines) => game.dialogue.run(lines),
      changeLevel: (level, spawnId) => game.requestLevel(level, spawnId),
      secretsIn: (area) => this.world.secretsIn(area),
    });
    // Students with errands stand at their level's NPC spots. They go after the level's own
    // specs, so the ids of placed pickups stay stable.
    this.world.spawnAll([...this.builder.entities, ...questGivers(def, game.state), ...wanderers(def)]);

    this.caster = new Caster(
      this.root,
      game.renderer.camera,
      game.input,
      this.physics,
      this.player,
      game.state,
      targets,
      this.events,
      game.tuning,
      this.puffs,
      (out) => this.rig.wandTip.getWorldPosition(out),
    );

    this.events.on('dialogueOpen', ({ open }) => {
      if (!this.health.fainting) this.player.frozen = open;
    });
    this.events.on('respawn', () => this.camera.snap());

    // Physics needs one step so the query pipeline knows about the static colliders.
    this.physics.step();
  }

  fixedUpdate(dt: number): void {
    this.builder.fixedUpdate(dt);
    this.world.fixedUpdate(dt);
    this.debris.fixedUpdate(dt);
    this.player.update(dt, this.camera.yaw);
    this.health.update(dt);
    this.builder.applyMovers();
    this.world.lateFixedUpdate();
    this.physics.step();
    this.updateArea();
  }

  frameUpdate(dt: number, alpha: number): void {
    this.camera.update(dt, alpha);
    this.animator.charge = this.caster.charge;
    this.animator.update(dt, alpha);
    this.builder.frameUpdate(dt, alpha);
    this.world.frameUpdate(dt, alpha);
    this.caster.update(dt);
    this.puffs.update(dt);
    this.shadow.update(alpha);
    // When walls push the camera right up against the student, hide them rather than
    // filling the screen with robe. (Blinking after damage also drives `visible`.)
    const head = this.rig.root.position.clone().add(new Vector3(0, 1.2, 0));
    this.tooClose = this.game.renderer.camera.position.distanceTo(head) < 0.95;
    if (this.tooClose) this.rig.root.visible = false;
    else if (!this.health.blinking) this.rig.root.visible = true;
    this.updateFocus();
  }

  /** Nearest interactable in front of the player, within its radius. */
  private updateFocus(): void {
    let best: Interactable | null = null;
    let bestD = Infinity;
    if (!this.game.dialogue.isOpen && this.player.mode !== 'reset') {
      const p = this.player.pos;
      const fwd = new Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
      const tmp = new Vector3();
      for (const it of this.interactables) {
        const at = it.position(tmp);
        const d = Math.hypot(at.x - p.x, at.z - p.z);
        if (d > it.radius || Math.abs(at.y - p.y) > 2.5) continue;
        const to = new Vector3(at.x - p.x, 0, at.z - p.z).normalize();
        const score = d - to.dot(fwd) * 0.8;
        if (score < bestD) {
          bestD = score;
          best = it;
        }
      }
    }
    this.focus = best;
  }

  interact(): void {
    if (this.focus && !this.game.dialogue.isOpen && !this.player.frozen) this.focus.interact();
  }

  private updateArea(): void {
    const areas = this.def.areas;
    if (!areas) return;
    const p = this.player.pos;
    const inside = (a: AreaDef) =>
      p.x > a.min[0] && p.x < a.max[0] && p.y > a.min[1] && p.y < a.max[1] && p.z > a.min[2] && p.z < a.max[2];
    if (this.area && inside(this.area)) return;
    const next = areas.find(inside) ?? null;
    // Areas can be made of several boxes sharing an id; only announce real changes.
    if (next && next.id !== this.area?.id) this.events.emit('areaEnter', { id: next.id, name: next.name });
    this.area = next;
  }

  get currentArea(): AreaDef | null {
    return this.area;
  }

  /**
   * Resuming at a saved checkpoint that no longer matches a lectern in this level (the level was
   * rebuilt since: moved, or the room reshaped) would put you anywhere, even outside the walls.
   * Then use the nearest lectern instead, and remember that one.
   */
  private checkSavedCheckpoint(spawn: SpawnPoint, levelId: string): SpawnPoint {
    const cp = this.game.state.checkpoint;
    if (!cp || cp.level !== levelId || cp.pos.distanceTo(new Vector3(...spawn.pos)) > 0.01) return spawn;
    const spots = this.builder.entities.flatMap((e) => {
      if (e.type !== 'checkpoint') return [];
      const [x, y, z] = e.pos;
      return [{ pos: new Vector3(x + Math.sin(e.yaw) * 1.3, y, z + Math.cos(e.yaw) * 1.3), yaw: e.yaw }];
    });
    if (!spots.length || spots.some((s) => s.pos.distanceTo(cp.pos) < 0.05)) return spawn;
    const best = spots.reduce((a, s) => (s.pos.distanceTo(cp.pos) < a.pos.distanceTo(cp.pos) ? s : a));
    this.game.state.checkpoint = { level: levelId, pos: best.pos.clone(), yaw: best.yaw };
    return { pos: best.pos.toArray() as [number, number, number], yaw: best.yaw };
  }

  dispose(): void {
    this.events.dispose();
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: Material) => m.dispose());
      }
    });
    this.physics.world.free();
  }
}
