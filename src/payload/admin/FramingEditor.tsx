'use client'

import { FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import React, { useRef, useState } from 'react'

// Not '../../core': its index also exports the URL signing, which needs Node's crypto.
import { FULL_RECT, MIN_SIZE, normalizeRect, type Rect, resolveFraming } from '../../core/rect'

type Target = 'crop' | 'focusArea'
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'
type Key = keyof Rect

const KEYS: Key[] = ['x', 'y', 'width', 'height']
const KEY_LABELS: Record<Key, string> = { x: 'Left', y: 'Top', width: 'Width', height: 'Height' }

/** The four number fields of one rect group as a rect, plus a setter for all of them. */
const useRect = (target: Target) => {
  const fields = {
    x: useField<number | null>({ path: `${target}.x` }),
    y: useField<number | null>({ path: `${target}.y` }),
    width: useField<number | null>({ path: `${target}.width` }),
    height: useField<number | null>({ path: `${target}.height` }),
  }
  const stored = {
    x: fields.x.value,
    y: fields.y.value,
    width: fields.width.value,
    height: fields.height.value,
  }
  const set = (rect: Rect) => {
    for (const key of KEYS) if (fields[key].value !== rect[key]) fields[key].setValue(rect[key])
  }
  return { set, stored }
}

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

const percentBox = (rect: Rect): React.CSSProperties => ({
  position: 'absolute',
  left: `${rect.x}%`,
  top: `${rect.y}%`,
  width: `${rect.width}%`,
  height: `${rect.height}%`,
})

/**
 * Crop and focus area editor for a media document (#316). The crop area is
 * the part of the photo the site may ever show; the focus area is the part
 * every frame keeps in view where it can. Both are data: the original file is
 * never changed, so a crop can be widened again later.
 */
export const FramingEditor: React.FC = () => {
  const url = useFormFields(([fields]) => fields.url?.value as string | undefined)
  const focalX = useFormFields(([fields]) => fields.focalX?.value as number | undefined)
  const focalY = useFormFields(([fields]) => fields.focalY?.value as number | undefined)
  const mimeType = useFormFields(([fields]) => fields.mimeType?.value as string | undefined)
  const cropField = useRect('crop')
  const focusField = useRect('focusArea')
  const { crop, focus } = resolveFraming({
    crop: cropField.stored,
    focusArea: focusField.stored,
    focalX,
    focalY,
  })

  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<{
    handle: Handle
    start: { x: number; y: number }
    rect: Rect
    target: Target
  } | null>(null)

  const setCrop = (next: Rect) => {
    cropField.set(next)
    // The focus area stays inside the crop.
    focusField.set(normalizeRect(focus, next))
  }

  const onPointerDown = (target: Target, handle: Handle) => (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    setActive({
      handle,
      rect: target === 'crop' ? crop : focus,
      start: { x: event.clientX, y: event.clientY },
      target,
    })
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!active || !box.current) return
    const bounds = box.current.getBoundingClientRect()
    const dx = ((event.clientX - active.start.x) / bounds.width) * 100
    const dy = ((event.clientY - active.start.y) / bounds.height) * 100
    if (active.target === 'crop') setCrop(drag(active.rect, active.handle, dx, dy, FULL_RECT))
    else focusField.set(drag(active.rect, active.handle, dx, dy, crop))
  }

  if (mimeType && !mimeType.startsWith('image/')) return null

  const rectFor = (target: Target) => (target === 'crop' ? crop : focus)
  const onNumber = (target: Target, key: Key) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isFinite(value)) return
    if (target === 'crop') setCrop(withValue(crop, key, value, FULL_RECT))
    else focusField.set(withValue(focus, key, value, crop))
  }

  return (
    <div className="field-type" data-image-framing-editor style={{ marginBottom: 'var(--spacing-field)' }}>
      <FieldLabel label="Crop and focus area" />
      <p style={{ color: 'var(--theme-elevation-500)', margin: '0 0 12px' }}>
        The <strong>crop area</strong> (solid frame) is the only part of the photo the site
        shows, in every size and shape. The <strong>focus area</strong> (dashed frame) is the
        subject: the site keeps it in view and away from text. The original file stays as it
        is, so you can widen the crop again later.
      </p>

      {url ? (
        <div
          onPointerMove={onPointerMove}
          onPointerUp={() => setActive(null)}
          ref={box}
          style={{ position: 'relative', maxWidth: 720, touchAction: 'none', userSelect: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the admin shows the original, unoptimised */}
          <img alt="" draggable={false} src={url} style={{ display: 'block', width: '100%' }} />
          {/* Everything outside the crop is dimmed. */}
          <div
            style={{
              ...percentBox(crop),
              boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
              outline: '2px solid var(--theme-elevation-0)',
              cursor: 'move',
            }}
            data-framing-rect="crop"
            onPointerDown={onPointerDown('crop', 'move')}
          >
            {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
              <span
                key={handle}
                onPointerDown={onPointerDown('crop', handle)}
                style={handleStyle(handle, 'var(--theme-elevation-1000)')}
              />
            ))}
          </div>
          <div
            style={{
              ...percentBox(focus),
              border: '2px dashed var(--theme-success-500)',
              background: 'rgb(255 255 255 / 0.08)',
              cursor: 'move',
            }}
            data-framing-rect="focusArea"
            onPointerDown={onPointerDown('focusArea', 'move')}
          >
            {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
              <span
                key={handle}
                onPointerDown={onPointerDown('focusArea', handle)}
                style={handleStyle(handle, 'var(--theme-success-500)')}
              />
            ))}
          </div>
        </div>
      ) : (
        <p>Upload and save the photo first, then set its crop and focus area here.</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 16 }}>
        {(['crop', 'focusArea'] as const).map((target) => (
          <fieldset key={target} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>
              {target === 'crop' ? 'Crop area' : 'Focus area'} (%)
            </legend>
            <div style={{ display: 'flex', gap: 8 }}>
              {KEYS.map((key) => (
                <label key={key} style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                  {KEY_LABELS[key]}
                  <input
                    data-framing-input={`${target}.${key}`}
                    max={100}
                    min={0}
                    onChange={onNumber(target, key)}
                    step={0.1}
                    style={{ width: 72 }}
                    type="number"
                    value={rectFor(target)[key]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          className="btn btn--style-secondary btn--size-small"
          onClick={() => setCrop(FULL_RECT)}
          style={{ alignSelf: 'end', margin: 0 }}
          type="button"
        >
          Show the whole photo
        </button>
      </div>
    </div>
  )
}
