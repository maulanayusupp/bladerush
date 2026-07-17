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
  width: 4800,
  height: 4800,
  cameraLerp: 0.11, // how snappily the camera tracks the hero (0..1)
} as const

/**
 * Solid obstacles scattered across the world (rocks / pillars / crystals /
 * stumps) that block the hero's movement, so the arena has cover to navigate.
 */
export const OBSTACLE = {
  count: 60,
  variants: 4,
  minFromCenter: 420, // keep the spawn area clear
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
export const DECOR_COUNT = 380
export const MAPS = [
  { key: 'map0', name: 'Verdant Meadow', props: ['treePine', 'rockGray', 'bushGreen'], obstacles: ['obs0', 'obs3', 'obsTree', 'obsMushroom'], hazard: 'none', ambient: { tint: 0xdff3b0, dir: 'drift' } },
  { key: 'map1', name: 'Sunscar Desert', props: ['cactus', 'rockSand', 'deadBush'], obstacles: ['obs0', 'obs1', 'obsCactus'], hazard: 'quicksand', ambient: { tint: 0xe8cf96, dir: 'side' } },
  { key: 'map2', name: 'Frostwind Tundra', props: ['treeSnow', 'rockIce', 'snowMound'], obstacles: ['obs0', 'obsIce', 'obs2'], hazard: 'ice', ambient: { tint: 0xffffff, dir: 'fall' } },
  { key: 'map3', name: 'Emberfall Caldera', props: ['deadTree', 'rockChar', 'lavaCrystal'], obstacles: ['obsLava', 'obs1', 'obs2'], hazard: 'lava', ambient: { tint: 0xff9a4a, dir: 'rise' } },
  { key: 'map4', name: 'The Void Expanse', props: ['crystalVoid', 'asteroid', 'starCluster'], obstacles: ['obs2', 'obs1', 'obsMonolith'], hazard: 'whirlpool', ambient: { tint: 0xc9b0ff, dir: 'drift' } },
  { key: 'map5', name: 'Sunken Marsh', props: ['mangrove', 'lilyRock', 'reed'], obstacles: ['obsMushroom', 'obsTree', 'obs3', 'obs0'], hazard: 'toxic', ambient: { tint: 0xaee0c0, dir: 'drift' } },
  { key: 'map6', name: 'Golden Savanna', props: ['acacia', 'rockSand', 'grassTuft'], obstacles: ['obsTree', 'obs0', 'obs1'], hazard: 'none', ambient: { tint: 0xf0d78a, dir: 'side' } },
  { key: 'map7', name: 'Celestial Ruins', props: ['brokenPillar', 'runeStone', 'crystalVoid'], obstacles: ['obsMonolith', 'obs1', 'obs2'], hazard: 'none', ambient: { tint: 0xc9b0ff, dir: 'rise' } },
  { key: 'map8', name: 'Sakura Garden', props: ['sakuraTree', 'stoneLantern', 'bushGreen'], obstacles: ['obsTorii', 'obs0', 'obsTree'], hazard: 'none', ambient: { tint: 0xffc0d8, dir: 'fall' } },
  { key: 'map9', name: 'Crystal Cavern', props: ['crystalCyan', 'stalagmite', 'rockGray'], obstacles: ['obs2', 'obsStalagmite', 'obs0'], hazard: 'none', ambient: { tint: 0x8fe6ff, dir: 'drift' } },
  { key: 'map10', name: 'Necropolis', props: ['tombstone', 'cross', 'deadTree'], obstacles: ['obsCrypt', 'obs1', 'obsMonolith'], hazard: 'toxic', ambient: { tint: 0xbfe0cf, dir: 'drift' } },
  { key: 'map11', name: 'Abyssal Depths', props: ['coral', 'kelp', 'lilyRock'], obstacles: ['obsCoral', 'obs1', 'obs0'], hazard: 'whirlpool', ambient: { tint: 0x9fe0ff, dir: 'rise' } },
] as const

/**
 * Environmental hazards scattered across a map's floor (non-solid). Each map
 * declares one `hazard` type (or 'none'). Effects apply while the hero stands in
 * a hazard zone: lava/toxic drain HP, quicksand/toxic slow, ice speeds you up
 * (slippery), whirlpool drags you toward its center.
 */
export const HAZARD = {
  count: 12,
  minRadius: 66,
  maxRadius: 120,
  minFromCenter: 380, // keep the spawn area clear
  lavaDpsFrac: 0.06, // maxHp fraction drained per second on lava
  toxicDpsFrac: 0.035, // …on toxic (also slows)
  slowMul: 0.55, // quicksand / toxic move speed
  slipMul: 1.4, // ice: slippery = faster, harder to stop
  pullPerSec: 150, // whirlpool pull toward center (px/s)
  colors: {
    lava: 0xff5a1a,
    quicksand: 0xc9a86a,
    ice: 0x9fd8ff,
    whirlpool: 0x9d5cff,
    toxic: 0x6aff2a,
  } as Record<string, number>,
  glow: ['lava', 'toxic', 'whirlpool'], // these render with additive blend
} as const

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
  // Distinctive shapes + baked effects (glow / energy / runes / saw / barbs).
  'energy', 'holy', 'chakram', 'sawblade', 'demon', 'runic', 'warscythe',
] as const

/**
 * The hero's look + size evolve with SCORE (monotonic — never flips backwards),
 * on a log curve that keeps advancing to the golden top tiers even at
 * astronomical survivor scores.
 */
export const HERO = {
  skins: 120, // 100 procedural + 20 bespoke "Divine" champions at the very top
  divineCount: 20,
  // Look/size evolve with SCORE (monotonic — never flips backwards). tier =
  // floor(tierPerLog10 * log10(1 + score)); ~1.85 reaches the golden top tier
  // around score 1e54 (survivor scores climb astronomically).
  tierPerLog10: 1.85,
  // The hero physically grows from scrawny "culun" to a towering champion.
  minScale: 0.6,
  maxScale: 1.85,
  // Evolution climbs ONE tier at a time on this cadence, so even a big score
  // jump plays as a deliberate step-by-step transformation montage (not a blur).
  evolveStepMs: 650,
} as const

/**
 * Hero rarity tiers by rank (index / skins). Purely a classification for the
 * Codex + evolve flourish — the actual look already escalates continuously.
 */
/**
 * Companion pet — a little ally that trails the hero, zaps nearby enemies, and
 * EVOLVES through many forms (pet0..pet{forms-1}) as the hero climbs tiers.
 */
export const PET = {
  forms: 16, // number of baked pet forms (evolution chain)
  followDist: 52, // trails this far behind the hero
  followLerp: 0.11,
  attackMs: 850, // fires this often
  range: 340, // only targets enemies within this
  damageMul: 2.4, // pet zap damage relative to base sword damage
  projMs: 170, // projectile travel time to target
} as const

export const HERO_RARITIES = [
  { id: 'common', min: 0, color: 0x9aa0ac },
  { id: 'rare', min: 0.35, color: 0x4aa3ff },
  { id: 'epic', min: 0.6, color: 0xb06bff },
  { id: 'legendary', min: 0.8, color: 0xffb020 },
  { id: 'mythic', min: 0.85, color: 0xff3b6b },
  { id: 'divine', min: 0.91, color: 0x00ffd0 }, // the 20 bespoke top champions (index 100-119)
] as const

/**
 * Rarity tier index (0..5) for a hero rank (0..1). The top `divineCount` heroes
 * are ALWAYS Divine (a count-based block, not a fraction), and the remaining
 * tiers are distributed across the non-divine range — so the classification
 * stays correct no matter how many Divine champions exist.
 */
export function heroRarity(rank: number): number {
  const last = HERO_RARITIES.length - 1 // divine
  const divineStart = (HERO.skins - HERO.divineCount) / (HERO.skins - 1)
  if (rank >= divineStart) return last
  const local = rank / divineStart // 0..1 within the non-divine (procedural) range
  const bands = [0, 0.4, 0.62, 0.8, 0.92] // common, rare, epic, legendary, mythic
  let idx = 0
  for (let i = 0; i < bands.length; i++) if (local >= (bands[i] as number)) idx = i
  return idx
}

/** Coin cost to unlock a hero directly (by rarity). */
export const HERO_UNLOCK_COST = [200, 500, 1200, 3000, 7000, 15000] as const
export function heroUnlockCost(index: number): number {
  return HERO_UNLOCK_COST[heroRarity(index / (HERO.skins - 1))] ?? 200
}

/** The 20 bespoke Divine champions' names (index 100..119). */
export const DIVINE_NAMES = [
  'Seraph of War', 'Void Sovereign', 'Inferno Lord', 'God-Emperor', 'Dragon Ascendant',
  'Death Reaper', 'Storm Titan', 'Frost Monarch', 'Blood Warlord', 'Cosmic Overlord',
  'Verdant Titan', 'Tide Emperor', 'Solar Deity', 'Lunar Sovereign', 'Chrono Sovereign',
  'Stone Titan', 'Tempest Sovereign', 'Plague Lord', 'Abyssal Tyrant', 'Prism Archon',
]
const HERO_PREFIX = ['Iron', 'Bronze', 'Steel', 'Silver', 'Emerald', 'Sapphire', 'Amethyst', 'Crimson', 'Obsidian', 'Golden']
const HERO_TITLE = [
  'Footman', 'Squire', 'Knight', 'Warden', 'Sentinel', 'Champion', 'Vanguard', 'Templar',
  'Paladin', 'Warlord', 'Crusader', 'Myrmidon', 'Dragoon', 'Conqueror', 'Sovereign', 'Highlord',
]

/** A display name for a hero skin (bespoke for Divine, generated otherwise). */
export function heroName(index: number): string {
  const divStart = HERO.skins - HERO.divineCount
  if (index >= divStart) return DIVINE_NAMES[index - divStart] ?? 'Divine Champion'
  const rank = index / (HERO.skins - 1)
  const prefix = HERO_PREFIX[Math.min(HERO_PREFIX.length - 1, Math.floor(rank * HERO_PREFIX.length))]
  const title = HERO_TITLE[index % HERO_TITLE.length]
  return `${prefix} ${title}`
}

const VILLAIN_ADJ = ['Grim', 'Savage', 'Vile', 'Cursed', 'Bloody', 'Dread', 'Wicked', 'Feral', 'Dark', 'Brutal']
const RIVAL_TITLE = ['Marauder', 'Reaver', 'Warlord', 'Berserker', 'Raider', 'Slayer', 'Butcher', 'Tyrant', 'Warbringer', 'Destroyer']
const TROOP_TIER = ['Feral', 'Savage', 'Vile', 'Cursed', 'Dread']
const TROOP_CREATURE = ['Orc', 'Undead', 'Cyclops', 'Beast', 'Imp', 'Mantis', 'Wraith']
const BOSS_HEAD_NAME = ['Demon', 'Dragon', 'Skull', 'Beast', 'Horror']
const BOSS_TITLE = ['Fiend', 'Lord', 'Overlord', 'Tyrant', 'Godfiend']

/** Name for a rival warlord (index 0..RIVAL.skins-1). */
export function rivalName(index: number): string {
  return `${VILLAIN_ADJ[index % VILLAIN_ADJ.length]} ${RIVAL_TITLE[(index * 3) % RIVAL_TITLE.length]}`
}

/** Name for an enemy troop (index 0..TROOP.count-1). */
export function troopName(index: number): string {
  const band = Math.min(TROOP_TIER.length - 1, Math.floor(index / TROOP.perTier))
  return `${TROOP_TIER[band]} ${TROOP_CREATURE[index % TROOP_CREATURE.length]}`
}

/** Name for a boss (index 0..BOSS.skins-1). */
export function bossName(index: number): string {
  const rank = index / (BOSS.skins - 1)
  const title = BOSS_TITLE[Math.min(BOSS_TITLE.length - 1, Math.floor(rank * BOSS_TITLE.length))]
  return `${title} ${BOSS_HEAD_NAME[index % BOSS_HEAD_NAME.length]}`
}

/** Name for a weapon skin — the shape, title-cased. */
export function weaponName(index: number): string {
  const s = SWORD_SHAPES[index] ?? 'blade'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Each blade shape carries a signature on-hit EFFECT, so the weapon you roll
 * each run plays differently. Thematic where it fits; otherwise cycled so every
 * shape has one. Effects: burn / frost / venom / crit / lifesteal / cleave /
 * chain / pierce / holy / execute.
 */
const WEAPON_EFFECT_CYCLE = ['crit', 'burn', 'frost', 'venom', 'lifesteal', 'cleave', 'chain', 'pierce']
const WEAPON_EFFECT_OVERRIDE: Record<string, string> = {
  flamberge: 'burn', energy: 'chain', crystal: 'frost', bone: 'venom', dagger: 'venom',
  scythe: 'lifesteal', warscythe: 'lifesteal', runic: 'chain', holy: 'holy', demon: 'execute',
  trident: 'pierce', fork: 'pierce', sawblade: 'cleave', chakram: 'cleave', greatsword: 'cleave',
  claymore: 'cleave', katana: 'crit', nodachi: 'crit', rapier: 'crit', estoc: 'frost',
}

export function weaponEffect(index: number): string {
  const s = SWORD_SHAPES[index] ?? ''
  return WEAPON_EFFECT_OVERRIDE[s] ?? (WEAPON_EFFECT_CYCLE[index % WEAPON_EFFECT_CYCLE.length] as string)
}

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
  affixes: ['swift', 'brute', 'shielded', 'volatile', 'caster', 'splitter'] as const,
  swift: { hp: 0.8, speed: 1.7, scale: 0.85, reward: 1.6, dmgTaken: 1, tint: 0xffe14d },
  brute: { hp: 3.6, speed: 0.72, scale: 1.35, reward: 3, dmgTaken: 1, tint: 0xff5a5a },
  shielded: { hp: 1.8, speed: 0.9, scale: 1.12, reward: 2, dmgTaken: 0.5, tint: 0x5ad0ff },
  volatile: { hp: 1.1, speed: 1.15, scale: 1.05, reward: 2.2, dmgTaken: 1, tint: 0xff8a3a },
  caster: { hp: 1.4, speed: 0.7, scale: 1.05, reward: 2.2, dmgTaken: 1, tint: 0xff8adf }, // ranged shooter
  splitter: { hp: 1.6, speed: 0.95, scale: 1.24, reward: 2.4, dmgTaken: 1, tint: 0x8aff8a }, // splits on death
  volatileRadius: 95,
  // Caster (ranged) tuning
  casterShotMs: 2200,
  casterRange: 540,
  casterDamage: 12,
  casterShotSpeed: 240,
  casterShotPool: 40,
  // Splitter tuning
  splitCount: 2,
  splitScale: 0.62,
  splitHpFrac: 0.35,
  splitMinScale: 0.5, // don't split if already this small (no infinite shards)
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

/**
 * Each Divine champion (hero index 100..119) wields a UNIQUE ultimate, shown as
 * a 4th skill button while that hero is active. Ordered to match the 20 Divine
 * heroes (DIVINE_NAMES) one-to-one.
 */
export const DIVINE_SKILLS = [
  { id: 'seraph', icon: '👼', cooldownMs: 18000 }, // Divine Judgment: heal + holy nova + shield
  { id: 'void', icon: '🕳️', cooldownMs: 18000 }, // Black Hole: pull all foes in + implode
  { id: 'inferno', icon: '☄️', cooldownMs: 18000 }, // Meteor Storm
  { id: 'emperor', icon: '👑', cooldownMs: 20000 }, // Cataclysm: screen-wide gold shockwave
  { id: 'dragon', icon: '🐉', cooldownMs: 18000 }, // Dragon Breath: ignite everything
  { id: 'reaper', icon: '💀', cooldownMs: 18000 }, // Soul Harvest: reap + heal
  { id: 'storm', icon: '⚡', cooldownMs: 16000 }, // Thunderstorm: chain lightning
  { id: 'frost', icon: '❄️', cooldownMs: 18000 }, // Absolute Zero: freeze + shatter
  { id: 'blood', icon: '🩸', cooldownMs: 18000 }, // Bloodbath: massive damage + lifesteal
  { id: 'cosmic', icon: '🌌', cooldownMs: 22000 }, // Big Bang: ultimate screen nuke
  { id: 'nature', icon: '🌿', cooldownMs: 18000 }, // Wild Overgrowth: root all + heal
  { id: 'tide', icon: '🌊', cooldownMs: 18000 }, // Maelstrom: pull in + drown
  { id: 'solar', icon: '☀️', cooldownMs: 18000 }, // Supernova Flare: blinding burn burst
  { id: 'lunar', icon: '🌙', cooldownMs: 18000 }, // Eclipse: twin dark pulses + weaken
  { id: 'chrono', icon: '⏳', cooldownMs: 20000 }, // Time Stop: freeze in place + ticks
  { id: 'quake', icon: '🌋', cooldownMs: 18000 }, // Earthquake: expanding stone rings
  { id: 'tempest', icon: '🌪️', cooldownMs: 16000 }, // Tornado: roaming pulling cyclones
  { id: 'plague', icon: '☣️', cooldownMs: 18000 }, // Pandemic: toxic cloud + venom DoT
  { id: 'chaos', icon: '👁️', cooldownMs: 20000 }, // Rift of Chaos: random reality tears
  { id: 'prism', icon: '🔷', cooldownMs: 22000 }, // Prismatic Beam: staggered rainbow pulses
] as const

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

  baseOrbitSpeed: 1.7, // rad/s with a single sword
  orbitSpeedPerSword: 0.025, // gentle acceleration as the ring grows
  maxOrbitSpeed: 3, // rad/s cap — a touch livelier but still readable
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
 * Boss mechanics & phases. Each boss has an ARCHETYPE (by skin) with a signature
 * move, and enters a second phase below `phase2Frac` HP (faster + amplified).
 * Archetypes: 0 summoner, 1 teleporter, 2 charger, 3 bomber, 4 shielder.
 */
export const BOSS_MECH = {
  archetypes: 5,
  phase2Frac: 0.5, // enter phase 2 below this HP fraction
  mechIntervalMs: 5200, // base cadence of the signature move
  phase2RateMul: 0.6, // move + attack cadence × this in phase 2 (faster)
  teleportNearby: 260, // teleporter lands within this of the hero
  chargeMs: 620, // how long a charge lasts
  chargeTelegraphMs: 420, // wind-up before a charge
  chargeSpeedMul: 4.4, // boss speed × this while charging
  shieldMs: 2600, // shielder bubble duration
  shieldDamageMul: 0.22, // sword damage × this vs a shielded boss
  summonBurst: 6, // extra adds a summoner spits out
} as const

/**
 * Boss Rush — the endgame. Once the player reaches `triggerLevel`, the normal
 * horde/rival spawns stop and bosses arrive in waves: one "lead" boss (full
 * attack kit) plus several "escort" bosses (chase + contact) so the screen is
 * genuinely crowded with bosses. Waves grow in count and toughness. The count
 * starts above 3 on purpose — 3 is a guaranteed win once you're this strong.
 */
export const BOSS_RUSH = {
  triggerLevel: 10, // enter Boss Rush at this character level
  firstWaveDelayMs: 1600, // beat before the first wave after entering
  waveGapMs: 3600, // breather after clearing a wave
  baseWaveSize: 5, // bosses in wave 1 (1 lead + 4 escorts)
  waveSizeGrow: 1, // +N bosses …
  growEvery: 2, // … every this many cleared waves
  maxWaveSize: 10, // hard cap on simultaneous bosses (= escort pool + 1)
  hpWaveGrow: 0.2, // +20% boss HP per wave cleared
  escortHpMul: 0.55, // escort HP relative to the lead boss
  escortScale: 1.2,
  escortSpeed: 66,
  escortContactDamage: 12,
} as const

/**
 * XP + leveling: kills grant XP; each level offers a choice of 3 upgrades.
 * Threshold grows geometrically so level-ups get progressively rarer instead
 * of popping every few kills.
 */
export const LEVEL = {
  baseXp: 30, // XP for the first level-up
  // Each level costs more, but gently (×1.55) so mid-game leveling never stalls.
  growth: 1.55,
  xpPerKill: 1,
  // XP per kill also scales with the kill's VALUE: xp = xpPerKill * (1 +
  // valueScale * log10(1 + reward)). Stronger/later enemies grant more XP, so
  // income keeps pace with the rising curve instead of flat-lining.
  valueScale: 1.1,
  xpPerBoss: 8,
} as const

/**
 * Relics — powerful PASSIVE run-modifiers dropped by chests (roguelike style).
 * Each is unique per run (granted once) and stacks with upgrades/meta, so every
 * run builds differently. Effect fields map directly to combat multipliers.
 */
export interface Relic {
  id: string
  icon: string
  dmg?: number // +fraction sword damage
  orbit?: number // +fraction ring spin
  swords?: number // +N blades
  lifesteal?: number // +HP per kill
  defense?: number // damage-taken multiplier (<1 = tougher)
  reward?: number // +fraction score/power per kill
  maxHp?: number // one-time +max HP on pickup
  burn?: boolean // blades always ignite
  frost?: boolean // blades always chill
}

export const RELICS: Relic[] = [
  { id: 'ironBlades', icon: '🗡️', dmg: 0.25 },
  { id: 'berserk', icon: '⚔️', dmg: 0.3 },
  { id: 'whirlwind', icon: '🌀', orbit: 0.2 },
  { id: 'arsenal', icon: '➕', swords: 3 },
  { id: 'vampire', icon: '🩸', lifesteal: 2 },
  { id: 'aegis', icon: '🛡️', defense: 0.85 },
  { id: 'midas', icon: '💰', reward: 0.35 },
  { id: 'titanHeart', icon: '❤️', maxHp: 80 },
  { id: 'emberHeart', icon: '🔥', burn: true },
  { id: 'frostCore', icon: '❄️', frost: true },
]

/** Chance a chest also grants a (random un-owned) relic. */
export const RELIC_CHEST_CHANCE = 0.45

/**
 * Prestige — spend your whole meta run (coins reset to 0, all shop upgrades back
 * to 0) for permanent Prestige Stars. Each star is +5% base damage AND +5% coins
 * forever. Stars never reset. Requires enough total investment first.
 */
export const PRESTIGE = {
  require: 15, // total meta-upgrade levels needed before you may prestige
  starsPer: 8, // one star per this many total levels spent (min 1 when eligible)
  perStar: 0.05, // +5% damage & +5% coins per star
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
 * Upgrade EVOLUTION: the elemental upgrades (burn/frost/venom) evolve once
 * they reach `UPGRADE_EVOLVE_AT`. Each evolved element auto-casts its own
 * visible FX skill on an interval (meteor storm / blizzard / plague cloud).
 */
export const UPGRADE_EVOLVE_AT = 5
export const EVOLUTIONS: Record<string, { icon: string; intervalMs: number }> = {
  burn: { icon: '☄️', intervalMs: 4500 }, // → Inferno (meteor storm)
  frost: { icon: '🌨️', intervalMs: 5200 }, // → Absolute Chill (blizzard)
  venom: { icon: '☣️', intervalMs: 5600 }, // → Plague (toxic cloud)
}

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

/**
 * Session quests — each run activates `SESSION_QUEST_COUNT` random objectives
 * (one per distinct metric) from this pool. Completing one grants coins mid-run.
 * Metrics: kills, bosses, combo, absorb, survive(s), power, level, relics,
 * evolve, gates, ultimate, chest.
 */
export interface Quest {
  id: string
  icon: string
  metric: string
  target: number
  coins: number
}

export const SESSION_QUEST_COUNT = 4

export const QUESTS: Quest[] = [
  { id: 'kills1', icon: '💀', metric: 'kills', target: 50, coins: 30 },
  { id: 'kills2', icon: '💀', metric: 'kills', target: 250, coins: 80 },
  { id: 'kills3', icon: '💀', metric: 'kills', target: 1000, coins: 200 },
  { id: 'kills4', icon: '💀', metric: 'kills', target: 5000, coins: 600 },
  { id: 'kills5', icon: '💀', metric: 'kills', target: 20000, coins: 1500 },
  { id: 'boss1', icon: '👹', metric: 'bosses', target: 1, coins: 50 },
  { id: 'boss2', icon: '👹', metric: 'bosses', target: 3, coins: 150 },
  { id: 'boss3', icon: '👹', metric: 'bosses', target: 6, coins: 300 },
  { id: 'boss4', icon: '👹', metric: 'bosses', target: 12, coins: 700 },
  { id: 'boss5', icon: '👹', metric: 'bosses', target: 25, coins: 1600 },
  { id: 'combo1', icon: '🔥', metric: 'combo', target: 25, coins: 40 },
  { id: 'combo2', icon: '🔥', metric: 'combo', target: 75, coins: 110 },
  { id: 'combo3', icon: '🔥', metric: 'combo', target: 200, coins: 300 },
  { id: 'combo4', icon: '🔥', metric: 'combo', target: 500, coins: 800 },
  { id: 'absorb1', icon: '🤝', metric: 'absorb', target: 1, coins: 40 },
  { id: 'absorb2', icon: '🤝', metric: 'absorb', target: 3, coins: 120 },
  { id: 'absorb3', icon: '🤝', metric: 'absorb', target: 8, coins: 350 },
  { id: 'absorb4', icon: '🤝', metric: 'absorb', target: 15, coins: 800 },
  { id: 'survive1', icon: '⏱️', metric: 'survive', target: 60, coins: 40 },
  { id: 'survive2', icon: '⏱️', metric: 'survive', target: 180, coins: 120 },
  { id: 'survive3', icon: '⏱️', metric: 'survive', target: 300, coins: 250 },
  { id: 'survive4', icon: '⏱️', metric: 'survive', target: 600, coins: 600 },
  { id: 'power1', icon: '⚡', metric: 'power', target: 1000, coins: 60 },
  { id: 'power2', icon: '⚡', metric: 'power', target: 100000, coins: 150 },
  { id: 'power3', icon: '⚡', metric: 'power', target: 10000000, coins: 400 },
  { id: 'power4', icon: '⚡', metric: 'power', target: 1000000000, coins: 1000 },
  { id: 'level1', icon: '⭐', metric: 'level', target: 5, coins: 50 },
  { id: 'level2', icon: '⭐', metric: 'level', target: 10, coins: 150 },
  { id: 'level3', icon: '⭐', metric: 'level', target: 15, coins: 400 },
  { id: 'relic1', icon: '🔮', metric: 'relics', target: 1, coins: 50 },
  { id: 'relic2', icon: '🔮', metric: 'relics', target: 3, coins: 180 },
  { id: 'relic3', icon: '🔮', metric: 'relics', target: 6, coins: 500 },
  { id: 'evolve1', icon: '✨', metric: 'evolve', target: 1, coins: 120 },
  { id: 'evolve2', icon: '✨', metric: 'evolve', target: 2, coins: 300 },
  { id: 'evolve3', icon: '✨', metric: 'evolve', target: 3, coins: 700 },
  { id: 'gates1', icon: '🚪', metric: 'gates', target: 20, coins: 40 },
  { id: 'gates2', icon: '🚪', metric: 'gates', target: 60, coins: 120 },
  { id: 'gates3', icon: '🚪', metric: 'gates', target: 150, coins: 300 },
  { id: 'ult1', icon: '🌟', metric: 'ultimate', target: 3, coins: 80 },
  { id: 'ult2', icon: '🌟', metric: 'ultimate', target: 10, coins: 250 },
  { id: 'chest1', icon: '🎁', metric: 'chest', target: 3, coins: 60 },
  { id: 'chest2', icon: '🎁', metric: 'chest', target: 10, coins: 200 },
]

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
