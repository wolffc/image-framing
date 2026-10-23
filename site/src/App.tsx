import type { Framing } from '@wolffc80/payload-image-framing/core'
import { useState } from 'react'

import focusEditing from '../../docs/images/focus-editing.gif'
import framingDiagram from '../../docs/images/framing.svg'
import mediaEditor from '../../docs/images/media-editor.png'
import usageDrawer from '../../docs/images/usage-drawer.png'
import { CopyCode } from './components/CopyCode'
import { type Photo, photos } from './photos'
import { HeroDemo } from './widgets/HeroDemo'
import { OverrideDemo } from './widgets/OverrideDemo'
import { ResizeDemo } from './widgets/ResizeDemo'
import { Shapes } from './widgets/Shapes'

const repo = 'https://github.com/wolffc/image-framing'
const readme = `${repo}#readme`
const npm = 'https://www.npmjs.com/package/@wolffc80/payload-image-framing'
const example = (name: string) => `${repo}/tree/main/examples/${name}`

const initial = (): Record<string, Framing> =>
  Object.fromEntries(photos.map((photo) => [photo.id, { crop: photo.crop, focus: photo.focus }]))

const setups = [
  {
    title: 'Cloud storage',
    text: 'S3, R2 or MinIO with @payloadcms/storage-s3: cropped copies are cached in the bucket.',
    href: example('cloud-storage'),
  },
  {
    title: 'Headless',
    text: 'A separate front end calls frameImage on its server and renders the result itself.',
    href: example('headless'),
  },
  {
    title: 'Without Next.js',
    text: 'Any React server, or plain HTML: the URL and the object-position per breakpoint.',
    href: example('without-next'),
  },
  {
    title: 'Your own breakpoints',
    text: 'defineFraming names the breakpoints once, for the admin previews and the site.',
    href: example('breakpoints'),
  },
  {
    title: 'Overrides in blocks',
    text: 'A usage field in a block, a page or a global, with frames per layout.',
    href: example('usage-overrides'),
  },
  {
    title: 'Existing projects',
    text: 'Add the plugin to a collection with photos in it: nothing is changed until edited.',
    href: example('existing-project'),
  },
]

export function App() {
  const [photo, setPhoto] = useState<Photo>(photos[0])
  const [framings, setFramings] = useState(initial)
  const framing = framings[photo.id]
  const setFraming = (next: Framing) => setFramings((all) => ({ ...all, [photo.id]: next }))

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#top">
            <svg aria-hidden="true" viewBox="0 0 32 32">
              <rect x="3" y="6" width="26" height="20" rx="3" />
              <rect x="14" y="11" width="8" height="10" />
            </svg>
            Payload image framing
          </a>
          <nav aria-label="Site">
            <a href={readme}>Docs</a>
            <a href={npm}>npm</a>
            <a href={repo}>GitHub</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="intro wrap">
          <h1>
            Crop once. <em>Every</em> layout shows the subject.
          </h1>
          <p className="lead">
            A plugin for <a href="https://payloadcms.com">Payload CMS</a>. Editors mark the part of
            a photo a site may show and the subject inside it. Every image size, layout and
            breakpoint then shows that part, with the subject in view and clear of text. The
            original file never changes.
          </p>
          <p className="try">
            Try it: drag the <strong>focus area</strong> (dashed) or the <strong>crop area</strong>{' '}
            (solid) on the photo, or resize them by a corner. The page hero next to it is placed by
            the plugin’s own code, running in your browser.
          </p>
          <HeroDemo framing={framing} onFraming={setFraming} onPhoto={setPhoto} photo={photo} />
          <CopyCode code="npm install @wolffc80/payload-image-framing" />
        </section>

        <section className="wrap" id="shapes">
          <h2>One photo, many shapes</h2>
          <p>
            The same framing serves a wide hero, a card, a square tile and a portrait. Each frame
            fills its shape from the crop area and slides towards the subject, so nobody crops the
            photo again for every place it appears.
          </p>
          <Shapes framing={framing} photo={photo} />
        </section>

        <section className="wrap" id="text">
          <h2>Text over the photo</h2>
          <p>
            A layout declares which part of its frame text covers, such as a headline over the left
            45 % of a hero. The plugin keeps the focus area in the part that stays free, so a
            headline never sits on the subject. Tick <em>Show how</em> in the demo above to see the
            covered part hatched and the part of the photo the frame shows.
          </p>
        </section>

        <section className="wrap" id="responsive">
          <h2>Responsive breakpoints</h2>
          <p>
            Each breakpoint can have its own frame and text position. The server computes one{' '}
            <code>object-position</code> per breakpoint and sends them as CSS variables. The browser
            fills the hero box and slides the photo along its long side. Drag the window width and
            watch the subject stay in view.
          </p>
          <ResizeDemo framing={framing} photo={photo} />
        </section>

        <section className="wrap" id="overrides">
          <h2>Per-usage overrides</h2>
          <p>
            The media’s crop is only the default. A page, block or global that uses the photo can
            set its own framing, tighter or wider than the media’s, up to the whole photo. Every
            other page keeps the default.
          </p>
          <OverrideDemo framing={framing} key={photo.id} photo={photo} />
        </section>

        <section className="wrap" id="non-destructive">
          <h2>Non-destructive</h2>
          <p>
            Payload’s built-in crop overwrites the uploaded file, and its focal point is a single
            point. Here the crop is data: the original stays, a crop can be widened again at any
            time, and the subject is an area that frames keep in view.
          </p>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">Payload’s crop and focal point</th>
                  <th scope="col">This plugin</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Original file</th>
                  <td>Overwritten by the crop</td>
                  <td>Never changed</td>
                </tr>
                <tr>
                  <th scope="row">Undo or widen a crop</th>
                  <td>No</td>
                  <td>Yes, any time</td>
                </tr>
                <tr>
                  <th scope="row">Subject</th>
                  <td>One point</td>
                  <td>An area that frames keep in view</td>
                </tr>
                <tr>
                  <th scope="row">Text over the photo</th>
                  <td>The subject may end up under it</td>
                  <td>The subject stays in the free part</td>
                </tr>
                <tr>
                  <th scope="row">Crop for one page or block</th>
                  <td>No</td>
                  <td>Yes, tighter or wider</td>
                </tr>
                <tr>
                  <th scope="row">Responsive frames</th>
                  <td>One position from the point</td>
                  <td>One position per breakpoint</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="wrap" id="admin">
          <h2>In the admin panel</h2>
          <p>
            The media editor replaces Payload’s crop tool. Previews show the photo in common shapes
            as you edit. A page’s image field opens a drawer with that layout’s frames, with the
            parts text covers hatched.
          </p>
          <div className="screens">
            <figure className="screen-wide">
              <img
                alt="Dragging the focus area in the media editor; the previews follow"
                loading="lazy"
                src={focusEditing}
              />
              <figcaption>Moving the focus area: the previews follow.</figcaption>
            </figure>
            <figure>
              <img
                alt="The media editor: crop area, focus area and previews in common shapes"
                loading="lazy"
                src={mediaEditor}
              />
              <figcaption>The media editor</figcaption>
            </figure>
            <figure>
              <img
                alt="A usage's drawer: its own crop, the media's crop dotted, previews with hatched text areas"
                loading="lazy"
                src={usageDrawer}
              />
              <figcaption>A page’s own framing</figcaption>
            </figure>
          </div>
        </section>

        <section className="wrap" id="how">
          <h2>How it works</h2>
          <ol className="steps">
            <li>
              <strong>Editors frame the photo once.</strong> A crop area and a focus area are saved
              with the media document. The file stays as uploaded.
            </li>
            <li>
              <strong>Layouts describe their frames.</strong> A shape per breakpoint, and the part
              text covers.
            </li>
            <li>
              <strong>The server picks the part.</strong> <code>frameImage</code> serves a copy
              cropped to the crop area. It computes one <code>object-position</code> per breakpoint
              that centres the focus area in the free part of each frame.
            </li>
            <li>
              <strong>The browser fills the box.</strong> <code>object-fit: cover</code> with those
              positions. With <code>next/image</code>, <code>&lt;FramedImage&gt;</code> does it all.
            </li>
          </ol>
          <img
            alt="A photo with its crop area and focus area; a 4:5 phone frame that slides towards the subject; a 21:9 desktop frame with text over its left 40 %, the subject in the free part"
            className="diagram"
            loading="lazy"
            src={framingDiagram}
          />
        </section>

        <section className="wrap" id="setups">
          <h2>Your setup</h2>
          <p>Runnable examples and snippets for common setups:</p>
          <ul className="cards">
            {setups.map((setup) => (
              <li key={setup.title}>
                <a href={setup.href}>
                  <strong>{setup.title}</strong>
                  <span>{setup.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="wrap get-started" id="install">
          <h2>Get started</h2>
          <p>Payload 3.39 or later, any database adapter, React 19.</p>
          <CopyCode code="npm install @wolffc80/payload-image-framing" />
          <pre className="snippet">
            <code>{`// payload.config.ts
import { imageFramingPlugin } from '@wolffc80/payload-image-framing'

export default buildConfig({
  sharp,
  plugins: [imageFramingPlugin({ collections: ['media'] })],
})`}</code>
          </pre>
          <p>
            <a className="button" href={`${repo}#quick-start`}>
              Read the quick start
            </a>
          </p>
        </section>
      </main>

      <footer className="wrap site-footer">
        <p>
          MIT licensed · <a href={repo}>Source on GitHub</a> · <a href={npm}>npm</a> · Sample photos
          are drawings made for this page (CC0).
        </p>
      </footer>
    </>
  )
}
