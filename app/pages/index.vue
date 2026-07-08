<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '~/components/ui/LanguageSwitcher.vue'
import MenuBackground from '~/components/menu/MenuBackground.vue'
import MenuFeature from '~/components/menu/MenuFeature.vue'
import { useGameStore } from '~/stores/useGameStore'
import { formatCompact } from '~/helpers/format.helper'

const store = useGameStore()
const { t } = useI18n()

onMounted(() => store.loadHighScore())

const features = computed(() => [
  { icon: '🌀', label: t('menu.features.gates.label'), text: t('menu.features.gates.text') },
  { icon: '⚔️', label: t('menu.features.swords.label'), text: t('menu.features.swords.text') },
  { icon: '👹', label: t('menu.features.rivals.label'), text: t('menu.features.rivals.text') },
])
</script>

<template>
  <main class="menu">
    <MenuBackground />
    <LanguageSwitcher />

    <div class="menu__content">
      <span class="menu__badge">⚔️ {{ $t('menu.badge') }}</span>

      <h1 class="menu__title">
        BLADE<span class="menu__title-accent">RUSH</span>
      </h1>

      <p class="menu__tagline">{{ $t('menu.subtitle') }}</p>

      <div class="menu__actions">
        <NuxtLink to="/play" class="btn btn--primary btn--xl btn--glow">
          <span class="btn__icon" aria-hidden="true">▶</span>{{ $t('menu.play') }}
        </NuxtLink>
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
    </div>
  </main>
</template>
