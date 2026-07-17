<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LanguageSwitcher from '~/components/ui/LanguageSwitcher.vue'
import MenuStage from '~/components/menu/MenuStage.vue'
import MenuShop from '~/components/menu/MenuShop.vue'
import { useGameStore } from '~/stores/useGameStore'
import { formatCompact } from '~/helpers/format.helper'
import { audioService } from '~/services/AudioService'
import { metaService } from '~/services/MetaService'
import { loadoutService } from '~/services/LoadoutService'
import { codexService } from '~/services/CodexService'
import { modeService, GAME_MODES, type GameMode } from '~/services/ModeService'
import { HERO, heroName } from '~/game/constants'

const store = useGameStore()

const shopOpen = ref(false)
const coins = ref(0)
const stars = ref(0)
// The hero chosen in the Codex (or "auto"), shown so the player knows who they play as.
const heroChoice = ref('')
// Selected game mode (persisted).
const mode = ref<GameMode>('normal')
const modes = GAME_MODES
const MODE_ICONS: Record<GameMode, string> = {
  normal: '⚔️',
  endless: '♾️',
  bossrush: '☠️',
  timeattack: '⏱️',
}
function selectMode(m: GameMode): void {
  mode.value = m
  modeService.setMode(m)
}

// Subtle DOM parallax — kept as CSS custom properties (data, not styling).
const parallax = ref({ '--px': '0', '--py': '0' })
let reduced = false

function onPointer(e: PointerEvent): void {
  const x = (e.clientX / window.innerWidth) * 2 - 1
  const y = (e.clientY / window.innerHeight) * 2 - 1
  parallax.value = { '--px': x.toFixed(3), '--py': y.toFixed(3) }
}

onMounted(() => {
  store.loadHighScore()
  metaService.load()
  coins.value = metaService.coins
  stars.value = metaService.prestigeStars
  codexService.load()
  loadoutService.load()
  const chosen = loadoutService.selectedHero
  heroChoice.value = chosen >= 0 && chosen < HERO.skins && codexService.has('hero', chosen) ? heroName(chosen) : ''
  mode.value = modeService.mode
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointer)
})

function openShop(): void {
  shopOpen.value = true
}
function closeShop(): void {
  shopOpen.value = false
  coins.value = metaService.coins
  stars.value = metaService.prestigeStars
}

// Unlock audio on this user gesture; the singleton persists into /play.
function startGame(): void {
  audioService.unlock()
}
</script>

<template>
  <main class="menu">
    <MenuStage />
    <div class="menu__scrim" aria-hidden="true" />
    <div class="menu__vignette" aria-hidden="true" />
    <div class="menu__grain" aria-hidden="true" />
    <div class="menu__bars" aria-hidden="true">
      <span class="menu__bar menu__bar--top" />
      <span class="menu__bar menu__bar--bottom" />
    </div>

    <nav class="menu__nav" :aria-label="$t('menu.nav')">
      <button type="button" class="navbtn" @click="openShop">
        <span class="navbtn__icon" aria-hidden="true">🛒</span>
        <span class="navbtn__label">{{ $t('shop.open') }}</span>
      </button>
      <NuxtLink to="/codex" class="navbtn">
        <span class="navbtn__icon" aria-hidden="true">📖</span>
        <span class="navbtn__label">{{ $t('codex.open') }}</span>
      </NuxtLink>
      <NuxtLink to="/guide" class="navbtn">
        <span class="navbtn__icon" aria-hidden="true">❓</span>
        <span class="navbtn__label">{{ $t('guide.title') }}</span>
      </NuxtLink>
      <NuxtLink to="/changelog" class="navbtn">
        <span class="navbtn__icon" aria-hidden="true">📜</span>
        <span class="navbtn__label">{{ $t('changelog.title') }}</span>
      </NuxtLink>
    </nav>

    <LanguageSwitcher />

    <div class="menu__content" :style="parallax">
      <div class="menu__hero">
        <span class="menu__badge">{{ $t('menu.badge') }}</span>
        <h1 class="menu__title">
          <span class="menu__title-line">BLADE</span>
          <span class="menu__title-line menu__title-line--accent">RUSH</span>
        </h1>
        <p class="menu__tagline">{{ $t('menu.subtitle') }}</p>
      </div>

      <section class="console">
        <div class="console__group">
          <span class="console__label">{{ $t('mode.label') }}</span>
          <div class="console__modes" role="tablist" :aria-label="$t('mode.label')">
            <button
              v-for="m in modes"
              :key="m"
              type="button"
              role="tab"
              class="modecard"
              :class="{ 'modecard--active': mode === m }"
              :aria-selected="mode === m"
              @click="selectMode(m)"
            >
              <span class="modecard__icon" aria-hidden="true">{{ MODE_ICONS[m] }}</span>
              <span class="modecard__name">{{ $t('mode.' + m) }}</span>
            </button>
          </div>
          <p class="console__desc">{{ $t('mode.' + mode + 'Desc') }}</p>
        </div>

        <NuxtLink to="/play" class="cta" @click="startGame">
          <span class="cta__icon" aria-hidden="true">▶</span>
          <span class="cta__label">{{ $t('menu.play') }}</span>
        </NuxtLink>

        <div class="console__stats">
          <NuxtLink to="/codex" class="stat stat--hero">
            <span class="stat__icon" aria-hidden="true">🛡️</span>
            <span class="stat__body">
              <b class="stat__label">{{ $t('menu.heroLabel') }}</b>
              <span class="stat__value">{{ heroChoice || $t('menu.autoHero') }}</span>
            </span>
          </NuxtLink>
          <div class="stat">
            <span class="stat__icon" aria-hidden="true">🏆</span>
            <span class="stat__body">
              <b class="stat__label">{{ $t('menu.bestLabel') }}</b>
              <span class="stat__value">{{ formatCompact(store.highScore) }}</span>
            </span>
          </div>
          <button type="button" class="stat stat--action" @click="openShop">
            <span class="stat__icon" aria-hidden="true">💰</span>
            <span class="stat__body">
              <b class="stat__label">{{ $t('menu.coinsLabel') }}</b>
              <span class="stat__value">{{ formatCompact(coins) }}</span>
            </span>
          </button>
          <button v-if="stars > 0" type="button" class="stat stat--action stat--star" @click="openShop">
            <span class="stat__icon" aria-hidden="true">⭐</span>
            <span class="stat__body">
              <b class="stat__label">{{ $t('menu.prestigeLabel') }}</b>
              <span class="stat__value">{{ stars }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <p class="menu__hint">{{ $t('menu.controls') }}</p>

    <div class="menu__intro" aria-hidden="true" />

    <MenuShop v-if="shopOpen" @close="closeShop" />
  </main>
</template>
