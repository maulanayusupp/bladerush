<script setup lang="ts">
import { computed } from 'vue'
import changelog from '~/data/changelog.json'

interface Entry { date: string; tag: string; title: string; detail: string }

const entries = changelog.entries as Entry[]

// Group entries by date, newest first.
const groups = computed(() => {
  const byDate = new Map<string, Entry[]>()
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    const arr = byDate.get(e.date) ?? []
    arr.push(e)
    byDate.set(e.date, arr)
  }
  return [...byDate.entries()].map(([date, items]) => ({ date, items }))
})

// Deterministic date format (no locale → no SSR/hydration mismatch).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${day} ${MONTHS[(m ?? 1) - 1]} ${y}`
}
</script>

<template>
  <main class="changelog">
    <header class="changelog__bar">
      <NuxtLink to="/" class="changelog__back" :aria-label="$t('changelog.back')">←</NuxtLink>
      <div class="changelog__headings">
        <h1 class="changelog__title">{{ $t('changelog.title') }}</h1>
        <p class="changelog__subtitle">{{ $t('changelog.subtitle') }}</p>
      </div>
    </header>

    <div class="changelog__scroll">
      <div class="changelog__inner">
        <section v-for="group in groups" :key="group.date" class="changelog__group">
          <div class="changelog__date">
            <span class="changelog__date-dot" aria-hidden="true" />
            {{ fmtDate(group.date) }}
          </div>
          <ul class="changelog__list">
            <li v-for="(e, i) in group.items" :key="i" class="changelog__entry">
              <span class="changelog__tag" :class="`changelog__tag--${e.tag}`">{{ $t('changelog.tags.' + e.tag) }}</span>
              <div class="changelog__body">
                <h2 class="changelog__entry-title">{{ e.title }}</h2>
                <p class="changelog__detail">{{ e.detail }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </main>
</template>
