// @vitest-environment node
import fs from 'node:fs/promises'
import path from 'node:path'

import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Media, Page } from '@/payload-types'
import { frameImage } from '@/plugins/imageFraming/next'

/**
 * Non-destructive crop and focus areas on media (#316), end to end against a
 * real Payload and Postgres: the rects are stored, the original file stays
 * untouched, and neither the cropped copy nor the generated sizes contain a
 * pixel from outside the crop.
 */

let payload: Payload
let media: Media

// 1600 x 800, so Payload generates every size: the left half red, the right half blue.
const redBlue = () =>
  sharp({ create: { width: 1600, height: 800, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([
      {
        input: { create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 0, b: 0 } } },
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer()

/** The largest red value of any pixel, so 0-ish means no red pixel at all. */
const maxRed = async (image: Buffer): Promise<number> => {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let max = 0
  for (let i = 0; i < data.length; i += info.channels) max = Math.max(max, data[i])
  return max
}

const staticDir = () => payload.collections.media.config.upload.staticDir as string

const cropEndpoint = () => {
  const endpoints = payload.collections.media.config.endpoints || []
  const endpoint = endpoints.find((e) => e.path === '/crop/:id/:token/:filename')
  if (!endpoint) throw new Error('No crop endpoint on media')
  return endpoint
}

const requestCrop = async (url: string): Promise<Response> => {
  const [, , , , id, token, filename] = url.split('/')
  const req = (await createLocalReq({}, payload)) as PayloadRequest
  req.routeParams = { filename, id, token }
  return cropEndpoint().handler(req)
}

describe('Image framing', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const data = await redBlue()
    media = await payload.create({
      collection: 'media',
      data: { alt: 'Framing int test' },
      file: {
        data,
        mimetype: 'image/png',
        name: `framing-int-${Date.now()}.png`,
        size: data.length,
      },
    })
  })

  afterAll(async () => {
    if (media) await payload.delete({ collection: 'media', id: media.id })
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

    it('keeps the original file unchanged', async () => {
      const now = await fs.readFile(path.join(staticDir(), media.filename!))

      expect(now.equals(original)).toBe(true)
    })

    it('serves a cropped copy without a red pixel', async () => {
      const { resource } = frameImage({ media, secret: process.env.PAYLOAD_SECRET! })
      const response = await requestCrop(resource.url)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toContain('immutable')
      const body = Buffer.from(await response.arrayBuffer())
      const { width, height } = await sharp(body).metadata()
      expect([width, height]).toEqual([800, 800])
      expect(await maxRed(body)).toBeLessThan(30)
    })

    it('serves the copy from its cache the second time', async () => {
      const { resource } = frameImage({ media, secret: process.env.PAYLOAD_SECRET! })
      await requestCrop(resource.url)
      const cached = await requestCrop(resource.url)

      expect(cached.status).toBe(200)
      expect(cached.headers.get('x-image-framing-cache')).toBe('hit')
    })

    it.each(['thumbnail', 'square', 'og'] as const)(
      'rebuilds the %s size from the crop area',
      async (size) => {
        const file = media.sizes?.[size]?.filename
        expect(file).toBeTruthy()
        const image = await fs.readFile(path.join(staticDir(), file!))

        expect(await maxRed(image)).toBeLessThan(30)
      },
    )

    it('refuses a token with a wrong signature', async () => {
      const { resource } = frameImage({ media, secret: 'not-the-secret' })

      expect((await requestCrop(resource.url)).status).toBe(404)
    })

    // A block may show more than the media crop (#316 part 2), so any signed
    // rect inside the photo is served; the signature keeps out made-up ones.
    it('serves a signed crop outside the media crop, as a block may use one', async () => {
      const wider = frameImage({
        media: { ...media, crop: { x: 0, y: 0, width: 100, height: 100 } },
        secret: process.env.PAYLOAD_SECRET!,
      })
      // The whole photo has no cropped copy: it is the original URL.
      expect(wider.resource.url).toBe(media.url)

      const left = frameImage({
        media: { ...media, crop: { x: 0, y: 0, width: 50, height: 100 } },
        secret: process.env.PAYLOAD_SECRET!,
      })
      const response = await requestCrop(left.resource.url)
      expect(response.status).toBe(200)
      expect(await maxRed(Buffer.from(await response.arrayBuffer()))).toBeGreaterThan(200)
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

/**
 * Per-usage overrides (#316, part 2): a page's hero and blocks store their own
 * crop and focus area, narrower or wider than the media crop, and the page
 * serves a copy of exactly that crop.
 */
describe('Image framing overrides', () => {
  const slug = `framing-int-overrides-${Date.now()}`
  let photo: Media
  let page: Page

  const paragraph = {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
          children: [{ type: 'text', text: 'Overrides.', version: 1 }],
        },
      ],
    },
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const data = await redBlue()
    photo = await payload.create({
      collection: 'media',
      data: { alt: 'Framing override int test', crop: { x: 25, y: 0, width: 75, height: 100 } },
      file: { data, mimetype: 'image/png', name: `framing-override-${Date.now()}.png`, size: data.length },
    })
    page = await payload.create({
      collection: 'pages',
      context: { disableRevalidate: true },
      data: {
        title: 'Framing override int test',
        slug,
        _status: 'published',
        hero: {
          type: 'fullBleed',
          media: photo.id,
          // The blue half only.
          imageFraming: { crop: { x: 50, y: 0, width: 50, height: 100 } },
        },
        layout: [
          {
            blockType: 'cta',
            style: 'image',
            media: photo.id,
            richText: paragraph,
            // Reaches into the red half, which the media crop partly excludes.
            imageFraming: { crop: { x: 0, y: 0, width: 60, height: 100 } },
          },
          {
            blockType: 'mediaBlock',
            media: photo.id,
            // Leaves the photo on the right: saved clamped into the photo.
            imageFraming: { crop: { x: 50, y: 0, width: 80, height: 100 } },
          },
        ],
      } as never,
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'pages', where: { slug: { equals: slug } }, context: { disableRevalidate: true } })
    if (photo) await payload.delete({ collection: 'media', id: photo.id })
  })

  it('offers an override next to the image of every framed usage', () => {
    // Paths of every `imageFraming` field, through tabs, groups, rows and blocks.
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
      'cta.imageFraming',
      'editorialCard.imageFraming',
      'hero.imageFraming',
      'mediaBlock.imageFraming',
    ])
  })

  it('stores the hero override as it was set', () => {
    expect(page.hero.imageFraming?.crop).toMatchObject({ x: 50, y: 0, width: 50, height: 100 })
  })

  it('stores a block override wider than the media crop as it was set', () => {
    const cta = page.layout[0] as { imageFraming?: { crop?: unknown } }

    expect(cta.imageFraming?.crop).toMatchObject({ x: 0, y: 0, width: 60, height: 100 })
  })

  it('stores a block override that leaves the photo clamped into it', () => {
    const block = page.layout[1] as { imageFraming?: { crop?: unknown } }

    expect(block.imageFraming?.crop).toMatchObject({ x: 20, y: 0, width: 80, height: 100 })
  })

  it('serves a block crop wider than the media crop, including what the media crop leaves out', async () => {
    const cta = page.layout[0] as { imageFraming?: Page['hero']['imageFraming'] }
    const { resource } = frameImage({
      media: photo,
      override: cta.imageFraming,
      secret: process.env.PAYLOAD_SECRET!,
    })
    const response = await requestCrop(resource.url)

    expect(response.status).toBe(200)
    const body = Buffer.from(await response.arrayBuffer())
    const { width, height } = await sharp(body).metadata()
    // 0-60% of the 1600px photo, while the media crop starts at 25%.
    expect([width, height]).toEqual([960, 800])
    expect(await maxRed(body)).toBeGreaterThan(200)
  })

  it('serves exactly the hero crop, without a red pixel', async () => {
    const { resource } = frameImage({
      media: photo,
      override: page.hero.imageFraming,
      secret: process.env.PAYLOAD_SECRET!,
    })
    const response = await requestCrop(resource.url)

    expect(response.status).toBe(200)
    const body = Buffer.from(await response.arrayBuffer())
    const { width, height } = await sharp(body).metadata()
    expect([width, height]).toEqual([800, 800])
    expect(await maxRed(body)).toBeLessThan(30)
  })
})
