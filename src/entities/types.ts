import type { Object3D, Vector3 } from 'three';
import type { SpeakerId } from '../data/characters';
import type { SpellId } from '../data/spells';
import type { SweetKind } from '../data/sweets';
import type { Tuning } from '../data/tuning';
import type { EventBus } from '../engine/events';
import type { Physics } from '../engine/physics';
import type { PlayerController } from '../player/controller';
import type { Puffs } from '../player/effects';
import type { PlayerHealth } from '../player/health';
import type { TargetRegistry } from '../spells/targets';
import type { GameState } from '../state/gameState';
import type { Dialogue, DialogueLine } from '../ui/dialogue';
import type { V3 } from '../world/builder';
import type { Signals } from '../world/signals';
import type { SweetField } from './sweets';

/** Fields any entity spec may carry. */
interface SpecBase {
  /** Only spawn once the player knows this spell (e.g. pests that need Thwackwort). */
  requires?: SpellId;
  /** Only spawn while the player does NOT know this spell. */
  unless?: SpellId;
}

export interface NpcLook {
  robe?: string;
  scarf?: string;
  trim?: string;
  hat?: string;
  /** Uniform scale (teachers are a bit taller than first-years). */
  scale?: number;
}

/** Level data: everything placed in a level that isn't static geometry. */
export type EntitySpec = SpecBase &
  (
    | { type: 'pushBlock'; pos: V3; size?: number; resetOn?: string }
    | { type: 'knockSwitch'; id: string; pos: V3; yaw: number; timed?: number; style?: 'plate' | 'book' | 'target' | 'bell'; latch?: boolean }
    | { type: 'plate'; id: string; pos: V3 }
    | { type: 'gate'; pos: V3; yaw: number; width: number; height: number; when: string[] }
    | { type: 'sweet'; kind: SweetKind; pos: V3 }
    | { type: 'sweetLine'; kind: SweetKind; from: V3; to: V3; count: number }
    | { type: 'checkpoint'; pos: V3; yaw: number }
    | { type: 'gnarling'; pos: V3; wander?: number }
    | { type: 'teaser'; spell: SpellId; prop: 'chest' | 'vines' | 'marker'; pos: V3; yaw: number; id?: string }
    | { type: 'card'; card: string; pos: V3 }
    | { type: 'secret'; id: string; area: string; min: V3; max: V3 }
    | { type: 'tapestry'; pos: V3; yaw: number; width: number; height: number; color: string; trim?: string; sway?: boolean }
    | { type: 'bookshelf'; pos: V3; yaw: number; width: number; height: number; slide?: number; when?: string[] }
    | { type: 'npc'; speaker: SpeakerId; pos: V3; yaw: number; look?: NpcLook; talk: string }
    | { type: 'sortingLantern'; pos: V3; yaw: number }
    | {
        type: 'door';
        pos: V3;
        yaw: number;
        width: number;
        height: number;
        to?: { level: string; spawn: string };
        /** Message when locked (or permanently locked if there's no `to`). */
        locked?: string;
        /** Locked until this progress flag is set. */
        lockedUnless?: string;
        /** Dialogue script to run instead of the `locked` toast. */
        talk?: string;
        label?: string;
      }
    | { type: 'hourglasses'; pos: V3; yaw: number }
    | { type: 'springPad'; pos: V3; radius: number }
    | {
        type: 'trigger';
        /** Progress flag set when this fires; a trigger fires once per save. */
        flag: string;
        script: string;
        /** Fire when the player is inside this box... */
        min?: V3;
        max?: V3;
        /** ...and/or when all these signals are on. */
        when?: string[];
      }
    | { type: 'star'; id: string; pos: V3; script?: string }
    | { type: 'rattlecoat'; id: string; pos: V3; yaw: number; arena: { min: V3; max: V3 } }
  );

export type EntityType = EntitySpec['type'];
export type SpecOf<T extends EntityType> = Extract<EntitySpec, { type: T }>;

/** Something the player can walk up to and press E on. */
export interface Interactable {
  /** Where the prompt anchors and distance is measured from. */
  position(out: Vector3): Vector3;
  radius: number;
  /** Prompt text, e.g. "Talk to Tansy". */
  prompt(): string;
  interact(): void;
}

/** Shared services every entity can use. */
export interface WorldContext {
  levelId: string;
  /** Parent for this level's objects (removed wholesale on unload). */
  scene: Object3D;
  physics: Physics;
  events: EventBus;
  tuning: Tuning;
  player: PlayerController;
  health: PlayerHealth;
  state: GameState;
  signals: Signals;
  targets: TargetRegistry;
  fx: Puffs;
  sweets: SweetField;
  dialogue: Dialogue;
  /** Interactables register here; the session shows the nearest one's prompt. */
  interactables: Set<Interactable>;
  /** Run a dialogue by id from src/data/dialogues.ts. */
  talk(id: string): Promise<number | null>;
  /** Run lines directly. */
  say(lines: DialogueLine[]): Promise<number | null>;
  changeLevel(level: string, spawn: string): void;
  /** Secrets found/total in an area of this level. */
  secretsIn(area: string): { found: number; total: number };
}

export interface Entity {
  /** Simulation step (60 Hz), before the player moves. */
  fixedUpdate?(dt: number): void;
  /** After the player moved: commit collider positions of things the player can ride. */
  lateFixedUpdate?(): void;
  /** Visual update every rendered frame. */
  frameUpdate?(dt: number, alpha: number): void;
}
