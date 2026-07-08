// =============================================================================
// UpgradeService — tracks chosen level-up upgrades and exposes the derived
// combat modifiers. Framework-agnostic and unit-testable.
// =============================================================================
import { UPGRADES, UPGRADE_TUNE } from '~/game/constants'

export class UpgradeService {
  private levels: Record<string, number> = {}

  reset(): void {
    this.levels = {}
  }

  apply(id: string): void {
    this.levels[id] = (this.levels[id] ?? 0) + 1
  }

  levelOf(id: string): number {
    return this.levels[id] ?? 0
  }

  /** Return `n` distinct random upgrade ids to offer this level. */
  roll(n: number): string[] {
    const pool = UPGRADES.map((u) => u.id as string)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i] as string
      pool[i] = pool[j] as string
      pool[j] = tmp
    }
    return pool.slice(0, n)
  }

  get damageMul(): number {
    return 1 + UPGRADE_TUNE.damageMulPer * this.levelOf('damage')
  }

  get extraSwords(): number {
    return UPGRADE_TUNE.extraSwordsPer * this.levelOf('swords')
  }

  get orbitMul(): number {
    return 1 + UPGRADE_TUNE.orbitMulPer * this.levelOf('speed')
  }

  get cooldownMul(): number {
    return Math.max(UPGRADE_TUNE.cooldownFloor, 1 - UPGRADE_TUNE.cooldownPer * this.levelOf('haste'))
  }

  get rewardMul(): number {
    return 1 + UPGRADE_TUNE.rewardMulPer * this.levelOf('greed')
  }

  get lifesteal(): number {
    return UPGRADE_TUNE.lifestealPer * this.levelOf('lifesteal')
  }
}
