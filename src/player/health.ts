import { Vector3 } from 'three';
import type { EventBus } from '../engine/events';
import type { GameState } from '../state/gameState';
import type { PlayerController } from './controller';

const INVULNERABLE_TIME = 1.3;
const FAINT_TIME = 1.6;

/**
 * Stamina, damage and fainting. Nothing here costs progress: fainting just puts
 * you back at the last checkpoint with full stamina.
 */
export class PlayerHealth {
  private invulnerable = 0;
  private faintTimer = -1;
  /** Called with false/true to blink the player model while invulnerable. */
  onBlink: ((visible: boolean) => void) | null = null;

  constructor(
    private player: PlayerController,
    private state: GameState,
    private events: EventBus,
    private fallbackSpawn: { pos: Vector3; yaw: number },
    private levelId = 'level',
  ) {
    events.on('respawn', ({ reason }) => {
      if ((reason === 'water' || reason === 'fall') && !this.fainting) this.hurt(1, null, false);
    });
  }

  get blinking(): boolean {
    return this.invulnerable > 0;
  }

  get fainting(): boolean {
    return this.faintTimer >= 0;
  }

  /** Deal damage from a source position (knocks the player away from it). */
  damage(amount: number, from: Vector3): boolean {
    if (this.invulnerable > 0 || this.fainting || this.player.mode === 'reset') return false;
    this.hurt(amount, from, true);
    return true;
  }

  private hurt(amount: number, from: Vector3 | null, knock: boolean): void {
    this.state.stamina = Math.max(0, this.state.stamina - amount);
    this.events.emit('hurt', { amount, pos: this.player.pos.clone() });
    if (knock && from) this.player.knockback(from);
    this.invulnerable = INVULNERABLE_TIME;
    if (this.state.stamina <= 0) this.faint();
  }

  heal(full = true, amount = 1): void {
    this.state.stamina = full ? this.state.maxStamina : Math.min(this.state.maxStamina, this.state.stamina + amount);
  }

  private faint(): void {
    this.faintTimer = 0;
    this.player.frozen = true;
    this.events.emit('faint', { pos: this.player.pos.clone() });
  }

  update(dt: number): void {
    if (this.fainting) {
      this.faintTimer += dt;
      if (this.faintTimer >= FAINT_TIME) {
        const saved = this.state.checkpoint;
        const cp = saved && saved.level === this.levelId ? saved : this.fallbackSpawn;
        this.player.teleport(cp.pos, cp.yaw);
        this.player.frozen = false;
        this.heal(true);
        this.faintTimer = -1;
        this.invulnerable = INVULNERABLE_TIME;
        this.events.emit('respawn', { pos: cp.pos.clone(), reason: 'faint' });
      }
    }
    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
      this.onBlink?.(this.invulnerable <= 0 || Math.floor(this.invulnerable * 14) % 2 === 0);
    }
  }
}
