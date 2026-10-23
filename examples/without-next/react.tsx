import {
  type FrameRule,
  frameAspectCss,
  frameAspectVariables,
  framePositionCss,
  type FramingConfig,
  type FramingOverride,
  matchFrames,
} from '@wolffc80/payload-image-framing/core'
import { type FrameableMedia, frameImage } from '@wolffc80/payload-image-framing/server'
import type { CSSProperties } from 'react'

/**
 * A framed image in plain React, for server rendering (react-dom/server, Remix,
 * React Router, …): the cropped copy in a box of the frame's shape, placed
 * around the focus area per breakpoint.
 */
export function Framed({
  framing,
  media,
  override,
  rules,
  siblings,
}: {
  framing: FramingConfig<string>
  /** The upload field's value, populated. */
  media: FrameableMedia
  /** The usage's own framing, e.g. `block.imageFraming`. */
  override?: FramingOverride
  /** The usage's frame rules, matched against the fields next to the image. */
  rules: FrameRule<string>[]
  siblings: Record<string, unknown>
}) {
  const frames = matchFrames(rules, siblings) ?? { base: { aspect: 16 / 9 } }
  const { resource, style } = frameImage({
    framing,
    frames,
    media,
    override,
    secret: process.env.PAYLOAD_SECRET!,
  })

  return (
    <div
      className="framed"
      style={{ ...style, ...frameAspectVariables(framing, frames) } as CSSProperties}
    >
      {/* One stylesheet per framing config would do; inline here for the example. */}
      <style>{framePositionCss(framing, '.framed img') + frameAspectCss(framing, '.framed')}</style>
      {/* eslint-disable-next-line @next/next/no-img-element -- no Next.js here */}
      <img
        alt={resource.alt ?? ''}
        height={resource.height ?? undefined}
        src={resource.url}
        style={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }}
        width={resource.width ?? undefined}
      />
    </div>
  )
}
