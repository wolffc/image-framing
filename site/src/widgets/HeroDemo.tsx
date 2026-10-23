import {
  type Frame,
  type Framing,
  objectPosition,
  visibleRect,
} from '@wolffc80/payload-image-framing/core'
import { useState } from 'react'

import { Editor } from '../components/Editor'
import { FrameView } from '../components/FrameView'
import { PhotoPicker } from '../components/PhotoPicker'
import { formatPosition, formatRect } from '../format'
import type { Photo } from '../photos'

/**
 * The page hero on a desktop and on a phone. A wide frame slides the photo up
 * and down, a tall one sideways, so moving the focus area always moves one.
 */
const layouts = [
  {
    id: 'desktop',
    label: 'Desktop',
    frame: { aspect: 21 / 9, cover: [{ edge: 'left', size: 45 }] },
  },
  {
    id: 'phone',
    label: 'Phone',
    frame: { aspect: 4 / 5, cover: [{ edge: 'bottom', size: 40 }] },
  },
] satisfies { id: string; label: string; frame: Frame }[]

/**
 * The editor next to a page hero with a headline over part of the photo: the
 * hero follows the crop and focus area as they move, through `visibleRect`
 * and `objectPosition`, as on a site.
 */
export function HeroDemo({
  framing,
  onFraming,
  onPhoto,
  photo,
}: {
  framing: Framing
  onFraming: (framing: Framing) => void
  onPhoto: (photo: Photo) => void
  photo: Photo
}) {
  const [explain, setExplain] = useState(false)
  const heroes = layouts.map((layout) => {
    const visible = visibleRect({
      ...layout.frame,
      crop: framing.crop,
      focus: framing.focus,
      image: { width: photo.width, height: photo.height },
    })
    return { ...layout, visible, position: objectPosition(framing.crop, visible) }
  })

  return (
    <div className="hero-demo" data-testid="hero-demo">
      <div className="hero-demo-editor">
        <PhotoPicker onChange={onPhoto} photo={photo} />
        <Editor
          framing={framing}
          onChange={onFraming}
          photo={photo}
          visible={explain ? heroes.map((hero) => hero.visible) : undefined}
        />
        <p className="legend">
          <span className="swatch swatch-crop" /> Crop area: what any page may show
          <br />
          <span className="swatch swatch-focus" /> Focus area: what every frame keeps in view
        </p>
      </div>
      <div className="hero-demo-page">
        <div className="toolbar">
          <strong>Your page</strong>
          <label className="check">
            <input
              checked={explain}
              onChange={(e) => setExplain(e.target.checked)}
              type="checkbox"
            />
            Show how
          </label>
        </div>
        <div className="mocks">
          {heroes.map((hero) => (
            <figure className={`mock mock-${hero.id}`} key={hero.id}>
              <div className="mock-page">
                <div className="mock-bar" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <FrameView
                  className={`mock-hero mock-hero-${hero.id}`}
                  frame={hero.frame}
                  framing={framing}
                  photo={photo}
                  showCover={explain}
                  showFocus={explain}
                  testId={`hero-frame-${hero.id}`}
                >
                  <div className="mock-text">
                    <h3>Into the weekend</h3>
                    <p>The headline sits on the photo, the subject stays clear of it.</p>
                    <span className="mock-button">Book now</span>
                  </div>
                </FrameView>
              </div>
              <figcaption>{hero.label}</figcaption>
            </figure>
          ))}
        </div>
        <table className="readout" data-testid="hero-readout">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">
                <code>visibleRect</code>
              </th>
              <th scope="col">
                <code>objectPosition</code>
              </th>
            </tr>
          </thead>
          <tbody>
            {heroes.map((hero) => (
              <tr key={hero.id}>
                <th scope="row">{hero.label}</th>
                <td>{formatRect(hero.visible)}</td>
                <td data-testid={`hero-position-${hero.id}`}>{formatPosition(hero.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
