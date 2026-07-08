import Phaser from 'phaser'
import { AURA } from '../constants'

/**
 * A floating heart pickup that restores HP. Rendered as a glowing heart (no
 * box); movement + overlap handled by BattleScene.
 */
export class Heal extends Phaser.GameObjects.Container {
  consumed = false

  private readonly icon: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    const glow = scene.add
      .image(0, 0, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x37b24d)
      .setScale(70 / (AURA.textureRadius * 2))
      .setAlpha(0.5)
    this.icon = scene.add.image(0, 0, 'heal').setScale(1.4)
    this.add([glow, this.icon])
    scene.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number): void {
    this.consumed = false
    this.setPosition(x, y)
    this.setActive(true).setVisible(true)
  }

  idle(deltaMs: number): void {
    this.icon.angle = Math.sin((this.y + this.x) / 40) * 10
    void deltaMs
  }

  deactivate(): void {
    this.setActive(false).setVisible(false)
  }
}
