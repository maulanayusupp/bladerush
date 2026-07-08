// =============================================================================
// Phaser game factory. Imported dynamically (client-only) by GameCanvas.vue so
// Phaser's reliance on `window` never runs during SSR.
// =============================================================================
import Phaser from 'phaser'
import { ARENA } from './constants'
import { BootScene } from './scenes/BootScene'
import { BattleScene } from './scenes/BattleScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#24361f',
    scale: {
      // Fill the parent element (full width & full height); the scene reads
      // live dimensions from the Scale Manager and reacts to 'resize'.
      mode: Phaser.Scale.RESIZE,
      width: ARENA.width,
      height: ARENA.height,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, BattleScene],
  })
}
