// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  FULL_RECT,
  type Rect,
  previewPlacement,
  relativeRect,
} from '@wolffc80/payload-image-framing/core'
import { previewImage } from '../../src/payload/admin/previewImage.js'

/**
 * The small previews next to a usage's status line load a generated size of
 * the photo instead of the original where one shows the right part, so a page
 * with many images stays fast.
 */

// A 3000 x 1000 panorama cropped to its right 90 %.
const image = { width: 3000, height: 1000 }
const mediaCrop: Rect = { x: 10, y: 0, width: 90, height: 100 }
const url = '/api/media/file/panorama.jpg'
// Width-only sizes are rebuilt from the crop area: 2700 x 1000 px, aspect 2.7.
const sizes = {
  thumbnail: { url: '/api/media/file/panorama-300.jpg', width: 300, height: 111 },
  small: { url: '/api/media/file/panorama-600.jpg', width: 600, height: 222 },
  square: { url: '/api/media/file/panorama-500x500.jpg', width: 500, height: 500 },
  missing: { url: null, width: null, height: null },
}
const inside: Rect = { x: 50, y: 0, width: 25, height: 100 }
const narrow: Rect = { x: 60, y: 0, width: 10, height: 100 }

describe('previewImage', () => {
  it('picks the smallest size of the crop area that is sharp enough', () => {
    // 80 px previews of a quarter of the photo need 80 * 90 / 25 = 288 px of the crop.
    expect(
      previewImage({ image, mediaCrop, sizes, url, previews: [{ visible: inside, width: 80 }] }),
    ).toEqual({
      region: mediaCrop,
      url: sizes.thumbnail.url,
    })
    // 100 px need 360 px: the thumbnail is too small.
    expect(
      previewImage({ image, mediaCrop, sizes, url, previews: [{ visible: inside, width: 100 }] }),
    ).toEqual({
      region: mediaCrop,
      url: sizes.small.url,
    })
  })

  it('sizes each preview by its own width', () => {
    // A 20 px preview of a tenth needs 20 * 90 / 10 = 180 px, an 80 px one of a quarter 288 px.
    expect(
      previewImage({
        image,
        mediaCrop,
        previews: [
          { visible: narrow, width: 20 },
          { visible: inside, width: 80 },
        ],
        sizes,
        url,
      }).url,
    ).toBe(sizes.thumbnail.url)
  })

  it('uses the original when no size is large enough', () => {
    expect(
      previewImage({ image, mediaCrop, sizes, url, previews: [{ visible: inside, width: 400 }] }),
    ).toEqual({
      region: FULL_RECT,
      url,
    })
  })

  it('uses the original when a preview shows more than the media crop', () => {
    const wider: Rect = { x: 0, y: 0, width: 50, height: 100 }
    expect(
      previewImage({
        image,
        mediaCrop,
        sizes,
        url,
        previews: [
          { visible: inside, width: 80 },
          { visible: wider, width: 80 },
        ],
      }),
    ).toEqual({ region: FULL_RECT, url })
  })

  it('ignores sizes of another shape, e.g. ones made before the crop changed', () => {
    const stale = { thumbnail: { url: '/old-300.jpg', width: 300, height: 100 } }
    expect(
      previewImage({
        image,
        mediaCrop,
        sizes: stale,
        url,
        previews: [{ visible: inside, width: 80 }],
      }),
    ).toEqual({ region: FULL_RECT, url })
  })

  it('uses the original without sizes or previews', () => {
    expect(
      previewImage({ image, mediaCrop, url, previews: [{ visible: inside, width: 80 }] }).url,
    ).toBe(url)
    expect(previewImage({ image, mediaCrop, sizes, url, previews: [] }).url).toBe(url)
  })

  it('places a size so the preview shows the same part as the original would', () => {
    const { region } = previewImage({
      image,
      mediaCrop,
      sizes,
      url,
      previews: [{ visible: inside, width: 80 }],
    })
    const fromSize = previewPlacement(relativeRect(inside, region))
    const fromOriginal = previewPlacement(inside)
    // The size covers 90 % of the original: it is drawn at 90 % of the original's width,
    // starting where the original's 10 % mark would be.
    expect(fromSize.width).toBeCloseTo(fromOriginal.width * 0.9, 1)
    expect(fromSize.left).toBeCloseTo(fromOriginal.left + fromOriginal.width * 0.1, 1)
    expect(fromSize.height).toBeCloseTo(fromOriginal.height, 1)
  })
})
