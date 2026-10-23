import {
  FULL_RECT,
  type Frame,
  type Framing,
  type FramingOverride,
  normalizeRect,
  resolveFraming,
} from '@wolffc80/payload-image-framing/core'
import { useState } from 'react'

import { Editor } from '../components/Editor'
import { FrameView } from '../components/FrameView'
import { formatRect } from '../format'
import type { Photo } from '../photos'

const frame: Frame = { aspect: 3 / 2 }

/** A crop just around the focus area, with some room. */
const tight = ({ focus }: Framing) =>
  normalizeRect({
    x: focus.x - focus.width * 0.6,
    y: focus.y - focus.height * 0.3,
    width: focus.width * 2.2,
    height: focus.height * 1.6,
  })

/**
 * One block's own crop next to the media's: the block may show less of the
 * photo or more, the media and its other usages stay as they are.
 * `resolveFraming` combines them as the plugin does. Keyed by the photo, so
 * switching photos starts without an override.
 */
export function OverrideDemo({ framing: media, photo }: { framing: Framing; photo: Photo }) {
  const [override, setOverride] = useState<FramingOverride>(null)

  const source = { crop: media.crop, focusArea: media.focus }
  const usage = resolveFraming(source, override)
  const set = (framing: Framing | null) =>
    setOverride(framing ? { crop: framing.crop, focusArea: framing.focus } : null)

  return (
    <div className="override-demo" data-testid="override-demo">
      <div className="override-editor">
        <div className="toolbar">
          <div aria-label="Block crop" className="segmented" role="group">
            <button aria-pressed={!override} onClick={() => set(null)} type="button">
              As the media
            </button>
            <button onClick={() => set({ crop: tight(media), focus: media.focus })} type="button">
              Tighter
            </button>
            <button onClick={() => set({ crop: FULL_RECT, focus: media.focus })} type="button">
              The whole photo
            </button>
          </div>
        </div>
        <Editor framing={usage} onChange={set} photo={photo} reference={media.crop} />
        <p className="legend">
          <span className="swatch swatch-reference" /> The media’s crop, for comparison. Drag the
          solid frame: it may go past it.
        </p>
      </div>
      <div className="override-results">
        <figure>
          <FrameView frame={frame} framing={media} photo={photo} />
          <figcaption>
            Media default, on every other page
            <small>{formatRect(media.crop)}</small>
          </figcaption>
        </figure>
        <figure>
          <FrameView frame={frame} framing={usage} photo={photo} testId="override-frame" />
          <figcaption>
            This block {override ? '(own framing)' : '(uses the default)'}
            <small data-testid="override-crop">{formatRect(usage.crop)}</small>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
