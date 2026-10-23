// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { cropUrl, frameImage } from '@wolffc/payload-image-framing/server'
import { getPayload, handleEndpoints, type Payload, type SanitizedConfig } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import configPromise from './payload.config.js'
import type { Media, Page } from './payload-types.js'

/**
 * The plugin in the dev app, end to end against a real Payload on the database
 * DATABASE_URI names (SQLite by default; CI runs Postgres and MongoDB too): the
 * rects are stored, the original file stays untouched, neither the cropped
 * copies nor the generated sizes contain a pixel from outside the crop, and
 * every kind of usage stores and serves its own crop.
 */

const secret = process.env.PAYLOAD_SECRET!

/** The installed Payload version, e.g. [3, 91, 0]. */
const payloadVersion = (() => {
  let dir = path.dirname(createRequire(import.meta.url).resolve('payload'))
  while (!existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir)
  const { version } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    version: string
  }
  return version.split('.').map(Number)
})()

// Before 3.80, Payload shares the values of a group nested in a localized group
// between locales, and every usage group nests the crop and focus area groups.
const localizedGroupsWork =
  payloadVersion[0] > 3 || (payloadVersion[0] === 3 && payloadVersion[1] >= 80)

let config: SanitizedConfig
let payload: Payload

// 1600 x 800, so Payload generates every size: the left half red, the right half blue.
const redBlue = () =>
  sharp({ create: { width: 1600, height: 800, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([
      {
        input: {
          create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 0, b: 0 } },
        },
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer()

/** The largest red value of any pixel, so 0-ish means no red pixel at all. */
const maxRed = async (image: Buffer): Promise<number> => {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let max = 0
  for (let i = 0; i < data.length; i += info.channels) max = Math.max(max, data[i])
  return max
}

const request = (url: string) =>
  handleEndpoints({ config, request: new Request(new URL(url, 'http://localhost')) })

const body = async (response: Response) => Buffer.from(await response.arrayBuffer())

const staticDir = () => payload.collections.media.config.upload.staticDir as string

const upload = async (data: Partial<Media> = {}) => {
  const file = await redBlue()
  return payload.create({
    collection: 'media',
    data: { alt: 'framing int test', ...data },
    file: {
      data: file,
      mimetype: 'image/png',
      name: `framing-${Date.now()}.png`,
      size: file.length,
    },
  })
}

beforeAll(async () => {
  config = await configPromise
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.delete({ collection: 'pages', where: { title: { like: 'framing int' } } })
  await payload.delete({ collection: 'media', where: { alt: { equals: 'framing int test' } } })
  await payload.db?.destroy?.()
})

describe('media framing', () => {
  let media: Media

  beforeAll(async () => {
    media = await upload()
  })

  it('no longer offers the destructive crop', () => {
    expect(payload.collections.media.config.upload.crop).toBe(false)
  })

  it('gives new media the whole photo as crop and a focus area around the centre', () => {
    expect(media.crop).toMatchObject({ x: 0, y: 0, width: 100, height: 100 })
    expect(media.focusArea?.x).toBeGreaterThan(0)
    expect((media.focusArea?.x ?? 0) + (media.focusArea?.width ?? 0) / 2).toBeCloseTo(50)
  })

  describe('with the crop set to the blue half', () => {
    let original: Buffer

    beforeAll(async () => {
      original = await fs.readFile(path.join(staticDir(), media.filename!))
      media = await payload.update({
        collection: 'media',
        id: media.id,
        data: {
          crop: { x: 50, y: 0, width: 50, height: 100 },
          focusArea: { x: 60, y: 20, width: 20, height: 60 },
        },
      })
    })

    it('stores the rects and moves the focal point to the focus area', () => {
      expect(media.crop).toMatchObject({ x: 50, y: 0, width: 50, height: 100 })
      expect(media.focusArea).toMatchObject({ x: 60, y: 20, width: 20, height: 60 })
      expect(media.focalX).toBeCloseTo(70)
      expect(media.focalY).toBeCloseTo(50)
    })

    it('returns the updatedAt the database keeps after rebuilding the sizes', async () => {
      const stored = await payload.findByID({ collection: 'media', id: media.id })

      expect(media.updatedAt).toBe(stored.updatedAt)
    })

    it('keeps the original file unchanged', async () => {
      const now = await fs.readFile(path.join(staticDir(), media.filename!))

      expect(now.equals(original)).toBe(true)
    })

    it('serves a cropped copy without a red pixel, then from its cache', async () => {
      const { resource } = frameImage({ media, secret })
      const response = await request(resource.url)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toContain('immutable')
      const copy = await body(response)
      const { width, height } = await sharp(copy).metadata()
      expect([width, height]).toEqual([800, 800])
      expect(await maxRed(copy)).toBeLessThan(30)

      expect((await request(resource.url)).headers.get('x-image-framing-cache')).toBe('hit')
    })

    it.each(['thumbnail', 'square', 'og'] as const)(
      'rebuilds the %s size from the crop area',
      async (size) => {
        const file = media.sizes?.[size]?.filename
        expect(file).toBeTruthy()

        expect(await maxRed(await fs.readFile(path.join(staticDir(), file!)))).toBeLessThan(30)
      },
    )

    it('refuses a token with a wrong signature', async () => {
      const { resource } = frameImage({ media, secret: 'not-the-secret' })

      expect((await request(resource.url)).status).toBe(404)
    })

    // A usage may show more than the media crop, so any signed rect inside the
    // photo is served; the signature keeps out made-up ones.
    it('serves a signed crop outside the media crop, as a usage may use one', async () => {
      const response = await request(cropUrl(media, { x: 0, y: 0, width: 50, height: 100 }, secret))

      expect(response.status).toBe(200)
      expect(await maxRed(await body(response))).toBeGreaterThan(200)
    })

    it('refuses a crop outside the photo', async () => {
      await expect(
        payload.update({
          collection: 'media',
          id: media.id,
          data: { crop: { x: 60, y: 0, width: 60, height: 100 } },
        }),
      ).rejects.toThrow()
    })
  })
})

describe('usage overrides', () => {
  let photo: Media
  let page: Page

  beforeAll(async () => {
    photo = await upload({ crop: { x: 25, y: 0, width: 75, height: 100 } })
    page = await payload.create({
      collection: 'pages',
      data: {
        title: 'framing int overrides',
        hero: {
          layout: 'fullBleed',
          image: photo.id,
          // The blue half only.
          imageFraming: { crop: { x: 50, y: 0, width: 50, height: 100 } },
        },
        gallery: [
          { image: photo.id, imageFraming: { crop: { x: 60, y: 0, width: 40, height: 100 } } },
        ],
        social: { image: photo.id, imageFraming: { crop: { x: 50, y: 0, width: 50, height: 50 } } },
        layout: [
          {
            blockType: 'card',
            image: photo.id,
            // Reaches into the red half, which the media crop partly excludes.
            imageFraming: { crop: { x: 0, y: 0, width: 60, height: 100 } },
          },
          {
            blockType: 'card',
            image: photo.id,
            // Leaves the photo on the right: saved clamped into it.
            imageFraming: { crop: { x: 50, y: 0, width: 80, height: 100 } },
          },
        ],
      },
    })
  })

  it('offers an override next to every framed usage', () => {
    const paths = (fields: unknown[], prefix: string): string[] =>
      fields.flatMap((field) => {
        const f = field as {
          blocks?: { slug: string; fields: unknown[] }[]
          fields?: unknown[]
          name?: string
          tabs?: { fields: unknown[] }[]
        }
        const here = f.name ? `${prefix}${f.name}` : prefix.replace(/\.$/, '')
        return [
          ...(f.name === 'imageFraming' ? [here] : []),
          ...(f.tabs ?? []).flatMap((tab) => paths(tab.fields, prefix)),
          ...(f.fields ? paths(f.fields, f.name ? `${here}.` : prefix) : []),
          ...(f.blocks ?? []).flatMap((block) => paths(block.fields, `${block.slug}.`)),
        ]
      })

    expect(paths(payload.collections.pages.config.fields, '').sort()).toEqual([
      'card.imageFraming',
      'gallery.imageFraming',
      'hero.imageFraming',
      'social.imageFraming',
    ])
    expect(paths(payload.globals.config.find((g) => g.slug === 'header')!.fields, '')).toEqual([
      'imageFraming',
    ])
  })

  it('stores the overrides of a group, an array row and blocks as they were set', () => {
    expect(page.hero?.imageFraming?.crop).toMatchObject({ x: 50, y: 0, width: 50, height: 100 })
    expect(page.gallery?.[0].imageFraming?.crop).toMatchObject({
      x: 60,
      y: 0,
      width: 40,
      height: 100,
    })
    // Wider than the media crop, as set.
    expect(page.layout?.[0].imageFraming?.crop).toMatchObject({
      x: 0,
      y: 0,
      width: 60,
      height: 100,
    })
    // Clamped into the photo.
    expect(page.layout?.[1].imageFraming?.crop).toMatchObject({
      x: 20,
      y: 0,
      width: 80,
      height: 100,
    })
  })

  it('serves a block crop wider than the media crop, including what the media crop leaves out', async () => {
    const { resource } = frameImage({
      media: photo,
      override: page.layout?.[0].imageFraming,
      secret,
    })
    const copy = await body(await request(resource.url))
    const { width, height } = await sharp(copy).metadata()

    // 0-60 % of the 1600 px photo, while the media crop starts at 25 %.
    expect([width, height]).toEqual([960, 800])
    expect(await maxRed(copy)).toBeGreaterThan(200)
  })

  it('serves exactly the hero crop, without a red pixel', async () => {
    const { resource } = frameImage({ media: photo, override: page.hero?.imageFraming, secret })
    const copy = await body(await request(resource.url))
    const { width, height } = await sharp(copy).metadata()

    expect([width, height]).toEqual([800, 800])
    expect(await maxRed(copy)).toBeLessThan(30)
  })

  it.skipIf(!localizedGroupsWork)(
    'keeps a localized image’s override per locale (Payload 3.80+)',
    async () => {
      await payload.update({
        collection: 'pages',
        id: page.id,
        locale: 'de',
        data: {
          social: {
            image: photo.id,
            imageFraming: { crop: { x: 0, y: 50, width: 50, height: 50 } },
          },
        },
      })
      const en = await payload.findByID({ collection: 'pages', id: page.id, locale: 'en' })
      const de = await payload.findByID({ collection: 'pages', id: page.id, locale: 'de' })

      expect(en.social?.imageFraming?.crop).toMatchObject({ x: 50, y: 0, width: 50, height: 50 })
      expect(de.social?.imageFraming?.crop).toMatchObject({ x: 0, y: 50, width: 50, height: 50 })
    },
  )

  it('stores a global’s override', async () => {
    await payload.updateGlobal({
      slug: 'header',
      data: { logo: photo.id, imageFraming: { crop: { x: 10, y: 10, width: 30, height: 30 } } },
    })
    const header = await payload.findGlobal({ slug: 'header' })

    expect(header.imageFraming?.crop).toMatchObject({ x: 10, y: 10, width: 30, height: 30 })
  })
})
