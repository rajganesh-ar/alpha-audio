import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import sharp from 'sharp'

/**
 * Licence-free placeholder product imagery, drawn as SVG and encoded to WebP at seed time, so
 * no binary media is committed. Flat studio renders in the brand palette, recognisably an
 * amplifier, a speaker or a streamer, and nothing more.
 */

export type ProductShape =
  | 'amp'
  | 'preamp'
  | 'speaker-stand'
  | 'speaker-floor'
  | 'streamer'
  | 'receiver'
  | 'source'
  | 'wireless'

/** The palette, read from the design tokens (the only file with colour values; ADR 0003). */
function palette(): Record<string, string> {
  const css = readFileSync(createRequire(import.meta.url).resolve('@alpha/ui/tokens.css'), 'utf8')
  const tokens = Object.fromEntries(
    [...css.matchAll(/--alpha-color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  )
  const need = (name: string) => {
    const value = tokens[name]
    if (!value) throw new Error(`tokens.css has no --alpha-color-${name}`)
    return value
  }
  return {
    lacquer: need('lacquer'),
    graphite: need('graphite'),
    aluminium: need('aluminium'),
    deep: need('aluminium-deep'),
    bronze: need('bronze'),
    amber: need('vu-amber'),
  }
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
/** `a` mixed with `b`, `t` of the way (0 = a, 1 = b), like CSS color-mix(). */
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [channels(a), channels(b)]
  return toHex(x.map((v, i) => v + ((y[i] ?? v) - v) * t))
}
/** Darker by a factor, for floor and shadow tones. */
const shade = (a: string, factor: number) => toHex(channels(a).map((v) => v * factor))

const P = palette()
const C = {
  ...P,
  steel: mix(P.graphite as string, P.aluminium as string, 0.5),
  paleTop: mix(P.aluminium as string, P.deep as string, 0.3),
  paleBottom: mix(P.deep as string, P.graphite as string, 0.08),
  darkTop: mix(P.graphite as string, P.aluminium as string, 0.05),
  roomTop: mix(P.lacquer as string, P.graphite as string, 0.5),
  floor: shade(P.lacquer as string, 0.65),
  shadow: shade(P.lacquer as string, 0.2),
} as Record<
  | 'lacquer'
  | 'graphite'
  | 'aluminium'
  | 'deep'
  | 'bronze'
  | 'amber'
  | 'steel'
  | 'paleTop'
  | 'paleBottom'
  | 'darkTop'
  | 'roomTop'
  | 'floor'
  | 'shadow',
  string
>

const W = 1600
const H = 1200

function backdrop(view: number): string {
  const tones = [
    [C.aluminium, C.deep],
    [C.paleTop, C.paleBottom],
    [C.darkTop, C.lacquer],
  ][view % 3] as [string, string]
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tones[0]}"/><stop offset="1" stop-color="${tones[1]}"/></linearGradient>
  <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.shadow}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>`
}

const shadow = (cx: number, cy: number, rx: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.08}" fill="url(#shadow)"/>`

function chassis(
  x: number,
  y: number,
  w: number,
  h: number,
  meters: number,
  knobs: number,
): string {
  const parts = [
    shadow(x + w / 2, y + h + 18, w * 0.62),
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.lacquer}"/>`,
    `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="10" fill="${C.graphite}"/>`,
    `<rect x="${x}" y="${y + h - 26}" width="${w}" height="26" rx="6" fill="${C.steel}"/>`,
  ]
  const mw = w * 0.22
  for (let i = 0; i < meters; i++) {
    const mx = x + w / 2 - (meters * mw + (meters - 1) * 30) / 2 + i * (mw + 30)
    parts.push(
      `<rect x="${mx}" y="${y + 40}" width="${mw}" height="${h * 0.34}" rx="8" fill="${C.amber}" opacity="0.85"/>`,
    )
    parts.push(
      `<line x1="${mx + mw * 0.2}" y1="${y + 40 + h * 0.3}" x2="${mx + mw * 0.62}" y2="${y + 58}" stroke="${C.lacquer}" stroke-width="5"/>`,
    )
  }
  for (let i = 0; i < knobs; i++) {
    const kx = x + ((i + 1) * w) / (knobs + 1)
    const r = i === 0 || i === knobs - 1 ? h * 0.11 : h * 0.06
    parts.push(
      `<circle cx="${kx}" cy="${y + h * 0.7}" r="${r}" fill="${C.steel}"/><circle cx="${kx}" cy="${y + h * 0.7}" r="${r * 0.7}" fill="${C.deep}"/>`,
    )
  }
  return parts.join('')
}

function cabinet(
  x: number,
  y: number,
  w: number,
  h: number,
  drivers: Array<[number, number]>,
): string {
  const parts = [
    shadow(x + w / 2, y + h + 14, w * 0.75),
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.16}" fill="${C.bronze}"/>`,
    `<rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="${w * 0.13}" fill="${C.graphite}"/>`,
  ]
  for (const [cy, r] of drivers) {
    parts.push(
      `<circle cx="${x + w / 2}" cy="${y + cy * h}" r="${r * w}" fill="${C.lacquer}"/><circle cx="${x + w / 2}" cy="${y + cy * h}" r="${r * w * 0.62}" fill="${C.steel}"/><circle cx="${x + w / 2}" cy="${y + cy * h}" r="${r * w * 0.2}" fill="${C.deep}"/>`,
    )
  }
  return parts.join('')
}

function draw(shape: ProductShape, view: number): string {
  const tilt = view === 1 ? ' transform="translate(800 600) scale(0.86) translate(-800 -600)"' : ''
  let body: string
  switch (shape) {
    case 'amp':
      body = chassis(260, 430, 1080, 400, 2, 4)
      break
    case 'preamp':
      body = chassis(260, 480, 1080, 300, 2, 6)
      break
    case 'receiver':
      body =
        chassis(260, 440, 1080, 380, 0, 5) +
        `<rect x="560" y="500" width="480" height="90" rx="8" fill="${C.lacquer}"/><rect x="580" y="525" width="200" height="40" rx="4" fill="${C.amber}" opacity="0.8"/>`
      break
    case 'source':
      body =
        chassis(300, 520, 1000, 240, 0, 3) +
        `<rect x="420" y="575" width="520" height="22" rx="11" fill="${C.lacquer}"/>`
      break
    case 'streamer':
      body =
        shadow(800, 760, 330) +
        `<rect x="520" y="560" width="560" height="190" rx="40" fill="${C.lacquer}"/><circle cx="800" cy="610" r="22" fill="${C.amber}"/><rect x="600" y="690" width="400" height="10" rx="5" fill="${C.steel}"/>`
      break
    case 'wireless':
      body =
        shadow(800, 960, 300) +
        `<rect x="560" y="300" width="480" height="640" rx="200" fill="${C.graphite}"/><rect x="590" y="330" width="420" height="580" rx="180" fill="${C.steel}" opacity="0.35"/><circle cx="800" cy="380" r="16" fill="${C.amber}"/>`
      break
    case 'speaker-stand':
      body =
        cabinet(470, 250, 290, 470, [
          [0.28, 0.12],
          [0.66, 0.3],
        ]) +
        cabinet(840, 250, 290, 470, [
          [0.28, 0.12],
          [0.66, 0.3],
        ]) +
        `<rect x="590" y="720" width="50" height="300" fill="${C.lacquer}"/><rect x="960" y="720" width="50" height="300" fill="${C.lacquer}"/><rect x="520" y="1010" width="190" height="24" rx="6" fill="${C.lacquer}"/><rect x="890" y="1010" width="190" height="24" rx="6" fill="${C.lacquer}"/>`
      break
    case 'speaker-floor':
      body = cabinet(640, 120, 320, 930, [
        [0.12, 0.09],
        [0.3, 0.26],
        [0.55, 0.3],
        [0.8, 0.3],
      ])
      break
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${backdrop(view)}<g${tilt}>${body}</g></svg>`
}

/** One product image as WebP (about 20–60 KB). `view` varies the backdrop and framing. */
export function productImage(shape: ProductShape, view = 0): Promise<Buffer> {
  return sharp(Buffer.from(draw(shape, view)))
    .webp({ quality: 78 })
    .toBuffer()
}

/** The home hero poster: a dark listening room with a pair of floor-standing speakers. */
export function heroPoster(): Promise<Buffer> {
  const width = 1920
  const height = 1080
  const speaker = (x: number) =>
    `<rect x="${x}" y="300" width="230" height="640" rx="40" fill="${C.bronze}" opacity="0.9"/><rect x="${x + 10}" y="310" width="210" height="620" rx="34" fill="${C.graphite}"/>` +
    [380, 520, 700, 860]
      .map(
        (cy, i) =>
          `<circle cx="${x + 115}" cy="${cy}" r="${i === 0 ? 26 : 62}" fill="${C.lacquer}"/><circle cx="${x + 115}" cy="${cy}" r="${i === 0 ? 14 : 38}" fill="${C.steel}" opacity="0.6"/>`,
      )
      .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.roomTop}"/><stop offset="0.72" stop-color="${C.lacquer}"/><stop offset="1" stop-color="${C.floor}"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="${C.amber}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#room)"/><rect width="${width}" height="${height}" fill="url(#glow)"/>
    <rect x="0" y="940" width="${width}" height="140" fill="${C.floor}"/>
    ${speaker(1180)}${speaker(1560)}
    <rect x="1420" y="840" width="100" height="100" rx="8" fill="${C.graphite}"/><rect x="1430" y="860" width="80" height="16" rx="3" fill="${C.amber}" opacity="0.7"/>
  </svg>`
  return sharp(Buffer.from(svg)).webp({ quality: 72 }).toBuffer()
}
