// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  type BreakpointName,
  DEFAULT_FRAMING,
  defineFraming,
  type Frame,
  framedImageClasses,
  framePositionCss,
  type FrameRule,
  type Frames,
  frameVariable,
  resolveFrames,
} from '../../src/core/index.js'
import { frameImage } from '../../src/exports/server.js'
import { usagePreviewFrames } from '../../src/payload/admin/previewFrames.js'

/**
 * Configurable breakpoints: one definition for the admin previews and the
 * rendering, mobile first, a missing breakpoint using the next smaller one's
 * frame. Without a config everything stays as before: `base` and `md`.
 */

const three = defineFraming({
  breakpoints: {
    lg: { minWidth: 1280, label: 'Desktop' },
    base: { label: 'Phone' },
    md: { minWidth: 768, label: 'Tablet' },
  },
})
const baseOnly = defineFraming({ breakpoints: { base: { label: 'Everywhere' } } })

const square: Frame = { aspect: 1 }
const wide: Frame = { aspect: 21 / 9, cover: [{ edge: 'left', size: 45 }] }

const media = {
  id: 7,
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  url: '/api/media/file/beach.jpg',
  width: 3000,
  height: 1000,
  focalX: 50,
  focalY: 50,
  updatedAt: '2026-10-01T00:00:00.000Z',
  crop: { x: 10, y: 0, width: 80, height: 100 },
  focusArea: { x: 60, y: 30, width: 20, height: 40 },
}
const secret = 'test-secret'

describe('defineFraming', () => {
  it('orders the breakpoints mobile first', () => {
    expect(three.breakpoints).toEqual([
      { name: 'base', minWidth: 0, label: 'Phone' },
      { name: 'md', minWidth: 768, label: 'Tablet' },
      { name: 'lg', minWidth: 1280, label: 'Desktop' },
    ])
  })

  it('labels breakpoints without a label', () => {
    const framing = defineFraming({ breakpoints: { base: {}, xl: { minWidth: 1536 } } })

    expect(framing.breakpoints.map((b) => b.label)).toEqual(['Base', 'xl (from 1536 px)'])
  })

  it('rejects configs it cannot turn into CSS', () => {
    // @ts-expect-error base is required
    expect(() => defineFraming({ breakpoints: { md: { minWidth: 768 } } })).toThrow(/base/)
    expect(() => defineFraming({ breakpoints: { base: { minWidth: 320 } } })).toThrow(/base/)
    expect(() => defineFraming({ breakpoints: { base: {}, md: {} } })).toThrow(
      /"md" needs a minWidth/,
    )
    expect(() =>
      defineFraming({ breakpoints: { base: {}, md: { minWidth: 768 }, tab: { minWidth: 768 } } }),
    ).toThrow(/768/)
    expect(() => defineFraming({ breakpoints: { base: {}, 'md lg': { minWidth: 9 } } })).toThrow(
      /identifier/,
    )
  })

  it('defaults to base and md from 768 px', () => {
    expect(DEFAULT_FRAMING.breakpoints.map(({ minWidth, name }) => [name, minWidth])).toEqual([
      ['base', 0],
      ['md', 768],
    ])
  })
})

describe('resolveFrames', () => {
  it('falls back to the next smaller breakpoint, mobile first', () => {
    const resolved = resolveFrames(three, { base: square, lg: wide })

    expect(resolved.map((r) => [r.breakpoint.name, r.frame, r.fallbackFrom])).toEqual([
      ['base', square, undefined],
      ['md', square, 'base'],
      ['lg', wide, undefined],
    ])
  })

  it('names the breakpoint a fallback comes from, across several', () => {
    const resolved = resolveFrames(three, { base: square })

    expect(resolved.map((r) => r.fallbackFrom)).toEqual([undefined, 'base', 'base'])
  })
})

describe('CSS variables and helpers', () => {
  it('names the variables after the breakpoints', () => {
    expect(frameVariable('base')).toBe('--frame-pos')
    expect(frameVariable('lg')).toBe('--frame-pos-lg')
    expect(frameVariable('lg', '--pos')).toBe('--pos-lg')
  })

  it('writes plain CSS with media or container queries', () => {
    expect(framePositionCss(DEFAULT_FRAMING, '.framed')).toBe(
      '.framed{object-position:var(--frame-pos)} @media (min-width:768px){.framed{object-position:var(--frame-pos-md)}}',
    )
    expect(framePositionCss(three, 'img', { query: 'container', variable: '--pos' })).toBe(
      'img{object-position:var(--pos)} ' +
        '@container (min-width:768px){img{object-position:var(--pos-md)}} ' +
        '@container (min-width:1280px){img{object-position:var(--pos-lg)}}',
    )
    expect(framePositionCss(baseOnly, '.framed')).toBe('.framed{object-position:var(--frame-pos)}')
  })

  it('writes Tailwind classes for the configured widths', () => {
    expect(framedImageClasses(three)).toBe(
      'object-[var(--frame-pos)] min-[768px]:object-[var(--frame-pos-md)] min-[1280px]:object-[var(--frame-pos-lg)]',
    )
  })
})

describe('frameImage with breakpoints', () => {
  it('returns one variable per breakpoint', () => {
    const { style } = frameImage({
      framing: three,
      frames: { base: square, lg: wide },
      media,
      secret,
    })

    expect(Object.keys(style)).toEqual(['--frame-pos', '--frame-pos-md', '--frame-pos-lg'])
    expect(style['--frame-pos-md']).toBe(style['--frame-pos'])
    expect(style['--frame-pos-lg']).not.toBe(style['--frame-pos'])
  })

  it('returns a single variable with only base', () => {
    const { style } = frameImage({ framing: baseOnly, frames: { base: wide }, media, secret })

    expect(Object.keys(style)).toEqual(['--frame-pos'])
  })

  it('without a framing config, writes exactly what it wrote before breakpoints were configurable', () => {
    const framed = frameImage({ frames: { base: square, md: wide }, media, secret })

    // Output of frameImage before breakpoints were configurable (checked against
    // that version for 576 combinations of crop, focus, frames, size and override).
    expect(JSON.stringify(framed)).toBe(
      '{"focus":{"x":62.5,"y":30,"width":25,"height":40},' +
        '"resource":{"filename":"beach.jpg","height":1000,"mimeType":"image/jpeg","updatedAt":"2026-10-01T00:00:00.000Z",' +
        '"url":"/api/media/crop/7/1000-0-8000-10000.hWaK8xbP2akGzRGJW7yruE/beach.jpg","width":2400},' +
        '"style":{"--frame-pos":"92.9% 50%","--frame-pos-md":"100% 50%"}}',
    )
    expect(
      JSON.stringify(
        frameImage({ framing: DEFAULT_FRAMING, frames: { base: square, md: wide }, media, secret }),
      ),
    ).toBe(JSON.stringify(framed))
  })
})

describe('usage drawer previews', () => {
  const rules: FrameRule<'base' | 'md' | 'lg'>[] = [
    { when: { layout: 'split' }, frames: { base: square } },
    { when: {}, frames: { base: square, md: wide } },
  ]

  it('shows one labelled preview per breakpoint and marks fallbacks', () => {
    const previews = usagePreviewFrames(rules, { layout: 'wide' }, three.breakpoints)

    expect(
      previews.map(({ fallbackFrom, key, label, note }) => [key, label, fallbackFrom, note]),
    ).toEqual([
      ['base', 'Phone', undefined, undefined],
      ['md', 'Tablet', undefined, undefined],
      ['lg', 'Desktop', 'md', 'same as Tablet'],
    ])
  })

  it('shows one preview with only base', () => {
    expect(usagePreviewFrames(rules, {}, baseOnly.breakpoints).map((p) => p.label)).toEqual([
      'Everywhere',
    ])
  })

  it('keeps the previous labels without a framing config', () => {
    expect(usagePreviewFrames(rules, { layout: 'split' }).map((p) => [p.label, p.note])).toEqual([
      ['Phones', undefined],
      ['Desktop', 'same as Phones'],
    ])
  })
})

describe('types', () => {
  it('types the frames from the framing config', () => {
    type Names = BreakpointName<typeof three>
    expectTypeOf<Names>().toEqualTypeOf<'base' | 'md' | 'lg'>()

    const frames: Frames<Names> = { base: square, lg: wide }
    expectTypeOf(frames.lg).toEqualTypeOf<Frame | undefined>()
    // @ts-expect-error xl is not a breakpoint of this config
    const withXl: Frames<Names> = { base: square, xl: wide }
    // @ts-expect-error base is required
    const withoutBase: Frames<Names> = { md: square }
    expect([withXl, withoutBase]).toHaveLength(2)
  })

  it('checks frameImage frames against its framing', () => {
    const withXl = () =>
      frameImage({
        framing: three,
        // @ts-expect-error xl is not a breakpoint of `three`
        frames: { base: square, xl: wide },
        media,
        secret,
      })
    expect(withXl).not.toThrow()
    // Without a config, the default breakpoints: base and md.
    // @ts-expect-error lg is not a default breakpoint
    expect(() => frameImage({ frames: { base: square, lg: wide }, media, secret })).not.toThrow()
  })
})
