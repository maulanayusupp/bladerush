<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '~/components/ui/BaseButton.vue'
import LevelUpOverlay from '~/components/game/LevelUpOverlay.vue'
import { gameEventBus } from '~/services/EventBus'
import { audioService } from '~/services/AudioService'
import { settingsService } from '~/services/SettingsService'
import { formatCompact } from '~/helpers/format.helper'
import { useGameStore } from '~/stores/useGameStore'
import { ACHIEVEMENTS, DIVINE_SKILLS, EVOLUTIONS, HERO, HERO_RARITIES, RELICS, heroName, heroRarity } from '~/game/constants'
import type { QuestState, RunStats } from '~/types/game'

const store = useGameStore()
const { t } = useI18n()

/** Icon for an unlocked achievement id (fallback trophy). */
function achIcon(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.icon ?? '🏆'
}
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const power = ref(0)
const score = ref(0)
const hp = ref(0)
const maxHp = ref(1)
const isOver = ref(false)
const finalScore = ref(0)
const coinsEarned = ref(0)
const muted = ref(audioService.muted)

const bossActive = ref(false)
const bossHp = ref(0)
const bossMax = ref(1)
const bossRatio = computed(() => (bossMax.value > 0 ? bossHp.value / bossMax.value : 0))
const comboCount = ref(0)
const rank = ref(1)
const rankTotal = ref(1)
const divineIndex = ref(-1)
const divineSkill = computed(() => (divineIndex.value >= 0 ? DIVINE_SKILLS[divineIndex.value] ?? null : null))
const heroIndex = ref(0)
const heroLabel = computed(() => heroName(heroIndex.value))
const weaponInfo = ref<{ name: string; effect: string } | null>(null)
const weaponStage = ref(0)
const weaponEvolveMsg = ref('')
let weaponEvolveTimer: ReturnType<typeof setTimeout> | null = null
const heroColor = computed(() => {
  const r = HERO_RARITIES[heroRarity(heroIndex.value / (HERO.skins - 1))]
  return `#${(r?.color ?? 0xffffff).toString(16).padStart(6, '0')}`
})
const runStats = ref<RunStats | null>(null)
const unlockedAch = ref<string[]>([])

// ---- Boss Rush (endgame) ----
const bossRush = ref(false)
const rushWave = ref(0)
const rushBanner = ref('')
let rushBannerTimer: ReturnType<typeof setTimeout> | null = null
function flashRushBanner(text: string): void {
  rushBanner.value = text
  if (rushBannerTimer) clearTimeout(rushBannerTimer)
  rushBannerTimer = setTimeout(() => (rushBanner.value = ''), 2600)
}

// ---- Divine ultimate cinematic cut-in ----
const ultCast = ref<{ skill: string; hero: string } | null>(null)
let ultTimer: ReturnType<typeof setTimeout> | null = null

// ---- Map intro banner ----
const mapName = ref('')
let mapTimer: ReturnType<typeof setTimeout> | null = null

// ---- Boss incoming warning ----
const bossWarn = ref(false)
let bossWarnTimer: ReturnType<typeof setTimeout> | null = null

// ---- Hero rarity-up spectacle ----
const rarityUp = ref<{ name: string; color: string } | null>(null)
let rarityTimer: ReturnType<typeof setTimeout> | null = null

// ---- Boss phase-2 banner ----
const bossPhaseUp = ref(false)
let bossPhaseTimer: ReturnType<typeof setTimeout> | null = null

// ---- Session quests ----
const quests = ref<QuestState[]>([])
const questsOpen = ref(true)
const questsDoneCount = computed(() => quests.value.filter((q) => q.done).length)
function toggleQuests(): void {
  questsOpen.value = !questsOpen.value
}
const questToast = ref('')
let questToastTimer: ReturnType<typeof setTimeout> | null = null
function questLabel(q: QuestState): string {
  const n = q.metric === 'power' ? formatCompact(q.target) : q.target
  return t('quest.' + q.metric, { n })
}
function questProgress(q: QuestState): string {
  return `${formatCompact(Math.min(q.value, q.target))}/${formatCompact(q.target)}`
}

// ---- Relics (passive run modifiers) ----
const relics = ref<string[]>([])
function relicIcon(id: string): string {
  return RELICS.find((r) => r.id === id)?.icon ?? '🔮'
}

// ---- Evolved elemental upgrades ----
const evolved = ref<string[]>([])
const evolveMsg = ref('')
let evolveTimer: ReturnType<typeof setTimeout> | null = null
function evolveIcon(id: string): string {
  return EVOLUTIONS[id]?.icon ?? '✨'
}

// ---- Time-attack countdown ----
const timerMs = ref(0)
const showTimer = ref(false)
const timerLabel = computed(() => {
  const total = Math.ceil(timerMs.value / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
})
const timerLow = computed(() => timerMs.value <= 30000)
const comboMult = ref(1)
const level = ref(1)
const xp = ref(0)
const xpNext = ref(1)
const xpRatio = computed(() => (xpNext.value > 0 ? xp.value / xpNext.value : 0))

function toggleMute(): void {
  audioService.unlock()
  muted.value = audioService.toggleMuted()
}

// ---- Pause / Settings ----------------------------------------------------
const paused = ref(false)
const musicOn = ref(audioService.musicOn)
const musicVolume = ref(Math.round(audioService.musicVolume * 100))
const sfxVolume = ref(Math.round(audioService.sfxVolume * 100))
const screenShake = ref(settingsService.screenShake)
const reduceFlash = ref(settingsService.reduceFlash)

function openPause(): void {
  if (isOver.value) return
  paused.value = true
  gameEventBus.emit('game:pause', undefined)
}
function resume(): void {
  paused.value = false
  gameEventBus.emit('game:resume', undefined)
}
function toggleMusic(): void {
  musicOn.value = !musicOn.value
  audioService.setMusicOn(musicOn.value)
}
function onMusicVolume(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  musicVolume.value = v
  audioService.setMusicVolume(v / 100)
}
function onSfxVolume(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  sfxVolume.value = v
  audioService.setSfxVolume(v / 100)
  audioService.hit() // preview tick so the player hears the new level
}
function toggleShake(): void {
  screenShake.value = !screenShake.value
  settingsService.setScreenShake(screenShake.value)
}
function toggleFlash(): void {
  reduceFlash.value = !reduceFlash.value
  settingsService.setReduceFlash(reduceFlash.value)
}

const hpRatio = computed(() => (maxHp.value > 0 ? hp.value / maxHp.value : 0))
const isLowHp = computed(() => hpRatio.value < 0.3)
const hpText = computed(() => `${Math.max(0, Math.round(hp.value))} / ${Math.round(maxHp.value)}`)

// Active skills + their live cooldowns.
const skills = [
  { id: 'dash', icon: '💨' },
  { id: 'fury', icon: '🌀' },
  { id: 'nova', icon: '💥' },
]
const now = ref(0)
const cooldowns = reactive<Record<string, { end: number; total: number }>>({})
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function skillRemaining(id: string): number {
  const c = cooldowns[id]
  return c ? Math.max(0, c.end - now.value) : 0
}
function skillReady(id: string): boolean {
  return skillRemaining(id) <= 0
}
function skillFraction(id: string): number {
  const c = cooldowns[id]
  return c ? Math.max(0, Math.min(1, (c.end - now.value) / c.total)) : 0
}
function skillSeconds(id: string): number {
  return Math.ceil(skillRemaining(id) / 1000)
}
function useSkill(id: string): void {
  if (!skillReady(id)) return
  audioService.unlock()
  gameEventBus.emit('skill:use', { id })
}

const unsubscribers: Array<() => void> = []

onMounted(() => {
  unsubscribers.push(
    gameEventBus.on('power:changed', ({ power: value }) => (power.value = value)),
    gameEventBus.on('score:changed', ({ score: value }) => (score.value = value)),
    gameEventBus.on('player:hp', ({ current, max }) => {
      hp.value = current
      maxHp.value = max
    }),
    gameEventBus.on('game:over', ({ score: value, coins, stats, unlocked }) => {
      isOver.value = true
      finalScore.value = value
      coinsEarned.value = coins
      runStats.value = stats
      unlockedAch.value = unlocked
      bossActive.value = false
      store.recordScore(value)
    }),
    gameEventBus.on('rank:changed', ({ rank: r, total }) => {
      rank.value = r
      rankTotal.value = total
    }),
    gameEventBus.on('skill:divine', ({ index }) => (divineIndex.value = index)),
    gameEventBus.on('hero:changed', ({ index }) => (heroIndex.value = index)),
    gameEventBus.on('weapon:set', (w) => {
      weaponInfo.value = w
      weaponStage.value = 0
    }),
    gameEventBus.on('weapon:evolve', ({ stage }) => {
      weaponStage.value = stage
      weaponEvolveMsg.value = t('weapon.evolved', { effect: weaponInfo.value ? t('weffect.' + weaponInfo.value.effect) : '' })
      if (weaponEvolveTimer) clearTimeout(weaponEvolveTimer)
      weaponEvolveTimer = setTimeout(() => (weaponEvolveMsg.value = ''), 2400)
    }),
    gameEventBus.on('boss:spawn', ({ maxHp, warn }) => {
      bossActive.value = true
      bossMax.value = maxHp
      bossHp.value = maxHp
      if (warn) {
        bossWarn.value = true
        if (bossWarnTimer) clearTimeout(bossWarnTimer)
        bossWarnTimer = setTimeout(() => (bossWarn.value = false), 2400)
      }
    }),
    gameEventBus.on('boss:hp', ({ current, max }) => {
      bossHp.value = current
      bossMax.value = max
    }),
    gameEventBus.on('boss:end', () => (bossActive.value = false)),
    gameEventBus.on('combo:changed', ({ count, mult }) => {
      comboCount.value = count
      comboMult.value = mult
    }),
    gameEventBus.on('xp:changed', ({ level: lv, xp: cur, next }) => {
      level.value = lv
      xp.value = cur
      xpNext.value = next
    }),
    gameEventBus.on('skill:started', ({ id, cooldownMs }) => {
      cooldowns[id] = { end: Date.now() + cooldownMs, total: cooldownMs }
    }),
    gameEventBus.on('skill:reset', () => {
      for (const key of Object.keys(cooldowns)) delete cooldowns[key]
    }),
    gameEventBus.on('rush:start', () => {
      bossRush.value = true
      rushWave.value = 0
      flashRushBanner(t('rush.start'))
    }),
    gameEventBus.on('rush:wave', ({ wave, cleared }) => {
      if (cleared) {
        flashRushBanner(t('rush.cleared', { wave }))
      } else {
        rushWave.value = wave
        flashRushBanner(t('rush.wave', { wave }))
      }
    }),
    gameEventBus.on('timer:changed', ({ remainingMs }) => {
      showTimer.value = true
      timerMs.value = remainingMs
    }),
    gameEventBus.on('relic:gained', ({ id }) => {
      if (!relics.value.includes(id)) relics.value = [...relics.value, id]
    }),
    gameEventBus.on('map:set', ({ key }) => {
      mapName.value = t('maps.' + key)
      if (mapTimer) clearTimeout(mapTimer)
      mapTimer = setTimeout(() => (mapName.value = ''), 2800)
    }),
    gameEventBus.on('quest:sync', ({ quests: list }) => {
      quests.value = list
    }),
    gameEventBus.on('quest:done', ({ coins }) => {
      questToast.value = t('quest.done', { coins })
      if (questToastTimer) clearTimeout(questToastTimer)
      questToastTimer = setTimeout(() => (questToast.value = ''), 2400)
    }),
    gameEventBus.on('boss:phase', () => {
      bossPhaseUp.value = true
      if (bossPhaseTimer) clearTimeout(bossPhaseTimer)
      bossPhaseTimer = setTimeout(() => (bossPhaseUp.value = false), 2200)
    }),
    gameEventBus.on('hero:rarityup', ({ rarity }) => {
      const r = HERO_RARITIES[rarity]
      if (!r) return
      rarityUp.value = {
        name: t('rarity.' + r.id),
        color: `#${r.color.toString(16).padStart(6, '0')}`,
      }
      if (rarityTimer) clearTimeout(rarityTimer)
      rarityTimer = setTimeout(() => (rarityUp.value = null), 2200)
    }),
    gameEventBus.on('upgrade:evolved', ({ id }) => {
      if (!evolved.value.includes(id)) evolved.value = [...evolved.value, id]
      evolveMsg.value = `${t('evolve.title')} · ${t('evolve.' + id)}`
      if (evolveTimer) clearTimeout(evolveTimer)
      evolveTimer = setTimeout(() => (evolveMsg.value = ''), 2600)
    }),
    gameEventBus.on('divine:cast', ({ index }) => {
      const s = DIVINE_SKILLS[index]
      if (!s) return
      ultCast.value = { skill: t('dskill.' + s.id), hero: heroLabel.value }
      if (ultTimer) clearTimeout(ultTimer)
      ultTimer = setTimeout(() => (ultCast.value = null), 1300)
    }),
    gameEventBus.on('game:restart', () => {
      bossRush.value = false
      rushWave.value = 0
      rushBanner.value = ''
      ultCast.value = null
      showTimer.value = false
      relics.value = []
      evolved.value = []
      evolveMsg.value = ''
      rarityUp.value = null
      bossPhaseUp.value = false
      quests.value = []
      questToast.value = ''
      weaponStage.value = 0
      weaponEvolveMsg.value = ''
    }),
  )
  cooldownTimer = setInterval(() => (now.value = Date.now()), 100)
})

onUnmounted(() => {
  unsubscribers.forEach((off) => off())
  if (cooldownTimer) clearInterval(cooldownTimer)
  if (rushBannerTimer) clearTimeout(rushBannerTimer)
  if (ultTimer) clearTimeout(ultTimer)
  if (mapTimer) clearTimeout(mapTimer)
  if (bossWarnTimer) clearTimeout(bossWarnTimer)
  if (evolveTimer) clearTimeout(evolveTimer)
  if (rarityTimer) clearTimeout(rarityTimer)
  if (bossPhaseTimer) clearTimeout(bossPhaseTimer)
  if (questToastTimer) clearTimeout(questToastTimer)
  if (weaponEvolveTimer) clearTimeout(weaponEvolveTimer)
})

function restart(): void {
  isOver.value = false
  power.value = 0
  score.value = 0
  divineIndex.value = -1
  heroIndex.value = 0
  gameEventBus.emit('game:restart', undefined)
}
</script>

<template>
  <div class="hud">
    <div class="hud__top">
      <div class="hud__chips">
        <div class="hud__chip hud__chip--level">
          <span class="hud__chip-label">{{ $t('hud.level') }}</span>
          <b class="hud__chip-value">{{ level }}</b>
        </div>
        <div class="hud__chip">
          <span class="hud__chip-label">{{ $t('hud.power') }}</span>
          <b class="hud__chip-value hud__chip-value--power">{{ formatCompact(power) }}</b>
        </div>
        <div class="hud__chip">
          <span class="hud__chip-label">{{ $t('hud.score') }}</span>
          <b class="hud__chip-value hud__chip-value--score">{{ formatCompact(score) }}</b>
        </div>
        <div class="hud__chip" :class="{ 'hud__chip--rank1': rank === 1 }">
          <span class="hud__chip-label">{{ $t('hud.rank') }}</span>
          <b class="hud__chip-value">#{{ rank }}/{{ rankTotal }}</b>
        </div>
      </div>

      <div class="hud__top-buttons">
        <button
          class="hud__mute"
          type="button"
          :aria-label="muted ? $t('hud.unmute') : $t('hud.mute')"
          @click="toggleMute"
        >
          {{ muted ? '🔇' : '🔊' }}
        </button>
        <button
          v-if="!isOver"
          class="hud__mute"
          type="button"
          :aria-label="$t('pause.title')"
          @click="openPause"
        >
          ⏸️
        </button>
      </div>
    </div>

    <div class="hud__xp">
      <div class="hud__xp-fill" :style="{ '--xp-ratio': xpRatio }" />
    </div>

    <div v-if="relics.length" class="hud__relics">
      <span
        v-for="id in relics"
        :key="id"
        class="hud__relic"
        :title="$t('relic.' + id + '.name')"
      >{{ relicIcon(id) }}</span>
    </div>

    <div v-if="evolved.length" class="hud__relics hud__relics--evolved">
      <span
        v-for="id in evolved"
        :key="id"
        class="hud__relic hud__relic--evolved"
        :title="$t('evolve.' + id)"
      >{{ evolveIcon(id) }}</span>
    </div>

    <Transition name="hud-rush">
      <div v-if="evolveMsg" class="hud__evolve-banner">✦ {{ evolveMsg }}</div>
    </Transition>

    <Transition name="hud-map">
      <div v-if="mapName" class="hud__map" aria-hidden="true">
        <span class="hud__map-eyebrow">{{ $t('maps.entering') }}</span>
        <span class="hud__map-name">{{ mapName }}</span>
      </div>
    </Transition>

    <div v-if="quests.length && !isOver" class="hud__quests">
      <button type="button" class="hud__quests-toggle" @click="toggleQuests">
        🎯 <span class="hud__quests-count">{{ questsDoneCount }}/{{ quests.length }}</span>
        <span class="hud__quests-caret">{{ questsOpen ? '▾' : '▸' }}</span>
      </button>
      <div v-if="questsOpen" class="hud__quests-list">
        <div
          v-for="q in quests"
          :key="q.id"
          class="hud__quest"
          :class="{ 'hud__quest--done': q.done }"
        >
          <span class="hud__quest-icon" aria-hidden="true">{{ q.done ? '✓' : q.icon }}</span>
          <div class="hud__quest-body">
            <span class="hud__quest-label">
              {{ questLabel(q) }}
              <b class="hud__quest-prog">{{ questProgress(q) }}</b>
            </span>
            <span class="hud__quest-bar"><span class="hud__quest-fill" :style="{ '--q': Math.min(1, q.value / q.target) }" /></span>
          </div>
        </div>
      </div>
    </div>

    <Transition name="hud-rush">
      <div v-if="questToast" class="hud__quest-toast">🎯 {{ questToast }}</div>
    </Transition>

    <Transition name="hud-rush">
      <div v-if="weaponEvolveMsg" class="hud__weapon-banner">🗡️ {{ weaponEvolveMsg }}</div>
    </Transition>

    <div v-if="bossRush" class="hud__rush-vignette" aria-hidden="true" />

    <Transition name="hud-ult">
      <div v-if="ultCast" class="hud__ult" aria-hidden="true">
        <div class="hud__ult-band">
          <span class="hud__ult-hero">{{ ultCast.hero }}</span>
          <span class="hud__ult-name">{{ ultCast.skill }}</span>
        </div>
      </div>
    </Transition>

    <Transition name="hud-rarity">
      <div v-if="rarityUp" class="hud__rarity" :style="{ '--rc': rarityUp.color }" aria-hidden="true">
        <span class="hud__rarity-eyebrow">{{ $t('evolve.title') }}</span>
        <span class="hud__rarity-name">{{ rarityUp.name }}</span>
      </div>
    </Transition>

    <Transition name="hud-rush">
      <div v-if="bossWarn" class="hud__boss-warn">⚠ {{ $t('hud.bossIncoming') }}</div>
    </Transition>

    <Transition name="hud-rush">
      <div v-if="bossPhaseUp" class="hud__boss-warn">☠ {{ $t('hud.bossPhase') }}</div>
    </Transition>

    <Transition name="hud-rush">
      <div v-if="rushBanner" class="hud__rush-banner">{{ rushBanner }}</div>
    </Transition>

    <div v-if="bossRush" class="hud__rush-wave">☠ {{ $t('rush.waveShort', { wave: rushWave }) }}</div>

    <div v-if="showTimer" class="hud__timer" :class="{ 'hud__timer--low': timerLow }">⏱ {{ timerLabel }}</div>

    <div v-if="bossActive" class="hud__boss">
      <div class="hud__boss-top">
        <span class="hud__boss-label">{{ bossRush ? $t('rush.lead') : $t('hud.boss') }}</span>
        <span class="hud__boss-hp">{{ formatCompact(bossHp) }} / {{ formatCompact(bossMax) }}</span>
      </div>
      <div class="hud__boss-bar">
        <div class="hud__boss-fill" :style="{ '--boss-ratio': bossRatio }" />
      </div>
    </div>

    <div v-if="comboCount >= 2" class="hud__combo">
      <span class="hud__combo-mult">×{{ comboMult }}</span>
      <span class="hud__combo-label">{{ comboCount }} {{ $t('hud.combo') }}</span>
    </div>

    <div class="hud__hero" :style="{ '--rarity': heroColor }">{{ heroLabel }}</div>
    <div v-if="weaponInfo" class="hud__weapon">
      🗡️ {{ weaponInfo.name }} · {{ $t('weffect.' + weaponInfo.effect) }}<span v-if="weaponStage > 0" class="hud__weapon-tier">{{ '★'.repeat(weaponStage) }}</span>
    </div>

    <div class="hud__health">
      <span class="hud__health-icon" aria-hidden="true">❤️</span>
      <div class="hud__health-bar">
        <div
          class="hud__health-fill"
          :class="{ 'hud__health-fill--low': isLowHp }"
          :style="{ '--hp-ratio': hpRatio }"
        />
      </div>
      <span class="hud__health-value" :class="{ 'hud__health-value--low': isLowHp }">{{ hpText }}</span>
    </div>

    <div class="hud__skills">
      <button
        v-for="skill in skills"
        :key="skill.id"
        class="hud__skill"
        :class="{ 'hud__skill--cooling': !skillReady(skill.id) }"
        type="button"
        :style="{ '--cd': skillFraction(skill.id) }"
        :disabled="!skillReady(skill.id)"
        :aria-label="$t('hud.skills.' + skill.id)"
        @click="useSkill(skill.id)"
      >
        <span class="hud__skill-icon">{{ skill.icon }}</span>
        <span v-if="!skillReady(skill.id)" class="hud__skill-cd">{{ skillSeconds(skill.id) }}</span>
      </button>
      <button
        v-if="divineSkill"
        class="hud__skill hud__skill--divine"
        :class="{ 'hud__skill--cooling': !skillReady('divine') }"
        type="button"
        :style="{ '--cd': skillFraction('divine') }"
        :disabled="!skillReady('divine')"
        :aria-label="$t('dskill.' + divineSkill.id)"
        @click="useSkill('divine')"
      >
        <span class="hud__skill-icon">{{ divineSkill.icon }}</span>
        <span v-if="!skillReady('divine')" class="hud__skill-cd">{{ skillSeconds('divine') }}</span>
      </button>
    </div>

    <LevelUpOverlay />

    <div v-if="paused && !isOver" class="overlay">
      <div class="overlay__panel">
        <h2 class="u-title">{{ $t('pause.title') }}</h2>
        <div class="hud__settings">
          <button class="hud__setting" type="button" @click="toggleMute">
            <span>{{ $t('pause.sound') }}</span>
            <b>{{ muted ? $t('pause.off') : $t('pause.on') }}</b>
          </button>
          <button class="hud__setting" type="button" @click="toggleMusic">
            <span>{{ $t('pause.music') }}</span>
            <b>{{ musicOn ? $t('pause.on') : $t('pause.off') }}</b>
          </button>
          <label class="hud__setting hud__setting--range">
            <span>{{ $t('pause.musicVolume') }}</span>
            <input type="range" min="0" max="100" :value="musicVolume" @input="onMusicVolume">
          </label>
          <label class="hud__setting hud__setting--range">
            <span>{{ $t('pause.sfxVolume') }}</span>
            <input type="range" min="0" max="100" :value="sfxVolume" @input="onSfxVolume">
          </label>
          <button class="hud__setting" type="button" @click="toggleShake">
            <span>{{ $t('pause.shake') }}</span>
            <b>{{ screenShake ? $t('pause.on') : $t('pause.off') }}</b>
          </button>
          <button class="hud__setting" type="button" @click="toggleFlash">
            <span>{{ $t('pause.reduceFlash') }}</span>
            <b>{{ reduceFlash ? $t('pause.on') : $t('pause.off') }}</b>
          </button>
        </div>
        <BaseButton variant="primary" block @click="resume">{{ $t('pause.resume') }}</BaseButton>
        <NuxtLink to="/" class="btn btn--block">{{ $t('gameOver.menu') }}</NuxtLink>
      </div>
    </div>

    <div v-if="isOver" class="overlay">
      <div class="overlay__panel">
        <h2 class="u-title">{{ $t('gameOver.title') }}</h2>
        <div class="overlay__stats">
          <div>
            <p class="u-text-muted">{{ $t('gameOver.score') }}</p>
            <p class="overlay__stat-value">{{ formatCompact(finalScore) }}</p>
          </div>
          <div>
            <p class="u-text-muted">{{ $t('gameOver.best') }}</p>
            <p class="overlay__stat-value">{{ formatCompact(store.highScore) }}</p>
          </div>
        </div>
        <ul v-if="runStats" class="overlay__summary">
          <li><span>⚔️ {{ $t('summary.kills') }}</span><b>{{ formatCompact(runStats.kills) }}</b></li>
          <li><span>💀 {{ $t('summary.bosses') }}</span><b>{{ runStats.bosses }}</b></li>
          <li><span>🔥 {{ $t('summary.combo') }}</span><b>×{{ runStats.topCombo }}</b></li>
          <li><span>🩸 {{ $t('summary.absorbed') }}</span><b>{{ runStats.npcsAbsorbed }}</b></li>
          <li><span>🏆 {{ $t('summary.rank') }}</span><b>#{{ runStats.bestRank }}/{{ runStats.totalRanked }}</b></li>
          <li><span>⏱️ {{ $t('summary.time') }}</span><b>{{ fmtTime(runStats.timeSec) }}</b></li>
        </ul>
        <p class="overlay__coins">💰 +{{ formatCompact(coinsEarned) }} {{ $t('shop.coins') }}</p>
        <div v-if="unlockedAch.length" class="overlay__ach">
          <p class="overlay__ach-title">🎖️ {{ $t('summary.unlocked') }}</p>
          <span v-for="id in unlockedAch" :key="id" class="overlay__ach-item">
            {{ achIcon(id) }} {{ $t('ach.' + id) }}
          </span>
        </div>
        <BaseButton variant="primary" block @click="restart">{{ $t('gameOver.playAgain') }}</BaseButton>
        <NuxtLink to="/" class="btn btn--block">{{ $t('gameOver.menu') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>
