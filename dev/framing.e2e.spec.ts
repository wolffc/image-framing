import { type Browser, expect, type Locator, type Page, test } from '@playwright/test'

import { baseURL, cleanup, login, seed } from './helpers/e2e.js'

/**
 * In the admin panel an editor crops a red strip off the left of a panorama,
 * then gives one page's hero its own crop, then one wider than the media
 * crop; the page shows exactly that each time, on a phone and on desktop.
 */

const title = `e2e framing ${Date.now()}`
const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]

let token: string
let mediaId: number | string
let pageId: number | string

/** A browser page logged in to the admin panel. */
const admin = async (browser: Browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addCookies([{ name: 'payload-token', url: baseURL, value: token }])
  return context.newPage()
}

const heroImage = (page: Page) => page.locator(`[data-page="${pageId}"] [data-usage="hero"] img`)

/** The number of clearly red pixels in the file the browser loaded for the hero. */
const redPixels = (page: Page) =>
  heroImage(page).evaluate(async (img: HTMLImageElement) => {
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

/** Opens an admin page and waits until its form is ready for input. */
const open = async (page: Page, path: string) => {
  await page.goto(`${baseURL}${path}`)
  await page.waitForLoadState('networkidle')
}

/** Types a value, again if the form wasn't ready to take it the first time. */
const enter = async (input: Locator, value: string) => {
  await expect(async () => {
    await input.fill(value)
    await input.blur()
    await expect(input).toHaveValue(value, { timeout: 1000 })
  }).toPass({ timeout: 30_000 })
}

const save = async (page: Page) => {
  await expect(page.locator('#action-save')).toBeEnabled({ timeout: 30_000 })
  await page.click('#action-save')
  await expect(page.getByText(/successfully/i).first()).toBeVisible({ timeout: 30_000 })
}

/** Opens the site and returns the hero image's URL, once it is `expected`. */
const siteWith = async (
  browser: Browser,
  viewport: (typeof viewports)[number],
  expected: string,
) => {
  const site = await (await browser.newContext({ viewport })).newPage()
  await expect(async () => {
    await site.goto(`${baseURL}/`)
    expect(await heroImage(site).evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(
      expected,
    )
  }).toPass({ timeout: 30_000 })
  return site
}

test.describe('Image framing', () => {
  // Each test builds on the crop the one before it set.
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    token = await login()
    ;({ mediaId, pageId } = await seed(token, title))
  })

  test.afterAll(async () => {
    await cleanup(token, title)
  })

  test('crops a photo in the media editor; the page shows only the crop', async ({ browser }) => {
    const page = await admin(browser)
    await open(page, `/admin/collections/media/${mediaId}`)
    const editor = page.locator('[data-image-framing-editor]')
    await expect(editor).toBeVisible()
    // Payload's destructive "Edit image" tool is gone.
    await expect(page.getByRole('button', { name: 'Edit Image' })).toHaveCount(0)

    await enter(editor.locator('[data-framing-input="crop.x"]'), '10')
    await enter(editor.locator('[data-framing-input="crop.width"]'), '90')
    await save(page)

    for (const viewport of viewports) {
      const site = await siteWith(
        browser,
        viewport,
        `/api/media/crop/${mediaId}/1000-0-9000-10000.`,
      )
      expect(await redPixels(site)).toBe(0)
      // The subject sits at 80-90 %: the frame moves (almost) as far right as the crop allows.
      const [x] = (await heroImage(site).evaluate((img) => getComputedStyle(img).objectPosition))
        .split(' ')
        .map(parseFloat)
      expect(x, `object-position at ${viewport.width}px`).toBeGreaterThanOrEqual(90)
      await site.context().close()
    }
  })

  test('sets a crop for the hero only in the usage drawer', async ({ browser }) => {
    const page = await admin(browser)
    await open(page, `/admin/collections/pages/${pageId}`)

    const usage = page.locator('[data-image-framing-usage]').first()
    await expect(usage).toContainText('Default framing')
    await usage.getByRole('button', { name: /adjust the framing/i }).click()

    const drawer = page.locator('[data-image-framing-drawer]')
    await expect(drawer).toBeVisible()
    // The tablet preview shows the text band on the left.
    await expect(drawer.locator('[data-framing-preview="md"] [data-cover="left"]')).toBeVisible()

    // Only the right half of the photo for this hero.
    await enter(drawer.locator('[data-framing-input="crop.x"]'), '50')
    await enter(drawer.locator('[data-framing-input="crop.width"]'), '50')
    await drawer.getByRole('button', { name: 'Done' }).click()
    await expect(usage).toContainText('Custom framing')
    await save(page)

    for (const viewport of viewports) {
      const site = await siteWith(
        browser,
        viewport,
        `/api/media/crop/${mediaId}/5000-0-5000-10000.`,
      )
      expect(await redPixels(site)).toBe(0)
      await site.context().close()
    }
  })

  // The media crop (10-100 %) is only the default: a usage may show more of
  // the photo, here the red strip the media crop leaves out.
  test('lets a usage crop wider than the media crop', async ({ browser }) => {
    const page = await admin(browser)
    await open(page, `/admin/collections/pages/${pageId}`)
    await page
      .locator('[data-image-framing-usage]')
      .first()
      .getByRole('button', { name: /adjust the framing/i })
      .click()
    const drawer = page.locator('[data-image-framing-drawer]')
    await expect(drawer).toBeVisible()

    const x = drawer.locator('[data-framing-input="crop.x"]')
    const width = drawer.locator('[data-framing-input="crop.width"]')
    await enter(x, '0')
    await enter(width, '95')
    // Not pulled back to the media crop's left edge at 10 %.
    await expect(x).toHaveValue('0')
    await expect(width).toHaveValue('95')
    await drawer.getByRole('button', { name: 'Done' }).click()
    await save(page)

    const site = await siteWith(browser, viewports[1], `/api/media/crop/${mediaId}/0-0-9500-10000.`)
    expect(await redPixels(site)).toBeGreaterThan(0)
    await site.context().close()
  })
})
