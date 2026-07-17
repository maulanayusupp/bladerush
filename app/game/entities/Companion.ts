import Phaser from 'phaser'
import { PET } from '../constants'

/**
 * A companion pet: a non-physics sprite that smoothly trails the hero, bobs, and
 * swaps texture as it EVOLVES through its forms. Attacks are driven by the scene
 * (it fires a zap at nearby enemies); this entity is purely follow + look.
 */
export class Companion extends Phaser.GameObjects.Image {
  form = -1
  private baseScale = 0.8

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'pet0')
    scene.add.existing(this)
    this.setDepth(2)
    this.setActive(false).setVisible(false)
  }

  spawnAt(x: number, y: number): void {
    this.setPosition(x, y)
    this.setActive(true).setVisible(true)
  }

  /** Evolve to a new form (bigger + a small pop handled by the scene). */
  setForm(i: number): boolean {
    if (i === this.form) return false
    this.form = i
    this.setTexture(`pet${i}`)
    this.baseScale = 0.72 + i * 0.028 // grows as it evolves
    return true
  }

  /** Smoothly trail the hero, hovering to its side with a gentle bob. */
  follow(hx: number, hy: number, t: number): void {
    const tx = hx - PET.followDist
    const ty = hy - PET.followDist * 0.5 + Math.sin(t / 300) * 6
    this.x += (tx - this.x) * PET.followLerp
    this.y += (ty - this.y) * PET.followLerp
    this.setScale(this.baseScale * (1 + Math.sin(t / 260) * 0.06))
  }
}
