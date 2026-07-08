import Phaser from 'phaser'
import type { EnemyConfig } from '~/types/game'

/** Pooled enemy. Created/recycled by an Arcade physics Group. */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  value = 1
  hp = 1
  speed = 60
  /** Timestamp (scene-elapsed ms) of the last sword hit, for hit cooldown. */
  lastHitAt = Number.NEGATIVE_INFINITY

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemyA')
  }

  spawn(x: number, y: number, config: EnemyConfig): void {
    this.value = config.value
    this.hp = config.hp
    this.speed = config.speed
    this.lastHitAt = Number.NEGATIVE_INFINITY
    this.setTexture(config.textureKey)
    this.setScale(config.scale)
    this.enableBody(true, x, y, true, true)
    // Keep the physics body in sync with the current texture.
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(this.width, this.height)
  }

  /** @returns true when the enemy has died. */
  takeDamage(amount: number): boolean {
    this.hp -= amount
    return this.hp <= 0
  }

  deactivate(): void {
    this.disableBody(true, true)
  }
}
