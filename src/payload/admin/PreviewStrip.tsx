'use client'

import React from 'react'

// Not '../../core': its index also exports the URL signing, which needs Node's crypto.
import { type CoverArea, type Frame, previewPlacement, visibleRect } from '../../core/frame'
import type { Rect } from '../../core/rect'

export interface PreviewFrame {
  /** Stable key, also `data-framing-preview` for tests. */
  key: string
  label: string
  frame: Frame
}

const coverStyle = ({ edge, size }: CoverArea): React.CSSProperties => ({
  position: 'absolute',
  [edge]: 0,
  ...(edge === 'left' || edge === 'right'
    ? { top: 0, bottom: 0, width: `${size}%` }
    : { left: 0, right: 0, height: `${size}%` }),
  background:
    'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.45) 0 6px, rgb(255 255 255 / 0.25) 6px 12px)',
})

/**
 * The photo as the site shows it in each frame: cut to the crop, placed around
 * the focus area, with the parts that text covers hatched.
 */
export const PreviewStrip: React.FC<{
  crop: Rect
  focus: Rect
  frames: PreviewFrame[]
  image: { width: number; height: number }
  url: string
}> = ({ crop, focus, frames, image, url }) => {
  if (!frames.length || !image.width || !image.height) return null
  return (
    <div data-framing-preview-strip style={{ marginTop: 16 }}>
      <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Preview</p>
      <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {frames.map(({ frame, key, label }) => {
          const placement = previewPlacement(visibleRect({ ...frame, crop, focus, image }))
          return (
            <figure data-framing-preview={key} key={key} style={{ margin: 0 }}>
              <div
                style={{
                  aspectRatio: String(frame.aspect),
                  background: 'var(--theme-elevation-100)',
                  borderRadius: 4,
                  height: 96,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of the original */}
                <img
                  alt=""
                  src={url}
                  style={{
                    height: `${placement.height}%`,
                    left: `${placement.left}%`,
                    maxWidth: 'none',
                    position: 'absolute',
                    top: `${placement.top}%`,
                    width: `${placement.width}%`,
                  }}
                />
                {frame.cover?.map((area) => (
                  <span aria-hidden="true" data-cover={area.edge} key={area.edge} style={coverStyle(area)} />
                ))}
              </div>
              <figcaption style={{ color: 'var(--theme-elevation-500)', fontSize: 12, marginTop: 4 }}>
                {label}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
