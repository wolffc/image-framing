import type { FrameRule } from '@wolffc/payload-image-framing/core'

/**
 * The frames the dev app shows images in. Shared by the plugin config (admin
 * previews) and the frontend page (rendering), so both pick the same frame.
 */
export const heroFrames: FrameRule[] = [
  {
    when: { layout: 'fullBleed' },
    frames: { base: { aspect: 4 / 5 }, md: { aspect: 21 / 9, cover: [{ edge: 'left', size: 45 }] } },
  },
  { when: { layout: 'split' }, frames: { base: { aspect: 4 / 3 }, md: { aspect: 1 } } },
]

export const cardFrames: FrameRule[] = [{ when: {}, frames: { base: { aspect: 3 / 2 } } }]
