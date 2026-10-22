# Payload image framing

Non-destructive crop and focus areas for [Payload CMS](https://payloadcms.com) upload collections, and the helpers to render them. Developed for weflyhome.com and published as `@wolffc/payload-image-framing` (MIT).

- **Crop area**: the part of the photo the site shows, in every size and shape, unless a usage sets its own. The original stays untouched, so a crop can be widened again later.
- **Focus area**: the subject. Every frame keeps it in view where the shape allows, and away from the parts of the frame that layouts cover with text.
- **Per-usage override**: a block (or any configured upload field) can set its own crop and focus area. The media crop is only the default: an override may be narrower or wider, up to the whole photo. Overrides are kept inside the photo when saved.

## Status

Work in progress: being extracted from weflyhome.com into a standalone package. Not on npm yet; see the [issues](https://github.com/wolffc/image-framing/issues) for the road to 1.0.

## Layout

| Path                 | Contents                                                                                                                                                                                    | May import                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `src/core/`          | Rect types and validation, override resolution (`resolveFraming(media, override)`), the framing algorithm (`visibleRect`, `objectPosition`), frame rules (`matchFrames`), preview placement | Nothing but itself: runs in the browser      |
| `src/server/`        | `frameImage()` (a media doc, an optional override and frame shapes to the cropped URL and `object-position` CSS variables) and the signed crop tokens                                       | `core/`, `node:crypto`                       |
| `src/payload/`       | `imageFramingPlugin()`, the fields, hooks, the cropped-copy route and the storage interface                                                                                                 | `core/`, `server/`, `payload`, `sharp`, Node |
| `src/payload/admin/` | The admin components (`'use client'`)                                                                                                                                                       | `core/`, `react`, `@payloadcms/ui`           |
| `src/next/`          | Next.js-only helpers (to come)                                                                                                                                                              | `core/`, `server/`, `next`                   |
| `src/exports/`       | Entry points that only re-export (`./server`, `./client`)                                                                                                                                   |                                              |
| `dev/`               | A Payload + Next app for development and tests (SQLite)                                                                                                                                     | the package by its name                      |
| `test/unit/`         | Vitest unit tests                                                                                                                                                                           |                                              |
| `test/int/`          | Vitest integration tests against a Payload instance (SQLite, no services)                                                                                                                   |                                              |
| `test/consumer/`     | A fresh Payload + Next app the pack test builds against the packed package                                                                                                                  | the package by its name                      |
| `examples/`          | Example setups (to come)                                                                                                                                                                    |                                              |
| `scripts/`           | `pack-smoke.sh`: packs the package and installs it into a scratch project                                                                                                                   |                                              |

`test/unit/imageFramingBoundary.spec.ts` checks the import rules above, and that every admin module is marked `'use client'`.

## Entry points

| Import                                 | Contents                                                                                                                  | Where                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `@wolffc/payload-image-framing`        | `imageFramingPlugin`, its options, `FramingStorage`, `localDiskStorage`                                                   | Payload config                             |
| `@wolffc/payload-image-framing/core`   | Rects, `resolveFraming`, `visibleRect`, `objectPosition`, `matchFrames`, `previewPlacement`, `relativeRect` and the types | Anywhere, including client components      |
| `@wolffc/payload-image-framing/server` | `frameImage`, `cropUrl`, `cropToken`/`readCropToken`                                                                      | Server only: they use the secret           |
| `@wolffc/payload-image-framing/client` | `FramingEditor`, `UsageFramingField`, `FramingCanvas`, `PreviewStrip` (`'use client'`)                                    | Admin panel, loaded through the import map |
| `@wolffc/payload-image-framing/next`   | Next.js helpers; for now it re-exports `frameImage`                                                                       | Next server components                     |

Every entry lists its exports explicitly; `test/unit/publicApi.spec.ts` snapshots them, so a change to the public API shows up in review.

The plugin registers its admin editors by package path (`@wolffc/payload-image-framing/client#FramingEditor`), so after installing or updating the package run `payload generate:importmap`. The `editorPath` and `usageEditorPath` options are only needed for your own editors.

`./server` doesn't import `server-only`: that package throws outside Next's server bundles, which would break the helpers in plain Node, tests or other frameworks. It does import `node:crypto`, so a bundler without Node polyfills fails to build a browser bundle that pulls it in; Next polyfills `crypto`, so in Next keep `./server` out of client components yourself. The secret must stay on the server.

## Requirements

- Payload `^3.39.0` (3.39 is the lowest version CI checks) with `sharp` in the Payload config; the package doesn't install sharp itself, it uses Payload's
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
// payload.config.ts
import sharp from 'sharp'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'

export default buildConfig({
  sharp, // required: the plugin crops and resizes with Payload's sharp
  secret: process.env.PAYLOAD_SECRET,
  plugins: [
    imageFramingPlugin({
      collections: ['media'],
      usages: {
        // <collection or global>.<field path>, or block:<block slug>.<field path>;
        // unnamed tabs, rows and collapsibles don't count
        'pages.header.image': {
          frames: [{ when: { layout: 'wide' }, frames: { base: { aspect: 16 / 9 } } }],
        },
        'block:card.image': {},
      },
    }),
  ],
  // …
})
```

```tsx
// a server component
import { frameImage } from '@wolffc/payload-image-framing/server'

const { resource, style } = frameImage({
  media: page.header.image, // the media document (depth ≥ 1)
  override: page.header.imageFraming,
  frames: { base: { aspect: 16 / 9 }, md: { aspect: 2.4, cover: [{ edge: 'left', size: 45 }] } },
  secret: process.env.PAYLOAD_SECRET, // the same secret as the plugin
})
// <div style={style}><Image src={resource.url} className="object-cover object-[var(--frame-pos)] md:object-[var(--frame-pos-md)]" … /></div>
```

### Cropped-copy URLs

`frameImage` serves a cropped photo from the plugin's route next to Payload's file route: a media `url` of `/api/media/file/beach.jpg` gives `/api/media/crop/<id>/<rect>.<signature>/beach.jpg`. So a collection with another slug, a custom `routes.api` or an absolute `serverURL` need no options. Two options cover other setups:

- `routePrefix`: where the crop route is, e.g. `'/api/images/crop'`, for media whose `url` isn't Payload's file route (a storage adapter serving straight from a bucket). Without it, `frameImage` throws for such media when it needs a cropped copy.
- `baseUrl`: serve the cropped copies from another origin, e.g. a CDN in front of Payload (`'https://cdn.example.com'`).

With `next/image`, allow the crop route next to the file route in `next.config`:

```js
images: {
  localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/api/media/crop/**' }],
  // or, with an absolute serverURL or a CDN:
  // remotePatterns: [{ protocol: 'https', hostname: 'cms.example.com', pathname: '/api/media/crop/**' }],
}
```

### The secret

The plugin signs cropped-copy URLs with the Payload config's `secret` unless you pass `secret` to the plugin. `frameImage` needs the same value, so call it on the server only. Changing the secret invalidates every cropped URL rendered before: dynamic pages get new ones on their next render, statically generated pages keep the old, now broken, URLs until they are rebuilt or revalidated.

The plugin:

- adds `crop` and `focusArea` groups (`x`, `y`, `width`, `height` in percent of the original) and an editor to each collection, and sets `upload.crop` and `upload.focalPoint` to `false`;
- validates the rects before each save, fills in defaults (the whole photo; a 30% focus area around `focalX`/`focalY`) and keeps `focalX`/`focalY` on the centre of the focus area;
- rebuilds every generated image size from the crop area after a change, under the file names Payload gave them (fixed-shape sizes are framed around the focus area);
- serves cropped copies at `<api>/<collection>/crop/<id>/<rect>.<signature>/<filename>`, for any rect inside the photo, to whoever may read the media document. The signature covers the id, the rect and `updatedAt`, so only URLs made by `frameImage` work, they change with every new version, and they can be cached forever. Copies are cached in `.crops/` next to the uploads.

For every entry in `usages` it also adds an `imageFraming` group (`crop`, `focusArea`) right after that upload field, with a drawer that edits it on the whole photo (the media crop outlined as the default) and previews the result in the usage's frames (the first `frames` rule whose `when` matches the sibling fields), with the covered parts hatched. It throws when a usage path matches no upload field, so a rename can't silently drop the overrides. Uploads inside Lexical rich text are not reachable and use the media framing.

Options: `collections`, `secret` (default: the Payload config's), `usages`, `previewShapes` (the shapes the media editor previews), `editorPath` and `usageEditorPath` (Payload component paths of the editors), `storage` (file access; the default is the local `staticDir`, implement `FramingStorage` for S3 and the like).

## Payload internals this depends on

The admin editors use only exported `@payloadcms/ui` hooks and components: `useField`, `useFormFields`, `useConfig`, `useModal`, `useDrawerSlug`, `Drawer`, `DrawerToggler`, `FieldLabel`, and Payload's `btn` CSS classes. Beyond the public API, the plugin relies on:

- the form state containing the base upload fields `url` and `mimeType` (the editor's preview);
- `payload.db.updateOne` keeping a passed `updatedAt` (the rebuilt sizes are saved without a new version; Payload 3.39 sets a new one, and the plugin then returns the stored value from the save);
- the generated sizes' `filename` in `doc.sizes`, which it overwrites;
- the REST route `<api>/<collection>/<id>?depth=0`, which the usage drawer reads the media document from.

Check these after a Payload upgrade. `test/int/` covers the crop route and the size rebuild; the full integration test from weflyhome.com (`dev/imageFraming.int.spec.ts`) is being ported to the dev app.
