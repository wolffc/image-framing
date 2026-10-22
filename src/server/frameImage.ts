import {
  type Frame,
  type Frames,
  type FramingOverride,
  type FramingSource,
  isFullRect,
  objectPosition,
  type Rect,
  relativeRect,
  resolveFraming,
  visibleRect,
} from '../core/index.js'

import { cropToken } from './cropToken.js'

/** The media fields the framing reads, besides the crop and focus area. */
export interface FrameableMedia extends FramingSource {
  id: number | string
  alt?: string | null
  filename?: string | null
  height?: number | null
  mimeType?: string | null
  updatedAt?: string | null
  url?: string | null
  width?: number | null
}

/** What `next/image` gets: the media without its rects, pointing at the cropped copy. */
export interface FramedResource {
  alt?: string | null
  filename?: string | null
  height?: number | null
  mimeType?: string | null
  updatedAt?: string | null
  url: string
  width?: number | null
}

export interface FrameImageOptions {
  media: FrameableMedia
  /** Without frames the style is empty, e.g. for a photo shown in its own shape. */
  frames?: Frames
  /** The usage's own crop and focus area, e.g. a block's `imageFraming`. */
  override?: FramingOverride
  /** Signs the cropped-copy URLs; must be the plugin's `secret`. */
  secret: string
  /** Where the plugin serves cropped copies. */
  routePrefix?: string
  /** Prefix of the CSS variables; the md one gets `-md`. */
  variable?: string
}

export interface FramedImage {
  resource: FramedResource
  style: Record<string, string>
  /**
   * The focus area in percent of the served (cropped) image, for layouts that
   * draw around the subject, e.g. a mask with a clear zone. Missing for files
   * that aren't images or have no size. Derived on the server: keep it there or
   * pass on only values computed from it, never the media's rects.
   */
  focus?: Rect
}

export const DEFAULT_ROUTE_PREFIX = '/api/media/crop'
export const DEFAULT_VARIABLE = '--frame-pos'

/** The URL of the cropped copy of `media` for `rect`, without a host. */
export const cropUrl = (
  media: FrameableMedia,
  rect: Parameters<typeof cropToken>[0]['rect'],
  secret: string,
  routePrefix = DEFAULT_ROUTE_PREFIX,
): string =>
  `${routePrefix}/${media.id}/${cropToken({ id: media.id, rect, secret, updatedAt: media.updatedAt })}/${encodeURIComponent(media.filename ?? 'image')}`

/**
 * A media document framed for one layout: the URL of a copy cut to the crop
 * area (the original URL when the crop is the whole photo), its pixel size,
 * and the `object-position` of each frame as CSS variables. Only these derived
 * values reach the browser; the rects stay on the server.
 */
export const frameImage = ({
  frames,
  media,
  override,
  routePrefix = DEFAULT_ROUTE_PREFIX,
  secret,
  variable = DEFAULT_VARIABLE,
}: FrameImageOptions): FramedImage => {
  const { alt, filename, height, mimeType, updatedAt, url, width } = media
  const resource: FramedResource = {
    alt,
    filename,
    height,
    mimeType,
    updatedAt,
    url: url ?? '',
    width,
  }
  for (const key of Object.keys(resource) as (keyof FramedResource)[]) {
    if (resource[key] === undefined) delete resource[key]
  }

  const isImage = !mimeType || mimeType.startsWith('image/')
  if (!isImage || !width || !height) return { resource, style: {} }

  const { crop, focus } = resolveFraming(media, override)
  if (!isFullRect(crop) && url) {
    resource.url = cropUrl(media, crop, secret, routePrefix)
    resource.width = Math.round((crop.width / 100) * width)
    resource.height = Math.round((crop.height / 100) * height)
  }

  const style: Record<string, string> = {}
  if (frames) {
    const position = (frame: Frame) => {
      const visible = visibleRect({ ...frame, crop, focus, image: { width, height } })
      const { x, y } = objectPosition(crop, visible)
      return `${x}% ${y}%`
    }
    style[variable] = position(frames.base)
    style[`${variable}-md`] = frames.md ? position(frames.md) : style[variable]
  }

  return { focus: relativeRect(focus, crop), resource, style }
}
