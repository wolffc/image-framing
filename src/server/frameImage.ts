import {
  DEFAULT_FRAMING,
  DEFAULT_VARIABLE,
  type DefaultBreakpoint,
  type Frame,
  type Frames,
  frameVariable,
  type FramingConfig,
  croppedSize,
  DEFAULT_MAX_SIZE,
  isFramable,
  type FramingOverride,
  type FramingSource,
  isFullRect,
  objectPosition,
  type Rect,
  relativeRect,
  resolveFraming,
  resolveFrames,
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

/** Options of `frameImage`. */
export interface FrameImageOptions<K extends string = DefaultBreakpoint> {
  media: FrameableMedia
  /**
   * The frame per breakpoint. Without frames the style is empty, e.g. for a
   * photo shown in its own shape.
   */
  frames?: Frames<NoInfer<K>>
  /**
   * The breakpoints (`defineFraming`), the same as the plugin's `framing`
   * option. Default: `base` and `md` from 768 px.
   */
  framing?: FramingConfig<K>
  /** The usage's own crop and focus area: the `imageFraming` group next to its upload field. */
  override?: FramingOverride
  /** Signs the cropped-copy URLs: the plugin's `secret`, by default the Payload config's. */
  secret: string
  /**
   * Where the plugin serves cropped copies of this media, e.g.
   * `/api/images/crop`. By default it is derived from the media's `url`: the
   * crop route sits next to Payload's file route (`<api>/<collection>/file/…`),
   * so a custom collection slug, `routes.api` or `serverURL` need no option.
   * Needed when `url` points elsewhere, e.g. to a storage adapter's bucket.
   */
  routePrefix?: string
  /**
   * Origin (and optional path) to serve cropped copies from, e.g. a CDN in
   * front of Payload: `https://cdn.example.com`. Replaces the origin of the
   * derived URL; without it the URL keeps the media `url`'s origin, or none.
   */
  baseUrl?: string
  /**
   * The longest side of the cropped copies, as the plugin's `maxSize` option:
   * the reported `width`/`height` are scaled to it. Default: 4000.
   */
  maxSize?: number
  /**
   * Prefix of the CSS variables: `base` writes `--frame-pos`, every other
   * breakpoint `--frame-pos-<name>`.
   */
  variable?: string
}

/** What `frameImage` returns: the image to show and how to place it. */
export interface FrameImageResult {
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

/** Payload's file route: `<origin><api>/<collection>/file/<filename>`, maybe with a query. */
const FILE_ROUTE = /^(.*)\/file\/[^/?#]+(?:[?#].*)?$/
const ORIGIN = /^[a-z][a-z\d+.-]*:\/\/[^/]+/i

/**
 * The route the plugin serves cropped copies of `media` from, derived from its
 * `url`: `/cms-api/images/file/beach.jpg` gives `/cms-api/images/crop`, an
 * absolute URL keeps its origin. Null when `url` isn't Payload's file route.
 */
export const cropRoutePrefix = (media: Pick<FrameableMedia, 'url'>): string | null => {
  const match = media.url ? FILE_ROUTE.exec(media.url) : null
  return match ? `${match[1]}/crop` : null
}

/** Options of `cropUrl`. */
export interface CropUrlOptions {
  /** See `FrameImageOptions.routePrefix`. */
  routePrefix?: string
  /** See `FrameImageOptions.baseUrl`. */
  baseUrl?: string
}

/** The URL of the cropped copy of `media` for `rect`. */
export const cropUrl = (
  media: FrameableMedia,
  rect: Parameters<typeof cropToken>[0]['rect'],
  secret: string,
  { baseUrl, routePrefix }: CropUrlOptions = {},
): string => {
  let prefix = routePrefix ?? cropRoutePrefix(media)
  if (!prefix) {
    throw new Error(
      `frameImage: can't tell where the cropped copies of media ${media.id} are served from its url ` +
        `(${JSON.stringify(media.url ?? null)}). Pass \`routePrefix\`, e.g. '/api/<collection>/crop'.`,
    )
  }
  if (baseUrl) prefix = baseUrl.replace(/\/+$/, '') + prefix.replace(ORIGIN, '')
  const token = cropToken({ id: media.id, rect, secret, updatedAt: media.updatedAt })
  return `${prefix}/${media.id}/${token}/${encodeURIComponent(media.filename ?? 'image')}`
}

/**
 * A media document framed for one layout: the URL of a copy cut to the crop
 * area (the original URL when the crop is the whole photo), its pixel size,
 * and the `object-position` of each frame as CSS variables. Only these derived
 * values reach the browser; the rects stay on the server.
 */
export const frameImage = <K extends string = DefaultBreakpoint>({
  frames,
  framing = DEFAULT_FRAMING as unknown as FramingConfig<K>,
  media,
  override,
  baseUrl,
  maxSize = DEFAULT_MAX_SIZE,
  routePrefix,
  secret,
  variable = DEFAULT_VARIABLE,
}: FrameImageOptions<K>): FrameImageResult => {
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

  // SVGs and other files are shown as they are.
  if (!isFramable(mimeType) || !width || !height) return { resource, style: {} }

  const { crop, focus } = resolveFraming(media, override)
  if (!isFullRect(crop) && url) {
    resource.url = cropUrl(media, crop, secret, { baseUrl, routePrefix })
    const size = croppedSize(
      Math.round((crop.width / 100) * width),
      Math.round((crop.height / 100) * height),
      maxSize,
    )
    resource.width = size.width
    resource.height = size.height
  }

  const style: Record<string, string> = {}
  if (frames) {
    const position = (frame: Frame) => {
      const visible = visibleRect({ ...frame, crop, focus, image: { width, height } })
      const { x, y } = objectPosition(crop, visible)
      return `${x}% ${y}%`
    }
    // One variable per breakpoint; one without a frame of its own repeats the next smaller one's.
    for (const { breakpoint, frame } of resolveFrames(framing, frames)) {
      style[frameVariable(breakpoint.name, variable)] = position(frame)
    }
  }

  return { focus: relativeRect(focus, crop), resource, style }
}
