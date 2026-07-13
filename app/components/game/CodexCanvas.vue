<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type PhaserNS from 'phaser'

// Client-only: dynamically imports the codex game so Phaser never runs on SSR.
const props = defineProps<{ category: string }>()

const host = ref<HTMLElement | null>(null)
let game: PhaserNS.Game | null = null

onMounted(async () => {
  if (!host.value) return
  const { createCodex } = await import('../../game/createCodex')
  game = createCodex(host.value, props.category)
})

watch(
  () => props.category,
  (cat) => game?.registry.set('codexCategory', cat),
)

onBeforeUnmount(() => {
  game?.destroy(true)
  game = null
})
</script>

<template>
  <div ref="host" class="codex__canvas" />
</template>
