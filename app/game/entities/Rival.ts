import Phaser from 'phaser'
import { RIVAL } from '../constants'
import { clamp } from '~/helpers/math.helper'

const CRIMSON = 0xff5a5a

/**
 * A rival hero: an enemy that also wields a spinning sword ring, labeled with
 * its sword count. The ring/label shrink live as the duel grinds it down.
 * Movement, the attrition duel and pooling are handled by BattleScene.
 */
export class Rival extends Phaser.GameObjects.Container {
  swordCount = 0
  initialCount = 0
  engaged = false
  clashStep = 1
  clashAcc = 0

  private readonly aura: Phaser.GameObjects.Image
  private readonly ring: Phaser.GameObjects.Image
  private readonly hero: Phaser.GameObjects.Image
  private readonly label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    this.aura = scene.add.image(0, 0, 'aura').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3b3b)
    this.ring = scene.add.image(0, 0, 'swordRing').setTint(CRIMSON)
    this.hero = scene.add.image(0, 2, 'rivalHero0')
    this.label = scene.add
      .text(0, -52, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
    this.label.setStroke('#4a0a0a', 5)
    this.add([this.aura, this.ring, this.hero, this.label])
    scene.add.existing(this)
    this.setActive(false).setVisible(false)
  }

  spawn(x: number, y: number, count: number): void {
    this.initialCount = count
    this.engaged = false
    this.clashAcc = 0
    this.clashStep = 1
    this.setPosition(x, y)
    this.hero.setTexture('rivalHero' + Math.floor(Math.random() * RIVAL.skins))
    this.setCount(count)
    this.setActive(true).setVisible(true)
  }

  /** Update the live sword count; ring + aura scale to reflect it. */
  setCount(count: number): void {
    this.swordCount = count
    this.label.setText(String(Math.max(0, Math.round(count))))
    const scale = clamp(0.8 + count / 180, 0.55, 2.4)
    this.ring.setScale(scale)
    this.aura.setScale(scale * 1.3).setAlpha(0.4)
  }

  spin(deltaMs: number): void {
    this.ring.rotation += 3 * (deltaMs / 1000)
  }

  deactivate(): void {
    this.setActive(false).setVisible(false)
  }
}
