import { expect, type Page, test } from '@playwright/test'

import { login } from '../helpers/login'
import {
  cleanupImageFramingTestPage,
  imageFramingPageSlug,
  seedImageFramingTestPage,
} from '../helpers/seedImageFraming'
import { cleanupTestUser, seedTestUser, testUserFor } from '../helpers/seedUser'

/**
 * Non-destructive crop and focus areas (#316): an editor crops a red strip off
 * the left of a panorama in the admin panel, and the Full-bleed hero then shows
 * only the crop area, with the subject in the right part of the frame, on a
 * phone and on desktop.
 */

const testUser = testUserFor('image-framing')
const pageURL = `http://localhost:3000/uk/en/${imageFramingPageSlug}`

/** The number of clearly red pixels in the file the browser loaded for the hero. */
const redPixelsInHeroImage = (page: Page) =>
  page.locator('[data-hero="full-bleed"] img').evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(img, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let red = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 180 && data[i + 1] < 80 && data[i + 2] < 80) red++
    }
    return red
  })

test.describe('Image framing', () => {
  // The admin panel, a save that rebuilds the sizes and two page loads.
  test.setTimeout(120_000)

  let mediaId: number

  test.beforeAll(async () => {
    await seedTestUser(testUser)
    mediaId = await seedImageFramingTestPage()
  })

  test.afterAll(async () => {
    await cleanupImageFramingTestPage()
    await cleanupTestUser(testUser)
  })

  test('crops a photo in the admin panel and shows only the crop area on the site', async ({
    browser,
  }) => {
    const admin = await (await browser.newContext()).newPage()
    await login({ page: admin, user: testUser })
    await admin.goto(`http://localhost:3000/admin/collections/media/${mediaId}`)

    const editor = admin.locator('[data-image-framing-editor]')
    await expect(editor).toBeVisible()
    // The editor offers no destructive crop: Payload's own "Edit image" tool is gone.
    await expect(admin.getByRole('button', { name: 'Edit Image' })).toHaveCount(0)

    await editor.locator('[data-framing-input="crop.x"]').fill('10')
    await editor.locator('[data-framing-input="crop.width"]').fill('90')
    await admin.getByRole('button', { name: 'Save' }).click()
    await expect(admin.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 30_000 })

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      const site = await (await browser.newContext({ viewport })).newPage()
      const files: string[] = []
      site.on('request', (request) => files.push(request.url()))
      await site.goto(pageURL)

      const img = site.locator('[data-hero="full-bleed"] img')
      await expect(img).toBeVisible()
      expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain(
        encodeURIComponent(`/api/media/crop/${mediaId}/`),
      )
      // The original, with the red strip, is never requested.
      expect(files.filter((url) => url.includes('e2e-image-framing'))).not.toContainEqual(
        expect.stringContaining(encodeURIComponent('/api/media/file/')),
      )
      expect(await redPixelsInHeroImage(site)).toBe(0)

      // The subject sits at 80-90% of the photo: the frame moves as far right as the crop allows.
      const position = await img.evaluate((el) => getComputedStyle(el).objectPosition)
      expect(position, `object-position at ${viewport.width}px`).toMatch(/^100% /)

      await site.context().close()
    }
  })
})
