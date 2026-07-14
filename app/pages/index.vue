<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '~/components/ui/LanguageSwitcher.vue'
import MenuStage from '~/components/menu/MenuStage.vue'
import MenuFeature from '~/components/menu/MenuFeature.vue'
import MenuShop from '~/components/menu/MenuShop.vue'
import { useGameStore } from '~/stores/useGameStore'
import { formatCompact } from '~/helpers/format.helper'
import { audioService } from '~/services/AudioService'
import { metaService } from '~/services/MetaService'

const store = useGameStore()
const { t } = useI18n()

const shopOpen = ref(false)
const coins = ref(0)

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

const features = computed(() => [
  { icon: '🌀', label: t('menu.features.gates.label'), text: t('menu.features.gates.text') },
  { icon: '⚔️', label: t('menu.features.swords.label'), text: t('menu.features.swords.text') },
  { icon: '👹', label: t('menu.features.rivals.label'), text: t('menu.features.rivals.text') },
])
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

    <LanguageSwitcher />

    <div class="menu__content" :style="parallax">
      <span class="menu__eyebrow">{{ $t('menu.badge') }}</span>

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

        <div class="menu__links">
          <button type="button" class="menu__link" @click="openShop">
            🛒 {{ $t('shop.open') }}
            <b class="menu__link-meta">{{ formatCompact(coins) }}</b>
          </button>
          <span class="menu__link-sep" aria-hidden="true">·</span>
          <NuxtLink to="/codex" class="menu__link">📖 {{ $t('codex.open') }}</NuxtLink>
        </div>

        <span v-if="store.highScore" class="menu__best">
          🏆 {{ $t('menu.best', { score: formatCompact(store.highScore) }) }}
        </span>
      </div>
    </div>

    <ul class="menu__features" :style="parallax">
      <MenuFeature
        v-for="feature in features"
        :key="feature.label"
        :icon="feature.icon"
        :label="feature.label"
        :text="feature.text"
      />
    </ul>

    <p class="menu__hint">{{ $t('menu.controls') }}</p>

    <div class="menu__intro" aria-hidden="true" />

    <MenuShop v-if="shopOpen" @close="closeShop" />
  </main>
</template>
