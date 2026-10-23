import { expect, type Page, test } from '@playwright/test'

/**
 * The showcase page's widgets run the plugin's core in the browser: moving the
 * focus area moves the page hero at once, the window width picks the
 * breakpoint, and a block's own crop leaves the media's alone.
 */

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('./')
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

const position = (page: Page, hero: 'desktop' | 'phone') =>
  page.getByTestId(`hero-position-${hero}`).textContent()

/** Drags the focus area of the hero demo by dx/dy pixels. */
const dragFocus = async (page: Page, dx: number, dy: number) => {
  const focus = page.getByTestId('hero-demo').getByTestId('focus-rect')
  const box = (await focus.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}

test('moving the focus area sideways moves the phone hero', async ({ page }) => {
  const hero = page.getByTestId('hero-frame-phone')
  const before = await hero.getAttribute('data-object-position')

  // The sailboat is on the right: drag its focus area to the far left.
  await dragFocus(page, -600, 0)

  const after = await hero.getAttribute('data-object-position')
  expect(parseFloat(after!)).toBeLessThan(parseFloat(before!))
  expect(await position(page, 'phone')).toBe(after)
})

test('moving the focus area up moves the desktop hero', async ({ page }) => {
  const before = await position(page, 'desktop')
  await dragFocus(page, 0, -400)
  const after = await position(page, 'desktop')
  expect(parseFloat(after!.split(' ')[1])).toBeLessThan(parseFloat(before!.split(' ')[1]))
})

test('the focus area moves with the keyboard', async ({ page }) => {
  const before = await position(page, 'phone')
  await page.getByTestId('hero-demo').getByTestId('focus-rect').focus()
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('hero-position-phone')).not.toHaveText(before!)
})

test('the window width picks the breakpoint', async ({ page }) => {
  const demo = page.getByTestId('resize-demo')
  const window = page.getByTestId('resize-window')

  await demo.getByRole('button', { name: 'Phone' }).click()
  await expect(window).toHaveAttribute('data-breakpoint', 'base')
  await demo.getByRole('button', { name: 'Tablet' }).click()
  await expect(window).toHaveAttribute('data-breakpoint', 'md')
  await demo.getByRole('button', { name: 'Wide' }).click()
  await expect(window).toHaveAttribute('data-breakpoint', 'lg')
  await expect(page.getByTestId('resize-width')).toHaveText('1440 px')
})

test('a block crops tighter or wider without changing the media', async ({ page }) => {
  const demo = page.getByTestId('override-demo')
  const crop = page.getByTestId('override-crop')
  const media = await crop.textContent()

  await demo.getByRole('button', { name: 'Tighter' }).click()
  await expect(crop).not.toHaveText(media!)
  await demo.getByRole('button', { name: 'The whole photo' }).click()
  await expect(crop).toHaveText('x 0 · y 0 · 100 × 100 %')
  await expect(demo.getByText('Media default').locator('small')).toHaveText(media!)
  await demo.getByRole('button', { name: 'As the media' }).click()
  await expect(crop).toHaveText(media!)
})

test('switching the photo switches every widget', async ({ page }) => {
  await page.getByRole('button', { name: 'Lighthouse' }).click()
  await expect(page.getByTestId('hero-frame-desktop').locator('img')).toHaveAttribute(
    'src',
    /lighthouse\.svg$/,
  )
  await expect(page.getByTestId('resize-window').locator('img')).toHaveAttribute(
    'src',
    /lighthouse\.svg$/,
  )
})

test('the page fits the screen and its images load', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  for (const img of await page.locator('img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
  }
})

test('a corner dragged past the photo stops at its edge', async ({ page }) => {
  const editor = page.getByTestId('hero-demo').locator('.editor')
  const crop = page.getByTestId('hero-demo').getByTestId('crop-rect')
  await editor.scrollIntoViewIfNeeded()
  const before = (await crop.boundingBox())!
  const handle = crop.locator('.handle-se')
  const at = (await handle.boundingBox())!
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
  await page.mouse.down()
  await page.mouse.move(at.x + 120, at.y + 120, { steps: 6 })
  await page.mouse.up()

  const after = (await crop.boundingBox())!
  const area = (await editor.boundingBox())!
  // The top left corner stays; the bottom right one reaches the photo's corner.
  expect(after.x).toBeCloseTo(before.x, 0)
  expect(after.y).toBeCloseTo(before.y, 0)
  expect(after.x + after.width).toBeCloseTo(area.x + area.width, 0)
  expect(after.y + after.height).toBeCloseTo(area.y + area.height, 0)
})
