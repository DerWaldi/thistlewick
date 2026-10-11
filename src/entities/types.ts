import type { StudentLook } from '../player/model';
import type { Object3D, Vector3 } from 'three';
import type { SpeakerId } from '../data/characters';
import type { SpellId } from '../data/spells';
import type { HouseId } from '../data/houses';
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
import type { GlimmerField } from '../world/glimmer';
import type { HeatField } from '../world/heat';
import type { Creature } from './creatures';

/** Fields any entity spec may carry. */
interface SpecBase {
  /** Only spawn once the player knows this spell (e.g. pests that need Thwackwort). */
  requires?: SpellId;
  /** Only spawn while the player does NOT know this spell. */
  unless?: SpellId;
}

export interface NpcLook extends StudentLook {
  /** Uniform scale (teachers are a bit taller than first-years). */
  scale?: number;
}

/** Level data: everything placed in a level that isn't static geometry. */
export type EntitySpec = SpecBase &
  (
    | {
        type: 'pushBlock';
        pos: V3;
        size?: number;
        /** Send the block home when this signal turns on (a reset bell). */
        resetOn?: string;
        /** Signal that's on while the block has dropped below its starting height (into a pit). */
        sunkSignal?: string;
      }
    | {
        type: 'knockSwitch';
        id: string;
        pos: V3;
        yaw: number;
        timed?: number;
        style?: 'plate' | 'book' | 'target' | 'bell';
        latch?: boolean;
        /** A latched switch in the castle that stays thrown across visits (e.g. a portcullis winch). */
        persist?: boolean;
      }
    | { type: 'plate'; id: string; pos: V3; /** Stays down once stepped on. */ latch?: boolean }
    | {
        type: 'gate';
        pos: V3;
        yaw: number;
        width: number;
        height: number;
        when: string[];
        /** ...but shut while any of these are on (`when: []` makes it open until then). */
        shutWhen?: string[];
      }
    | { type: 'sweet'; kind: SweetKind; pos: V3 }
    | { type: 'sweetLine'; kind: SweetKind; from: V3; to: V3; count: number }
    | {
        type: 'checkpoint';
        pos: V3;
        yaw: number;
        /** Activates as soon as you enter this box (typically the room's entrance), not just near the lectern. */
        zone?: { min: V3; max: V3 };
      }
    | { type: 'gnarling'; pos: V3; wander?: number }
    | { type: 'teaser'; spell: SpellId; prop: 'chest' | 'vines' | 'marker'; pos: V3; yaw: number; id?: string }
    | { type: 'card'; card: string; pos: V3 }
    | { type: 'secret'; id: string; area: string; min: V3; max: V3 }
    | { type: 'tapestry'; pos: V3; yaw: number; width: number; height: number; color: string; trim?: string; sway?: boolean }
    | { type: 'bookshelf'; pos: V3; yaw: number; width: number; height: number; slide?: number; when?: string[] }
    | {
        type: 'npc';
        speaker: SpeakerId;
        pos: V3;
        yaw: number;
        look?: NpcLook;
        talk: string;
        /** A student with this errand: shows ! while it's on offer and ? once the thing is found. */
        quest?: string;
      }
    | {
        type: 'questItem';
        /** The lost thing for this quest (src/data/quests.ts); only there while the quest is accepted. */
        quest: string;
        pos: V3;
      }
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
        /** Locked while this spell is learned but its lesson (the trial) isn't finished: no wandering off mid-lesson. */
        lockedDuring?: SpellId;
        /** Shut for good once this spell's lesson is complete: each trial is run once. */
        closedAfter?: SpellId;
        /** Locked until this spell's lesson is complete (a later teacher's door). */
        afterLesson?: SpellId;
        /** Dialogue script to run instead of the `locked` toast. */
        talk?: string;
        label?: string;
        /** Wooden (default) or riveted iron (the doors down to the trials). */
        style?: 'wood' | 'iron';
      }
    | { type: 'hourglasses'; pos: V3; yaw: number }
    | {
        type: 'springPad';
        pos: V3;
        /** Cushion/cap/tile radius; half the length for a mattress. */
        radius: number;
        style?: 'moss' | 'mushroom' | 'mattress' | 'rune';
        yaw?: number;
        /** Toadstool stem height (the cap sits on top). */
        height?: number;
        /** Seconds it stays springy after a cast (default 8; 0 = for the rest of the visit). */
        duration?: number;
        /** Throws you sideways too: direction (yaw) and speed. */
        fling?: { yaw: number; speed: number };
      }
    | {
        type: 'trigger';
        /** Progress flag set when this fires; a trigger fires once per save. */
        flag: string;
        /** Dialogue to run when it fires (optional: some triggers only set `signal`). */
        script?: string;
        /** A signal turned on when it fires (e.g. a gate that drops behind you). */
        signal?: string;
        /** Fire when the player is inside this box... */
        min?: V3;
        max?: V3;
        /** ...and/or when all these signals are on. */
        when?: string[];
        /** Never fire while any of these signals are on (e.g. the puzzle is solved). */
        unlessSignals?: string[];
        /** Conditions must hold this many seconds first. */
        delay?: number;
        /** Fire once per visit to the level rather than once per save (hints). */
        perVisit?: boolean;
      }
    | {
        type: 'star';
        id: string;
        pos: V3;
        script?: string;
        /** Hidden until this signal is on; if a boss going down turns it on, it appears where the boss fell. */
        dropWhen?: string;
      }
    | {
        type: 'rattlecoat';
        id: string;
        pos: V3;
        yaw: number;
        arena: { min: V3; max: V3 };
        /** Stays down across visits (flag `down:<id>`), for the castle. */
        persist?: boolean;
      }
    | {
        type: 'padlock';
        /** Signal turned on while it's open. */
        id: string;
        pos: V3;
        /** The way it faces (out from whatever it hangs on). */
        yaw: number;
        /** Snaps shut again after this many seconds. */
        relock?: number;
        /** Stays open across visits (castle locks). */
        persist?: boolean;
        /** Rides round a wheel in the plane facing `yaw`; `pos` is then ignored. */
        orbit?: { center: V3; radius: number; speed: number; phase: number };
      }
    | {
        type: 'chest';
        /** Remembered once opened. */
        id: string;
        pos: V3;
        yaw: number;
        style?: 'chest' | 'box' | 'cabinet';
        card?: string;
        sweets?: [SweetKind, number][];
        /** Signal turned on once it's open. */
        signal?: string;
      }
    | { type: 'drawbridge'; pos: V3; yaw: number; length: number; width: number; when: string[] }
    | { type: 'vaultDoor'; pos: V3; yaw: number; radius: number; when: string[] }
    | { type: 'snapcasket'; id: string; pos: V3; yaw?: number; wander?: number }
    | {
        type: 'wickLamp';
        /** Signal turned on while it's lit. */
        id?: string;
        /** Base of the post / the wall mount / the hanging point. */
        pos: V3;
        yaw?: number;
        style?: 'post' | 'wall' | 'hanging';
        /** Lit radius (a full charge lights 1.5x as wide). */
        radius: number;
        /** Seconds it stays lit (default 8; 0 = for the rest of the visit). */
        duration?: number;
        /** Burning when you arrive. */
        lit?: boolean;
        /** Casts real light too (counts towards the level's ~8 point lights). */
        light?: boolean;
        /** How far that light reaches (default 1.8x the radius). */
        lightRange?: number;
      }
    | { type: 'glimmerBlock'; pos: V3; size: V3; grabbable?: boolean }
    | { type: 'illusionWall'; pos: V3; size: V3; color?: string }
    | {
        type: 'burnable';
        /** Signal turned on once it has burnt away. */
        id?: string;
        style: 'vines' | 'briar' | 'cobweb' | 'hay' | 'rope' | 'ice';
        /** Centre of the box it fills. */
        pos: V3;
        size: V3;
        yaw?: number;
        /** Stays burnt across visits (flag `burnt:<id>`), for the castle. */
        persist?: boolean;
        /** Won't catch until these signals are on (e.g. briars dried out by braziers). */
        fireproofUntil?: string[];
      }
    | {
        type: 'brazier';
        id: string;
        pos: V3;
        /** Seconds it burns (0 or unset = for the rest of the visit). */
        duration?: number;
        lit?: boolean;
        /** Casts real light (counts towards the level's ~8 point lights). */
        light?: boolean;
        /** Braziers sharing a group must be lit in `order` (1, 2, 3...: notches on the bowl). */
        group?: string;
        order?: number;
      }
    | {
        type: 'dropper';
        /** A crate hanging on a rope: drops to floorY once all these signals are on, and stays as a step. */
        pos: V3;
        size: V3;
        floorY: number;
        when: string[];
      }
    | {
        type: 'iceSheet';
        /** Signal on while frozen. */
        id?: string;
        /** The patch of water (x, z corners) that freezes. */
        min: [number, number];
        max: [number, number];
        /** Water surface height. */
        y: number;
        /** Seconds it stays frozen (default 6; 0 = for the visit). */
        duration?: number;
        /** Seconds a charged freeze lasts (default twice `duration`). */
        chargedDuration?: number;
        frozen?: boolean;
      }
    | {
        type: 'waterfall';
        id?: string;
        /** Foot of the falling water, on the cliff face; `yaw` faces away from the cliff. */
        pos: V3;
        yaw: number;
        width: number;
        height: number;
        /** Height of the ice pillar that forms at its foot when frozen. */
        pillar: number;
        /** How far the pillar stands out from the face (default 1). */
        depth?: number;
        /** Seconds it stays frozen (default 0 = for the visit; twice that charged). */
        duration?: number;
        frozen?: boolean;
      }
    | {
        type: 'floe';
        /** Centre at the water surface. */
        pos: V3;
        /** Width (x) and depth (z). */
        size: [number, number];
        /** Floats home when this signal turns on (a reset bell). */
        resetOn?: string;
      }
    | {
        type: 'skyLift';
        /** Signal on while it's at (or heading to) `to`. */
        id?: string;
        style?: 'platform' | 'basket' | 'crate';
        /** Where the top of its deck sits at each end. */
        from: V3;
        to: V3;
        /** Width (x) and depth (z). */
        size: [number, number];
        /** Crate height (default 1.2). */
        height?: number;
        /** Start at `to` instead of `from` (a lift waiting to be called). */
        startAt?: 'from' | 'to';
        /** Metres per second (default 2.5). */
        speed?: number;
        /** Floats back to `from` this many seconds after arriving at `to`. */
        returnAfter?: number;
        /** Where its feather-stone post stands on the deck (x, z offset). */
        post?: [number, number];
      }
    | {
        type: 'pendulum';
        /** The pivot. */
        pos: V3;
        length: number;
        /** Amplitude in radians. */
        swing: number;
        period: number;
        /** 0..1 of a period. */
        phase?: number;
        /** Swing plane (0 = along x). */
        yaw?: number;
        /** Bob radius (default 0.7). */
        bob?: number;
        /** 'brass' (rod and disc, the default) or 'log' (a log slung on two ropes). */
        style?: 'brass' | 'log';
      }
    | {
        type: 'snapweed';
        /** Signal turned on once it's burnt. */
        id?: string;
        pos: V3;
        /** Bite reach (default 2.4 m). */
        radius?: number;
        /** Stays burnt across visits (flag `down:<id>`), for the castle. */
        persist?: boolean;
      }
    | {
        type: 'emberCrab';
        /** Signal turned on once it's shattered. */
        id?: string;
        pos: V3;
        /** Patrol direction (0 = along x) and half-length. */
        yaw?: number;
        patrol?: number;
        /** How far it can see to shoot (default 13), seconds between shots (2.4), fireball speed (7). */
        range?: number;
        interval?: number;
        speed?: number;
        persist?: boolean;
        /** Shattered, it re-forms after this many seconds (crabs you need as stepping stones). */
        reform?: number;
      }
    | {
        type: 'hexling';
        /** Signal turned on once she's banished. */
        id?: string;
        /** The middle of her patch (on the ground); she flies `height` above it. */
        pos: V3;
        height?: number;
        /** How far she ranges from the middle. */
        radius?: number;
        /** Sight (default 15), seconds between orbs (2.6), orb speed (6.5). */
        range?: number;
        interval?: number;
        speed?: number;
        persist?: boolean;
      }
    | {
        type: 'sootling';
        id?: string;
        pos: V3;
        yaw?: number;
        /** How far he shuffles about (default 1.2). */
        wander?: number;
        /** Sight (16), seconds between throws (3), fuse after landing (1.6), blast radius (2.4). */
        range?: number;
        interval?: number;
        fuse?: number;
        blastRadius?: number;
        persist?: boolean;
      }
    | {
        type: 'wanderer';
        speaker: SpeakerId;
        look?: NpcLook;
        /** A loop of waypoints (feet positions) they walk round, dawdling at each. */
        path: V3[];
        speed?: number;
        talk: string;
      }
    | {
        type: 'examiner';
        /** Signal (and `down:<id>` flag) once it falls. */
        id: string;
        pos: V3;
        /** Where it stalks you; it wakes when you're inside and `wakeFlag` is set. */
        arena: { min: V3; max: V3 };
        wakeFlag: string;
        /** A point it keeps its distance from. */
        avoid?: V3;
        /** A round room: it stays within `radius` of `center` (x, z) as well as inside `arena`. */
        ring?: { center: [number, number]; radius: number };
      }
    | {
        type: 'houseSeal';
        /** Turns on signal `house-door-<house>` if the player belongs to this house (common-room doors). */
        house: HouseId;
      }
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
  /** Where Glimmerwick's lamps are lit (hidden platforms, false walls). */
  glimmer: GlimmerField;
  /** Lit fires, which Gnarlings keep away from. */
  heat: HeatField;
  /** Creatures a Snapweed can bite (Gnarlings register here). */
  creatures: Set<Creature>;
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
