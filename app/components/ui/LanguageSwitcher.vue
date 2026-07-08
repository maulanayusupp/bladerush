<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Locale list + current locale come from the i18n runtime; switching persists
// via the cookie configured in nuxt.config.
const { locale, locales, setLocale } = useI18n()
</script>

<template>
  <div class="lang" role="group" :aria-label="$t('language.label')">
    <button
      v-for="entry in locales"
      :key="entry.code"
      class="lang__option"
      :class="{ 'lang__option--active': entry.code === locale }"
      type="button"
      @click="setLocale(entry.code)"
    >
      {{ entry.code.toUpperCase() }}
    </button>
  </div>
</template>
