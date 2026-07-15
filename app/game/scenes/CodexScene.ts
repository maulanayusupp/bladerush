// =============================================================================
// CodexScene — a scrollable gallery of every baked unit/weapon variation. It
// reuses the exact textures baked by BootScene (no duplicated art). The active
// category comes from the game registry ('codexCategory'), driven by Vue tabs.
// =============================================================================
import Phaser from 'phaser'
import { HERO, HERO_RARITIES, SWORD_SHAPES, TROOP, bossName, heroName, heroRarity, heroUnlockCost, rivalName, troopName, weaponName } from '../constants'
import { clamp } from '~/helpers/math.helper'
import { formatCompact } from '~/helpers/format.helper'
import { codexService, type CodexCategory } from '~/services/CodexService'
import { loadoutService } from '~/services/LoadoutService'
import { metaService } from '~/services/MetaService'
import { gameEventBus } from '~/services/EventBus'

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
  private dragDist = 0

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
      this.dragDist = 0
    })
    this.input.on('pointerup', () => (this.dragging = false))
    this.input.on('pointerupoutside', () => (this.dragging = false))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      this.dragDist += Math.abs(this.lastPointerY - p.y)
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
    // Preserve the scroll position across rebuilds (e.g. selecting/unlocking).
    const prevScroll = this.cameras.main.scrollY
    for (const o of this.items) o.destroy()
    this.items = []
    const cat = CATEGORIES[category] ?? CATEGORIES.hero
    if (!cat) return
    codexService.load()
    metaService.load()
    const catKey = category as CodexCategory

    const viewW = this.scale.width
    const cell = cat.cell
    // Every entry now carries a name → taller rows so the (up to 2-line) labels
    // never overlap the row below.
    const isHero = category === 'hero'
    const rowH = cell + 24
    const cols = Math.max(1, Math.floor((viewW - 16) / cell))
    const gridW = cols * cell
    const startX = (viewW - gridW) / 2 + cell / 2

    // Heroes get a rarity-colored frame around each cell (Codex categorization).
    const frames = isHero ? this.add.graphics().setDepth(-1) : null
    if (frames) this.items.push(frames)

    for (let i = 0; i < cat.count; i++) {
      const key = `${cat.prefix}${i}`
      if (!this.textures.exists(key)) continue
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = startX + col * cell
      const cy = TOP_PAD + row * rowH + cell / 2

      const discovered = codexService.has(catKey, i)
      const selected = isHero && discovered && loadoutService.selectedHero === i
      if (frames) {
        const color = (HERO_RARITIES[heroRarity(i / (cat.count - 1))] as { color: number }).color
        frames.fillStyle(color, discovered ? 0.14 : 0.05)
        frames.fillRoundedRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell - 6, cell - 6, 6)
        frames.lineStyle(selected ? 3.5 : 2, selected ? 0x00ffd0 : color, discovered ? 0.85 : 0.25)
        frames.strokeRoundedRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell - 6, cell - 6, 6)
      }
      const sprite = this.add.image(cx, cy - 8, key)
      // Fit into the cell.
      const maxDim = Math.max(sprite.width, sprite.height)
      sprite.setScale(Math.min(1.1, (cell - 26) / maxDim))
      if (!discovered) sprite.setTint(0x0b0b0d).setAlpha(0.9) // locked silhouette
      else if (cat.tint) sprite.setTint(cat.tint)
      this.items.push(sprite)

      // Heroes are interactive: discovered → select as loadout (tap again for
      // Auto); locked → tap to unlock with coins.
      if (isHero && discovered) {
        sprite.setInteractive({ useHandCursor: true })
        sprite.on('pointerup', () => {
          if (this.dragDist < 12) {
            // Tap the already-selected hero again to release it back to Auto.
            const next = loadoutService.selectedHero === i ? -1 : i
            loadoutService.setHero(next)
            this.game.registry.set('selectedHero', next)
            this.build(category)
          }
        })
        if (selected) {
          const tick = this.add.text(cx + cell / 2 - 12, cy - cell / 2 + 4, '✓', {
            fontFamily: 'Segoe UI, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#00ffd0',
          }).setOrigin(0.5, 0)
          this.items.push(tick)
        }
      } else if (isHero && !discovered) {
        sprite.setInteractive({ useHandCursor: true })
        sprite.on('pointerup', () => {
          if (this.dragDist < 12) this.tryUnlockHero(i, category)
        })
      }

      // Every category shows a name below its cell (wrapped inside the cell so
      // long names never bleed into neighbors). Locked heroes show their coin
      // unlock price instead of a "?" so progression is visible.
      const nm = category === 'rival' ? rivalName(i)
        : category === 'troop' ? troopName(i)
          : category === 'boss' ? bossName(i)
            : category === 'weapon' ? weaponName(i)
              : heroName(i)
      const lockedLabel = isHero ? `💰 ${formatCompact(heroUnlockCost(i))}` : '?'
      const label = this.add
        .text(cx, cy + cell / 2 - 2, discovered ? nm : lockedLabel, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: discovered ? '#e6e0d0' : isHero ? '#ffcf4a' : '#55504a',
          align: 'center',
          wordWrap: { width: cell - 8 },
        })
        .setOrigin(0.5, 0)
      this.items.push(label)
    }

    const rows = Math.ceil(cat.count / cols)
    const contentH = TOP_PAD + rows * rowH + 24
    this.maxScroll = Math.max(0, contentH - this.scale.height)
    this.cameras.main.setBounds(0, 0, viewW, Math.max(contentH, this.scale.height))
    this.cameras.main.scrollY = clamp(prevScroll, 0, this.maxScroll)
  }

  /** Spend coins to unlock a locked hero, then auto-select it as the loadout. */
  private tryUnlockHero(index: number, category: string): void {
    const cost = heroUnlockCost(index)
    if (!metaService.spendCoins(cost)) {
      // Not enough coins — a red flash reads as "denied".
      this.cameras.main.flash(180, 90, 0, 0)
      return
    }
    codexService.mark('hero', index)
    loadoutService.setHero(index)
    this.game.registry.set('selectedHero', index)
    gameEventBus.emit('meta:coins', { coins: metaService.coins })
    this.cameras.main.flash(200, 0, 220, 190)
    this.build(category)
  }
}
