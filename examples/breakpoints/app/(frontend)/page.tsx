import config from '@payload-config'
import {
  frameAspectCss,
  frameAspectVariables,
  framePositionCss,
  type FramingOverride,
  matchFrames,
} from '@wolffc80/payload-image-framing/core'
import { type FrameableMedia, frameImage } from '@wolffc80/payload-image-framing/server'
import { getPayload } from 'payload'
import type { CSSProperties } from 'react'

import { framing, heroFrames } from '../../framing.config'

export const dynamic = 'force-dynamic'

// The positions and shapes per breakpoint, as plain CSS: no Tailwind needed.
const css = framePositionCss(framing, '.hero img') + ' ' + frameAspectCss(framing, '.hero')

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'pages', depth: 1 })

  return (
    <main>
      <style>{css}</style>
      {docs.map((page) => {
        if (!page.hero || typeof page.hero !== 'object') return null
        const frames = matchFrames(heroFrames, page)!
        const { resource, style } = frameImage({
          framing,
          frames,
          media: page.hero as FrameableMedia,
          override: page.imageFraming as FramingOverride,
          secret: process.env.PAYLOAD_SECRET!,
        })
        return (
          <section key={page.id}>
            <h1>{String(page.title)}</h1>
            {/* --frame-pos, --frame-pos-md, --frame-pos-lg and the shapes, per image. */}
            <div
              className="hero"
              style={{ ...style, ...frameAspectVariables(framing, frames) } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> on purpose */}
              <img alt={resource.alt ?? ''} src={resource.url} />
            </div>
          </section>
        )
      })}
    </main>
  )
}
