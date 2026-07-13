import Phaser from 'phaser'
import { HERO, NPC } from '../constants'
import { formatCompact } from '~/helpers/format.helper'
import { clamp } from '~/helpers/math.helper'

const TAU = Math.PI * 2

/**
 * An AI survivor: a hero sprite + its own spinning sword ring + a power label.
 * Behaviour (targeting/combat/pickups) is driven by BattleScene; this class
 * owns only its own state and rendering.
 */
export class NpcHero extends Phaser.GameObjects.Container {
  hp: number = NPC.baseHp
  maxHp: number = NPC.baseHp
  power = 10
  spinAngle = 0
  hitAcc = 0
  duelAcc = 0
  respawnAt = 0
  targetX = 0
  targetY = 0
  wanderUntil = 0
  ringColor = 0xffffff

  private readonly heroImg: Phaser.GameObjects.Image
  private readonly ring: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)
    this.ring = scene.add.graphics()
    this.heroImg = scene.add.image(0, 0, 'hero0').setScale(0.8)
    this.label = scene.add
      .text(0, -34, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
    this.label.setStroke('#000000', 3)
    this.add([this.ring, this.heroImg, this.label])
    scene.add.existing(this)
    this.setDepth(1)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number, power: number, color: number): void {
    this.setPosition(x, y)
    this.hp = this.maxHp = NPC.baseHp
    this.power = Math.max(1, power)
    this.ringColor = color
    this.targetX = x
    this.targetY = y
    this.respawnAt = 0
    this.hitAcc = 0
    this.setActive(true).setVisible(true)
    this.refresh()
  }

  /** Update the hero look + label to match current power (tier like the player). */
  refresh(): void {
    const tier = clamp(Math.floor(HERO.tierPerLog10 * Math.log10(1 + this.power)), 0, HERO.skins - 1)
    this.heroImg.setTexture(`hero${tier}`)
    this.heroImg.setScale(0.62 + (tier / (HERO.skins - 1)) * 0.5)
    this.label.setText(formatCompact(Math.round(this.power)))
    // Tougher as it grows so a strong NPC is a real duel (not instantly absorbed).
    this.maxHp = NPC.baseHp + Math.min(500, Math.sqrt(this.power) * 5)
    if (this.hp > this.maxHp) this.hp = this.maxHp
  }

  /** Spin + redraw the sword ring (blade count grows a little with power). */
  spin(deltaMs: number): void {
    this.spinAngle = (this.spinAngle + 2 * (deltaMs / 1000)) % TAU
    const blades = NPC.blades + Math.min(6, Math.floor(Math.log10(1 + this.power)))
    const r = NPC.ringRadius
    const g = this.ring
    g.clear()
    g.fillStyle(this.ringColor, 0.95)
    for (let k = 0; k < blades; k++) {
      const a = this.spinAngle + (k / blades) * TAU
      const bx = Math.cos(a) * r
      const by = Math.sin(a) * r
      const tx = Math.cos(a + Math.PI / 2)
      const ty = Math.sin(a + Math.PI / 2)
      g.fillTriangle(
        bx + Math.cos(a) * 7, by + Math.sin(a) * 7,
        bx + tx * 3, by + ty * 3,
        bx - tx * 3, by - ty * 3,
      )
    }
  }

  deactivate(): void {
    this.ring.clear()
    this.setActive(false).setVisible(false)
  }
}
