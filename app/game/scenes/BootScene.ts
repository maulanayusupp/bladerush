// =============================================================================
// BootScene — bakes all textures at runtime (no external image assets). Hero
// and enemies are drawn as multi-color, shaded vector creatures (horns, eyes
// with highlights, fangs, robe/hood) for a more detailed, articulated look.
// Swap these for real sprite sheets in the polish phase.
// =============================================================================
import Phaser from 'phaser'
import { AURA, MAP_TILE, SWORD_SHAPES, TROOP, gearOf } from '../constants'

type Draw = (g: Phaser.GameObjects.Graphics) => void

/** Quick 0..max random for scattered background decoration. */
function rnd(max: number): number {
  return Math.random() * max
}

/** Lighten (f>1) or darken (f<1) a 0xRRGGBB color. */
function shade(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f))
  const b = Math.min(255, Math.round((hex & 255) * f))
  return (r << 16) | (g << 8) | b
}

// --- Procedural unit generation --------------------------------------------
// Every one of the 300 sprites (100 heroes / rivals / troops) is derived from a
// single `rank` (0..1, i.e. how strong/advanced the unit is) plus a per-index
// hue. Rank drives color richness, body bulk, effects and which features unlock
// — so "low rank looks weak/cupu, high rank looks fierce/beringas" is one dial,
// and retuning the whole roster means editing the tables below, nothing else.

const HORN_STYLES = ['none', 'single', 'straight', 'wide', 'back', 'ram', 'antler', 'spikes', 'trident', 'crown']
const WEAPONS = ['dagger', 'sword', 'axe', 'mace', 'spear', 'club', 'halberd', 'scimitar']

/** Convert HSL (h 0..360, s/l 0..1) to a packed 0xRRGGBB color. */
function hsl(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g] = [c, x]
  else if (hp < 2) [r, g] = [x, c]
  else if (hp < 3) [g, b] = [c, x]
  else if (hp < 4) [g, b] = [x, c]
  else if (hp < 5) [r, b] = [x, c]
  else [r, b] = [c, x]
  const m = l - c / 2
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255)
}

interface UnitPalette {
  rank: number
  base: number // main body / armor color
  hi: number // highlight
  dark: number // shadow / outline-ish
  accent: number // trim, spikes, emblem
  eye: number
  glow: number // baked aura color, 0 = none
}

/**
 * A distinct, rank-scaled palette for unit `i` of a family. A golden-angle hue
 * makes every index its own color; saturation & lightness climb with rank
 * (dull/desaturated when weak → vivid when strong). A baked glow appears past
 * the mid-rank so stronger units literally radiate menace.
 */
function unitPalette(i: number, family: 'hero' | 'rival' | 'troop'): UnitPalette {
  const rank = i / 99
  const hue = (i * 137.508) % 360
  const accentHue = (hue + (family === 'rival' ? 28 : 46)) % 360
  const sat = 0.2 + 0.55 * rank
  const light = (family === 'rival' ? 0.22 : 0.26) + 0.12 * rank
  const accent = hsl(accentHue, 0.5 + 0.42 * rank, 0.46 + 0.2 * rank)
  return {
    rank,
    base: hsl(hue, sat, light),
    hi: hsl(hue, sat * 0.85, Math.min(0.74, light + 0.24)),
    dark: hsl(hue, Math.min(1, sat + 0.1), light * 0.45),
    accent,
    eye: family === 'rival' ? hsl(accentHue, 0.92, 0.58) : hsl((hue + 180) % 360, 0.85, 0.62),
    glow: rank > 0.5 ? accent : 0,
  }
}

/** Push feature `f` once rank crosses `at` (0..1). */
function unlock(features: string[], at: number, rank: number, f: string): void {
  if (rank >= at) features.push(f)
}

const CHAMPION_COUNT = 105 // 100 procedural + 5 bespoke Divine champions
const DIVINE_COUNT = 5

/**
 * 500 UNIQUE knight heroes. Uniqueness comes from combining several dimensions
 * that cycle at different (co-prime-ish) rates, so even adjacent indices differ:
 *  - armor hue: golden-angle (fine, continuous spread)
 *  - cape hue & eye hue: independent fast cycles
 *  - plate `pattern` (3) and `visor` style (2)
 *  - rank-gated regalia (cape/crest/pauldrons/horns/crown/wings/halo) + bulk + glow
 * Regalia + richness escalate with rank (higher index = grander), top tier gold.
 */
function genChampions(): ChampionSkin[] {
  const out: ChampionSkin[] = []
  const last = CHAMPION_COUNT - 1
  // Ordered PRESTIGE themes: armor material climbs from rustic iron to divine
  // gold as rank rises, so the roster reads as a clear power ramp (not random
  // rainbow). Within a theme, minor shade + eye-hue variation keeps them distinct.
  const THEMES = [
    { base: 0x4a4a52, trim: 0xb08d57, cape: 0x3a2a1a, glow: 0 }, // iron / bronze
    { base: 0x39465a, trim: 0xc7ccd8, cape: 0x232f3e, glow: 0 }, // steel / silver
    { base: 0x2f5a3a, trim: 0xffd24a, cape: 0x1c3a24, glow: 0x6bff9a }, // emerald + gold
    { base: 0x264a6e, trim: 0x5ad0ff, cape: 0x18304c, glow: 0x5ad0ff }, // sapphire
    { base: 0x472a5e, trim: 0xff8ad0, cape: 0x2b183a, glow: 0xd48aff }, // amethyst
    { base: 0x6a1e24, trim: 0xffd24a, cape: 0x3a0c12, glow: 0xff5a3a }, // crimson blood-knight
    { base: 0x1a1622, trim: 0xff3b3b, cape: 0x2a0810, glow: 0xff2d2d }, // obsidian / infernal
    { base: 0x2a2414, trim: 0xffd700, cape: 0x8a1020, glow: 0xffe14d }, // golden divine
  ]
  for (let i = 0; i < CHAMPION_COUNT; i++) {
    const rank = i / last
    const t = THEMES[Math.min(THEMES.length - 1, Math.floor(rank * THEMES.length))] as (typeof THEMES)[number]
    const shadeVar = 0.88 + (i % 4) * 0.06 // subtle per-index variation
    const base = shade(t.base, shadeVar)
    const accent = t.trim
    const cape = t.cape
    const glow = rank >= 0.85 ? t.glow : rank >= 0.5 ? t.glow : 0
    const features: string[] = []
    unlock(features, 0.12, rank, 'cape')
    unlock(features, 0.2, rank, 'crest')
    unlock(features, 0.3, rank, 'pauldrons')
    unlock(features, 0.45, rank, 'horns')
    unlock(features, 0.6, rank, 'crown')
    unlock(features, 0.75, rank, 'wings')
    unlock(features, 0.88, rank, 'halo')
    out.push({
      robe: base,
      robeHi: shade(base, 1.55),
      cape,
      hood: shade(base, 0.6), // helmet
      trim: accent,
      skin: 0x0c0a12,
      eye: hsl((i * 57) % 360, 0.85, 0.62),
      features,
      wing: shade(accent, 1.1),
      rank,
      glow,
      pattern: i % 3,
      visor: i % 2,
      // Helmet ORDERED by rank so armor clearly upgrades with power (no bare
      // heads): open barbute -> greathelm -> spiked -> horned-crown.
      helmType: rank < 0.25 ? 1 : rank < 0.55 ? 0 : rank < 0.8 ? 3 : 4,
      gear: gearOf(i),
      special: i >= CHAMPION_COUNT - DIVINE_COUNT ? i - (CHAMPION_COUNT - DIVINE_COUNT) : -1,
    })
  }
  return out
}

/** 100 rival warlords; menace (bulk, spikes, glow, horns) rises with rank. */
function genWarlords(): WarlordSkin[] {
  const out: WarlordSkin[] = []
  for (let i = 0; i < 100; i++) {
    const p = unitPalette(i, 'rival')
    // Bigger, nastier horns unlock as rank climbs (indexed into HORN_STYLES).
    const hornIdx = Math.min(HORN_STYLES.length - 1, 1 + Math.floor(p.rank * (HORN_STYLES.length - 1)))
    out.push({
      armor: p.base,
      armorHi: p.hi,
      cape: shade(p.accent, 0.5),
      helm: p.dark,
      horn: HORN_STYLES[i % 3 === 0 ? hornIdx : (hornIdx + i) % HORN_STYLES.length] as string,
      hornColor: i % 3 ? p.dark : p.accent,
      eye: p.eye,
      accent: p.accent,
      rank: p.rank,
      glow: p.glow,
    })
  }
  return out
}

/** 500 enemy troops across 5 tiers; fierceness (horns, tusks, spikes, glow, eyes)
 *  rises smoothly with the overall rank so higher tiers look far more savage. */
function genTroops(): TrooperSkin[] {
  const out: TrooperSkin[] = []
  const last = TROOP.count - 1
  for (let i = 0; i < TROOP.count; i++) {
    const band = Math.floor(i / TROOP.perTier) // 0..4 tier
    const rank = i / last // 0..1 continuous menace across the whole roster
    const p = unitPalette(i, 'troop')
    // Flesh darkens & sickens as it gets fiercer.
    const flesh = hsl(96 - rank * 60, 0.4 + 0.14 * rank, 0.5 - 0.24 * rank)
    out.push({
      skin: flesh,
      armor: p.base,
      armor2: p.hi,
      helm: rank >= 0.4 ? p.dark : 0,
      horns: rank >= 0.55,
      tuskBig: rank >= 0.4,
      eye: rank >= 0.8 ? 0xffd700 : rank >= 0.6 ? 0xff4d4d : hsl(90, 0.5, 0.25 + rank * 0.2),
      weapon: WEAPONS[i % WEAPONS.length] as string,
      rank,
      glow: rank >= 0.6 ? p.accent : 0,
      head: i % 7, // orc / skull / cyclops / beast / imp / insectoid / wraith
      body: Math.floor(i / 7) % 4, // standard / hulking / goblin / tall
      spikes: rank >= 0.7, // back/shoulder spikes for the savage top tiers
    })
  }
  return out
}

const BOSS_HORNS = ['ram', 'straight', 'back', 'antler', 'crown']

/**
 * 100 boss demons. Each has an ELEMENTAL theme (hue by index) and menace that
 * climbs with rank: darker/bigger hide, more & fiercer horns, extra eyes, jaw
 * plates, a searing glow. Highest indices are the most monstrous.
 */
function genBosses(): BossSkin[] {
  const out: BossSkin[] = []
  for (let i = 0; i < 100; i++) {
    const rank = i / 99
    const hue = (i * 137.508) % 360 // elemental color per boss
    const hide = hsl(hue, 0.35 + 0.2 * rank, 0.09 + 0.05 * rank) // near-black, tinted
    const accent = hsl(hue, 0.7 + 0.25 * rank, 0.5 + 0.12 * rank)
    out.push({
      rank,
      hide,
      hideHi: shade(hide, 1.9),
      snout: shade(hide, 0.7),
      horn: hsl(hue, 0.25, 0.12 + 0.06 * rank),
      eye: hsl(hue, 0.95, 0.58),
      accent,
      glow: rank > 0.35 ? accent : 0,
      hornStyle: BOSS_HORNS[i % BOSS_HORNS.length] as string,
      eyeCount: rank >= 0.8 ? 4 : rank >= 0.5 ? 3 : 2,
      crown: rank >= 0.4,
      plates: rank >= 0.6,
      crest: rank >= 0.25,
      head: i % 5, // demon / dragon / skull / beast / horror
    })
  }
  return out
}

interface WarlordSkin {
  armor: number
  armorHi: number
  cape: number
  helm: number
  horn: string
  hornColor: number
  eye: number
  accent: number
  rank: number
  glow: number
}

/** 10 distinct rival warlord looks (palette + horn style). */
const RIVAL_SKINS: WarlordSkin[] = genWarlords()

/** 10 distinct player sword silhouettes (tinted by tier in-game). */
interface TrooperSkin {
  skin: number
  armor: number
  armor2: number
  helm: number // 0 = none
  horns: boolean
  tuskBig: boolean
  eye: number
  weapon: string
  rank: number
  glow: number // 0 = none
  body: number // 0..3 silhouette archetype
  head: number // 0..6 head archetype
  spikes: boolean // savage back/shoulder spikes (high rank)
}

/** Humanoid enemy troops (orcs/soldiers) by tier — drawn front-facing. */
const TROOP_SKINS: TrooperSkin[] = genTroops()

interface ChampionSkin {
  robe: number
  robeHi: number
  cape: number
  hood: number
  trim: number
  skin: number
  eye: number
  features: string[]
  wing?: number
  rank: number
  glow: number // 0 = none
  pattern: number // 0..2 chestplate decoration
  visor: number // 0..1 helmet visor style
  helmType: number // 0..4 helmet archetype (ordered by rank)
  gear: number // 0 sword / 1 dual / 2 spear / 3 shield
  special: number // -1 = normal; 0..4 = bespoke Divine champion
}

/** 500 unique hero looks that escalate in grandeur (evolve every 1000 power). */
const CHAMPION_SKINS: ChampionSkin[] = genChampions()

interface BossSkin {
  rank: number
  hide: number // head base
  hideHi: number // highlight
  snout: number // jaw/snout shade
  horn: number
  eye: number
  accent: number // crown / plates
  glow: number // 0 = none
  hornStyle: string
  eyeCount: number // 2, 3 or 4
  crown: boolean
  plates: boolean
  crest: boolean
  head: number // 0..4 head archetype
}

/** 100 elemental boss demons; menace escalates with rank. */
const BOSS_SKINS: BossSkin[] = genBosses()

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    CHAMPION_SKINS.forEach((skin, i) => this.bake(`hero${i}`, 64, 64, (g) => this.drawChampion(g, skin)))
    RIVAL_SKINS.forEach((skin, i) => this.bake(`rivalHero${i}`, 56, 64, (g) => this.drawWarlord(g, skin)))
    TROOP_SKINS.forEach((skin, i) => this.bake(`troop${i}`, 60, 60, (g) => this.drawTrooper(g, 60, skin)))
    BOSS_SKINS.forEach((skin, i) => this.bake(`boss${i}`, 76, 76, (g) => this.drawBoss(g, skin)))
    this.bake('bossOrb', 24, 24, (g) => this.drawBossOrb(g))
    this.bake('meteor', 30, 44, (g) => this.drawMeteor(g))
    this.bake('meteorWarn', 64, 64, (g) => this.drawMeteorWarn(g))
    this.bake('heal', 30, 30, (g) => this.drawHeal(g))
    this.bake('chest', 32, 30, (g) => this.drawChest(g))
    this.bake('wMace', 28, 56, (g) => this.drawMace(g))
    this.bake('wAxe', 28, 56, (g) => this.drawAxe(g))
    this.bake('wSpear', 28, 56, (g) => this.drawSpear(g))
    this.bake('wScythe', 28, 56, (g) => this.drawScythe(g))
    this.bake('wHammer', 28, 56, (g) => this.drawHammer(g))
    this.bake('wTrident', 28, 56, (g) => this.drawTrident(g))
    this.bake('wGreatsword', 28, 56, (g) => this.drawGreatsword(g))
    this.bake('wHalberd', 28, 56, (g) => this.drawHalberd(g))
    this.bake('map0', MAP_TILE, MAP_TILE, (g) => this.drawMeadow(g))
    this.bake('map1', MAP_TILE, MAP_TILE, (g) => this.drawDesert(g))
    this.bake('map2', MAP_TILE, MAP_TILE, (g) => this.drawTundra(g))
    this.bake('map3', MAP_TILE, MAP_TILE, (g) => this.drawCaldera(g))
    this.bake('map4', MAP_TILE, MAP_TILE, (g) => this.drawVoid(g))
    this.makeVignette()
    this.drawProps()
    this.bake('sword', 16, 46, (g) => this.drawSword(g))
    SWORD_SHAPES.forEach((shape, i) => this.bake(`sword${i}`, 16, 46, (g) => this.drawSwordSkin(g, shape)))
    this.bake('swordRing', 140, 140, (g) => this.drawSwordRing(g))
    this.bake('aura', AURA.textureRadius * 2, AURA.textureRadius * 2, (g) => this.drawAura(g))
    this.bake('spark', 10, 10, (g) => this.drawSpark(g))
    this.bake('shock', 64, 64, (g) => this.drawShock(g))
    // Which scene to enter after baking (BattleScene by default; CodexScene for
    // the collection gallery). Both reuse these exact baked textures.
    const next = (this.game.registry.get('nextScene') as string) || 'BattleScene'
    this.scene.start(next)
  }

  /** A small white sparkle for clash/death particle bursts. */
  private drawSpark(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xffffff, 1)
    g.fillCircle(5, 5, 2)
    g.fillRect(4.5, 0, 1, 10)
    g.fillRect(0, 4.5, 10, 1)
  }

  /** A thin ring that expands + fades as a shockwave. */
  private drawShock(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(4, 0xffffff, 1)
    g.strokeCircle(32, 32, 26)
  }

  /** A baked ring of swords (rotated as one Image for rival heroes). */
  private drawSwordRing(g: Phaser.GameObjects.Graphics): void {
    const c = 70
    const ringRadius = 48
    const blades = 12
    for (let k = 0; k < blades; k++) {
      const a = (k / blades) * Math.PI * 2
      g.save()
      g.translateCanvas(c + Math.cos(a) * ringRadius, c + Math.sin(a) * ringRadius)
      g.rotateCanvas(a + Math.PI / 2 + 0.5)
      g.translateCanvas(-8, -23)
      this.drawSword(g)
      g.restore()
    }
  }

  /** Soft white glow (tinted per tier at runtime): stacked fading circles. */
  private drawAura(g: Phaser.GameObjects.Graphics): void {
    const r = AURA.textureRadius
    for (let i = 0; i <= 28; i++) {
      g.fillStyle(0xffffff, 0.045)
      g.fillCircle(r, r, r * (1 - i / 28))
    }
  }

  /** Render a draw callback into a named texture of the given size. */
  private bake(key: string, w: number, h: number, draw: Draw): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    draw(g)
    g.generateTexture(key, w, h)
    g.destroy()
  }

  /** Two symmetric eyes with dark pupils and a white highlight. */
  private drawEyes(
    g: Phaser.GameObjects.Graphics,
    lx: number,
    rx: number,
    y: number,
    ew: number,
    eh: number,
    pupil: number,
  ): void {
    g.fillStyle(0xffffff, 1)
    g.fillEllipse(lx, y, ew, eh)
    g.fillEllipse(rx, y, ew, eh)
    g.fillStyle(pupil, 1)
    g.fillCircle(lx + 1, y + 1, ew * 0.28)
    g.fillCircle(rx + 1, y + 1, ew * 0.28)
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(lx, y - 1, ew * 0.12)
    g.fillCircle(rx, y - 1, ew * 0.12)
  }

  // ---- Enemies ------------------------------------------------------------

  private drawDemon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a1414, 1) // horns
    g.fillTriangle(16, 18, 9, 2, 21, 16)
    g.fillTriangle(40, 18, 47, 2, 35, 16)
    g.fillStyle(0x9e2626, 1) // arms
    g.fillEllipse(9, 34, 13, 18)
    g.fillEllipse(47, 34, 13, 18)
    g.fillStyle(0xd23b3b, 1) // body
    g.fillEllipse(28, 32, 44, 42)
    g.fillStyle(0xf07a7a, 0.9) // belly highlight
    g.fillEllipse(28, 36, 26, 24)
    this.drawEyes(g, 20, 36, 28, 11, 13, 0x1a0a0a)
    g.fillStyle(0x5a1010, 1) // mouth
    g.fillRoundedRect(18, 41, 20, 8, 3)
    g.fillStyle(0xffffff, 1) // fangs
    g.fillTriangle(20, 41, 24, 41, 22, 47)
    g.fillTriangle(32, 41, 36, 41, 34, 47)
  }

  private drawBeast(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2f6b2f, 1) // back spikes
    g.fillTriangle(14, 22, 20, 6, 26, 22)
    g.fillTriangle(24, 20, 30, 4, 36, 20)
    g.fillTriangle(34, 22, 40, 6, 44, 22)
    g.fillStyle(0x3e8f3e, 1) // limbs
    g.fillEllipse(9, 38, 12, 16)
    g.fillEllipse(47, 38, 12, 16)
    g.fillStyle(0x5bbf5b, 1) // body
    g.fillEllipse(28, 34, 46, 38)
    g.fillStyle(0x9ee89e, 0.9) // belly
    g.fillEllipse(28, 38, 26, 22)
    this.drawEyes(g, 20, 36, 30, 12, 13, 0x14200f)
    g.fillStyle(0x2f6b2f, 1) // angry brows
    g.fillTriangle(14, 24, 27, 31, 27, 24)
    g.fillTriangle(42, 24, 29, 31, 29, 24)
    g.fillStyle(0x14200f, 1) // mouth
    g.fillRoundedRect(19, 44, 18, 7, 2)
    g.fillStyle(0xffffff, 1) // teeth
    g.fillRect(21, 44, 3, 4)
    g.fillRect(27, 44, 3, 4)
    g.fillRect(33, 44, 3, 4)
  }

  private drawBrute(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xc7ccd8, 1) // shoulder armor plates
    g.fillEllipse(10, 30, 16, 14)
    g.fillEllipse(46, 30, 16, 14)
    g.fillStyle(0x9198a6, 1) // body
    g.fillEllipse(28, 34, 44, 40)
    g.fillStyle(0x6f7787, 0.9) // belly shade
    g.fillEllipse(28, 38, 24, 22)
    g.fillStyle(0x5a606e, 1) // brows
    g.fillTriangle(15, 24, 27, 30, 27, 23)
    g.fillTriangle(41, 24, 29, 30, 29, 23)
    this.drawEyes(g, 21, 35, 28, 9, 10, 0x101319)
    g.fillStyle(0x2b2f38, 1) // mouth
    g.fillRoundedRect(22, 42, 12, 6, 2)
    g.fillStyle(0xf4f6f4, 1) // tusks (pointing up)
    g.fillTriangle(22, 44, 26, 44, 20, 34)
    g.fillTriangle(34, 44, 30, 44, 36, 34)
  }

  /** BOSS — a huge horned demon-dragon head (box 76, centered 38). */
  /** A front-facing humanoid troop (orc/soldier) scaled to box size S. */
  /**
   * A front-facing troop. `body` sets the silhouette (standard / hulking /
   * goblin / tall) and `head` the face archetype (orc / skull / cyclops / beast
   * / imp) — so troops differ in SHAPE, not just color.
   */
  private drawTrooper(g: Phaser.GameObjects.Graphics, S: number, p: TrooperSkin): void {
    g.scaleCanvas(S / 56, S / 56)
    if (p.glow) this.bakedGlow(g, 28, 32, p.glow, 26)

    // Body archetype: torso box + head anchor + limb rows.
    let tx = 15
    let ty = 27
    let tw = 26
    let thh = 21
    let hy = 16
    let hr = 11
    let armY = 34
    let legY = 45
    let legH = 10
    const hx = 28
    switch (p.body) {
      case 1: // hulking
        tx = 8; ty = 26; tw = 40; thh = 24; hy = 15; hr = 9; armY = 35; legY = 50; legH = 6
        break
      case 2: // goblin (small body, big head)
        tx = 19; ty = 32; tw = 18; thh = 15; hy = 18; hr = 13; armY = 38; legY = 47; legH = 8
        break
      case 3: // tall / slim
        tx = 20; ty = 21; tw = 16; thh = 29; hy = 12; hr = 10; armY = 32; legY = 50; legH = 6
        break
      default:
        break
    }
    const shoulder = p.body === 1 ? 7 : 5

    // Legs + boots.
    const lw = p.body === 1 ? 7 : 5
    g.fillStyle(p.armor2, 1)
    g.fillRect(hx - 8, legY, lw, legH)
    g.fillRect(hx + 3, legY, lw, legH)
    g.fillStyle(0x2a2620, 1)
    g.fillRect(hx - 8, legY + legH - 3, lw, 3)
    g.fillRect(hx + 3, legY + legH - 3, lw, 3)
    // Weapon behind the arm.
    this.drawTrooperWeapon(g, p.weapon)
    // Torso.
    g.fillStyle(p.armor, 1)
    g.fillRoundedRect(tx, ty, tw, thh, 5)
    g.fillStyle(p.armor2, 1)
    g.fillRect(hx - 3, ty, 6, thh)
    g.fillCircle(tx + 1, ty + 2, shoulder)
    g.fillCircle(tx + tw - 1, ty + 2, shoulder)
    // Savage shoulder + back spikes for high-rank monsters.
    if (p.spikes) {
      g.fillStyle(shade(p.armor2, 1.2), 1)
      g.fillTriangle(tx - 1, ty + 3, tx + 3, ty - 9, tx + 7, ty + 3)
      g.fillTriangle(tx + tw + 1, ty + 3, tx + tw - 3, ty - 9, tx + tw - 7, ty + 3)
      for (const sx of [hx - 6, hx, hx + 6]) g.fillTriangle(sx - 2, ty + 4, sx, ty - 4, sx + 2, ty + 4)
    }
    // Arms / fists.
    g.fillStyle(p.skin, 1)
    g.fillCircle(tx - 2, armY, 3.5)
    g.fillCircle(tx + tw + 2, armY, 3.5)
    // Head archetype.
    this.drawTrooperHead(g, p, hx, hy, hr)
    // Helmet (not on bare skulls) + optional horns (bigger the fiercer it is).
    if (p.helm && p.head !== 1) {
      g.fillStyle(p.helm, 1)
      g.fillEllipse(hx, hy - hr + 1, hr * 2 + 4, 12)
      g.fillRect(hx - hr - 1, hy - hr, hr * 2 + 2, 3)
    }
    if (p.horns && p.head !== 4) {
      const hf = 1 + p.rank
      g.fillStyle(0xe8e2d0, 1)
      g.fillTriangle(hx - hr - 1, hy - hr + 3, hx - hr - 9 * hf, hy - hr - 7 * hf, hx - hr + 5, hy - hr + 1)
      g.fillTriangle(hx + hr + 1, hy - hr + 3, hx + hr + 9 * hf, hy - hr - 7 * hf, hx + hr - 5, hy - hr + 1)
    }
  }

  private drawTrooperHead(g: Phaser.GameObjects.Graphics, p: TrooperSkin, cx: number, cy: number, r: number): void {
    const dark = 0x141a10
    switch (p.head) {
      case 1: // skull / undead
        g.fillStyle(0xe6e0cf, 1)
        g.fillEllipse(cx, cy, r * 2, r * 1.9)
        g.fillStyle(0xcfc7b0, 1)
        g.fillEllipse(cx, cy + r * 0.55, r * 1.1, r * 0.8)
        g.fillStyle(0x120d08, 1)
        g.fillEllipse(cx - r * 0.45, cy - 1, r * 0.7, r * 0.8)
        g.fillEllipse(cx + r * 0.45, cy - 1, r * 0.7, r * 0.8)
        g.fillStyle(p.eye, 1)
        g.fillCircle(cx - r * 0.45, cy, 2)
        g.fillCircle(cx + r * 0.45, cy, 2)
        g.fillStyle(0x120d08, 1)
        g.fillTriangle(cx, cy + 1, cx - 2, cy + r * 0.5, cx + 2, cy + r * 0.5)
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 5; i++) g.fillRect(cx - r * 0.5 + i * r * 0.25, cy + r * 0.7, r * 0.16, 3)
        break
      case 2: // cyclops
        g.fillStyle(p.skin, 1)
        g.fillEllipse(cx, cy, r * 2, r * 1.9)
        g.fillTriangle(cx - r, cy, cx - r - 6, cy - 4, cx - r + 3, cy + 4)
        g.fillTriangle(cx + r, cy, cx + r + 6, cy - 4, cx + r - 3, cy + 4)
        g.fillStyle(0xffffff, 1)
        g.fillCircle(cx, cy - 1, r * 0.6)
        g.fillStyle(p.eye, 1)
        g.fillCircle(cx, cy - 1, r * 0.34)
        g.fillStyle(0x120400, 1)
        g.fillCircle(cx, cy - 1, r * 0.16)
        g.fillStyle(dark, 1)
        g.fillRect(cx - r * 0.5, cy + r * 0.7, r, 2)
        break
      case 3: // beast (snout)
        g.fillStyle(p.skin, 1)
        g.fillEllipse(cx, cy - 1, r * 1.9, r * 1.7)
        g.fillStyle(shade(p.skin, 0.85), 1)
        g.fillEllipse(cx, cy + r * 0.6, r * 1.3, r * 0.95)
        g.fillStyle(0x120400, 1)
        g.fillCircle(cx - 2, cy + r * 0.45, 1.4)
        g.fillCircle(cx + 2, cy + r * 0.45, 1.4)
        g.fillStyle(p.eye, 1)
        g.fillEllipse(cx - r * 0.5, cy - 2, 4, 3)
        g.fillEllipse(cx + r * 0.5, cy - 2, 4, 3)
        g.fillStyle(0xf4f0e0, 1)
        g.fillTriangle(cx - 3, cy + r * 0.9, cx - 1, cy + r * 0.9, cx - 2, cy + r * 0.45)
        g.fillTriangle(cx + 1, cy + r * 0.9, cx + 3, cy + r * 0.9, cx + 2, cy + r * 0.45)
        break
      case 4: // imp / demon
        g.fillStyle(0x1a0f14, 1)
        g.fillTriangle(cx - r + 1, cy - r + 2, cx - r - 6, cy - r - 9, cx - r + 6, cy - r + 2)
        g.fillTriangle(cx + r - 1, cy - r + 2, cx + r + 6, cy - r - 9, cx + r - 6, cy - r + 2)
        g.fillStyle(p.skin, 1)
        g.fillEllipse(cx, cy, r * 1.8, r * 1.7)
        g.fillTriangle(cx - r, cy, cx - r - 6, cy - 6, cx - r + 2, cy + 3)
        g.fillTriangle(cx + r, cy, cx + r + 6, cy - 6, cx + r - 2, cy + 3)
        g.fillStyle(p.eye, 1)
        g.fillEllipse(cx - r * 0.45, cy - 1, 5, 3)
        g.fillEllipse(cx + r * 0.45, cy - 1, 5, 3)
        g.fillStyle(dark, 1)
        g.fillTriangle(cx - r * 0.5, cy + r * 0.5, cx + r * 0.5, cy + r * 0.5, cx, cy + r * 0.95)
        g.fillStyle(0xffffff, 1)
        g.fillRect(cx - 2, cy + r * 0.5, 1.5, 2)
        g.fillRect(cx + 1, cy + r * 0.5, 1.5, 2)
        break
      case 5: // insectoid — compound eyes, mandibles, antennae
        g.fillStyle(dark, 1) // antennae
        g.fillRect(cx - r * 0.5, cy - r - 6, 1.4, 8)
        g.fillRect(cx + r * 0.5, cy - r - 6, 1.4, 8)
        g.fillStyle(p.eye, 1)
        g.fillCircle(cx - r * 0.5, cy - r - 6, 1.8)
        g.fillCircle(cx + r * 0.5, cy - r - 6, 1.8)
        g.fillStyle(p.skin, 1)
        g.fillEllipse(cx, cy, r * 1.9, r * 1.8)
        g.fillStyle(0x0c0f08, 1) // big compound eyes
        g.fillEllipse(cx - r * 0.5, cy - 1, r * 0.75, r * 0.9)
        g.fillEllipse(cx + r * 0.5, cy - 1, r * 0.75, r * 0.9)
        g.fillStyle(p.eye, 0.9)
        g.fillCircle(cx - r * 0.5, cy - 2, 1.6)
        g.fillCircle(cx + r * 0.5, cy - 2, 1.6)
        g.fillStyle(shade(p.skin, 0.7), 1) // mandibles
        g.fillTriangle(cx - 4, cy + r * 0.7, cx - 1, cy + r * 0.7, cx - 5, cy + r * 1.1)
        g.fillTriangle(cx + 4, cy + r * 0.7, cx + 1, cy + r * 0.7, cx + 5, cy + r * 1.1)
        break
      case 6: // hooded wraith — dark cowl, glowing eyes only
        g.fillStyle(shade(p.armor, 0.6), 1)
        g.fillPoints(this.pts([cx - r - 2, cy + r, cx - r + 1, cy - r, cx, cy - r - 4, cx + r - 1, cy - r, cx + r + 2, cy + r]), true)
        g.fillStyle(0x08060a, 1) // shadowed void inside the hood
        g.fillEllipse(cx, cy + 1, r * 1.2, r * 1.5)
        g.fillStyle(p.eye, 1)
        g.fillEllipse(cx - r * 0.4, cy, 4, 3)
        g.fillEllipse(cx + r * 0.4, cy, 4, 3)
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(cx - r * 0.4, cy - 0.5, 1)
        g.fillCircle(cx + r * 0.4, cy - 0.5, 1)
        break
      default: // orc
        g.fillStyle(p.skin, 1)
        g.fillEllipse(cx, cy, r * 2, r * 1.8)
        g.fillTriangle(cx - r, cy, cx - r - 8, cy - 3, cx - r + 2, cy + 4)
        g.fillTriangle(cx + r, cy, cx + r + 8, cy - 3, cx + r - 2, cy + 4)
        g.fillStyle(0x203818, 1)
        g.fillTriangle(cx - r + 2, cy - 4, cx - 1, cy + 1, cx - 1, cy - 4)
        g.fillTriangle(cx + r - 2, cy - 4, cx + 1, cy + 1, cx + 1, cy - 4)
        g.fillStyle(p.eye, 1)
        g.fillEllipse(cx - r * 0.45, cy, 5, 4)
        g.fillEllipse(cx + r * 0.45, cy, 5, 4)
        g.fillStyle(0xf4f0e0, 1)
        {
          const th = p.tuskBig ? 6 : 4
          g.fillTriangle(cx - 3, cy + r * 0.7, cx, cy + r * 0.7, cx - 1.5, cy + r * 0.7 - th)
          g.fillTriangle(cx + 1, cy + r * 0.7, cx + 4, cy + r * 0.7, cx + 2.5, cy + r * 0.7 - th)
        }
    }
  }

  private drawTrooperWeapon(g: Phaser.GameObjects.Graphics, type: string): void {
    switch (type) {
      case 'dagger':
        g.fillStyle(0xcdd3e0, 1); g.fillRect(43, 24, 3, 10); g.fillTriangle(44.5, 20, 42, 24, 47, 24)
        g.fillStyle(0xffce5a, 1); g.fillRect(41, 34, 7, 2)
        break
      case 'sword':
        g.fillStyle(0xcdd3e0, 1); g.fillRect(43, 12, 3, 22); g.fillTriangle(44.5, 8, 41, 12, 48, 12)
        g.fillStyle(0xffce5a, 1); g.fillRect(40, 34, 8, 2)
        break
      case 'axe':
        g.fillStyle(0x5c3b22, 1); g.fillRect(43, 12, 3, 30)
        g.fillStyle(0x9198a6, 1); g.fillPoints(this.pts([46, 14, 54, 18, 54, 27, 46, 24]), true)
        break
      case 'mace':
        g.fillStyle(0x5c3b22, 1); g.fillRect(43, 20, 3, 22)
        g.fillStyle(0x9198a6, 1); g.fillCircle(44.5, 16, 6)
        g.fillStyle(0x6f7787, 1)
        for (const a of [0, 1.05, 2.1, 3.14, 4.19, 5.24]) g.fillCircle(44.5 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 1.6)
        break
      case 'spear':
        g.fillStyle(0x5c3b22, 1); g.fillRect(43, 10, 3, 34)
        g.fillStyle(0xcdd3e0, 1); g.fillTriangle(44.5, 2, 41, 12, 48, 12)
        break
      case 'club':
        g.fillStyle(0x5c3b22, 1); g.fillRect(43, 20, 3, 22)
        g.fillStyle(0x6b4a2a, 1); g.fillPoints(this.pts([40, 6, 49, 8, 48, 22, 41, 22]), true)
        g.fillStyle(0x3a2a1a, 1); g.fillCircle(43, 11, 1.2); g.fillCircle(46, 16, 1.2)
        break
      case 'halberd':
        g.fillStyle(0x5c3b22, 1); g.fillRect(43, 6, 3, 40)
        g.fillStyle(0x9198a6, 1); g.fillPoints(this.pts([46, 8, 54, 11, 53, 20, 46, 18]), true) // axe head
        g.fillStyle(0xcdd3e0, 1); g.fillTriangle(44.5, 0, 42, 8, 47, 8) // top spike
        break
      case 'scimitar':
        g.fillStyle(0xcdd3e0, 1); g.fillPoints(this.pts([44, 8, 52, 18, 49, 30, 44, 34, 42, 20]), true)
        g.fillStyle(0xffce5a, 1); g.fillRect(40, 33, 8, 2)
        break
    }
  }

  private drawBossHorns(g: Phaser.GameObjects.Graphics, style: string, color: number, sc: number): void {
    g.fillStyle(color, 1)
    const L = 20
    const R = 56
    const y = 24
    switch (style) {
      case 'straight':
        g.fillTriangle(L, y, L - 4, y - 22 * sc, L + 6, y - 4)
        g.fillTriangle(R, y, R + 4, y - 22 * sc, R - 6, y - 4)
        break
      case 'back':
        g.fillTriangle(L, y, L - 18 * sc, y - 12 * sc, L + 4, y - 4)
        g.fillTriangle(R, y, R + 18 * sc, y - 12 * sc, R - 4, y - 4)
        break
      case 'antler':
        g.fillTriangle(L, y, L - 6, y - 20 * sc, L + 4, y - 4)
        g.fillTriangle(L - 4, y - 12 * sc, L - 15 * sc, y - 16 * sc, L - 1, y - 9 * sc)
        g.fillTriangle(R, y, R + 6, y - 20 * sc, R - 4, y - 4)
        g.fillTriangle(R + 4, y - 12 * sc, R + 15 * sc, y - 16 * sc, R + 1, y - 9 * sc)
        break
      case 'crown':
        for (const x of [16, 24, 32, 44, 52, 60]) g.fillTriangle(x - 3, y - 2, x, y - 16 * sc, x + 3, y - 2)
        break
      default: // 'ram' — curling
        g.fillPoints(this.pts([L, y, L - 15 * sc, y - 4, L - 11 * sc, y - 18 * sc, L, y - 8]), true)
        g.fillPoints(this.pts([R, y, R + 15 * sc, y - 4, R + 11 * sc, y - 18 * sc, R, y - 8]), true)
    }
  }

  /**
   * A boss demon head. `rank` drives menace: bigger horns, extra eyes, cheek
   * plates, a forehead crest, more fangs and a searing elemental glow.
   */
  private drawBoss(g: Phaser.GameObjects.Graphics, s: BossSkin): void {
    const dark = 0x0c0506
    const sc = 1 + s.rank

    if (s.glow) this.bakedGlow(g, 38, 40, s.glow, 36)
    this.drawBossHorns(g, s.hornStyle, s.horn, sc)
    if (s.crown) {
      g.fillStyle(s.accent, 1) // crown spikes
      for (const x of [24, 32, 38, 44, 52]) g.fillTriangle(x - 4, 18, x, 4 - s.rank * 2, x + 4, 18)
    }
    // Head SHAPE by archetype.
    this.drawBossHead(g, s, dark)
    if (s.plates) {
      g.fillStyle(s.accent, 1) // armored cheek plates
      g.fillPoints(this.pts([12, 40, 20, 34, 22, 48, 14, 52]), true)
      g.fillPoints(this.pts([64, 40, 56, 34, 54, 48, 62, 52]), true)
    }
    if (s.crest) {
      g.fillStyle(s.horn, 1) // forehead crest ridge
      for (const cy of [20, 26, 32]) g.fillTriangle(35, cy + 4, 38, cy - 3, 41, cy + 4)
    }
  }

  /** A glowing boss eye with pupil + specular. */
  private bossEye(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number): void {
    g.fillStyle(color, 1)
    g.fillEllipse(x, y, w, h)
    g.fillStyle(0x140300, 1)
    g.fillCircle(x, y + 1, Math.min(w, h) * 0.3)
    g.fillStyle(0xffe0b0, 0.9)
    g.fillCircle(x - 1, y - 1, 1.3)
  }

  /** Boss head silhouette by archetype: demon / dragon / skull / beast / horror. */
  private drawBossHead(g: Phaser.GameObjects.Graphics, s: BossSkin, dark: number): void {
    const es = 1 + s.rank * 0.15
    const fang = (x: number, up: boolean, len: number): void => {
      if (up) g.fillTriangle(x, 64, x + 2.4, 64, x + 1.2, 64 - len)
      else g.fillTriangle(x, 60, x + 2.4, 60, x + 1.2, 60 + len)
    }
    switch (s.head) {
      case 1: { // dragon — long snout
        g.fillStyle(dark, 1)
        g.fillEllipse(38, 32, 52, 46)
        g.fillStyle(s.hide, 1)
        g.fillEllipse(38, 32, 48, 42)
        g.fillStyle(s.hideHi, 0.4)
        g.fillEllipse(38, 26, 36, 18)
        g.fillStyle(s.snout, 1) // tapered snout downward
        g.fillPoints(this.pts([25, 40, 51, 40, 46, 68, 30, 68]), true)
        this.bossEye(g, s.eye, 28, 30, 11 * es, 5)
        this.bossEye(g, s.eye, 48, 30, 11 * es, 5)
        g.fillStyle(dark, 1)
        g.fillCircle(34, 63, 2)
        g.fillCircle(42, 63, 2)
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 4; i++) {
          g.fillTriangle(30 + i * 4, 68, 32 + i * 4, 68, 31 + i * 4, 73)
        }
        break
      }
      case 2: { // skull
        g.fillStyle(0xe6e0cf, 1)
        g.fillEllipse(38, 36, 54, 50)
        g.fillStyle(0xcac2ab, 1)
        g.fillEllipse(38, 57, 34, 22)
        g.fillStyle(0x0c0806, 1)
        g.fillEllipse(28, 36, 16, 17)
        g.fillEllipse(48, 36, 16, 17)
        g.fillStyle(s.eye, 1)
        g.fillCircle(28, 37, 3.6)
        g.fillCircle(48, 37, 3.6)
        g.fillStyle(0xffe0b0, 0.9)
        g.fillCircle(27, 36, 1.3)
        g.fillCircle(47, 36, 1.3)
        g.fillStyle(0x0c0806, 1)
        g.fillTriangle(38, 42, 34, 52, 42, 52)
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 6; i++) g.fillRect(23 + i * 5, 60, 3, 9)
        break
      }
      case 3: { // beast — big gaping maw
        g.fillStyle(dark, 1)
        g.fillEllipse(38, 38, 60, 56)
        g.fillStyle(s.hide, 1)
        g.fillEllipse(38, 38, 56, 52)
        g.fillStyle(s.hideHi, 0.4)
        g.fillEllipse(38, 30, 44, 22)
        this.bossEye(g, s.eye, 26, 34, 11, 8)
        this.bossEye(g, s.eye, 50, 34, 11, 8)
        g.fillStyle(dark, 1)
        g.fillCircle(34, 46, 1.8)
        g.fillCircle(42, 46, 1.8)
        g.fillStyle(0x1a0808, 1) // maw
        g.fillEllipse(38, 56, 38, 20)
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 7; i++) {
          fang(22 + i * 5, false, 6 + s.rank * 3)
          g.fillTriangle(24 + i * 5, 64, 26 + i * 5, 64, 25 + i * 5, 58)
        }
        break
      }
      case 4: { // eldritch horror — cluster of eyes
        g.fillStyle(dark, 1)
        g.fillEllipse(38, 40, 62, 58)
        g.fillStyle(s.hide, 1)
        g.fillEllipse(38, 40, 58, 54)
        g.fillStyle(s.hideHi, 0.35)
        g.fillEllipse(38, 32, 44, 22)
        const cluster = [[26, 30], [38, 25], [50, 30], [30, 41], [46, 41], [38, 40], [32, 52], [44, 52]]
        for (const p of cluster) this.bossEye(g, s.eye, p[0] as number, p[1] as number, 7, 6)
        g.fillStyle(0x1a0808, 1) // maw
        g.fillEllipse(38, 60, 30, 14)
        g.fillStyle(0xffffff, 1)
        for (let i = 0; i < 6; i++) fang(25 + i * 5, false, 5)
        break
      }
      default: { // demon (classic)
        g.fillStyle(dark, 1)
        g.fillEllipse(38, 40, 60, 56)
        g.fillStyle(s.hide, 1)
        g.fillEllipse(38, 40, 56, 52)
        g.fillStyle(s.hideHi, 0.45)
        g.fillEllipse(38, 33, 44, 24)
        g.fillStyle(s.snout, 1)
        g.fillEllipse(38, 54, 34, 24)
        g.fillStyle(dark, 1)
        g.fillTriangle(16, 32, 36, 42, 36, 27)
        g.fillTriangle(60, 32, 40, 42, 40, 27)
        const eyePos: number[][] =
          s.eyeCount >= 4
            ? [[27, 37], [49, 37], [31, 28], [45, 28]]
            : s.eyeCount === 3
              ? [[27, 36], [49, 36], [38, 27]]
              : [[27, 36], [49, 36]]
        eyePos.forEach((p, idx) => {
          const scl = idx < 2 ? es : 0.65
          this.bossEye(g, s.eye, p[0] as number, p[1] as number, 12 * scl, 9 * scl)
        })
        g.fillStyle(dark, 1)
        g.fillCircle(33, 50, 2)
        g.fillCircle(43, 50, 2)
        const fangs = 6 + Math.round(s.rank * 3)
        g.fillStyle(0xffffff, 1)
        const gap = 24 / fangs
        for (let i = 0; i < fangs; i++) g.fillTriangle(26 + i * gap, 62, 28.4 + i * gap, 62, 27.2 + i * gap, 70 + s.rank * 2)
      }
    }
  }

  /** Boss fireball projectile (24x24): white-hot core so it tints well. */
  private drawBossOrb(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff5a1a, 0.35)
    g.fillCircle(12, 12, 12)
    g.fillStyle(0xff8a3a, 0.7)
    g.fillCircle(12, 12, 8)
    g.fillStyle(0xffd27a, 1)
    g.fillCircle(12, 12, 5)
    g.fillStyle(0xfff4d0, 1)
    g.fillCircle(11, 11, 2.4)
  }

  /** Falling meteor (30x44): fiery head + tapering trail. */
  private drawMeteor(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff7a2a, 0.4) // trail
    g.fillPoints(this.pts([15, 0, 10, 22, 20, 22]), true)
    g.fillStyle(0x3a2418, 1) // rock
    g.fillCircle(15, 30, 11)
    g.fillStyle(0x1e130c, 1)
    g.fillCircle(11, 28, 3)
    g.fillCircle(19, 33, 2.5)
    g.fillStyle(0xff8a3a, 1) // molten glow rim
    g.fillCircle(15, 26, 4)
    g.fillStyle(0xffd27a, 1)
    g.fillCircle(15, 25, 2)
  }

  /** Ground warning ring for a meteor AoE (64x64): tinted white so it colors well. */
  private drawMeteorWarn(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xffffff, 0.12)
    g.fillCircle(32, 32, 30)
    g.lineStyle(3, 0xffffff, 0.95)
    g.strokeCircle(32, 32, 29)
    g.lineStyle(2, 0xffffff, 0.7)
    g.strokeCircle(32, 32, 20)
    // crosshair ticks
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(31, 2, 2, 8)
    g.fillRect(31, 54, 2, 8)
    g.fillRect(2, 31, 8, 2)
    g.fillRect(54, 31, 8, 2)
  }

  /** CHEST — near-white so it can be tinted per rarity. */
  private drawChest(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xf2f2f2, 1)
    g.fillRoundedRect(4, 12, 24, 15, 3) // body
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(4, 6, 24, 9, 4) // lid
    g.fillStyle(0x8a8a8a, 1)
    g.fillRect(4, 14, 24, 2) // seam
    g.fillRect(6, 12, 2, 15) // straps
    g.fillRect(24, 12, 2, 15)
    g.fillStyle(0x5a4a2a, 1)
    g.fillRect(14, 13, 4, 5) // lock
    g.lineStyle(1.5, 0x3a2f22, 1)
    g.strokeRoundedRect(4, 6, 24, 21, 4)
  }

  /** HEAL — a soft pink heart. */
  private drawHeal(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff5a7a, 1)
    g.fillCircle(10, 11, 6)
    g.fillCircle(20, 11, 6)
    g.fillTriangle(4, 13, 26, 13, 15, 27)
    g.fillStyle(0xffffff, 0.5)
    g.fillCircle(8, 9, 2)
  }

  // ---- Boss weapons (28x56, centered x=14) --------------------------------

  private drawMace(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(12.5, 18, 3, 36) // handle
    g.fillStyle(0x6f7787, 1) // spikes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      g.fillTriangle(14 + Math.cos(a) * 6, 14 + Math.sin(a) * 6, 14 + Math.cos(a) * 13, 14 + Math.sin(a) * 13, 14 + Math.cos(a + 0.5) * 6, 14 + Math.sin(a + 0.5) * 6)
    }
    g.fillStyle(0x9198a6, 1)
    g.fillCircle(14, 14, 8) // head
    g.fillStyle(0xc7ccd8, 1)
    g.fillCircle(11, 11, 2.4) // highlight
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokeCircle(14, 14, 8)
  }

  private drawAxe(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(12.5, 6, 3, 48) // handle
    g.fillStyle(0x9198a6, 1) // blade
    g.fillPoints(this.pts([15, 8, 27, 12, 27, 24, 15, 22]), true)
    g.fillPoints(this.pts([13, 8, 1, 12, 1, 24, 13, 22]), true)
    g.fillStyle(0xc7ccd8, 1)
    g.fillPoints(this.pts([15, 9, 24, 12, 24, 15, 15, 13]), true)
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokePoints(this.pts([15, 8, 27, 12, 27, 24, 15, 22]), true)
    g.strokePoints(this.pts([13, 8, 1, 12, 1, 24, 13, 22]), true)
  }

  private drawSpear(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(12.5, 12, 3, 42) // shaft
    g.fillStyle(0xffce5a, 1)
    g.fillRect(9, 14, 10, 3) // collar
    g.fillStyle(0xcdd3e0, 1) // tip
    g.fillPoints(this.pts([14, 0, 18, 14, 14, 12, 10, 14]), true)
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokePoints(this.pts([14, 0, 18, 14, 14, 12, 10, 14]), true)
  }

  private drawScythe(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a2418, 1)
    g.fillRect(12.5, 6, 3, 48) // shaft
    g.fillStyle(0x9198a6, 1) // curved blade hooking off the top
    g.fillPoints(this.pts([14, 6, 2, 2, 0, 10, 8, 14, 14, 12]), true)
    g.fillStyle(0xc7ccd8, 1)
    g.fillPoints(this.pts([14, 7, 4, 4, 3, 8]), true)
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokePoints(this.pts([14, 6, 2, 2, 0, 10, 8, 14, 14, 12]), true)
  }

  private drawHammer(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a2418, 1)
    g.fillRect(12.5, 10, 3, 44) // shaft
    g.fillStyle(0x9198a6, 1) // big blocky head
    g.fillRoundedRect(3, 4, 22, 14, 3)
    g.fillStyle(0x6f7787, 1)
    g.fillRect(3, 11, 22, 3) // seam
    g.fillStyle(0xc7ccd8, 1)
    g.fillRect(5, 6, 6, 4) // highlight
    g.fillStyle(0x9198a6, 1) // top spike
    g.fillTriangle(11, 4, 17, 4, 14, -2)
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokeRoundedRect(3, 4, 22, 14, 3)
  }

  private drawTrident(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a2418, 1)
    g.fillRect(12.5, 16, 3, 38) // shaft
    g.fillStyle(0xffce5a, 1)
    g.fillRect(6, 16, 16, 3) // crossbar
    g.fillStyle(0xcdd3e0, 1) // three prongs
    for (const px of [7, 14, 21]) {
      g.fillRect(px - 1, 6, 2, 12)
      g.fillTriangle(px, 0, px - 2.4, 7, px + 2.4, 7)
    }
    g.lineStyle(1.2, 0x14171f, 1)
    g.strokeRect(6, 16, 16, 3)
  }

  private drawGreatsword(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xcdd3e0, 1) // broad blade
    g.fillPoints(this.pts([14, 0, 19, 8, 19, 38, 9, 38, 9, 8]), true)
    g.fillStyle(0xeef2ff, 1)
    g.fillRect(13, 6, 2, 30) // fuller
    g.fillStyle(0xffce5a, 1) // crossguard
    g.fillRect(4, 38, 20, 4)
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(12, 42, 4, 12) // grip
    g.fillStyle(0xffce5a, 1)
    g.fillCircle(14, 55, 2.4) // pommel
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokePoints(this.pts([14, 0, 19, 8, 19, 38, 9, 38, 9, 8]), true)
  }

  private drawHalberd(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a2418, 1)
    g.fillRect(12.5, 4, 3, 50) // shaft
    g.fillStyle(0x9198a6, 1) // axe blade
    g.fillPoints(this.pts([15, 8, 27, 10, 25, 22, 15, 20]), true)
    g.fillStyle(0xc7ccd8, 1)
    g.fillPoints(this.pts([15, 9, 24, 11, 24, 14, 15, 12]), true)
    g.fillStyle(0xcdd3e0, 1) // top spike
    g.fillPoints(this.pts([14, -2, 17, 8, 11, 8]), true)
    g.fillStyle(0x9198a6, 1) // rear hook
    g.fillTriangle(12, 10, 4, 12, 12, 16)
    g.lineStyle(1.4, 0x14171f, 1)
    g.strokePoints(this.pts([15, 8, 27, 10, 25, 22, 15, 20]), true)
  }

  // ---- Arena backgrounds (tileable 128x128) -------------------------------

  /** Soft radial vignette (dark edges) stretched over the arena for depth. */
  private makeVignette(): void {
    const s = 256
    const tex = this.textures.createCanvas('vignette', s, s)
    if (!tex) return
    const c = tex.getContext()
    const grd = c.createRadialGradient(s / 2, s / 2, s * 0.16, s / 2, s / 2, s * 0.62)
    grd.addColorStop(0, 'rgba(0,0,0,0)')
    grd.addColorStop(1, 'rgba(0,0,0,0.5)')
    c.fillStyle = grd
    c.fillRect(0, 0, s, s)
    tex.refresh()
  }

  /** Fine two-tone grain that tiles without an obvious repeat. */
  private grain(g: Phaser.GameObjects.Graphics, light: number, dark: number, density: number): void {
    g.fillStyle(dark, 0.5)
    for (let i = 0; i < density; i++) g.fillCircle(rnd(MAP_TILE), rnd(MAP_TILE), Math.random() < 0.3 ? 1.4 : 0.8)
    g.fillStyle(light, 0.5)
    for (let i = 0; i < density; i++) g.fillCircle(rnd(MAP_TILE), rnd(MAP_TILE), Math.random() < 0.3 ? 1.4 : 0.8)
  }

  private drawMeadow(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2f5a26, 1)
    g.fillRect(0, 0, MAP_TILE, MAP_TILE)
    g.fillStyle(0x264c1e, 1)
    for (let i = 0; i < 180; i++) g.fillRect(rnd(MAP_TILE), rnd(MAP_TILE), 2, 3 + rnd(4))
    this.grain(g, 0x3f7a32, 0x24471b, 150)
  }

  private drawDesert(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xc9a86a, 1)
    g.fillRect(0, 0, MAP_TILE, MAP_TILE)
    g.fillStyle(0xbf9c58, 0.6)
    for (let i = 0; i < 70; i++) g.fillRect(rnd(MAP_TILE), rnd(MAP_TILE), 10 + rnd(16), 1)
    this.grain(g, 0xd8ba7e, 0xa9884c, 150)
  }

  private drawTundra(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xcfe0ee, 1)
    g.fillRect(0, 0, MAP_TILE, MAP_TILE)
    this.grain(g, 0xffffff, 0xa9c0d6, 170)
  }

  private drawCaldera(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x201613, 1)
    g.fillRect(0, 0, MAP_TILE, MAP_TILE)
    g.fillStyle(0xff5a1a, 0.5)
    for (let i = 0; i < 40; i++) g.fillRect(rnd(MAP_TILE), rnd(MAP_TILE), 4 + rnd(10), 1)
    this.grain(g, 0x4a2a1c, 0x140c0a, 150)
    g.fillStyle(0xffb020, 0.8)
    for (let i = 0; i < 40; i++) g.fillCircle(rnd(MAP_TILE), rnd(MAP_TILE), 1)
  }

  private drawVoid(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x140c22, 1)
    g.fillRect(0, 0, MAP_TILE, MAP_TILE)
    g.fillStyle(0x9d74ff, 0.7)
    for (let i = 0; i < 40; i++) g.fillCircle(rnd(MAP_TILE), rnd(MAP_TILE), 1)
    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 120; i++) g.fillCircle(rnd(MAP_TILE), rnd(MAP_TILE), Math.random() < 0.15 ? 1.8 : 0.9)
  }

  // ---- Decoration props (scattered at random world positions) -------------

  private drawProps(): void {
    this.bake('treePine', 40, 52, (g) => {
      g.fillStyle(0x5c3b22, 1); g.fillRect(18, 38, 4, 12)
      g.fillStyle(0x2f6a34, 1); g.fillTriangle(20, 2, 6, 26, 34, 26)
      g.fillTriangle(20, 14, 4, 40, 36, 40)
      g.fillStyle(0x3f8a44, 1); g.fillTriangle(20, 8, 12, 24, 28, 24)
    })
    this.bake('rockGray', 40, 32, (g) => {
      g.fillStyle(0x8a8f9a, 1); g.fillPoints(this.pts([6, 28, 12, 12, 24, 8, 34, 18, 32, 28]), true)
      g.fillStyle(0xb0b5c0, 1); g.fillPoints(this.pts([12, 14, 22, 11, 26, 16]), true)
    })
    this.bake('bushGreen', 40, 30, (g) => {
      g.fillStyle(0x2f6a34, 1); g.fillCircle(12, 20, 9); g.fillCircle(26, 20, 10); g.fillCircle(20, 14, 9)
      g.fillStyle(0x3f8a44, 1); g.fillCircle(18, 15, 4)
    })
    this.bake('cactus', 36, 52, (g) => {
      g.fillStyle(0x3f8a44, 1); g.fillRoundedRect(15, 10, 8, 40, 4)
      g.fillRoundedRect(5, 24, 6, 16, 3); g.fillRoundedRect(4, 24, 6, 6, 3)
      g.fillRoundedRect(27, 18, 6, 18, 3); g.fillRoundedRect(27, 18, 6, 6, 3)
    })
    this.bake('rockSand', 40, 30, (g) => {
      g.fillStyle(0xb28f52, 1); g.fillPoints(this.pts([6, 26, 12, 12, 26, 9, 34, 20, 30, 26]), true)
      g.fillStyle(0xcaa76a, 1); g.fillPoints(this.pts([12, 14, 24, 12, 26, 17]), true)
    })
    this.bake('deadBush', 36, 30, (g) => {
      g.lineStyle(2, 0x7a5a34, 1)
      g.beginPath(); g.moveTo(18, 28); g.lineTo(18, 12); g.moveTo(18, 18); g.lineTo(8, 8)
      g.moveTo(18, 16); g.lineTo(28, 8); g.moveTo(18, 20); g.lineTo(26, 16); g.strokePath()
    })
    this.bake('treeSnow', 40, 52, (g) => {
      g.fillStyle(0x5c3b22, 1); g.fillRect(18, 38, 4, 12)
      g.fillStyle(0x2f6a44, 1); g.fillTriangle(20, 2, 6, 26, 34, 26); g.fillTriangle(20, 14, 4, 40, 36, 40)
      g.fillStyle(0xffffff, 1); g.fillTriangle(20, 2, 13, 14, 27, 14); g.fillTriangle(20, 16, 10, 30, 30, 30)
    })
    this.bake('rockIce', 40, 30, (g) => {
      g.fillStyle(0x9fbcd6, 1); g.fillPoints(this.pts([6, 26, 12, 12, 26, 9, 34, 20, 30, 26]), true)
      g.fillStyle(0xdff0ff, 1); g.fillPoints(this.pts([12, 14, 24, 12, 26, 17]), true)
    })
    this.bake('snowMound', 44, 24, (g) => {
      g.fillStyle(0xffffff, 1); g.fillEllipse(22, 18, 40, 20)
      g.fillStyle(0xe6f0fb, 1); g.fillEllipse(16, 16, 16, 8)
    })
    this.bake('deadTree', 40, 52, (g) => {
      g.lineStyle(3, 0x3a2418, 1)
      g.beginPath(); g.moveTo(20, 50); g.lineTo(20, 16); g.moveTo(20, 26); g.lineTo(8, 12)
      g.moveTo(20, 22); g.lineTo(32, 10); g.moveTo(20, 32); g.lineTo(30, 24); g.strokePath()
    })
    this.bake('rockChar', 40, 32, (g) => {
      g.fillStyle(0x2a201c, 1); g.fillPoints(this.pts([6, 28, 12, 12, 24, 8, 34, 18, 32, 28]), true)
      g.fillStyle(0xff5a1a, 0.9); g.fillRect(14, 18, 10, 2); g.fillRect(18, 14, 2, 10)
    })
    this.bake('lavaCrystal', 30, 44, (g) => {
      g.fillStyle(0xff6a00, 1); g.fillPoints(this.pts([15, 2, 24, 22, 15, 42, 6, 22]), true)
      g.fillStyle(0xffd08a, 0.9); g.fillPoints(this.pts([15, 6, 20, 22, 15, 30]), true)
    })
    this.bake('crystalVoid', 30, 46, (g) => {
      g.fillStyle(0x9d5cff, 1); g.fillPoints(this.pts([15, 2, 25, 24, 15, 44, 5, 24]), true)
      g.fillStyle(0xe0c8ff, 0.9); g.fillPoints(this.pts([15, 6, 21, 24, 15, 32]), true)
    })
    this.bake('asteroid', 40, 34, (g) => {
      g.fillStyle(0x3a3450, 1); g.fillPoints(this.pts([6, 26, 12, 10, 26, 8, 34, 20, 28, 30]), true)
      g.fillStyle(0x2a2440, 1); g.fillCircle(16, 18, 3); g.fillCircle(26, 22, 2)
    })
    this.bake('starCluster', 30, 30, (g) => {
      g.fillStyle(0xffffff, 1); g.fillCircle(15, 15, 2)
      g.fillStyle(0xb794ff, 0.9); g.fillCircle(8, 8, 1.4); g.fillCircle(23, 10, 1.2); g.fillCircle(20, 22, 1.4); g.fillCircle(9, 22, 1)
    })
  }

  /** EASY — tiny green slime with an antenna. */
  private drawSlime(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x5bbf5b, 1)
    g.fillRect(22, 6, 2, 8) // antenna stalk
    g.fillCircle(23, 6, 3) // antenna bulb
    g.fillStyle(0x8ce99a, 1)
    g.fillEllipse(24, 30, 40, 30) // body
    g.fillStyle(0x5bbf5b, 0.9)
    g.fillEllipse(24, 34, 26, 18) // belly
    this.drawEyes(g, 18, 30, 28, 10, 12, 0x14200f)
    g.fillStyle(0x14200f, 1)
    g.fillRoundedRect(20, 38, 8, 3, 1) // mouth
  }

  /** LEGEND — a gold-eyed skull boss with big horns and fangs. */
  private drawLegend(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x241d1a, 1) // horns
    g.fillTriangle(16, 20, 3, 0, 23, 16)
    g.fillTriangle(48, 20, 61, 0, 41, 16)
    g.fillStyle(0xe8e2d0, 1) // skull
    g.fillEllipse(32, 30, 46, 48)
    g.fillStyle(0xcfc7b0, 1) // jaw shade
    g.fillEllipse(32, 46, 28, 20)
    g.fillStyle(0x120d06, 1) // eye sockets
    g.fillEllipse(23, 30, 14, 16)
    g.fillEllipse(41, 30, 14, 16)
    g.fillStyle(0xffd700, 1) // glowing eyes
    g.fillCircle(23, 31, 4.2)
    g.fillCircle(41, 31, 4.2)
    g.fillStyle(0xfff2a8, 1)
    g.fillCircle(22, 30, 1.6)
    g.fillCircle(40, 30, 1.6)
    g.fillStyle(0x120d06, 1) // nose
    g.fillTriangle(32, 36, 29, 45, 35, 45)
    g.fillStyle(0xffffff, 1) // fangs
    for (let i = 0; i < 5; i++) g.fillRect(21 + i * 5, 47, 3, 5)
    g.fillStyle(0xffd700, 1) // crown notch
    g.fillTriangle(28, 8, 32, 2, 36, 8)
  }

  /** The RIVAL hero — a horned, red-eyed dark warlord (not the player recolored). */
  /** Parametric dark warlord — 10 skins differ by palette + horn style. */
  private drawWarlord(g: Phaser.GameObjects.Graphics, s: WarlordSkin): void {
    const dark = 0x0c0a12
    const spike = 1 + s.rank // shoulder spikes grow menacing with rank

    if (s.glow) this.bakedGlow(g, 28, 40, s.glow, 26)
    g.fillStyle(s.cape, 1)
    g.fillPoints(this.pts([14, 26, 42, 26, 48, 60, 8, 60]), true)
    g.fillStyle(dark, 1) // torso outline
    g.fillPoints(this.pts([16, 31, 40, 31, 46, 63, 10, 63]), true)
    g.fillStyle(s.armor, 1)
    g.fillPoints(this.pts([18, 32, 38, 32, 44, 62, 12, 62]), true)
    g.fillStyle(s.armorHi, 0.9)
    g.fillPoints(this.pts([24, 34, 32, 34, 35, 62, 21, 62]), true)
    g.fillStyle(s.accent, 1) // shoulder spikes
    g.fillTriangle(10, 34, 18, 34 - 8 * spike, 20, 37)
    g.fillTriangle(46, 34, 38, 34 - 8 * spike, 36, 37)
    g.fillStyle(dark, 1) // helm outline
    g.fillEllipse(28, 20, 35, 29)
    g.fillStyle(s.helm, 1) // helm
    g.fillEllipse(28, 20, 32, 26)
    this.drawHorns(g, s.horn, s.hornColor)
    g.fillStyle(0x0c0a12, 1) // face shadow
    g.fillEllipse(28, 23, 19, 18)
    g.fillStyle(s.eye, 1) // glowing eyes
    g.fillEllipse(23, 23, 5, 3.6)
    g.fillEllipse(33, 23, 5, 3.6)
    g.fillStyle(0xffffff, 0.85)
    g.fillCircle(23, 23, 1)
    g.fillCircle(33, 23, 1)
    g.fillStyle(s.accent, 1) // chest emblem
    g.fillCircle(28, 42, 2 + s.rank * 2)
  }

  private drawHorns(g: Phaser.GameObjects.Graphics, style: string, color: number): void {
    g.fillStyle(color, 1)
    switch (style) {
      case 'straight':
        g.fillTriangle(14, 16, 7, 1, 21, 14)
        g.fillTriangle(42, 16, 49, 1, 35, 14)
        break
      case 'wide':
        g.fillTriangle(14, 18, 0, 8, 22, 16)
        g.fillTriangle(42, 18, 56, 8, 34, 16)
        break
      case 'back':
        g.fillTriangle(16, 14, 3, 5, 20, 16)
        g.fillTriangle(40, 14, 53, 5, 36, 16)
        break
      case 'crown':
        for (let i = 0; i < 5; i++) {
          const x = 13 + i * 8
          g.fillTriangle(x, 14, x + 3, 3, x + 6, 14)
        }
        break
      case 'antler':
        g.fillTriangle(15, 16, 9, 3, 21, 14)
        g.fillTriangle(12, 9, 6, 1, 16, 9)
        g.fillTriangle(41, 16, 47, 3, 35, 14)
        g.fillTriangle(44, 9, 50, 1, 40, 9)
        break
      case 'single':
        g.fillTriangle(24, 14, 28, 0, 32, 14)
        break
      case 'spikes':
        for (const x of [14, 21, 28, 35, 42]) g.fillTriangle(x - 2, 14, x, 2, x + 2, 14)
        break
      case 'trident':
        g.fillTriangle(24, 14, 28, 2, 32, 14)
        g.fillTriangle(18, 14, 20, 6, 22, 14)
        g.fillTriangle(34, 14, 36, 6, 38, 14)
        break
      case 'ram':
        g.fillTriangle(14, 12, 2, 16, 18, 15)
        g.fillTriangle(42, 12, 54, 16, 38, 15)
        break
      // 'none' -> hooded, no horns
    }
  }

  // ---- Hero (10 evolving champion looks, box 64x64, centered x=32) ---------

  /**
   * Soft radial aura baked into a texture: concentric translucent discs from a
   * faint outer edge to a brighter core. Gives strong units a permanent glow.
   */
  private bakedGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, radius: number): void {
    const steps = 5
    for (let k = steps; k >= 1; k--) {
      g.fillStyle(color, 0.05 + 0.02 * (steps - k))
      g.fillCircle(cx, cy, (radius * k) / steps)
    }
  }

  /** Hero helmet silhouette by archetype: greathelm / barbute / hood / spiked / crowned-open. */
  private drawHeroHelm(g: Phaser.GameObjects.Graphics, s: ChampionSkin, dark: number): void {
    const hw = 24 + Math.round(6 * s.rank)
    const eyeSlit = (): void => {
      g.fillStyle(s.eye, 1)
      g.fillRect(25, 19, 4, 3)
      g.fillRect(35, 19, 4, 3)
    }
    switch (s.helmType) {
      case 1: // barbute (tall, pointed, T-opening)
        g.fillStyle(dark, 1)
        g.fillEllipse(32, 18, hw + 1, 31)
        g.fillStyle(s.hood, 1)
        g.fillEllipse(32, 18, hw - 2, 28)
        g.fillTriangle(32 - hw / 2 + 2, 9, 32 + hw / 2 - 2, 9, 32, 1)
        g.fillStyle(dark, 1)
        g.fillRect(31, 12, 2, 14)
        g.fillRect(32 - hw / 2 + 3, 18, hw - 6, 5)
        eyeSlit()
        break
      case 2: // cloth hood (shadowed face)
        g.fillStyle(shade(s.cape, 0.8), 1)
        g.fillEllipse(32, 17, hw + 4, 30)
        g.fillTriangle(32 - hw / 2 - 1, 12, 30, 0, 34, 12)
        g.fillStyle(dark, 1)
        g.fillEllipse(32, 20, hw - 5, 23)
        eyeSlit()
        break
      case 3: // spiked helm
        g.fillStyle(dark, 1)
        g.fillEllipse(32, 18, hw + 3, 29)
        g.fillStyle(s.hood, 1)
        g.fillEllipse(32, 18, hw, 26)
        g.fillStyle(s.trim, 1)
        for (const x of [24, 29, 32, 35, 40]) g.fillTriangle(x - 2, 8, x, 1, x + 2, 8)
        g.fillStyle(dark, 1)
        g.fillRect(32 - hw / 2 + 3, 18, hw - 6, 6)
        g.fillRect(31, 18, 2, 9)
        eyeSlit()
        break
      case 4: // crowned open face
        g.fillStyle(dark, 1)
        g.fillEllipse(32, 20, hw, 26)
        g.fillStyle(s.trim, 1)
        g.fillRect(32 - hw / 2 + 1, 12, hw - 2, 3)
        for (const x of [26, 32, 38]) g.fillTriangle(x - 2, 12, x, 6, x + 2, 12)
        g.fillStyle(s.eye, 1)
        g.fillEllipse(27, 20, 5, 4)
        g.fillEllipse(37, 20, 5, 4)
        break
      default: // greathelm (dome + visor)
        g.fillStyle(dark, 1)
        g.fillEllipse(32, 18, hw + 3, 29)
        g.fillStyle(s.hood, 1)
        g.fillEllipse(32, 18, hw, 26)
        g.fillStyle(s.robeHi, 1)
        g.fillRect(32 - hw / 2 + 2, 15, hw - 4, 3)
        g.fillStyle(dark, 1)
        if (s.visor === 0) {
          g.fillRect(32 - hw / 2 + 3, 18, hw - 6, 6)
          g.fillRect(31, 18, 2, 9)
        } else {
          g.fillPoints(this.pts([32 - hw / 2 + 3, 17, 30, 22, 32 - hw / 2 + 3, 23]), true)
          g.fillPoints(this.pts([32 + hw / 2 - 3, 17, 34, 22, 32 + hw / 2 - 3, 23]), true)
          g.fillRect(31, 16, 2, 11)
        }
        eyeSlit()
    }
  }

  /**
   * A knight hero. `rank` drives everything: low rank is a lean, plain footman
   * (dull plate, bare head), high rank is a broad, glowing, winged champion —
   * regalia unlocks via `features`, body bulk & glow scale continuously.
   */
  /**
   * A hero. `cls` picks a fully different BODY silhouette (knight, barbarian,
   * mage, samurai, rogue, golem, lich, dragoon) — so heroes differ in SHAPE,
   * not just color. `rank` still layers grandeur (glow, wings, crown, halo).
   */
  /**
   * The 5 bespoke DIVINE champions — the top rarity. Each is a fully unique,
   * hand-authored silhouette far grander than the procedural heroes.
   */
  private drawDivineHero(g: Phaser.GameObjects.Graphics, idx: number): void {
    const dark = 0x0c0a12
    switch (idx) {
      case 0: { // Seraph — celestial, triple wings + halo, radiant gold-white
        this.bakedGlow(g, 32, 32, 0xfff2b0, 40)
        g.fillStyle(0xffffff, 0.96) // three pairs of wings
        for (const wy of [22, 32, 42]) {
          g.fillPoints(this.pts([18, wy, 0, wy - 8, 3, wy + 8, 16, wy + 4]), true)
          g.fillPoints(this.pts([46, wy, 64, wy - 8, 61, wy + 8, 48, wy + 4]), true)
        }
        this.drawHeroLegs(g, 0xd8c98a, dark)
        g.fillStyle(0xf6f1e0, 1) // radiant plate
        g.fillRoundedRect(19, 27, 26, 25, 6)
        g.fillStyle(0xffd700, 1) // gold V + belt
        g.fillPoints(this.pts([32, 29, 42, 34, 40, 49, 24, 49, 22, 34]), true)
        g.fillRect(19, 48, 26, 4)
        g.fillStyle(0xffd700, 1) // pauldrons
        g.fillCircle(20, 31, 6)
        g.fillCircle(44, 31, 6)
        g.fillStyle(0xf6f1e0, 1) // head
        g.fillEllipse(32, 17, 22, 21)
        g.fillStyle(0x8affff, 1) // glowing eyes
        g.fillRect(26, 16, 4, 3)
        g.fillRect(35, 16, 4, 3)
        g.lineStyle(3, 0xffe14d, 1) // halo
        g.strokeEllipse(32, 4, 28, 10)
        break
      }
      case 1: { // Void Sovereign — cosmic black armor, violet aura, shard crown
        this.bakedGlow(g, 32, 34, 0x9d3cff, 40)
        g.fillStyle(0x2a1050, 1)
        g.fillPoints(this.pts([16, 26, 48, 26, 56, 62, 8, 62]), true) // void cape
        this.drawHeroLegs(g, 0x18122a, dark)
        g.fillStyle(0x141024, 1) // near-black plate
        g.fillRoundedRect(18, 27, 28, 25, 6)
        g.fillStyle(0xffffff, 0.9) // starfield
        for (const p of [[24, 32], [30, 38], [38, 34], [42, 45], [27, 46], [35, 30]]) g.fillCircle(p[0] as number, p[1] as number, 0.9)
        g.fillStyle(0xb06bff, 1) // violet trim + gem
        g.fillRect(18, 48, 28, 3)
        g.fillCircle(32, 40, 3.5)
        g.fillStyle(0x141024, 1) // helm
        g.fillEllipse(32, 17, 24, 23)
        g.fillStyle(0xd48aff, 1) // eyes
        g.fillRect(26, 16, 4, 3)
        g.fillRect(35, 16, 4, 3)
        g.fillStyle(0xb06bff, 1) // floating shard crown
        for (const x of [22, 27, 32, 37, 42]) g.fillTriangle(x - 2.5, 4, x, -4, x + 2.5, 4)
        break
      }
      case 2: { // Inferno Lord — molten armor, flame crown, ember cape
        this.bakedGlow(g, 32, 34, 0xff5a1a, 42)
        g.fillStyle(0x7a1408, 1)
        g.fillPoints(this.pts([16, 26, 48, 26, 54, 62, 10, 62]), true) // fiery cape
        g.fillStyle(0xff6a1a, 0.6)
        g.fillPoints(this.pts([22, 30, 42, 30, 46, 62, 18, 62]), true)
        this.drawHeroLegs(g, 0x2a1410, dark)
        g.fillStyle(0x2a1410, 1) // charcoal plate
        g.fillRoundedRect(18, 27, 28, 25, 5)
        g.fillStyle(0xff7a1a, 1) // molten cracks
        g.fillRect(31, 29, 2, 20)
        g.fillRect(24, 40, 8, 1.4)
        g.fillRect(33, 36, 8, 1.4)
        g.fillStyle(0x1a0d0a, 1) // horned helm
        g.fillEllipse(32, 18, 24, 22)
        g.fillStyle(0xff3b1a, 1) // eyes
        g.fillRect(26, 17, 4, 3)
        g.fillRect(35, 17, 4, 3)
        g.fillStyle(0xffb020, 1) // flame crown
        for (const x of [24, 30, 32, 34, 40]) g.fillTriangle(x - 3, 8, x, -2, x + 3, 8)
        g.fillStyle(0xff5a1a, 1)
        for (const x of [27, 32, 37]) g.fillTriangle(x - 2, 8, x, 2, x + 2, 8)
        break
      }
      case 3: { // God-Emperor — massive ornate gold, huge crown, scepter
        this.bakedGlow(g, 32, 34, 0xffe14d, 44)
        g.fillStyle(0x8a1020, 1) // imperial cape
        g.fillPoints(this.pts([14, 25, 50, 25, 58, 62, 6, 62]), true)
        this.drawHeroLegs(g, 0x6a5410, dark)
        g.fillStyle(0xffd700, 1) // grand gold plate
        g.fillRoundedRect(16, 26, 32, 27, 6)
        g.fillStyle(0xfff2a8, 0.9)
        g.fillPoints(this.pts([32, 29, 44, 34, 42, 50, 22, 50, 20, 34]), true)
        g.fillStyle(0xb8860b, 1) // spiked pauldrons
        g.fillTriangle(6, 34, 18, 24, 20, 38)
        g.fillTriangle(58, 34, 46, 24, 44, 38)
        g.fillCircle(15, 31, 6)
        g.fillCircle(49, 31, 6)
        g.fillStyle(0xfff2a8, 1) // head
        g.fillEllipse(32, 18, 22, 21)
        g.fillStyle(0xff3b6b, 1) // eyes
        g.fillRect(26, 17, 4, 3)
        g.fillRect(35, 17, 4, 3)
        g.fillStyle(0xffd700, 1) // huge crown
        for (const x of [20, 25, 32, 39, 44]) g.fillTriangle(x - 3, 8, x, -3, x + 3, 8)
        g.fillStyle(0xff3b6b, 1)
        g.fillCircle(32, 6, 2)
        g.fillStyle(0x8a6a10, 1) // scepter
        g.fillRect(52, 16, 2, 34)
        g.fillStyle(0xffe14d, 1)
        g.fillCircle(53, 14, 4)
        break
      }
      default: { // Dragon Ascendant — scaled armor, dragon horns, bat wings
        this.bakedGlow(g, 32, 34, 0x3aff8a, 40)
        g.fillStyle(0x1c5a2a, 1) // bat wings
        g.fillPoints(this.pts([18, 28, 2, 18, 6, 40, 12, 34, 16, 44]), true)
        g.fillPoints(this.pts([46, 28, 62, 18, 58, 40, 52, 34, 48, 44]), true)
        this.drawHeroLegs(g, 0x1a3a20, dark)
        g.fillStyle(0x2f7a3a, 1) // scaled plate
        g.fillRoundedRect(18, 27, 28, 25, 5)
        g.fillStyle(0x1c5a2a, 1) // scale rows
        for (const yy of [32, 38, 44]) g.fillRect(19, yy, 26, 1.6)
        g.fillStyle(0xffd700, 1) // gold trim + gem
        g.fillRect(18, 48, 28, 3)
        g.fillCircle(32, 39, 3)
        g.fillStyle(0x24521f, 1) // helm
        g.fillEllipse(32, 18, 24, 22)
        g.fillStyle(0xffb020, 1) // big dragon horns
        g.fillPoints(this.pts([20, 14, 6, 2, 12, -2, 24, 12]), true)
        g.fillPoints(this.pts([44, 14, 58, 2, 52, -2, 40, 12]), true)
        g.fillStyle(0xffe14d, 1) // amber eyes
        g.fillRect(26, 17, 4, 3)
        g.fillRect(35, 17, 4, 3)
        g.fillStyle(0x1a0d0a, 1) // snout ridge
        g.fillRect(30, 20, 4, 6)
      }
    }
  }

  private drawChampion(g: Phaser.GameObjects.Graphics, s: ChampionSkin): void {
    if (s.special >= 0) {
      this.drawDivineHero(g, s.special)
      return
    }
    const has = (f: string) => s.features.includes(f)
    const dark = 0x0c0a12

    if (s.glow) this.bakedGlow(g, 32, 34, s.glow, 30)
    // Wings (behind the body) for high-rank heroes.
    if (has('wings')) {
      g.fillStyle(s.wing ?? 0xeef2ff, 1)
      g.fillPoints(this.pts([16, 30, 0, 20, 4, 44, 15, 48]), true)
      g.fillPoints(this.pts([48, 30, 64, 20, 60, 44, 49, 48]), true)
      g.fillStyle(shade(s.wing ?? 0xeef2ff, 0.8), 1)
      g.fillPoints(this.pts([16, 34, 4, 28, 6, 44, 15, 47]), true)
      g.fillPoints(this.pts([48, 34, 60, 28, 58, 44, 49, 47]), true)
    }

    // All heroes are armored knights; armor grandeur scales with power (rank).
    this.drawHeroKnight(g, s, dark)

    // Held equipment (sword / dual / spear / shield).
    this.drawHeroGear(g, s, dark)

    // Shared high-rank regalia (works over any class head near the top).
    if (has('crown')) {
      g.fillStyle(s.trim, 1)
      for (const x of [22, 27, 32, 37, 42]) g.fillTriangle(x - 2.5, 8, x, 1, x + 2.5, 8)
    }
    if (has('halo')) {
      g.lineStyle(2, s.trim, 1)
      g.strokeEllipse(32, 5, 26, 8)
    }
  }

  /** A small held sword at hand position (x, y), blade pointing up. */
  private drawHeldSword(g: Phaser.GameObjects.Graphics, x: number, y: number, trim: number): void {
    g.fillStyle(0x9aa2b4, 1)
    g.fillRect(x - 1.2, y - 18, 2.6, 18) // blade
    g.fillTriangle(x, y - 22, x - 2.2, y - 18, x + 2.2, y - 18) // tip
    g.fillStyle(trim, 1)
    g.fillRect(x - 3.5, y - 1, 7, 2) // guard
    g.fillStyle(0x3a2a1a, 1)
    g.fillRect(x - 1, y + 1, 2, 5) // grip
  }

  /** Held equipment drawn over the hands: sword / dual / spear / shield. */
  private drawHeroGear(g: Phaser.GameObjects.Graphics, s: ChampionSkin, dark: number): void {
    const rx = 52
    const lx = 12
    const hy = 44
    switch (s.gear) {
      case 1: // dual swords
        this.drawHeldSword(g, rx, hy, s.trim)
        this.drawHeldSword(g, lx, hy, s.trim)
        break
      case 2: // spear
        g.fillStyle(0x5c3b22, 1)
        g.fillRect(rx - 1, 12, 2.4, 44)
        g.fillStyle(0xcdd3e0, 1)
        g.fillTriangle(rx + 0.2, 4, rx - 3, 14, rx + 3.4, 14)
        g.fillStyle(s.trim, 1)
        g.fillRect(rx - 2, 16, 4.4, 2)
        break
      case 3: // shield (left) + sword (right) — the defensive kit
        g.fillStyle(dark, 1)
        g.fillRoundedRect(4, 32, 16, 22, 4)
        g.fillStyle(s.robe, 1)
        g.fillRoundedRect(5, 33, 14, 20, 3)
        g.fillStyle(s.robeHi, 0.9)
        g.fillRoundedRect(7, 35, 5, 16, 2)
        g.fillStyle(s.trim, 1)
        g.fillCircle(12, 43, 3)
        this.drawHeldSword(g, rx, hy, s.trim)
        break
      default: // single sword
        this.drawHeldSword(g, rx, hy, s.trim)
    }
  }

  /** Two booted legs centered on x=32. */
  private drawHeroLegs(g: Phaser.GameObjects.Graphics, color: number, dark: number): void {
    g.fillStyle(color, 1)
    g.fillRect(23, 50, 7, 12)
    g.fillRect(34, 50, 7, 12)
    g.fillStyle(dark, 1)
    g.fillRect(23, 58, 7, 4)
    g.fillRect(34, 58, 7, 4)
  }

  // ---- Hero classes (each a distinct silhouette) --------------------------

  /** The one hero silhouette: an armored knight whose plate grows more ornate
   *  (bigger pauldrons, more lames, gorget, knee cops, trim) as rank/power rises. */
  private drawHeroKnight(g: Phaser.GameObjects.Graphics, s: ChampionSkin, dark: number): void {
    const has = (f: string) => s.features.includes(f)
    const r = s.rank
    const bulk = 0.82 + 0.32 * r
    const w = Math.round(28 * bulk)
    const x0 = 32 - w / 2
    if (has('cape')) {
      g.fillStyle(s.cape, 1)
      g.fillPoints(this.pts([16, 26, 48, 26, 54, 62, 10, 62]), true)
    }
    // Armored legs with knee cops (cops appear as rank rises).
    this.drawHeroLegs(g, shade(s.robe, 0.8), dark)
    if (r > 0.35) {
      g.fillStyle(s.trim, 1)
      g.fillCircle(26, 51, 2.4)
      g.fillCircle(37, 51, 2.4)
    }
    // Chestplate (dark outline + plate + highlight V).
    g.fillStyle(dark, 1)
    g.fillRoundedRect(x0 - 1.5, 26.5, w + 3, 27, 6)
    g.fillStyle(s.robe, 1)
    g.fillRoundedRect(x0, 28, w, 25, 5)
    g.fillStyle(s.robeHi, 0.95)
    g.fillPoints(this.pts([32, 30, x0 + w - 4, 34, x0 + w - 6, 50, x0 + 6, 50, x0 + 4, 34]), true)
    // Fauld lames — more bands = fancier armor (scales with rank).
    const lames = 1 + Math.floor(r * 3)
    g.fillStyle(shade(s.robe, 0.7), 1)
    for (let k = 0; k < lames; k++) g.fillRect(x0 + 2, 42 + k * 2.4, w - 4, 1.2)
    // Emblem / decoration.
    g.fillStyle(s.trim, 1)
    if (s.pattern === 1) g.fillRect(x0 + 3, 36, w - 6, 2)
    else if (s.pattern === 2) { g.fillTriangle(32, 33, 37, 40, 32, 47); g.fillTriangle(32, 33, 27, 40, 32, 47) }
    // Muscle/plate seam shading for definition.
    g.fillStyle(dark, 0.4)
    g.fillRect(31, 30, 1.4, 18)
    g.fillStyle(s.trim, 1) // belt + gem
    g.fillRect(x0, 48, w, 4)
    const gem = 2 + r * 2.5
    g.fillCircle(32, 40, gem)
    g.fillStyle(0xffffff, 0.7) // gem shine
    g.fillCircle(31, 39, gem * 0.4)
    // Rivets down the chest edges (detail).
    g.fillStyle(shade(s.trim, 0.7), 1)
    for (let k = 0; k < 3; k++) {
      g.fillCircle(x0 + 2.5, 31 + k * 5, 0.9)
      g.fillCircle(x0 + w - 2.5, 31 + k * 5, 0.9)
    }
    // Gorget (neck plate) on higher ranks.
    if (r > 0.25) {
      g.fillStyle(s.robeHi, 1)
      g.fillRoundedRect(27, 25, 10, 4, 2)
      g.fillStyle(dark, 0.5)
      g.fillRect(31, 25, 2, 4)
    }
    // Pauldrons — angular, growing with rank.
    const pad = 4 + Math.round(4 * bulk)
    g.fillStyle(s.trim, 1)
    g.fillPoints(this.pts([x0 - 9, 34, x0 - 4, 25, x0 + 5, 30, x0 + 2, 39]), true)
    g.fillPoints(this.pts([x0 + w + 9, 34, x0 + w + 4, 25, x0 + w - 5, 30, x0 + w - 2, 39]), true)
    g.fillStyle(s.robeHi, 1)
    g.fillCircle(x0 - 2, 31, pad - 4)
    g.fillCircle(x0 + w + 2, 31, pad - 4)
    g.fillStyle(dark, 0.5) // pauldron rivet
    g.fillCircle(x0 - 2, 31, 1)
    g.fillCircle(x0 + w + 2, 31, 1)
    if (r > 0.6) { // spikes on the pauldrons at high rank
      g.fillStyle(s.trim, 1)
      g.fillTriangle(x0 - 6, 30, x0 - 2, 20, x0 + 1, 30)
      g.fillTriangle(x0 + w + 6, 30, x0 + w + 2, 20, x0 + w - 1, 30)
    }
    // Gauntlet fists.
    g.fillStyle(s.robeHi, 1)
    g.fillCircle(x0 - 4, 40, 3.5)
    g.fillCircle(x0 + w + 4, 40, 3.5)
    // Helmet (type ordered by rank).
    this.drawHeroHelm(g, s, dark)
    if (has('crest')) {
      g.fillStyle(s.trim, 1)
      g.fillPoints(this.pts([30, 8, 34, 8, 34, 0, 30, 2]), true)
      g.fillPoints(this.pts([31, 6, 33, 6, 38, 4, 36, 10]), true)
    }
  }

  private drawSword(g: Phaser.GameObjects.Graphics): void {
    const cx = 8
    // Tapered leaf blade.
    g.fillStyle(0xcdd3e0, 1)
    g.fillPoints(this.pts([cx, 1, cx + 3.6, 12, cx + 2.4, 28, cx - 2.4, 28, cx - 3.6, 12]), true)
    // Bright bevel down the left edge.
    g.fillStyle(0xf2f5ff, 1)
    g.fillPoints(this.pts([cx, 1, cx - 3.6, 12, cx - 1.2, 27, cx - 0.4, 12]), true)
    // Center fuller groove.
    g.fillStyle(0x99a1b4, 1)
    g.fillRect(cx - 0.6, 6, 1.2, 20)
    // Swept cross-guard (gold).
    g.fillStyle(0xffce5a, 1)
    g.fillPoints(this.pts([cx - 8, 29, cx + 8, 29, cx + 5.5, 33, cx - 5.5, 33]), true)
    // Wrapped grip.
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(cx - 1.7, 33, 3.4, 9)
    // Pommel.
    g.fillStyle(0xffce5a, 1)
    g.fillCircle(cx, 43, 2.3)
    // Dark outline so the blade stays visible on light maps.
    g.lineStyle(1.6, 0x14171f, 1)
    g.strokePoints(this.pts([cx, 1, cx + 3.6, 12, cx + 2.4, 28, cx - 2.4, 28, cx - 3.6, 12]), true)
  }

  /** One of 10 player blade silhouettes. Guard/grip/pommel are shared; the
   *  blade shape varies. Tier tint recolors the whole blade in-game. */
  /** Shared gold cross-guard + grip + pommel. */
  private drawWeaponGuard(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xffce5a, 1)
    g.fillPoints(this.pts([0, 29, 16, 29, 13.5, 33, 2.5, 33]), true)
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(6.3, 33, 3.4, 9)
    g.fillStyle(0xffce5a, 1)
    g.fillCircle(8, 43, 2.3)
  }

  /**
   * Weapons with a distinctive SHAPE + baked EFFECT (glow, energy core, runes,
   * saw teeth, barbs). Returns true if it fully handled the draw.
   */
  private drawSpecialWeapon(g: Phaser.GameObjects.Graphics, shape: string): boolean {
    switch (shape) {
      case 'energy': { // plasma blade with a white-hot core + soft glow
        g.fillStyle(0xffffff, 0.22)
        g.fillPoints(this.pts([8, -1, 12, 10, 11, 29, 5, 29, 4, 10]), true) // glow halo
        g.fillStyle(0x9be7ff, 0.95)
        g.fillPoints(this.pts([8, 1, 10.4, 10, 10, 28, 6, 28, 5.6, 10]), true)
        g.fillStyle(0xffffff, 1)
        g.fillRect(7.3, 3, 1.4, 24) // core
        this.drawWeaponGuard(g)
        return true
      }
      case 'holy': { // radiant broad blade + winged guard
        g.fillStyle(0xfff4c0, 0.25)
        g.fillPoints(this.pts([8, -1, 13, 10, 12.5, 30, 3.5, 30, 3, 10]), true) // aura
        g.fillStyle(0xf2f5ff, 1)
        g.fillPoints(this.pts([8, 0, 12, 10, 11.5, 29, 4.5, 29, 4, 10]), true)
        g.fillStyle(0xffffff, 1)
        g.fillRect(7.2, 3, 1.6, 24)
        g.fillStyle(0xffd700, 1) // winged crossguard
        g.fillPoints(this.pts([8, 28, 0, 26, 3, 33, 8, 33]), true)
        g.fillPoints(this.pts([8, 28, 16, 26, 13, 33, 8, 33]), true)
        g.fillStyle(0x5c3b22, 1)
        g.fillRect(6.3, 33, 3.4, 9)
        g.fillStyle(0x9be7ff, 1)
        g.fillCircle(8, 43, 2.6) // gem pommel
        return true
      }
      case 'chakram': { // serrated ring blade
        const cx = 8
        const cy = 15
        g.fillStyle(0xcdd3e0, 1)
        g.fillCircle(cx, cy, 8)
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          g.fillTriangle(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, cx + Math.cos(a + 0.4) * 8, cy + Math.sin(a + 0.4) * 8)
        }
        g.fillStyle(0x2a2f38, 1)
        g.fillCircle(cx, cy, 4) // hollow center
        g.fillStyle(0x5c3b22, 1)
        g.fillRect(6.5, 30, 3, 12) // grip
        return true
      }
      case 'sawblade': { // spinning circular saw
        const cx = 8
        const cy = 14
        g.fillStyle(0x9198a6, 1)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2
          g.fillTriangle(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * 12, cy + Math.sin(a - 0.2) * 12, cx + Math.cos(a + 0.5) * 7, cy + Math.sin(a + 0.5) * 7)
        }
        g.fillStyle(0xcdd3e0, 1)
        g.fillCircle(cx, cy, 7)
        g.fillStyle(0x6f7787, 1)
        g.fillCircle(cx, cy, 3)
        g.fillStyle(0x3a2f22, 1)
        g.fillRect(6.6, 30, 2.8, 12)
        return true
      }
      case 'demon': { // barbed jagged blade
        g.fillStyle(0x9198a6, 1)
        g.fillPoints(this.pts([8, 0, 11, 8, 13, 12, 10.5, 14, 11, 28, 5, 28, 5.5, 14, 3, 12, 5, 8]), true)
        g.fillStyle(0xb0103a, 0.5)
        g.fillRect(7.4, 4, 1.2, 22) // infernal fuller
        g.lineStyle(1.4, 0x14171f, 1)
        g.strokePoints(this.pts([8, 0, 11, 8, 13, 12, 10.5, 14, 11, 28, 5, 28, 5.5, 14, 3, 12, 5, 8]), true)
        this.drawWeaponGuard(g)
        return true
      }
      case 'runic': { // straight blade etched with glowing runes
        g.fillStyle(0xcdd3e0, 1)
        g.fillPoints(this.pts([8, 1, 11, 8, 11, 28, 5, 28, 5, 8]), true)
        g.fillStyle(0x00e0ff, 1)
        for (const ry of [8, 15, 22]) {
          g.fillCircle(8, ry, 1.4)
          g.fillRect(7.4, ry - 3, 1.2, 6)
        }
        g.lineStyle(1.4, 0x14171f, 1)
        g.strokePoints(this.pts([8, 1, 11, 8, 11, 28, 5, 28, 5, 8]), true)
        this.drawWeaponGuard(g)
        return true
      }
      case 'warscythe': { // long shaft + big curved reaper blade
        g.fillStyle(0x3a2418, 1)
        g.fillRect(7, 8, 2, 34)
        g.fillStyle(0x9198a6, 1)
        g.fillPoints(this.pts([8, 8, 15, 0, 16, 8, 12, 12, 9, 12]), true)
        g.fillStyle(0xc7ccd8, 1)
        g.fillPoints(this.pts([9, 8, 14, 3, 14.5, 7]), true)
        g.lineStyle(1.4, 0x14171f, 1)
        g.strokePoints(this.pts([8, 8, 15, 0, 16, 8, 12, 12, 9, 12]), true)
        return true
      }
      default:
        return false
    }
  }

  private drawSwordSkin(g: Phaser.GameObjects.Graphics, shape: string): void {
    if (this.drawSpecialWeapon(g, shape)) return
    const shapes: Record<string, number[]> = {
      straight: [8, 1, 11, 7, 11, 28, 5, 28, 5, 7],
      curved: [8, 1, 13, 10, 12, 22, 9, 28, 7, 28, 6, 14],
      broad: [8, 1, 12.5, 10, 12, 28, 4, 28, 3.5, 10],
      rapier: [8, 1, 9.4, 10, 9.2, 28, 6.8, 28, 6.6, 10],
      shard: [8, 0, 11.5, 15, 8, 29, 4.5, 15],
      cleaver: [5, 4, 12, 4, 12.5, 28, 4, 28],
      saber: [8, 1, 11.5, 11, 11, 24, 9.5, 28, 6.5, 28, 5, 12],
      glaive: [8, 1, 11.5, 8, 10.5, 17, 5.5, 17, 4.5, 8],
      fork: [5, 11, 11, 11, 10.4, 28, 5.6, 28],
      leaf: [8, 1, 11.6, 12, 10.4, 28, 5.6, 28, 4.4, 12],
      // Single-edged, gently back-curved (samurai).
      katana: [10, 1, 11.5, 6, 11, 27, 9, 29, 7, 29, 7.5, 6],
      nodachi: [10, 0, 11.5, 4, 11.2, 30, 9, 31, 6.5, 31, 7.2, 4],
      scimitar: [7, 1, 13, 9, 12.5, 19, 8.5, 29, 6, 28, 5.5, 11],
      greatsword: [8, 0, 11, 7, 11, 30, 5, 30, 5, 7],
      dagger: [8, 8, 10.6, 13, 10.2, 27, 5.8, 27, 5.4, 13],
      // Wavy kris blade.
      kris: [8, 1, 11, 6, 6.5, 11, 11, 16, 6.5, 21, 10.5, 27, 8, 29, 5.5, 27, 9.5, 21, 5, 16, 9.5, 11, 5, 6],
      // Curved sickle (khopesh) — hooks to one side.
      khopesh: [7, 2, 13, 8, 13.5, 16, 10, 22, 8, 22, 8, 12, 6.5, 6],
      flamberge: [8, 0, 11, 6, 6.5, 11, 11, 16, 6.5, 21, 11, 26, 8, 29, 5, 26, 9.5, 21, 5, 16, 9.5, 11, 5, 6],
      claymore: [8, 0, 11.5, 6, 11.5, 29, 4.5, 29, 4.5, 6],
      cutlass: [7, 2, 13, 10, 12, 22, 8, 29, 6, 28, 5.5, 11],
      estoc: [8, 1, 9, 10, 8.8, 29, 7.2, 29, 7, 10],
      crystal: [8, 0, 11.5, 10, 10, 20, 8, 29, 6, 20, 4.5, 10],
      bone: [8, 1, 10.5, 8, 9, 12, 11, 18, 8.5, 24, 9.5, 28, 6.5, 28, 7.5, 24, 5, 18, 7, 12, 5.5, 8],
      machete: [6, 6, 12, 10, 12.5, 26, 5, 28, 5, 10],
      falchion: [7, 2, 12.5, 9, 13, 20, 9, 29, 6, 28, 5.5, 10],
    }
    const roundGuard = shape === 'katana' || shape === 'nodachi' // tsuba
    const blade: number[] = shapes[shape] ?? shapes.leaf ?? []

    g.fillStyle(0xcdd3e0, 1)
    if (shape === 'trident') {
      // Three prongs on a shaft.
      for (const px of [5.2, 8, 10.8]) g.fillPoints(this.pts([px, 2, px + 1, 12, px - 1, 12]), true)
      g.fillRect(7, 11, 2, 18)
      g.fillRect(4.5, 11, 7, 2)
    } else if (shape === 'twin') {
      // Two slim parallel blades.
      g.fillPoints(this.pts([6, 1, 7.3, 10, 7, 28, 5, 28, 4.8, 10]), true)
      g.fillPoints(this.pts([10, 1, 11.2, 10, 11, 28, 9, 28, 8.7, 10]), true)
    } else if (shape === 'scythe') {
      // Straight shaft with a long hooked head.
      g.fillRect(7, 4, 2, 26)
      g.fillPoints(this.pts([8, 4, 1, 6, 3, 1, 8, 1]), true)
    } else {
      g.fillPoints(this.pts(blade), true)
      if (shape === 'glaive') {
        g.fillStyle(0x99a1b4, 1)
        g.fillRect(7, 17, 2, 11)
      } else if (shape === 'fork') {
        g.fillStyle(0xcdd3e0, 1)
        g.fillPoints(this.pts([6.5, 1, 7.6, 11, 5, 11]), true)
        g.fillPoints(this.pts([9.5, 1, 11, 11, 8.4, 11]), true)
      }
      // Dark outline for contrast on light maps.
      g.lineStyle(1.6, 0x14171f, 1)
      g.strokePoints(this.pts(blade), true)
    }

    // Guard / grip / pommel — round tsuba for the samurai blades, cross guard else.
    if (roundGuard) {
      g.fillStyle(0x3a2f22, 1)
      g.fillCircle(8, 30, 4) // tsuba
      g.fillStyle(0x1a1410, 1)
      g.fillRect(6.6, 32, 2.8, 11) // wrapped grip (longer)
      g.fillStyle(0x8a6a2a, 1)
      for (const gy of [34, 37, 40]) g.fillRect(6.6, gy, 2.8, 1) // wrap ties
    } else {
      g.fillStyle(0xffce5a, 1)
      g.fillPoints(this.pts([0, 29, 16, 29, 13.5, 33, 2.5, 33]), true)
      g.fillStyle(0x5c3b22, 1)
      g.fillRect(6.3, 33, 3.4, 9)
      g.fillStyle(0xffce5a, 1)
      g.fillCircle(8, 43, 2.3)
    }
  }

  /** Flatten a [x0,y0,x1,y1,...] list into Vector2 points for fillPoints. */
  private pts(flat: number[]): Phaser.Math.Vector2[] {
    const out: Phaser.Math.Vector2[] = []
    for (let i = 0; i < flat.length; i += 2) {
      out.push(new Phaser.Math.Vector2(flat[i] as number, flat[i + 1] as number))
    }
    return out
  }
}
