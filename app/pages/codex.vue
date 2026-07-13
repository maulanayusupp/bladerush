<script setup lang="ts">
import { ref } from 'vue'
import CodexCanvas from '~/components/game/CodexCanvas.vue'

const tabs = ['hero', 'rival', 'troop', 'boss', 'weapon'] as const
type Tab = (typeof tabs)[number]
const active = ref<Tab>('hero')
</script>

<template>
  <div class="codex">
    <header class="codex__bar">
      <NuxtLink to="/" class="codex__back" :aria-label="$t('codex.back')">←</NuxtLink>
      <h1 class="codex__title">{{ $t('codex.title') }}</h1>
      <p class="codex__hint">{{ $t('codex.hint') }}</p>
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
