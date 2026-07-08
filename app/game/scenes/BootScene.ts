// =============================================================================
// BootScene — bakes all textures at runtime (no external image assets). Hero
// and enemies are drawn as multi-color, shaded vector creatures (horns, eyes
// with highlights, fangs, robe/hood) for a more detailed, articulated look.
// Swap these for real sprite sheets in the polish phase.
// =============================================================================
import Phaser from 'phaser'
import { AURA, MAP_TILE } from '../constants'

type Draw = (g: Phaser.GameObjects.Graphics) => void

/** Quick 0..max random for scattered background decoration. */
function rnd(max: number): number {
  return Math.random() * max
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
}

/** 10 distinct rival warlord looks (palette + horn style). */
const RIVAL_SKINS: WarlordSkin[] = [
  { armor: 0x2a2233, armorHi: 0x3a2f47, cape: 0x6e1616, helm: 0x14101c, horn: 'straight', hornColor: 0x14101c, eye: 0xff3b3b, accent: 0xff3b3b },
  { armor: 0x1e2a1c, armorHi: 0x2f4a2b, cape: 0x14401a, helm: 0x0e160c, horn: 'back', hornColor: 0x0e160c, eye: 0x8cff5a, accent: 0x8cff5a },
  { armor: 0x1c2740, armorHi: 0x2f4a6a, cape: 0x123a5a, helm: 0x0c1220, horn: 'crown', hornColor: 0x9fd8ff, eye: 0x5ad0ff, accent: 0x5ad0ff },
  { armor: 0x241a14, armorHi: 0x3a2a1c, cape: 0x5a2408, helm: 0x140d08, horn: 'wide', hornColor: 0x140d08, eye: 0xff8a00, accent: 0xff8a00 },
  { armor: 0x241033, armorHi: 0x3a1a52, cape: 0x3a0b5e, helm: 0x120620, horn: 'back', hornColor: 0x120620, eye: 0xd400ff, accent: 0xd400ff },
  { armor: 0xcfc7b0, armorHi: 0xe8e2d0, cape: 0x7a6f55, helm: 0xa89f86, horn: 'antler', hornColor: 0xe8e2d0, eye: 0x8fd0ff, accent: 0xffd700 },
  { armor: 0x14141a, armorHi: 0x24242e, cape: 0x0a0a0e, helm: 0x08080c, horn: 'none', hornColor: 0x08080c, eye: 0xffffff, accent: 0x9aa0aa },
  { armor: 0x2a2233, armorHi: 0x3a2f47, cape: 0x5a4410, helm: 0x14101c, horn: 'crown', hornColor: 0xffd700, eye: 0xffd700, accent: 0xffd700 },
  { armor: 0x14332f, armorHi: 0x1f5a52, cape: 0x0e4a42, helm: 0x0a201c, horn: 'straight', hornColor: 0x0a201c, eye: 0x2ee6c0, accent: 0x2ee6c0 },
  { armor: 0x2a0e0e, armorHi: 0x4a1414, cape: 0x7a0b0b, helm: 0x180606, horn: 'wide', hornColor: 0x180606, eye: 0xff1a1a, accent: 0xff1a1a },
  { armor: 0x1a2410, armorHi: 0x33471a, cape: 0x2a5a0e, helm: 0x0e1408, horn: 'spikes', hornColor: 0xaaff00, eye: 0xaaff00, accent: 0xaaff00 },
  { armor: 0x24303a, armorHi: 0x3a566a, cape: 0x2a4a5a, helm: 0x141c22, horn: 'ram', hornColor: 0xdff4ff, eye: 0xbfefff, accent: 0xdff4ff },
  { armor: 0x2a1408, armorHi: 0x4a2410, cape: 0x6e1e05, helm: 0x160a04, horn: 'single', hornColor: 0xff4500, eye: 0xffb300, accent: 0xff6a00 },
  { armor: 0x0e2a2a, armorHi: 0x1a4a4a, cape: 0x0a3a3a, helm: 0x061818, horn: 'trident', hornColor: 0x00e0d0, eye: 0x00e0d0, accent: 0x00e0d0 },
  { armor: 0x241033, armorHi: 0x3a1a52, cape: 0x2a0b4e, helm: 0x120620, horn: 'crown', hornColor: 0xffd700, eye: 0xffe14d, accent: 0xffd700 },
  { armor: 0x1a0a0a, armorHi: 0x3a1414, cape: 0x2a0606, helm: 0x0e0404, horn: 'back', hornColor: 0x0e0404, eye: 0xff2d2d, accent: 0xff2d2d },
  { armor: 0x0e2a1a, armorHi: 0x1a4a30, cape: 0x0a3a24, helm: 0x061810, horn: 'straight', hornColor: 0x2ee67a, eye: 0x2ee67a, accent: 0x2ee67a },
  { armor: 0x14141a, armorHi: 0x2a2a34, cape: 0x3a2e08, helm: 0x08080c, horn: 'single', hornColor: 0xffd700, eye: 0xffd700, accent: 0xffd700 },
  { armor: 0x14203a, armorHi: 0x24406a, cape: 0x0e2a5a, helm: 0x0a1120, horn: 'spikes', hornColor: 0x6ab0ff, eye: 0x9fd0ff, accent: 0x6ab0ff },
  { armor: 0x2a1424, armorHi: 0x4a2440, cape: 0x6e0b4a, helm: 0x160616, horn: 'wide', hornColor: 0xff5aa0, eye: 0xff5aa0, accent: 0xff5aa0 },
]

/** 10 distinct player sword silhouettes (tinted by tier in-game). */
const SWORD_SHAPES = [
  'leaf', 'straight', 'curved', 'broad', 'rapier', 'shard', 'cleaver', 'saber', 'glaive', 'fork',
] as const

interface TrooperSkin {
  skin: number
  armor: number
  armor2: number
  helm: number // 0 = none
  horns: boolean
  tuskBig: boolean
  eye: number
  weapon: string
}

/** Humanoid enemy troops (orcs/soldiers) by tier — drawn front-facing. */
const TROOPS = {
  easy: { skin: 0x8ccf5a, armor: 0x6a5a3a, armor2: 0x8a7a4a, helm: 0, horns: false, tuskBig: false, eye: 0x1c2a12, weapon: 'dagger' },
  med: { skin: 0x5faa4a, armor: 0x565b66, armor2: 0x7a808c, helm: 0, horns: false, tuskBig: false, eye: 0x14200f, weapon: 'sword' },
  hard: { skin: 0x4a8f3f, armor: 0x8a6a3a, armor2: 0xb08a4a, helm: 0x3a2f22, horns: false, tuskBig: true, eye: 0x14200f, weapon: 'axe' },
  elite: { skin: 0x3f7f3a, armor: 0x2a2f3a, armor2: 0x4a5060, helm: 0x1a1f28, horns: false, tuskBig: true, eye: 0xff4d4d, weapon: 'mace' },
  legend: { skin: 0x4a7f3a, armor: 0x241f28, armor2: 0x4a3f48, helm: 0x14101a, horns: true, tuskBig: true, eye: 0xffd700, weapon: 'spear' },
} satisfies Record<string, TrooperSkin>

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
}

/** 10 hero looks that escalate in grandeur (unlocked every 1000 power). */
const CHAMPION_SKINS: ChampionSkin[] = [
  { robe: 0x6b6f7a, robeHi: 0x8a8f9a, cape: 0x4a4e57, hood: 0x55585f, trim: 0x9aa0aa, skin: 0xf2c9a0, eye: 0x2a2a33, features: [] },
  { robe: 0x3a6ea5, robeHi: 0x5a94cf, cape: 0x2a527a, hood: 0x274b6a, trim: 0xcfe0f0, skin: 0xf2c9a0, eye: 0x1a2a40, features: [] },
  { robe: 0x8a8f9a, robeHi: 0xb8bcc6, cape: 0x4a4e57, hood: 0x6f7787, trim: 0xffd700, skin: 0xf2c9a0, eye: 0x1a1a22, features: ['pauldrons'] },
  { robe: 0x7c4dff, robeHi: 0x9d74ff, cape: 0x4a24b0, hood: 0x4a24b0, trim: 0xffb020, skin: 0xf2c9a0, eye: 0xd0b8ff, features: [] },
  { robe: 0x241033, robeHi: 0x3a1a52, cape: 0x3a0b5e, hood: 0x120620, trim: 0xd400ff, skin: 0xe8c9a0, eye: 0xd400ff, features: ['horns'] },
  { robe: 0xe8e2d0, robeHi: 0xffffff, cape: 0xb0a888, hood: 0xcfc7b0, trim: 0xffd700, skin: 0xf2c9a0, eye: 0x6ab0ff, features: ['crown'] },
  { robe: 0x2a1450, robeHi: 0x4a2480, cape: 0x1a0b3a, hood: 0x1a0b3a, trim: 0xff5aa0, skin: 0xe8c9a0, eye: 0xff5aa0, features: ['halo'] },
  { robe: 0x2a2233, robeHi: 0x3a2f47, cape: 0x5a4410, hood: 0x14101c, trim: 0xffd700, skin: 0xf2c9a0, eye: 0xffd700, features: ['crown', 'pauldrons'] },
  { robe: 0xeef2ff, robeHi: 0xffffff, cape: 0xcfe0f0, hood: 0xdfe8f5, trim: 0xffd700, skin: 0xf2c9a0, eye: 0x8fd0ff, features: ['wings', 'halo'], wing: 0xeef2ff },
  { robe: 0x3a2a08, robeHi: 0x6a4e10, cape: 0x7a5a10, hood: 0x241a06, trim: 0xffd700, skin: 0xf2c9a0, eye: 0xffe14d, features: ['wings', 'crown', 'halo'], wing: 0xffd700 },
  { robe: 0x1a3a4a, robeHi: 0x2a6a8a, cape: 0x0e2a3a, hood: 0x0a1a24, trim: 0x00e0ff, skin: 0xf2c9a0, eye: 0x00e0ff, features: ['pauldrons', 'crown'] },
  { robe: 0x3a1408, robeHi: 0x6a2810, cape: 0x7a2408, hood: 0x1a0a04, trim: 0xff6a00, skin: 0xe8c9a0, eye: 0xff8a00, features: ['horns', 'pauldrons'] },
  { robe: 0xcfe4ff, robeHi: 0xffffff, cape: 0x8ab0d0, hood: 0xa8c8e8, trim: 0x5ad0ff, skin: 0xf2c9a0, eye: 0x9fe0ff, features: ['crown', 'wings'], wing: 0xdff4ff },
  { robe: 0x120a1a, robeHi: 0x24142e, cape: 0x0a0610, hood: 0x08040c, trim: 0x9d5cff, skin: 0xd8c0a0, eye: 0xb794ff, features: ['horns', 'halo'] },
  { robe: 0xfff0c0, robeHi: 0xffffff, cape: 0xffd77a, hood: 0xffe6a0, trim: 0xffd700, skin: 0xf2c9a0, eye: 0xfff2a8, features: ['wings', 'halo'], wing: 0xfff0c0 },
  { robe: 0x2a0a0a, robeHi: 0x5a1414, cape: 0x7a0b0b, hood: 0x180404, trim: 0xff2d2d, skin: 0xe8b090, eye: 0xff2d2d, features: ['horns', 'crown', 'pauldrons'] },
  { robe: 0x0e3a24, robeHi: 0x1a6a44, cape: 0x0a4a2a, hood: 0x061a10, trim: 0x2ee67a, skin: 0xf2c9a0, eye: 0x8cff5a, features: ['crown', 'wings'], wing: 0xbfffdf },
  { robe: 0x1a0f3a, robeHi: 0x2a1a6a, cape: 0x120a2a, hood: 0x0a0620, trim: 0xff5aa0, skin: 0xe0c0a0, eye: 0xff5aa0, features: ['halo', 'wings'], wing: 0xffd0e8 },
  { robe: 0x2a2a34, robeHi: 0x4a4a5a, cape: 0x1a1a22, hood: 0x14141a, trim: 0xffd700, skin: 0xf2c9a0, eye: 0xffd700, features: ['horns', 'crown', 'pauldrons', 'halo'] },
  { robe: 0x4a3a08, robeHi: 0x8a6a10, cape: 0xffd700, hood: 0x2a2006, trim: 0xffe14d, skin: 0xf2c9a0, eye: 0xffffff, features: ['wings', 'crown', 'halo', 'pauldrons'], wing: 0xffe14d },
]

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    CHAMPION_SKINS.forEach((skin, i) => this.bake(`hero${i}`, 64, 64, (g) => this.drawChampion(g, skin)))
    RIVAL_SKINS.forEach((skin, i) => this.bake(`rivalHero${i}`, 56, 64, (g) => this.drawWarlord(g, skin)))
    this.bake('enemyEasy', 48, 48, (g) => this.drawTrooper(g, 48, TROOPS.easy))
    this.bake('enemyMed', 56, 56, (g) => this.drawTrooper(g, 56, TROOPS.med))
    this.bake('enemyHard', 56, 56, (g) => this.drawTrooper(g, 56, TROOPS.hard))
    this.bake('enemyElite', 60, 60, (g) => this.drawTrooper(g, 60, TROOPS.elite))
    this.bake('enemyLegend', 66, 66, (g) => this.drawTrooper(g, 66, TROOPS.legend))
    this.bake('boss', 76, 76, (g) => this.drawBoss(g))
    this.bake('heal', 30, 30, (g) => this.drawHeal(g))
    this.bake('wMace', 28, 56, (g) => this.drawMace(g))
    this.bake('wAxe', 28, 56, (g) => this.drawAxe(g))
    this.bake('wSpear', 28, 56, (g) => this.drawSpear(g))
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
    this.scene.start('BattleScene')
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
  private drawTrooper(g: Phaser.GameObjects.Graphics, S: number, p: TrooperSkin): void {
    g.scaleCanvas(S / 56, S / 56)
    // legs + boots
    g.fillStyle(p.armor2, 1)
    g.fillRect(20, 45, 6, 10)
    g.fillRect(30, 45, 6, 10)
    g.fillStyle(0x2a2620, 1)
    g.fillRect(20, 52, 6, 3)
    g.fillRect(30, 52, 6, 3)
    // weapon (behind the arm)
    this.drawTrooperWeapon(g, p.weapon)
    // torso
    g.fillStyle(p.armor, 1)
    g.fillRoundedRect(15, 27, 26, 21, 5)
    g.fillStyle(p.armor2, 1)
    g.fillRect(25, 27, 6, 21)
    g.fillCircle(16, 29, 5)
    g.fillCircle(40, 29, 5)
    // arms (fists)
    g.fillStyle(p.skin, 1)
    g.fillCircle(13, 34, 3.5)
    g.fillCircle(43, 34, 3.5)
    // head + pointy ears
    g.fillStyle(p.skin, 1)
    g.fillEllipse(28, 16, 22, 20)
    g.fillTriangle(9, 16, 18, 11, 18, 21)
    g.fillTriangle(47, 16, 38, 11, 38, 21)
    // angry brow
    g.fillStyle(0x203818, 1)
    g.fillTriangle(19, 12, 27, 17, 27, 12)
    g.fillTriangle(37, 12, 29, 17, 29, 12)
    // eyes
    g.fillStyle(p.eye, 1)
    g.fillEllipse(23, 16, 5, 4)
    g.fillEllipse(33, 16, 5, 4)
    // tusks
    g.fillStyle(0xf4f0e0, 1)
    const th = p.tuskBig ? 6 : 4
    g.fillTriangle(24, 22, 27, 22, 25.5, 22 - th)
    g.fillTriangle(29, 22, 32, 22, 30.5, 22 - th)
    // helmet + horns
    if (p.helm) {
      g.fillStyle(p.helm, 1)
      g.fillEllipse(28, 9, 26, 12)
      g.fillRect(15, 8, 26, 3)
    }
    if (p.horns) {
      g.fillStyle(0xe8e2d0, 1)
      g.fillTriangle(14, 8, 5, 0, 20, 7)
      g.fillTriangle(42, 8, 51, 0, 36, 7)
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
    }
  }

  private drawBoss(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x1a0d0d, 1) // horns
    g.fillTriangle(18, 24, 2, 0, 28, 20)
    g.fillTriangle(58, 24, 74, 0, 48, 20)
    g.fillStyle(0x2a0f0f, 1) // crown spikes
    for (const x of [24, 32, 38, 44, 52]) g.fillTriangle(x - 4, 18, x, 4, x + 4, 18)
    g.fillStyle(0x3a1414, 1) // head
    g.fillEllipse(38, 40, 56, 52)
    g.fillStyle(0x2a0e0e, 1) // snout
    g.fillEllipse(38, 54, 34, 24)
    g.fillStyle(0x140707, 1) // brows
    g.fillTriangle(16, 32, 36, 42, 36, 28)
    g.fillTriangle(60, 32, 40, 42, 40, 28)
    g.fillStyle(0xff3b1a, 1) // glowing eyes
    g.fillEllipse(27, 36, 12, 9)
    g.fillEllipse(49, 36, 12, 9)
    g.fillStyle(0x1a0500, 1)
    g.fillCircle(27, 37, 3)
    g.fillCircle(49, 37, 3)
    g.fillStyle(0xffd08a, 0.9)
    g.fillCircle(26, 35, 1.4)
    g.fillCircle(48, 35, 1.4)
    g.fillStyle(0x140707, 1) // nostrils
    g.fillCircle(33, 50, 2)
    g.fillCircle(43, 50, 2)
    g.fillStyle(0xffffff, 1) // fangs
    for (let i = 0; i < 6; i++) g.fillTriangle(26 + i * 5, 62, 28 + i * 5, 62, 27 + i * 5, 70)
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
    g.fillStyle(s.cape, 1)
    g.fillPoints(this.pts([14, 26, 42, 26, 48, 60, 8, 60]), true)
    g.fillStyle(s.armor, 1)
    g.fillPoints(this.pts([18, 32, 38, 32, 44, 62, 12, 62]), true)
    g.fillStyle(s.armorHi, 0.9)
    g.fillPoints(this.pts([24, 34, 32, 34, 35, 62, 21, 62]), true)
    g.fillStyle(s.accent, 1) // shoulder spikes
    g.fillTriangle(10, 34, 18, 26, 20, 37)
    g.fillTriangle(46, 34, 38, 26, 36, 37)
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
    g.fillCircle(28, 42, 3)
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

  private drawChampion(g: Phaser.GameObjects.Graphics, s: ChampionSkin): void {
    const has = (f: string) => s.features.includes(f)

    if (has('wings')) {
      g.fillStyle(s.wing ?? 0xeef2ff, 1)
      g.fillPoints(this.pts([18, 30, 2, 22, 6, 42, 16, 46]), true)
      g.fillPoints(this.pts([46, 30, 62, 22, 58, 42, 48, 46]), true)
    }
    g.fillStyle(s.cape, 1)
    g.fillPoints(this.pts([20, 26, 44, 26, 50, 60, 14, 60]), true)
    g.fillStyle(s.robe, 1)
    g.fillPoints(this.pts([22, 32, 42, 32, 48, 62, 16, 62]), true)
    g.fillStyle(s.robeHi, 0.9)
    g.fillPoints(this.pts([29, 34, 35, 34, 38, 62, 26, 62]), true)
    g.fillStyle(s.trim, 1) // belt
    g.fillRect(19, 48, 26, 4)
    const pad = has('pauldrons') ? 7 : 5 // shoulders
    g.fillStyle(s.trim, 1)
    g.fillCircle(20, 33, pad)
    g.fillCircle(44, 33, pad)
    g.fillStyle(s.hood, 1) // hood back
    g.fillEllipse(32, 20, 32, 28)
    if (has('horns')) {
      g.fillStyle(s.trim, 1)
      g.fillTriangle(18, 16, 11, 1, 25, 14)
      g.fillTriangle(46, 16, 53, 1, 39, 14)
    }
    g.fillStyle(s.skin, 1) // face
    g.fillEllipse(32, 23, 20, 20)
    g.fillStyle(s.hood, 1) // hood sides
    g.fillEllipse(19, 19, 9, 22)
    g.fillEllipse(45, 19, 9, 22)
    g.fillStyle(s.eye, 1) // eyes
    g.fillCircle(27, 24, 2)
    g.fillCircle(37, 24, 2)
    if (has('crown')) {
      g.fillStyle(s.trim, 1)
      for (const x of [24, 28, 32, 36, 40]) g.fillTriangle(x - 2.5, 9, x, 2, x + 2.5, 9)
    }
    if (has('halo')) {
      g.lineStyle(2, s.trim, 1)
      g.strokeEllipse(32, 7, 24, 8)
    }
    g.fillStyle(s.trim, 1) // chest emblem
    g.fillCircle(32, 42, 3)
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
  private drawSwordSkin(g: Phaser.GameObjects.Graphics, shape: string): void {
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
    }
    const blade: number[] = shapes[shape] ?? shapes.leaf ?? []

    g.fillStyle(0xcdd3e0, 1)
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

    // Shared guard / grip / pommel.
    g.fillStyle(0xffce5a, 1)
    g.fillPoints(this.pts([0, 29, 16, 29, 13.5, 33, 2.5, 33]), true)
    g.fillStyle(0x5c3b22, 1)
    g.fillRect(6.3, 33, 3.4, 9)
    g.fillStyle(0xffce5a, 1)
    g.fillCircle(8, 43, 2.3)
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
