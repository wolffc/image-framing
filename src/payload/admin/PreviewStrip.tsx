'use client'

import React from 'react'

import {
  type CoverArea,
  type Frame,
  FULL_RECT,
  previewPlacement,
  type Rect,
  relativeRect,
  visibleRect,
} from '../../core/index.js'

import { useFramingTranslation } from './i18n.js'

/** One preview of `PreviewStrip`: a frame and its caption. */
export interface PreviewFrame {
  /** Stable key, also `data-framing-preview` for tests. */
  key: string
  label: string
  frame: Frame
  /** The breakpoint whose frame this preview repeats, when it has none of its own. */
  fallbackFrom?: string
  /** Shown after the label, e.g. 'same as Phones'. */
  note?: string
}

const coverStyle = ({ edge, size }: CoverArea, compact: boolean): React.CSSProperties => ({
  position: 'absolute',
  [edge]: 0,
  ...(edge === 'left' || edge === 'right'
    ? { top: 0, bottom: 0, width: `${size}%` }
    : { left: 0, right: 0, height: `${size}%` }),
  background: compact
    ? 'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.45) 0 3px, rgb(255 255 255 / 0.25) 3px 6px)'
    : 'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.45) 0 6px, rgb(255 255 255 / 0.25) 6px 12px)',
})

/** The height of the drawer's previews, and of the compact ones next to a usage's status line. */
export const PREVIEW_HEIGHT = { compact: 40, full: 96 } as const

/**
 * The photo as the site shows it in each frame: cut to the crop, placed around
 * the focus area, with the parts that text covers hatched. `compact` shows
 * small previews without a heading, e.g. next to a usage's status line.
 */
export const PreviewStrip: React.FC<{
  crop: Rect
  focus: Rect
  frames: PreviewFrame[]
  image: { width: number; height: number }
  url: string
  /** The part of the original photo the file at `url` shows. Default: all of it. */
  region?: Rect
  /** Small previews without a heading, as next to a usage's status line. Default: `false`. */
  compact?: boolean
}> = ({ compact = false, crop, focus, frames, image, region = FULL_RECT, url }) => {
  const { t } = useFramingTranslation()
  if (!frames.length || !image.width || !image.height) return null
  const height = compact ? PREVIEW_HEIGHT.compact : PREVIEW_HEIGHT.full
  const previews = (
    <div
      style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: compact ? 8 : 12 }}
    >
      {frames.map(({ fallbackFrom, frame, key, label, note }) => {
        const visible = visibleRect({ ...frame, crop, focus, image })
        const placement = previewPlacement(relativeRect(visible, region))
        return (
          <figure
            data-framing-fallback={fallbackFrom}
            data-framing-preview={key}
            key={key}
            style={{ margin: 0, opacity: fallbackFrom ? 0.7 : 1 }}
            title={compact ? label : undefined}
          >
            <div
              style={{
                aspectRatio: String(frame.aspect),
                background: 'var(--theme-elevation-100)',
                borderRadius: compact ? 2 : 4,
                height,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of the original */}
              <img
                alt=""
                decoding="async"
                loading={compact ? 'lazy' : undefined}
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
                <span
                  aria-hidden="true"
                  data-cover={area.edge}
                  key={area.edge}
                  style={coverStyle(area, compact)}
                />
              ))}
            </div>
            <figcaption
              style={{
                color: 'var(--theme-elevation-500)',
                fontSize: compact ? 11 : 12,
                lineHeight: compact ? 1.2 : undefined,
                marginTop: compact ? 2 : 4,
              }}
            >
              {label}
              {note && !compact && <span style={{ fontStyle: 'italic' }}> · {note}</span>}
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
  if (compact) {
    return (
      <div aria-label={t('preview')} data-framing-preview-strip="compact" role="group">
        {previews}
      </div>
    )
  }
  return (
    <div data-framing-preview-strip style={{ marginTop: 16 }}>
      <p style={{ fontWeight: 600, margin: '0 0 8px' }}>{t('preview')}</p>
      {previews}
    </div>
  )
}
