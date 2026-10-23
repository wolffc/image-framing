import path from 'node:path'

import { expect, test } from '@playwright/test'

test('social preview', async ({ page }) => {
  await page.goto('./social.html')
  const social = page.getByTestId('social')
  for (const img of await social.locator('img').all()) {
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
  }
  await social.screenshot({
    path: path.join(import.meta.dirname, 'public/social-preview.png'),
  })
})
