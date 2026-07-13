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
  /** Flat total for a per-level additive upgrade. */
  private add(id: MetaId): number {
    return META[id].per * this.levelOf(id)
  }
  /** 1 + total for a per-level percentage upgrade. */
  private up(id: MetaId): number {
    return 1 + this.add(id)
  }

  get startPower(): number {
    return this.add('startPower')
  }
  get bonusMaxHp(): number {
    return this.add('maxHp')
  }
  get damageMul(): number {
    return this.up('damage')
  }
  get coinMul(): number {
    return this.up('coin')
  }
  get moveSpeedMul(): number {
    return this.up('moveSpeed')
  }
  get orbitSpeedMul(): number {
    return this.up('orbitSpeed')
  }
  get critChance(): number {
    return Math.min(0.75, this.add('crit'))
  }
  get xpMul(): number {
    return this.up('xp')
  }
  get startLifesteal(): number {
    return this.add('lifesteal')
  }
  /** Incoming-damage multiplier (< 1 = tankier), floored so it never trivializes. */
  get defenseMul(): number {
    return Math.max(0.3, 1 - this.add('defense'))
  }
  get bossDamageMul(): number {
    return this.up('bossDmg')
  }
  get luck(): number {
    return this.add('luck')
  }
  get healMul(): number {
    return this.up('heal')
  }
  get statusMul(): number {
    return this.up('status')
  }
  get regenPerSec(): number {
    return this.add('regen')
  }
  get magnetRange(): number {
    return this.add('magnet')
  }
  get reviveCount(): number {
    return this.levelOf('revive')
  }
}

export const metaService = new MetaService()
