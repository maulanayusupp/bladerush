<script setup lang="ts">
import GameCanvas from '~/components/game/GameCanvas.vue'
import GameHud from '~/components/game/GameHud.vue'
</script>

<template>
  <div class="game-stage">
    <!-- Phaser needs the browser; render the game only on the client. -->
    <ClientOnly>
      <GameCanvas />
      <GameHud />
    </ClientOnly>
  </div>
</template>
