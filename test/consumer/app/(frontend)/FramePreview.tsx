'use client'

import { FULL_RECT, visibleRect } from '@wolffc/payload-image-framing/core'

// The core entry in a client component, as a site's admin or frontend code would use it.
export function FramePreview() {
  const visible = visibleRect({
    aspect: 16 / 9,
    crop: FULL_RECT,
    image: { width: 3000, height: 1000 },
  })
  return <p data-visible-width>{visible.width.toFixed(1)}</p>
}
