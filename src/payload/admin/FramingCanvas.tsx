'use client'

import React, { useRef, useState } from 'react'

// Not '../../core': its index also exports the URL signing, which needs Node's crypto.
import { MIN_SIZE, normalizeRect, type Rect } from '../../core/rect'

type Target = 'crop' | 'focus'
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'
type Key = keyof Rect

const KEYS: Key[] = ['x', 'y', 'width', 'height']
const KEY_LABELS: Record<Key, string> = { x: 'Left', y: 'Top', width: 'Width', height: 'Height' }
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const

/** A rect moved or resized by `dx`/`dy` percent with one handle, kept inside `within`. */
const drag = (rect: Rect, handle: Handle, dx: number, dy: number, within: Rect): Rect => {
  if (handle === 'move') return normalizeRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, within)
  let { x, y, width, height } = rect
  const right = x + width
  const bottom = y + height
  if (handle.includes('w')) x = Math.min(Math.max(within.x, x + dx), right - MIN_SIZE)
  if (handle.includes('n')) y = Math.min(Math.max(within.y, y + dy), bottom - MIN_SIZE)
  width = handle.includes('w') ? right - x : width + dx
  height = handle.includes('n') ? bottom - y : height + dy
  return normalizeRect({ x, y, width, height }, within)
}

/** A changed number field, keeping the opposite edge where it can and the rect inside `within`. */
const withValue = (rect: Rect, key: Key, value: number, within: Rect): Rect => {
  const next = { ...rect, [key]: value }
  if (key === 'x') next.width = Math.min(next.width, within.x + within.width - value)
  if (key === 'y') next.height = Math.min(next.height, within.y + within.height - value)
  return normalizeRect(next, within)
}

const handleStyle = (handle: Handle, colour: string): React.CSSProperties => ({
  position: 'absolute',
  width: 12,
  height: 12,
  background: colour,
  border: '2px solid var(--theme-elevation-0)',
  borderRadius: 2,
  cursor: `${handle}-resize`,
  ...(handle.includes('n') ? { top: -7 } : { bottom: -7 }),
  ...(handle.includes('w') ? { left: -7 } : { right: -7 }),
})

export const percentBox = (rect: Rect): React.CSSProperties => ({
  position: 'absolute',
  left: `${rect.x}%`,
  top: `${rect.y}%`,
  width: `${rect.width}%`,
  height: `${rect.height}%`,
})

export interface FramingCanvasProps {
  /** The original photo. */
  url: string
  /** The crop may not leave this rect, usually the whole photo. */
  limit: Rect
  /** Drawn as a dotted outline for orientation, e.g. the media crop in a block's editor. */
  reference?: Rect
  crop: Rect
  focus: Rect
  onChange: (framing: { crop: Rect; focus: Rect }) => void
}

/**
 * The photo with a crop frame (solid) and a focus frame (dashed) to drag and
 * resize, plus number fields for both. Everything outside the crop is dimmed,
 * and outside `limit`, where the crop cannot go, it is darker still.
 */
export const FramingCanvas: React.FC<FramingCanvasProps> = ({
  crop,
  focus,
  limit,
  onChange,
  reference,
  url,
}) => {
  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<{
    handle: Handle
    rect: Rect
    start: { x: number; y: number }
    target: Target
  } | null>(null)

  const setCrop = (next: Rect) => onChange({ crop: next, focus: normalizeRect(focus, next) })
  const setFocus = (next: Rect) => onChange({ crop, focus: next })

  const onPointerDown = (target: Target, handle: Handle) => (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    setActive({ handle, rect: target === 'crop' ? crop : focus, start: { x: event.clientX, y: event.clientY }, target })
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!active || !box.current) return
    const bounds = box.current.getBoundingClientRect()
    const dx = ((event.clientX - active.start.x) / bounds.width) * 100
    const dy = ((event.clientY - active.start.y) / bounds.height) * 100
    if (active.target === 'crop') setCrop(drag(active.rect, active.handle, dx, dy, limit))
    else setFocus(drag(active.rect, active.handle, dx, dy, crop))
  }

  const onNumber = (target: Target, key: Key) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isFinite(value)) return
    if (target === 'crop') setCrop(withValue(crop, key, value, limit))
    else setFocus(withValue(focus, key, value, crop))
  }

  return (
    <div>
      <div
        onPointerMove={onPointerMove}
        onPointerUp={() => setActive(null)}
        ref={box}
        style={{ position: 'relative', maxWidth: 720, overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the admin shows the original, unoptimised */}
        <img alt="" draggable={false} src={url} style={{ display: 'block', width: '100%' }} />
        <div
          aria-hidden="true"
          style={{
            ...percentBox(limit),
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.35)',
            pointerEvents: 'none',
          }}
        />
        {reference && (
          <div
            aria-hidden="true"
            data-framing-rect="reference"
            style={{
              ...percentBox(reference),
              outline: '2px dotted var(--theme-warning-500)',
              outlineOffset: -2,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          data-framing-rect="crop"
          onPointerDown={onPointerDown('crop', 'move')}
          style={{
            ...percentBox(crop),
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)',
            cursor: 'move',
            outline: '2px solid var(--theme-elevation-0)',
          }}
        >
          {CORNERS.map((handle) => (
            <span
              key={handle}
              onPointerDown={onPointerDown('crop', handle)}
              style={handleStyle(handle, 'var(--theme-elevation-1000)')}
            />
          ))}
        </div>
        <div
          data-framing-rect="focusArea"
          onPointerDown={onPointerDown('focus', 'move')}
          style={{
            ...percentBox(focus),
            background: 'rgb(255 255 255 / 0.08)',
            border: '2px dashed var(--theme-success-500)',
            cursor: 'move',
          }}
        >
          {CORNERS.map((handle) => (
            <span
              key={handle}
              onPointerDown={onPointerDown('focus', handle)}
              style={handleStyle(handle, 'var(--theme-success-500)')}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 16 }}>
        {(['crop', 'focus'] as const).map((target) => (
          <fieldset key={target} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>
              {target === 'crop' ? 'Crop area' : 'Focus area'} (%)
            </legend>
            <div style={{ display: 'flex', gap: 8 }}>
              {KEYS.map((key) => (
                <label key={key} style={{ display: 'grid', fontSize: 12, gap: 4 }}>
                  {KEY_LABELS[key]}
                  <input
                    // `crop.x` etc. for both editors, so tests and editors find the same fields.
                    data-framing-input={`${target === 'crop' ? 'crop' : 'focusArea'}.${key}`}
                    max={100}
                    min={0}
                    onChange={onNumber(target, key)}
                    step={0.1}
                    style={{ width: 72 }}
                    type="number"
                    value={(target === 'crop' ? crop : focus)[key]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  )
}
