// =============================================================================
// Codex game factory — boots the same texture baking as the main game, then
// enters CodexScene (a gallery) instead of BattleScene. Client-only.
// =============================================================================
import Phaser from 'phaser'
import { ARENA } from './constants'
import { BootScene } from './scenes/BootScene'
import { CodexScene } from './scenes/CodexScene'

export function createCodex(parent: HTMLElement, category: string): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#12100f',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: ARENA.width,
      height: ARENA.height,
    },
    scene: [BootScene, CodexScene],
  })
  game.registry.set('nextScene', 'CodexScene')
  game.registry.set('codexCategory', category)
  return game
}
