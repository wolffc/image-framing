import {
  type BreakpointName,
  defineFraming,
  type FrameRule,
} from '@wolffc/payload-image-framing/core'

/** Phone, tablet and desktop: one definition for the admin previews and the page. */
export const framing = defineFraming({
  breakpoints: {
    base: { label: { en: 'Phone', de: 'Smartphone' } },
    md: { minWidth: 768, label: 'Tablet' },
    lg: { minWidth: 1280, label: 'Desktop' },
  },
})

/** Frames typed from the config: a frame for `xl` would be a type error. */
export const heroFrames: FrameRule<BreakpointName<typeof framing>>[] = [
  {
    when: {},
    frames: {
      base: { aspect: 4 / 5 },
      md: { aspect: 16 / 9 },
      lg: { aspect: 21 / 9, cover: [{ edge: 'left', size: 40 }] },
    },
  },
]
