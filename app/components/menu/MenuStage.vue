<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Full-screen cinematic key-art stage: a large backlit champion standing in a
// slow wheel of blades, volumetric god rays, drifting fog and dust, all with a
// gentle mouse parallax. One canvas so lighting composites correctly (rays and
// bloom behind the hero, dust in front). Pure presentation — no game logic.
const el = ref<HTMLCanvasElement | null>(null)
const TAU = Math.PI * 2

const HERO = {
  robe: '#3a3020', robeHi: '#6a5a38', cape: '#7a1616', helm: '#2a2418',
  trim: '#ffd700', dark: '#0c0a12', eye: '#ffe14d', wing: '#ffe14d',
}
const RAY = 'rgba(183,148,255,'
const GOLD = 'rgba(255,210,74,'

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let last = 0
let t = 0
let angle = 0
let reduced = false

// Smoothed, normalized pointer (-1..1) driving parallax.
let px = 0
let py = 0
let tx = 0
let ty = 0

interface Mote { x: number; y: number; vy: number; vx: number; r: number; a: number; depth: number; ph: number; tw: number; gold: boolean }
let motes: Mote[] = []

function seedMotes(): void {
  const count = Math.min(90, Math.max(36, Math.round((w * h) / 26000)))
  motes = Array.from({ length: count }, () => {
    const depth = Math.random()
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vy: 4 + depth * 20,
      vx: (Math.random() - 0.5) * 5,
      r: 0.7 + depth * 2.2,
      a: 0.06 + depth * 0.26,
      depth,
      ph: Math.random() * TAU,
      tw: 0.5 + Math.random() * 1.4,
      gold: Math.random() < 0.4,
    }
  })
}

// --- Champion vector (shared drawing primitives) --------------------------
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
}

function drawChampion(g: ReturnType<typeof d>): void {
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
  w = c.clientWidth
  h = c.clientHeight
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seedMotes()
  if (reduced) render()
}

function render(): void {
  if (!ctx) return
  const c = ctx
  const cx = w / 2
  const heroY = h * 0.32
  const bob = reduced ? 0 : Math.sin(t * 0.9) * 8
  const hx = cx + px * 26
  const hy = heroY + bob + py * 12
  const heroH = Math.min(h * 0.46, 380)
  const k = heroH / 64

  // 1) Moody sky + bloom behind the hero.
  const sky = c.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#150c24')
  sky.addColorStop(0.5, '#0b0715')
  sky.addColorStop(1, '#040309')
  c.fillStyle = sky
  c.fillRect(0, 0, w, h)

  const bloom = c.createRadialGradient(hx, hy - heroH * 0.15, 0, hx, hy - heroH * 0.15, heroH * 1.5)
  bloom.addColorStop(0, 'rgba(124,77,255,0.5)')
  bloom.addColorStop(0.4, 'rgba(124,77,255,0.16)')
  bloom.addColorStop(1, 'rgba(124,77,255,0)')
  c.fillStyle = bloom
  c.fillRect(0, 0, w, h)

  // 2) Volumetric god rays fanning from above the hero's head.
  c.save()
  c.globalCompositeOperation = 'lighter'
  const sx = hx + px * 10
  const sy = hy - heroH * 0.55
  const rays = 15
  const spread = heroH * 3
  for (let i = 0; i < rays; i++) {
    const base = (i / rays) * TAU
    const a = base + angle * 0.15
    const flick = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7)
    const wob = Math.sin(t * 0.4 + i) * 0.05
    c.save()
    c.translate(sx, sy)
    c.rotate(a + wob)
    const grad = c.createLinearGradient(0, 0, 0, spread)
    grad.addColorStop(0, `${RAY}${0.14 * flick})`)
    grad.addColorStop(1, `${RAY}0)`)
    c.fillStyle = grad
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(-spread * 0.06, spread)
    c.lineTo(spread * 0.06, spread)
    c.closePath()
    c.fill()
    c.restore()
  }
  c.restore()

  // 3) Wheel of blades — a slow halo the champion stands within.
  const ringR = heroH * 0.82
  const blades = 10
  c.save()
  c.globalAlpha = 0.85
  for (let i = 0; i < blades; i++) {
    const a = angle + (i / blades) * TAU
    const bx = hx + Math.cos(a) * ringR * 0.62
    const by = hy - heroH * 0.05 + Math.sin(a) * ringR * 0.32
    const behind = Math.sin(a) < 0
    c.globalAlpha = behind ? 0.5 : 0.92
    c.save()
    c.translate(bx, by)
    c.rotate(a + Math.PI / 2 + 0.5)
    const s = k * (behind ? 0.62 : 0.82)
    c.scale(s, s)
    c.translate(-8, -23)
    drawSword(d(c), i % 2 ? '#b794ff' : '#ffd24a')
    c.restore()
  }
  c.restore()

  // 4) Champion — a soft golden rim behind, then the figure.
  c.save()
  c.translate(hx, hy)
  c.scale(k, k)
  c.translate(-32, -40)
  c.save()
  c.globalAlpha = 0.35
  c.translate(32, 32)
  c.scale(1.07, 1.07)
  c.translate(-32, -32)
  const rim = d(c)
  rim.fill(HERO.trim)
  rim.poly([[16, 26], [48, 26], [54, 62], [10, 62]])
  rim.ell(32, 18, 30, 28)
  c.restore()
  drawChampion(d(c))
  c.restore()

  // 5) Ground bloom pooling under the hero.
  c.save()
  c.globalCompositeOperation = 'lighter'
  const floorY = hy + heroH * 0.52
  const floor = c.createRadialGradient(hx, floorY, 0, hx, floorY, heroH * 0.9)
  floor.addColorStop(0, 'rgba(124,77,255,0.28)')
  floor.addColorStop(1, 'rgba(124,77,255,0)')
  c.fillStyle = floor
  c.beginPath()
  c.ellipse(hx, floorY, heroH * 0.9, heroH * 0.22, 0, 0, TAU)
  c.fill()
  c.restore()

  // 6) Foreground dust motes, parallaxed by depth.
  c.save()
  c.globalCompositeOperation = 'lighter'
  for (const m of motes) {
    if (!reduced) {
      m.y -= m.vy * 0.016
      m.x += m.vx * 0.016
      m.ph += m.tw * 0.016
    }
    if (m.y < -6) { m.y = h + 6; m.x = Math.random() * w }
    if (m.x < -6) m.x = w + 6
    else if (m.x > w + 6) m.x = -6
    const ox = px * (10 + m.depth * 44)
    const oy = py * (6 + m.depth * 26)
    const flicker = 0.6 + 0.4 * Math.sin(m.ph)
    c.fillStyle = (m.gold ? GOLD : RAY) + (m.a * flicker).toFixed(3) + ')'
    c.beginPath()
    c.arc(m.x + ox, m.y + oy, m.r, 0, TAU)
    c.fill()
  }
  c.restore()
  c.globalAlpha = 1
}

function frame(ts: number): void {
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
  last = ts
  t += dt
  angle = (angle + 0.12 * dt) % TAU
  px += (tx - px) * Math.min(1, dt * 3)
  py += (ty - py) * Math.min(1, dt * 3)
  render()
  raf = requestAnimationFrame(frame)
}

function onPointer(e: PointerEvent): void {
  tx = (e.clientX / window.innerWidth) * 2 - 1
  ty = (e.clientY / window.innerHeight) * 2 - 1
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  window.addEventListener('resize', resize)
  if (!reduced) {
    window.addEventListener('pointermove', onPointer, { passive: true })
    raf = requestAnimationFrame(frame)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', onPointer)
})
</script>

<template>
  <canvas ref="el" class="menu-stage" aria-hidden="true" />
</template>
