// @vitest-environment node
import {
  defineFraming,
  frameAspectCss,
  frameAspectVariables,
  framePositionCss,
} from '@wolffc/payload-image-framing/core'
import { FramedImage } from '@wolffc/payload-image-framing/next'
import { frameImage } from '@wolffc/payload-image-framing/server'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

/**
 * Rendering a framed image: with a plain <img> and the CSS helpers (any
 * framework), and with `<FramedImage>` around next/image.
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
  updatedAt: '2026-10-01T00:00:00.000Z',
  crop: { x: 10, y: 0, width: 80, height: 100 },
  focusArea: { x: 70, y: 30, width: 10, height: 40 },
}
const framing = defineFraming({ breakpoints: { base: {}, lg: { minWidth: 1280 } } })
const frames = { base: { aspect: 4 / 5 }, lg: { aspect: 21 / 9 } }

describe('the frame shape per breakpoint', () => {
  it('writes the aspect ratios as variables and the CSS that applies them', () => {
    expect(frameAspectVariables(framing, frames)).toEqual({
      '--frame-aspect': '0.8',
      '--frame-aspect-lg': '2.3333',
    })
    expect(frameAspectCss(framing, '.frame')).toBe(
      '.frame{aspect-ratio:var(--frame-aspect)} @media (min-width:1280px){.frame{aspect-ratio:var(--frame-aspect-lg)}}',
    )
  })
})

describe('a plain <img> (no Next)', () => {
  it('renders with the frame positions and the cropped copy', () => {
    const { resource, style } = frameImage({ framing, frames, media, secret })
    const html = renderToStaticMarkup(
      createElement(
        'div',
        { className: 'frame', style: { ...style, ...frameAspectVariables(framing, frames) } },
        createElement('style', null, framePositionCss(framing, '.frame img')),
        createElement('img', {
          alt: resource.alt,
          src: resource.url,
          style: { objectFit: 'cover' },
        }),
      ),
    )

    expect(html).toContain('src="/api/media/crop/7/')
    expect(html).toMatch(/--frame-pos:[\d.]+% [\d.]+%;--frame-pos-lg:/)
    expect(html).toContain(
      '@media (min-width:1280px){.frame img{object-position:var(--frame-pos-lg)}}',
    )
  })
})

describe('<FramedImage>', () => {
  const render = (props: Partial<Parameters<typeof FramedImage>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(FramedImage, { framing, frames, media, secret, ...props } as Parameters<
        typeof FramedImage
      >[0]),
    )

  it('fills a box of the frame shape with the cropped copy through next/image', () => {
    const html = render({ sizes: '50vw' })

    // next/image's loader, with the cropped copy as the source.
    expect(html).toContain(encodeURIComponent('/api/media/crop/7/'))
    expect(html).toContain('alt="Beach"')
    expect(html).toContain('sizes="50vw"')
    expect(html).toMatch(/--frame-pos:[\d.]+% [\d.]+%/)
    expect(html).toContain('--frame-aspect:0.8')
    expect(html).toContain('--frame-aspect-lg:2.3333')
  })

  it('shares one stylesheet per framing config between images', () => {
    const [first, second] = [render(), render({ media: { ...media, id: 8 } })]
    const className = (html: string) => /class="(framed-[a-z0-9]+)"/.exec(html)?.[1]

    expect(className(first)).toBeDefined()
    expect(className(first)).toBe(className(second))
    expect(first).toContain(`.${className(first)}-image{object-position:var(--frame-pos)}`)
    expect(first).toContain(`.${className(first)}{aspect-ratio:var(--frame-aspect)}`)
  })

  it('leaves the box size to the caller when not shaped', () => {
    const html = render({ shaped: false })

    expect(html).not.toContain('--frame-aspect')
    expect(html).not.toContain('aspect-ratio')
  })

  it('renders the photo in its own shape without frames', () => {
    const html = render({ frames: undefined })

    // 80 % of 3000 x 1000.
    expect(html).toContain('width="2400"')
    expect(html).toContain('height="1000"')
    expect(html).not.toContain('framed-')
  })
})
