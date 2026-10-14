import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

export type Direction = 'ltr' | 'rtl'

export interface StoryCase {
  id: string
  title: string
  name: string
  direction: Direction
}

interface IndexEntry {
  id: string
  title: string
  name: string
  type: 'story' | 'docs'
}

/**
 * Every story in both directions. RTL stories fix their own direction, so they run once.
 * Read from the built Storybook's index.json, so a new story is covered without listing it.
 */
export function storyCases(): StoryCase[] {
  const index = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../storybook-static/index.json'), 'utf8'),
  ) as {
    entries: Record<string, IndexEntry>
  }
  return Object.values(index.entries)
    .filter((e) => e.type === 'story')
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((e) =>
      (e.name === 'RTL' ? (['rtl'] as const) : (['ltr', 'rtl'] as const)).map((direction) => ({
        id: e.id,
        title: e.title,
        name: e.name,
        direction,
      })),
    )
}

/** Opens a story in the bare iframe and waits until it has rendered with its fonts. */
export async function openStory(page: Page, story: StoryCase): Promise<void> {
  await page.goto(
    `/iframe.html?id=${story.id}&viewMode=story&globals=direction:${story.direction};a11y.manual:!true`,
  )
  await page.waitForFunction(
    () =>
      document.querySelector('#storybook-root')?.getAttribute('data-ready') !== null ||
      document.body.classList.contains('sb-show-main'),
  )
  await page.waitForFunction(() => document.documentElement.dir !== '')
  await page.evaluate(async () => {
    await document.fonts.ready
    // Let React effects (the banner reads cookies after mount) settle.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
