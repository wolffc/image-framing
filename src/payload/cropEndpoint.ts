import type { CollectionSlug, Endpoint } from 'payload'
import sharp from 'sharp'

import { readCropToken } from '../core/index.js'

import { type MediaDoc, toPixels } from './sizes.js'
import type { FramingStorage } from './storage.js'

export const CROP_ENDPOINT_PATH = '/crop/:id/:token/:filename'

const notFound = () => new Response('Not found', { status: 404 })

/**
 * Serves a copy of a media item cut to a signed crop rect, e.g.
 * `/api/media/crop/7/5000-0-5000-10000.<sig>/beach.jpg`. Any rect inside the
 * photo is allowed, since a block's own crop may be wider than the media's,
 * but only with the server's signature, so only crops the site renders can be
 * requested. Copies are cached; the URL changes with every new version of the
 * media, so they can be cached forever downstream too.
 */
export const cropEndpoint = ({
  collection,
  secret,
  storage,
}: {
  collection: CollectionSlug
  secret: string
  storage: (doc: MediaDoc) => FramingStorage
}): Endpoint => ({
  path: CROP_ENDPOINT_PATH,
  method: 'get',
  handler: async (req) => {
    const { id, token } = (req.routeParams ?? {}) as Record<string, string | undefined>
    if (!id || !token || !/^\d+$|^[\w-]+$/.test(id)) return notFound()

    const doc = (await req.payload
      .findByID({ collection, id, depth: 0, overrideAccess: false, req })
      .catch(() => null)) as MediaDoc | null
    if (!doc?.filename || !doc.width || !doc.height || !doc.mimeType?.startsWith('image/')) {
      return notFound()
    }

    const rect = readCropToken(token, { id: doc.id, secret, updatedAt: doc.updatedAt })
    if (!rect) return notFound()

    const headers = {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': doc.mimeType,
    }
    const files = storage(doc)
    const extension = doc.filename.includes('.') ? doc.filename.slice(doc.filename.lastIndexOf('.')) : ''
    const key = `${doc.id}-${token}${extension}`

    const cached = await files.readCached(key)
    if (cached) {
      return new Response(new Uint8Array(cached), {
        headers: { ...headers, 'X-Image-Framing-Cache': 'hit' },
      })
    }

    const original = await files.readOriginal(doc.filename).catch(() => null)
    if (!original) return notFound()
    const cropped = await sharp(original)
      .rotate()
      .extract(toPixels(rect, doc.width, doc.height))
      .toBuffer()
    await files.writeCached(key, cropped)

    return new Response(new Uint8Array(cropped), {
      headers: { ...headers, 'X-Image-Framing-Cache': 'miss' },
    })
  },
})
