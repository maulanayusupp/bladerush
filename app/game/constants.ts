// =============================================================================
// Gameplay tuning constants. Centralized so balance can be tweaked without
// touching logic. The arena now fills the viewport (Scale.RESIZE), so world
// width/height are read live from the Scale Manager; ARENA is only the initial
// fallback size before the canvas is measured.
// =============================================================================

export const ARENA = {
  width: 720,
  height: 1280,
} as const

/**
 * Arena themes: a SUBTLE tiling ground (fine grain only, so no obvious loop)
 * plus scattered decoration props (trees/rocks/etc.) placed at random world
 * positions for a natural, non-repeating look. One theme per run.
 */
export const MAP_TILE = 256
export const DECOR_COUNT = 34
export const MAPS = [
  { key: 'map0', name: 'Verdant Meadow', props: ['treePine', 'rockGray', 'bushGreen'] },
  { key: 'map1', name: 'Sunscar Desert', props: ['cactus', 'rockSand', 'deadBush'] },
  { key: 'map2', name: 'Frostwind Tundra', props: ['treeSnow', 'rockIce', 'snowMound'] },
  { key: 'map3', name: 'Emberfall Caldera', props: ['deadTree', 'rockChar', 'lavaCrystal'] },
  { key: 'map4', name: 'The Void Expanse', props: ['crystalVoid', 'asteroid', 'starCluster'] },
] as const

export const PLAYER = {
  size: 44, // texture footprint in px
  speed: 360, // px/s, free 2D movement toward the pointer
  maxHp: 100,
  invulnMs: 750, // brief immunity after taking contact damage
  colorHex: 0x7c4dff,
} as const

/** The hero visually evolves every 1000 power through 20 champion looks. */
export const HERO = {
  skins: 20,
  powerPerSkin: 1000,
} as const

export const SWORD = {
  orbitRadius: 84, // distance of the ring from the hero
  poolSize: 60, // must equal POWER_CURVE.maxSwordCount
  hitCooldownMs: 150, // per-enemy cooldown so a sweep doesn't drain HP each frame
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
  nova: { id: 'nova', cooldownMs: 15000, durationMs: 0, damage: 140 },
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

  baseOrbitSpeed: 2.2, // rad/s with a single sword
  orbitSpeedPerSword: 0.12, // spin accelerates as the ring grows
  maxOrbitSpeed: 8, // rad/s cap
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
  skins: 20, // number of distinct warlord textures (rivalHero0..19)
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
  clashTicksTarget: 14, // ~ how many exchanges a duel takes (sets the step size)
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
  firstMs: 55000,
  intervalMs: 70000,
  speed: 40,
  contactDamage: 22,
  contactCooldownMs: 700,
  hitTickMs: 100,
  // HP is derived from the player's current damage output so the fight always
  // lasts about this long — and grows tankier over the run.
  targetSeconds: 8,
  secondsPerMin: 2,
  minHp: 1500,
  // Sword ticks help sub-linearly (a bigger ring melts it faster, but not 60×).
  swordCountFactor: 0.12,
  summonMs: 5000,
  summonCount: 4,
  scoreMul: 6,
  // While a boss is up, big multiplier gates (×N) appear so you can power up.
  gateIntervalMs: 2600,
  gateValues: [3, 3, 5, 5, 10] as const,
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
 * Meta-progression: coins earned per run buy permanent upgrades in the menu
 * shop (persisted). Costs grow geometrically. name/text via i18n `meta.<id>`.
 */
export const META = {
  startPower: { baseCost: 50, per: 10, max: 20, icon: '⚔️' },
  maxHp: { baseCost: 40, per: 20, max: 20, icon: '❤️' },
  damage: { baseCost: 60, per: 0.1, max: 20, icon: '🗡️' },
  coin: { baseCost: 80, per: 0.15, max: 15, icon: '💰' },
} as const
export const META_IDS = ['startPower', 'maxHp', 'damage', 'coin'] as const
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
