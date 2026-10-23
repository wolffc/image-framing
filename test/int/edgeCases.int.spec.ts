// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { sqliteAdapter } from '@payloadcms/db-sqlite'
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
  type SanitizedConfig,
} from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cropUrl, frameImage } from '@wolffc80/payload-image-framing/server'
import { imageFramingPlugin } from '@wolffc80/payload-image-framing'

/**
 * Inputs a real Payload hands the plugin: animated GIFs, SVGs, large crops,
 * and the `updatedAt` the size rebuild must keep (#10 runs this file on every
 * database adapter).
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-framing-edge-'))
const secret = 'edge-secret'

let config: SanitizedConfig
let payload: Payload

const request = (url: string) =>
  handleEndpoints({ config, request: new Request(new URL(url, 'http://localhost')) })

const files = {
  /** Three 300 x 200 frames. */
  gif: async () => {
    const frames = await Promise.all(
      ['#f00', '#0f0', '#00f'].map((background) =>
        sharp({ create: { background, channels: 3, height: 200, width: 300 } })
          .png()
          .toBuffer(),
      ),
    )
    return sharp(frames, { join: { animated: true } })
      .gif({ delay: [100, 100, 100] })
      .toBuffer()
  },
  jpeg: (width: number, height: number) =>
    sharp({ create: { background: '#3a7bd5', channels: 3, height, width } })
      .jpeg()
      .toBuffer(),
  svg: async () =>
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="red"/></svg>',
    ),
}

const create = async (
  collection: 'images' | 'small',
  data: Buffer,
  name: string,
  mimetype: string,
) =>
  payload.create({
    collection,
    data: {},
    file: { data, mimetype, name, size: data.length },
  })

beforeAll(async () => {
  const collection = (slug: string) => ({
    slug,
    access: { read: () => true },
    fields: [],
    upload: {
      staticDir: path.join(tmp, slug),
      imageSizes: [{ name: 'thumbnail', width: 150 }],
    },
  })
  config = await buildConfig({
    collections: [collection('images'), collection('small')],
    db: sqliteAdapter({ client: { url: `file:${path.join(tmp, 'db.sqlite')}` } }),
    plugins: [imageFramingPlugin({ collections: { images: true, small: { maxSize: 200 } } })],
    secret,
    sharp,
  })
  payload = await getPayload({ config })
}, 120_000)

afterAll(async () => {
  await payload?.db?.destroy?.()
  fs.rmSync(tmp, { force: true, recursive: true })
})

describe('animated images', () => {
  it('keeps every frame in the cropped copy and the rebuilt sizes', async () => {
    const created = await create('images', await files.gif(), 'anim.gif', 'image/gif')
    const media = await payload.update({
      collection: 'images',
      id: created.id,
      data: { crop: { x: 10, y: 10, width: 50, height: 50 } },
    })

    const response = await request(frameImage({ media, secret }).resource.url)
    expect(response.status).toBe(200)
    const copy = await sharp(Buffer.from(await response.arrayBuffer()), {
      animated: true,
    }).metadata()
    // 50 % of 300 x 200 per frame, three frames.
    expect([copy.width, copy.pageHeight, copy.pages]).toEqual([150, 100, 3])

    const thumbnail = await sharp(
      fs.readFileSync(path.join(tmp, 'images', media.sizes!.thumbnail!.filename!)),
      { animated: true },
    ).metadata()
    expect([thumbnail.width, thumbnail.pageHeight, thumbnail.pages]).toEqual([150, 100, 3])
  })
})

describe('SVG', () => {
  it('saves, keeps no crop URL and gets no cropped copy', async () => {
    const created = await create('images', await files.svg(), 'logo.svg', 'image/svg+xml')
    const media = await payload.update({
      collection: 'images',
      id: created.id,
      data: { crop: { x: 10, y: 10, width: 50, height: 50 } },
    })
    const { resource } = frameImage({ media, secret })

    expect(resource.url).toBe(media.url)
    // A correctly signed URL, so only the SVG rule can refuse it.
    const signed = cropUrl(media, { x: 10, y: 10, width: 50, height: 50 }, secret)
    expect((await request(signed)).status).toBe(404)
    const photo = await create('images', await files.jpeg(300, 200), 'p.jpg', 'image/jpeg')
    expect(
      (await request(cropUrl(photo, { x: 10, y: 10, width: 50, height: 50 }, secret))).status,
    ).toBe(200)
  })
})

describe('large crops', () => {
  it('serves the copy no larger than maxSize, as frameImage reports', async () => {
    const created = await create('small', await files.jpeg(1500, 1000), 'big.jpg', 'image/jpeg')
    const media = await payload.update({
      collection: 'small',
      id: created.id,
      data: { crop: { x: 0, y: 0, width: 80, height: 80 } },
    })
    const { resource } = frameImage({ maxSize: 200, media, secret })

    const copy = await sharp(
      Buffer.from(await (await request(resource.url)).arrayBuffer()),
    ).metadata()
    // 80 % of 1500 x 1000 is 1200 x 800, scaled to 200 x 133.
    expect([copy.width, copy.height]).toEqual([200, 133])
    expect([resource.width, resource.height]).toEqual([200, 133])
  })
})

describe('updatedAt', () => {
  it('returns the updatedAt the database has after the size rebuild', async () => {
    const created = await create('images', await files.jpeg(1500, 1000), 'b.jpg', 'image/jpeg')
    const media = await payload.update({
      collection: 'images',
      id: created.id,
      data: { crop: { x: 20, y: 10, width: 70, height: 80 } },
    })
    const stored = await payload.findByID({ collection: 'images', id: media.id })

    expect(media.updatedAt).toBe(stored.updatedAt)
    expect((await request(frameImage({ media, secret }).resource.url)).status).toBe(200)
  })
})
