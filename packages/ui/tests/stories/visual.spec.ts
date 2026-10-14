import { expect, test } from '@playwright/test'
import { openStory, storyCases } from './stories'

/**
 * One baseline per story and direction in tests/stories/__screenshots__. Stories that render
 * nothing on purpose (an empty Badge, a dismissed banner) have no box to photograph; their
 * markup is pinned as text instead, so "renders nothing" is still checked.
 */
for (const story of storyCases()) {
  test(`${story.title} / ${story.name} [${story.direction}]`, async ({ page }) => {
    await openStory(page, story)
    const root = page.locator('#storybook-root')
    const box = await root.boundingBox()
    if (!box || box.width === 0 || box.height === 0) {
      expect(await root.innerHTML()).toMatchSnapshot(`${story.id}.${story.direction}.html`)
      return
    }
    await expect(root).toHaveScreenshot(`${story.id}.${story.direction}.png`)
  })
}
