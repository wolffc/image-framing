// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { s3Storage } from '@payloadcms/storage-s3'
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
  type SanitizedConfig,
} from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { imageFramingPlugin } from '../../src/index.js'
import { frameImage } from '../../src/exports/server.js'
import { s3FramingStorage } from '../../src/s3/index.js'

/**
 * Cloud storage: `@payloadcms/storage-s3` keeps the files in a bucket
 * (`disableLocalStorage`), and the plugin rebuilds sizes and caches cropped
 * copies there through `s3FramingStorage`. Runs against an S3-compatible
 * server at S3_ENDPOINT (`./dev.sh test-s3`, or the CI job); skipped without.
 *
 * The framing plugin comes before `s3Storage` on purpose: the size rebuild
 * must still run after the storage plugin has uploaded the original.
 */

const endpoint = process.env.S3_ENDPOINT
const bucket = `image-framing-${Date.now()}`
const s3 = {
  bucket,
  config: {
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    endpoint,
    forcePathStyle: true,
    region: 'us-east-1',
  },
}
const client = new S3Client(s3.config)
const secret = 's3-test-secret'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-framing-s3-'))

let config: SanitizedConfig
let payload: Payload

const keys = async (Prefix: string) =>
  ((await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix }))).Contents ?? []).map(
    (object) => object.Key,
  )

const object = async (Key: string) => {
  const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key }))
  return Buffer.from(await Body!.transformToByteArray())
}

const upload = async (collection: 'media' | 'photos', crop?: Record<string, number>) => {
  const data = await sharp({
    create: { background: '#3a7bd5', channels: 3, height: 1000, width: 1500 },
  })
    .jpeg()
    .toBuffer()
  const doc = await payload.create({
    collection,
    data: {},
    file: { data, mimetype: 'image/jpeg', name: 'beach.jpg', size: data.length },
  })
  if (!crop) return doc
  return payload.update({ collection, id: doc.id, data: { crop } })
}

describe.skipIf(!endpoint)('cloud storage (S3)', () => {
  beforeAll(async () => {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
    const collection = (slug: string) => ({
      slug,
      access: { read: () => true },
      fields: [],
      upload: { imageSizes: [{ name: 'thumbnail', width: 400 }] },
    })
    config = await buildConfig({
      collections: [
        { slug: 'users', auth: true, fields: [] },
        collection('media'),
        collection('photos'),
      ],
      db: sqliteAdapter({ client: { url: `file:${path.join(tmp, 'db.sqlite')}` } }),
      plugins: [
        imageFramingPlugin({
          // media: sizes and cache in the bucket; photos: the default for storage plugins.
          collections: { media: { storage: s3FramingStorage(s3) }, photos: true },
        }),
        s3Storage({ ...s3, collections: { media: true, photos: { prefix: 'photos' } } }),
      ],
      secret,
      sharp,
    })
    payload = await getPayload({ config })
  }, 120_000)

  afterAll(async () => {
    await payload?.db?.destroy?.()
    fs.rmSync(tmp, { force: true, recursive: true })
  })

  const request = (url: string) =>
    handleEndpoints({ config, request: new Request(new URL(url, 'http://localhost')) })

  it('keeps the files only in the bucket', async () => {
    const media = await upload('media')

    expect(await keys(media.filename!)).toEqual([media.filename])
    expect(fs.existsSync(path.join(process.cwd(), 'media', media.filename!))).toBe(false)
  })

  it('rebuilds the sizes in the bucket from the crop', async () => {
    const media = await upload('media', { x: 20, y: 10, width: 70, height: 80 })
    const thumbnail = media.sizes!.thumbnail!

    // 70 % x 80 % of 1500 x 1000 is 1050 x 800; at 400 px wide that is 305 px high.
    expect(thumbnail).toMatchObject({ width: 400, height: 305 })
    const stored = await sharp(await object(thumbnail.filename!)).metadata()
    expect([stored.width, stored.height]).toEqual([400, 305])
  })

  it('serves cropped copies and caches them in the bucket', async () => {
    const media = await upload('media', { x: 20, y: 10, width: 70, height: 80 })
    const { resource } = frameImage({ media, secret })

    const first = await request(resource.url)
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Image-Framing-Cache')).toBe('miss')
    const served = await sharp(Buffer.from(await first.arrayBuffer())).metadata()
    expect([served.width, served.height]).toEqual([1050, 800])

    expect(await keys(`image-framing-cache/media/${media.id}-`)).toHaveLength(1)
    expect((await request(resource.url)).headers.get('X-Image-Framing-Cache')).toBe('hit')
  })

  it("removes a document's cached copies when it is deleted", async () => {
    const media = await upload('media', { x: 20, y: 10, width: 70, height: 80 })
    await request(frameImage({ media, secret }).resource.url)
    expect(await keys(`image-framing-cache/media/${media.id}-`)).toHaveLength(1)

    await payload.delete({ collection: 'media', id: media.id })

    expect(await keys(`image-framing-cache/media/${media.id}-`)).toEqual([])
  })

  it('serves cropped copies by default too, reading through the storage plugin', async () => {
    const photo = await upload('photos', { x: 20, y: 10, width: 70, height: 80 })
    const response = await request(frameImage({ media: photo, secret }).resource.url)

    expect(response.status).toBe(200)
    const served = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    expect([served.width, served.height]).toEqual([1050, 800])
    // The default can't write to the bucket, so the sizes stay as Payload made them.
    expect(photo.sizes!.thumbnail).toMatchObject({ width: 400, height: 267 })
  })
})
