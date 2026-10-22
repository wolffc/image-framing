import { FULL_RECT, type Rect } from './rect.js'

/**
 * A part of the frame that text covers, as a band along one edge. `size` is
 * the share of the frame it takes, in percent of the frame's width (left and
 * right) or height (top and bottom).
 */
export interface CoverArea {
  edge: 'left' | 'right' | 'top' | 'bottom'
  size: number
}

/** A frame shape a layout shows a photo in: width / height, and what covers it. */
export interface Frame {
  aspect: number
  cover?: CoverArea[]
}

/** The frame a layout shows the photo in on phones (`base`) and from its `md` breakpoint up. */
export interface Frames {
  base: Frame
  md?: Frame
}

/**
 * Which frames a usage shows, by the values of its sibling fields, e.g. the
 * hero's layout: `{ when: { type: 'fullBleed', contentAlign: 'center' }, frames }`.
 * Plain data, so the admin can use the same rules as the site.
 */
export interface FrameRule {
  when: Record<string, string | readonly string[]>
  frames: Frames
}

/** The frames of the first rule whose fields all match `data`. */
export const matchFrames = (
  rules: readonly FrameRule[] | undefined,
  data: Record<string, unknown> | null | undefined,
): Frames | undefined =>
  data
    ? rules?.find((rule) =>
        Object.entries(rule.when).every(([field, expected]) =>
          typeof expected === 'string' ? data[field] === expected : expected.includes(data[field] as string),
        ),
      )?.frames
    : undefined

/**
 * Where to put the whole photo inside a preview box so the box shows exactly
 * `visible`, in percent of the box (for an absolutely positioned `<img>`).
 */
export const previewPlacement = (
  visible: Rect,
): { left: number; top: number; width: number; height: number } => ({
  left: -(visible.x / visible.width) * 100 || 0,
  top: -(visible.y / visible.height) * 100 || 0,
  width: (100 / visible.width) * 100,
  height: (100 / visible.height) * 100,
})

export interface VisibleRectInput {
  /** Pixel size of the original photo, for its aspect ratio. */
  image: { width: number; height: number }
  crop?: Rect
  focus?: Rect | null
  aspect: number
  cover?: CoverArea[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Covered share (0-1) at the start and end of one axis of the frame. */
const coverOn = (cover: CoverArea[] | undefined, start: CoverArea['edge'], end: CoverArea['edge']) => {
  const sum = (edge: CoverArea['edge']) =>
    (cover ?? []).filter((area) => area.edge === edge).reduce((total, area) => total + area.size, 0) /
    100
  const before = clamp(sum(start), 0, 1)
  const after = clamp(sum(end), 0, 1 - before)
  return { before, after }
}

/**
 * Where to put a window of `size` on an axis from `min` to `min + range`, so
 * that `focusStart..focusEnd` sits in the middle of the part of the window
 * that no cover band takes. Clamped so the window never leaves the range.
 */
const place = (
  min: number,
  range: number,
  size: number,
  focusStart: number,
  focusEnd: number,
  cover: { before: number; after: number },
) => {
  const free = 1 - cover.before - cover.after
  const freeCentre = cover.before + free / 2
  const start = (focusStart + focusEnd) / 2 - size * freeCentre
  return clamp(start, min, min + range - size)
}

/**
 * The part of the photo a frame shows, in percent of the original photo.
 *
 * It is the largest rect of the frame's shape inside the crop: the frame fills
 * the crop along one side and only slides along the other. There it centres the
 * focus area in the part of the frame no cover area takes, which keeps the whole
 * focus area in view when it fits, and it stops at the crop's edges.
 */
export const visibleRect = ({
  aspect,
  cover,
  crop = FULL_RECT,
  focus,
  image,
}: VisibleRectInput): Rect => {
  // In pixels, so the aspect ratios compare.
  const cx = (crop.x / 100) * image.width
  const cy = (crop.y / 100) * image.height
  const cw = (crop.width / 100) * image.width
  const ch = (crop.height / 100) * image.height
  const f = focus ?? crop
  const fx = (f.x / 100) * image.width
  const fy = (f.y / 100) * image.height
  const fw = (f.width / 100) * image.width
  const fh = (f.height / 100) * image.height

  let x = cx
  let y = cy
  let w = cw
  let h = ch
  if (cw / ch > aspect) {
    w = ch * aspect
    x = place(cx, cw, w, fx, fx + fw, coverOn(cover, 'left', 'right'))
  } else {
    h = cw / aspect
    y = place(cy, ch, h, fy, fy + fh, coverOn(cover, 'top', 'bottom'))
  }

  return {
    x: (x / image.width) * 100,
    y: (y / image.height) * 100,
    width: (w / image.width) * 100,
    height: (h / image.height) * 100,
  }
}

/**
 * The CSS `object-position` (in percent) that shows `visible` when the crop is
 * the image and the frame uses `object-fit: cover`. On an axis where the frame
 * does not slide, it is 50%.
 */
export const objectPosition = (crop: Rect, visible: Rect): { x: number; y: number } => {
  const axis = (start: number, size: number, cropStart: number, cropSize: number) => {
    const range = cropSize - size
    if (range <= 0.01) return 50
    return Math.round(clamp(((start - cropStart) / range) * 100, 0, 100) * 10) / 10
  }
  return {
    x: axis(visible.x, visible.width, crop.x, crop.width),
    y: axis(visible.y, visible.height, crop.y, crop.height),
  }
}
