import { preload } from 'react-dom'
import faces from './faces.json'

/**
 * Self-hosted fonts (docs/spec, Design system and Performance). Faces come from Fontsource,
 * already subset by Unicode range; `scripts/sync-fonts.mjs` copies them into an app's public
 * folder under `/fonts/<version>/`, so URLs change with the files and can be cached forever.
 */
export interface FontFaceSpec {
  family: string
  package: string
  version: string
  file: string
  style: string
  weight: string
  stretch?: string
  unicodeRange: string
  /** Locales whose first paint needs this face (preloaded). */
  preload: string[]
}

export const FONT_FACES: readonly FontFaceSpec[] = faces
export const DEFAULT_FONT_BASE = '/fonts'
/** Spec budget: at most four font files on first paint. */
export const MAX_FIRST_PAINT_FONTS = 4

export function fontUrl(face: FontFaceSpec, base: string = DEFAULT_FONT_BASE): string {
  return `${base.replace(/\/+$/, '')}/${face.version}/${face.file}`
}

/** `@font-face` rules for every face, all with `font-display: swap`. */
export function fontFaceCss(base: string = DEFAULT_FONT_BASE): string {
  return FONT_FACES.map((face) =>
    [
      '@font-face{',
      `font-family:'${face.family}';`,
      `font-style:${face.style};`,
      `font-weight:${face.weight};`,
      face.stretch ? `font-stretch:${face.stretch};` : '',
      'font-display:swap;',
      `src:url('${fontUrl(face, base)}') format('woff2');`,
      `unicode-range:${face.unicodeRange};`,
      '}',
    ].join(''),
  ).join('\n')
}

export interface FontPreload {
  href: string
  type: 'font/woff2'
}

/** The faces a locale's first paint needs, in preload order. */
export function fontPreloads(locale: string, base: string = DEFAULT_FONT_BASE): FontPreload[] {
  return FONT_FACES.filter((face) => face.preload.includes(locale)).map((face) => ({
    href: fontUrl(face, base),
    type: 'font/woff2',
  }))
}

/**
 * Emits `<link rel="preload" as="font">` for a locale's first-paint faces. Call it from a
 * server component (the root layout); React hoists the links into `<head>`.
 */
export function preloadFonts(locale: string, base: string = DEFAULT_FONT_BASE): void {
  for (const font of fontPreloads(locale, base)) {
    preload(font.href, { as: 'font', type: font.type, crossOrigin: 'anonymous' })
  }
}
