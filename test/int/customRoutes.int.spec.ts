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

import { imageFramingPlugin } from '../../src/index.js'
import { frameImage } from '../../src/exports/server.js'

/**
 * A project that shares nothing with weflyhome.com's setup: the upload
 * collection is called `images`, the API lives under `/cms-api`, and the
 * plugin gets no options besides the collection. Cropped copies must still be
 * rendered with the right URL and served from it.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-framing-int-'))
const secret = 'int-test-secret'

let config: SanitizedConfig
let payload: Payload

const request = (url: string, token?: string) =>
  handleEndpoints({
    config,
    request: new Request(new URL(url, 'http://localhost'), {
      headers: token ? { Authorization: `JWT ${token}` } : {},
    }),
  })

beforeAll(async () => {
  config = await buildConfig({
    collections: [
      { slug: 'users', auth: true, fields: [] },
      {
        slug: 'images',
        access: { read: () => true },
        fields: [],
        upload: {
          staticDir: path.join(tmp, 'images'),
          imageSizes: [{ name: 'thumbnail', width: 400 }],
        },
      },
      // Payload's default access: logged-in users only.
      { slug: 'private', fields: [], upload: { staticDir: path.join(tmp, 'private') } },
    ],
    db: sqliteAdapter({ client: { url: `file:${path.join(tmp, 'db.sqlite')}` } }),
    plugins: [imageFramingPlugin({ collections: ['images', 'private'] })],
    routes: { api: '/cms-api' },
    secret,
    sharp,
  })
  payload = await getPayload({ config })
}, 120_000)

afterAll(async () => {
  // payload.destroy() only exists from Payload 3.4x; the adapter's works everywhere.
  await payload?.db?.destroy?.()
  fs.rmSync(tmp, { force: true, recursive: true })
})

const photo = () =>
  sharp({ create: { background: '#3a7bd5', channels: 3, height: 1000, width: 1500 } })
    .jpeg()
    .toBuffer()

const upload = async (collection: 'images' | 'private') => {
  const data = await photo()
  const doc = await payload.create({
    collection,
    data: {},
    file: { data, mimetype: 'image/jpeg', name: 'beach.jpg', size: data.length },
  })
  return payload.update({
    collection,
    id: doc.id,
    data: { crop: { x: 20, y: 10, width: 70, height: 80 } },
  })
}

describe('cropped copies with a custom collection slug and API route', () => {
  it('renders the crop URL next to the file route and serves the copy there', async () => {
    const media = await upload('images')
    expect(media.url).toMatch(/^\/cms-api\/images\/file\//)

    const { resource } = frameImage({ media, secret })
    expect(resource.url).toMatch(/^\/cms-api\/images\/crop\/\d+\/[\w.-]+\/beach\.jpg$/)

    const response = await request(resource.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    const served = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    expect([served.width, served.height]).toEqual([1050, 800])
  })

  it('rebuilds the image sizes from the crop with the config’s sharp', async () => {
    const media = await upload('images')

    // 70 % x 80 % of 1500 x 1000 is 1050 x 800; at 400 px wide that is 305 px high.
    expect(media.sizes?.thumbnail).toMatchObject({ width: 400, height: 305 })
  })

  it('serves nothing for a URL the server did not sign', async () => {
    const media = await upload('images')
    const { resource } = frameImage({ media, secret: 'another-secret' })

    expect((await request(resource.url)).status).toBe(404)
  })

  it('respects the collection’s read access', async () => {
    const media = await upload('private')
    const { resource } = frameImage({ media, secret })

    expect(resource.url).toMatch(/^\/cms-api\/private\/crop\//)
    expect((await request(resource.url)).status).toBe(404)

    const user = { email: 'editor@example.com', password: 'secret-password' }
    await payload.create({ collection: 'users', data: user })
    const { token } = await payload.login({ collection: 'users', data: user })
    expect((await request(resource.url, token)).status).toBe(200)
  })
})
