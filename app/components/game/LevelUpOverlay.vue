<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { gameEventBus } from '~/services/EventBus'
import { audioService } from '~/services/AudioService'
import { UPGRADES } from '~/game/constants'

const visible = ref(false)
const choices = ref<string[]>([])
const evolving = ref<string[]>([])
const iconOf: Record<string, string> = Object.fromEntries(UPGRADES.map((u) => [u.id, u.icon]))

let off: (() => void) | undefined

onMounted(() => {
  off = gameEventBus.on('levelup:offer', ({ ids, evolving: ev }) => {
    choices.value = ids
    evolving.value = ev
    visible.value = true
  })
})

onUnmounted(() => off?.())

function pick(id: string): void {
  audioService.skill()
  visible.value = false
  gameEventBus.emit('levelup:pick', { id })
}
</script>

<template>
  <div v-if="visible" class="levelup">
    <div class="levelup__panel">
      <h2 class="levelup__title">{{ $t('levelup.title') }}</h2>
      <div class="levelup__cards">
        <button
          v-for="id in choices"
          :key="id"
          class="levelup__card"
          :class="{ 'levelup__card--evolve': evolving.includes(id) }"
          type="button"
          @click="pick(id)"
        >
          <span v-if="evolving.includes(id)" class="levelup__evolve">✦ {{ $t('levelup.evolves', { name: $t('evolve.' + id) }) }}</span>
          <span class="levelup__icon" aria-hidden="true">{{ iconOf[id] }}</span>
          <span class="levelup__name">{{ $t(`upgrades.${id}.name`) }}</span>
          <span class="levelup__desc">{{ $t(`upgrades.${id}.text`) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
