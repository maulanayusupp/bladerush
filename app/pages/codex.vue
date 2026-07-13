<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CodexCanvas from '~/components/game/CodexCanvas.vue'
import { codexService, type CodexCategory } from '~/services/CodexService'
import { BOSS, HERO, RIVAL, SWORD_SHAPES } from '~/game/constants'

const tabs = ['hero', 'rival', 'troop', 'boss', 'weapon'] as const
type Tab = (typeof tabs)[number]
const active = ref<Tab>('hero')

const totals: Record<Tab, number> = {
  hero: HERO.skins,
  rival: RIVAL.skins,
  troop: 100,
  boss: BOSS.skins,
  weapon: SWORD_SHAPES.length,
}

// Read once on mount (progress only changes between runs).
const found = ref<Record<Tab, number>>({ hero: 0, rival: 0, troop: 0, boss: 0, weapon: 0 })
onMounted(() => {
  codexService.load()
  for (const t of tabs) found.value[t] = codexService.count(t as CodexCategory)
})

const activeCount = computed(() => `${found.value[active.value]} / ${totals[active.value]}`)
</script>

<template>
  <div class="codex">
    <header class="codex__bar">
      <NuxtLink to="/" class="codex__back" :aria-label="$t('codex.back')">←</NuxtLink>
      <h1 class="codex__title">{{ $t('codex.title') }}</h1>
      <p class="codex__hint">{{ $t('codex.discovered') }} {{ activeCount }} · {{ $t('codex.hint') }}</p>
      <nav class="codex__tabs">
        <button
          v-for="t in tabs"
          :key="t"
          type="button"
          class="codex__tab"
          :class="{ 'codex__tab--active': active === t }"
          @click="active = t"
        >
          {{ $t('codex.' + t) }}
        </button>
      </nav>
    </header>
    <div class="codex__stage">
      <ClientOnly>
        <CodexCanvas :category="active" />
      </ClientOnly>
    </div>
  </div>
</template>
