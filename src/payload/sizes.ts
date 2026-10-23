import type { FileData, ImageSize, TypeWithID } from 'payload'

import { type Framing, visibleRect } from '../core/index.js'

import type { ResizeOptions, Sharp } from './sharp.js'
import type { FramingStorage } from './storage.js'

type SizeData = {
  filename?: string | null
  filesize?: number | null
  height?: number | null
  mimeType?: string | null
  width?: number | null
}
/** A document of a framed upload collection, as the hooks and storages see it. */
export type MediaDoc = TypeWithID &
  Partial<FileData> & { sizes?: Record<string, SizeData | undefined> | null; updatedAt?: string }

/**
 * The image to crop and resize: every frame of an animated GIF or WebP, so
 * the animation stays; a still image turned upright by its EXIF orientation.
 */
export const openImage = async (sharp: Sharp, data: Buffer) => {
  const { pages = 1 } = await sharp(data).metadata()
  if (pages > 1) return sharp(data, { animated: true })
  return sharp(data).rotate()
}

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

export interface RebuiltSizes {
  /** The size files to write, under the names Payload gave them. */
  files: { data: Buffer; filename: string; mimeType?: string }[]
  /** `doc.sizes` with the new dimensions and file sizes. */
  sizes: Record<string, SizeData>
}

/**
 * Rebuilds every generated size of a media document from its crop area, under
 * the file names Payload gave them. Sizes with a fixed shape (`square`, `og`)
 * show the part the framing algorithm picks around the focus area; sizes with
 * only a width are the whole crop area at that width. Returns the files to
 * write rather than writing them, so the caller can write them in order.
 */
export const rebuildSizes = async ({
  doc,
  framing,
  imageSizes,
  sharp,
  storage,
}: {
  doc: MediaDoc
  framing: Framing
  imageSizes: ImageSize[]
  sharp: Sharp
  storage: Pick<FramingStorage, 'readOriginal'>
}): Promise<RebuiltSizes | null> => {
  if (!doc.filename || !doc.width || !doc.height || !doc.sizes) return null

  const original = await storage.readOriginal(doc.filename)
  const crop = toPixels(framing.crop, doc.width, doc.height)
  const sizes: Record<string, SizeData> = { ...(doc.sizes as Record<string, SizeData>) }
  const files: RebuiltSizes['files'] = []

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

    const { data, info } = await (
      await openImage(sharp, original)
    )
      .extract(region)
      .resize(resize)
      .toBuffer({ resolveWithObject: true })
    files.push({
      data,
      filename: current.filename,
      mimeType: current.mimeType ?? doc.mimeType ?? undefined,
    })
    sizes[size.name] = { ...current, filesize: info.size, height: info.height, width: info.width }
  }

  return { files, sizes }
}
