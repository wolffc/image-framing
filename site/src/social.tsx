import './styles.css'
import './social.css'

import type { Frame } from '@wolffc80/payload-image-framing/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Editor } from './components/Editor'
import { FrameView } from './components/FrameView'
import { photos } from './photos'

/**
 * The repository's social preview (1280 x 640), made from the real widgets:
 * `./dev.sh social-preview` screenshots this page into
 * site/public/social-preview.png.
 */

const photo = photos[0]
const framing = { crop: photo.crop, focus: photo.focus }
const heroes: { id: string; label: string; frame: Frame }[] = [
  {
    id: 'desktop',
    label: 'Desktop',
    frame: { aspect: 21 / 9, cover: [{ edge: 'left', size: 45 }] },
  },
  { id: 'phone', label: 'Phone', frame: { aspect: 4 / 5, cover: [{ edge: 'bottom', size: 40 }] } },
]

function Social() {
  return (
    <div className="social" data-testid="social">
      <header>
        <div className="brand">
          <svg aria-hidden="true" viewBox="0 0 32 32">
            <rect x="3" y="6" width="26" height="20" rx="3" />
            <rect x="14" y="11" width="8" height="10" />
          </svg>
          Payload image framing
        </div>
        <h1>
          Crop once. <em>Every</em> layout shows the subject.
        </h1>
        <p>Non-destructive crop and focus areas for Payload CMS, per breakpoint and per usage.</p>
      </header>
      <div className="social-body">
        <figure>
          <Editor framing={framing} onChange={() => {}} photo={photo} />
          <figcaption>
            <span className="swatch swatch-crop" /> Crop area{' '}
            <span className="swatch swatch-focus" /> Focus area
          </figcaption>
        </figure>
        <div className="mocks">
          {heroes.map((hero) => (
            <figure className="mock" key={hero.id}>
              <div className="mock-page">
                <div aria-hidden="true" className="mock-bar">
                  <span />
                  <span />
                  <span />
                </div>
                <FrameView
                  className={`mock-hero mock-hero-${hero.id}`}
                  frame={hero.frame}
                  framing={framing}
                  photo={photo}
                >
                  <div className="mock-text">
                    <h3>Into the weekend</h3>
                    <p>The subject stays clear of the text.</p>
                  </div>
                </FrameView>
              </div>
              <figcaption>{hero.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <footer>
        <code>npm install @wolffc80/payload-image-framing</code>
        <span>wolffc.github.io/image-framing</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Social />
  </StrictMode>,
)
