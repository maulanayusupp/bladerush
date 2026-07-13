<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '~/components/ui/LanguageSwitcher.vue'
import MenuBackground from '~/components/menu/MenuBackground.vue'
import MenuEmblem from '~/components/menu/MenuEmblem.vue'
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

onMounted(() => {
  store.loadHighScore()
  metaService.load()
  coins.value = metaService.coins
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
    <MenuBackground />
    <div class="menu__aura" aria-hidden="true">
      <span class="menu__orb menu__orb--a" />
      <span class="menu__orb menu__orb--b" />
      <span class="menu__orb menu__orb--c" />
    </div>
    <div class="menu__grid" aria-hidden="true" />
    <div class="menu__vignette" aria-hidden="true" />
    <LanguageSwitcher />

    <div class="menu__content">
      <div class="menu__emblem-wrap">
        <MenuEmblem class="menu__emblem" />
      </div>

      <span class="menu__badge">⚔️ {{ $t('menu.badge') }}</span>

      <h1 class="menu__title">
        <span class="menu__title-word" data-text="BLADE">BLADE</span>
        <span class="menu__title-word menu__title-word--accent" data-text="RUSH">RUSH</span>
      </h1>

      <p class="menu__tagline">{{ $t('menu.subtitle') }}</p>

      <div class="menu__actions">
        <NuxtLink to="/play" class="btn btn--primary btn--xl btn--glow btn--shine" @click="startGame">
          <span class="btn__icon" aria-hidden="true">▶</span>{{ $t('menu.play') }}
        </NuxtLink>
        <div class="menu__actions-row">
          <button type="button" class="btn btn--block" @click="openShop">
            🛒 {{ $t('shop.open') }} · 💰 {{ formatCompact(coins) }}
          </button>
          <NuxtLink to="/codex" class="btn btn--block">
            📖 {{ $t('codex.open') }}
          </NuxtLink>
        </div>
        <span v-if="store.highScore" class="menu__best">
          🏆 {{ $t('menu.best', { score: formatCompact(store.highScore) }) }}
        </span>
      </div>

      <ul class="menu__features">
        <MenuFeature
          v-for="feature in features"
          :key="feature.label"
          :icon="feature.icon"
          :label="feature.label"
          :text="feature.text"
        />
      </ul>

      <p class="menu__controls">{{ $t('menu.controls') }}</p>
    </div>

    <MenuShop v-if="shopOpen" @close="closeShop" />
  </main>
</template>
