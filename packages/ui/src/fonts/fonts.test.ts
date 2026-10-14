import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_FACES, MAX_FIRST_PAINT_FONTS, fontFaceCss, fontPreloads, fontUrl } from './index'

const require = createRequire(import.meta.url)
const fileOf = (pkg: string, file: string) => require.resolve(`${pkg}/files/${file}`)

describe('font manifest', () => {
  it.each(FONT_FACES.map((f) => [f.file, f] as const))(
    '%s matches the installed package',
    (_file, face) => {
      const path = fileOf(face.package, face.file)
      expect(existsSync(path)).toBe(true)
      const pkgDir = dirname(dirname(path))
      expect(JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version).toBe(
        face.version,
      )
      // Guards Unicode-range drift on a Fontsource upgrade.
      const css = ['index.css', 'standard.css', `${face.weight.split(' ')[0]}.css`]
        .map((f) => join(pkgDir, f))
        .filter(existsSync)
        .map((f) => readFileSync(f, 'utf8'))
        .join('\n')
      const block = css
        .split('@font-face')
        .find((b) => b.includes(`files/${face.file})`) && b.includes('unicode-range'))
      expect(block, 'declaration in Fontsource CSS').toBeDefined()
      expect(block).toContain(`unicode-range: ${face.unicodeRange};`)
    },
  )

  it('declares the four families the spec names', () => {
    expect([...new Set(FONT_FACES.map((f) => f.family))].sort()).toEqual([
      'Archivo',
      'IBM Plex Sans Arabic',
      'JetBrains Mono',
      'Noto Kufi Arabic',
    ])
  })
})

describe('first paint', () => {
  it.each(['en', 'ar'])('%s preloads at most four files', (locale) => {
    const preloads = fontPreloads(locale)
    expect(preloads.length).toBeGreaterThan(0)
    expect(preloads.length).toBeLessThanOrEqual(MAX_FIRST_PAINT_FONTS)
  })

  it('preloads only Archivo for English and adds the Arabic faces for Arabic', () => {
    expect(fontPreloads('en').map((p) => p.href)).toEqual([
      '/fonts/5.3.0/archivo-latin-standard-normal.woff2',
    ])
    expect(fontPreloads('ar').map((p) => p.href.split('/').pop())).toEqual([
      'archivo-latin-standard-normal.woff2',
      'ibm-plex-sans-arabic-arabic-400-normal.woff2',
      'noto-kufi-arabic-arabic-wght-normal.woff2',
    ])
  })

  it('keeps the Arabic first paint under 300 KB of fonts', () => {
    const bytes = FONT_FACES.filter((f) => f.preload.includes('ar')).reduce(
      (sum, f) => sum + statSync(fileOf(f.package, f.file)).size,
      0,
    )
    expect(bytes).toBeLessThan(300 * 1024)
  })
})

describe('fontFaceCss', () => {
  const css = fontFaceCss('/static/fonts/')

  it('swaps every face and points at versioned URLs', () => {
    const rules = css.split('\n')
    expect(rules).toHaveLength(FONT_FACES.length)
    for (const rule of rules) expect(rule).toContain('font-display:swap;')
    expect(css).toContain(
      "src:url('/static/fonts/5.3.0/archivo-latin-standard-normal.woff2') format('woff2');",
    )
  })

  it('gives Archivo its width axis for the expanded display style', () => {
    expect(css).toMatch(/font-family:'Archivo';[^}]*font-stretch:62% 125%;/)
    const [archivo] = FONT_FACES
    if (!archivo) throw new Error('no faces')
    expect(fontUrl(archivo, '/x')).toBe('/x/5.3.0/archivo-latin-standard-normal.woff2')
  })
})

describe('fonts.css', () => {
  it('is generated from the manifest (update with `pnpm --filter @alpha/ui test -u`)', async () => {
    const header =
      '/* Generated from faces.json by fonts.test.ts. Do not edit; run `pnpm --filter @alpha/ui test -u`. */\n'
    await expect(`${header}${fontFaceCss()}\n`).toMatchFileSnapshot('./fonts.css')
  })
})

describe('screenshot fontconfig', () => {
  it('is well-formed XML for fontconfig (no "--" inside comments)', () => {
    const conf = readFileSync(join(import.meta.dirname, '../../tests/stories/fonts.conf'), 'utf8')
    for (const [, body] of conf.matchAll(/<!--([\s\S]*?)-->/g)) expect(body).not.toContain('--')
    expect(conf).toMatch(/<dir>[^<]+<\/dir>/)
  })
})
