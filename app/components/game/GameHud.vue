<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import BaseButton from '~/components/ui/BaseButton.vue'
import LevelUpOverlay from '~/components/game/LevelUpOverlay.vue'
import { gameEventBus } from '~/services/EventBus'
import { audioService } from '~/services/AudioService'
import { formatCompact } from '~/helpers/format.helper'
import { useGameStore } from '~/stores/useGameStore'
import { ACHIEVEMENTS } from '~/game/constants'
import type { RunStats } from '~/types/game'

const store = useGameStore()

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
const runStats = ref<RunStats | null>(null)
const unlockedAch = ref<string[]>([])
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
    gameEventBus.on('boss:spawn', ({ maxHp }) => {
      bossActive.value = true
      bossMax.value = maxHp
      bossHp.value = maxHp
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
  )
  cooldownTimer = setInterval(() => (now.value = Date.now()), 100)
})

onUnmounted(() => {
  unsubscribers.forEach((off) => off())
  if (cooldownTimer) clearInterval(cooldownTimer)
})

function restart(): void {
  isOver.value = false
  power.value = 0
  score.value = 0
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

    <div v-if="bossActive" class="hud__boss">
      <div class="hud__boss-top">
        <span class="hud__boss-label">{{ $t('hud.boss') }}</span>
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
