# Payload image framing

Non-destructive crop and focus areas for [Payload CMS](https://payloadcms.com) upload collections, and the helpers to render them. Developed for weflyhome.com and published as `@wolffc/payload-image-framing` (MIT).

- **Crop area**: the part of the photo the site shows, in every size and shape, unless a usage sets its own. The original stays untouched, so a crop can be widened again later.
- **Focus area**: the subject. Every frame keeps it in view where the shape allows, and away from the parts of the frame that layouts cover with text.
- **Per-usage override**: a block (or any configured upload field) can set its own crop and focus area. The media crop is only the default: an override may be narrower or wider, up to the whole photo. Overrides are kept inside the photo when saved.

## Status

Work in progress: being extracted from weflyhome.com into a standalone package. Not on npm yet; see the [issues](https://github.com/wolffc/image-framing/issues) for the road to 1.0.

## Layout

| Path           | Contents                                                                                                                                                                                                        | May import                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/core/`    | Rect types and validation, override resolution (`resolveFraming(media, override)`), the framing algorithm (`visibleRect`, `objectPosition`), frame rules (`matchFrames`), preview placement, signed crop tokens | Nothing but itself and `node:crypto`                   |
| `src/payload/` | `imageFramingPlugin()`, the fields, hooks, the cropped-copy route, the storage interface and the admin editor                                                                                                   | `core/`, `payload`, `@payloadcms/ui`, `sharp`, `react` |
| `src/next/`    | `frameImage()`: a media doc, an optional override and frame shapes to the cropped URL and `object-position` CSS variables                                                                                       | `core/`                                                |
| `src/exports/` | Entry points that only re-export (`./server`, `./client`)                                                                                                                                                       |                                                        |
| `dev/`         | A Payload + Next app for development and tests (SQLite)                                                                                                                                                         | the package by its name                                |
| `test/unit/`   | Vitest unit tests                                                                                                                                                                                               |                                                        |
| `examples/`    | Example setups (to come)                                                                                                                                                                                        |                                                        |
| `scripts/`     | `pack-smoke.sh`: packs the package and installs it into a scratch project                                                                                                                                       |                                                        |

Entry points:

| Import                                 | Contents                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `@wolffc/payload-image-framing`        | `imageFramingPlugin`, its options, `FramingStorage`, `localDiskStorage`            |
| `@wolffc/payload-image-framing/core`   | The framing model and algorithm                                                    |
| `@wolffc/payload-image-framing/server` | `frameImage`, `cropUrl`, `cropToken`/`readCropToken` (use the secret: server only) |
| `@wolffc/payload-image-framing/client` | The admin components (`'use client'`)                                              |
| `@wolffc/payload-image-framing/next`   | `frameImage`, as before; Next-specific helpers will live here                      |

`test/unit/imageFramingBoundary.spec.ts` checks the import rules above.

## Requirements

- Payload `^3.39.0` (3.39 is the lowest version CI checks) with `sharp` in the Payload config
- React 19; Next.js 15.2.3+ or 16 for the admin panel
- Node.js 20.18.1 or later

## Development

Everything runs in Docker; the host needs only Docker with the compose plugin.

```bash
./dev.sh start        # dev app on http://localhost:3000 (admin: /admin, logs in automatically)
./dev.sh test         # unit tests
./dev.sh typecheck    # tsc on src/, test/ and dev/
./dev.sh build        # dist/ (SWC + tsc declarations)
./dev.sh pnpm lint    # ESLint; `pnpm format` / `pnpm format:check` for Prettier
./dev.sh pnpm test:pack  # pack, install into a scratch project, import every entry point
./dev.sh shell        # a shell in the container; ./dev.sh <cmd> runs any command
./dev.sh reset        # remove containers and volumes
```

`PORT=3100 ./dev.sh start` uses another host port. After changing the plugin's admin components or paths, run `./dev.sh pnpm generate:importmap`; after changing the dev collections, `./dev.sh pnpm generate:types`.

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests and the build on every pull request, repeats typecheck, tests and build on the lowest supported Payload, and runs the pack test on both. Releases must be packed with pnpm: only pnpm applies `publishConfig.exports`, which points the entry points at `dist/`.

The dev app (`dev/payload.config.ts`) has a `media` collection with three image sizes and a `pages` collection with a framed hero image and a `card` block. The frontend at `/` renders the pages with `frameImage()` and a plain `<img>`.

## Use

```ts
// payload.config plugins
imageFramingPlugin({
  collections: ['media'],
  secret: process.env.PAYLOAD_SECRET,
  usages: {
    // <collection>.<field path>, or block:<block slug>.<field path>; unnamed tabs and rows don't count
    'pages.hero.media': {
      frames: [{ when: { type: 'fullBleed' }, frames: { base: { aspect: 16 / 9 } } }],
    },
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
- serves cropped copies at `/api/<collection>/crop/<id>/<rect>.<signature>/<filename>`, for any rect inside the photo. The signature covers the id, the rect and `updatedAt`, so only URLs made by `frameImage` work, they change with every new version, and they can be cached forever. Copies are cached in `.crops/` next to the uploads.

For every entry in `usages` it also adds an `imageFraming` group (`crop`, `focusArea`) right after that upload field, with a drawer that edits it on the whole photo (the media crop outlined as the default) and previews the result in the usage's frames (the first `frames` rule whose `when` matches the sibling fields), with the covered parts hatched. It throws when a usage path matches no upload field, so a rename can't silently drop the overrides. Uploads inside Lexical rich text are not reachable and use the media framing.

Options: `collections`, `secret`, `usages`, `previewShapes` (the shapes the media editor previews), `editorPath` and `usageEditorPath` (Payload component paths of the editors), `storage` (file access; the default is the local `staticDir`, implement `FramingStorage` for S3 and the like).

## Payload internals this depends on

The admin editors use only exported `@payloadcms/ui` hooks and components: `useField`, `useFormFields`, `useConfig`, `useModal`, `useDrawerSlug`, `Drawer`, `DrawerToggler`, `FieldLabel`, and Payload's `btn` CSS classes. Beyond the public API, the plugin relies on:

- the form state containing the base upload fields `url` and `mimeType` (the editor's preview);
- `payload.db.updateOne` keeping a passed `updatedAt` (the rebuilt sizes are saved without a new version);
- the generated sizes' `filename` in `doc.sizes`, which it overwrites;
- the REST route `<api>/<collection>/<id>?depth=0`, which the usage drawer reads the media document from.

Check these after a Payload upgrade; the integration test (`dev/imageFraming.int.spec.ts`, being ported to the dev app) covers them.
