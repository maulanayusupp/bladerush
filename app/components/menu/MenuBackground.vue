<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Subtle full-screen backdrop: drifting embers over a faint top glow. Kept
// minimal so the emblem + text stay clean and readable.
const canvas = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let last = 0
let reduced = false

interface Ember { x: number; y: number; vy: number; r: number; a: number }
let embers: Ember[] = []

function seedEmbers(): void {
  const count = Math.min(60, Math.max(20, Math.round((w * h) / 30000)))
  embers = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vy: 5 + Math.random() * 14,
    r: 1 + Math.random() * 1.8,
    a: 0.1 + Math.random() * 0.3,
  }))
}

function resize(): void {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  w = el.clientWidth
  h = el.clientHeight
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seedEmbers()
  if (reduced) render(0)
}

function render(dt: number): void {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = '#b794ff'
  for (const p of embers) {
    p.y -= p.vy * dt
    if (p.y < -4) {
      p.y = h + 4
      p.x = Math.random() * w
    }
    ctx.globalAlpha = p.a
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function frame(ts: number): void {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
  last = ts
  render(dt)
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  window.addEventListener('resize', resize)
  if (!reduced) raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="menu-bg" aria-hidden="true" />
</template>
