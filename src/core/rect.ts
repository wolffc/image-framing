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

/**
 * The crop and focus area to use for a media document. A missing or invalid
 * crop is the whole photo; a missing focus area, or one outside the crop, is
 * the default focus area around the focal point, kept inside the crop.
 */
export const resolveFraming = (source: FramingSource): Framing => {
  const crop =
    isCompleteRect(source.crop) && isRectInside(source.crop, FULL_RECT)
      ? { x: source.crop.x, y: source.crop.y, width: source.crop.width, height: source.crop.height }
      : FULL_RECT
  const focus =
    isCompleteRect(source.focusArea) && isRectInside(source.focusArea, crop)
      ? {
          x: source.focusArea.x,
          y: source.focusArea.y,
          width: source.focusArea.width,
          height: source.focusArea.height,
        }
      : defaultFocusArea(source.focalX, source.focalY, crop)
  return { crop, focus }
}
