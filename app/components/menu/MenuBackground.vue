<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Decorative animated backdrop for the menu: a slowly spinning sword ring plus
// rising ember particles. Pure Canvas 2D, DPR-aware, and it honors
// prefers-reduced-motion (renders a single static frame instead of looping).
const canvas = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2
const RING_COLORS = ['#7c4dff', '#b794ff', '#ffb020']

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let angle = 0
let last = 0
let reduced = false

interface Ember {
  x: number
  y: number
  vy: number
  r: number
  a: number
}
let embers: Ember[] = []

function seedEmbers(): void {
  const count = Math.min(70, Math.max(22, Math.round((w * h) / 26000)))
  embers = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vy: 6 + Math.random() * 16,
    r: 1 + Math.random() * 2.2,
    a: 0.15 + Math.random() * 0.4,
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

function drawSword(g: CanvasRenderingContext2D, color: string): void {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(0, -17)
  g.lineTo(-3, -9)
  g.lineTo(3, -9)
  g.closePath()
  g.fill()
  g.fillRect(-3, -9, 6, 18)
  g.fillStyle = '#ffce6a'
  g.fillRect(-6, 9, 12, 3)
  g.fillStyle = '#7a4a2b'
  g.fillRect(-2, 12, 4, 7)
}

function render(dt: number): void {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h * (w < 640 ? 0.34 : 0.42)
  const radius = Math.min(w, h) * 0.3

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.9)
  glow.addColorStop(0, 'rgba(124,77,255,0.22)')
  glow.addColorStop(1, 'rgba(124,77,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const blades = 16
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let i = 0; i < blades; i++) {
    const a = angle + (i / blades) * TAU
    ctx.save()
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
    ctx.rotate(a + Math.PI / 2)
    ctx.scale(1.1, 1.1)
    drawSword(ctx, RING_COLORS[i % RING_COLORS.length] as string)
    ctx.restore()
  }
  ctx.restore()

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
  angle = (angle + 0.28 * dt) % TAU
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
