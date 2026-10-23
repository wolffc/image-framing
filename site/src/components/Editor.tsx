import {
  type Framing,
  FULL_RECT,
  MIN_SIZE,
  normalizeRect,
  type Rect,
} from '@wolffc80/payload-image-framing/core'
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'

import type { Photo } from '../photos'

type Target = 'crop' | 'focus'
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const

/** A rect moved or resized with one handle by dx/dy percent, kept inside `within`. */
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

const box = (rect: Rect) => ({
  left: `${rect.x}%`,
  top: `${rect.y}%`,
  width: `${rect.width}%`,
  height: `${rect.height}%`,
})

/**
 * The crop area (solid) and the focus area (dashed) on the whole photo, as in
 * the plugin's media editor: drag to move, drag a corner to resize. With the
 * keyboard: focus a frame, arrows move it, Shift + arrows resize it.
 */
export function Editor({
  framing,
  limit = FULL_RECT,
  onChange,
  photo,
  reference,
  visible,
}: {
  framing: Framing
  /** The crop may not leave this rect. */
  limit?: Rect
  onChange: (framing: Framing) => void
  photo: Photo
  /** Drawn dotted, e.g. the media's crop next to a usage's own. */
  reference?: Rect
  /** Drawn as the parts frames show. */
  visible?: Rect[]
}) {
  const area = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<{
    handle: Handle
    rect: Rect
    start: { x: number; y: number }
    target: Target
  } | null>(null)
  const { crop, focus } = framing

  const setCrop = (next: Rect) => onChange({ crop: next, focus: normalizeRect(focus, next) })
  const setFocus = (next: Rect) => onChange({ crop, focus: next })
  const update = (target: Target, next: Rect) =>
    target === 'crop' ? setCrop(next) : setFocus(next)
  const within = (target: Target) => (target === 'crop' ? limit : crop)

  const down = (target: Target, handle: Handle) => (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    area.current?.setPointerCapture(event.pointerId)
    setActive({
      handle,
      rect: target === 'crop' ? crop : focus,
      start: { x: event.clientX, y: event.clientY },
      target,
    })
  }

  const move = (event: PointerEvent) => {
    if (!active || !area.current) return
    const bounds = area.current.getBoundingClientRect()
    const dx = ((event.clientX - active.start.x) / bounds.width) * 100
    const dy = ((event.clientY - active.start.y) / bounds.height) * 100
    update(active.target, drag(active.rect, active.handle, dx, dy, within(active.target)))
  }

  const key = (target: Target) => (event: KeyboardEvent) => {
    const step = event.altKey ? 0.2 : 1
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key]
    if (!delta) return
    event.preventDefault()
    const rect = target === 'crop' ? crop : focus
    update(target, drag(rect, event.shiftKey ? 'se' : 'move', delta[0], delta[1], within(target)))
  }

  return (
    <div
      className="editor"
      onPointerCancel={() => setActive(null)}
      onPointerMove={move}
      onPointerUp={() => setActive(null)}
      ref={area}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <img alt={`${photo.title}: ${photo.note}`} draggable={false} src={photo.src} />
      {reference && <div aria-hidden="true" className="reference" style={box(reference)} />}
      {visible?.map((rect, index) => (
        <div aria-hidden="true" className="visible-outline" key={index} style={box(rect)} />
      ))}
      {(['crop', 'focus'] as const).map((target) => (
        <div
          aria-label={`${target === 'crop' ? 'Crop area' : 'Focus area'}: drag, or arrow keys to move and Shift + arrow keys to resize`}
          className={`rect rect-${target}`}
          data-testid={`${target}-rect`}
          key={target}
          onKeyDown={key(target)}
          onPointerDown={down(target, 'move')}
          role="group"
          style={box(target === 'crop' ? crop : focus)}
          tabIndex={0}
        >
          {CORNERS.map((corner) => (
            <span
              aria-hidden="true"
              className={`handle handle-${corner}`}
              key={corner}
              onPointerDown={down(target, corner)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
