/**
 * A rectangle in percent of the original photo: `x` and `y` are its top-left
 * corner, all four values run from 0 to 100.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A rect as stored: every value may be missing. */
export type StoredRect = { [K in keyof Rect]?: number | null } | null | undefined

export const FULL_RECT: Rect = Object.freeze({ x: 0, y: 0, width: 100, height: 100 })

/** The smallest crop or focus area, so a rect never collapses to nothing. */
export const MIN_SIZE = 1

/** Default size of a focus area made from a focal point, in percent per side. */
export const DEFAULT_FOCUS_SIZE = 30

const round = (value: number) => Math.round(value * 100) / 100
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Whether all four values are set and finite. */
export const isCompleteRect = (rect: StoredRect): rect is Rect =>
  Boolean(rect) &&
  (['x', 'y', 'width', 'height'] as const).every(
    (key) => typeof rect![key] === 'number' && Number.isFinite(rect![key]),
  )

/** Whether `inner` lies inside `outer`, allowing for rounding. */
export const isRectInside = (inner: Rect, outer: Rect, tolerance = 0.01): boolean =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance

export const isFullRect = (rect: Rect): boolean =>
  rect.x <= 0 && rect.y <= 0 && rect.width >= 100 && rect.height >= 100

/** Clamps a rect into `within` (the whole photo by default), rounded to two decimals. */
export const normalizeRect = (rect: Rect, within: Rect = FULL_RECT): Rect => {
  const width = clamp(rect.width, Math.min(MIN_SIZE, within.width), within.width)
  const height = clamp(rect.height, Math.min(MIN_SIZE, within.height), within.height)
  const x = clamp(rect.x, within.x, within.x + within.width - width)
  const y = clamp(rect.y, within.y, within.y + within.height - height)
  return { x: round(x), y: round(y), width: round(width), height: round(height) }
}

export const rectCentre = (rect: Rect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})

/** A focus area of the default size centred on a focal point, inside `within`. */
export const defaultFocusArea = (
  focalX: number | null | undefined,
  focalY: number | null | undefined,
  within: Rect = FULL_RECT,
): Rect => {
  const x = focalX ?? 50
  const y = focalY ?? 50
  return normalizeRect(
    {
      x: x - DEFAULT_FOCUS_SIZE / 2,
      y: y - DEFAULT_FOCUS_SIZE / 2,
      width: DEFAULT_FOCUS_SIZE,
      height: DEFAULT_FOCUS_SIZE,
    },
    within,
  )
}

/** The fields of a media document the framing reads. */
export interface FramingSource {
  crop?: StoredRect
  focusArea?: StoredRect
  focalX?: number | null
  focalY?: number | null
}

export interface Framing {
  crop: Rect
  focus: Rect
}

/** A usage's own crop and focus area (e.g. one block's); missing values mean "as on the media". */
export type FramingOverride = { crop?: StoredRect; focusArea?: StoredRect } | null | undefined

const pick = (rect: Rect): Rect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
})

/**
 * The crop and focus area to use for a media document. A missing or invalid
 * crop is the whole photo; a missing focus area, or one outside the crop, is
 * the default focus area around the focal point, kept inside the crop.
 *
 * With an `override` (one usage's own framing), its crop replaces the media
 * crop, which is only the default: it may show less of the photo or more, up
 * to the whole photo. An override crop that leaves the photo is ignored. Its
 * focus area applies when it lies inside the crop; otherwise the media's focus
 * area does, kept inside the crop.
 */
export const resolveFraming = (source: FramingSource, override?: FramingOverride): Framing => {
  const mediaCrop =
    isCompleteRect(source.crop) && isRectInside(source.crop, FULL_RECT)
      ? pick(source.crop)
      : FULL_RECT
  const mediaFocus =
    isCompleteRect(source.focusArea) && isRectInside(source.focusArea, mediaCrop)
      ? pick(source.focusArea)
      : defaultFocusArea(source.focalX, source.focalY, mediaCrop)
  if (!override) return { crop: mediaCrop, focus: mediaFocus }

  const crop =
    isCompleteRect(override.crop) &&
    isRectInside(override.crop, FULL_RECT) &&
    override.crop.width >= MIN_SIZE &&
    override.crop.height >= MIN_SIZE
      ? pick(override.crop)
      : mediaCrop
  let focus: Rect
  if (isCompleteRect(override.focusArea) && isRectInside(override.focusArea, crop)) {
    focus = pick(override.focusArea)
  } else if (isRectInside(mediaFocus, crop)) {
    focus = mediaFocus
  } else {
    focus = normalizeRect(mediaFocus, crop)
  }
  return { crop, focus }
}

/**
 * `inner` in percent of `outer`, e.g. the focus area within the crop or within
 * a frame's visible rect. Not clamped: parts outside `outer` stay outside 0-100.
 */
export const relativeRect = (inner: Rect, outer: Rect): Rect => ({
  x: round(((inner.x - outer.x) / outer.width) * 100),
  y: round(((inner.y - outer.y) / outer.height) * 100),
  width: round((inner.width / outer.width) * 100),
  height: round((inner.height / outer.height) * 100),
})
