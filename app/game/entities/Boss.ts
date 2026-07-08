import Phaser from 'phaser'

/** A big milestone enemy with lots of HP. Single instance, pooled by the scene. */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  hp = 1
  maxHp = 1
  speed = 40
  /** Timestamps (scene-elapsed ms) for sword-tick and contact cooldowns. */
  lastHitAt = Number.NEGATIVE_INFINITY
  contactAt = Number.NEGATIVE_INFINITY

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.disableBody(true, true)
  }

  spawn(x: number, y: number, hp: number, speed: number, scale: number): void {
    this.maxHp = hp
    this.hp = hp
    this.speed = speed
    this.lastHitAt = Number.NEGATIVE_INFINITY
    this.contactAt = Number.NEGATIVE_INFINITY
    this.setScale(scale)
    this.enableBody(true, x, y, true, true)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(this.width, this.height)
  }

  /** @returns true when the boss dies. */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    return this.hp <= 0
  }

  deactivate(): void {
    this.disableBody(true, true)
  }
}
