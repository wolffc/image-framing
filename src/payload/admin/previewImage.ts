'use client'

import { FULL_RECT, isRectInside, type Rect } from '../../core/index.js'

/** One generated size of a media document, as the REST API returns it. */
export interface PreviewSize {
  url?: string | null
  width?: number | null
  height?: number | null
}

/** The file a preview loads, and the part of the original photo it shows. */
export interface PreviewImage {
  url: string
  /** The part of the original the file shows, in percent: all of it, or the media's crop area. */
  region: Rect
}

/** How far a size's aspect ratio may differ from its region's and still count as that region. */
const ASPECT_TOLERANCE = 0.02

/**
 * The smallest file that is sharp enough for `previews`: a generated size of
 * the media when they all stay inside the media's crop area, else the original.
 *
 * The plugin rebuilds sizes with only a width from the media's crop area, so
 * such a size shows exactly `mediaCrop`. Sizes of another shape (a square, a
 * social image), sizes made before the crop changed and previews of a usage
 * crop wider than the media's would not match, so they fall back to the original.
 */
export const previewImage = ({
  image,
  mediaCrop,
  sizes,
  previews,
  url,
}: {
  /** Pixel size of the original. */
  image: { width: number; height: number }
  mediaCrop: Rect
  sizes?: Record<string, PreviewSize | null | undefined> | null
  /** Each preview: the part of the photo it shows (percent of the original) and its width in device pixels. */
  previews: { visible: Rect; width: number }[]
  /** The original's URL. */
  url: string
}): PreviewImage => {
  const original = { region: FULL_RECT, url }
  if (!previews.length || !previews.every(({ visible }) => isRectInside(visible, mediaCrop))) {
    return original
  }

  const cropAspect = (mediaCrop.width * image.width) / (mediaCrop.height * image.height)
  // The size's width at which every preview gets at least its own width in pixels.
  const needed = Math.max(
    ...previews.map(({ visible, width }) => width * (mediaCrop.width / visible.width)),
  )
  const candidates = Object.values(sizes ?? {})
    .filter(
      (size): size is { url: string; width: number; height: number } =>
        Boolean(size?.url && size.width && size.height) &&
        Math.abs(size!.width! / size!.height! / cropAspect - 1) <= ASPECT_TOLERANCE,
    )
    .filter((size) => size.width >= needed)
    .sort((a, b) => a.width - b.width)
  const [smallest] = candidates
  return smallest ? { region: mediaCrop, url: smallest.url } : original
}
