<script setup lang="ts">
import { computed, ref } from 'vue'
import { metaService } from '~/services/MetaService'
import { META, META_IDS, PRESTIGE_MILESTONES } from '~/game/constants'
import { formatCompact } from '~/helpers/format.helper'

const emit = defineEmits<{ close: [] }>()

// Bump to re-read the (non-reactive) MetaService after a purchase.
const tick = ref(0)

const coins = computed(() => {
  void tick.value
  return metaService.coins
})

// ---- Prestige ----
const stars = computed(() => { void tick.value; return metaService.prestigeStars })
const canPrestige = computed(() => { void tick.value; return metaService.canPrestige() })
const starsGain = computed(() => { void tick.value; return metaService.prestigeStarsPreview() })
const bonusPct = computed(() => { void tick.value; return Math.round((metaService.prestigeMul - 1) * 100) })
const milestones = computed(() => {
  void tick.value
  const s = metaService.prestigeStars
  return PRESTIGE_MILESTONES.map((m) => ({ id: m.id, icon: m.icon, stars: m.stars, unlocked: s >= m.stars }))
})
const confirming = ref(false)
function doPrestige(): void {
  if (!canPrestige.value) return
  if (!confirming.value) {
    confirming.value = true
    return
  }
  metaService.prestige()
  confirming.value = false
  tick.value++
}

const rows = computed(() =>
  META_IDS.map((id) => {
    void tick.value
    return {
      id,
      icon: META[id].icon,
      level: metaService.levelOf(id),
      max: META[id].max,
      cost: metaService.cost(id),
      maxed: metaService.maxed(id),
      canBuy: metaService.canBuy(id),
    }
  }),
)

function buy(id: (typeof META_IDS)[number]): void {
  if (metaService.buy(id)) tick.value++
}
</script>

<template>
  <div class="shop" @click.self="emit('close')">
    <div class="shop__panel">
      <div class="shop__head">
        <h2 class="shop__title">{{ $t('shop.title') }}</h2>
        <span class="shop__coins">💰 {{ formatCompact(coins) }}</span>
      </div>

      <div class="shop__prestige">
        <div class="shop__prestige-info">
          <span class="shop__prestige-stars">⭐ {{ stars }}</span>
          <span class="shop__prestige-bonus">
            {{ stars > 0 ? $t('prestige.bonus', { pct: bonusPct }) : $t('prestige.none') }}
          </span>
        </div>
        <button
          class="shop__prestige-btn"
          :class="{ 'shop__prestige-btn--armed': confirming }"
          type="button"
          :disabled="!canPrestige"
          @click="doPrestige"
        >
          <template v-if="!canPrestige">🔒 {{ $t('prestige.locked') }}</template>
          <template v-else-if="confirming">{{ $t('prestige.confirm', { stars: starsGain }) }}</template>
          <template v-else>{{ $t('prestige.action', { stars: starsGain }) }}</template>
        </button>
      </div>

      <div class="shop__milestones">
        <div
          v-for="m in milestones"
          :key="m.id"
          class="shop__ms"
          :class="{ 'shop__ms--on': m.unlocked }"
          :title="$t('prestige.ms.' + m.id)"
        >
          <span class="shop__ms-icon" aria-hidden="true">{{ m.icon }}</span>
          <span class="shop__ms-req">{{ m.stars }}⭐</span>
        </div>
      </div>

      <div class="shop__list">
        <div v-for="row in rows" :key="row.id" class="shop__item">
          <span class="shop__icon" aria-hidden="true">{{ row.icon }}</span>
          <div class="shop__info">
            <span class="shop__name">
              {{ $t(`meta.${row.id}.name`) }}
              <b class="shop__lv">Lv {{ row.level }}/{{ row.max }}</b>
            </span>
            <span class="shop__desc">{{ $t(`meta.${row.id}.text`) }}</span>
          </div>
          <button class="shop__buy" type="button" :disabled="!row.canBuy" @click="buy(row.id)">
            <template v-if="row.maxed">MAX</template>
            <template v-else>💰 {{ formatCompact(row.cost) }}</template>
          </button>
        </div>
      </div>

      <button class="btn btn--block" type="button" @click="emit('close')">{{ $t('shop.close') }}</button>
    </div>
  </div>
</template>
