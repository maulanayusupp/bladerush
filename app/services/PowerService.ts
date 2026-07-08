// =============================================================================
// PowerService — owns the CORE mechanic: power is a single number that grows.
//
//   power = 0            -> the hero has no weapon (no swords)
//   gate "+N"            -> power += N
//   gate "xN"            -> power *= N
//   defeated enemy(value)-> power += value
//
// Power projects onto the orbiting-sword ring: more power => more swords
// (+1 every 50), higher damage, and a faster spin. Framework-agnostic and
// unit-testable.
// =============================================================================
import type { GateConfig, PowerStats } from '~/types/game'
import { MEGA_AURA, MEGA_AURA_COLORS, POWER_CURVE, POWER_LAYERS } from '~/game/constants'
import { clamp } from '~/helpers/math.helper'

/**
 * All aura colors active at the current power (cumulative, never removed):
 * the base tiers, then one extra "mega" color for every 1000 power crossed.
 */
function layerColorsFor(power: number): number[] {
  const colors: number[] = POWER_LAYERS.filter((layer) => power >= layer.min).map((layer) => layer.color)
  const mega = Math.min(MEGA_AURA.max, Math.floor(power / MEGA_AURA.step))
  for (let k = 1; k <= mega; k++) {
    colors.push(MEGA_AURA_COLORS[(k - 1) % MEGA_AURA_COLORS.length] as number)
  }
  return colors
}

export class PowerService {
  private _power = 0

  get power(): number {
    return this._power
  }

  /** Whether the hero currently has any weapon (at least one sword). */
  get hasWeapon(): boolean {
    return this._power > 0
  }

  reset(): void {
    this._power = 0
  }

  applyGate(gate: GateConfig): number {
    this._power = gate.op === 'mul' ? this._power * gate.value : this._power + gate.value
    this._power = Math.max(0, Math.round(this._power))
    return this._power
  }

  addEnemyValue(value: number): number {
    this._power = Math.max(0, Math.round(this._power + value))
    return this._power
  }

  /** Remove power (e.g. the cost of a rival duel). Never below zero. */
  spend(amount: number): number {
    this._power = Math.max(0, Math.round(this._power - amount))
    return this._power
  }

  /** Pure projection of the current power onto combat stats. */
  get stats(): PowerStats {
    const p = this._power
    const swordCount = clamp(
      Math.round(p * POWER_CURVE.swordsPerPower),
      0,
      POWER_CURVE.maxSwordCount,
    )
    return {
      swordCount,
      damage: Math.round(POWER_CURVE.baseDamage + p * POWER_CURVE.damagePerPower),
      orbitSpeed: clamp(
        POWER_CURVE.baseOrbitSpeed + swordCount * POWER_CURVE.orbitSpeedPerSword,
        POWER_CURVE.baseOrbitSpeed,
        POWER_CURVE.maxOrbitSpeed,
      ),
      layerColors: layerColorsFor(this._power),
    }
  }
}
