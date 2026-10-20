// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  defaultFocusArea,
  type FrameRule,
  FULL_RECT,
  isRectInside,
  matchFrames,
  normalizeRect,
  objectPosition,
  previewPlacement,
  resolveFraming,
  visibleRect,
} from '../../src/plugins/imageFraming/core'

/**
 * The framing algorithm (#316): which part of a photo a frame of a given shape
 * shows. All rects are in percent of the original photo. The visible rect is
 * always the largest one of the frame's shape that fits inside the crop, so
 * only its position changes, and a layout can place it with `object-position`.
 */

// A 3:1 panorama, so a 16:9 frame slides sideways and a 4:5 frame even more.
const panorama = { width: 3000, height: 1000 }
// A 2:3 portrait, so a 16:9 frame slides up and down.
const portrait = { width: 1000, height: 1500 }

const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 1)

describe('visibleRect', () => {
  it('fills the crop along one side and keeps the frame shape', () => {
    const rect = visibleRect({ aspect: 16 / 9, crop: FULL_RECT, image: panorama })

    near(rect.height, 100)
    // 1000px * 16/9 = 1777.8px of 3000px
    near(rect.width, (1000 * (16 / 9) * 100) / 3000)
  })

  it('centres on the crop when there is no focus area', () => {
    const rect = visibleRect({ aspect: 16 / 9, crop: FULL_RECT, image: panorama })

    near(rect.x + rect.width / 2, 50)
  })

  it('moves left with a focus area on the left, but not past the crop edge', () => {
    const rect = visibleRect({
      aspect: 16 / 9,
      crop: FULL_RECT,
      focus: { x: 0, y: 30, width: 10, height: 40 },
      image: panorama,
    })

    near(rect.x, 0)
  })

  it('moves right with a focus area on the right, but not past the crop edge', () => {
    const rect = visibleRect({
      aspect: 16 / 9,
      crop: FULL_RECT,
      focus: { x: 90, y: 30, width: 10, height: 40 },
      image: panorama,
    })

    near(rect.x + rect.width, 100)
  })

  it('moves up and down with a focus area at the top or bottom', () => {
    const top = visibleRect({
      aspect: 16 / 9,
      crop: FULL_RECT,
      focus: { x: 40, y: 0, width: 20, height: 10 },
      image: portrait,
    })
    const bottom = visibleRect({
      aspect: 16 / 9,
      crop: FULL_RECT,
      focus: { x: 40, y: 90, width: 20, height: 10 },
      image: portrait,
    })

    near(top.y, 0)
    near(bottom.y + bottom.height, 100)
  })

  it('contains the whole focus area when it fits', () => {
    const focus = { x: 55, y: 20, width: 20, height: 60 }
    const rect = visibleRect({ aspect: 16 / 9, crop: FULL_RECT, focus, image: panorama })

    expect(isRectInside(focus, rect)).toBe(true)
  })

  it('centres on a focus area larger than the frame', () => {
    const focus = { x: 10, y: 0, width: 80, height: 100 }
    const rect = visibleRect({ aspect: 4 / 5, crop: FULL_RECT, focus, image: panorama })

    near(rect.x + rect.width / 2, 50)
    expect(rect.width).toBeLessThan(focus.width)
  })

  it('never leaves the crop', () => {
    const crop = { x: 20, y: 10, width: 50, height: 80 }
    const rect = visibleRect({
      aspect: 16 / 9,
      crop,
      focus: { x: 20, y: 10, width: 5, height: 5 },
      image: panorama,
    })

    expect(isRectInside(rect, crop)).toBe(true)
  })

  it('uses the full crop width when the crop is narrower than the frame', () => {
    // 600px x 1000px crop of the panorama, shown in a 21:9 frame.
    const crop = { x: 40, y: 0, width: 20, height: 100 }
    const rect = visibleRect({
      aspect: 21 / 9,
      crop,
      focus: { x: 45, y: 70, width: 10, height: 20 },
      image: panorama,
    })

    near(rect.x, 40)
    near(rect.width, 20)
    // 600px / (21/9) = 257px of 1000px tall, around the focus at 80%.
    near(rect.height, 25.7)
    near(rect.y + rect.height / 2, 80)
  })

  it('keeps the focus area clear of text covering the left of the frame', () => {
    const focus = { x: 55, y: 30, width: 10, height: 40 }
    const rect = visibleRect({
      aspect: 16 / 9,
      cover: [{ edge: 'left', size: 45 }],
      crop: FULL_RECT,
      focus,
      image: panorama,
    })

    // The focus area's left edge lies right of the covered 45% of the frame.
    expect(focus.x).toBeGreaterThanOrEqual(rect.x + rect.width * 0.45 - 0.01)
    expect(isRectInside(focus, rect)).toBe(true)
  })

  it('keeps the focus area clear of text covering the right of the frame', () => {
    const focus = { x: 35, y: 30, width: 10, height: 40 }
    const rect = visibleRect({
      aspect: 16 / 9,
      cover: [{ edge: 'right', size: 45 }],
      crop: FULL_RECT,
      focus,
      image: panorama,
    })

    expect(focus.x + focus.width).toBeLessThanOrEqual(rect.x + rect.width * 0.55 + 0.01)
    expect(isRectInside(focus, rect)).toBe(true)
  })

  it('keeps the focus area clear of text covering the bottom of the frame', () => {
    const focus = { x: 40, y: 50, width: 20, height: 10 }
    const rect = visibleRect({
      aspect: 16 / 9,
      cover: [{ edge: 'bottom', size: 40 }],
      crop: FULL_RECT,
      focus,
      image: portrait,
    })

    expect(focus.y + focus.height).toBeLessThanOrEqual(rect.y + rect.height * 0.6 + 0.01)
    expect(isRectInside(focus, rect)).toBe(true)
  })

  it('still stays inside the crop when the cover areas cannot be avoided', () => {
    const rect = visibleRect({
      aspect: 16 / 9,
      cover: [{ edge: 'left', size: 45 }],
      crop: FULL_RECT,
      focus: { x: 0, y: 30, width: 10, height: 40 },
      image: panorama,
    })

    near(rect.x, 0)
  })
})

describe('objectPosition', () => {
  it('is 0% at the crop start, 100% at its end and 50% when nothing slides', () => {
    expect(objectPosition(FULL_RECT, { x: 0, y: 0, width: 50, height: 100 })).toEqual({ x: 0, y: 50 })
    expect(objectPosition(FULL_RECT, { x: 50, y: 0, width: 50, height: 100 })).toEqual({
      x: 100,
      y: 50,
    })
    expect(objectPosition(FULL_RECT, { x: 0, y: 25, width: 100, height: 50 })).toEqual({
      x: 50,
      y: 50,
    })
  })

  it('is relative to the crop, not the original photo', () => {
    const crop = { x: 20, y: 0, width: 60, height: 100 }

    expect(objectPosition(crop, { x: 30, y: 0, width: 40, height: 100 }).x).toBeCloseTo(50)
  })
})

describe('rects', () => {
  it('centres the default focus area on the old focal point', () => {
    const focus = defaultFocusArea(30, 70)

    near(focus.x + focus.width / 2, 30)
    near(focus.y + focus.height / 2, 70)
  })

  it('keeps the default focus area inside the photo at its edges', () => {
    const focus = defaultFocusArea(0, 100)

    expect(isRectInside(focus, FULL_RECT)).toBe(true)
  })

  it('clamps a rect into the photo and rounds it to two decimals', () => {
    expect(normalizeRect({ x: -5, y: 10.123456, width: 120, height: 50 })).toEqual({
      x: 0,
      y: 10.12,
      width: 100,
      height: 50,
    })
  })

  it('rejects rects that do not lie inside another', () => {
    expect(isRectInside({ x: 10, y: 10, width: 50, height: 50 }, FULL_RECT)).toBe(true)
    expect(isRectInside({ x: 60, y: 10, width: 50, height: 50 }, FULL_RECT)).toBe(false)
  })
})

describe('resolveFraming', () => {
  it('falls back to the full photo and a focus area around the focal point', () => {
    expect(resolveFraming({ focalX: 30, focalY: 70 })).toEqual({
      crop: FULL_RECT,
      focus: defaultFocusArea(30, 70),
    })
  })

  it('uses the stored crop and focus area', () => {
    const crop = { x: 10, y: 0, width: 50, height: 100 }
    const focusArea = { x: 20, y: 20, width: 10, height: 10 }

    expect(resolveFraming({ crop, focusArea, focalX: 50, focalY: 50 })).toEqual({
      crop,
      focus: focusArea,
    })
  })

  it('ignores an incomplete crop and a focus area outside the crop', () => {
    const crop = { x: 50, y: 0, width: 50, height: 100 }
    const framing = resolveFraming({
      crop,
      focusArea: { x: 0, y: 0, width: 10, height: 10 },
      focalX: 75,
      focalY: 50,
    })

    expect(framing.crop).toEqual(crop)
    expect(isRectInside(framing.focus, crop)).toBe(true)
    expect(
      resolveFraming({ crop: { x: 1, y: null, width: null, height: null }, focalX: 50, focalY: 50 })
        .crop,
    ).toEqual(FULL_RECT)
  })
})

/**
 * Per-usage overrides (#316, part 2): a block has its own crop and focus area.
 * The media's crop is only the default: a block may show less of the photo, or
 * more, up to the whole photo, e.g. the full width when the media crop is half.
 */
describe('resolveFraming with an override', () => {
  const media = {
    crop: { x: 10, y: 0, width: 80, height: 100 },
    focusArea: { x: 40, y: 40, width: 20, height: 20 },
    focalX: 50,
    focalY: 50,
  }

  it('uses an override crop and focus area inside the media crop', () => {
    const crop = { x: 20, y: 10, width: 40, height: 60 }
    const focusArea = { x: 30, y: 30, width: 10, height: 10 }

    expect(resolveFraming(media, { crop, focusArea })).toEqual({ crop, focus: focusArea })
  })

  it('uses an override crop wider than the media crop, up to the whole photo', () => {
    const wider = { x: 0, y: 0, width: 50, height: 100 }

    expect(resolveFraming(media, { crop: wider }).crop).toEqual(wider)
    expect(resolveFraming(media, { crop: FULL_RECT }).crop).toEqual(FULL_RECT)
  })

  it('uses an override crop that lies outside the media crop', () => {
    const outside = { x: 92, y: 0, width: 8, height: 100 }

    expect(resolveFraming(media, { crop: outside }).crop).toEqual(outside)
  })

  it('ignores an override crop that leaves the photo', () => {
    const { crop } = resolveFraming(media, { crop: { x: 60, y: 0, width: 60, height: 100 } })

    expect(crop).toEqual(media.crop)
  })

  it('keeps the media focus area when a wider override crop contains it', () => {
    const { focus } = resolveFraming(media, { crop: FULL_RECT })

    expect(focus).toEqual(media.focusArea)
  })

  it('keeps the media focus area, inside the override crop, without an override focus area', () => {
    const framing = resolveFraming(media, { crop: { x: 50, y: 0, width: 40, height: 100 } })

    expect(isRectInside(framing.focus, framing.crop)).toBe(true)
    // The media focus area runs from 40% to 60%; clamped into a crop from 50%.
    near(framing.focus.x, 50)
  })

  it('ignores an override focus area outside the crop', () => {
    const framing = resolveFraming(media, {
      crop: { x: 50, y: 0, width: 40, height: 100 },
      focusArea: { x: 10, y: 10, width: 10, height: 10 },
    })

    expect(isRectInside(framing.focus, framing.crop)).toBe(true)
  })

  it('uses the media defaults for an empty override', () => {
    const empty = {
      crop: { x: null, y: null, width: null, height: null },
      focusArea: { x: null, y: null, width: null, height: null },
    }

    expect(resolveFraming(media, empty)).toEqual(resolveFraming(media))
    expect(resolveFraming(media, null)).toEqual(resolveFraming(media))
  })
})

describe('matchFrames', () => {
  const spec: FrameRule[] = [
    { when: { type: 'fullBleed', contentAlign: 'center' }, frames: { base: { aspect: 2 } } },
    { when: { type: 'fullBleed' }, frames: { base: { aspect: 3 } } },
    { when: { type: ['split', 'route'] }, frames: { base: { aspect: 4 } } },
  ]

  it('picks the first rule whose fields all match', () => {
    expect(matchFrames(spec, { type: 'fullBleed', contentAlign: 'center' })?.base.aspect).toBe(2)
    expect(matchFrames(spec, { type: 'fullBleed', contentAlign: 'start' })?.base.aspect).toBe(3)
  })

  it('matches one of several values', () => {
    expect(matchFrames(spec, { type: 'route' })?.base.aspect).toBe(4)
  })

  it('gives no frames when no rule matches', () => {
    expect(matchFrames(spec, { type: 'editorial' })).toBeUndefined()
    expect(matchFrames(spec, undefined)).toBeUndefined()
  })
})

describe('previewPlacement', () => {
  it('scales and shifts the photo so the box shows exactly the visible rect', () => {
    expect(previewPlacement({ x: 25, y: 0, width: 50, height: 100 })).toEqual({
      left: -50,
      top: 0,
      width: 200,
      height: 100,
    })
  })
})
