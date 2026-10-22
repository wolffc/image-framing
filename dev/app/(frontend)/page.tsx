import type { CSSProperties } from 'react'

import config from '@payload-config'
import { type FrameRule, matchFrames } from '@wolffc/payload-image-framing/core'
import { type FrameableMedia, frameImage } from '@wolffc/payload-image-framing/next'
import { getPayload } from 'payload'

import { cardFrames, heroFrames } from '../../framing.js'

export const dynamic = 'force-dynamic'

const secret = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'

type Usage = {
  image?: FrameableMedia | number | null
  imageFraming?: Parameters<typeof frameImage>[0]['override']
} & Record<string, unknown>

/** A media doc rendered in the frames its rules pick, with a plain <img>. */
const Framed = ({ rules, usage }: { rules: FrameRule[]; usage: Usage }) => {
  if (!usage.image || typeof usage.image !== 'object') return null
  const frames = matchFrames(rules, usage)
  const { resource, style } = frameImage({
    frames,
    media: usage.image,
    override: usage.imageFraming,
    secret,
  })
  const aspect = {
    '--frame-aspect': String(frames?.base.aspect ?? 'auto'),
    '--frame-aspect-md': String((frames?.md ?? frames?.base)?.aspect ?? 'auto'),
  }
  return (
    <div className="frame" style={{ ...style, ...aspect } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> on purpose */}
      <img alt={resource.alt ?? ''} className="framed" src={resource.url} />
    </div>
  )
}

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'pages', depth: 1, limit: 20 })

  return (
    <main>
      <h1>Image framing dev app</h1>
      <p>
        Pages from the <a href="/admin/collections/pages">admin</a>, rendered with{' '}
        <code>frameImage()</code>. Resize the window to see the phone and desktop frames.
      </p>
      {docs.length === 0 && <p>No pages yet. Upload an image to Media and create a page.</p>}
      {docs.map((page) => (
        <section key={page.id} style={{ marginBottom: 48 }}>
          <h2>{page.title}</h2>
          <div style={{ position: 'relative' }}>
            <Framed rules={heroFrames} usage={page.hero as Usage} />
            {page.hero?.layout === 'fullBleed' && page.hero.heading && (
              <div className="cover">
                <h3 style={{ margin: 0 }}>{page.hero.heading}</h3>
              </div>
            )}
          </div>
          <div className="cards">
            {page.layout?.map((block) => (
              <article key={block.id}>
                <Framed rules={cardFrames} usage={block as Usage} />
                <h3>{block.heading}</h3>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
