// =============================================================================
// MetaService — persistent meta-progression (coins + permanent upgrade levels).
// A plain localStorage-backed singleton shared by the Vue shop and the Phaser
// scene, so neither has to depend on the other.
// =============================================================================
import { META, META_COST_GROWTH, META_IDS } from '~/game/constants'

type MetaId = (typeof META_IDS)[number]

const STORAGE_KEY = 'blade-rush:meta'

class MetaService {
  private coinsValue = 0
  private levels: Record<string, number> = {}
  private loaded = false

  load(): void {
    if (this.loaded) return
    this.loaded = true
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as { coins?: number; levels?: Record<string, number> }
        this.coinsValue = data.coins ?? 0
        this.levels = data.levels ?? {}
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private save(): void {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: this.coinsValue, levels: this.levels }))
    }
  }

  get coins(): number {
    this.load()
    return this.coinsValue
  }

  addCoins(amount: number): void {
    this.load()
    this.coinsValue += Math.max(0, Math.round(amount))
    this.save()
  }

  levelOf(id: MetaId): number {
    this.load()
    return this.levels[id] ?? 0
  }

  maxed(id: MetaId): boolean {
    return this.levelOf(id) >= META[id].max
  }

  cost(id: MetaId): number {
    return Math.round(META[id].baseCost * Math.pow(META_COST_GROWTH, this.levelOf(id)))
  }

  canBuy(id: MetaId): boolean {
    return !this.maxed(id) && this.coins >= this.cost(id)
  }

  buy(id: MetaId): boolean {
    if (!this.canBuy(id)) return false
    this.coinsValue -= this.cost(id)
    this.levels[id] = this.levelOf(id) + 1
    this.save()
    return true
  }

  // ---- Derived bonuses applied at run start ----
  get startPower(): number {
    return META.startPower.per * this.levelOf('startPower')
  }
  get bonusMaxHp(): number {
    return META.maxHp.per * this.levelOf('maxHp')
  }
  get damageMul(): number {
    return 1 + META.damage.per * this.levelOf('damage')
  }
  get coinMul(): number {
    return 1 + META.coin.per * this.levelOf('coin')
  }
}

export const metaService = new MetaService()
