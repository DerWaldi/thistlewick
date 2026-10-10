import type { Scene } from 'three';
import type { SpellId } from '../data/spells';
import type { SweetKind } from '../data/sweets';
import type { Tuning } from '../data/tuning';
import type { EventBus } from '../engine/events';
import type { Physics } from '../engine/physics';
import type { PlayerController } from '../player/controller';
import type { PlayerHealth } from '../player/health';
import type { Puffs } from '../player/effects';
import type { TargetRegistry } from '../spells/targets';
import type { GameState } from '../state/gameState';
import type { V3 } from '../world/builder';
import type { Signals } from '../world/signals';
import type { SweetField } from './sweets';

/** Level data: everything placed in a level that isn't static geometry. */
export type EntitySpec =
  | { type: 'pushBlock'; pos: V3; size?: number }
  | { type: 'knockSwitch'; id: string; pos: V3; yaw: number; timed?: number }
  | { type: 'plate'; id: string; pos: V3 }
  | { type: 'gate'; pos: V3; yaw: number; width: number; height: number; when: string[] }
  | { type: 'sweet'; kind: SweetKind; pos: V3 }
  | { type: 'sweetLine'; kind: SweetKind; from: V3; to: V3; count: number }
  | { type: 'checkpoint'; pos: V3; yaw: number }
  | { type: 'gnarling'; pos: V3; wander?: number }
  | { type: 'teaser'; spell: SpellId; prop: 'chest' | 'vines'; pos: V3; yaw: number };

export type EntityType = EntitySpec['type'];
export type SpecOf<T extends EntityType> = Extract<EntitySpec, { type: T }>;

/** Shared services every entity can use. */
export interface WorldContext {
  scene: Scene;
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
}

export interface Entity {
  /** Simulation step (60 Hz), before the player moves. */
  fixedUpdate?(dt: number): void;
  /** After the player moved: commit collider positions of things the player can ride. */
  lateFixedUpdate?(): void;
  /** Visual update every rendered frame. */
  frameUpdate?(dt: number, alpha: number): void;
}
