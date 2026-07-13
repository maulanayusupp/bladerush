<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Cinematic full-screen backdrop: parallax embers drifting upward with the odd
// blade-glint streak arcing across. Layered behind the menu content and kept
// GPU-light so the emblem + text stay crisp and readable.
const canvas = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2
const EMBER_TINTS = ['#b794ff', '#7c4dff', '#ffd24a']

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let last = 0
let reduced = false
let streakTimer = 1.5

interface Ember { x: number; y: number; vy: number; vx: number; r: number; a: number; tint: string; tw: number; ph: number }
interface Streak { x: number; y: number; vx: number; vy: number; len: number; life: number; max: number }

let embers: Ember[] = []
let streaks: Streak[] = []

function seedEmbers(): void {
  const count = Math.min(90, Math.max(30, Math.round((w * h) / 22000)))
  embers = Array.from({ length: count }, () => {
    const depth = Math.random()
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vy: 6 + depth * 26,
      vx: (Math.random() - 0.5) * 6,
      r: 0.8 + depth * 2.4,
      a: 0.08 + depth * 0.32,
      tint: EMBER_TINTS[Math.floor(Math.random() * EMBER_TINTS.length)] as string,
      tw: 0.6 + Math.random() * 1.6,
      ph: Math.random() * TAU,
    }
  })
}

function spawnStreak(): void {
  const fromLeft = Math.random() < 0.5
  const speed = 520 + Math.random() * 420
  const angle = (fromLeft ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.25
  streaks.push({
    x: fromLeft ? -60 : w + 60,
    y: Math.random() * h * 0.7,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: 90 + Math.random() * 140,
    life: 0,
    max: 0.9 + Math.random() * 0.5,
  })
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

  for (const p of embers) {
    p.y -= p.vy * dt
    p.x += p.vx * dt
    p.ph += p.tw * dt
    if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w }
    if (p.x < -6) p.x = w + 6
    else if (p.x > w + 6) p.x = -6
    const flicker = 0.65 + 0.35 * Math.sin(p.ph)
    ctx.fillStyle = p.tint
    ctx.globalAlpha = p.a * flicker
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, TAU)
    ctx.fill()
  }

  streakTimer -= dt
  if (streakTimer <= 0 && !reduced) {
    spawnStreak()
    streakTimer = 2.4 + Math.random() * 3.2
  }
  streaks = streaks.filter((s) => s.life < s.max)
  for (const s of streaks) {
    s.life += dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    const t = s.life / s.max
    const fade = Math.sin(t * Math.PI)
    const dirX = s.vx / Math.hypot(s.vx, s.vy)
    const dirY = s.vy / Math.hypot(s.vx, s.vy)
    const tailX = s.x - dirX * s.len
    const tailY = s.y - dirY * s.len
    const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
    grad.addColorStop(0, 'rgba(183,148,255,0)')
    grad.addColorStop(0.75, `rgba(214,196,255,${0.5 * fade})`)
    grad.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`)
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(s.x, s.y)
    ctx.stroke()
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
