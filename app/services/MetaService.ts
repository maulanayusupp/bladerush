// =============================================================================
// MetaService — persistent meta-progression (coins + permanent upgrade levels).
// A plain localStorage-backed singleton shared by the Vue shop and the Phaser
// scene, so neither has to depend on the other.
// =============================================================================
import { META, META_COST_GROWTH, META_IDS, PRESTIGE } from '~/game/constants'

type MetaId = (typeof META_IDS)[number]

const STORAGE_KEY = 'blade-rush:meta'

class MetaService {
  private coinsValue = 0
  private levels: Record<string, number> = {}
  private stars = 0 // permanent Prestige Stars (never reset)
  private loaded = false

  load(): void {
    if (this.loaded) return
    this.loaded = true
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as { coins?: number; levels?: Record<string, number>; stars?: number }
        this.coinsValue = data.coins ?? 0
        this.levels = data.levels ?? {}
        this.stars = data.stars ?? 0
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private save(): void {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: this.coinsValue, levels: this.levels, stars: this.stars }))
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

  /** Spend coins if affordable. @returns true on success. */
  spendCoins(amount: number): boolean {
    this.load()
    const cost = Math.max(0, Math.round(amount))
    if (this.coinsValue < cost) return false
    this.coinsValue -= cost
    this.save()
    return true
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

  // ---- Prestige ----
  get prestigeStars(): number {
    this.load()
    return this.stars
  }

  /** Sum of every meta-upgrade level currently owned (prestige investment). */
  totalLevels(): number {
    this.load()
    return META_IDS.reduce((sum, id) => sum + this.levelOf(id), 0)
  }

  /** How many Prestige Stars a prestige right now would grant. */
  prestigeStarsPreview(): number {
    return Math.max(1, Math.floor(this.totalLevels() / PRESTIGE.starsPer))
  }

  canPrestige(): boolean {
    return this.totalLevels() >= PRESTIGE.require
  }

  /** Reset coins + all upgrades for permanent stars. @returns stars gained (0 if ineligible). */
  prestige(): number {
    if (!this.canPrestige()) return 0
    const gained = this.prestigeStarsPreview()
    this.stars += gained
    this.coinsValue = 0
    this.levels = {}
    this.save()
    return gained
  }

  /** Permanent prestige multiplier (+perStar per star), applied to damage & coins. */
  get prestigeMul(): number {
    return 1 + PRESTIGE.perStar * this.prestigeStars
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
    return this.up('damage') * this.prestigeMul
  }
  get coinMul(): number {
    return this.up('coin') * this.prestigeMul
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
