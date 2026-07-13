<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Contained hero mascot: a golden champion inside a slowly spinning blade ring.
// Rendered in its OWN square canvas so it never overlaps the title/text.
const canvas = ref<HTMLElement | null>(null)
const el = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2
const RING = ['#b794ff', '#7c4dff', '#ffd24a']
const HERO = {
  robe: '#3a3020', robeHi: '#6a5a38', cape: '#7a1616', helm: '#2a2418',
  trim: '#ffd700', dark: '#0c0a12', eye: '#ffe14d', wing: '#ffe14d',
}

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let size = 0
let angle = 0
let last = 0
let reduced = false

function d(c: CanvasRenderingContext2D) {
  return {
    fill: (col: string) => (c.fillStyle = col),
    ell: (x: number, y: number, w: number, h: number) => { c.beginPath(); c.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); c.fill() },
    circ: (x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill() },
    tri: (a: number, b: number, cc: number, dd: number, e: number, f: number) => { c.beginPath(); c.moveTo(a, b); c.lineTo(cc, dd); c.lineTo(e, f); c.closePath(); c.fill() },
    rect: (x: number, y: number, w: number, h: number) => c.fillRect(x, y, w, h),
    poly: (pts: number[][]) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] as number, p[1] as number) : c.moveTo(p[0] as number, p[1] as number))); c.closePath(); c.fill() },
    ring: (x: number, y: number, w: number, h: number, col: string, lw: number) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, w / 2, h / 2, 0, 0, TAU); c.stroke() },
  }
}

function drawSword(g: ReturnType<typeof d>, blade: string): void {
  g.fill(blade); g.poly([[8, 1], [11.6, 12], [10.4, 28], [5.6, 28], [4.4, 12]])
  g.fill('#ffd24a'); g.poly([[0, 29], [16, 29], [13.5, 33], [2.5, 33]])
  g.fill('#5c3b22'); g.rect(6.3, 33, 3.4, 9)
}

function drawChampion(g: ReturnType<typeof d>): void {
  // Gallant golden knight (matches the in-game hero).
  g.fill(HERO.wing); g.poly([[16, 30], [0, 20], [4, 44], [15, 48]]); g.poly([[48, 30], [64, 20], [60, 44], [49, 48]])
  g.fill(HERO.cape); g.poly([[16, 26], [48, 26], [54, 62], [10, 62]])
  g.fill(HERO.robe); g.rect(16, 28, 32, 25)
  g.fill(HERO.robeHi); g.poly([[32, 30], [42, 34], [40, 50], [24, 50], [22, 34]])
  g.fill(HERO.trim); g.rect(17, 48, 30, 4); g.circ(32, 40, 3)
  g.fill(HERO.trim); g.poly([[8, 34], [12, 26], [20, 30], [18, 38]]); g.poly([[56, 34], [52, 26], [44, 30], [46, 38]])
  g.fill(HERO.robeHi); g.circ(15, 31, 5); g.circ(49, 31, 5)
  g.fill(HERO.helm); g.ell(32, 18, 28, 26)
  g.fill(HERO.robeHi); g.rect(19, 15, 26, 3)
  g.fill(HERO.dark); g.rect(20, 18, 24, 6); g.rect(31, 18, 2, 9)
  g.fill(HERO.eye); g.rect(23, 19, 4, 3); g.rect(37, 19, 4, 3)
  g.fill(HERO.trim); g.poly([[30, 8], [34, 8], [34, 0], [30, 2]]); g.poly([[31, 6], [33, 6], [38, 4], [36, 10]])
  g.fill(HERO.trim); for (const x of [22, 27, 32, 37, 42]) g.tri(x - 2.5, 8, x, 1, x + 2.5, 8)
  g.ring(32, 5, 26, 8, HERO.trim, 2)
}

function resize(): void {
  const c = el.value
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  size = c.clientWidth
  c.height = Math.round(size * dpr)
  c.width = Math.round(size * dpr)
  ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (reduced) render()
}

function render(): void {
  if (!ctx) return
  const g = d(ctx)
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.36
  const heroK = (size * 0.5) / 64

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5)
  glow.addColorStop(0, 'rgba(124,77,255,0.35)')
  glow.addColorStop(1, 'rgba(124,77,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(heroK, heroK)
  ctx.translate(-32, -32)
  drawChampion(g)
  ctx.restore()

  const blades = 14
  for (let i = 0; i < blades; i++) {
    const a = angle + (i / blades) * TAU
    ctx.save()
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.rotate(a + Math.PI / 2 + 0.5)
    ctx.scale(heroK * 0.6, heroK * 0.6)
    ctx.translate(-8, -23)
    drawSword(d(ctx), RING[i % 3] as string)
    ctx.restore()
  }
}

function frame(ts: number): void {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
  last = ts
  angle = (angle + 0.5 * dt) % TAU
  render()
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
  <div ref="canvas" class="menu-emblem">
    <canvas ref="el" class="menu-emblem__canvas" aria-hidden="true" />
  </div>
</template>
