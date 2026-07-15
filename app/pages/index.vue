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
import { HERO, heroName } from '~/game/constants'

const store = useGameStore()

const shopOpen = ref(false)
const coins = ref(0)
// The hero chosen in the Codex (or "auto"), shown so the player knows who they play as.
const heroChoice = ref('')

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
  codexService.load()
  loadoutService.load()
  const chosen = loadoutService.selectedHero
  heroChoice.value = chosen >= 0 && chosen < HERO.skins && codexService.has('hero', chosen) ? heroName(chosen) : ''
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
        <b class="navbtn__meta">💰 {{ formatCompact(coins) }}</b>
      </button>
      <NuxtLink to="/codex" class="navbtn">
        <span class="navbtn__icon" aria-hidden="true">📖</span>
        <span class="navbtn__label">{{ $t('codex.open') }}</span>
      </NuxtLink>
      <NuxtLink to="/guide" class="navbtn">
        <span class="navbtn__icon" aria-hidden="true">❓</span>
        <span class="navbtn__label">{{ $t('guide.title') }}</span>
      </NuxtLink>
    </nav>

    <LanguageSwitcher />

    <div class="menu__content" :style="parallax">
      <h1 class="menu__title">
        <span class="menu__title-line">BLADE</span>
        <span class="menu__title-line menu__title-line--accent">RUSH</span>
      </h1>

      <div class="menu__divider" aria-hidden="true" />
      <p class="menu__tagline">{{ $t('menu.subtitle') }}</p>

      <div class="menu__cta">
        <NuxtLink to="/play" class="cta" @click="startGame">
          <span class="cta__icon" aria-hidden="true">▶</span>
          <span class="cta__label">{{ $t('menu.play') }}</span>
        </NuxtLink>

        <span v-if="store.highScore" class="menu__best">
          🏆 {{ $t('menu.best', { score: formatCompact(store.highScore) }) }}
        </span>
      </div>

      <NuxtLink to="/codex" class="menu__loadout">
        <span class="menu__loadout-icon" aria-hidden="true">🛡️</span>
        {{ $t('menu.playAs', { hero: heroChoice || $t('menu.autoHero') }) }}
      </NuxtLink>
    </div>

    <p class="menu__hint">{{ $t('menu.controls') }}</p>

    <div class="menu__intro" aria-hidden="true" />

    <MenuShop v-if="shopOpen" @close="closeShop" />
  </main>
</template>
