<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type PhaserNS from 'phaser'

// Phaser is imported dynamically inside onMounted so it never loads on the
// server (it references `window`). This component must be wrapped in
// <ClientOnly> by its parent.
const host = ref<HTMLElement | null>(null)
let game: PhaserNS.Game | null = null

onMounted(async () => {
  if (!host.value) return
  const { createGame } = await import('../../game/createGame')
  game = createGame(host.value)
})

onBeforeUnmount(() => {
  game?.destroy(true)
  game = null
})
</script>

<template>
  <div ref="host" class="game-stage__canvas" />
</template>
