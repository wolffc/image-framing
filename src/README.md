# Image framing

Non-destructive crop and focus areas for Payload upload collections, and the helpers to render them with `next/image` (#316).

- **Crop area**: the only part of the photo the site shows, in every size and shape. The original stays untouched, so a crop can be widened again later.
- **Focus area**: the subject. Every frame keeps it in view where the shape allows, and away from the parts of the frame that layouts cover with text.

## Layers

| Layer | Contents | May import |
| --- | --- | --- |
| `core/` | Rect types and validation, the framing algorithm (`visibleRect`, `objectPosition`), signed crop tokens | Nothing but itself and `node:crypto` |
| `payload/` | `imageFramingPlugin()`, the fields, hooks, the cropped-copy route, the storage interface and the admin editor | `core/`, `payload`, `@payloadcms/ui`, `sharp`, `react` |
| `next/` | `frameImage()`: a media doc plus frame shapes to the cropped URL and `object-position` CSS variables | `core/` |

Nothing here imports site code; `tests/unit/imageFramingBoundary.spec.ts` enforces it.

## Use

```ts
// payload.config plugins
imageFramingPlugin({ collections: ['media'], secret: process.env.PAYLOAD_SECRET })

// a server component
const { resource, style } = frameImage({
  media,
  frames: { base: { aspect: 16 / 9 }, md: { aspect: 2.4, cover: [{ edge: 'left', size: 45 }] } },
  secret: process.env.PAYLOAD_SECRET,
})
// <div style={style}><Image src={resource.url} className="object-cover object-[var(--frame-pos)] md:object-[var(--frame-pos-md)]" … /></div>
```

The plugin:

- adds `crop` and `focusArea` groups (`x`, `y`, `width`, `height` in percent of the original) and an editor to each collection, and sets `upload.crop` and `upload.focalPoint` to `false`;
- validates the rects before each save, fills in defaults (the whole photo; a 30% focus area around `focalX`/`focalY`) and keeps `focalX`/`focalY` on the centre of the focus area;
- rebuilds every generated image size from the crop area after a change, under the file names Payload gave them (fixed-shape sizes are framed around the focus area);
- serves cropped copies at `/api/<collection>/crop/<id>/<rect>.<signature>/<filename>`. The signature covers the id, the rect and `updatedAt`, so only URLs made by `frameImage` work, they change with every new version, and they can be cached forever. Copies are cached in `.crops/` next to the uploads.

Options: `collections`, `secret`, `editorPath` (the editor's Payload component path), `storage` (file access; the default is the local `staticDir`, implement `FramingStorage` for S3 and the like).

## Payload internals this depends on

The admin editor uses only exported `@payloadcms/ui` hooks and components: `useField`, `useFormFields`, `FieldLabel`. Beyond the public API, the plugin relies on:

- the form state containing the base upload fields `url` and `mimeType` (the editor's preview);
- `payload.db.updateOne` keeping a passed `updatedAt` (the rebuilt sizes are saved without a new version);
- the generated sizes' `filename` in `doc.sizes`, which it overwrites.

Check these after a Payload upgrade; `tests/int/imageFraming.int.spec.ts` covers them.
