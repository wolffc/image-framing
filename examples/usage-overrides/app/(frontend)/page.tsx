import config from '@payload-config'
import { type FramingOverride, matchFrames } from '@wolffc/payload-image-framing/core'
import { FramedImage } from '@wolffc/payload-image-framing/next'
import type { FrameableMedia } from '@wolffc/payload-image-framing/server'
import { getPayload } from 'payload'

import { ctaFrames, headerFrames } from '../../frames'

export const dynamic = 'force-dynamic'

const secret = process.env.PAYLOAD_SECRET!

/** An upload field's value, populated (depth 1), and its usage's own framing. */
type Usage = { image?: unknown; imageFraming?: FramingOverride } & Record<string, unknown>

const media = (usage: Usage) =>
  usage.image && typeof usage.image === 'object' ? (usage.image as FrameableMedia) : null

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'pages', depth: 1 })

  return (
    <main>
      {docs.map((page) => {
        const header = (page.header ?? {}) as Usage
        const headerImage = media(header)
        return (
          <section key={page.id}>
            {headerImage && (
              <div className={`header ${String(header.layout)}`}>
                {/* The same rules pick the frames as in the admin's preview. */}
                <FramedImage
                  frames={matchFrames(headerFrames, header)}
                  media={headerImage}
                  override={header.imageFraming}
                  priority
                  secret={secret}
                  sizes="100vw"
                />
                <h1>{String(header.heading ?? page.title)}</h1>
              </div>
            )}
            {((page.layout ?? []) as Usage[]).map((block, index) => {
              const image = media(block)
              return (
                <article key={index}>
                  <h2>{String(block.heading ?? '')}</h2>
                  {image && (
                    <FramedImage
                      frames={matchFrames(ctaFrames, block)}
                      media={image}
                      override={block.imageFraming}
                      secret={secret}
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  )}
                </article>
              )
            })}
          </section>
        )
      })}
    </main>
  )
}
