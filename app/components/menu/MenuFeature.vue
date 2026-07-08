<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  text: string
}>()
</script>

<template>
  <li class="feature">
    <span class="feature__icon" aria-hidden="true">{{ icon }}</span>
    <span class="feature__label">{{ label }}</span>
    <span class="feature__text">{{ text }}</span>
  </li>
</template>
