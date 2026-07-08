// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/i18n'],

  // Set NUXT_PUBLIC_SITE_URL to your deployed origin so social (WhatsApp/OG)
  // previews resolve the absolute image URL (Nuxt maps the env var to this key
  // automatically). Falls back to relative locally.
  runtimeConfig: {
    public: {
      siteUrl: '',
    },
  },

  // UI strings live in locale files, never hardcoded in components.
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix', // keep routes (/, /play) unchanged
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'id', name: 'Bahasa Indonesia', file: 'id.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'blade-rush-locale',
      redirectOn: 'root',
    },
  },

  // Global stylesheet entry — all styling lives in centralized SCSS files.
  css: ['~/assets/scss/main.scss'],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // Design tokens + mixins emit no CSS, so injecting them into every
          // block is safe and lets components use them without an explicit
          // @use in each file.
          additionalData: [
            '@use "@/assets/scss/abstracts/variables" as *;',
            '@use "@/assets/scss/abstracts/mixins" as *;',
          ].join('\n'),
        },
      },
    },
  },

  app: {
    head: {
      // Full SEO/social tags live in app.vue (useHead) so they can read the
      // runtime site URL for absolute OG image links.
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
        },
      ],
    },
  },
})
