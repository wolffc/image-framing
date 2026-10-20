import type { FileData, ImageSize, TypeWithID } from 'payload'
import sharp, { type ResizeOptions } from 'sharp'

import { type Framing, visibleRect } from '../core'

import type { FramingStorage } from './storage'

type SizeData = { filename?: string | null; filesize?: number | null; height?: number | null; width?: number | null }
export type MediaDoc = TypeWithID &
  Partial<FileData> & { sizes?: Record<string, SizeData | undefined> | null; updatedAt?: string }

/** Pixel rect of `rect` (percent) in an image of `width` x `height`. */
export const toPixels = (
  rect: Framing['crop'],
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } => {
  const left = Math.round((rect.x / 100) * width)
  const top = Math.round((rect.y / 100) * height)
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round((rect.width / 100) * width))),
    height: Math.max(1, Math.min(height - top, Math.round((rect.height / 100) * height))),
  }
}

/**
 * Rebuilds every generated size of a media document from its crop area, under
 * the file names Payload gave them. Sizes with a fixed shape (`square`, `og`)
 * show the part the framing algorithm picks around the focus area; sizes with
 * only a width are the whole crop area at that width.
 */
export const rebuildSizes = async ({
  doc,
  framing,
  imageSizes,
  storage,
}: {
  doc: MediaDoc
  framing: Framing
  imageSizes: ImageSize[]
  storage: FramingStorage
}): Promise<Record<string, SizeData> | null> => {
  if (!doc.filename || !doc.width || !doc.height || !doc.sizes) return null

  const original = await storage.readOriginal(doc.filename)
  const crop = toPixels(framing.crop, doc.width, doc.height)
  const sizes: Record<string, SizeData> = { ...(doc.sizes as Record<string, SizeData>) }

  for (const size of imageSizes) {
    const current = sizes[size.name]
    if (!current?.filename) continue

    let region = crop
    let resize: ResizeOptions
    if (size.width && size.height) {
      const visible = visibleRect({
        aspect: size.width / size.height,
        crop: framing.crop,
        focus: framing.focus,
        image: { width: doc.width, height: doc.height },
      })
      region = toPixels(visible, doc.width, doc.height)
      resize = { width: size.width, height: size.height, fit: 'cover' }
    } else if (size.width) {
      resize = { width: size.width }
    } else if (size.height) {
      resize = { height: size.height }
    } else {
      continue
    }

    const { data, info } = await sharp(original)
      .rotate()
      .extract(region)
      .resize(resize)
      .toBuffer({ resolveWithObject: true })
    await storage.writeSize(current.filename, data)
    sizes[size.name] = { ...current, filesize: info.size, height: info.height, width: info.width }
  }

  return sizes
}
