import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { composeStories } from '@storybook/react'
import { describe, expect, it } from 'vitest'

/**
 * Library conventions that lint cannot see. Runs in CI with the unit tests.
 *
 * 1. Every component has the five stories: Default, Loading, Empty, Error, RTL.
 * 2. Amber, green and bronze never colour text (they fail 4.5:1 on the light page); they may
 *    colour icons and dots, and amber text is allowed only on lacquer (primary hover).
 * 3. Padding, margin and gap stay on the 4-px scale: 1, 2, 3, 4, 6, 8, 12, 16 steps.
 * 4. One exported component per file, named as the file.
 * 5. Every story renders on the server without throwing.
 */
const COMPONENTS_DIR = join(import.meta.dirname, 'components')
const components = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

const REQUIRED_STORIES = ['Default', 'Loading', 'Empty', 'Error', 'Rtl'] as const
const storyModules: Record<string, Record<string, unknown>> = Object.fromEntries(
  await Promise.all(
    components
      .filter((name) => existsSync(join(COMPONENTS_DIR, name, `${name}.stories.tsx`)))
      .map(
        async (name) =>
          [
            `./components/${name}/${name}.stories.tsx`,
            (await import(`./components/${name}/${name}.stories.tsx`)) as Record<string, unknown>,
          ] as const,
      ),
  ),
)
const source = (name: string) => readFileSync(join(COMPONENTS_DIR, name, `${name}.tsx`), 'utf8')

describe('component inventory', () => {
  it('includes every component the task lists', () => {
    const inventory = [
      'AppShell',
      'Header',
      'MarketSwitch',
      'AnnouncementBar',
      'Footer',
      'QuietActions',
      'Breadcrumb',
      'Section',
      'Grid',
      'Button',
      'Input',
      'Select',
      'Chip',
      'Badge',
      'Card',
      'Skeleton',
      'EmptyState',
      'ErrorState',
      'PriceBlock',
      'StockLine',
      'Marker',
      'Hero',
      'ProductCard',
      'Gallery',
      'SpecTable',
      'EntryCard',
      'FacetRail',
      'SortMenu',
      'Pagination',
      'BrandTile',
      'BagLine',
      'OrderSummary',
      'CheckoutSection',
      'PaymentMethodList',
      'OrderTimeline',
    ]
    expect(inventory.filter((c) => !components.includes(c))).toEqual([])
  })

  it('gives every component the five state stories', () => {
    const missing: string[] = []
    for (const name of components) {
      const stories = storyModules[`./components/${name}/${name}.stories.tsx`]
      if (!stories) {
        missing.push(`${name}: no ${name}.stories.tsx`)
        continue
      }
      const absent = REQUIRED_STORIES.filter((s) => !(s in stories))
      if (absent.length) missing.push(`${name}: missing ${absent.join(', ')}`)
      const rtl = stories['Rtl'] as
        { name?: string; parameters?: { direction?: string } } | undefined
      if (rtl && (rtl.name !== 'RTL' || rtl.parameters?.direction !== 'rtl'))
        missing.push(`${name}: Rtl story must be named "RTL" and set parameters.direction = 'rtl'`)
    }
    expect(missing, `Components missing a required story:\n  ${missing.join('\n  ')}`).toEqual([])
  })
})

describe('colour rules', () => {
  it.each(components)('%s uses amber, green and bronze only on icons, dots or lacquer', (name) => {
    const offenders = source(name)
      .split('\n')
      .filter((line) => /\btext-(vu-amber|signal-green|bronze)\b/.test(line))
      .filter((line) => {
        if (/<Icon\b|iconClass/.test(line)) return false // icon colour: non-text, 3:1 suffices
        if (/hover:text-vu-amber/.test(line) && /hover:bg-lacquer/.test(line)) return false // amber on lacquer, 7.8:1
        return true
      })
    expect(offenders).toEqual([])
  })

  it('makes the primary button an amber fill with lacquer text', () => {
    expect(source('Button')).toMatch(/primary:\s*'[^']*\bbg-vu-amber\b[^']*\btext-lacquer\b/)
  })
})

describe('spacing scale', () => {
  const STEPS = new Set(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16', 'auto'])
  it.each(components)('%s keeps padding, margin and gap on the scale', (name) => {
    const off = [
      ...source(name).matchAll(
        /(?<![\w-])-?(?:gap-x|gap-y|gap|px|py|ps|pe|pt|pb|p|mx|my|ms|me|mt|mb|m)-([\w.]+)/g,
      ),
    ]
      .map((m) => m[0])
      .filter((cls) => !STEPS.has(cls.split('-').pop() ?? ''))
    expect(off).toEqual([])
  })
})

describe('files', () => {
  it.each(components)('%s exports one component, named as its file', (name) => {
    expect(existsSync(join(COMPONENTS_DIR, name, `${name}.tsx`))).toBe(true)
    const exported = [...source(name).matchAll(/export function ([A-Z]\w*)/g)].map((m) => m[1])
    expect(exported).toEqual([name])
  })
})

describe('stories render', () => {
  for (const [path, mod] of Object.entries(storyModules)) {
    const composed = composeStories(mod as Parameters<typeof composeStories>[0])
    for (const [exportName, story] of Object.entries(composed)) {
      const Story = story as ComponentType
      it(`${path.split('/')[2]} / ${exportName}`, () => {
        expect(() => renderToStaticMarkup(<Story />)).not.toThrow()
      })
    }
  }
})
