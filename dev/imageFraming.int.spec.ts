// @vitest-environment node
import fs from 'node:fs/promises'
import path from 'node:path'

import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Media } from '@/payload-types'
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

    it('refuses a crop wider than the media crop', async () => {
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
      expect((await requestCrop(left.resource.url)).status).toBe(404)
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
