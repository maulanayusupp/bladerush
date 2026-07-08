import Phaser from 'phaser'
import { PLAYER } from '../constants'
import { clamp } from '~/helpers/math.helper'

export interface Bounds {
  width: number
  height: number
}

/** The hero. Freely follows a 2D target set by pointer input. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  maxHp: number = PLAYER.maxHp
  hp: number = PLAYER.maxHp
  private targetX: number
  private targetY: number

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero0')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.targetX = x
    this.targetY = y
  }

  setTarget(x: number, y: number): void {
    this.targetX = x
    this.targetY = y
  }

  moveToward(deltaMs: number, bounds: Bounds): void {
    const step = PLAYER.speed * (deltaMs / 1000)
    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const dist = Math.hypot(dx, dy)

    if (dist <= step) {
      this.setPosition(this.targetX, this.targetY)
    } else {
      this.setPosition(this.x + (dx / dist) * step, this.y + (dy / dist) * step)
    }

    const halfW = this.width / 2
    const halfH = this.height / 2
    this.setPosition(
      clamp(this.x, halfW, bounds.width - halfW),
      clamp(this.y, halfH, bounds.height - halfH),
    )
  }

  /** @returns true when the player has died. */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    return this.hp <= 0
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  /** Vigor upgrade: raise max HP and heal by the same amount. */
  addMaxHp(amount: number): void {
    this.maxHp += amount
    this.hp += amount
  }
}
