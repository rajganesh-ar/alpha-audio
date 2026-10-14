import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WCAG contrast for every colour pairing the components use, computed from tokens.css itself
 * (including the color-mix() roles), in the light page and in the dark band.
 */
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`)
  return value
}

/** Collapses formatting (Prettier wraps long color-mix() calls) to one canonical line. */
function normalise(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')').trim()
}

function declarations(scope: string): Record<string, string> {
  const start = css.indexOf(`${scope} {`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries(
    [...block.matchAll(/(--alpha-color-[\w-]+):\s*([^;]+);/g)].map((m) => [
      need(m[1], 'name'),
      normalise(need(m[2], 'value')),
    ]),
  )
}

const root = declarations(':root')
const dark = { ...root, ...declarations("[data-tone='dark']") }

type Rgb = [number, number, number]

function resolve(value: string, vars: Record<string, string>): Rgb {
  const hex = value.match(/^#([0-9a-f]{6})/i)
  const lookup = (name: string | undefined) => need(vars[need(name, 'reference')], `token ${name}`)
  if (hex) return [0, 2, 4].map((i) => parseInt(need(hex[1], 'hex').slice(i, i + 2), 16)) as Rgb
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  if (ref) return resolve(lookup(ref[1]), vars)
  const mix = value.match(/^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/)
  if (mix) {
    const [a, b] = [resolve(lookup(mix[1]), vars), resolve(lookup(mix[3]), vars)]
    const t = Number(mix[2]) / 100
    return [a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t), a[2] * t + b[2] * (1 - t)]
  }
  throw new Error(`cannot resolve ${value}`)
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(fg: string, bg: string, vars: Record<string, string>): number {
  const [a, b] = [
    luminance(resolve(`var(--alpha-color-${fg})`, vars)),
    luminance(resolve(`var(--alpha-color-${bg})`, vars)),
  ]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

describe('text contrast ≥ 4.5:1', () => {
  it.each([
    ['ink', 'aluminium', root],
    ['ink-muted', 'aluminium', root],
    ['ink', 'aluminium-deep', root],
    ['alert', 'aluminium', root],
    ['critical', 'aluminium', root],
    ['lacquer', 'vu-amber', root], // Button primary: amber fill, lacquer text
    ['aluminium', 'alert', root], // critical fills
    ['ink', 'lacquer', dark],
    ['ink-muted', 'lacquer', dark],
    ['vu-amber', 'lacquer', dark],
    ['critical', 'lacquer', dark],
  ] as const)('%s on %s', (fg, bg, vars) => {
    expect(contrast(fg, bg, vars)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('non-text contrast ≥ 3:1 (borders, icons, focus)', () => {
  it.each([
    ['line-strong', 'aluminium', root],
    ['signal-green', 'aluminium', root],
    ['bronze', 'aluminium', root],
    ['alert', 'aluminium', root],
    ['focus', 'aluminium', root],
    ['line-strong', 'lacquer', dark],
    ['focus', 'lacquer', dark],
  ] as const)('%s on %s', (fg, bg, vars) => {
    expect(contrast(fg, bg, vars)).toBeGreaterThanOrEqual(3)
  })
})

describe('colours that must never be text on the light page', () => {
  it.each(['vu-amber', 'signal-green', 'bronze'] as const)('%s fails 4.5:1 on aluminium', (fg) => {
    // If a palette change ever made these pass, the component rule could be relaxed;
    // until then components may not use them as text (see components.conventions.test.ts).
    expect(contrast(fg, 'aluminium', root)).toBeLessThan(4.5)
  })
})
