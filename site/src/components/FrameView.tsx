import {
  type Frame,
  type Framing,
  objectPosition,
  previewPlacement,
  relativeRect,
  visibleRect,
} from '@wolffc80/payload-image-framing/core'
import type { CSSProperties, ReactNode } from 'react'

import type { Photo } from '../photos'

/**
 * A photo shown in a frame the way a site shows it: the part `visibleRect`
 * picks (the frame's shape, inside the crop, around the focus area), with the
 * parts the layout covers hatched. On a site, `frameImage` serves the cropped
 * copy and moves it with the same `objectPosition`; here the whole photo is
 * placed so the box shows exactly that part.
 */
export function FrameView({
  children,
  className,
  frame,
  framing,
  photo,
  showCover = false,
  showFocus = false,
  style,
  testId,
}: {
  children?: ReactNode
  className?: string
  frame: Frame
  framing: Framing
  photo: Photo
  showCover?: boolean
  showFocus?: boolean
  style?: CSSProperties
  testId?: string
}) {
  const visible = visibleRect({
    ...frame,
    crop: framing.crop,
    focus: framing.focus,
    image: { width: photo.width, height: photo.height },
  })
  const place = previewPlacement(visible)
  const position = objectPosition(framing.crop, visible)
  const focus = relativeRect(framing.focus, visible)

  return (
    <div
      className={['frame', className].filter(Boolean).join(' ')}
      data-object-position={`${position.x}% ${position.y}%`}
      data-testid={testId}
      style={{ aspectRatio: String(frame.aspect), ...style }}
    >
      <img
        alt=""
        draggable={false}
        src={photo.src}
        style={{
          height: `${place.height}%`,
          left: `${place.left}%`,
          top: `${place.top}%`,
          width: `${place.width}%`,
        }}
      />
      {showCover &&
        frame.cover?.map((area) => (
          <span
            aria-hidden="true"
            className="cover"
            key={area.edge}
            style={{
              [area.edge]: 0,
              ...(area.edge === 'left' || area.edge === 'right'
                ? { top: 0, bottom: 0, width: `${area.size}%` }
                : { left: 0, right: 0, height: `${area.size}%` }),
            }}
          />
        ))}
      {showFocus && (
        <span
          aria-hidden="true"
          className="focus-outline"
          style={{
            left: `${focus.x}%`,
            top: `${focus.y}%`,
            width: `${focus.width}%`,
            height: `${focus.height}%`,
          }}
        />
      )}
      {children}
    </div>
  )
}
