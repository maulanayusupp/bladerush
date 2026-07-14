import Phaser from 'phaser'
import { HERO, NPC, SWORD_SHAPES } from '../constants'
import { formatCompact } from '~/helpers/format.helper'
import { clamp } from '~/helpers/math.helper'

const TAU = Math.PI * 2
const MAX_BLADES = 14

/**
 * An AI survivor: a hero sprite + its OWN ring of real swords (same baked blade
 * art as the player) + a power label. Behaviour is driven by BattleScene; this
 * class owns its state and rendering.
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
  private baseScale = 0.8

  private readonly heroImg: Phaser.GameObjects.Image
  private readonly blades: Phaser.GameObjects.Image[]
  private readonly label: Phaser.GameObjects.Text
  private bladeSkin = 0

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)
    this.blades = Array.from({ length: MAX_BLADES }, () =>
      scene.add.image(0, 0, 'sword0').setScale(0.7).setActive(false).setVisible(false),
    )
    this.heroImg = scene.add.image(0, 0, 'hero0').setScale(0.8)
    this.label = scene.add
      .text(0, -34, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
    this.label.setStroke('#000000', 3)
    this.add([...this.blades, this.heroImg, this.label])
    scene.add.existing(this)
    this.setDepth(1)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number, power: number, color: number): void {
    this.setPosition(x, y)
    this.hp = this.maxHp = NPC.baseHp
    this.power = Math.max(1, power)
    this.ringColor = color
    this.bladeSkin = Math.floor(Math.random() * SWORD_SHAPES.length)
    this.targetX = x
    this.targetY = y
    this.respawnAt = 0
    this.hitAcc = 0
    for (const b of this.blades) b.setTexture(`sword${this.bladeSkin}`).setTint(color)
    this.setActive(true).setVisible(true)
    this.refresh()
  }

  /** Update the hero look + label + toughness to match current power. */
  refresh(): void {
    const tier = clamp(Math.floor(HERO.tierPerLog10 * Math.log10(1 + this.power)), 0, HERO.skins - 1)
    this.heroImg.setTexture(`hero${tier}`)
    this.baseScale = 0.6 + (tier / (HERO.skins - 1)) * 1.05 // grows like the player
    this.heroImg.setScale(this.baseScale)
    this.label.setText(formatCompact(Math.round(this.power)))
    this.maxHp = NPC.baseHp + Math.min(500, Math.sqrt(this.power) * 5)
    if (this.hp > this.maxHp) this.hp = this.maxHp
  }

  /** Spin the ring of real sword blades (more blades as power grows). */
  spin(deltaMs: number): void {
    this.spinAngle = (this.spinAngle + 1.8 * (deltaMs / 1000)) % TAU
    // Idle breathing so NPCs aren't stiff either.
    this.heroImg.setScale(this.baseScale * (1 + Math.sin(this.spinAngle * 2) * 0.04))
    const count = Math.min(MAX_BLADES, 5 + Math.floor(Math.log10(1 + this.power) * 1.6))
    const r = NPC.ringRadius
    for (let i = 0; i < this.blades.length; i++) {
      const b = this.blades[i] as Phaser.GameObjects.Image
      if (i >= count) {
        b.setVisible(false)
        continue
      }
      const a = this.spinAngle + (i / count) * TAU
      b.setVisible(true)
      b.setPosition(Math.cos(a) * r, Math.sin(a) * r)
      b.setRotation(a + Math.PI / 2 + 0.5)
    }
  }

  deactivate(): void {
    for (const b of this.blades) b.setVisible(false)
    this.setActive(false).setVisible(false)
  }
}
