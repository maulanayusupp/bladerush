// Generates favicon + social share (Open Graph) images from inline SVG.
// Run: node scripts/generate-assets.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pub = resolve(root, 'public')
mkdirSync(pub, { recursive: true })

const PURPLE = '#7c4dff'
const LILAC = '#b794ff'
const GOLD = '#ffb020'
const RING_COLORS = [PURPLE, LILAC, GOLD]

/** A spinning ring of simple blades centered at (cx,cy). */
function ring(cx, cy, R, bladeScale = 1) {
  const n = 12
  let out = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360
    const col = RING_COLORS[i % 3]
    out += `<g transform="translate(${cx} ${cy}) rotate(${a}) translate(0 ${-R}) scale(${bladeScale})">
      <polygon points="0,-15 3.6,-4 2.6,12 -2.6,12 -3.6,-4" fill="${col}"/>
      <rect x="-6" y="12" width="12" height="3" fill="${GOLD}"/>
      <rect x="-1.7" y="15" width="3.4" height="6" fill="#7a4a2b"/>
    </g>`
  }
  return out
}

function emblem(size) {
  const c = size / 2
  const R = size * 0.3
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="70%">
        <stop offset="0" stop-color="#24361f"/><stop offset="1" stop-color="#0a0f08"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${PURPLE}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${PURPLE}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
    <circle cx="${c}" cy="${c}" r="${R * 1.5}" fill="url(#glow)"/>
    ${ring(c, c, R, size / 120)}
    <circle cx="${c}" cy="${c}" r="${size * 0.05}" fill="${LILAC}"/>
  </svg>`
}

function banner() {
  const W = 1200
  const H = 630
  const cx = W / 2
  const cy = 250
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="30%" r="90%">
        <stop offset="0" stop-color="#24361f"/><stop offset="1" stop-color="#090d07"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${PURPLE}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${PURPLE}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="${cx}" cy="${cy}" r="240" fill="url(#glow)"/>
    ${ring(cx, cy, 150, 2.4)}
    <circle cx="${cx}" cy="${cy}" r="26" fill="${LILAC}"/>
    <text x="${cx}" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="104" font-weight="800" fill="#ffffff" letter-spacing="6">BLADE RUSH</text>
    <text x="${cx}" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#a9b8a0">Spin the blade ring. Survive the horde.</text>
  </svg>`
}

// Favicon (scalable) + raster sizes.
writeFileSync(resolve(pub, 'favicon.svg'), emblem(64))
for (const size of [16, 32, 48]) {
  await sharp(Buffer.from(emblem(size))).png().toFile(resolve(pub, `favicon-${size}.png`))
}
await sharp(Buffer.from(emblem(180))).png().toFile(resolve(pub, 'apple-touch-icon.png'))
await sharp(Buffer.from(emblem(512))).png().toFile(resolve(pub, 'icon-512.png'))
await sharp(Buffer.from(banner())).png().toFile(resolve(pub, 'og-image.png'))

console.log('Generated favicon + og-image in public/')
