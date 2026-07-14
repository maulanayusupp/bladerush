// =============================================================================
// Gameplay tuning constants. Centralized so balance can be tweaked without
// touching logic. The game is an OPEN WORLD: a large fixed `WORLD` the camera
// follows the hero across (Scale.RESIZE only governs the viewport). ARENA is a
// legacy fallback size; WORLD is the real playfield.
// =============================================================================

export const ARENA = {
  width: 720,
  height: 1280,
} as const

/**
 * Open-world arena: a large scrollable world the camera follows the hero across
 * (instead of a single bounded screen). The ground tiles beneath, decor is
 * scattered over the whole world, and ambient particles keep it alive.
 */
export const WORLD = {
  width: 3200,
  height: 3200,
  cameraLerp: 0.11, // how snappily the camera tracks the hero (0..1)
} as const

/**
 * Screen-pinned minimap (top-right) so the hero can orient in the open world:
 * blips for foes, boss, rivals, gates & heals, plus the current camera view.
 * Rendered in Phaser (Graphics, scrollFactor 0) — never per-frame Vue.
 */
export const MINIMAP = {
  maxSize: 148, // box side cap (desktop) in px
  minSize: 78, // never smaller than this (tiny phones)
  screenFraction: 0.26, // scale to this fraction of the shorter screen side
  margin: 14,
  colors: {
    panel: 0x0a0a12,
    border: 0x6a5a38,
    view: 0xffffff,
    player: 0x8ce8ff,
    enemy: 0xff5a5a,
    rival: 0xff8a3a,
    boss: 0xff2020,
    gate: 0xffd700,
    heal: 0x6bff9a,
  },
} as const

/**
 * Arena themes: a SUBTLE tiling ground (fine grain only, so no obvious loop)
 * plus scattered decoration props (trees/rocks/etc.) placed at random world
 * positions for a natural, non-repeating look. Each theme also has an `ambient`
 * layer — drifting motes / falling snow / rising embers — so the map moves and
 * feels alive. One theme per run.
 *
 * ambient.dir: 'fall' (down) | 'rise' (up) | 'side' (wind) | 'drift' (float).
 */
export const MAP_TILE = 256
export const DECOR_COUNT = 220
export const MAPS = [
  { key: 'map0', name: 'Verdant Meadow', props: ['treePine', 'rockGray', 'bushGreen'], ambient: { tint: 0xdff3b0, dir: 'drift' } },
  { key: 'map1', name: 'Sunscar Desert', props: ['cactus', 'rockSand', 'deadBush'], ambient: { tint: 0xe8cf96, dir: 'side' } },
  { key: 'map2', name: 'Frostwind Tundra', props: ['treeSnow', 'rockIce', 'snowMound'], ambient: { tint: 0xffffff, dir: 'fall' } },
  { key: 'map3', name: 'Emberfall Caldera', props: ['deadTree', 'rockChar', 'lavaCrystal'], ambient: { tint: 0xff9a4a, dir: 'rise' } },
  { key: 'map4', name: 'The Void Expanse', props: ['crystalVoid', 'asteroid', 'starCluster'], ambient: { tint: 0xc9b0ff, dir: 'drift' } },
] as const

export const PLAYER = {
  size: 44, // texture footprint in px
  speed: 300, // px/s, free 2D movement toward the pointer (calmer, less chaotic)
  maxHp: 100,
  invulnMs: 750, // brief immunity after taking contact damage
  colorHex: 0x7c4dff,
  // Pointer control: ignore tiny cursor movements within this radius of the
  // hero so aiming isn't twitchy. Keyboard (WASD / arrows) ignores it.
  pointerDeadzone: 30,
} as const

/** Distinct player blade silhouettes (baked as sword0..N, tinted per tier). */
export const SWORD_SHAPES = [
  'leaf', 'straight', 'curved', 'broad', 'rapier', 'shard', 'cleaver', 'saber', 'glaive', 'fork',
  'katana', 'scimitar', 'greatsword', 'dagger', 'kris', 'trident', 'scythe', 'twin', 'nodachi', 'khopesh',
  'flamberge', 'claymore', 'cutlass', 'estoc', 'crystal', 'bone', 'machete', 'falchion',
] as const

/**
 * The hero's look + size evolve with SCORE (monotonic — never flips backwards),
 * on a log curve that keeps advancing to the golden top tiers even at
 * astronomical survivor scores.
 */
export const HERO = {
  skins: 100,
  // Look/size evolve with SCORE (monotonic — never flips backwards). tier =
  // floor(tierPerLog10 * log10(1 + score)); ~1.85 reaches the golden top tier
  // around score 1e54 (survivor scores climb astronomically).
  tierPerLog10: 1.85,
  // The hero physically grows from scrawny "culun" to a towering champion.
  minScale: 0.6,
  maxScale: 1.85,
} as const

/**
 * Hero equipment held in-hand (by skin index): a sword, dual swords, a spear,
 * or a shield. Carrying a shield reduces incoming damage.
 */
export const GEAR = {
  types: ['sword', 'dual', 'spear', 'shield'] as const,
  shieldDefenseMul: 0.6, // incoming damage × this while shielded
} as const

/** Which gear a given hero skin carries (deterministic). */
export function gearOf(skinIndex: number): number {
  return skinIndex % GEAR.types.length
}

export const SWORD = {
  orbitRadius: 84, // distance of the innermost ring from the hero
  poolSize: 60, // must equal POWER_CURVE.maxSwordCount
  hitCooldownMs: 120, // per-enemy cooldown so a sweep doesn't drain HP each frame
  // When there are lots of swords, spread them across concentric rings so you
  // can still read individual blades instead of a solid "beyblade" disc.
  ringGap: 32, // radius added per extra ring
  bladeSpacing: 36, // target arc distance between blades on a ring (px)
  minPerRing: 8,
  // Hard cap on how many blades are DRAWN (power still scales damage) so the
  // ring never becomes an unreadable swarm.
  maxVisible: 24,
} as const

/** Soft glow disc baked in BootScene; one tinted copy per unlocked layer. */
export const AURA = {
  textureRadius: 100,
  baseRadius: 92, // inner aura radius (px), just outside the sword ring
  layerGap: 5, // each stacked layer sits this much further out
  maxRadius: 150, // hard cap so stacked mega layers never sprawl
} as const

/**
 * CUMULATIVE power layers keyed on total power. Every threshold you cross
 * UNLOCKS a color/effect that STAYS — higher power = more stacked aura rings
 * and a more multi-colored sword ring (increasingly menacing). Ordered
 * ascending.
 */
export const POWER_LAYERS = [
  { min: 1, color: 0x8ce99a }, // green
  { min: 50, color: 0xffd43b }, // yellow
  { min: 100, color: 0xffa94d }, // orange
  { min: 200, color: 0xff6b6b }, // red
  { min: 350, color: 0xb794ff }, // violet
  { min: 500, color: 0xffd700 }, // gold
] as const

/**
 * Beyond the base layers, EVERY 1000 power stacks one more "mega" aura ring —
 * larger, brighter and more menacing — cycling this dark/infernal palette.
 * These add on top of the base layers (never replace them).
 */
export const MEGA_AURA = { step: 1000, max: 12 } as const
export const MEGA_AURA_COLORS = [
  0xff2d2d, 0xb0103a, 0x7a0b5e, 0xff6a00, 0x39104f, 0x00e0d0,
  0x8b0000, 0xd400ff, 0x101018, 0xffe14d, 0x00ff88, 0xff004c,
] as const

export const ENEMY = {
  size: 44, // spawn-margin hint (actual body comes from each texture)
  poolSize: 180,
  contactDamage: 14,
} as const

/**
 * Enemy troop roster: 500 procedurally-generated monsters split evenly across
 * the 5 tiers (100 per tier). Higher tiers/indices are fiercer (horns, tusks,
 * spikes, glow) and bigger. Kept as a constant so BootScene (baking) and
 * SpawnService (tier→texture) agree on the counts.
 */
export const TROOP = {
  count: 500,
  perTier: 100, // count / ENEMY_TIERS.length
} as const

/**
 * AI survivors — autonomous heroes that roam the world like the player: chase &
 * shred enemies with their own sword ring, grab gates/chests/hearts, help fight
 * the boss, grow in power, die and respawn. Purely cosmetic to the player's
 * economy (they don't grant the player rewards) but they liven the battlefield.
 */
export const NPC = {
  count: 10,
  baseHp: 90,
  speed: 150,
  ringRadius: 74,
  blades: 8,
  hitTickMs: 160,
  damageBase: 10,
  damagePerPower: 0.6,
  contactDamage: 10,
  respawnMs: 5000,
  seekRange: 620, // how far they look for enemies/pickups
  colors: [
    0x5ad0ff, 0xff5a5a, 0x6bff9a, 0xffd24a, 0xd48aff,
    0xff8a3a, 0x00e0d0, 0xff5aa0, 0x9d5cff, 0xa0e060,
  ],
} as const

/**
 * Elite affixes: some enemies spawn "elite" with a modifier + a telltale tint.
 * - swift: fast & small; - brute: tanky, big, high reward; - shielded: halves
 *   incoming damage; - volatile: detonates on death, chaining into nearby foes.
 * Chance rises over the run.
 */
export const ELITE = {
  baseChance: 0.06,
  chancePerMin: 0.012,
  maxChance: 0.24,
  affixes: ['swift', 'brute', 'shielded', 'volatile'] as const,
  swift: { hp: 0.8, speed: 1.7, scale: 0.85, reward: 1.6, dmgTaken: 1, tint: 0xffe14d },
  brute: { hp: 3.6, speed: 0.72, scale: 1.35, reward: 3, dmgTaken: 1, tint: 0xff5a5a },
  shielded: { hp: 1.8, speed: 0.9, scale: 1.12, reward: 2, dmgTaken: 0.5, tint: 0x5ad0ff },
  volatile: { hp: 1.1, speed: 1.15, scale: 1.05, reward: 2.2, dmgTaken: 1, tint: 0xff8a3a },
  volatileRadius: 95,
} as const

/**
 * Enemy tiers from easy to legend. Each has a distinct baked shape, HP, speed
 * range, size scale and a RANDOM sword-reward range. Spawn weight shifts toward
 * tougher tiers as the run goes on (see SpawnService.pickTier).
 */
export const ENEMY_TIERS = [
  { id: 'easy', texture: 'enemyEasy', hp: 10, value: [1, 2], speed: [70, 96], scale: 0.8 },
  { id: 'medium', texture: 'enemyMed', hp: 28, value: [2, 4], speed: [64, 90], scale: 1.0 },
  { id: 'hard', texture: 'enemyHard', hp: 60, value: [4, 7], speed: [56, 80], scale: 1.15 },
  { id: 'elite', texture: 'enemyElite', hp: 120, value: [8, 14], speed: [50, 72], scale: 1.3 },
  { id: 'legend', texture: 'enemyLegend', hp: 260, value: [18, 32], speed: [40, 58], scale: 1.65 },
] as const

/**
 * Active abilities the player triggers from the HUD.
 * - fury: temporary blade-storm (faster, wider, harder).
 * - nova: instant shockwave damaging every enemy on screen.
 */
export const SKILLS = {
  fury: { id: 'fury', cooldownMs: 12000, durationMs: 4500, orbitMul: 2, radiusMul: 1.35, damageMul: 2.2 },
  // Nova damage scales with the hero's sword damage (a fixed value is useless
  // once enemy HP scales with power) — a big screen-clearing nuke.
  nova: { id: 'nova', cooldownMs: 15000, durationMs: 0, damage: 140, damageMul: 14, bossTicks: 8 },
  dash: { id: 'dash', cooldownMs: 4500, durationMs: 300, speedMul: 4.5 },
} as const

/** Brief freeze on big moments (boss kill) for punch. */
export const HITSTOP_MS = 70

/** Treasure chests dropped by kills; run into them for a reward. */
export const CHEST = {
  poolSize: 8,
  dropChance: 0.02, // per normal kill
  size: 30,
  basePower: 8,
  baseCoins: 5,
  powerFromCurrent: 0.15, // reward also scales with current power
  rarities: [
    { id: 'common', weight: 70, tint: 0x9a6a3a, mul: 1 },
    { id: 'rare', weight: 25, tint: 0xc7ccd8, mul: 3 },
    { id: 'epic', weight: 5, tint: 0xffd700, mul: 8 },
  ],
} as const

export const GATE = {
  width: 132,
  height: 54,
  speed: 130,
  poolSize: 14,
} as const

/**
 * Curves that turn the single `power` number into combat stats.
 * Swords grow 1:1 with power (a "+2" gate adds 2 swords, "x2" doubles them);
 * more swords => faster spin.
 * @see PowerService
 */
export const POWER_CURVE = {
  swordsPerPower: 1, // 1 sword per point of power
  maxSwordCount: 60, // safety cap (keep in sync with SWORD.poolSize)

  baseDamage: 6,
  damagePerPower: 0.6,

  baseOrbitSpeed: 1.4, // rad/s with a single sword
  orbitSpeedPerSword: 0.02, // very gentle acceleration as the ring grows
  maxOrbitSpeed: 2.4, // rad/s cap — a calm, readable spin (not a blur)
} as const

/**
 * Rival heroes — enemies that ALSO wield a sword ring, labeled with their sword
 * count. On body contact a "number duel" resolves:
 *   player >= rival  -> WIN: swords -= rival, then rival drops its swords back
 *                       (net-zero power) + big score + green flash.
 *   player <  rival  -> LOSE: you're overwhelmed (swords wiped) + heavy damage.
 * They appear at random intervals and must be out-grown to be beaten.
 */
export const RIVAL = {
  poolSize: 4,
  skins: 100, // number of distinct warlord textures (rivalHero0..99)
  minIntervalMs: 8500,
  maxIntervalMs: 15000,
  // Rivals appear more often as you get stronger: interval *= factor.
  intervalPowerFactor: 0.00055,
  minIntervalFactor: 0.32,
  // Chance a rival spawns clearly STRONGER than you (must be dodged / fled).
  strongChance: 0.35,
  speed: 55, // homing approach speed (px/s)
  clashDist: 118, // center distance at which the two rings lock and grind
  clashTickMs: 85, // time between clash exchanges
  clashTicksTarget: 22, // ~ how many exchanges a duel takes (shorter, snappier)
  loseDamage: 45,
  scoreMultiplier: 3,
} as const

/**
 * Boss: a big, high-HP milestone enemy. First arrives after ~55s, then every
 * ~70s (only one at a time). HP/reward scale with elapsed time. Sword damage
 * vs the boss is dealt in ticks scaled by the whole ring, so a bigger ring
 * melts it faster — keeping the fight length roughly balanced across power.
 */
export const BOSS = {
  skins: 100, // number of distinct boss textures (boss0..99)
  firstMs: 55000,
  intervalMs: 70000,
  speed: 40,
  contactDamage: 14, // gentler body contact so you aren't chipped to death
  contactCooldownMs: 900,
  hitTickMs: 100,
  // HP is derived from the player's current damage output so the fight always
  // lasts about this long — and grows tankier over the run.
  targetSeconds: 10,
  secondsPerMin: 1.5,
  minHp: 1800,
  // Sword ticks help sub-linearly (a bigger ring melts it faster, but not 60×).
  swordCountFactor: 0.12,
  // Cap a single tick so power spikes (×N gates) can't one-shot the boss.
  // 0.02 → min ~50 ticks ≈ 5s even at absurd power.
  maxHitFraction: 0.02,
  enrageAt: 0.35, // below this HP fraction the boss enrages
  summonMs: 4200,
  summonCount: 5,
  scoreMul: 6,
  // While a boss is up, big multiplier gates (×N) appear so you can power up.
  gateIntervalMs: 2600,
  gateValues: [3, 3, 5, 5, 10] as const,
} as const

/**
 * Boss attack patterns. Two telegraphed threats layered on the melee ring:
 *  - fan: a spread of homing-launched fireballs aimed at the hero.
 *  - meteors: telegraphed AoE — a warning ring blooms on the ground, then a
 *    meteor slams down for a big radial hit. Dodge out of the ring in time.
 * When the boss enrages, everything comes faster and denser.
 */
export const BOSS_ATTACK = {
  fanIntervalMs: 2600,
  fanCount: 7, // projectiles per fan (+2 when enraged)
  fanSpreadRad: 1.15, // total angular spread
  projectileSpeed: 250,
  projectileDamage: 16,
  projectilePool: 60,

  meteorIntervalMs: 3400,
  meteorCount: 3, // meteors per volley (+1 when enraged)
  meteorTelegraphMs: 950, // warning-ring lead time before impact
  meteorFallMs: 260,
  meteorRadius: 74, // AoE damage radius
  meteorSpread: 170, // how far around the hero they scatter
  meteorDamage: 24,

  enrageRateMul: 0.62, // intervals * this when enraged (faster cadence)
} as const

/**
 * XP + leveling: kills grant XP; each level offers a choice of 3 upgrades.
 * Threshold grows geometrically so level-ups get progressively rarer instead
 * of popping every few kills.
 */
export const LEVEL = {
  baseXp: 30, // XP for the first level-up
  growth: 1.8, // each level costs much more — climbs to 1k / 5k / 10k / 20k kills
  xpPerKill: 1,
  xpPerBoss: 8,
} as const

/** Pickable upgrades (icon here; name/description via i18n `upgrades.<id>`). */
export const UPGRADES = [
  { id: 'damage', icon: '🗡️' },
  { id: 'swords', icon: '➕' },
  { id: 'speed', icon: '🌀' },
  { id: 'haste', icon: '⚡' },
  { id: 'greed', icon: '💰' },
  { id: 'vigor', icon: '❤️' },
  { id: 'lifesteal', icon: '🩸' },
  { id: 'burn', icon: '🔥' },
  { id: 'frost', icon: '❄️' },
  { id: 'venom', icon: '🧪' },
] as const

export const UPGRADE_TUNE = {
  damageMulPer: 0.2,
  extraSwordsPer: 2,
  orbitMulPer: 0.15,
  cooldownPer: 0.1,
  cooldownFloor: 0.4,
  rewardMulPer: 0.15,
  maxHpPer: 20,
  lifestealPer: 1,
} as const

/**
 * Elemental status effects applied by the sword ring when the matching upgrade
 * is owned. Damage-over-time scales with the hero's hit damage × level.
 * - burn: fire DoT for a short time.  - venom: poison DoT (longer).
 * - frost: chills, slowing the enemy's movement.
 */
export const STATUS = {
  burnMs: 2200,
  burnDpsPer: 0.45, // × level × hit damage, per second
  poisonMs: 3200,
  poisonDpsPer: 0.32,
  chillMs: 1600,
  chillPer: 0.18, // slow per level
  chillFloor: 0.35, // never slower than 35% speed
  tickMs: 220, // DoT application cadence (also spark cadence)
  burnTint: 0xff7a3a,
  poisonTint: 0x8cff5a,
  chillTint: 0x8ad0ff,
} as const

/**
 * Meta-progression: coins earned per run buy permanent upgrades in the menu
 * shop (persisted). Costs grow geometrically. name/text via i18n `meta.<id>`.
 */
export const META = {
  startPower: { baseCost: 50, per: 10, max: 50, icon: '⚔️' }, // +swords at run start
  maxHp: { baseCost: 40, per: 20, max: 50, icon: '❤️' }, // +start max HP
  damage: { baseCost: 60, per: 0.1, max: 60, icon: '🗡️' }, // +% base sword damage
  coin: { baseCost: 80, per: 0.15, max: 40, icon: '💰' }, // +% coins earned
  moveSpeed: { baseCost: 70, per: 0.05, max: 20, icon: '🏃' }, // +% move speed
  orbitSpeed: { baseCost: 70, per: 0.06, max: 20, icon: '🌀' }, // +% ring spin
  crit: { baseCost: 120, per: 0.03, max: 20, icon: '🎯' }, // +crit chance (2× dmg)
  xp: { baseCost: 90, per: 0.1, max: 25, icon: '📘' }, // +% XP gained
  lifesteal: { baseCost: 150, per: 1, max: 15, icon: '🩸' }, // +HP healed per kill
  defense: { baseCost: 130, per: 0.04, max: 15, icon: '🛡️' }, // -% damage taken
  bossDmg: { baseCost: 140, per: 0.12, max: 30, icon: '💀' }, // +% damage vs bosses
  luck: { baseCost: 110, per: 0.05, max: 20, icon: '🍀' }, // +chest drop & rarity
  heal: { baseCost: 90, per: 0.15, max: 20, icon: '💊' }, // +% heart pickup
  status: { baseCost: 130, per: 0.15, max: 25, icon: '🔥' }, // +% burn/frost/venom
  regen: { baseCost: 160, per: 0.5, max: 20, icon: '✨' }, // +HP regen / sec
  magnet: { baseCost: 120, per: 40, max: 12, icon: '🧲' }, // +pull range for gates/hearts
  revive: { baseCost: 1000, per: 1, max: 3, icon: '🕊️' }, // survive death N times
} as const
/**
 * One-time achievements evaluated at the end of a run. Unlocking one grants
 * coins (once ever). `metric` maps to a RunStats field (or final power / rank).
 */
export const ACHIEVEMENTS = [
  { id: 'kills100', metric: 'kills', value: 100, reward: 100, icon: '⚔️' },
  { id: 'kills1000', metric: 'kills', value: 1000, reward: 500, icon: '⚔️' },
  { id: 'kills10000', metric: 'kills', value: 10000, reward: 2500, icon: '⚔️' },
  { id: 'boss1', metric: 'bosses', value: 1, reward: 150, icon: '💀' },
  { id: 'boss10', metric: 'bosses', value: 10, reward: 1200, icon: '💀' },
  { id: 'combo50', metric: 'topCombo', value: 50, reward: 300, icon: '🔥' },
  { id: 'combo200', metric: 'topCombo', value: 200, reward: 1500, icon: '🔥' },
  { id: 'absorb3', metric: 'npcsAbsorbed', value: 3, reward: 400, icon: '🩸' },
  { id: 'absorb10', metric: 'npcsAbsorbed', value: 10, reward: 1800, icon: '🩸' },
  { id: 'survive300', metric: 'timeSec', value: 300, reward: 500, icon: '⏱️' },
  { id: 'power1m', metric: 'power', value: 1e6, reward: 800, icon: '💪' },
  { id: 'power1t', metric: 'power', value: 1e12, reward: 3500, icon: '💪' },
  { id: 'champion', metric: 'rank1', value: 1, reward: 2500, icon: '👑' },
] as const

export const META_IDS = [
  'startPower', 'maxHp', 'damage', 'coin', 'moveSpeed', 'orbitSpeed', 'crit', 'xp',
  'lifesteal', 'defense', 'bossDmg', 'luck', 'heal', 'status', 'regen', 'magnet', 'revive',
] as const
export const META_COST_GROWTH = 1.6
export const COINS_PER_SCORE = 0.01

/** Rapid kills build a combo that multiplies SCORE (not power). */
export const COMBO = {
  windowMs: 2600, // time to keep the chain alive
  per: 5, // +1× every 5 kills
  maxBonus: 4, // up to ×5
} as const

/** Occasional heart pickup that restores HP. */
export const HEAL = {
  intervalMs: 17000,
  speed: 120,
  amount: 30,
  size: 30,
} as const

export const SPAWN = {
  enemyStartIntervalMs: 900,
  enemyMinIntervalMs: 240,
  enemyRampPerSec: 7,
  gateIntervalMs: 4000,
  // Scale enemies with the player's power so they stay a threat and their
  // sword reward keeps growing at high levels (balance). HP scales gently so
  // the ring still shreds them before they reach the hero.
  enemyHpPerPower: 0.01,
  enemyRewardPerPower: 0.02,
} as const
