import {
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeValidateHook,
  type ImageSize,
  ValidationError,
} from 'payload'

import {
  FULL_RECT,
  isCompleteRect,
  isRectInside,
  normalizeRect,
  type Rect,
  rectCentre,
  resolveFraming,
  type StoredRect,
} from '../core/index.js'

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
  ({ data, originalDoc }) => {
    if (!data) return data
    const incomingCrop = data.crop === undefined ? originalDoc?.crop : data.crop
    const incomingFocus = data.focusArea === undefined ? originalDoc?.focusArea : data.focusArea

    const crop = asRect(incomingCrop) ?? FULL_RECT
    if (!isRectInside(crop, FULL_RECT) || crop.width <= 0 || crop.height <= 0) {
      throw new ValidationError({
        collection,
        errors: [{ message: 'The crop area must lie inside the photo.', path: 'crop' }],
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
 */
export const rebuildSizesAfterChange =
  ({
    imageSizes,
    storage,
  }: {
    imageSizes: ImageSize[]
    storage: (doc: MediaDoc) => FramingStorage
  }): CollectionAfterChangeHook =>
  async ({ collection, doc, previousDoc, req }) => {
    const changed =
      !previousDoc ||
      !sameRect(doc.crop, previousDoc.crop) ||
      !sameRect(doc.focusArea, previousDoc.focusArea) ||
      doc.filename !== previousDoc.filename ||
      JSON.stringify(doc.sizes) !== JSON.stringify(previousDoc.sizes)
    if (!changed || !doc.mimeType?.startsWith('image/')) return doc

    const files = storage(doc)
    await files.clearCached(`${doc.id}-`)
    const sizes = await rebuildSizes({
      doc,
      framing: resolveFraming(doc),
      imageSizes,
      storage: files,
    })
    if (!sizes) return doc

    // Same version, only rebuilt files: keep `updatedAt`, which the cropped-copy
    // URLs are signed with. The adapter would set a new one otherwise.
    await req.payload.db.updateOne({
      collection: collection.slug,
      data: { sizes, updatedAt: doc.updatedAt },
      id: doc.id,
      req,
    })
    return { ...doc, sizes }
  }

export const clearCacheAfterDelete =
  (storage: (doc: MediaDoc) => FramingStorage): CollectionAfterDeleteHook =>
  async ({ doc }) => {
    await storage(doc).clearCached(`${doc.id}-`)
  }
