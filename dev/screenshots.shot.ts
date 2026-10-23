import fs from 'node:fs'
import path from 'node:path'

import { expect, type Locator, type Page, test } from '@playwright/test'
import * as gifencModule from 'gifenc'
import sharp from 'sharp'

import { baseURL, login } from './helpers/e2e.js'

/**
 * The screenshots in docs/images, from the dev app: the media editor, a
 * usage's drawer and a GIF of moving the focus area. Run with
 * `./dev.sh screenshots`; the README and the showcase page use them.
 */

// gifenc is CommonJS: Node hands over its exports as `default`.
const gifenc = ((gifencModule as { default?: typeof gifencModule }).default ??
  gifencModule) as typeof gifencModule

const root = path.resolve(import.meta.dirname, '..')
const out = (name: string) => path.join(root, 'docs/images', name)
const title = `Screenshot sailboat ${Date.now()}`

// The sailboat drawing of the showcase page, with the same framing.
const photo = path.join(root, 'site/public/photos/sailboat.svg')
const crop = { x: 8, y: 6, width: 88, height: 90 }
const focusArea = { x: 69, y: 39, width: 13, height: 27 }

let token: string
let mediaId: number | string
let pageId: number | string

const api = async (pathname: string, init: RequestInit) => {
  const response = await fetch(`${baseURL}/api${pathname}`, {
    ...init,
    headers: { Authorization: `JWT ${token}`, ...init.headers },
  })
  if (!response.ok) throw new Error(`${init.method} ${pathname}: ${response.status}`)
  return response.json() as Promise<{ doc: { id: number | string } }>
}

test.beforeAll(async () => {
  token = await login()
  const form = new FormData()
  const png = await sharp(photo).png().toBuffer()
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'sailboat.png')
  form.append('_payload', JSON.stringify({ alt: title, crop, focusArea }))
  mediaId = (await api('/media', { body: form, method: 'POST' })).doc.id
  pageId = (
    await api('/pages', {
      body: JSON.stringify({
        title,
        hero: { heading: 'Into the weekend', image: mediaId, layout: 'fullBleed' },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  ).doc.id
})

test.afterAll(async () => {
  await api(`/pages/${pageId}`, { method: 'DELETE' })
  await api(`/media/${mediaId}`, { method: 'DELETE' })
})

const open = async (page: Page, pathname: string) => {
  await page.context().addCookies([{ name: 'payload-token', url: baseURL, value: token }])
  await page.goto(`${baseURL}${pathname}`)
  await page.waitForLoadState('networkidle')
}

/** Waits until every image in `locator` has loaded. */
const loaded = async (locator: Locator) => {
  for (const img of await locator.locator('img').all()) {
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
  }
}

/** Writes PNG screenshots as an endlessly looping GIF, `width` pixels wide. */
const writeGif = async (frames: { png: Buffer; delay: number }[], file: string, width: number) => {
  const gif = gifenc.GIFEncoder()
  for (const { png, delay } of frames) {
    const { data, info } = await sharp(png)
      .resize({ width })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const rgba = new Uint8Array(data)
    const palette = gifenc.quantize(rgba, 256)
    gif.writeFrame(gifenc.applyPalette(rgba, palette), info.width, info.height, { palette, delay })
  }
  gif.finish()
  fs.writeFileSync(file, gif.bytes())
}

test('media editor', async ({ page }) => {
  await open(page, `/admin/collections/media/${mediaId}`)
  const editor = page.locator('[data-image-framing-editor]').first()
  await expect(editor).toBeVisible()
  await loaded(editor)
  await editor.screenshot({ path: out('media-editor.png') })
})

test('moving the focus area (GIF)', async ({ page }) => {
  await open(page, `/admin/collections/media/${mediaId}`)
  const editor = page.locator('[data-image-framing-editor]').first()
  await loaded(editor)
  // Screenshots scroll the editor into view: measure after that.
  await editor.scrollIntoViewIfNeeded()
  const focus = editor.locator('[data-framing-rect="focusArea"]')
  const box = (await focus.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  const frames: { png: Buffer; delay: number }[] = []
  const shot = async (delay: number) =>
    frames.push({ png: await editor.screenshot({ animations: 'disabled' }), delay })

  // Drag the focus area from the boat to the sun and back, then hold.
  const route = [
    { dx: 0, dy: 0 },
    { dx: -300, dy: 40 },
    { dx: -300, dy: 40 },
    { dx: 0, dy: 0 },
  ]
  await shot(900)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let leg = 1; leg < route.length; leg++) {
    const from = route[leg - 1]
    const to = route[leg]
    const steps = from.dx === to.dx && from.dy === to.dy ? 1 : 10
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      await page.mouse.move(
        start.x + from.dx + (to.dx - from.dx) * t,
        start.y + from.dy + (to.dy - from.dy) * t,
      )
      await shot(steps === 1 ? 900 : 70)
    }
  }
  await page.mouse.up()
  await shot(1200)
  await writeGif(frames, out('focus-editing.gif'), 680)
})

test('usage drawer', async ({ page }) => {
  await open(page, `/admin/collections/pages/${pageId}`)
  await page
    .locator('[data-image-framing-usage]')
    .first()
    .getByRole('button', { name: /adjust the framing/i })
    .click()
  const drawer = page.locator('[data-image-framing-drawer]')
  await expect(drawer).toBeVisible()
  // A crop of its own for this hero: tighter around the boat.
  const x = drawer.locator('[data-framing-input="crop.x"]')
  const width = drawer.locator('[data-framing-input="crop.width"]')
  await expect(async () => {
    await x.fill('40')
    await x.blur()
    await width.fill('56')
    await width.blur()
    await expect(width).toHaveValue('56', { timeout: 1000 })
  }).toPass({ timeout: 30_000 })
  await loaded(drawer)
  await drawer.screenshot({ path: out('usage-drawer.png') })
})
