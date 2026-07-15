<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CodexCanvas from '~/components/game/CodexCanvas.vue'
import { codexService, type CodexCategory } from '~/services/CodexService'
import { metaService } from '~/services/MetaService'
import { gameEventBus } from '~/services/EventBus'
import { formatCompact } from '~/helpers/format.helper'
import { BOSS, HERO, HERO_RARITIES, RIVAL, SWORD_SHAPES, TROOP } from '~/game/constants'

const rarities = HERO_RARITIES.map((r) => ({ id: r.id, css: `#${r.color.toString(16).padStart(6, '0')}` }))

const tabs = ['hero', 'rival', 'troop', 'boss', 'weapon'] as const
type Tab = (typeof tabs)[number]
const active = ref<Tab>('hero')

const totals: Record<Tab, number> = {
  hero: HERO.skins,
  rival: RIVAL.skins,
  troop: TROOP.count,
  boss: BOSS.skins,
  weapon: SWORD_SHAPES.length,
}

// Read once on mount (progress only changes between runs).
const found = ref<Record<Tab, number>>({ hero: 0, rival: 0, troop: 0, boss: 0, weapon: 0 })
const coins = ref(0)
let offCoins: (() => void) | null = null

function refreshFound(): void {
  for (const t of tabs) found.value[t] = codexService.count(t as CodexCategory)
}

onMounted(() => {
  codexService.load()
  metaService.load()
  coins.value = metaService.coins
  refreshFound()
  // Unlocking a hero in the canvas spends coins + discovers it — keep the header live.
  offCoins = gameEventBus.on('meta:coins', ({ coins: c }) => {
    coins.value = c
    codexService.load()
    refreshFound()
  })
})

onUnmounted(() => {
  offCoins?.()
})

const activeCount = computed(() => `${found.value[active.value]} / ${totals[active.value]}`)
</script>

<template>
  <div class="codex">
    <header class="codex__bar">
      <NuxtLink to="/" class="codex__back" :aria-label="$t('codex.back')">←</NuxtLink>
      <h1 class="codex__title">{{ $t('codex.title') }}</h1>
      <div v-if="active === 'hero'" class="codex__coins">💰 {{ formatCompact(coins) }}</div>
      <p class="codex__hint">
        {{ $t('codex.discovered') }} {{ activeCount }}
        <template v-if="active === 'hero'"> · {{ $t('codex.selectHint') }}</template>
        <template v-else> · {{ $t('codex.hint') }}</template>
      </p>
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
      <div v-if="active === 'hero'" class="codex__legend">
        <span v-for="r in rarities" :key="r.id" class="codex__rarity" :style="{ '--c': r.css }">
          {{ $t('rarity.' + r.id) }}
        </span>
      </div>
    </header>
    <div class="codex__stage">
      <ClientOnly>
        <CodexCanvas :category="active" />
      </ClientOnly>
    </div>
  </div>
</template>
