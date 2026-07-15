<script setup lang="ts">
import { HERO_RARITIES } from '~/game/constants'

interface FlowNode {
  k: string
  icon: string
}
interface FlowSection {
  id: string
  accent: 'power' | 'xp' | 'hero' | 'boss' | 'divine'
  loop?: boolean
  nodes: FlowNode[]
}

// Sections rendered before and after the special hero-evolution block, so the
// rarity ladder sits in a natural reading order (loop → power → level → HERO → …).
const TOP: FlowSection[] = [
  {
    id: 'loop',
    accent: 'power',
    loop: true,
    nodes: [
      { k: 'move', icon: '🕹️' },
      { k: 'auto', icon: '⚔️' },
      { k: 'kill', icon: '💥' },
      { k: 'grow', icon: '📈' },
    ],
  },
  {
    id: 'power',
    accent: 'power',
    nodes: [
      { k: 'plus', icon: '➕' },
      { k: 'times', icon: '✖️' },
      { k: 'ring', icon: '🌀' },
      { k: 'dmg', icon: '🗡️' },
    ],
  },
  {
    id: 'level',
    accent: 'xp',
    nodes: [
      { k: 'xp', icon: '⭐' },
      { k: 'up', icon: '⬆️' },
      { k: 'choose', icon: '🎁' },
      { k: 'stack', icon: '🧱' },
    ],
  },
]

const BOTTOM: FlowSection[] = [
  {
    id: 'skills',
    accent: 'divine',
    nodes: [
      { k: 'fury', icon: '🌪️' },
      { k: 'nova', icon: '💥' },
      { k: 'dash', icon: '⚡' },
      { k: 'divine', icon: '🌟' },
    ],
  },
  {
    id: 'boss',
    accent: 'boss',
    nodes: [
      { k: 'spawn', icon: '👹' },
      { k: 'beat', icon: '🎁' },
      { k: 'rush', icon: '☠️' },
      { k: 'waves', icon: '🌊' },
    ],
  },
  {
    id: 'world',
    accent: 'power',
    nodes: [
      { k: 'npc', icon: '🤝' },
      { k: 'rank', icon: '🏅' },
      { k: 'obstacle', icon: '🪨' },
      { k: 'heart', icon: '❤️' },
    ],
  },
]

// The evolution ladder, straight from the game's rarity tiers (accurate colors).
const ladder = HERO_RARITIES.map((r) => ({
  id: r.id,
  css: `#${r.color.toString(16).padStart(6, '0')}`,
}))

const heroNodes: FlowNode[] = [
  { k: 'score', icon: '🏆' },
  { k: 'loadout', icon: '🛡️' },
  { k: 'auto', icon: '♾️' },
]

const tips = ['t1', 't2', 't3', 't4']

// Section numbering (01, 02, …) across the whole guide, hero block included.
function stepNo(n: number): string {
  return String(n + 1).padStart(2, '0')
}
const heroIndex = TOP.length
</script>

<template>
  <main class="guide">
    <header class="guide__bar">
      <NuxtLink to="/" class="guide__back" :aria-label="$t('guide.back')">←</NuxtLink>
      <div class="guide__headings">
        <h1 class="guide__title">{{ $t('guide.title') }}</h1>
        <p class="guide__subtitle">{{ $t('guide.subtitle') }}</p>
      </div>
      <NuxtLink to="/play" class="guide__play">▶ {{ $t('guide.play') }}</NuxtLink>
    </header>

    <div class="guide__scroll">
      <div class="guide__inner">
        <!-- Sections before the hero ladder -->
        <section
          v-for="(s, si) in TOP"
          :key="s.id"
          class="guide__section"
          :class="`guide__section--${s.accent}`"
        >
          <div class="guide__section-head">
            <span class="guide__step">{{ $t('guide.step') }} {{ stepNo(si) }}</span>
            <h2 class="guide__section-title">{{ $t(`guide.${s.id}.title`) }}</h2>
            <p class="guide__section-desc">{{ $t(`guide.${s.id}.desc`) }}</p>
          </div>
          <ol class="guide__flow" :class="{ 'guide__flow--loop': s.loop }">
            <li v-for="n in s.nodes" :key="n.k" class="guide__node">
              <span class="guide__node-icon">{{ n.icon }}</span>
              <b class="guide__node-title">{{ $t(`guide.${s.id}.${n.k}.t`) }}</b>
              <span class="guide__node-text">{{ $t(`guide.${s.id}.${n.k}.d`) }}</span>
            </li>
          </ol>
        </section>

        <!-- Hero evolution — with the rarity ladder -->
        <section class="guide__section guide__section--hero">
          <div class="guide__section-head">
            <span class="guide__step">{{ $t('guide.step') }} {{ stepNo(heroIndex) }}</span>
            <h2 class="guide__section-title">{{ $t('guide.hero.title') }}</h2>
            <p class="guide__section-desc">{{ $t('guide.hero.desc') }}</p>
          </div>
          <ol class="guide__flow">
            <li v-for="n in heroNodes" :key="n.k" class="guide__node">
              <span class="guide__node-icon">{{ n.icon }}</span>
              <b class="guide__node-title">{{ $t(`guide.hero.${n.k}.t`) }}</b>
              <span class="guide__node-text">{{ $t(`guide.hero.${n.k}.d`) }}</span>
            </li>
          </ol>

          <div class="guide__ladder">
            <span class="guide__ladder-heading">{{ $t('guide.rarityHeading') }}</span>
            <div class="guide__ladder-track">
              <template v-for="(r, ri) in ladder" :key="r.id">
                <span class="guide__rarity" :style="{ '--c': r.css }">{{ $t('rarity.' + r.id) }}</span>
                <span v-if="ri < ladder.length - 1" class="guide__ladder-arrow" aria-hidden="true">→</span>
              </template>
            </div>
            <p class="guide__ladder-note">{{ $t('guide.rarityNote') }}</p>
          </div>
        </section>

        <!-- Sections after the hero ladder -->
        <section
          v-for="(s, si) in BOTTOM"
          :key="s.id"
          class="guide__section"
          :class="`guide__section--${s.accent}`"
        >
          <div class="guide__section-head">
            <span class="guide__step">{{ $t('guide.step') }} {{ stepNo(heroIndex + 1 + si) }}</span>
            <h2 class="guide__section-title">{{ $t(`guide.${s.id}.title`) }}</h2>
            <p class="guide__section-desc">{{ $t(`guide.${s.id}.desc`) }}</p>
          </div>
          <ol class="guide__flow">
            <li v-for="n in s.nodes" :key="n.k" class="guide__node">
              <span class="guide__node-icon">{{ n.icon }}</span>
              <b class="guide__node-title">{{ $t(`guide.${s.id}.${n.k}.t`) }}</b>
              <span class="guide__node-text">{{ $t(`guide.${s.id}.${n.k}.d`) }}</span>
            </li>
          </ol>
        </section>

        <!-- Quick tips -->
        <section class="guide__section guide__section--tips">
          <div class="guide__section-head">
            <span class="guide__step">💡</span>
            <h2 class="guide__section-title">{{ $t('guide.tips.title') }}</h2>
            <p class="guide__section-desc">{{ $t('guide.tips.desc') }}</p>
          </div>
          <ul class="guide__tips">
            <li v-for="t in tips" :key="t" class="guide__tip">{{ $t('guide.tips.' + t) }}</li>
          </ul>
        </section>

        <NuxtLink to="/play" class="guide__cta">▶ {{ $t('guide.play') }}</NuxtLink>
      </div>
    </div>
  </main>
</template>
