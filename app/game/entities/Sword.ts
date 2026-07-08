import Phaser from 'phaser'

/**
 * One blade in the orbiting ring around the hero. Positioned every frame by the
 * scene; its physics body only exists to overlap enemies. Pooled (fixed-size
 * array) — activated/deactivated as the sword count changes with power.
 */
export class Sword extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'sword')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.disableBody(true, true)
  }

  place(x: number, y: number, rotation: number): void {
    if (!this.active) this.enableBody(true, x, y, true, true)
    this.setPosition(x, y)
    this.setRotation(rotation)
  }

  deactivate(): void {
    if (this.active) this.disableBody(true, true)
  }
}
