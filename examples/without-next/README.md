# Without Next.js

`frameImage` (`@wolffc80/payload-image-framing/server`) needs neither Next.js nor
Payload: a media document from Payload's API, the usage's override, the frames
and the secret are enough. It runs on any server; the secret must stay there.

- [`react.tsx`](react.tsx): a React component (server rendering), a plain
  `<img>` with the CSS helpers.
- [`Framed.astro`](Framed.astro): the same as an Astro component.

Both put the frame's positions and shapes as CSS variables on a box, and one
stylesheet per framing config applies them per breakpoint. For responsive
image sizes, hand `resource.url` to your image service (Astro's `<Image>`, a
CDN); one cropped copy serves every breakpoint.

To fetch the media, use Payload's REST API with `depth=1`, or Payload's Local
API in the same process. In a frontend that only sees the API and must not
know the secret, use the usage option `expose` instead (see
[headless](../headless)).
