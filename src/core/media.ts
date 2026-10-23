/**
 * Whether the plugin frames a file of this type: raster images. SVGs are
 * shown as they are (cropping would rasterise them), other files too. A
 * missing type counts as an image, as Payload's image fields have one.
 */
export const isFramable = (mimeType: string | null | undefined): boolean =>
  !mimeType || (mimeType.startsWith('image/') && !mimeType.startsWith('image/svg'))

/** The longest side of a cropped copy, in pixels; `next/image` and the like resize anyway. */
export const DEFAULT_MAX_SIZE = 4000

/** The pixel size of a cropped copy: the crop, scaled down to fit `maxSize` on its long side. */
export const croppedSize = (
  width: number,
  height: number,
  maxSize: number = DEFAULT_MAX_SIZE,
): { width: number; height: number } => {
  const scale = Math.min(1, maxSize / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
