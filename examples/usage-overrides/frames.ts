import type { FrameRule } from '@wolffc/payload-image-framing/core'

/**
 * Which frames each usage shows its photo in, by the values of the fields next
 * to the image. Shared by the plugin (admin previews) and the page (rendering).
 */
export const headerFrames: FrameRule[] = [
  {
    // Text over the photo: the left 45 % from md up is covered.
    when: { layout: 'wide' },
    frames: {
      base: { aspect: 4 / 5 },
      md: { aspect: 21 / 9, cover: [{ edge: 'left', size: 45 }] },
    },
  },
  { when: { layout: 'split' }, frames: { base: { aspect: 4 / 3 }, md: { aspect: 1 } } },
]

export const ctaFrames: FrameRule[] = [{ when: {}, frames: { base: { aspect: 3 / 2 } } }]
