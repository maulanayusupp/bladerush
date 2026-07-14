// =============================================================================
// CodexScene — a scrollable gallery of every baked unit/weapon variation. It
// reuses the exact textures baked by BootScene (no duplicated art). The active
// category comes from the game registry ('codexCategory'), driven by Vue tabs.
// =============================================================================
import Phaser from 'phaser'
import { HERO, HERO_RARITIES, SWORD_SHAPES, TROOP, heroName, heroRarity } from '../constants'
import { clamp } from '~/helpers/math.helper'
import { codexService, type CodexCategory } from '~/services/CodexService'

interface Category {
  prefix: string
  count: number
  cell: number
  tint?: number
}

const CATEGORIES: Record<string, Category> = {
  hero: { prefix: 'hero', count: HERO.skins, cell: 76 },
  rival: { prefix: 'rivalHero', count: 100, cell: 76 },
  troop: { prefix: 'troop', count: TROOP.count, cell: 76 },
  boss: { prefix: 'boss', count: 100, cell: 92 },
  weapon: { prefix: 'sword', count: SWORD_SHAPES.length, cell: 60, tint: 0xff6b6b },
}

const TOP_PAD = 16

export class CodexScene extends Phaser.Scene {
  private items: Phaser.GameObjects.GameObject[] = []
  private maxScroll = 0
  private dragging = false
  private lastPointerY = 0

  constructor() {
    super('CodexScene')
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#12100f')
    this.build((this.game.registry.get('codexCategory') as string) || 'hero')

    this.game.registry.events.on('changedata-codexCategory', (_p: unknown, value: string) => this.build(value))
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true
      this.lastPointerY = p.y
    })
    this.input.on('pointerup', () => (this.dragging = false))
    this.input.on('pointerupoutside', () => (this.dragging = false))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      this.scrollBy(this.lastPointerY - p.y)
      this.lastPointerY = p.y
    })
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy))
    this.scale.on('resize', () => this.build((this.game.registry.get('codexCategory') as string) || 'hero'))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.registry.events.removeAllListeners('changedata-codexCategory')
    })
  }

  private scrollBy(dy: number): void {
    const cam = this.cameras.main
    cam.scrollY = clamp(cam.scrollY + dy, 0, this.maxScroll)
  }

  /** Rebuild the grid for a category. */
  private build(category: string): void {
    for (const o of this.items) o.destroy()
    this.items = []
    const cat = CATEGORIES[category] ?? CATEGORIES.hero
    if (!cat) return
    codexService.load()
    const catKey = category as CodexCategory

    const viewW = this.scale.width
    const cell = cat.cell
    const cols = Math.max(1, Math.floor((viewW - 16) / cell))
    const gridW = cols * cell
    const startX = (viewW - gridW) / 2 + cell / 2

    // Heroes get a rarity-colored frame around each cell (Codex categorization).
    const frames = category === 'hero' ? this.add.graphics().setDepth(-1) : null
    if (frames) this.items.push(frames)

    for (let i = 0; i < cat.count; i++) {
      const key = `${cat.prefix}${i}`
      if (!this.textures.exists(key)) continue
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = startX + col * cell
      const cy = TOP_PAD + row * cell + cell / 2

      const discovered = codexService.has(catKey, i)
      if (frames) {
        const color = (HERO_RARITIES[heroRarity(i / (cat.count - 1))] as { color: number }).color
        frames.fillStyle(color, discovered ? 0.14 : 0.05)
        frames.fillRoundedRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell - 6, cell - 6, 6)
        frames.lineStyle(2, color, discovered ? 0.85 : 0.25)
        frames.strokeRoundedRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell - 6, cell - 6, 6)
      }
      const sprite = this.add.image(cx, cy - 6, key)
      // Fit into the cell.
      const maxDim = Math.max(sprite.width, sprite.height)
      sprite.setScale(Math.min(1.15, (cell - 22) / maxDim))
      if (!discovered) sprite.setTint(0x0b0b0d).setAlpha(0.9) // locked silhouette
      else if (cat.tint) sprite.setTint(cat.tint)
      this.items.push(sprite)

      // Heroes show their NAME; other categories show the index number.
      const labelText = discovered ? (category === 'hero' ? heroName(i) : String(i)) : '?'
      const label = this.add
        .text(cx, cy + cell / 2 - 11, labelText, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: category === 'hero' ? '9px' : '11px',
          color: discovered ? '#d8d2c4' : '#55504a',
          align: 'center',
          wordWrap: { width: cell - 8 },
        })
        .setOrigin(0.5, 0)
      this.items.push(label)
    }

    const rows = Math.ceil(cat.count / cols)
    const contentH = TOP_PAD + rows * cell + 24
    this.maxScroll = Math.max(0, contentH - this.scale.height)
    this.cameras.main.setBounds(0, 0, viewW, Math.max(contentH, this.scale.height))
    this.cameras.main.scrollY = 0
  }
}
