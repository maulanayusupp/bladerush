<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type PhaserNS from 'phaser'
import { audioService } from '~/services/AudioService'

// Phaser is imported dynamically inside onMounted so it never loads on the
// server (it references `window`). This component must be wrapped in
// <ClientOnly> by its parent.
const host = ref<HTMLElement | null>(null)
let game: PhaserNS.Game | null = null

// Robust audio unlock: the very first user gesture ANYWHERE (needed when the
// page is reloaded straight onto /play, bypassing the menu's Play button).
function unlockAudio(): void {
  audioService.unlock()
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  window.removeEventListener('touchstart', unlockAudio)
}

onMounted(async () => {
  if (!host.value) return
  window.addEventListener('pointerdown', unlockAudio)
  window.addEventListener('keydown', unlockAudio)
  window.addEventListener('touchstart', unlockAudio)
  const { createGame } = await import('../../game/createGame')
  game = createGame(host.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  window.removeEventListener('touchstart', unlockAudio)
  game?.destroy(true)
  game = null
})
</script>

<template>
  <div ref="host" class="game-stage__canvas" />
</template>
