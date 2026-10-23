import type { Frame, Framing } from '@wolffc80/payload-image-framing/core'
import { useState } from 'react'

import { FrameView } from '../components/FrameView'
import { formatAspect } from '../format'
import type { Photo } from '../photos'

const shapes: { label: string; frame: Frame }[] = [
  { label: 'Wide hero', frame: { aspect: 21 / 9 } },
  { label: 'Card', frame: { aspect: 3 / 2 } },
  { label: 'Square tile', frame: { aspect: 1 } },
  { label: 'Portrait', frame: { aspect: 4 / 5 } },
  { label: 'Story', frame: { aspect: 9 / 16 } },
]

/** The same photo and framing in the shapes a site typically uses. */
export function Shapes({ framing, photo }: { framing: Framing; photo: Photo }) {
  const [showFocus, setShowFocus] = useState(false)

  return (
    <div data-testid="shapes">
      <label className="check">
        <input
          checked={showFocus}
          onChange={(e) => setShowFocus(e.target.checked)}
          type="checkbox"
        />
        Show the focus area
      </label>
      <div className="shapes">
        {shapes.map(({ frame, label }) => (
          <figure key={label} style={{ flexGrow: frame.aspect }}>
            <FrameView frame={frame} framing={framing} photo={photo} showFocus={showFocus} />
            <figcaption>
              {label} <span>{formatAspect(frame.aspect)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
