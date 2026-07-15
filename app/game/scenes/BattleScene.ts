// =============================================================================
// BattleScene — the gameplay loop. It delegates ALL rules to services
// (PowerService / SpawnService / ScoreService) and only handles rendering,
// input, pooling and collision wiring. State crosses to the Vue HUD via the
// shared EventBus.
//
// The arena fills the viewport: world size is read live from the Scale Manager
// and kept in sync on 'resize'. The hero roams freely in 2D; enemies enter
// from any edge and home in. The weapon is a RING OF SWORDS that orbits the
// hero (it does not fire) — the sword count grows with power (+1 every 50).
// =============================================================================
import Phaser from 'phaser'
import { AURA, BOSS, BOSS_ATTACK, BOSS_RUSH, COMBO, DECOR_COUNT, DIVINE_SKILLS, ELITE, ENEMY, GATE, GEAR, HEAL, HERO, HERO_RARITIES, LEVEL, MAPS, MEGA_AURA, MINIMAP, NPC, OBSTACLE, PLAYER, POWER_LAYERS, RIVAL, SKILLS, STATUS, SWORD, SWORD_SHAPES, UPGRADE_TUNE, WORLD, gearOf, heroRarity, weaponEffect, weaponName } from '../constants'
import { UpgradeService } from '~/services/UpgradeService'
import { metaService } from '~/services/MetaService'
import { COINS_PER_SCORE, CHEST, HITSTOP_MS } from '../constants'
import { Chest } from '../entities/Chest'
import { Boss } from '../entities/Boss'
import { Enemy } from '../entities/Enemy'
import { Gate } from '../entities/Gate'
import { Heal } from '../entities/Heal'
import { NpcHero } from '../entities/NpcHero'
import { Player } from '../entities/Player'
import { Rival } from '../entities/Rival'
import { Sword } from '../entities/Sword'
import { PowerService } from '~/services/PowerService'
import { ScoreService } from '~/services/ScoreService'
import { SpawnService } from '~/services/SpawnService'
import { gameEventBus } from '~/services/EventBus'
import { audioService } from '~/services/AudioService'
import { codexService } from '~/services/CodexService'
import { achievementService } from '~/services/AchievementService'
import { loadoutService } from '~/services/LoadoutService'
import type { RunStats } from '~/types/game'
import { angleBetween, clamp, distance, pickOne, randomInt, randomRange } from '~/helpers/math.helper'
import { formatCompact } from '~/helpers/format.helper'

const OFFSCREEN_MARGIN = 60
const TAU = Math.PI * 2

export class BattleScene extends Phaser.Scene {
  private player!: Player
  private bg!: Phaser.GameObjects.TileSprite
  private vignette!: Phaser.GameObjects.Image
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter
  private minimap!: Phaser.GameObjects.Graphics
  private bossArrow!: Phaser.GameObjects.Graphics
  private decor: { img: Phaser.GameObjects.Image; nx: number; ny: number }[] = []
  private auraLayers: Phaser.GameObjects.Image[] = []
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private enemies!: Phaser.Physics.Arcade.Group
  private gatePool: Gate[] = []
  private swordPool: Sword[] = []
  private rivalPool: Rival[] = []
  private healPool: Heal[] = []
  private boss!: Boss
  private bossWeapons: Phaser.GameObjects.Image[] = []
  private bossLabel!: Phaser.GameObjects.Text
  private bossAura!: Phaser.GameObjects.Image
  private bossAngle = 0
  private bossClashAcc = 0

  private readonly power = new PowerService()
  private readonly spawner = new SpawnService()
  private readonly scorer = new ScoreService()
  private readonly upgrades = new UpgradeService()
  private xp = 0
  private level = 1
  private leveling = false
  private playerInvulnUntil = 0
  private metaDamageMul = 1
  private metaMoveMul = 1
  private metaOrbitMul = 1
  private metaCrit = 0
  private metaXpMul = 1
  private metaLifesteal = 0
  private metaBossMul = 1
  private metaLuck = 0
  private metaHealMul = 1
  private metaStatusMul = 1
  private metaRegen = 0
  private metaMagnet = 0
  private metaDefenseBase = 1
  private revivesLeft = 0
  private regenAcc = 0
  private playerDefenseMul = 1
  private dashUntil = 0
  private hitStopUntil = 0
  private frameTime = 0
  private ringBlur!: Phaser.GameObjects.Graphics
  private chestPool: Chest[] = []
  private popupPool: Phaser.GameObjects.Text[] = []
  private dmgPool: Phaser.GameObjects.Text[] = []

  private elapsedMs = 0
  private orbitAngle = 0
  private lastHitSoundAt = 0
  private enemyAcc = 0
  private gateAcc = 0
  private rivalAcc = 0
  private nextRivalMs: number = RIVAL.minIntervalMs
  private furyUntil = 0
  private swordDamageMul = 1
  private playerSkin = -1
  private heroRarityIdx = -1
  private lastEvolveAt = 0
  private heroFloor = 0 // chosen loadout hero — the run starts at (and never drops below) this tier
  private heroPopUntil = 0 // while a scale tween runs, skip the breathing pulse
  private divineSkill = -1 // active Divine ultimate index (-1 = none)
  private heroScale: number = HERO.minScale
  private heroAura!: Phaser.GameObjects.Image
  private heroAuraColor = 0
  private healAcc = 0
  private bossAcc = 0
  private nextBossMs: number = BOSS.firstMs
  private bossActive = false
  private bossCount = 0
  private bossSkinIdx = 0
  private bossFanAcc = 0
  private bossMeteorAcc = 0
  private bossOrbs: { img: Phaser.GameObjects.Image; vx: number; vy: number }[] = []
  // ---- Boss Rush (endgame) ----
  private bossRush = false
  private escorts: Boss[] = []
  private escortLabels: Phaser.GameObjects.Text[] = []
  private rushWave = 0
  private rushGapUntil = 0
  private npcs: NpcHero[] = []
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  // Live ranking + run stats.
  private rankAcc = 0
  private curRank = 1
  private curTotal = 1
  private statKills = 0
  private statBosses = 0
  private statTopCombo = 0
  private statNpcAbsorbed = 0
  private statBestRank = 99
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private paused = false
  private swordTintable = true
  private weaponEffect = 'crit'
  // Floating virtual joystick (touch/drag): origin set on press, vector from drag.
  private joyActive = false
  private joyOriginX = 0
  private joyOriginY = 0
  private joyVecX = 0
  private joyVecY = 0
  private joystick!: Phaser.GameObjects.Graphics
  private bossSummonAcc = 0
  private bossGateAcc = 0
  private comboCount = 0
  private comboUntil = 0
  private readonly skillReadyAt: Record<string, number> = { fury: 0, nova: 0 }
  private isOver = false

  constructor() {
    super('BattleScene')
  }

  /** The full scrollable world (much larger than the screen). */
  private get worldW(): number {
    return WORLD.width
  }

  private get worldH(): number {
    return WORLD.height
  }

  /** The visible viewport (screen) size — for pinned UI and edge spawning. */
  private get viewW(): number {
    return this.scale.width
  }

  private get viewH(): number {
    return this.scale.height
  }

  create(): void {
    this.isOver = false
    this.elapsedMs = 0
    this.orbitAngle = 0
    this.lastHitSoundAt = 0
    this.enemyAcc = 0
    this.gateAcc = 0
    this.rivalAcc = 0
    this.scheduleNextRival()
    this.furyUntil = 0
    this.swordDamageMul = 1
    this.playerSkin = -1
    this.heroRarityIdx = -1
    this.lastEvolveAt = 0
    this.healAcc = 0
    this.bossAcc = 0
    this.nextBossMs = BOSS.firstMs
    this.bossActive = false
    this.bossCount = 0
    this.bossRush = false
    this.rushWave = 0
    this.rushGapUntil = 0
    this.rankAcc = 0
    this.curRank = 1
    this.curTotal = 1
    this.statKills = 0
    this.statBosses = 0
    this.statTopCombo = 0
    this.statNpcAbsorbed = 0
    this.statBestRank = 99
    this.bossSummonAcc = 0
    this.bossGateAcc = 0
    this.comboCount = 0
    this.comboUntil = 0
    this.skillReadyAt.fury = 0
    this.skillReadyAt.nova = 0
    this.skillReadyAt.dash = 0
    this.skillReadyAt.divine = 0
    this.divineSkill = -1
    this.power.reset()
    this.scorer.reset()
    this.upgrades.reset()
    this.xp = 0
    this.level = 1
    this.leveling = false
    this.playerInvulnUntil = 0
    this.playerDefenseMul = 1
    this.dashUntil = 0
    this.hitStopUntil = 0
    // Chosen loadout hero (if unlocked): the run starts as it, then evolves up.
    loadoutService.load()
    codexService.load()
    const chosen = loadoutService.selectedHero
    this.heroFloor = chosen >= 0 && chosen < HERO.skins && codexService.has('hero', chosen) ? chosen : 0
    // Apply persistent meta-upgrades bought in the shop.
    metaService.load()
    this.metaDamageMul = metaService.damageMul
    this.metaMoveMul = metaService.moveSpeedMul
    this.metaOrbitMul = metaService.orbitSpeedMul
    this.metaCrit = metaService.critChance
    this.metaXpMul = metaService.xpMul
    this.metaLifesteal = metaService.startLifesteal
    this.metaBossMul = metaService.bossDamageMul
    this.metaLuck = metaService.luck
    this.metaHealMul = metaService.healMul
    this.metaStatusMul = metaService.statusMul
    this.metaRegen = metaService.regenPerSec
    this.metaMagnet = metaService.magnetRange
    this.metaDefenseBase = metaService.defenseMul
    this.playerDefenseMul = this.metaDefenseBase
    this.revivesLeft = metaService.reviveCount
    this.regenAcc = 0
    if (metaService.startPower > 0) this.power.addEnemyValue(metaService.startPower)
    this.physics.resume()

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH)

    // Random themed ground, tiled and PINNED to the camera; its tile offset
    // tracks the camera scroll (see update) so the terrain slides past as the
    // hero roams the open world.
    const map = MAPS[randomInt(0, MAPS.length - 1)] ?? MAPS[0]
    this.bg = this.add
      .tileSprite(0, 0, this.viewW, this.viewH, map.key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10)
    // Scatter decoration props across the WHOLE world; each sways gently so the
    // scenery feels alive rather than static.
    this.decor = Array.from({ length: DECOR_COUNT }, () => {
      const img = this.add
        .image(0, 0, pickOne(map.props))
        .setDepth(-9)
        .setScale(0.7 + Math.random() * 1.1)
        .setAlpha(0.94)
      if (Math.random() < 0.5) img.setFlipX(true)
      this.tweens.add({
        targets: img,
        angle: { from: -2.5, to: 2.5 },
        duration: 1800 + Math.random() * 1600,
        delay: Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
      return { img, nx: Math.random(), ny: Math.random() }
    })
    this.positionDecor()
    this.spawnAmbient(map.ambient)
    // Vignette framing, pinned to the screen.
    this.vignette = this.add
      .image(0, 0, 'vignette')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-8)
      .setDisplaySize(this.viewW, this.viewH)
    const mapLabel = this.add
      .text(this.viewW / 2, 72, map.name, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
    mapLabel.setStroke('#000000', 4)
    this.tweens.add({
      targets: mapLabel,
      alpha: { from: 1, to: 0 },
      y: 54,
      delay: 1400,
      duration: 900,
      onComplete: () => mapLabel.destroy(),
    })

    // One additive glow per potential aura layer (base tiers + mega rings).
    this.auraLayers = Array.from({ length: POWER_LAYERS.length + MEGA_AURA.max }, () =>
      this.add
        .image(this.worldW / 2, this.worldH / 2, 'aura')
        .setDepth(-1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false),
    )

    this.player = new Player(this, this.worldW / 2, this.worldH / 2)
    if (metaService.bonusMaxHp > 0) this.player.addMaxHp(metaService.bonusMaxHp)
    // Open-world camera: bound to the world, smoothly following the hero.
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH)
    this.cameras.main.startFollow(this.player, true, WORLD.cameraLerp, WORLD.cameraLerp)
    // Screen-pinned minimap, redrawn each frame in drawMinimap().
    this.minimap = this.add.graphics().setScrollFactor(0).setDepth(24)
    // Screen-pinned arrow pointing to an off-screen boss.
    this.bossArrow = this.add.graphics().setScrollFactor(0).setDepth(23)
    // Radiant aura under the hero; color + size grow with tier (see checkEvolve).
    this.heroAura = this.add
      .image(this.player.x, this.player.y, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-2)
      .setVisible(false)

    this.enemies = this.physics.add.group({ classType: Enemy, defaultKey: 'troop0', maxSize: ENEMY.poolSize })

    // Scattered solid obstacles the hero (and enemies) must navigate around.
    this.obstacles = this.physics.add.staticGroup()
    const cx0 = this.worldW / 2
    const cy0 = this.worldH / 2
    for (let i = 0; i < OBSTACLE.count; i++) {
      let ox = 0
      let oy = 0
      for (let tries = 0; tries < 12; tries++) {
        ox = randomRange(140, this.worldW - 140)
        oy = randomRange(140, this.worldH - 140)
        if (distance(ox, oy, cx0, cy0) >= OBSTACLE.minFromCenter) break
      }
      const o = this.obstacles.create(ox, oy, `obs${randomInt(0, OBSTACLE.variants - 1)}`) as Phaser.Physics.Arcade.Sprite
      o.setDepth(-8)
      const body = o.body as Phaser.Physics.Arcade.StaticBody
      body.setCircle(24, o.width / 2 - 24, o.height / 2 - 22)
    }
    this.physics.add.collider(this.player, this.obstacles)
    this.physics.add.collider(this.enemies, this.obstacles)
    this.gatePool = Array.from({ length: GATE.poolSize }, () => new Gate(this, 0, 0))
    this.swordPool = Array.from({ length: SWORD.poolSize }, () => new Sword(this, 0, 0))
    // Pick one of the 10 blade skins for this run.
    const swordSkin = Math.floor(Math.random() * SWORD_SHAPES.length)
    this.swordPool.forEach((sword) => sword.setTexture(`sword${swordSkin}`))
    // Effect weapons keep their baked colors; plain blades take the power gradient.
    const SPECIAL_BLADES = ['energy', 'holy', 'chakram', 'sawblade', 'demon', 'runic', 'warscythe']
    this.swordTintable = !SPECIAL_BLADES.includes(SWORD_SHAPES[swordSkin] as string)
    this.weaponEffect = weaponEffect(swordSkin) // this run's signature on-hit effect
    gameEventBus.emit('weapon:set', { name: weaponName(swordSkin), effect: this.weaponEffect })
    codexService.load()
    codexService.mark('weapon', swordSkin)
    codexService.mark('hero', 0)
    this.rivalPool = Array.from({ length: RIVAL.poolSize }, () => new Rival(this, 0, 0))
    this.healPool = Array.from({ length: 6 }, () => new Heal(this, 0, 0))
    this.chestPool = Array.from({ length: CHEST.poolSize }, () => new Chest(this, 0, 0))
    this.ringBlur = this.add.graphics().setDepth(0).setBlendMode(Phaser.BlendModes.ADD)
    this.boss = new Boss(this, 0, 0)
    this.bossWeapons = Array.from({ length: 3 }, () =>
      this.add.image(0, 0, 'wMace').setDepth(1).setVisible(false),
    )
    this.bossLabel = this.add
      .text(0, 0, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false)
    this.bossLabel.setStroke('#3a0808', 5)
    this.bossAura = this.add
      .image(0, 0, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff3020)
      .setDepth(-1)
      .setVisible(false)
    // Pooled boss fireballs (fan attack).
    this.bossOrbs = Array.from({ length: BOSS_ATTACK.projectilePool }, () => ({
      img: this.add.image(0, 0, 'bossOrb').setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setActive(false).setVisible(false),
      vx: 0,
      vy: 0,
    }))
    // AI survivors roaming the world.
    this.npcs = Array.from({ length: NPC.count }, () => new NpcHero(this))
    this.npcs.forEach((npc, i) => {
      const x = randomRange(200, this.worldW - 200)
      const y = randomRange(200, this.worldH - 200)
      npc.spawn(x, y, this.npcSpawnPower(), NPC.colors[i % NPC.colors.length] as number)
    })

    // Pooled floating reward popups shown on kills.
    this.popupPool = Array.from({ length: 24 }, () =>
      this.add
        .text(0, 0, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffe14d' })
        .setOrigin(0.5)
        .setDepth(15)
        .setStroke('#2a1e00', 4)
        .setActive(false)
        .setVisible(false),
    )
    // Floating damage numbers on hits.
    this.dmgPool = Array.from({ length: 30 }, () =>
      this.add
        .text(0, 0, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(14)
        .setStroke('#000000', 3)
        .setActive(false)
        .setVisible(false),
    )

    // Reusable spark burst for clashes / deaths.
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 80, max: 260 },
        lifespan: { min: 240, max: 520 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(5)

    this.physics.add.overlap(this.swordPool, this.enemies, this.onSwordHitEnemy)
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyHitPlayer)
    this.physics.add.overlap(this.swordPool, this.boss, this.onSwordHitBoss)
    this.physics.add.overlap(this.player, this.boss, this.onBossHitPlayer)

    // Boss Rush escort pool: extra bosses that swarm alongside the lead boss.
    this.escorts = Array.from({ length: BOSS_RUSH.maxWaveSize - 1 }, () => new Boss(this, 0, 0))
    this.escortLabels = this.escorts.map(() =>
      this.add
        .text(0, 0, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffdede' })
        .setOrigin(0.5)
        .setDepth(20)
        .setStroke('#3a0808', 4)
        .setVisible(false),
    )
    for (const escort of this.escorts) {
      this.physics.add.overlap(this.swordPool, escort, this.onSwordHitEscort)
      this.physics.add.overlap(this.player, escort, this.onEscortHitPlayer)
    }

    this.joystick = this.add.graphics().setScrollFactor(0).setDepth(22)
    this.input.on('pointerdown', this.onPointerDown)
    this.input.on('pointermove', this.onPointerMove)
    this.input.on('pointerup', this.onPointerUp)
    this.input.on('pointerupoutside', this.onPointerUp)
    // Unlock audio on the FIRST user gesture of any kind — pointer OR keyboard —
    // so sound works even when reloading straight onto /play and moving via WASD.
    const unlockAudio = (): void => audioService.unlock()
    this.input.once('pointerdown', unlockAudio)
    // WASD / arrow-key movement (desktop) in addition to touch/drag.
    const kb = this.input.keyboard
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>
      kb.once('keydown', unlockAudio)
    }
    this.scale.on('resize', this.onResize)
    gameEventBus.on('game:restart', this.onRestart)
    gameEventBus.on('game:pause', this.onPause)
    gameEventBus.on('game:resume', this.onResume)
    gameEventBus.on('skill:use', this.onSkill)
    gameEventBus.on('levelup:pick', this.onLevelPick)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown)

    this.emitPower()
    this.emitHp()
    this.emitScore()
    gameEventBus.emit('game:ready', undefined)
    gameEventBus.emit('skill:reset', undefined)
    gameEventBus.emit('boss:end', undefined)
    this.emitCombo()
    this.emitXp()
  }

  override update(time: number, deltaMs: number): void {
    if (this.isOver || this.paused) return
    this.frameTime = time
    if (time < this.hitStopUntil) return // brief freeze for impact
    this.elapsedMs += deltaMs
    const elapsedSec = this.elapsedMs / 1000

    const dashing = this.elapsedMs < this.dashUntil
    const speedMul = (dashing ? SKILLS.dash.speedMul : 1) * this.metaMoveMul
    const bounds = { width: this.worldW, height: this.worldH }
    // Passive HP regeneration (meta upgrade).
    if (this.metaRegen > 0 && this.player.hp < this.player.maxHp) {
      this.regenAcc += this.metaRegen * (deltaMs / 1000)
      if (this.regenAcc >= 1) {
        const whole = Math.floor(this.regenAcc)
        this.regenAcc -= whole
        this.player.heal(whole)
        this.emitHp()
      }
    }
    const kb = this.readKeyboard()
    if (kb.x !== 0 || kb.y !== 0) {
      this.player.moveByVector(deltaMs, bounds, kb.x, kb.y, speedMul)
    } else if (this.joyActive && (this.joyVecX !== 0 || this.joyVecY !== 0)) {
      this.player.moveByVector(deltaMs, bounds, this.joyVecX, this.joyVecY, speedMul)
    }
    this.drawJoystick()
    // Ground scrolls 1:1 with the camera so the terrain appears fixed in the
    // world — you're traversing it, not sliding on top of it.
    const cam = this.cameras.main
    this.bg.tilePositionX = cam.scrollX
    this.bg.tilePositionY = cam.scrollY

    // During Boss Rush the normal horde & rivals stop — only bosses come. Gates
    // and hearts keep flowing so you can still power up mid-fight.
    if (!this.bossRush) {
      this.enemyAcc += deltaMs
      if (this.enemyAcc >= this.spawner.enemyInterval(elapsedSec)) {
        this.enemyAcc = 0
        this.spawnEnemy(elapsedSec)
      }

      this.rivalAcc += deltaMs
      if (this.rivalAcc >= this.nextRivalMs) {
        this.rivalAcc = 0
        this.scheduleNextRival()
        this.spawnRival(elapsedSec)
      }
    }

    this.gateAcc += deltaMs
    if (this.gateAcc >= this.spawner.gateInterval()) {
      this.gateAcc = 0
      this.spawnGate()
    }

    this.healAcc += deltaMs
    if (this.healAcc >= HEAL.intervalMs) {
      this.healAcc = 0
      this.spawnHeal()
    }

    if (this.bossRush) {
      this.updateBossRush(deltaMs, elapsedSec)
    } else if (this.bossActive) {
      this.updateBoss(deltaMs, elapsedSec)
    } else {
      this.bossAcc += deltaMs
      if (this.bossAcc >= this.nextBossMs) {
        this.bossAcc = 0
        this.nextBossMs = BOSS.intervalMs
        this.spawnBoss(elapsedSec)
      }
    }

    if (this.comboCount > 0 && this.elapsedMs > this.comboUntil) this.resetCombo()

    this.updateEnemies(deltaMs)
    this.updateGates(deltaMs)
    this.updateRivals(deltaMs)
    this.updateHeals(deltaMs)
    this.updateChests()
    this.updateSwords(deltaMs)
    this.checkEvolve()
    // Idle "breathing": a subtle scale + bob pulse so the hero never looks stiff.
    if (this.elapsedMs > this.heroPopUntil) {
      const t = this.elapsedMs
      const breathe = 1 + Math.sin(t / 460) * 0.04
      this.player.setScale(this.heroScale * breathe, this.heroScale * (breathe + 0.015 * Math.sin(t / 230)))
    }
    this.updateHeroAura()
    this.updateNpcs(deltaMs)
    this.updateRanking(deltaMs)
    this.drawMinimap()
  }

  /** Live .io-style ranking: you vs the surviving NPCs, by power. */
  private updateRanking(deltaMs: number): void {
    this.rankAcc += deltaMs
    if (this.rankAcc < 350) return
    this.rankAcc = 0
    let above = 0
    let total = 1
    for (const npc of this.npcs) {
      if (!npc.active) continue
      total++
      if (npc.power > this.power.power) above++
    }
    const rank = above + 1
    this.statBestRank = Math.min(this.statBestRank, rank)
    if (rank !== this.curRank || total !== this.curTotal) {
      this.curRank = rank
      this.curTotal = total
      gameEventBus.emit('rank:changed', { rank, total })
    }
  }

  // ---- AI survivors -------------------------------------------------------

  /** Seed an NPC's power relative to the player's, so rivals stay competitive
   *  (not a flat 100 while you're at billions). Varied so some are stronger. */
  private npcSpawnPower(): number {
    return Math.max(10, Math.round(this.power.power * randomRange(0.2, 1.2)))
  }

  private updateNpcs(deltaMs: number): void {
    for (const npc of this.npcs) {
      if (!npc.active) {
        if (npc.respawnAt && this.elapsedMs >= npc.respawnAt) {
          const { x, y } = this.randomEdgePoint()
          npc.spawn(x, y, this.npcSpawnPower(), npc.ringColor)
        }
        continue
      }
      // Decide where to go, then move toward it.
      const goal = this.npcPickTarget(npc)
      const ang = angleBetween(npc.x, npc.y, goal.x, goal.y)
      const step = NPC.speed * (deltaMs / 1000)
      if (distance(npc.x, npc.y, goal.x, goal.y) > step) {
        npc.x = clamp(npc.x + Math.cos(ang) * step, 0, this.worldW)
        npc.y = clamp(npc.y + Math.sin(ang) * step, 0, this.worldH)
      }
      npc.spin(deltaMs)
      npc.hitAcc += deltaMs
      if (npc.hitAcc >= NPC.hitTickMs) {
        npc.hitAcc -= NPC.hitTickMs
        this.npcCombat(npc)
      }
      this.npcPickups(npc)
      this.npcDuel(npc, deltaMs)
    }
  }

  /** When an NPC and the hero's rings meet they clash: your ring shreds it (and
   *  you ABSORB its power on the kill), while it strikes back at you. */
  private npcDuel(npc: NpcHero, deltaMs: number): void {
    const d = distance(npc.x, npc.y, this.player.x, this.player.y)
    // Nothing happens until at least one ring's blades reach the other's body.
    const playerReach = SWORD.orbitRadius * (0.85 + this.heroScale * 0.35) + 16 // your (grown) ring reaches the NPC
    const npcReach = NPC.ringRadius + 16 // its blades touch YOU
    if (d >= Math.max(playerReach, npcReach)) {
      npc.duelAcc = 0
      return
    }
    npc.duelAcc += deltaMs
    if (npc.duelAcc < BOSS.hitTickMs) return
    npc.duelAcc -= BOSS.hitTickMs
    const ang = angleBetween(this.player.x, this.player.y, npc.x, npc.y)
    const canWin = this.power.power >= npc.power

    // Your ring shreds the NPC only when your blades reach its body.
    if (d < playerReach && canWin) {
      npc.hp -= this.bossTickDamage()
      const ex = this.player.x + Math.cos(ang) * SWORD.orbitRadius
      const ey = this.player.y + Math.sin(ang) * SWORD.orbitRadius
      this.clashBurst(ex, ey, 0xffe08a)
      audioService.clash()
      if (npc.hp <= 0) {
        this.absorbNpc(npc)
        return
      }
    }

    // The NPC hits YOU only when ITS blades actually reach your character.
    if (d < npcReach) {
      const hx = this.player.x + Math.cos(ang) * (npcReach - 10)
      const hy = this.player.y + Math.sin(ang) * (npcReach - 10)
      this.clashBurst(hx, hy, canWin ? 0xffe08a : 0xff4040)
      audioService.clash()
      if (canWin) {
        this.hitPlayer(Math.min(10, 4 + Math.log10(1 + npc.power)))
      } else {
        // A stronger NPC hurts you but doesn't instant-kill: modest i-frame-gated
        // damage + a knockback that breaks contact so you can flee.
        this.hitPlayer(Math.min(16, 8 + Math.log10(1 + npc.power)))
        this.player.setPosition(
          clamp(this.player.x - Math.cos(ang) * 120, 0, this.worldW),
          clamp(this.player.y - Math.sin(ang) * 120, 0, this.worldH),
        )
      }
    }
  }

  /** A sword-clash burst: sparks + an expanding shock ring at (x, y). */
  private clashBurst(x: number, y: number, color: number): void {
    this.sparks.explode(6, x, y)
    const ring = this.add
      .image(x, y, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setScale(0.15)
      .setDepth(6)
    this.tweens.add({
      targets: ring,
      scale: 0.7,
      alpha: { from: 0.85, to: 0 },
      duration: 220,
      onComplete: () => ring.destroy(),
    })
  }

  /** Beat an NPC → absorb its power (big power + score gain), it respawns weaker. */
  private absorbNpc(npc: NpcHero): void {
    this.statNpcAbsorbed++
    const gained = Math.max(1, Math.round(npc.power))
    this.power.addEnemyValue(gained)
    this.emitPower()
    this.scorer.add(Math.round(gained * RIVAL.scoreMultiplier))
    this.emitScore()
    this.spawnPopup(npc.x, npc.y, `+${formatCompact(gained)}`)
    this.playClashFx(npc.x, npc.y, 0x8ce99a)
    this.cameras.main.flash(200, 120, 255, 150)
    audioService.win()
    this.npcDie(npc)
  }

  /** Choose a goal: boss > nearby gate > chest > heal(if hurt) > enemy > wander. */
  private npcPickTarget(npc: NpcHero): { x: number; y: number } {
    if (this.bossActive && this.boss.active && distance(npc.x, npc.y, this.boss.x, this.boss.y) < 900) {
      return { x: this.boss.x, y: this.boss.y }
    }
    const gate = this.nearestActive(npc, this.gatePool, (g) => g.active && !g.consumed)
    if (gate) return { x: gate.x, y: gate.y }
    const chest = this.nearestActive(npc, this.chestPool, (c) => c.active)
    if (chest) return { x: chest.x, y: chest.y }
    if (npc.hp < npc.maxHp * 0.55) {
      const heal = this.nearestActive(npc, this.healPool, (h) => h.active && !h.consumed)
      if (heal) return { x: heal.x, y: heal.y }
    }
    // Hunt a weaker NPC if one is nearby (predators chase prey → real skirmishes).
    const prey = this.nearestNpc(npc)
    const enemy = this.nearestEnemy(npc)
    if (prey && (!enemy || distance(npc.x, npc.y, prey.x, prey.y) < distance(npc.x, npc.y, enemy.x, enemy.y))) {
      return { x: prey.x, y: prey.y }
    }
    if (enemy) return { x: enemy.x, y: enemy.y }
    // Wander: pick a new roaming point occasionally.
    if (this.elapsedMs >= npc.wanderUntil) {
      npc.wanderUntil = this.elapsedMs + 2600
      npc.targetX = clamp(npc.x + randomRange(-400, 400), 100, this.worldW - 100)
      npc.targetY = clamp(npc.y + randomRange(-400, 400), 100, this.worldH - 100)
    }
    return { x: npc.targetX, y: npc.targetY }
  }

  private nearestActive<T extends { x: number; y: number }>(
    npc: NpcHero,
    pool: T[],
    ok: (t: T) => boolean,
  ): T | null {
    let best: T | null = null
    let bestD: number = NPC.seekRange
    for (const item of pool) {
      if (!ok(item)) continue
      const d = distance(npc.x, npc.y, item.x, item.y)
      if (d < bestD) {
        bestD = d
        best = item
      }
    }
    return best
  }

  /** Nearest other NPC within seek range — they all seek fights (aggressive). */
  private nearestNpc(npc: NpcHero): NpcHero | null {
    let best: NpcHero | null = null
    let bestD: number = NPC.seekRange
    for (const other of this.npcs) {
      if (other === npc || !other.active) continue
      const d = distance(npc.x, npc.y, other.x, other.y)
      if (d < bestD) {
        bestD = d
        best = other
      }
    }
    return best
  }

  private nearestEnemy(npc: NpcHero): Enemy | null {
    let best: Enemy | null = null
    let bestD: number = NPC.seekRange
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      const d = distance(npc.x, npc.y, e.x, e.y)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  /** Ring damage to enemies/boss around an NPC, plus contact damage taken. */
  private npcCombat(npc: NpcHero): void {
    const dmg = NPC.damageBase + npc.power * NPC.damagePerPower
    const reach = NPC.ringRadius + 14
    let grew = false
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      const d = distance(npc.x, npc.y, e.x, e.y)
      if (d < 22) npc.hp -= NPC.contactDamage // walked into a foe
      if (d > reach) continue
      // Deal at least a fraction of the enemy's HP so NPCs can farm enemies that
      // scale with the PLAYER's power (otherwise they'd never grow / stay tiny).
      const edmg = Math.max(dmg, e.hp * 0.25)
      if (e.takeDamage(edmg)) {
        this.killFx(e.x, e.y)
        e.deactivate()
        npc.power += e.value
        grew = true
      }
    }
    // Help fight the boss.
    if (this.bossActive && this.boss.active) {
      if (distance(npc.x, npc.y, this.boss.x, this.boss.y) < reach + this.boss.displayWidth * 0.5) {
        const capped = Math.min(dmg, Math.ceil(this.boss.maxHp * BOSS.maxHitFraction))
        if (this.boss.takeDamage(capped)) this.bossDefeat()
      }
    }
    // Brawl with other NPCs whose rings overlap — the STRONGER one wins and
    // absorbs the weaker (equal power = stalemate, neither is chipped).
    const brawlReach = NPC.ringRadius + 24 // its blades must reach the other's body
    for (const other of this.npcs) {
      if (other === npc || !other.active) continue
      if (npc.power < other.power) continue // only the stronger deals damage
      if (distance(npc.x, npc.y, other.x, other.y) > brawlReach) continue
      other.hp -= dmg
      if (Math.random() < 0.3) this.clashBurst((npc.x + other.x) / 2, (npc.y + other.y) / 2, npc.ringColor)
      if (other.hp <= 0) {
        npc.power += other.power
        grew = true
        this.npcDie(other)
      }
    }
    if (grew) npc.refresh()
    if (npc.hp <= 0) this.npcDie(npc)
  }

  private npcDie(npc: NpcHero): void {
    this.killFx(npc.x, npc.y)
    npc.respawnAt = this.elapsedMs + NPC.respawnMs
    npc.deactivate()
  }

  /** NPCs also grab gates / chests / hearts they reach (competing with you). */
  private npcPickups(npc: NpcHero): void {
    for (const gate of this.gatePool) {
      if (!gate.active || gate.consumed) continue
      if (distance(npc.x, npc.y, gate.x, gate.y) < GATE.width / 2 + 18) {
        gate.consumed = true
        npc.power = gate.config.op === 'mul' ? npc.power * gate.config.value : npc.power + gate.config.value
        gate.deactivate()
        npc.refresh()
      }
    }
    for (const chest of this.chestPool) {
      if (!chest.active) continue
      if (distance(npc.x, npc.y, chest.x, chest.y) < 28) {
        chest.deactivate()
        npc.power += CHEST.basePower * 3
        npc.refresh()
      }
    }
    for (const heal of this.healPool) {
      if (!heal.active || heal.consumed) continue
      if (distance(npc.x, npc.y, heal.x, heal.y) < 26) {
        heal.consumed = true
        npc.hp = Math.min(npc.maxHp, npc.hp + HEAL.amount)
        heal.deactivate()
      }
    }
  }

  /**
   * Redraw the screen-pinned minimap: a scaled-down view of the whole world with
   * a blip for every live threat/pickup, the camera viewport rectangle, and the
   * hero on top. Pure canvas drawing — no Vue, no event traffic.
   */
  private drawMinimap(): void {
    const m = this.minimap
    const c = MINIMAP.colors
    // Responsive: scale to a fraction of the shorter screen side (so it stays
    // small on phones), clamped between minSize and maxSize.
    const s = Math.round(
      clamp(Math.min(this.viewW, this.viewH) * MINIMAP.screenFraction, MINIMAP.minSize, MINIMAP.maxSize),
    )
    const x0 = this.viewW - s - MINIMAP.margin
    const y0 = MINIMAP.margin + 52 // clear the HUD's top-right mute button
    const sx = s / this.worldW
    const sy = s / this.worldH
    const px = (wx: number) => x0 + wx * sx
    const py = (wy: number) => y0 + wy * sy

    m.clear()
    // Panel + border.
    m.fillStyle(c.panel, 0.55)
    m.fillRoundedRect(x0, y0, s, s, 8)
    m.lineStyle(2, c.border, 0.85)
    m.strokeRoundedRect(x0, y0, s, s, 8)

    const k = s / MINIMAP.maxSize // shrink blips on smaller maps
    const blip = (color: number, wx: number, wy: number, r: number): void => {
      m.fillStyle(color, 1)
      m.fillCircle(px(wx), py(wy), Math.max(1, r * k))
    }

    // Pickups first (under threats).
    for (const gate of this.gatePool) if (gate.active && !gate.consumed) blip(c.gate, gate.x, gate.y, 1.8)
    for (const heal of this.healPool) if (heal.active && !heal.consumed) blip(c.heal, heal.x, heal.y, 1.8)
    // Foes.
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (e.active) blip(c.enemy, e.x, e.y, 1.4)
    }
    for (const rival of this.rivalPool) if (rival.active) blip(c.rival, rival.x, rival.y, 2.4)
    for (const npc of this.npcs) if (npc.active) blip(npc.ringColor, npc.x, npc.y, 2)
    if (this.bossActive && this.boss.active) {
      const pulse = 4 + Math.sin(this.elapsedMs / 140) * 1.4
      blip(c.boss, this.boss.x, this.boss.y, pulse)
    }

    // Current camera viewport rectangle.
    const cam = this.cameras.main
    m.lineStyle(1, c.view, 0.7)
    m.strokeRect(px(cam.scrollX), py(cam.scrollY), this.viewW * sx, this.viewH * sy)

    // Hero on top.
    blip(c.player, this.player.x, this.player.y, 3)
    m.lineStyle(1.5, 0xffffff, 0.9)
    m.strokeCircle(px(this.player.x), py(this.player.y), Math.max(3, 4.5 * k))
  }

  /** Swap the hero to the next champion look every 1000 power. */
  private checkEvolve(): void {
    // Target tier follows SCORE (monotonic). We climb toward it ONE step at a
    // time on a cadence, so even a huge score jump plays as a visible gradual
    // transformation montage instead of snapping to the final form.
    const score = this.scorer.score
    const scoreTier = Math.floor(HERO.tierPerLog10 * Math.log10(1 + score))
    // Never below the chosen loadout hero (floor); still evolve up with score.
    const target = clamp(Math.max(scoreTier, this.heroFloor), 0, HERO.skins - 1)
    if (target <= this.playerSkin) return
    const first = this.playerSkin < 0
    if (!first && this.elapsedMs - this.lastEvolveAt < HERO.evolveStepMs) return
    this.lastEvolveAt = this.elapsedMs
    // On the first frame jump straight to the target (your chosen hero appears at
    // once); afterwards climb one tier at a time.
    const tier = first ? target : this.playerSkin + 1
    const reachedTarget = tier >= target
    this.playerSkin = tier
    this.player.setTexture(`hero${tier}`)
    gameEventBus.emit('hero:changed', { index: tier })
    // Physically grow from scrawny to towering across the tiers.
    this.heroScale = HERO.minScale + (HERO.maxScale - HERO.minScale) * (tier / (HERO.skins - 1))
    this.player.setScale(this.heroScale)
    codexService.mark('hero', tier)
    // Shield gear stacks with the meta Aegis defense (reduced incoming damage).
    this.playerDefenseMul = this.metaDefenseBase * (gearOf(tier) === 3 ? GEAR.shieldDefenseMul : 1)
    // Aura color tracks the prestige theme; brighter/hotter as tier climbs.
    const rk = tier / (HERO.skins - 1)
    this.heroAuraColor =
      rk >= 0.85 ? 0xffe14d : rk >= 0.72 ? 0xff2d2d : rk >= 0.6 ? 0xff6a2a : rk >= 0.45 ? 0xd48aff : rk >= 0.3 ? 0x5ad0ff : 0
    // Announce crossing into a new rarity tier.
    const rarity = heroRarity(rk)
    const raritiedUp = rarity > this.heroRarityIdx
    if (raritiedUp && !first) this.announceRarity(rarity)
    this.heroRarityIdx = Math.max(this.heroRarityIdx, rarity)
    // Full flourish only when catching up to the target or crossing a rarity —
    // otherwise a light pop, so rapid catch-up isn't a flash storm.
    if (!first && (reachedTarget || raritiedUp)) {
      this.evolveFx()
      this.heroPopUntil = this.elapsedMs + 360
    } else if (!first) {
      this.tweens.add({ targets: this.player, scaleX: { from: this.heroScale * 1.2, to: this.heroScale }, scaleY: { from: this.heroScale * 1.2, to: this.heroScale }, duration: 160, ease: 'Back.Out' })
      this.heroPopUntil = this.elapsedMs + 180
    }
    // Divine heroes unlock a unique 4th ultimate.
    const divIdx = tier >= HERO.skins - HERO.divineCount ? tier - (HERO.skins - HERO.divineCount) : -1
    if (divIdx !== this.divineSkill) {
      this.divineSkill = divIdx
      gameEventBus.emit('skill:divine', { index: divIdx })
    }
  }

  /** Big colored "LEGENDARY!" flourish when the hero reaches a new rarity tier. */
  private announceRarity(rarity: number): void {
    const info = HERO_RARITIES[rarity] as { id: string; color: number }
    const color = `#${info.color.toString(16).padStart(6, '0')}`
    const text = this.add
      .text(this.player.x, this.player.y - 60, info.id.toUpperCase(), {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setDepth(21)
    text.setStroke('#000000', 6)
    this.tweens.add({
      targets: text,
      y: text.y - 40,
      scale: { from: 0.6, to: 1.3 },
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    })
  }

  /** Pulsing radiant aura under the hero, scaled to its size + tier. */
  private updateHeroAura(): void {
    if (!this.heroAuraColor) {
      this.heroAura.setVisible(false)
      return
    }
    const t = this.elapsedMs
    this.heroAura
      .setVisible(true)
      .setPosition(this.player.x, this.player.y)
      .setTint(this.heroAuraColor)
      .setScale(this.heroScale * (0.72 + 0.06 * Math.sin(t / 240)))
      .setAlpha(0.26 + 0.1 * Math.sin(t / 300))
  }

  /** Big "power-up" transformation moment: shockwave, burst, flash + a pop. */
  private evolveFx(): void {
    const x = this.player.x
    const y = this.player.y
    const hs = this.heroScale
    this.sparks.explode(30, x, y)
    for (const tint of [0xffe14d, 0xffffff]) {
      const ring = this.add
        .image(x, y, 'shock')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(0.2)
        .setDepth(6)
      this.tweens.add({
        targets: ring,
        scale: 3.4,
        alpha: { from: 0.9, to: 0 },
        duration: 460,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      })
    }
    this.tweens.add({
      targets: this.player,
      scaleX: { from: hs * 1.4, to: hs },
      scaleY: { from: hs * 1.4, to: hs },
      duration: 320,
      ease: 'Back.Out',
    })
    this.hitStopUntil = this.frameTime + 60
    this.cameras.main.flash(260, 255, 230, 150)
    this.cameras.main.shake(220, 0.006)
    audioService.skill()
    audioService.win()
  }

  // ---- Spawning -----------------------------------------------------------

  private spawnEnemy(elapsedSec: number): void {
    const enemy = this.enemies.get(0, 0) as Enemy | null
    if (!enemy) return

    const { x, y } = this.randomEdgePoint()
    enemy.spawn(x, y, this.spawner.createEnemy(elapsedSec, this.power.power))
  }

  /** A point just outside the current camera view, so foes enter from a screen
   *  edge no matter where in the open world the hero has wandered. */
  private randomEdgePoint(): { x: number; y: number } {
    const cam = this.cameras.main
    const m = ENEMY.size + OFFSCREEN_MARGIN
    const left = cam.scrollX
    const top = cam.scrollY
    const right = left + this.viewW
    const bottom = top + this.viewH
    switch (randomInt(0, 3)) {
      case 0:
        return { x: randomRange(left, right), y: top - m }
      case 1:
        return { x: randomRange(left, right), y: bottom + m }
      case 2:
        return { x: left - m, y: randomRange(top, bottom) }
      default:
        return { x: right + m, y: randomRange(top, bottom) }
    }
  }

  /** X across the current view; Y just above it — for items that drift down. */
  private topSpawnPoint(halfWidth: number): { x: number; y: number } {
    const cam = this.cameras.main
    return {
      x: randomRange(cam.scrollX + halfWidth, cam.scrollX + this.viewW - halfWidth),
      y: cam.scrollY - halfWidth,
    }
  }

  /** Configure the theme's living ambient layer (motes / snow / embers). */
  private spawnAmbient(cfg: { tint: number; dir: string }): void {
    const w = Math.max(this.viewW, 1500)
    const h = Math.max(this.viewH, 1100)
    const down = cfg.dir === 'fall'
    const up = cfg.dir === 'rise'
    const side = cfg.dir === 'side'
    this.ambient = this.add
      .particles(0, 0, 'spark', {
        x: side ? -20 : { min: -20, max: w + 20 },
        y: down ? -20 : up ? h + 20 : { min: -20, max: h + 20 },
        lifespan: down || up ? 12000 : 7000,
        frequency: 130,
        quantity: 1,
        speedX: side ? { min: 60, max: 150 } : { min: -20, max: 20 },
        speedY: down ? { min: 60, max: 130 } : up ? { min: -130, max: -60 } : { min: -14, max: 14 },
        scale: { min: 0.12, max: 0.5 },
        alpha: { start: 0.5, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: cfg.tint,
      })
      .setScrollFactor(0)
      .setDepth(-7)
  }

  private spawnGate(): void {
    const gate = this.gatePool.find((g) => !g.active)
    if (!gate) return
    const { x, y } = this.topSpawnPoint(GATE.width / 2)
    gate.spawn(x, y - GATE.height / 2, this.spawner.createGate())
  }

  private spawnRival(elapsedSec: number): void {
    const rival = this.rivalPool.find((r) => !r.active)
    if (!rival) return
    const { x, y } = this.randomEdgePoint()
    rival.spawn(x, y, this.spawner.createRivalCount(elapsedSec, this.power.power))
  }

  /** Rivals arrive more often the stronger the player is. */
  private scheduleNextRival(): void {
    const factor = clamp(1 - this.power.power * RIVAL.intervalPowerFactor, RIVAL.minIntervalFactor, 1)
    this.nextRivalMs = randomRange(RIVAL.minIntervalMs, RIVAL.maxIntervalMs) * factor
  }

  private spawnHeal(): void {
    const heal = this.healPool.find((h) => !h.active)
    if (!heal) return
    const { x, y } = this.topSpawnPoint(HEAL.size)
    heal.spawn(x, y - HEAL.size)
  }

  // ---- Boss ---------------------------------------------------------------

  /** Per-tick sword damage vs the boss (ring helps sub-linearly). */
  private bossTickDamage(): number {
    const stats = this.power.stats
    return Math.max(
      1,
      Math.round(stats.damage * (1 + stats.swordCount * BOSS.swordCountFactor) * this.swordDamageMul * this.metaBossMul),
    )
  }

  private spawnBoss(elapsedSec: number): void {
    // Size HP to the player's current DPS so the fight lasts ~targetSeconds
    // (and gets tankier over the run). Prevents one-shots at high power.
    const dps = this.bossTickDamage() * (1000 / BOSS.hitTickMs)
    const seconds = BOSS.targetSeconds + (elapsedSec / 60) * BOSS.secondsPerMin
    const baseHp = Math.max(BOSS.minHp, Math.round(dps * seconds))
    // In Boss Rush the lead boss gets tankier every wave.
    const hp = this.bossRush ? Math.round(baseHp * (1 + Math.max(0, this.rushWave - 1) * BOSS_RUSH.hpWaveGrow)) : baseHp
    const { x, y } = this.randomEdgePoint()
    // Pick a DISTINCT boss skin each appearance (shape + color), biased upward
    // over time so later bosses skew nastier — without saturating to one skin at
    // high power. floorRank rises with elapsed minutes; a per-count offset cycles
    // so consecutive bosses always differ in archetype.
    this.bossCount++
    const floorRank = clamp(Math.floor(elapsedSec / 60) * 12, 0, 80)
    const offset = (this.bossCount * 13) % 20
    const idx = clamp(floorRank + offset, 0, BOSS.skins - 1)
    this.bossSkinIdx = idx
    this.boss.spawn(x, y, hp, BOSS.speed, 1.5, `boss${idx}`)
    this.bossActive = true
    this.bossSummonAcc = 0
    this.bossGateAcc = 0
    this.bossAngle = 0
    this.bossClashAcc = 0
    this.bossFanAcc = 0
    this.bossMeteorAcc = 0
    this.boss.clearTint()
    // Each boss skin has a signature weapon (deterministic variety across the 8).
    const weapons = ['wMace', 'wAxe', 'wSpear', 'wScythe', 'wHammer', 'wTrident', 'wGreatsword', 'wHalberd']
    const weaponKey = weapons[idx % weapons.length] as string
    this.bossWeapons.forEach((wpn) => wpn.setTexture(weaponKey).setScale(1.7).setVisible(true))
    this.bossLabel.setVisible(true)
    this.bossAura.setVisible(true)
    this.cameras.main.shake(240, 0.008)
    audioService.nova()
    gameEventBus.emit('boss:spawn', { maxHp: hp })
  }

  private hideBossExtras(): void {
    this.clearBossOrbs()
    this.bossArrow.clear()
    this.bossWeapons.forEach((wpn) => wpn.setVisible(false))
    this.bossLabel.setVisible(false)
    this.bossAura.setVisible(false)
    this.boss.clearTint()
  }

  private updateBoss(deltaMs: number, elapsedSec: number): void {
    const enraged = this.boss.hp < this.boss.maxHp * BOSS.enrageAt
    const angle = angleBetween(this.boss.x, this.boss.y, this.player.x, this.player.y)
    const speed = this.boss.speed * (enraged ? 1.35 : 1)
    this.boss.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    this.boss.setTint(enraged ? 0xff7a5a : 0xffffff)

    // Menacing aura that pulses (faster when enraged).
    const auraScale = (this.boss.displayWidth * 1.35) / (AURA.textureRadius * 2)
    this.bossAura
      .setPosition(this.boss.x, this.boss.y)
      .setScale(auraScale)
      .setAlpha(0.3 + 0.14 * Math.sin(this.elapsedMs / (enraged ? 90 : 170)))

    // Orbiting boss weapon(s) — spin faster when enraged.
    this.bossAngle = (this.bossAngle + (enraged ? 3.8 : 2.2) * (deltaMs / 1000)) % TAU
    const wr = this.boss.displayWidth * 0.5
    for (let i = 0; i < this.bossWeapons.length; i++) {
      const wpn = this.bossWeapons[i] as Phaser.GameObjects.Image
      const a = this.bossAngle + (i / this.bossWeapons.length) * TAU
      wpn.setPosition(this.boss.x + Math.cos(a) * wr, this.boss.y + Math.sin(a) * wr).setRotation(a + Math.PI / 2)
    }
    this.bossLabel
      .setPosition(this.boss.x, this.boss.y - this.boss.displayHeight * 0.62)
      .setText(formatCompact(this.boss.hp))

    // Clash spectacle: when the two rings meet, spark + clang at the contact edge.
    if (distance(this.boss.x, this.boss.y, this.player.x, this.player.y) < SWORD.orbitRadius + wr + 24) {
      this.bossClashAcc += deltaMs
      const interval = enraged ? 110 : 180
      while (this.bossClashAcc >= interval) {
        this.bossClashAcc -= interval
        const cx = this.player.x + Math.cos(angle + Math.PI) * SWORD.orbitRadius
        const cy = this.player.y + Math.sin(angle + Math.PI) * SWORD.orbitRadius
        this.sparks.explode(5, cx, cy)
        const ring = this.add
          .image(cx, cy, 'shock')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffe08a)
          .setScale(0.2)
          .setDepth(6)
        this.tweens.add({
          targets: ring,
          scale: 0.85,
          alpha: { from: 0.8, to: 0 },
          duration: 220,
          onComplete: () => ring.destroy(),
        })
        this.cameras.main.shake(50, enraged ? 0.004 : 0.002)
        audioService.clash()
      }
    }
    // Periodically summon a few adds to keep the pressure on.
    this.bossSummonAcc += deltaMs
    if (this.bossSummonAcc >= BOSS.summonMs) {
      this.bossSummonAcc = 0
      for (let i = 0; i < BOSS.summonCount; i++) {
        const enemy = this.enemies.get(0, 0) as Enemy | null
        if (enemy) enemy.spawn(this.boss.x, this.boss.y, this.spawner.createEnemy(elapsedSec, this.power.power))
      }
    }

    // Drop big ×N power gates so the player can scale up for the fight.
    this.bossGateAcc += deltaMs
    if (this.bossGateAcc >= BOSS.gateIntervalMs) {
      this.bossGateAcc = 0
      this.spawnMultiplierGate()
    }

    // Attack patterns — faster & denser when enraged.
    const rageMul = enraged ? BOSS_ATTACK.enrageRateMul : 1
    this.bossFanAcc += deltaMs
    if (this.bossFanAcc >= BOSS_ATTACK.fanIntervalMs * rageMul) {
      this.bossFanAcc = 0
      this.castFan(enraged)
    }
    this.bossMeteorAcc += deltaMs
    if (this.bossMeteorAcc >= BOSS_ATTACK.meteorIntervalMs * rageMul) {
      this.bossMeteorAcc = 0
      this.castMeteors(enraged)
    }
    this.updateBossOrbs(deltaMs)
    this.updateBossArrow()
  }

  /** Point a screen-edge arrow at the boss when it's off-screen. */
  private updateBossArrow(): void {
    const g = this.bossArrow
    g.clear()
    const cam = this.cameras.main
    const sx = this.boss.x - cam.scrollX
    const sy = this.boss.y - cam.scrollY
    const m = 44
    if (sx > m && sx < this.viewW - m && sy > m && sy < this.viewH - m) return // on-screen
    const ang = Math.atan2(sy - this.viewH / 2, sx - this.viewW / 2)
    const px = clamp(sx, m, this.viewW - m)
    const py = clamp(sy, m, this.viewH - m)
    const pulse = 0.7 + 0.3 * Math.sin(this.elapsedMs / 160)
    g.fillStyle(0xff2020, pulse)
    g.fillTriangle(
      px + Math.cos(ang) * 16, py + Math.sin(ang) * 16,
      px + Math.cos(ang + 2.5) * 11, py + Math.sin(ang + 2.5) * 11,
      px + Math.cos(ang - 2.5) * 11, py + Math.sin(ang - 2.5) * 11,
    )
    g.fillStyle(0x3a0000, pulse)
    g.fillCircle(px, py, 3)
  }

  /** Fire a spread of fireballs from the boss toward the hero. */
  private castFan(enraged: boolean): void {
    const count = BOSS_ATTACK.fanCount + (enraged ? 2 : 0)
    const base = angleBetween(this.boss.x, this.boss.y, this.player.x, this.player.y)
    const spread = BOSS_ATTACK.fanSpreadRad
    const speed = BOSS_ATTACK.projectileSpeed * (enraged ? 1.2 : 1)
    for (let k = 0; k < count; k++) {
      const orb = this.bossOrbs.find((o) => !o.img.active)
      if (!orb) break
      const a = base + (count > 1 ? (k / (count - 1) - 0.5) * spread : 0)
      orb.vx = Math.cos(a) * speed
      orb.vy = Math.sin(a) * speed
      orb.img
        .setPosition(this.boss.x, this.boss.y)
        .setScale(enraged ? 1.35 : 1.1)
        .setTint(enraged ? 0xff5030 : 0xffa050)
        .setActive(true)
        .setVisible(true)
    }
    audioService.nova()
  }

  /** Advance active fireballs; recycle offscreen and damage the hero on contact. */
  private updateBossOrbs(deltaMs: number): void {
    const dt = deltaMs / 1000
    const hitDist = this.player.width / 2 + 10
    const cam = this.cameras.main
    const margin = 80
    for (const orb of this.bossOrbs) {
      if (!orb.img.active) continue
      orb.img.x += orb.vx * dt
      orb.img.y += orb.vy * dt
      orb.img.rotation += deltaMs / 90
      if (distance(orb.img.x, orb.img.y, this.player.x, this.player.y) < hitDist) {
        this.sparks.explode(6, orb.img.x, orb.img.y)
        orb.img.setActive(false).setVisible(false)
        this.hitPlayer(BOSS_ATTACK.projectileDamage)
        continue
      }
      // Recycle once well outside the current view.
      if (
        orb.img.x < cam.scrollX - margin ||
        orb.img.x > cam.scrollX + this.viewW + margin ||
        orb.img.y < cam.scrollY - margin ||
        orb.img.y > cam.scrollY + this.viewH + margin
      ) {
        orb.img.setActive(false).setVisible(false)
      }
    }
  }

  /** Rain telegraphed meteors around the hero (dodge the warning rings). */
  private castMeteors(enraged: boolean): void {
    const count = BOSS_ATTACK.meteorCount + (enraged ? 1 : 0)
    for (let k = 0; k < count; k++) {
      const tx = this.player.x + randomRange(-BOSS_ATTACK.meteorSpread, BOSS_ATTACK.meteorSpread)
      const ty = this.player.y + randomRange(-BOSS_ATTACK.meteorSpread, BOSS_ATTACK.meteorSpread)
      this.spawnMeteor(tx, ty, enraged)
    }
    audioService.skill()
  }

  /** One meteor: warning ring blooms, then a rock slams down for a radial hit. */
  private spawnMeteor(tx: number, ty: number, enraged: boolean): void {
    const radius = BOSS_ATTACK.meteorRadius
    const warn = this.add
      .image(tx, ty, 'meteorWarn')
      .setDepth(-1)
      .setAlpha(0.9)
      .setScale(0.15)
      .setTint(enraged ? 0xff3020 : 0xff8a3a)
    this.tweens.add({
      targets: warn,
      scale: (radius * 2) / 64,
      alpha: { from: 0.5, to: 0.95 },
      duration: BOSS_ATTACK.meteorTelegraphMs,
      ease: 'Quad.Out',
      onComplete: () => {
        warn.destroy()
        const meteor = this.add.image(tx, ty - 460, 'meteor').setDepth(6).setScale(enraged ? 1.7 : 1.4)
        this.tweens.add({
          targets: meteor,
          y: ty,
          duration: BOSS_ATTACK.meteorFallMs,
          ease: 'Quad.In',
          onComplete: () => {
            meteor.destroy()
            this.meteorImpact(tx, ty, radius, enraged)
          },
        })
      },
    })
  }

  /** Meteor impact: explosion, shockwave, shake, and a radial hit on the hero. */
  private meteorImpact(tx: number, ty: number, radius: number, enraged: boolean): void {
    this.sparks.explode(22, tx, ty)
    const ring = this.add
      .image(tx, ty, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(enraged ? 0xff5030 : 0xffb060)
      .setScale(0.2)
      .setDepth(5)
    this.tweens.add({
      targets: ring,
      scale: (radius * 2) / 64,
      alpha: { from: 0.85, to: 0 },
      duration: 320,
      onComplete: () => ring.destroy(),
    })
    this.cameras.main.shake(180, 0.01)
    audioService.nova()
    if (distance(this.player.x, this.player.y, tx, ty) < radius + this.player.width / 2) {
      this.hitPlayer(BOSS_ATTACK.meteorDamage)
    }
  }

  /** Apply damage to the hero (respecting i-frames) with feedback. */
  private hitPlayer(amount: number): void {
    if (this.isOver) return
    if (this.elapsedMs < this.playerInvulnUntil) return
    this.playerInvulnUntil = this.elapsedMs + PLAYER.invulnMs
    const dead = this.player.takeDamage(Math.round(amount * this.playerDefenseMul))
    this.emitHp()
    audioService.hurt()
    this.cameras.main.flash(120, 255, 80, 40)
    if (dead) this.gameOver()
  }

  /** Recycle every active fireball (on boss defeat / restart). */
  private clearBossOrbs(): void {
    for (const orb of this.bossOrbs) orb.img.setActive(false).setVisible(false)
  }

  private spawnMultiplierGate(): void {
    const gate = this.gatePool.find((g) => !g.active)
    if (!gate) return
    const { x, y } = this.topSpawnPoint(GATE.width / 2)
    gate.spawn(x, y - GATE.height / 2, { op: 'mul', value: pickOne(BOSS.gateValues) })
  }

  private bossDefeat(): void {
    this.statBosses++
    codexService.mark('boss', this.bossSkinIdx)
    const reward = Math.round(this.boss.maxHp * 0.06)
    const x = this.boss.x
    const y = this.boss.y
    this.boss.setVelocity(0, 0)
    this.boss.deactivate()
    this.bossActive = false
    this.hideBossExtras()
    this.xp += LEVEL.xpPerBoss
    this.registerKill(reward, x, y)
    this.scorer.add(reward * BOSS.scoreMul)
    this.emitScore()
    this.playClashFx(x, y, 0xffd700)
    this.sparks.explode(30, x, y)
    this.cameras.main.flash(260, 255, 220, 120)
    this.cameras.main.shake(300, 0.012)
    audioService.win()
    gameEventBus.emit('boss:end', undefined)
    this.hitStopUntil = this.frameTime + HITSTOP_MS
    this.spawnChest(x, y, 2) // bosses always drop an epic chest
  }

  // ---- Boss Rush (endgame wave mode) --------------------------------------

  /** Switch the run into Boss Rush: horde stops, bosses come in waves. */
  private enterBossRush(): void {
    this.bossRush = true
    this.rushWave = 0
    this.rushGapUntil = 0
    this.cameras.main.flash(400, 120, 0, 0)
    this.cameras.main.shake(360, 0.01)
    audioService.nova()
    gameEventBus.emit('rush:start', undefined)
  }

  private escortAliveCount(): number {
    let n = 0
    for (const e of this.escorts) if (e.active) n++
    return n
  }

  /** Drive the lead boss + escorts, and spawn the next wave once one is cleared. */
  private updateBossRush(deltaMs: number, elapsedSec: number): void {
    if (this.bossActive) this.updateBoss(deltaMs, elapsedSec)
    this.updateEscorts()

    const alive = (this.bossActive ? 1 : 0) + this.escortAliveCount()
    if (alive > 0) return

    // Wave cleared → breather, then a bigger wave.
    if (this.rushGapUntil === 0) {
      this.rushGapUntil = this.elapsedMs + (this.rushWave === 0 ? BOSS_RUSH.firstWaveDelayMs : BOSS_RUSH.waveGapMs)
      if (this.rushWave > 0) gameEventBus.emit('rush:wave', { wave: this.rushWave, size: 0, cleared: true })
    }
    if (this.elapsedMs >= this.rushGapUntil) {
      this.rushGapUntil = 0
      this.spawnRushWave(elapsedSec)
    }
  }

  private spawnRushWave(elapsedSec: number): void {
    this.rushWave++
    const size = Math.min(
      BOSS_RUSH.maxWaveSize,
      BOSS_RUSH.baseWaveSize + Math.floor((this.rushWave - 1) / BOSS_RUSH.growEvery) * BOSS_RUSH.waveSizeGrow,
    )
    // Lead boss keeps the full attack kit (uses the standard spawn path).
    this.spawnBoss(elapsedSec)
    const escortCount = Math.min(this.escorts.length, size - 1)
    for (let i = 0; i < escortCount; i++) this.spawnEscort(i, elapsedSec)
    gameEventBus.emit('rush:wave', { wave: this.rushWave, size, cleared: false })
  }

  private spawnEscort(i: number, elapsedSec: number): void {
    const escort = this.escorts[i]
    const label = this.escortLabels[i]
    if (!escort || !label) return
    const dps = this.bossTickDamage() * (1000 / BOSS.hitTickMs)
    const seconds = BOSS.targetSeconds + (elapsedSec / 60) * BOSS.secondsPerMin
    const baseHp = Math.max(BOSS.minHp, Math.round(dps * seconds))
    const hp = Math.round(baseHp * BOSS_RUSH.escortHpMul * (1 + Math.max(0, this.rushWave - 1) * BOSS_RUSH.hpWaveGrow))
    const { x, y } = this.randomEdgePoint()
    const idx = clamp((this.bossCount * 7 + i * 13 + this.rushWave * 5) % BOSS.skins, 0, BOSS.skins - 1)
    escort.spawn(x, y, hp, BOSS_RUSH.escortSpeed, BOSS_RUSH.escortScale, `boss${idx}`)
    escort.setData('skin', idx)
    label.setVisible(true)
  }

  private updateEscorts(): void {
    for (let i = 0; i < this.escorts.length; i++) {
      const e = this.escorts[i]
      const label = this.escortLabels[i]
      if (!e || !label) continue
      if (!e.active) {
        if (label.visible) label.setVisible(false)
        continue
      }
      const enraged = e.hp < e.maxHp * BOSS.enrageAt
      const angle = angleBetween(e.x, e.y, this.player.x, this.player.y)
      const speed = e.speed * (enraged ? 1.3 : 1)
      e.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      e.setTint(enraged ? 0xff5a3a : 0xffc0c0) // crimson tint so escorts read apart from the lead
      label.setPosition(e.x, e.y - e.displayHeight * 0.6).setText(formatCompact(e.hp))
    }
  }

  private escortDefeat(e: Boss): void {
    const x = e.x
    const y = e.y
    e.setVelocity(0, 0)
    e.deactivate()
    const skin = e.getData('skin') as number | undefined
    if (typeof skin === 'number') codexService.mark('boss', skin)
    this.statBosses++
    this.xp += LEVEL.xpPerBoss
    const reward = Math.round(e.maxHp * 0.05)
    this.registerKill(reward, x, y)
    this.scorer.add(reward * BOSS.scoreMul)
    this.emitScore()
    this.playClashFx(x, y, 0xffaa88)
    this.sparks.explode(22, x, y)
    this.cameras.main.shake(180, 0.008)
    audioService.win()
    this.maybeDropChest(x, y)
  }

  private onSwordHitEscort: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_swordObj, escortObj) => {
    const e = escortObj as Boss
    if (!e.active) return
    if (this.elapsedMs - e.lastHitAt < BOSS.hitTickMs) return
    e.lastHitAt = this.elapsedMs
    this.sparks.explode(5, e.x, e.y)
    const dmg = Math.min(this.bossTickDamage(), Math.ceil(e.maxHp * BOSS.maxHitFraction))
    this.damageNumber(e.x, e.y - e.displayHeight * 0.3, dmg, '#ffd24a')
    if (e.takeDamage(dmg)) this.escortDefeat(e)
  }

  private onEscortHitPlayer: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, escortObj) => {
    const e = escortObj as Boss
    if (!e.active) return
    this.hitPlayer(BOSS_RUSH.escortContactDamage)
  }

  // ---- Chests -------------------------------------------------------------

  private maybeDropChest(x: number, y: number): void {
    // Luck raises the drop chance (meta upgrade).
    if (Math.random() < CHEST.dropChance * (1 + this.metaLuck)) this.spawnChest(x, y, this.rollRarity())
  }

  private rollRarity(): number {
    // Luck biases the roll toward rarer tiers by weighting later entries up.
    const weights = CHEST.rarities.map((r, i) => r.weight * (1 + this.metaLuck * i * 1.5))
    const total = weights.reduce((s, w) => s + w, 0)
    let roll = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i] as number
      if (roll <= 0) return i
    }
    return 0
  }

  private spawnChest(x: number, y: number, rarityIndex: number): void {
    const chest = this.chestPool.find((c) => !c.active)
    if (!chest) return
    const r = CHEST.rarities[rarityIndex] ?? CHEST.rarities[0]!
    chest.spawn(x, y, r.tint, r.mul)
  }

  private updateChests(): void {
    for (const chest of this.chestPool) {
      if (!chest.active || chest.consumed) continue
      if (
        Math.abs(chest.x - this.player.x) < CHEST.size + this.player.width / 2 &&
        Math.abs(chest.y - this.player.y) < CHEST.size + this.player.height / 2
      ) {
        this.openChest(chest)
      }
    }
  }

  private openChest(chest: Chest): void {
    chest.consumed = true
    const powerReward = Math.max(
      CHEST.basePower * chest.mul,
      Math.round(this.power.power * CHEST.powerFromCurrent * chest.mul),
    )
    const coins = Math.round(CHEST.baseCoins * chest.mul)
    this.power.addEnemyValue(powerReward)
    this.emitPower()
    metaService.addCoins(coins)
    this.sparks.explode(16, chest.x, chest.y)
    this.playClashFx(chest.x, chest.y, 0xffd700)
    this.spawnPopup(chest.x, chest.y, `+${formatCompact(powerReward)}⚔  +${coins}💰`)
    audioService.win()
    chest.deactivate()
  }

  // ---- Combo --------------------------------------------------------------

  /** Register a kill: greed-boosted power reward, combo-multiplied score, XP,
   *  lifesteal, and a floating popup. */
  private registerKill(reward: number, x = -1, y = -1): void {
    const gained = Math.max(1, Math.round(reward * this.upgrades.rewardMul))
    this.statKills++
    this.comboCount++
    this.statTopCombo = Math.max(this.statTopCombo, this.comboCount)
    this.comboUntil = this.elapsedMs + COMBO.windowMs
    this.power.addEnemyValue(gained)
    this.scorer.add(Math.round(gained * this.comboMult()))
    this.emitPower()
    this.emitScore()
    this.emitCombo()

    const lifesteal = this.upgrades.lifesteal + this.metaLifesteal
    if (lifesteal > 0) {
      this.player.heal(lifesteal)
      this.emitHp()
    }
    if (x >= 0) this.spawnPopup(x, y, `+${formatCompact(gained)}`)

    this.xp += LEVEL.xpPerKill * this.metaXpMul
    this.checkLevelUp()
  }

  /** XP needed to reach the next level (grows geometrically). */
  private xpForNext(): number {
    return Math.round(LEVEL.baseXp * Math.pow(LEVEL.growth, this.level - 1))
  }

  private checkLevelUp(): void {
    if (this.leveling) return
    const next = this.xpForNext()
    if (this.xp < next) return
    this.xp -= next
    this.level++
    if (!this.bossRush && this.level >= BOSS_RUSH.triggerLevel) this.enterBossRush()
    this.leveling = true
    this.emitXp()
    gameEventBus.emit('levelup:offer', { ids: this.upgrades.roll(3) })
    this.scene.pause()
  }

  private onLevelPick = ({ id }: { id: string }): void => {
    if (!this.leveling) return
    this.upgrades.apply(id)
    if (id === 'vigor') {
      this.player.addMaxHp(UPGRADE_TUNE.maxHpPer)
      this.emitHp()
    }
    this.leveling = false
    this.scene.resume()
    this.showLevelUpPop()
    this.emitXp()
  }

  private emitXp(): void {
    gameEventBus.emit('xp:changed', {
      level: this.level,
      xp: this.xp,
      next: this.xpForNext(),
    })
  }

  private showLevelUpPop(): void {
    const text = this.add
      .text(this.player.x, this.player.y - 44, 'LEVEL UP!', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffe14d',
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setStroke('#2a1e00', 5)
    this.tweens.add({
      targets: text,
      y: text.y - 40,
      alpha: { from: 1, to: 0 },
      scale: { from: 1.3, to: 1 },
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    })
  }

  private spawnPopup(x: number, y: number, label: string): void {
    const text = this.popupPool.find((t) => !t.active)
    if (!text) return
    text.setText(label).setPosition(x, y - 10).setActive(true).setVisible(true).setAlpha(1)
    this.tweens.add({
      targets: text,
      y: y - 46,
      alpha: { from: 1, to: 0 },
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => text.setActive(false).setVisible(false),
    })
  }

  /** Floating white/gold damage number that drifts up and fades. */
  private damageNumber(x: number, y: number, amount: number, color = '#ffffff'): void {
    if (amount < 1) return
    const text = this.dmgPool.find((t) => !t.active)
    if (!text) return
    const dx = x + randomRange(-8, 8)
    text
      .setText(formatCompact(Math.round(amount)))
      .setColor(color)
      .setPosition(dx, y - 6)
      .setScale(1)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
    this.tweens.add({
      targets: text,
      y: y - 34,
      scale: { from: 1.25, to: 0.9 },
      alpha: { from: 1, to: 0 },
      duration: 480,
      ease: 'Quad.Out',
      onComplete: () => text.setActive(false).setVisible(false),
    })
  }

  private comboMult(): number {
    return 1 + Math.min(COMBO.maxBonus, Math.floor(this.comboCount / COMBO.per))
  }

  private resetCombo(): void {
    this.comboCount = 0
    this.emitCombo()
  }

  private emitCombo(): void {
    gameEventBus.emit('combo:changed', { count: this.comboCount, mult: this.comboMult() })
  }

  // ---- Per-frame updates --------------------------------------------------

  /** Meta Magnet: pull a pickup toward the hero when within range. */
  private magnetPull(obj: { x: number; y: number }, deltaMs: number): void {
    if (this.metaMagnet <= 0) return
    const d = distance(obj.x, obj.y, this.player.x, this.player.y)
    if (d > this.metaMagnet || d < 2) return
    const pull = 240 * (deltaMs / 1000)
    const a = angleBetween(obj.x, obj.y, this.player.x, this.player.y)
    obj.x += Math.cos(a) * pull
    obj.y += Math.sin(a) * pull
  }

  private updateHeals(deltaMs: number): void {
    const dy = HEAL.speed * (deltaMs / 1000)
    const despawnY = this.cameras.main.scrollY + this.viewH + HEAL.size * 2
    for (const heal of this.healPool) {
      if (!heal.active) continue
      heal.y += dy
      heal.idle(deltaMs)
      this.magnetPull(heal, deltaMs)
      if (
        !heal.consumed &&
        Math.abs(heal.x - this.player.x) < HEAL.size + this.player.width / 2 &&
        Math.abs(heal.y - this.player.y) < HEAL.size + this.player.height / 2
      ) {
        heal.consumed = true
        this.player.heal(Math.round(HEAL.amount * this.metaHealMul))
        this.emitHp()
        audioService.pickup()
        heal.deactivate()
        continue
      }
      if (heal.y > despawnY) heal.deactivate()
    }
  }

  // ---- Per-frame updates --------------------------------------------------

  private updateEnemies(deltaMs: number): void {
    const limit = Math.max(this.worldW, this.worldH) + OFFSCREEN_MARGIN * 3
    const now = this.elapsedMs
    const dt = deltaMs / 1000
    for (const obj of this.enemies.getChildren()) {
      const enemy = obj as Enemy
      if (!enemy.active) continue

      // Damage-over-time (burn + poison). Kill through the normal path.
      let dps = 0
      if (now < enemy.burnUntil) dps += enemy.burnDps
      if (now < enemy.poisonUntil) dps += enemy.poisonDps
      if (dps > 0) {
        if (enemy.takeDamage(dps * dt)) {
          this.killEnemy(enemy)
          continue
        }
        if (Math.random() < 0.14) this.sparks.explode(1, enemy.x, enemy.y)
      }

      // Chill slows movement.
      const chilled = now < enemy.chillUntil
      const speed = chilled ? enemy.speed * enemy.chillMul : enemy.speed
      const angle = angleBetween(enemy.x, enemy.y, this.player.x, this.player.y)
      enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

      // Status tint (burn > poison > chill), else restore normal/elite tint.
      if (now < enemy.burnUntil) enemy.setTint(STATUS.burnTint)
      else if (now < enemy.poisonUntil) enemy.setTint(STATUS.poisonTint)
      else if (chilled) enemy.setTint(STATUS.chillTint)
      else enemy.restoreTint()

      // Safety net: recycle anything that somehow strays far off-field.
      if (distance(enemy.x, enemy.y, this.player.x, this.player.y) > limit) enemy.deactivate()
    }
  }

  private updateGates(deltaMs: number): void {
    const dy = GATE.speed * (deltaMs / 1000)
    const despawnY = this.cameras.main.scrollY + this.viewH + GATE.height
    for (const gate of this.gatePool) {
      if (!gate.active) continue
      gate.y += dy
      gate.idle(deltaMs)
      this.magnetPull(gate, deltaMs)
      if (!gate.consumed && this.gateOverlapsPlayer(gate)) {
        gate.consumed = true
        this.power.applyGate(gate.config)
        this.emitPower()
        audioService.pickup()
        gate.deactivate()
        continue
      }
      if (gate.y > despawnY) gate.deactivate()
    }
  }

  /** Position the orbiting sword ring; count/spin/colors come from power. */
  private updateSwords(deltaMs: number): void {
    const stats = this.power.stats
    const colors = stats.layerColors
    // Upgrades add flat swords on top of power's count, but the DRAWN blades are
    // capped (SWORD.maxVisible) so the ring stays readable — power keeps scaling
    // damage regardless of how many blades are shown.
    const count = this.power.hasWeapon
      ? Math.min(this.swordPool.length, SWORD.maxVisible, stats.swordCount + this.upgrades.extraSwords)
      : 0

    // Fury skill + upgrades: faster spin, harder hits, bigger blades.
    const fury = this.elapsedMs < this.furyUntil
    this.swordDamageMul = (fury ? SKILLS.fury.damageMul : 1) * this.upgrades.damageMul * this.metaDamageMul
    const orbitSpeed = stats.orbitSpeed * (fury ? SKILLS.fury.orbitMul : 1) * this.upgrades.orbitMul * this.metaOrbitMul
    // Ring grows with the hero (bigger ring = stronger) instead of shrinking the
    // hero to fit — keeps big champions readable.
    const radius = SWORD.orbitRadius * (fury ? SKILLS.fury.radiusMul : 1) * (0.85 + this.heroScale * 0.35)
    const baseScale = fury ? 1.3 : 1
    this.orbitAngle = (this.orbitAngle + orbitSpeed * (deltaMs / 1000)) % TAU

    this.updateAura(colors)

    const px = this.player.x
    const py = this.player.y

    // Distribute blades across CONCENTRIC rings so a large arsenal reads as
    // layered orbiting swords, not a solid blurred disc. Each ring holds a
    // spacing-limited number of blades and gets a slight phase/speed offset.
    let placed = 0
    let ring = 0
    while (placed < count) {
      const rr = radius + ring * SWORD.ringGap
      const capacity = Math.max(SWORD.minPerRing, Math.floor((TAU * rr) / SWORD.bladeSpacing))
      const onRing = Math.min(capacity, count - placed)
      // Alternate direction + phase per ring so blades don't line up as spokes.
      const dir = ring % 2 === 0 ? 1 : -1
      const phase = this.orbitAngle * dir * (1 - ring * 0.12) + ring * 0.5
      for (let k = 0; k < onRing; k++) {
        const sword = this.swordPool[placed] as Sword
        const angle = phase + (k / onRing) * TAU
        sword.place(px + Math.cos(angle) * rr, py + Math.sin(angle) * rr, angle + Math.PI / 2 + 0.5)
        sword.setScale(baseScale + 0.06 * Math.sin(this.elapsedMs / 150 + placed * 0.6))
        sword.setTint(fury || !this.swordTintable ? 0xffffff : this.ringColorAt(colors, placed, count))
        placed++
      }
      ring++
    }
    for (let i = placed; i < this.swordPool.length; i++) (this.swordPool[i] as Sword).deactivate()

    // Subtle per-ring glow trail (thin, not a heavy disc) — hints motion without
    // hiding the blades.
    this.ringBlur.clear()
    if (count > 0) {
      const top = colors.length ? (colors[colors.length - 1] as number) : 0xffffff
      const a = Math.min(0.28, orbitSpeed * 0.03)
      for (let rIdx = 0; rIdx < ring; rIdx++) {
        this.ringBlur.lineStyle(6, top, a)
        this.ringBlur.strokeCircle(px, py, radius + rIdx * SWORD.ringGap)
      }
    }
  }

  /** Smoothly interpolate the ring palette around the circle for sword `i`. */
  private ringColorAt(colors: number[], i: number, count: number): number {
    const n = colors.length
    if (n === 0) return 0xffffff
    if (n === 1) return colors[0] as number
    const f = ((i / count) * n) % n
    const i0 = Math.floor(f)
    const i1 = (i0 + 1) % n
    return this.lerpColor(colors[i0] as number, colors[i1] as number, f - i0)
  }

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 255
    const ag = (a >> 8) & 255
    const ab = a & 255
    const r = Math.round(ar + (((b >> 16) & 255) - ar) * t)
    const g = Math.round(ag + (((b >> 8) & 255) - ag) * t)
    const bl = Math.round(ab + ((b & 255) - ab) * t)
    return (r << 16) | (g << 8) | bl
  }

  /** Move rivals toward the hero; when the rings meet, grind the duel out. */
  private updateRivals(deltaMs: number): void {
    const step = RIVAL.speed * (deltaMs / 1000)
    for (const rival of this.rivalPool) {
      if (!rival.active) continue
      rival.spin(deltaMs)
      const near = distance(rival.x, rival.y, this.player.x, this.player.y) < RIVAL.clashDist

      if (near) {
        // Lock in and trade blows over time (natural attrition, not instant).
        if (!rival.engaged) {
          rival.engaged = true
          rival.clashAcc = 0
          rival.clashStep = Math.max(
            1,
            Math.round(Math.min(this.power.power, rival.swordCount) / RIVAL.clashTicksTarget),
          )
        }
        rival.clashAcc += deltaMs
        while (rival.active && rival.engaged && rival.clashAcc >= RIVAL.clashTickMs) {
          rival.clashAcc -= RIVAL.clashTickMs
          this.clashTick(rival)
        }
      } else {
        rival.engaged = false
        const angle = angleBetween(rival.x, rival.y, this.player.x, this.player.y)
        rival.x += Math.cos(angle) * step
        rival.y += Math.sin(angle) * step
      }
    }
  }

  /** One exchange of the duel: both rings shed swords; a side hitting 0 loses. */
  private clashTick(rival: Rival): void {
    const cx = (this.player.x + rival.x) / 2
    const cy = (this.player.y + rival.y) / 2

    if (this.power.power <= 0) {
      this.loseDuel(rival, cx, cy)
      return
    }

    const step = Math.min(rival.clashStep, this.power.power, rival.swordCount)
    this.power.spend(step)
    this.emitPower()
    rival.setCount(rival.swordCount - step)

    this.sparks.explode(8, cx, cy)
    audioService.clash()
    this.cameras.main.shake(60, 0.004)
    const ring = this.add
      .image(cx, cy, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffe08a)
      .setScale(0.2)
      .setDepth(6)
    this.tweens.add({ targets: ring, scale: 0.9, alpha: { from: 0.8, to: 0 }, duration: 200, onComplete: () => ring.destroy() })

    if (rival.swordCount <= 0) this.winDuel(rival, cx, cy)
    else if (this.power.power <= 0) this.loseDuel(rival, cx, cy)
  }

  /** Rival ground down: it drops its swords back (net-zero) + score + flourish. */
  private winDuel(rival: Rival, x: number, y: number): void {
    codexService.mark('rival', rival.skinIndex)
    const loot = rival.initialCount
    rival.engaged = false
    rival.deactivate()
    this.power.addEnemyValue(loot)
    this.emitPower()
    this.scorer.add(loot * RIVAL.scoreMultiplier)
    this.emitScore()
    this.playClashFx(x, y, 0x8ce99a)
    this.cameras.main.flash(220, 120, 255, 150)
    audioService.win()
  }

  /** Player ground down: swords wiped + heavy damage; the rival leaves. */
  private loseDuel(rival: Rival, x: number, y: number): void {
    rival.engaged = false
    rival.deactivate()
    this.power.reset()
    this.emitPower()
    this.playClashFx(x, y, 0xff6b6b)
    this.cameras.main.shake(260, 0.012)
    this.cameras.main.flash(240, 255, 60, 60)
    audioService.lose()
    const dead = this.player.takeDamage(RIVAL.loseDamage)
    this.emitHp()
    if (dead) this.gameOver()
  }

  /** Spark burst + expanding shock ring + "TING!" pop + metallic clang. */
  private playClashFx(x: number, y: number, color: number): void {
    this.sparks.explode(18, x, y)
    const ring = this.add.image(x, y, 'shock').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(0.3)
    this.tweens.add({
      targets: ring,
      scale: 1.7,
      alpha: { from: 0.9, to: 0 },
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
    const text = this.add
      .text(x, y - 12, 'TING!', { fontFamily: 'Segoe UI, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#333333', 4)
      .setDepth(6)
    this.tweens.add({
      targets: text,
      y: y - 54,
      alpha: { from: 1, to: 0 },
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    })
    audioService.clash()
  }

  /** Stacked glow rings under the hero. Base tiers stay subtle; every mega ring
   *  (each 1000 power) is bigger, brighter and pulses harder — more menacing. */
  private updateAura(colors: number[]): void {
    const baseCount = POWER_LAYERS.length
    for (let i = 0; i < this.auraLayers.length; i++) {
      const layer = this.auraLayers[i] as Phaser.GameObjects.Image
      if (i >= colors.length) {
        layer.setVisible(false)
        continue
      }
      const mega = i >= baseCount
      const gap = AURA.layerGap * (mega ? 1.3 : 1)
      const radius = Math.min(AURA.maxRadius, AURA.baseRadius + i * gap)
      const scale = radius / AURA.textureRadius
      const amp = mega ? 0.16 : 0.06 + i * 0.02
      const floor = mega ? 0.26 : Math.max(0.08, 0.3 - i * 0.03)
      const speed = mega ? 110 : 180
      const alpha = floor + amp * Math.sin(this.elapsedMs / speed + i * 0.7)
      layer
        .setVisible(true)
        .setPosition(this.player.x, this.player.y)
        .setTint(colors[i] as number)
        .setScale(scale)
        .setAlpha(alpha)
    }
  }

  private gateOverlapsPlayer(gate: Gate): boolean {
    return (
      Math.abs(gate.x - this.player.x) < GATE.width / 2 + this.player.width / 2 &&
      Math.abs(gate.y - this.player.y) < GATE.height / 2 + this.player.height / 2
    )
  }

  // ---- Collision callbacks (bound arrows so `this` stays the scene) -------

  private onSwordHitEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_swordObj, enemyObj) => {
    const enemy = enemyObj as Enemy
    if (!enemy.active) return
    // Per-enemy cooldown so a sweeping blade doesn't drain HP every frame.
    if (this.elapsedMs - enemy.lastHitAt < SWORD.hitCooldownMs * this.upgrades.cooldownMul) return
    enemy.lastHitAt = this.elapsedMs
    this.playHitSound()
    this.applyStatusOnHit(enemy)

    const eff = this.weaponEffect
    // Weapon crit stacks with the meta crit chance.
    const crit = Math.random() < this.metaCrit + (eff === 'crit' ? 0.25 : 0)
    let mul = crit ? 2 : 1
    if (eff === 'pierce') mul *= 1.35 // armor-piercing: flat bonus damage
    const hitDmg = Math.round(this.power.stats.damage * this.swordDamageMul * mul)
    this.damageNumber(enemy.x, enemy.y - 14, hitDmg, crit ? '#ff5a5a' : '#ffffff')
    const killed = enemy.takeDamage(hitDmg)
    if (killed) {
      this.killEnemy(enemy)
    } else {
      this.sparks.explode(3, enemy.x, enemy.y)
      enemy.setTint(0xffffff)
      enemy.setTintFill()
      this.time.delayedCall(60, () => {
        if (enemy.active) enemy.restoreTint()
      })
    }
    this.applyWeaponEffect(enemy, hitDmg, killed)
  }

  /** The current weapon's signature on-hit effect. */
  private applyWeaponEffect(enemy: Enemy, dmg: number, killed: boolean): void {
    const base = this.power.stats.damage * this.swordDamageMul
    switch (this.weaponEffect) {
      case 'burn':
        if (enemy.active) { enemy.burnUntil = this.elapsedMs + STATUS.burnMs; enemy.burnDps = base * 0.5 }
        break
      case 'frost':
        if (enemy.active) { enemy.chillUntil = this.elapsedMs + STATUS.chillMs; enemy.chillMul = 0.45 }
        break
      case 'venom':
        if (enemy.active) { enemy.poisonUntil = this.elapsedMs + STATUS.poisonMs; enemy.poisonDps = base * 0.4 }
        break
      case 'lifesteal':
        this.player.heal(2)
        if (Math.random() < 0.15) this.emitHp()
        break
      case 'cleave': { // splash to nearby foes
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e === enemy || !e.active) continue
          if (distance(e.x, e.y, enemy.x, enemy.y) < 48 && e.takeDamage(dmg * 0.5)) this.killEnemy(e)
        }
        break
      }
      case 'chain': { // arc lightning to one nearby foe
        let best: Enemy | null = null
        let bestD = 140
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (e === enemy || !e.active) continue
          const d = distance(e.x, e.y, enemy.x, enemy.y)
          if (d < bestD) { bestD = d; best = e }
        }
        if (best) {
          this.ringBlur.lineStyle(2, 0x8adfff, 0.9)
          this.ringBlur.lineBetween(enemy.x, enemy.y, best.x, best.y)
          if (best.takeDamage(dmg * 0.6)) this.killEnemy(best)
          else this.sparks.explode(3, best.x, best.y)
        }
        break
      }
      case 'execute': // chance to detonate a survivor for massive damage
        if (!killed && enemy.active && Math.random() < 0.12) {
          this.sparks.explode(10, enemy.x, enemy.y)
          if (enemy.takeDamage(dmg * 5)) this.killEnemy(enemy)
        }
        break
      case 'holy':
        if (killed) { this.player.heal(3); if (Math.random() < 0.2) this.emitHp() }
        break
      default:
        break
    }
  }

  /** Standard enemy death: fx, reward, chest, volatile chain. */
  private killEnemy(enemy: Enemy): void {
    const ex = enemy.x
    const ey = enemy.y
    const reward = enemy.value
    const volatile = enemy.affix === 'volatile'
    codexService.markKey('troop', enemy.texture.key, 'troop')
    this.killFx(ex, ey)
    audioService.death()
    enemy.deactivate()
    this.registerKill(reward, ex, ey)
    this.maybeDropChest(ex, ey)
    if (volatile) this.explodeVolatile(ex, ey)
  }

  /** Apply owned elemental status upgrades to an enemy on a sword hit. */
  private applyStatusOnHit(enemy: Enemy): void {
    const dmg = this.power.stats.damage * this.swordDamageMul * this.metaStatusMul
    if (this.upgrades.burn > 0) {
      enemy.burnUntil = this.elapsedMs + STATUS.burnMs
      enemy.burnDps = this.upgrades.burn * STATUS.burnDpsPer * dmg
    }
    if (this.upgrades.venom > 0) {
      enemy.poisonUntil = this.elapsedMs + STATUS.poisonMs
      enemy.poisonDps = this.upgrades.venom * STATUS.poisonDpsPer * dmg
    }
    if (this.upgrades.frost > 0) {
      enemy.chillUntil = this.elapsedMs + STATUS.chillMs
      enemy.chillMul = Math.max(STATUS.chillFloor, 1 - this.upgrades.frost * STATUS.chillPer)
    }
  }

  /** A volatile elite detonates: shockwave + killing nearby foes (chain, no re-trigger). */
  private explodeVolatile(x: number, y: number): void {
    this.sparks.explode(20, x, y)
    const ring = this.add
      .image(x, y, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff8a3a)
      .setScale(0.2)
      .setDepth(6)
    this.tweens.add({
      targets: ring,
      scale: (ELITE.volatileRadius * 2) / 64,
      alpha: { from: 0.85, to: 0 },
      duration: 300,
      onComplete: () => ring.destroy(),
    })
    this.cameras.main.shake(120, 0.006)
    audioService.nova()
    for (const obj of this.enemies.getChildren()) {
      const other = obj as Enemy
      if (!other.active) continue
      if (distance(other.x, other.y, x, y) > ELITE.volatileRadius) continue
      const ox = other.x
      const oy = other.y
      const reward = other.value
      this.killFx(ox, oy)
      other.deactivate() // collateral dies directly (no recursive detonation)
      this.registerKill(reward, ox, oy)
    }
  }

  /** Juicy kill burst: spark shower + a fast expanding pop ring. */
  private killFx(x: number, y: number): void {
    this.sparks.explode(14, x, y)
    const ring = this.add
      .image(x, y, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff2a8)
      .setScale(0.25)
    this.tweens.add({
      targets: ring,
      scale: 1.1,
      alpha: { from: 0.85, to: 0 },
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
  }

  private onSwordHitBoss: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_swordObj, bossObj) => {
    const boss = bossObj as Boss
    if (!boss.active) return
    // Damage in ticks scaled by the whole ring so bigger rings kill faster.
    if (this.elapsedMs - boss.lastHitAt < BOSS.hitTickMs) return
    boss.lastHitAt = this.elapsedMs
    this.sparks.explode(6, boss.x, boss.y)
    const dmg = Math.min(this.bossTickDamage(), Math.ceil(boss.maxHp * BOSS.maxHitFraction))
    this.damageNumber(boss.x, boss.y - boss.displayHeight * 0.3, dmg, '#ffd24a')
    if (boss.takeDamage(dmg)) {
      this.bossDefeat()
    } else {
      gameEventBus.emit('boss:hp', { current: boss.hp, max: boss.maxHp })
    }
  }

  private onBossHitPlayer: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, _bossObj) => {
    if (!this.boss.active) return
    void playerObj
    // Share the player i-frame window with every other damage source (orbs,
    // meteors, troops) so overlapping hits can't chain-kill in one instant.
    this.hitPlayer(BOSS.contactDamage)
  }

  /** Throttle chatty sword-hit ticks so they don't overlap into noise. */
  private playHitSound(): void {
    if (this.elapsedMs - this.lastHitSoundAt < 55) return
    this.lastHitSoundAt = this.elapsedMs
    audioService.hit()
  }

  private onEnemyHitPlayer: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, enemyObj) => {
    const enemy = enemyObj as Enemy
    if (!enemy.active) return
    enemy.deactivate()
    if (this.elapsedMs < this.playerInvulnUntil) return
    this.playerInvulnUntil = this.elapsedMs + PLAYER.invulnMs
    const dead = this.player.takeDamage(Math.round(ENEMY.contactDamage * this.playerDefenseMul))
    this.emitHp()
    audioService.hurt()
    if (dead) this.gameOver()
  }

  // ---- Lifecycle / input handlers -----------------------------------------

  private static readonly JOY_RADIUS = 56
  private static readonly JOY_DEADZONE = 10

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.joyActive = true
    this.joyOriginX = pointer.x
    this.joyOriginY = pointer.y
    this.joyVecX = 0
    this.joyVecY = 0
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.joyActive) return
    const dx = pointer.x - this.joyOriginX
    const dy = pointer.y - this.joyOriginY
    const mag = Math.hypot(dx, dy)
    if (mag < BattleScene.JOY_DEADZONE) {
      this.joyVecX = 0
      this.joyVecY = 0
      return
    }
    // Re-center the origin if the drag exceeds the ring (sticky follow).
    if (mag > BattleScene.JOY_RADIUS) {
      this.joyOriginX = pointer.x - (dx / mag) * BattleScene.JOY_RADIUS
      this.joyOriginY = pointer.y - (dy / mag) * BattleScene.JOY_RADIUS
    }
    this.joyVecX = dx / mag
    this.joyVecY = dy / mag
  }

  private onPointerUp = (): void => {
    this.joyActive = false
    this.joyVecX = 0
    this.joyVecY = 0
    this.joystick.clear()
  }

  /** Draw the floating joystick base + thumb while a drag is active. */
  private drawJoystick(): void {
    const g = this.joystick
    g.clear()
    if (!this.joyActive) return
    const ox = this.joyOriginX
    const oy = this.joyOriginY
    g.fillStyle(0xffffff, 0.12)
    g.fillCircle(ox, oy, BattleScene.JOY_RADIUS)
    g.lineStyle(2, 0xffffff, 0.4)
    g.strokeCircle(ox, oy, BattleScene.JOY_RADIUS)
    g.fillStyle(0xffffff, 0.5)
    g.fillCircle(ox + this.joyVecX * BattleScene.JOY_RADIUS, oy + this.joyVecY * BattleScene.JOY_RADIUS, 20)
  }

  /** Current WASD / arrow-key movement vector (unnormalized, -1..1 per axis). */
  private readKeyboard(): { x: number; y: number } {
    const k = this.keys
    if (!k) return { x: 0, y: 0 }
    let x = 0
    let y = 0
    if (k.A?.isDown || k.LEFT?.isDown) x -= 1
    if (k.D?.isDown || k.RIGHT?.isDown) x += 1
    if (k.W?.isDown || k.UP?.isDown) y -= 1
    if (k.S?.isDown || k.DOWN?.isDown) y += 1
    return { x, y }
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    // World bounds stay fixed (the open world); only the screen-pinned layers
    // resize to the new viewport.
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH)
    this.bg.setSize(gameSize.width, gameSize.height)
    this.vignette.setDisplaySize(gameSize.width, gameSize.height)
  }

  private positionDecor(): void {
    for (const item of this.decor) {
      item.img.setPosition(item.nx * this.worldW, item.ny * this.worldH)
    }
  }

  private onRestart = (): void => {
    this.paused = false
    this.scene.restart()
  }

  private onPause = (): void => {
    if (this.isOver) return
    this.paused = true
    this.physics.pause()
  }

  private onResume = (): void => {
    if (this.isOver) return
    this.paused = false
    this.physics.resume()
  }

  private onShutdown = (): void => {
    this.input.off('pointerdown', this.onPointerDown)
    this.input.off('pointermove', this.onPointerMove)
    this.input.off('pointerup', this.onPointerUp)
    this.input.off('pointerupoutside', this.onPointerUp)
    this.scale.off('resize', this.onResize)
    gameEventBus.off('game:restart', this.onRestart)
    gameEventBus.off('game:pause', this.onPause)
    gameEventBus.off('game:resume', this.onResume)
    gameEventBus.off('skill:use', this.onSkill)
    gameEventBus.off('levelup:pick', this.onLevelPick)
  }

  // ---- Skills -------------------------------------------------------------

  private onSkill = ({ id }: { id: string }): void => {
    if (this.isOver) return
    if (id === 'divine') {
      this.useDivineSkill()
      return
    }
    if (id !== 'fury' && id !== 'nova' && id !== 'dash') return
    if (this.elapsedMs < (this.skillReadyAt[id] ?? 0)) return
    const skill = SKILLS[id]
    this.skillReadyAt[id] = this.elapsedMs + skill.cooldownMs
    gameEventBus.emit('skill:started', { id, cooldownMs: skill.cooldownMs, durationMs: skill.durationMs })

    if (id === 'fury') {
      this.furyUntil = this.elapsedMs + SKILLS.fury.durationMs
      this.cameras.main.flash(220, 150, 120, 255)
      audioService.skill()
    } else if (id === 'nova') {
      this.castNova()
    } else {
      // dash: quick burst toward the pointer + brief invulnerability
      this.dashUntil = this.elapsedMs + SKILLS.dash.durationMs
      this.playerInvulnUntil = this.elapsedMs + SKILLS.dash.durationMs
      this.sparks.explode(8, this.player.x, this.player.y)
      audioService.skill()
    }
  }

  /** Nova: a shockwave that damages every enemy on screen. */
  private castNova(): void {
    const dmg = Math.max(
      SKILLS.nova.damage,
      Math.round(this.power.stats.damage * this.swordDamageMul * SKILLS.nova.damageMul),
    )
    this.skillStrike(560, dmg, 0x9d74ff, '#c9a0ff', SKILLS.nova.bossTicks)
  }

  /** Impact on a single enemy from a skill: number, spark, white flash, or kill. */
  private skillHitEnemy(e: Enemy, dmg: number, numColor: string): void {
    this.damageNumber(e.x, e.y - 14, dmg, numColor)
    this.sparks.explode(4, e.x, e.y)
    if (e.takeDamage(dmg)) {
      this.killEnemy(e)
      return
    }
    e.setTint(0xffffff)
    e.setTintFill()
    this.time.delayedCall(70, () => {
      if (e.active) e.restoreTint()
    })
  }

  /**
   * An expanding shockwave that damages every enemy within `radius` (each with a
   * visible impact) and chunks the boss. The ring grows to actually cover the
   * radius, so the wave is SEEN reaching the enemies it hits.
   */
  private skillStrike(radius: number, dmg: number, ringColor: number, numColor: string, bossTicks: number): void {
    const px = this.player.x
    const py = this.player.y
    const ring = this.add
      .image(px, py, 'shock')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(ringColor)
      .setScale(0.3)
      .setDepth(6)
    this.tweens.add({ targets: ring, scale: (radius * 2) / 64, alpha: { from: 0.95, to: 0 }, duration: 500, ease: 'Cubic.Out', onComplete: () => ring.destroy() })
    this.cameras.main.shake(240, 0.011)
    audioService.nova()
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy
      if (!e.active) continue
      if (distance(e.x, e.y, px, py) > radius) continue
      this.skillHitEnemy(e, dmg, numColor)
    }
    if (this.bossActive && this.boss.active && distance(this.boss.x, this.boss.y, px, py) < radius + this.boss.displayWidth) {
      const bd = Math.min(this.bossTickDamage(), Math.ceil(this.boss.maxHp * BOSS.maxHitFraction)) * bossTicks
      this.damageNumber(this.boss.x, this.boss.y - this.boss.displayHeight * 0.3, bd, numColor)
      this.sparks.explode(12, this.boss.x, this.boss.y)
      if (this.boss.takeDamage(bd)) this.bossDefeat()
    }
  }

  // ---- Divine ultimates (one per Divine hero) -----------------------------

  private useDivineSkill(): void {
    const idx = this.divineSkill
    if (idx < 0) return
    if (this.elapsedMs < (this.skillReadyAt.divine ?? 0)) return
    const skill = DIVINE_SKILLS[idx] as { cooldownMs: number; id: string }
    const cd = skill.cooldownMs
    this.skillReadyAt.divine = this.elapsedMs + cd
    gameEventBus.emit('skill:started', { id: 'divine', cooldownMs: cd, durationMs: 0 })
    // Cinematic cut-in + bespoke sound, then a brief beat of hit-stop for punch.
    gameEventBus.emit('divine:cast', { index: idx })
    audioService.ultimate(skill.id)
    this.hitStopUntil = this.frameTime + 90
    this.castDivineSkill(idx)
  }

  /** Big divine shockwave over a wide radius (each enemy shows an impact). */
  private divineDamageAll(mult: number, ringColor: number, radius: number, numColor: string): void {
    this.cameras.main.flash(200, (ringColor >> 16) & 255, (ringColor >> 8) & 255, ringColor & 255)
    const dmg = Math.max(1, Math.round(this.power.stats.damage * this.swordDamageMul * mult))
    this.skillStrike(radius, dmg, ringColor, numColor, 12)
  }

  /** Fire the current Divine hero's unique ultimate. */
  private castDivineSkill(idx: number): void {
    switch (idx) {
      case 0: // Seraph — Divine Judgment: heal to full, shield, radiant nova
        this.player.hp = this.player.maxHp
        this.emitHp()
        this.playerInvulnUntil = this.elapsedMs + 2500
        this.sparks.explode(30, this.player.x, this.player.y)
        this.divineDamageAll(18, 0xfff2b0, 560, '#fff2b0')
        break
      case 1: { // Void Sovereign — Black Hole: pull every enemy inward, then implode
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          const a = angleBetween(e.x, e.y, this.player.x, this.player.y)
          const d = distance(e.x, e.y, this.player.x, this.player.y)
          const pull = Math.min(d, 260)
          e.setPosition(e.x + Math.cos(a) * pull, e.y + Math.sin(a) * pull)
        }
        this.divineDamageAll(16, 0x9d3cff, 460, '#c9a0ff')
        break
      }
      case 2: { // Inferno Lord — Meteor Storm: meteors rain across the view
        const cam = this.cameras.main
        for (let k = 0; k < 10; k++) {
          const tx = cam.scrollX + randomRange(60, this.viewW - 60)
          const ty = cam.scrollY + randomRange(60, this.viewH - 60)
          this.time.delayedCall(k * 90, () => {
            if (this.isOver) return
            this.sparks.explode(14, tx, ty)
            const r = this.add.image(tx, ty, 'shock').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6a2a).setScale(0.2).setDepth(6)
            this.tweens.add({ targets: r, scale: 2.4, alpha: { from: 0.9, to: 0 }, duration: 300, onComplete: () => r.destroy() })
            const dmg = Math.round(this.power.stats.damage * this.swordDamageMul * 6)
            for (const obj of this.enemies.getChildren()) {
              const e = obj as Enemy
              if (e.active && distance(e.x, e.y, tx, ty) < 150) this.skillHitEnemy(e, dmg, '#ffb060')
            }
          })
        }
        this.cameras.main.shake(300, 0.01)
        audioService.nova()
        break
      }
      case 3: // God-Emperor — Cataclysm: screen-wide gold shockwave + hit-stop
        this.hitStopUntil = this.frameTime + 120
        this.divineDamageAll(30, 0xffe14d, 820, '#ffe14d')
        break
      case 4: { // Dragon Ascendant — Dragon Breath: ignite everything
        this.divineDamageAll(8, 0xff7a2a, 560, '#ffb060')
        const burnDps = this.power.stats.damage * this.swordDamageMul * 3
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.burnUntil = this.elapsedMs + 4000
          e.burnDps = burnDps
        }
        break
      }
      case 5: // Death Reaper — Soul Harvest: reap the field + heal per kill
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.5))
        this.emitHp()
        this.divineDamageAll(22, 0x6bff9a, 620, '#6bff9a')
        break
      case 6: { // Storm Titan — Thunderstorm: repeated chain-lightning strikes
        for (let k = 0; k < 6; k++) {
          this.time.delayedCall(k * 120, () => {
            if (this.isOver) return
            const foes = this.enemies.getChildren().filter((o) => (o as Enemy).active)
            const t = foes[Math.floor(Math.random() * foes.length)] as Enemy | undefined
            if (!t) return
            this.sparks.explode(10, t.x, t.y)
            const r = this.add.image(t.x, t.y, 'shock').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8adfff).setScale(0.2).setDepth(6)
            this.tweens.add({ targets: r, scale: 2, alpha: { from: 0.9, to: 0 }, duration: 260, onComplete: () => r.destroy() })
            const dmg = Math.round(this.power.stats.damage * this.swordDamageMul * 10)
            for (const obj of this.enemies.getChildren()) {
              const e = obj as Enemy
              if (e.active && distance(e.x, e.y, t.x, t.y) < 130) this.skillHitEnemy(e, dmg, '#8adfff')
            }
          })
        }
        this.cameras.main.shake(260, 0.008)
        audioService.nova()
        break
      }
      case 7: { // Frost Monarch — Absolute Zero: freeze all + shatter
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.chillUntil = this.elapsedMs + 4000
          e.chillMul = 0.2
        }
        this.divineDamageAll(20, 0x9be7ff, 680, '#dff4ff')
        break
      }
      case 8: { // Blood Warlord — Bloodbath: massive damage + huge lifesteal
        const before = this.countEnemies()
        this.divineDamageAll(26, 0xff2020, 700, '#ff5a5a')
        const healed = Math.max(1, (before - this.countEnemies())) * 4
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healed)
        this.emitHp()
        break
      }
      case 9: // Cosmic Overlord — Big Bang: the ultimate screen-clearing nuke
        this.hitStopUntil = this.frameTime + 140
        this.divineDamageAll(45, 0x9d5cff, 900, '#c9a0ff')
        this.divineDamageAll(45, 0x00ffd0, 700, '#8affff')
        this.cameras.main.shake(400, 0.02)
        break
      case 10: { // Verdant Titan — Wild Overgrowth: root everything + big heal
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.chillUntil = this.elapsedMs + 3500
          e.chillMul = 0.08
        }
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.4))
        this.emitHp()
        this.divineDamageAll(16, 0x6bff6a, 620, '#b6ff8a')
        break
      }
      case 11: { // Tide Emperor — Maelstrom: pull foes in and drown them
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          const a = angleBetween(e.x, e.y, this.player.x, this.player.y)
          const d = distance(e.x, e.y, this.player.x, this.player.y)
          const pull = Math.min(d, 220)
          e.setPosition(e.x + Math.cos(a) * pull, e.y + Math.sin(a) * pull)
          e.chillUntil = this.elapsedMs + 2500
          e.chillMul = 0.45
        }
        this.divineDamageAll(18, 0x2ad0ff, 520, '#8fe6ff')
        break
      }
      case 12: { // Solar Deity — Supernova Flare: blinding burst + ignite all
        this.divineDamageAll(20, 0xffe14d, 720, '#fff2a8')
        const burnDps = this.power.stats.damage * this.swordDamageMul * 4
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.burnUntil = this.elapsedMs + 4000
          e.burnDps = burnDps
        }
        this.cameras.main.flash(320, 255, 240, 180)
        break
      }
      case 13: { // Lunar Sovereign — Eclipse: darkness weakens, then twin pulses
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.chillUntil = this.elapsedMs + 4000
          e.chillMul = 0.35
        }
        this.divineDamageAll(12, 0x3a2a6a, 560, '#b9a8ff')
        this.time.delayedCall(500, () => { if (!this.isOver) this.divineDamageAll(16, 0x1a1030, 620, '#dfd0ff') })
        break
      }
      case 14: { // Chrono Sovereign — Time Stop: freeze foes in place + ticks
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.chillUntil = this.elapsedMs + 5000
          e.chillMul = 0.02
        }
        this.divineDamageAll(14, 0x8afff0, 700, '#dffff8')
        this.time.delayedCall(900, () => { if (!this.isOver) this.divineDamageAll(14, 0xffe08a, 640, '#ffe08a') })
        this.cameras.main.flash(240, 200, 255, 245)
        break
      }
      case 15: { // Stone Titan — Earthquake: expanding stone shockwaves + stagger
        const dmg = Math.max(1, Math.round(this.power.stats.damage * this.swordDamageMul * 12))
        this.skillStrike(420, dmg, 0x9a8a70, '#e6d8b0', 10)
        this.time.delayedCall(260, () => { if (!this.isOver) this.skillStrike(680, dmg, 0x6a6156, '#e6d8b0', 10) })
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.chillUntil = this.elapsedMs + 2000
          e.chillMul = 0.3
        }
        this.cameras.main.shake(500, 0.02)
        audioService.nova()
        break
      }
      case 16: { // Tempest Sovereign — Tornado: roaming cyclones pull & shred
        const cam = this.cameras.main
        for (let k = 0; k < 8; k++) {
          const tx = cam.scrollX + randomRange(60, this.viewW - 60)
          const ty = cam.scrollY + randomRange(60, this.viewH - 60)
          this.time.delayedCall(k * 80, () => {
            if (this.isOver) return
            const r = this.add.image(tx, ty, 'shock').setBlendMode(Phaser.BlendModes.ADD).setTint(0xdff4ff).setScale(0.2).setDepth(6)
            this.tweens.add({ targets: r, scale: 2.2, alpha: { from: 0.9, to: 0 }, duration: 320, onComplete: () => r.destroy() })
            const dmg = Math.round(this.power.stats.damage * this.swordDamageMul * 7)
            for (const obj of this.enemies.getChildren()) {
              const e = obj as Enemy
              if (!e.active) continue
              const d = distance(e.x, e.y, tx, ty)
              if (d < 150) {
                const a = angleBetween(e.x, e.y, tx, ty)
                const pull = Math.min(d, 80)
                e.setPosition(e.x + Math.cos(a) * pull, e.y + Math.sin(a) * pull)
                this.skillHitEnemy(e, dmg, '#dff4ff')
              }
            }
          })
        }
        this.cameras.main.shake(300, 0.006)
        audioService.nova()
        break
      }
      case 17: { // Plague Lord — Pandemic: toxic cloud + venom over time
        this.divineDamageAll(10, 0x6aff2a, 640, '#bfff6a')
        const venomDps = this.power.stats.damage * this.swordDamageMul * 2.5
        for (const obj of this.enemies.getChildren()) {
          const e = obj as Enemy
          if (!e.active) continue
          e.burnUntil = this.elapsedMs + 6000
          e.burnDps = venomDps
          e.chillUntil = this.elapsedMs + 6000
          e.chillMul = 0.6
        }
        break
      }
      case 18: { // Abyssal Tyrant — Rift of Chaos: reality tears strike at random
        const cam = this.cameras.main
        for (let k = 0; k < 14; k++) {
          const tx = cam.scrollX + randomRange(40, this.viewW - 40)
          const ty = cam.scrollY + randomRange(40, this.viewH - 40)
          this.time.delayedCall(k * 60, () => {
            if (this.isOver) return
            this.sparks.explode(12, tx, ty)
            const c = k % 2 ? 0x7a1aff : 0xff2060
            const r = this.add.image(tx, ty, 'shock').setBlendMode(Phaser.BlendModes.ADD).setTint(c).setScale(0.2).setDepth(6)
            this.tweens.add({ targets: r, scale: 2, alpha: { from: 0.95, to: 0 }, duration: 260, onComplete: () => r.destroy() })
            const dmg = Math.round(this.power.stats.damage * this.swordDamageMul * 9)
            for (const obj of this.enemies.getChildren()) {
              const e = obj as Enemy
              if (e.active && distance(e.x, e.y, tx, ty) < 140) this.skillHitEnemy(e, dmg, '#d8a0ff')
            }
          })
        }
        this.cameras.main.shake(360, 0.014)
        audioService.nova()
        break
      }
      default: { // Prism Archon — Prismatic Beam: staggered rainbow shockwaves
        const colors: Array<[number, string]> = [[0xff4d6a, '#ff9db0'], [0x5ad0ff, '#bfeeff'], [0xb06bff, '#e0c8ff']]
        colors.forEach(([ring, num], i) => {
          this.time.delayedCall(i * 180, () => {
            if (!this.isOver) this.divineDamageAll(20, ring, 760, num)
          })
        })
        this.cameras.main.shake(320, 0.014)
      }
    }
  }

  private countEnemies(): number {
    let n = 0
    for (const obj of this.enemies.getChildren()) if ((obj as Enemy).active) n++
    return n
  }

  private gameOver(): void {
    // Second Wind (meta): survive a lethal hit — restore HP, brief mercy, clear
    // the immediate threats, and press on.
    if (this.revivesLeft > 0) {
      this.revivesLeft--
      this.player.hp = this.player.maxHp
      this.emitHp()
      this.playerInvulnUntil = this.elapsedMs + 2000
      this.castNova()
      this.cameras.main.flash(320, 180, 255, 220)
      audioService.win()
      return
    }
    this.isOver = true
    this.physics.pause()
    const coins = Math.floor(this.scorer.score * COINS_PER_SCORE * metaService.coinMul)
    metaService.addCoins(coins)
    const stats: RunStats = {
      kills: this.statKills,
      bosses: this.statBosses,
      topCombo: this.statTopCombo,
      npcsAbsorbed: this.statNpcAbsorbed,
      timeSec: Math.round(this.elapsedMs / 1000),
      bestRank: this.statBestRank,
      totalRanked: this.curTotal,
    }
    // Award milestone achievements (coins already added inside evaluate()).
    const unlocked = achievementService.evaluate({ ...stats, power: this.power.power })
    gameEventBus.emit('game:over', { score: this.scorer.score, power: this.power.power, coins, stats, unlocked })
  }

  // ---- Event emitters ------------------------------------------------------

  private emitPower(): void {
    gameEventBus.emit('power:changed', { power: this.power.power })
  }

  private emitScore(): void {
    gameEventBus.emit('score:changed', { score: this.scorer.score })
  }

  private emitHp(): void {
    gameEventBus.emit('player:hp', { current: this.player.hp, max: this.player.maxHp })
  }
}
