# Headless frontends

A frontend that only talks to Payload's REST or GraphQL API (another server,
a mobile app, a static site generator) can't call `frameImage`: it needs the
secret, which must stay in the CMS. Set `expose: true` on the usage, and every
read of the document carries the computed framing in a virtual field next to
the upload field.

```ts
// payload.config.ts
imageFramingPlugin({
  collections: ['media'],
  usages: {
    'pages.hero.image': { expose: true, frames: heroFrames },
  },
})
```

```http
GET /api/pages/1?depth=0
```

```json
{
  "hero": {
    "image": 12,
    "imageFraming": { "crop": { "x": 20, "y": 0, "width": 60, "height": 100 } },
    "imageFramed": {
      "url": "/api/media/crop/12/2000-0-6000-10000.Xy3…/beach.jpg",
      "width": 1800,
      "height": 1000,
      "alt": "Beach",
      "mimeType": "image/jpeg",
      "style": { "--frame-pos": "62.5% 50%", "--frame-pos-md": "100% 50%" },
      "focus": { "x": 61.1, "y": 30, "width": 22.2, "height": 40 }
    }
  }
}
```

- `imageFramed` (for an upload field `image`; rename it with
  `expose: { name }`) is computed on the server on every read, with the frames
  of the rule that matches the fields next to the image. Nothing is stored.
- With `depth: 0` the plugin reads the media document itself: one extra query
  per exposed usage and read. With `depth: 1` it uses the populated one.
- `style` holds the `object-position` per breakpoint as CSS variables; apply
  them with the breakpoints' media queries, e.g. the output of
  `framePositionCss(framing, '.hero img')` written into your stylesheet at build
  time. [`client.ts`](client.ts) shows a fetch and the markup.
- In GraphQL the field is JSON: query `hero { imageFramed }`.
