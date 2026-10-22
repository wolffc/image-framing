// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { FULL_RECT } from '../../src/core/index.js'
import { cropToken, frameImage, readCropToken } from '../../src/exports/server.js'

/**
 * What the site gets for a framed image (#316): the URL of a copy cropped to
 * the media's crop area (never the original, which still has the cut-off
 * parts), its size, and one `object-position` per breakpoint as CSS variables.
 * The raw rects stay on the server (#226).
 */

const secret = 'test-secret'

const media = {
  id: 7,
  alt: 'Beach',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  url: '/api/media/file/beach.jpg',
  width: 3000,
  height: 1000,
  focalX: 50,
  focalY: 50,
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const cropped = {
  ...media,
  crop: { x: 50, y: 0, width: 50, height: 100 },
  focusArea: { x: 60, y: 20, width: 10, height: 40 },
}

describe('frameImage', () => {
  it('keeps the original URL and size when the crop is the whole photo', () => {
    const { resource } = frameImage({ media, secret })

    expect(resource.url).toBe('/api/media/file/beach.jpg')
    expect(resource.width).toBe(3000)
    expect(resource.height).toBe(1000)
  })

  it('serves a cropped copy at the size of the crop', () => {
    const { resource } = frameImage({ media: cropped, secret })

    expect(resource.url).toMatch(/^\/api\/media\/crop\/7\/[\w.-]+\/beach\.jpg$/)
    expect(resource.width).toBe(1500)
    expect(resource.height).toBe(1000)
  })

  it('uses the configured route prefix', () => {
    const { resource } = frameImage({ media: cropped, routePrefix: '/img/crop', secret })

    expect(resource.url.startsWith('/img/crop/7/')).toBe(true)
  })

  it('changes the URL when the crop or the media changes', () => {
    const a = frameImage({ media: cropped, secret }).resource.url
    const b = frameImage({
      media: { ...cropped, crop: { x: 40, y: 0, width: 50, height: 100 } },
      secret,
    }).resource.url
    const c = frameImage({ media: { ...cropped, updatedAt: '2026-10-02T00:00:00.000Z' }, secret })
      .resource.url

    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('passes on no crop or focus rects', () => {
    const { resource } = frameImage({ media: cropped, secret })

    expect(Object.keys(resource).sort()).toEqual(
      ['alt', 'filename', 'height', 'mimeType', 'updatedAt', 'url', 'width'].sort(),
    )
  })

  it('sets one object-position per breakpoint', () => {
    const { style } = frameImage({
      frames: {
        base: { aspect: 4 / 5 },
        md: { aspect: 16 / 9, cover: [{ edge: 'left', size: 45 }] },
      },
      media,
      secret,
    })

    expect(Object.keys(style).sort()).toEqual(['--frame-pos', '--frame-pos-md'])
    expect(style['--frame-pos']).toMatch(/^\d+(\.\d+)?% \d+(\.\d+)?%$/)
  })

  it('repeats the base position on md when the layout declares only one frame', () => {
    const { style } = frameImage({ frames: { base: { aspect: 1 } }, media: cropped, secret })

    expect(style['--frame-pos-md']).toBe(style['--frame-pos'])
  })

  it('positions inside the cropped copy, towards the focus area', () => {
    // The 1500x1000 crop in a 1:1 frame slides sideways by 500px; the focus
    // area centred at 70% of the photo puts the frame 100px into that range.
    const { style } = frameImage({
      frames: { base: { aspect: 1 } },
      media: { ...cropped, focusArea: { x: 65, y: 20, width: 10, height: 40 } },
      secret,
    })

    expect(style['--frame-pos']).toBe('20% 50%')
  })

  it('leaves videos alone', () => {
    const video = { ...cropped, mimeType: 'video/mp4', url: '/api/media/file/clip.mp4' }

    expect(frameImage({ media: video, secret }).resource.url).toBe('/api/media/file/clip.mp4')
  })
})

// #316 part 2: a block's own crop and focus area.
describe('frameImage with an override', () => {
  it('serves the override crop at its size', () => {
    const { resource } = frameImage({
      media: cropped,
      override: { crop: { x: 60, y: 0, width: 20, height: 50 } },
      secret,
    })

    expect(resource.url).toMatch(/^\/api\/media\/crop\/7\/6000-0-2000-5000\.[\w-]+\/beach\.jpg$/)
    expect([resource.width, resource.height]).toEqual([600, 500])
  })

  // The media crop (50-100%) is only the default; a block may show more.
  it('serves an override crop wider than the media crop', () => {
    const { resource } = frameImage({
      media: cropped,
      override: { crop: { x: 0, y: 0, width: 75, height: 100 } },
      secret,
    })

    expect(resource.url).toMatch(/\/0-0-7500-10000\./)
    expect([resource.width, resource.height]).toEqual([2250, 1000])
  })

  it('serves the original for an override showing the whole photo', () => {
    const { resource } = frameImage({ media: cropped, override: { crop: FULL_RECT }, secret })

    expect(resource.url).toBe('/api/media/file/beach.jpg')
    expect([resource.width, resource.height]).toEqual([3000, 1000])
  })

  it('changes nothing with an empty override', () => {
    const empty = { crop: { x: null, y: null, width: null, height: null } }

    expect(frameImage({ media: cropped, override: empty, secret })).toEqual(
      frameImage({ media: cropped, secret }),
    )
  })

  it('positions around the override focus area', () => {
    const at = (x: number) =>
      frameImage({
        frames: { base: { aspect: 1 } },
        media,
        override: { focusArea: { x, y: 40, width: 10, height: 20 } },
        secret,
      }).style['--frame-pos']

    expect(at(0)).toBe('0% 50%')
    expect(at(90)).toBe('100% 50%')
  })
})

describe('crop tokens', () => {
  const rect = { x: 12.5, y: 0, width: 50, height: 100 }
  const updatedAt = '2026-10-01T00:00:00.000Z'

  it('reads back the rect it was made from', () => {
    const token = cropToken({ id: 7, rect, secret, updatedAt })

    expect(readCropToken(token, { id: 7, secret, updatedAt })).toEqual(rect)
  })

  it('rejects a token for another media item, another version or another secret', () => {
    const token = cropToken({ id: 7, rect, secret, updatedAt })

    expect(readCropToken(token, { id: 8, secret, updatedAt })).toBeNull()
    expect(
      readCropToken(token, { id: 7, secret, updatedAt: '2026-10-02T00:00:00.000Z' }),
    ).toBeNull()
    expect(readCropToken(token, { id: 7, secret: 'other', updatedAt })).toBeNull()
  })

  it('rejects a token whose rect was changed', () => {
    const token = cropToken({ id: 7, rect, secret, updatedAt })
    const tampered = token.replace(/^\d+/, '0')

    expect(readCropToken(tampered, { id: 7, secret, updatedAt })).toBeNull()
  })

  it('rejects garbage', () => {
    expect(readCropToken('../../etc/passwd', { id: 7, secret, updatedAt })).toBeNull()
    expect(readCropToken('', { id: 7, secret, updatedAt })).toBeNull()
  })
})
