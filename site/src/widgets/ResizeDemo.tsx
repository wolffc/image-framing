import {
  defineFraming,
  frameVariable,
  type Frames,
  type Framing,
  framePositionCss,
  objectPosition,
  previewPlacement,
  type Rect,
  resolveFrames,
  visibleRect,
} from '@wolffc80/payload-image-framing/core'
import { useEffect, useRef, useState } from 'react'

import { formatAspect, formatPosition } from '../format'
import type { Photo } from '../photos'

/** The site's breakpoints, as in `defineFraming` of a real project. */
const framing = defineFraming({
  breakpoints: {
    base: { label: 'Phone' },
    md: { minWidth: 768, label: 'Tablet' },
    lg: { minWidth: 1200, label: 'Desktop' },
  },
})

/** The hero's frame per breakpoint: the shape it is designed for and where its text goes. */
const frames: Frames<'base' | 'md' | 'lg'> = {
  base: { aspect: 4 / 5, cover: [{ edge: 'bottom', size: 40 }] },
  md: { aspect: 16 / 9, cover: [{ edge: 'left', size: 50 }] },
  lg: { aspect: 21 / 9, cover: [{ edge: 'left', size: 40 }] },
}

/** The hero is this many pixels high, so its shape changes with the window's width. */
const heroHeight = { base: 600, md: 520, lg: 560 }

const presets = [
  { label: 'Phone', width: 390 },
  { label: 'Tablet', width: 820 },
  { label: 'Laptop', width: 1280 },
  { label: 'Wide', width: 1440 },
]

const MIN = 320
const MAX = 1440

/**
 * What the browser shows of the cropped copy in a box: `object-fit: cover`
 * fills the box and `object-position` picks the part, as on a site. In
 * percent of the photo.
 */
const coverRect = (
  crop: Rect,
  cropAspect: number,
  boxAspect: number,
  at: { x: number; y: number },
) => {
  let x = 0
  let y = 0
  let width = 100
  let height = 100
  if (boxAspect >= cropAspect) {
    height = (cropAspect / boxAspect) * 100
    y = ((100 - height) * at.y) / 100
  } else {
    width = (boxAspect / cropAspect) * 100
    x = ((100 - width) * at.x) / 100
  }
  return {
    x: crop.x + (x * crop.width) / 100,
    y: crop.y + (y * crop.height) / 100,
    width: (width * crop.width) / 100,
    height: (height * crop.height) / 100,
  }
}

/**
 * A page hero in a window of any width: each breakpoint has its own frame and
 * text position, the server sends one `object-position` per breakpoint, and
 * the browser fills the box and slides the photo along the long side.
 */
export function ResizeDemo({ framing: media, photo }: { framing: Framing; photo: Photo }) {
  const [width, setWidth] = useState(1280)
  const stage = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(720)

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // What frameImage computes on the server: one position per breakpoint.
  const resolved = resolveFrames(framing, frames).map((entry) => ({
    ...entry,
    position: objectPosition(
      media.crop,
      visibleRect({
        ...entry.frame,
        crop: media.crop,
        focus: media.focus,
        image: { width: photo.width, height: photo.height },
      }),
    ),
  }))
  const active = resolved.findLast(({ breakpoint }) => breakpoint.minWidth <= width)!
  const name = active.breakpoint.name

  // What the browser does with it at this width.
  const height = heroHeight[name]
  const boxAspect = width / height
  const cropAspect = (media.crop.width * photo.width) / (media.crop.height * photo.height)
  const shown = coverRect(media.crop, cropAspect, boxAspect, active.position)
  const place = previewPlacement(shown)
  const scale = Math.min(stageWidth / MAX, 380 / height)
  const cover = active.frame.cover?.[0]

  const css = framePositionCss(framing, '.hero img')

  return (
    <div className="resize-demo" data-testid="resize-demo">
      <div className="toolbar">
        <label className="range">
          Window width <output data-testid="resize-width">{width} px</output>
          <input
            aria-label="Window width"
            max={MAX}
            min={MIN}
            onChange={(e) => setWidth(Number(e.target.value))}
            step={1}
            type="range"
            value={width}
          />
        </label>
        <div aria-label="Window presets" className="segmented" role="group">
          {presets.map((preset) => (
            <button
              aria-pressed={preset.width === width}
              key={preset.label}
              onClick={() => setWidth(preset.width)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stage" ref={stage}>
        <div
          className="window"
          data-breakpoint={name}
          data-testid="resize-window"
          style={{ width: width * scale, height: height * scale }}
        >
          <img
            alt=""
            draggable={false}
            src={photo.src}
            style={{
              left: `${place.left}%`,
              top: `${place.top}%`,
              width: `${place.width}%`,
              height: `${place.height}%`,
            }}
          />
          {cover && (
            <div className={`window-text window-text-${cover.edge}`} style={coverStyle(cover)}>
              <strong>Headline</strong>
              <span>
                over the {cover.edge === 'bottom' ? 'bottom' : 'left'} {cover.size}%
              </span>
            </div>
          )}
        </div>
      </div>

      <ol className="breakpoints">
        {resolved.map(({ breakpoint, frame, position }) => (
          <li aria-current={breakpoint.name === name ? 'true' : undefined} key={breakpoint.name}>
            <strong>
              {String(breakpoint.label)}{' '}
              <span>{breakpoint.minWidth ? `from ${breakpoint.minWidth} px` : 'below 768 px'}</span>
            </strong>
            <span>
              frame {formatAspect(frame.aspect)}, text {frame.cover?.[0]?.edge}{' '}
              {frame.cover?.[0]?.size}%
            </span>
            <code>
              {frameVariable(breakpoint.name)}: {formatPosition(position)}
            </code>
          </li>
        ))}
      </ol>
      <details className="css">
        <summary>
          The CSS that applies them (<code>framePositionCss</code>)
        </summary>
        <pre>
          <code>{css.replaceAll(' @', '\n@')}</code>
        </pre>
      </details>
    </div>
  )
}

const coverStyle = ({ edge, size }: { edge: string; size: number }) =>
  edge === 'bottom'
    ? { left: 0, right: 0, bottom: 0, height: `${size}%` }
    : { top: 0, bottom: 0, [edge]: 0, width: `${size}%` }
