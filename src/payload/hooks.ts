import {
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeValidateHook,
  type ImageSize,
  type PayloadRequest,
  ValidationError,
} from 'payload'

import {
  FULL_RECT,
  isFramable,
  isCompleteRect,
  isRectInside,
  normalizeRect,
  type Rect,
  rectCentre,
  resolveFraming,
  type StoredRect,
} from '../core/index.js'

import { translate } from './i18n.js'
import { getSharp } from './sharp.js'
import { type MediaDoc, rebuildSizes } from './sizes.js'
import type { FramingStorage } from './storage.js'

const asRect = (rect: StoredRect): Rect | null =>
  isCompleteRect(rect) ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null

const sameRect = (a: StoredRect, b: StoredRect) =>
  ['x', 'y', 'width', 'height'].every(
    (key) => (a?.[key as keyof Rect] ?? null) === (b?.[key as keyof Rect] ?? null),
  )

/**
 * Checks the rects and fills them in: a crop must lie inside the photo, and a
 * focus area is clamped into the crop. A document without a crop gets the
 * whole photo, without a focus area one around its focal point. The focal
 * point then follows the centre of the focus area, so anything that still
 * reads `focalX`/`focalY` frames around the same subject.
 */
export const validateFraming =
  (collection: string): CollectionBeforeValidateHook =>
  ({ data, originalDoc, req }) => {
    if (!data) return data
    const incomingCrop = data.crop === undefined ? originalDoc?.crop : data.crop
    const incomingFocus = data.focusArea === undefined ? originalDoc?.focusArea : data.focusArea

    const crop = asRect(incomingCrop) ?? FULL_RECT
    if (!isRectInside(crop, FULL_RECT) || crop.width <= 0 || crop.height <= 0) {
      throw new ValidationError({
        collection,
        errors: [{ message: translate(req, 'cropOutside'), path: 'crop' }],
      })
    }

    const focalChanged =
      originalDoc &&
      ((data.focalX !== undefined && data.focalX !== originalDoc.focalX) ||
        (data.focalY !== undefined && data.focalY !== originalDoc.focalY)) &&
      sameRect(incomingFocus, originalDoc.focusArea)
    const { focus } = resolveFraming({
      crop,
      // A focal point set through the API without a focus area moves the focus area.
      focusArea: focalChanged ? null : incomingFocus,
      focalX: data.focalX ?? originalDoc?.focalX,
      focalY: data.focalY ?? originalDoc?.focalY,
    })
    const focusArea = normalizeRect(focus, crop)
    const centre = rectCentre(focusArea)

    return {
      ...data,
      crop: normalizeRect(crop),
      focusArea,
      focalX: Math.round(centre.x * 100) / 100,
      focalY: Math.round(centre.y * 100) / 100,
    }
  }

/**
 * Rebuilds the generated sizes from the crop area after a change to the crop,
 * the focus area or the file, and drops the cropped copies of the old version.
 * `imageSizes` are the sizes to rebuild; with none it only drops the copies.
 */
/**
 * Two quick saves of one document rebuild its sizes in parallel, and the older
 * one may finish last. Writes therefore run one document at a time in save
 * order, and a rebuild whose save has been overtaken writes nothing. This
 * holds within one server process.
 */
let lastTicket = 0
const latestTicket = new Map<string, number>()
const writeQueue = new Map<string, Promise<unknown>>()

const inSaveOrder = async <T>(key: string, write: (isLatest: () => boolean) => Promise<T>) => {
  const ticket = ++lastTicket
  latestTicket.set(key, ticket)
  const isLatest = () => latestTicket.get(key) === ticket
  return {
    /** Runs `write` after the writes of earlier saves of the same document. */
    run: async (): Promise<T> => {
      const previous = writeQueue.get(key) ?? Promise.resolve()
      const current = previous.then(() => write(isLatest))
      const settled = current.catch(() => undefined)
      writeQueue.set(key, settled)
      try {
        return await current
      } finally {
        if (writeQueue.get(key) === settled) writeQueue.delete(key)
        if (isLatest()) latestTicket.delete(key)
      }
    },
  }
}

export const rebuildSizesAfterChange =
  ({
    imageSizes,
    storage,
  }: {
    imageSizes: ImageSize[]
    storage: (doc: MediaDoc, req: PayloadRequest) => FramingStorage
  }): CollectionAfterChangeHook =>
  async ({ collection, context, doc, previousDoc, req }) => {
    const changed =
      // `payload.update({ …, context: { imageFraming: { rebuild: true } } })` forces it,
      // e.g. to regenerate the sizes of existing media once.
      (context?.imageFraming as { rebuild?: boolean } | undefined)?.rebuild === true ||
      !previousDoc ||
      !sameRect(doc.crop, previousDoc.crop) ||
      !sameRect(doc.focusArea, previousDoc.focusArea) ||
      doc.filename !== previousDoc.filename ||
      JSON.stringify(doc.sizes) !== JSON.stringify(previousDoc.sizes)
    // SVGs and other files keep the sizes Payload made, if any.
    if (!changed || !doc.mimeType || !isFramable(doc.mimeType)) return doc

    const files = storage(doc, req)
    await files.clearCached(`${doc.id}-`)
    if (!imageSizes.length) return doc
    const { writeSize } = files
    if (!writeSize) {
      req.payload.logger.warn(
        `imageFraming: the storage of "${collection.slug}" can't write files, so its image sizes ` +
          'stay made from the whole photo. Use a storage with writeSize (e.g. s3FramingStorage) ' +
          'or rebuildSizes: false.',
      )
      return doc
    }
    // The ticket is taken now, in save order, before the slow part.
    const order = await inSaveOrder(`${collection.slug}:${doc.id}`, async (isLatest) => {
      // A newer save rebuilds the sizes from its own crop: don't overwrite them.
      if (!isLatest() || !rebuilt) return doc
      for (const file of rebuilt.files) await writeSize(file.filename, file.data, file.mimeType)
      // Same version, only rebuilt files: keep `updatedAt`, which the cropped-copy
      // URLs are signed with. The adapter would set a new one otherwise, and some
      // Payload versions (3.39) do so anyway: return what was stored, so URLs
      // signed from the returned document match the database.
      const stored = (await req.payload.db.updateOne({
        collection: collection.slug,
        data: { sizes: rebuilt.sizes, updatedAt: doc.updatedAt },
        id: doc.id,
        req,
      })) as { updatedAt?: string } | null
      return { ...doc, sizes: rebuilt.sizes, updatedAt: stored?.updatedAt ?? doc.updatedAt }
    })
    const rebuilt = await rebuildSizes({
      doc,
      framing: resolveFraming(doc),
      imageSizes,
      sharp: getSharp(req.payload),
      storage: files,
    })
    return order.run()
  }

export const clearCacheAfterDelete =
  (storage: (doc: MediaDoc, req: PayloadRequest) => FramingStorage): CollectionAfterDeleteHook =>
  async ({ doc, req }) => {
    await storage(doc, req).clearCached(`${doc.id}-`)
  }
