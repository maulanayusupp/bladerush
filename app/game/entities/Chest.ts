import Phaser from 'phaser'
import { AURA } from '../constants'

/** A treasure chest dropped by a kill. Run into it to open for a reward. */
export class Chest extends Phaser.GameObjects.Container {
  consumed = false
  mul = 1

  private readonly glow: Phaser.GameObjects.Image
  private readonly icon: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    this.glow = scene.add
      .image(0, 0, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(66 / (AURA.textureRadius * 2))
      .setAlpha(0.5)
    this.icon = scene.add.image(0, 0, 'chest').setScale(1.1)
    this.add([this.glow, this.icon])
    scene.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number, tint: number, mul: number): void {
    this.mul = mul
    this.consumed = false
    this.setPosition(x, y)
    this.glow.setTint(tint)
    this.icon.setTint(tint)
    this.setActive(true).setVisible(true)
  }

  deactivate(): void {
    this.setActive(false).setVisible(false)
  }
}
