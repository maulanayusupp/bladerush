// =============================================================================
// Shared game domain types. Framework-agnostic (no Vue / no Phaser imports).
// =============================================================================

/** How a gate mutates the player's power when passed through. */
export type GateOp = 'add' | 'mul'

export interface GateConfig {
  op: GateOp
  value: number
}

/** Derived combat stats computed purely from the current power value. */
export interface PowerStats {
  /** Number of swords orbiting the hero. Grows 1:1 with power. */
  swordCount: number
  /** Damage each sword deals per hit. */
  damage: number
  /** Orbit angular speed in radians/second (rises with sword count). */
  orbitSpeed: number
  /** Cumulative unlocked layer colors (grows as power crosses thresholds). */
  layerColors: number[]
}

export interface EnemyConfig {
  /** Power (sword) reward when this enemy dies — randomized per tier. */
  value: number
  hp: number
  speed: number
  textureKey: string
  scale: number
  tier: string
}

export interface PlayerHealth {
  current: number
  max: number
}

/**
 * Contract for every event that crosses the Phaser <-> Vue boundary.
 * `undefined` marks a payload-less event.
 */
export interface GameEventMap {
  'game:ready': undefined
  'power:changed': { power: number }
  'player:hp': PlayerHealth
  'score:changed': { score: number }
  'game:over': { score: number; power: number; coins: number }
  'game:restart': undefined
  'skill:use': { id: string }
  'skill:started': { id: string; cooldownMs: number; durationMs: number }
  'skill:reset': undefined
  'boss:spawn': { maxHp: number }
  'boss:hp': { current: number; max: number }
  'boss:end': undefined
  'combo:changed': { count: number; mult: number }
  'xp:changed': { level: number; xp: number; next: number }
  'levelup:offer': { ids: string[] }
  'levelup:pick': { id: string }
}
