import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import { DEFAULT_MAX_SIZE, isFramable } from '../core/index.js'
import { readCropToken } from '../server/cropToken.js'

import { getSharp } from './sharp.js'
import { type MediaDoc, openImage, toPixels } from './sizes.js'
import type { FramingStorage } from './storage.js'

/** Where the crop endpoint sits under a collection's API route; `frameImage` assumes it. */
export const DEFAULT_ENDPOINT_PATH = '/crop'

/** Cropped copies never change under their URL, which names the media version. */
export const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const notFound = () => new Response('Not found', { status: 404 })

/**
 * Serves a copy of a media item cut to a signed crop rect, e.g.
 * `<api>/<collection>/crop/7/5000-0-5000-10000.<sig>/beach.jpg`. Any rect inside the
 * photo is allowed, since a usage's own crop may be wider than the media's,
 * but only with the server's signature, so only crops the site renders can be
 * requested. Copies are cached; the URL changes with every new version of the
 * media, so they can be cached forever downstream too.
 */
export const cropEndpoint = ({
  cacheControl = DEFAULT_CACHE_CONTROL,
  collection,
  maxSize = DEFAULT_MAX_SIZE,
  path = DEFAULT_ENDPOINT_PATH,
  secret,
  storage,
}: {
  cacheControl?: string
  collection: CollectionSlug
  maxSize?: number
  path?: string
  secret: string
  storage: (doc: MediaDoc, req: PayloadRequest) => FramingStorage
}): Endpoint => ({
  path: `/${path.replace(/^\/+|\/+$/g, '')}/:id/:token/:filename`,
  method: 'get',
  handler: async (req) => {
    const { id, token } = (req.routeParams ?? {}) as Record<string, string | undefined>
    if (!id || !token || !/^\d+$|^[\w-]+$/.test(id)) return notFound()

    const doc = (await req.payload
      .findByID({ collection, id, depth: 0, overrideAccess: false, req })
      .catch(() => null)) as MediaDoc | null
    // SVGs and other files have no cropped copies.
    if (!doc?.filename || !doc.width || !doc.height || !doc.mimeType || !isFramable(doc.mimeType)) {
      return notFound()
    }

    const rect = readCropToken(token, { id: doc.id, secret, updatedAt: doc.updatedAt })
    if (!rect) return notFound()

    const headers = {
      'Cache-Control': cacheControl,
      'Content-Type': doc.mimeType,
    }
    const files = storage(doc, req)
    const extension = doc.filename.includes('.')
      ? doc.filename.slice(doc.filename.lastIndexOf('.'))
      : ''
    const key = `${doc.id}-${token}-${maxSize}${extension}`

    const cached = await files.readCached(key)
    if (cached) {
      return new Response(new Uint8Array(cached), {
        headers: { ...headers, 'X-Image-Framing-Cache': 'hit' },
      })
    }

    const original = await files.readOriginal(doc.filename).catch(() => null)
    if (!original) return notFound()
    const cropped = await (
      await openImage(getSharp(req.payload), original)
    )
      .extract(toPixels(rect, doc.width, doc.height))
      // Large originals: no bigger than maxSize on the long side.
      .resize({ fit: 'inside', height: maxSize, width: maxSize, withoutEnlargement: true })
      .toBuffer()
    await files.writeCached(key, cropped)

    return new Response(new Uint8Array(cropped), {
      headers: { ...headers, 'X-Image-Framing-Cache': 'miss' },
    })
  },
})
