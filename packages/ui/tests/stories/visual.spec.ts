import { expect, test, type Page } from '@playwright/test'
import { openStory, storyCases } from './stories'

/** Glyphs painted by a system font rather than a self-hosted web font, as "family × count". */
async function systemFontGlyphs(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '#storybook-root *',
  })
  const counts = new Map<string, number>()
  for (const nodeId of nodeIds) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    for (const font of fonts) {
      if (!font.isCustomFont)
        counts.set(font.familyName, (counts.get(font.familyName) ?? 0) + font.glyphCount)
    }
  }
  await cdp.detach()
  return [...counts].map(([family, n]) => `${family} × ${n}`)
}

/**
 * One baseline per story and direction in tests/stories/__screenshots__.
 *
 * Every glyph must come from the self-hosted fonts: system fonts differ between machines, and
 * a glyph falling back to one would make the baseline machine-specific (and is a real gap in
 * a font stack). Stories that render nothing on purpose have no box to photograph; their
 * markup is pinned as text instead, so "renders nothing" is still checked.
 */
for (const story of storyCases()) {
  test(`${story.title} / ${story.name} [${story.direction}]`, async ({ page }) => {
    await openStory(page, story)
    expect(await systemFontGlyphs(page), 'glyphs rendered in a system font').toEqual([])
    const root = page.locator('#storybook-root')
    const box = await root.boundingBox()
    if (!box || box.width === 0 || box.height === 0) {
      expect(await root.innerHTML()).toMatchSnapshot(`${story.id}.${story.direction}.html`)
      return
    }
    await expect(root).toHaveScreenshot(`${story.id}.${story.direction}.png`)
  })
}
