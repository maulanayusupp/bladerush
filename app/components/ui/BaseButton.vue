<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'primary'
    block?: boolean
  }>(),
  { variant: 'default', block: false },
)

const variantClasses = computed(() => ({
  'btn--primary': props.variant === 'primary',
  'btn--block': props.block,
}))
</script>

<template>
  <button class="btn" :class="variantClasses" type="button">
    <slot />
  </button>
</template>
