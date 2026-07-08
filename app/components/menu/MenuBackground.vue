<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Cinematic menu backdrop: a golden champion hero encircled by a slowly
// spinning ring of blades, over a soft glow with rising embers. Pure Canvas 2D,
// DPR-aware, honors prefers-reduced-motion (renders one static frame).
const canvas = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2
const RING_COLORS = ['#b794ff', '#7c4dff', '#ffd24a']

// A single epic hero look for the splash (gold, winged, crowned).
const HERO = {
  robe: '#4a3a08', robeHi: '#8a6a10', cape: '#ffd700', hood: '#2a2006',
  trim: '#ffe14d', skin: '#f2c9a0', eye: '#ffffff', wing: '#ffe14d',
}

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let angle = 0
let last = 0
let reduced = false

interface Ember { x: number; y: number; vy: number; r: number; a: number }
let embers: Ember[] = []

function d(c: CanvasRenderingContext2D) {
  return {
    fill: (col: string) => (c.fillStyle = col),
    ell: (x: number, y: number, ww: number, hh: number) => { c.beginPath(); c.ellipse(x, y, ww / 2, hh / 2, 0, 0, TAU); c.fill() },
    circ: (x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill() },
    tri: (a: number, b: number, cc: number, dd: number, e: number, f: number) => { c.beginPath(); c.moveTo(a, b); c.lineTo(cc, dd); c.lineTo(e, f); c.closePath(); c.fill() },
    rect: (x: number, y: number, ww: number, hh: number) => c.fillRect(x, y, ww, hh),
    poly: (pts: number[][]) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] as number, p[1] as number) : c.moveTo(p[0] as number, p[1] as number))); c.closePath(); c.fill() },
    ring: (x: number, y: number, ww: number, hh: number, col: string, lw: number) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, ww / 2, hh / 2, 0, 0, TAU); c.stroke() },
  }
}

function drawSword(g: ReturnType<typeof d>, blade: string): void {
  g.fill(blade); g.poly([[8, 1], [11.6, 12], [10.4, 28], [5.6, 28], [4.4, 12]])
  g.fill('#ffd24a'); g.poly([[0, 29], [16, 29], [13.5, 33], [2.5, 33]])
  g.fill('#5c3b22'); g.rect(6.3, 33, 3.4, 9)
  g.fill('#ffd24a'); g.circ(8, 43, 2.3)
}

function drawChampion(g: ReturnType<typeof d>): void {
  g.fill(HERO.wing); g.poly([[18, 30], [2, 22], [6, 42], [16, 46]]); g.poly([[46, 30], [62, 22], [58, 42], [48, 46]])
  g.fill(HERO.cape); g.poly([[20, 26], [44, 26], [50, 60], [14, 60]])
  g.fill(HERO.robe); g.poly([[22, 32], [42, 32], [48, 62], [16, 62]])
  g.fill(HERO.robeHi); g.poly([[29, 34], [35, 34], [38, 62], [26, 62]])
  g.fill(HERO.trim); g.rect(19, 48, 26, 4); g.circ(20, 33, 7); g.circ(44, 33, 7)
  g.fill(HERO.hood); g.ell(32, 20, 32, 28)
  g.fill(HERO.skin); g.ell(32, 23, 20, 20)
  g.fill(HERO.hood); g.ell(19, 19, 9, 22); g.ell(45, 19, 9, 22)
  g.fill(HERO.eye); g.circ(27, 24, 2); g.circ(37, 24, 2)
  g.fill(HERO.trim); for (const x of [24, 28, 32, 36, 40]) g.tri(x - 2.5, 9, x, 2, x + 2.5, 9)
  g.ring(32, 7, 24, 8, HERO.trim, 2)
  g.fill(HERO.trim); g.circ(32, 42, 3)
}

function seedEmbers(): void {
  const count = Math.min(70, Math.max(22, Math.round((w * h) / 26000)))
  embers = Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    vy: 6 + Math.random() * 16, r: 1 + Math.random() * 2.2, a: 0.15 + Math.random() * 0.4,
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
  const g = d(ctx)
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h * (w < 640 ? 0.36 : 0.44)
  const radius = Math.min(w, h) * 0.24
  const heroK = Math.min(3.2, Math.max(1.6, Math.min(w, h) / 190))

  // glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.4)
  glow.addColorStop(0, 'rgba(124,77,255,0.28)')
  glow.addColorStop(0.6, 'rgba(124,77,255,0.08)')
  glow.addColorStop(1, 'rgba(124,77,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // hero at the core
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(heroK, heroK)
  ctx.translate(-32, -32)
  drawChampion(g)
  ctx.restore()

  // spinning sword ring
  const blades = 16
  ctx.save()
  ctx.globalAlpha = 0.85
  for (let i = 0; i < blades; i++) {
    const a = angle + (i / blades) * TAU
    ctx.save()
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
    ctx.rotate(a + Math.PI / 2 + 0.5)
    ctx.scale(heroK * 0.6, heroK * 0.6)
    ctx.translate(-8, -23)
    drawSword(d(ctx), RING_COLORS[i % 3] as string)
    ctx.restore()
  }
  ctx.restore()

  // embers
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = '#b794ff'
  for (const p of embers) {
    p.y -= p.vy * dt
    if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w }
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
  angle = (angle + 0.24 * dt) % TAU
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
