import type { CSSProperties } from 'react'

import config from '@payload-config'
import {
  type BreakpointName,
  type FrameRule,
  framePositionCss,
  matchFrames,
  resolveFrames,
} from '@wolffc80/payload-image-framing/core'
import { type FrameableMedia, frameImage } from '@wolffc80/payload-image-framing/server'
import Link from 'next/link'
import { getPayload } from 'payload'

import { cardFrames, framing, heroFrames } from '../../framing.js'

export const dynamic = 'force-dynamic'

const secret = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'

type Usage = {
  image?: FrameableMedia | number | null
  imageFraming?: Parameters<typeof frameImage>[0]['override']
} & Record<string, unknown>

/** A media doc rendered in the frames its rules pick, with a plain <img>. */
const Framed = ({
  name,
  rules,
  usage,
}: {
  /** `data-usage`, for the e2e tests. */
  name: string
  rules: FrameRule<BreakpointName<typeof framing>>[]
  usage: Usage
}) => {
  if (!usage.image || typeof usage.image !== 'object') return null
  const frames = matchFrames(rules, usage)
  const { resource, style } = frameImage({
    framing,
    frames,
    media: usage.image,
    override: usage.imageFraming,
    secret,
  })
  // The frame's shape per breakpoint, as variables like the positions.
  const aspect = Object.fromEntries(
    frames
      ? resolveFrames(framing, frames).map(({ breakpoint, frame }) => [
          breakpoint.name === 'base' ? '--frame-aspect' : `--frame-aspect-${breakpoint.name}`,
          String(frame.aspect),
        ])
      : [],
  )
  return (
    <div className="frame" data-usage={name} style={{ ...style, ...aspect } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> on purpose */}
      <img alt={resource.alt ?? ''} className="framed" src={resource.url} />
    </div>
  )
}

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'pages', depth: 1, limit: 20 })

  // The positions from frameImage() and the shapes, per breakpoint, without Tailwind.
  const css = [
    framePositionCss(framing, '.framed'),
    framePositionCss(framing, '.frame', { variable: '--frame-aspect' }).replaceAll(
      'object-position',
      'aspect-ratio',
    ),
  ].join(' ')

  return (
    <main>
      <style>{css}</style>
      <h1>Image framing dev app</h1>
      <p>
        Pages from the <Link href="/admin/collections/pages">admin</Link>, rendered with{' '}
        <code>frameImage()</code>. Resize the window to see the phone, tablet and desktop frames.
      </p>
      {docs.length === 0 && <p>No pages yet. Upload an image to Media and create a page.</p>}
      {docs.map((page) => (
        <section data-page={page.id} key={page.id} style={{ marginBottom: 48 }}>
          <h2>{page.title}</h2>
          <div style={{ position: 'relative' }}>
            <Framed name="hero" rules={heroFrames} usage={page.hero as Usage} />
            {page.hero?.layout === 'fullBleed' && page.hero.heading && (
              <div className="cover">
                <h3 style={{ margin: 0 }}>{page.hero.heading}</h3>
              </div>
            )}
          </div>
          <div className="cards">
            {page.layout?.map((block) => (
              <article key={block.id}>
                <Framed name="card" rules={cardFrames} usage={block as Usage} />
                <h3>{block.heading}</h3>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
