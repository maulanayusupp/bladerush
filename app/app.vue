<script setup lang="ts">
const title = 'Blade Rush — Blade Ring Survivor'
const description =
  'Spin a growing ring of blades, crush endless hordes and out-duel rival warlords in this fast, arcade survivor game. Free to play in your browser.'

const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || ''
const ogImage = `${siteUrl}/og-image.png`

useHead({
  title,
  htmlAttrs: { lang: 'en' },
  meta: [
    { name: 'description', content: description },
    { name: 'keywords', content: 'blade rush, survivor game, browser game, arcade, roguelite, blade ring, web game' },
    { name: 'theme-color', content: '#7c4dff' },
    // Open Graph (WhatsApp, Facebook, LinkedIn…)
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Blade Rush' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: 'Blade Rush — a spinning ring of blades' },
    ...(siteUrl ? [{ property: 'og:url', content: siteUrl }] : []),
    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
  ],
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
