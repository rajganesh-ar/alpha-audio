import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openStory, storyCases } from './stories'

// WCAG 2.2 AA: every story, in both directions, with no violations.
for (const story of storyCases()) {
  test(`${story.title} / ${story.name} [${story.direction}]`, async ({ page }) => {
    await openStory(page, story)
    const { violations } = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const summary = violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    )
    expect(summary).toEqual([])
  })
}
