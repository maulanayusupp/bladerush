<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Contained hero mascot: a golden champion inside a slowly spinning blade ring.
// Rendered in its OWN square canvas so it never overlaps the title/text.
const canvas = ref<HTMLElement | null>(null)
const el = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2
const RING = ['#b794ff', '#7c4dff', '#ffd24a']
const HERO = {
  robe: '#4a3a08', robeHi: '#8a6a10', cape: '#ffd700', hood: '#2a2006',
  trim: '#ffe14d', skin: '#f2c9a0', eye: '#ffffff', wing: '#ffe14d',
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
