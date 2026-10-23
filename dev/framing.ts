import {
  type BreakpointName,
  defineFraming,
  type FrameRule,
} from '@wolffc80/payload-image-framing/core'

/**
 * The breakpoints and frames the dev app shows images in. Shared by the plugin
 * config (admin previews) and the frontend page (rendering), so both pick the
 * same frame.
 */
export const framing = defineFraming({
  breakpoints: {
    base: { label: { en: 'Phone', de: 'Smartphone' } },
    md: { minWidth: 768, label: { en: 'Tablet', de: 'Tablet' } },
    lg: { minWidth: 1280, label: { en: 'Desktop', de: 'Desktop' } },
  },
})

type Rules = FrameRule<BreakpointName<typeof framing>>[]

export const heroFrames: Rules = [
  {
    when: { layout: 'fullBleed' },
    frames: {
      base: { aspect: 4 / 5 },
      md: { aspect: 16 / 9, cover: [{ edge: 'left', size: 50 }] },
      lg: { aspect: 21 / 9, cover: [{ edge: 'left', size: 40 }] },
    },
  },
  // No lg frame: from 1280 px the md one applies.
  { when: { layout: 'split' }, frames: { base: { aspect: 4 / 3 }, md: { aspect: 1 } } },
]

export const cardFrames: Rules = [{ when: {}, frames: { base: { aspect: 3 / 2 } } }]
