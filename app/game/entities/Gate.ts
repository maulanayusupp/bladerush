import Phaser from 'phaser'
import type { GateConfig } from '~/types/game'
import { AURA, GATE } from '../constants'

const COLOR_ADD = 0xffd24a // gold
const COLOR_MUL = 0x9d74ff // violet

/**
 * A sword reward the player runs into to grow the ring. NOT boxed — it's a
 * free-floating glowing sword with the amount ("+5", "×2") beneath it. The
 * blade drifts/rotates for life. Movement + overlap handled by BattleScene.
 */
export class Gate extends Phaser.GameObjects.Container {
  config: GateConfig = { op: 'add', value: 0 }
  consumed = false

  private readonly glow: Phaser.GameObjects.Image
  private readonly sword: Phaser.GameObjects.Image
  private readonly label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    this.glow = scene.add
      .image(0, -4, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((GATE.width * 1.4) / (AURA.textureRadius * 2))
      .setAlpha(0.55)
    this.sword = scene.add.image(0, -6, 'sword').setScale(1.8)
    this.label = scene.add
      .text(0, 26, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
    this.label.setStroke('#20160a', 5)
    this.add([this.glow, this.sword, this.label])
    this.setSize(GATE.width, GATE.height)
    scene.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number, config: GateConfig): void {
    this.config = config
    this.consumed = false
    this.setPosition(x, y)
    const color = config.op === 'mul' ? COLOR_MUL : COLOR_ADD
    this.glow.setTint(color)
    this.sword.setAngle(0)
    this.label.setText(config.op === 'mul' ? `×${config.value}` : `+${config.value}`)
    this.label.setShadow(0, 0, config.op === 'mul' ? '#9d74ff' : '#ffd24a', 12)
    this.setActive(true).setVisible(true)
  }

  /** Gentle idle motion so it reads as a floating pickup. */
  idle(deltaMs: number): void {
    this.sword.angle += 24 * (deltaMs / 1000)
  }

  deactivate(): void {
    this.setActive(false).setVisible(false)
  }
}
