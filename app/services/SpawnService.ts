// =============================================================================
// SpawnService — decides WHAT to spawn (gate/enemy configs) and scales
// difficulty with elapsed time. It does NOT own timing or Phaser objects;
// the scene calls these methods on its own timers.
// =============================================================================
import type { EnemyConfig, GateConfig } from '~/types/game'
import { ENEMY_TIERS, RIVAL, SPAWN } from '~/game/constants'
import { clamp, pickOne, randomInt, randomRange } from '~/helpers/math.helper'

export class SpawnService {
  /** Current interval between enemy spawns, shrinking as time passes. */
  enemyInterval(elapsedSec: number): number {
    return clamp(
      SPAWN.enemyStartIntervalMs - elapsedSec * SPAWN.enemyRampPerSec,
      SPAWN.enemyMinIntervalMs,
      SPAWN.enemyStartIntervalMs,
    )
  }

  gateInterval(): number {
    return SPAWN.gateIntervalMs
  }

  /** Pick a tier; the "active" tier advances ~every 40s, others stay possible. */
  private pickTier(elapsedSec: number): (typeof ENEMY_TIERS)[number] {
    const weights = ENEMY_TIERS.map((_, i) => Math.max(0.04, 1 - Math.abs(elapsedSec / 40 - i) * 0.7))
    const total = weights.reduce((sum, w) => sum + w, 0)
    let roll = Math.random() * total
    for (let i = 0; i < ENEMY_TIERS.length; i++) {
      roll -= weights[i] as number
      if (roll <= 0) return ENEMY_TIERS[i] as (typeof ENEMY_TIERS)[number]
    }
    return ENEMY_TIERS[0] as (typeof ENEMY_TIERS)[number]
  }

  /**
   * Build an enemy of a time-weighted tier. HP and sword reward scale with the
   * player's current power so encounters stay meaningful (and rewarding) as the
   * hero levels up.
   */
  createEnemy(elapsedSec: number, playerPower: number): EnemyConfig {
    const tier = this.pickTier(elapsedSec)
    const hpScale = 1 + playerPower * SPAWN.enemyHpPerPower
    const rewardScale = 1 + playerPower * SPAWN.enemyRewardPerPower
    return {
      value: Math.max(1, Math.round(randomInt(tier.value[0], tier.value[1]) * rewardScale)),
      hp: Math.round(tier.hp * hpScale),
      speed: randomRange(tier.speed[0], tier.speed[1]),
      textureKey: tier.texture,
      scale: tier.scale,
      tier: tier.id,
    }
  }

  /**
   * A rival's sword count. Scales with BOTH elapsed time and the player's
   * current power so rivals stay relevant. With RIVAL.strongChance the rival is
   * clearly stronger than the player — a threat you must flee.
   */
  createRivalCount(elapsedSec: number, playerPower: number): number {
    const timeBase = 25 + elapsedSec * 4
    const scaled = Math.max(timeBase, playerPower * randomRange(0.6, 1.1))
    if (Math.random() < RIVAL.strongChance) {
      return Math.round(Math.max(scaled, playerPower + 5) * randomRange(1.3, 2.2))
    }
    return Math.max(15, Math.round(scaled))
  }

  /** Gate favors additive bonuses; occasional multipliers create spikes. */
  createGate(): GateConfig {
    const isMultiplier = Math.random() < 0.25
    if (isMultiplier) {
      return { op: 'mul', value: pickOne([2, 3]) }
    }
    return { op: 'add', value: randomInt(3, 12) }
  }
}
