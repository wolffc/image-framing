// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { cropToken, readCropToken } from '../../src/plugins/imageFraming/core'
import { frameImage } from '../../src/plugins/imageFraming/next'

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
      frames: { base: { aspect: 4 / 5 }, md: { aspect: 16 / 9, cover: [{ edge: 'left', size: 45 }] } },
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
    expect(readCropToken(token, { id: 7, secret, updatedAt: '2026-10-02T00:00:00.000Z' })).toBeNull()
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
