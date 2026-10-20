# Image framing

Non-destructive crop and focus areas for Payload upload collections, and the helpers to render them with `next/image` (#316).

- **Crop area**: the only part of the photo the site shows, in every size and shape. The original stays untouched, so a crop can be widened again later.
- **Focus area**: the subject. Every frame keeps it in view where the shape allows, and away from the parts of the frame that layouts cover with text.
- **Per-usage override**: a block (or any configured upload field) can narrow the crop and move the focus area for itself. It can never show more than the media crop: overrides are cut down to it when saved and again when rendered, so narrowing the media crop later also narrows every override.

## Layers

| Layer | Contents | May import |
| --- | --- | --- |
| `core/` | Rect types and validation, override resolution (`resolveFraming(media, override)`), the framing algorithm (`visibleRect`, `objectPosition`), frame rules (`matchFrames`), preview placement, signed crop tokens | Nothing but itself and `node:crypto` |
| `payload/` | `imageFramingPlugin()`, the fields, hooks, the cropped-copy route, the storage interface and the admin editor | `core/`, `payload`, `@payloadcms/ui`, `sharp`, `react` |
| `next/` | `frameImage()`: a media doc, an optional override and frame shapes to the cropped URL and `object-position` CSS variables | `core/` |

Nothing here imports site code; `tests/unit/imageFramingBoundary.spec.ts` enforces it.

## Use

```ts
// payload.config plugins
imageFramingPlugin({
  collections: ['media'],
  secret: process.env.PAYLOAD_SECRET,
  usages: {
    // <collection>.<field path>, or block:<block slug>.<field path>; unnamed tabs and rows don't count
    'pages.hero.media': { frames: [{ when: { type: 'fullBleed' }, frames: { base: { aspect: 16 / 9 } } }] },
    'block:cta.media': {},
  },
})

// a server component
const { resource, style } = frameImage({
  media,
  override: block.imageFraming,
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

For every entry in `usages` it also adds an `imageFraming` group (`crop`, `focusArea`) right after that upload field, with a drawer that edits it inside the media crop and previews the result in the usage's frames (the first `frames` rule whose `when` matches the sibling fields), with the covered parts hatched. It throws when a usage path matches no upload field, so a rename can't silently drop the overrides. Uploads inside Lexical rich text are not reachable and use the media framing.

Options: `collections`, `secret`, `usages`, `previewShapes` (the shapes the media editor previews), `editorPath` and `usageEditorPath` (Payload component paths of the editors), `storage` (file access; the default is the local `staticDir`, implement `FramingStorage` for S3 and the like).

## Payload internals this depends on

The admin editors use only exported `@payloadcms/ui` hooks and components: `useField`, `useFormFields`, `useConfig`, `useModal`, `useDrawerSlug`, `Drawer`, `DrawerToggler`, `FieldLabel`, and Payload's `btn` CSS classes. Beyond the public API, the plugin relies on:

- the form state containing the base upload fields `url` and `mimeType` (the editor's preview);
- `payload.db.updateOne` keeping a passed `updatedAt` (the rebuilt sizes are saved without a new version);
- the generated sizes' `filename` in `doc.sizes`, which it overwrites;
- the REST route `<api>/<collection>/<id>?depth=0`, which the usage drawer reads the media document from.

Check these after a Payload upgrade; `tests/int/imageFraming.int.spec.ts` covers them.
