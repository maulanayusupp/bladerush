<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import BaseButton from '~/components/ui/BaseButton.vue'
import LevelUpOverlay from '~/components/game/LevelUpOverlay.vue'
import { gameEventBus } from '~/services/EventBus'
import { audioService } from '~/services/AudioService'
import { formatCompact } from '~/helpers/format.helper'
import { useGameStore } from '~/stores/useGameStore'

const store = useGameStore()

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
const comboMult = ref(1)
const level = ref(1)
const xp = ref(0)
const xpNext = ref(1)
const xpRatio = computed(() => (xpNext.value > 0 ? xp.value / xpNext.value : 0))

function toggleMute(): void {
  audioService.unlock()
  muted.value = audioService.toggleMuted()
}

const hpRatio = computed(() => (maxHp.value > 0 ? hp.value / maxHp.value : 0))
const isLowHp = computed(() => hpRatio.value < 0.3)

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
    gameEventBus.on('game:over', ({ score: value, coins }) => {
      isOver.value = true
      finalScore.value = value
      coinsEarned.value = coins
      bossActive.value = false
      store.recordScore(value)
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
      </div>

      <button
        class="hud__mute"
        type="button"
        :aria-label="muted ? $t('hud.unmute') : $t('hud.mute')"
        @click="toggleMute"
      >
        {{ muted ? '🔇' : '🔊' }}
      </button>
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
      <div
        class="hud__health-fill"
        :class="{ 'hud__health-fill--low': isLowHp }"
        :style="{ '--hp-ratio': hpRatio }"
      />
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
        <p class="overlay__coins">💰 +{{ formatCompact(coinsEarned) }} {{ $t('shop.coins') }}</p>
        <BaseButton variant="primary" block @click="restart">{{ $t('gameOver.playAgain') }}</BaseButton>
        <NuxtLink to="/" class="btn btn--block">{{ $t('gameOver.menu') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>
