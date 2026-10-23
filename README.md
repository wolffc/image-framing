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
- TypeScript 5.4 or later, if you use the types (`NoInfer`)

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

The dev app (`dev/payload.config.ts`) has a `media` collection with three image sizes and a `pages` collection with a framed hero image and a `card` block, framed for three breakpoints (`dev/framing.ts`). The frontend at `/` renders the pages with `frameImage()`, a plain `<img>` and `framePositionCss()`.

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
// <div style={style}><Image src={resource.url} className="object-cover object-[var(--frame-pos)] min-[768px]:object-[var(--frame-pos-md)]" … /></div>
```

### Breakpoints

By default a usage has a frame for phones (`base`) and one from 768 px up (`md`), and `frameImage` writes `--frame-pos` and `--frame-pos-md`. Define your own breakpoints once and share them between the plugin (the usage drawer previews one frame per breakpoint) and the rendering:

```ts
// framing.config.ts – imported by payload.config.ts and by server components
import { defineFraming } from '@wolffc/payload-image-framing/core'

export const framing = defineFraming({
  breakpoints: {
    base: { label: 'Phone' }, // always present, mobile first
    md: { minWidth: 768, label: 'Tablet' },
    lg: { minWidth: 1280, label: 'Desktop' },
  },
})

// payload.config.ts
imageFramingPlugin({ collections: ['media'], framing, usages: { … } })

// a server component
frameImage({ framing, media, frames: { base: { aspect: 4 / 5 }, lg: { aspect: 21 / 9 } }, secret })
// style: { '--frame-pos': …, '--frame-pos-md': … (same as base), '--frame-pos-lg': … }
```

- `base` always applies; every other breakpoint from its `minWidth` up. A breakpoint without a frame of its own uses the next smaller one's, and the drawer marks its preview with "same as …".
- The frames are typed from the config: `FrameRule<BreakpointName<typeof framing>>`, and `frames.xl` is a type error when `xl` isn't defined. Frame rules naming an unknown breakpoint also fail at startup.
- Per-breakpoint crops (art direction) are not supported: a usage has one crop, and each breakpoint only picks the visible part of it.

Apply the variables with the helpers, which use the configured widths:

```ts
import { framedImageClasses, framePositionCss } from '@wolffc/payload-image-framing/core'

framePositionCss(framing, '.framed')
// '.framed{object-position:var(--frame-pos)} @media (min-width:768px){.framed{object-position:var(--frame-pos-md)}} @media (min-width:1280px){…}'
framePositionCss(framing, '.framed', { query: 'container' }) // @container queries instead

framedImageClasses(framing)
// 'object-[var(--frame-pos)] min-[768px]:object-[var(--frame-pos-md)] min-[1280px]:object-[var(--frame-pos-lg)]'
```

Tailwind only generates classes it finds in your source, so copy the class string into your code or safelist it. The variables don't care what switches them: with container queries, the frame follows the size of its container instead of the window.

### Admin translations

The editors' texts go through Payload's i18n, in English and German. They follow the admin language; add `de` to `i18n.supportedLanguages` in your Payload config to offer German. Override single texts, or add a language, with the plugin's `translations` option, by key from `translations.en`:

```ts
imageFramingPlugin({
  collections: ['media'],
  translations: { de: { done: 'Schließen' }, fr: { done: 'Terminé', preview: 'Aperçu' } },
})
```

Texts in your config's own `i18n.translations` under `imageFraming` win over the option. A supported language without texts of its own gets the English ones. Labels you pass in (breakpoint labels, preview shape labels, a usage's `label` and `admin.description`) take a string or one per language, like Payload's: `{ en: 'Tablet', de: 'Tablet' }`.

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

### Storage

By default the plugin reads originals from, and writes rebuilt sizes and cropped copies (in `.crops/`) to, the collection's `staticDir`.

With a storage plugin (`@payloadcms/storage-*`, `disableLocalStorage`):

- **S3, R2, MinIO**: `storage: s3FramingStorage({ bucket, config })` from `@wolffc/payload-image-framing/s3` reads and writes the bucket that `@payloadcms/storage-s3` uses: sizes are rebuilt in the bucket, cropped copies are cached under `image-framing-cache/<collection>/` and removed when the document changes or is deleted. See [examples/cloud-storage](examples/cloud-storage).
- **Any other adapter**, without a `storage` option: the plugin reads originals through the collection's upload handlers (the storage plugin's; not registered with `disablePayloadAccessControl`), so the crop endpoint works, and caches cropped copies on local disk (the system's temp directory). It can't write to the bucket, so the image sizes stay made from the whole photo; it warns unless `rebuildSizes: false`.
- **Your own backend**: implement `FramingStorage` (`readOriginal`, `writeSize`, `readCached`, `writeCached`, `clearCached`) and pass a factory `(collection, doc, req) => FramingStorage`.

The plugin order doesn't matter: storage plugins upload the original in their `afterChange` hook, and the plugin moves its size rebuild after them when Payload starts. Without a cache that survives deploys (e.g. on serverless hosts), put a CDN in front of the crop route: its responses are immutable, so a CDN can keep them forever.

### The secret

The plugin signs cropped-copy URLs with the Payload config's `secret` unless you pass `secret` to the plugin. `frameImage` needs the same value, so call it on the server only. Changing the secret invalidates every cropped URL rendered before: dynamic pages get new ones on their next render, statically generated pages keep the old, now broken, URLs until they are rebuilt or revalidated.

The plugin:

- adds `crop` and `focusArea` groups (`x`, `y`, `width`, `height` in percent of the original) and an editor to each collection, and sets `upload.crop` and `upload.focalPoint` to `false`;
- validates the rects before each save, fills in defaults (the whole photo; a 30% focus area around `focalX`/`focalY`) and keeps `focalX`/`focalY` on the centre of the focus area;
- rebuilds every generated image size from the crop area after a change, under the file names Payload gave them (fixed-shape sizes are framed around the focus area);
- serves cropped copies at `<api>/<collection>/crop/<id>/<rect>.<signature>/<filename>`, for any rect inside the photo, to whoever may read the media document. The signature covers the id, the rect and `updatedAt`, so only URLs made by `frameImage` work, they change with every new version, and they can be cached forever. Copies are cached in `.crops/` next to the uploads.

For every entry in `usages` it also adds an `imageFraming` group (`crop`, `focusArea`) right after that upload field, with a drawer that edits it on the whole photo (the media crop outlined as the default) and previews the result in the usage's frames (the first `frames` rule whose `when` matches the sibling fields), with the covered parts hatched. It throws when a usage path matches no upload field, so a rename can't silently drop the overrides. Uploads inside Lexical rich text are not reachable and use the media framing.

### Plugin options

Every option is optional except `collections`; the defaults are the behaviour without it.

| Option            | Type                                                                 | Default                                                                  | Description                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`     | `CollectionSlug[]` or `{ [slug]: true \| CollectionFramingOptions }` | (required)                                                               | Upload collections that get a crop and a focus area. The object form takes per-collection options, which replace the plugin-wide ones below.                                                               |
| `previewShapes`   | `PreviewShape[]`                                                     | `DEFAULT_PREVIEW_SHAPES` (16:9, 3:2, 4:3, 21:9, 4:5, 1:1, 1200×630)      | Shapes the media editor previews. Plugin-wide or per collection.                                                                                                                                           |
| `storage`         | `(collection, doc) => FramingStorage`                                | `localDiskStorage` on the collection's `staticDir`                       | File access for the size rebuild and the cropped copies. Plugin-wide or per collection.                                                                                                                    |
| `rebuildSizes`    | `boolean \| string[]`                                                | `true`                                                                   | Which generated image sizes are rebuilt from the crop: all, none (`false`: Payload's sizes stay made from the whole photo), or the listed size names. Plugin-wide or per collection.                       |
| `endpoint`        | `false \| { path?: string; cacheControl?: string }`                  | `{ path: '/crop', cacheControl: 'public, max-age=31536000, immutable' }` | The cropped-copy endpoint. `false` leaves it out (e.g. an image service crops from the signed rect); with another `path`, pass `routePrefix` to `frameImage`. Plugin-wide or per collection.               |
| `access`          | `{ create?, read?, update? }` (field access functions)               | none                                                                     | Field access for the added fields: `crop`, `focusArea` and the usage groups. The editors follow it: read-only without update access, hidden without read access. Plugin-wide, per collection or per usage. |
| `secret`          | `string`                                                             | the Payload config's `secret`                                            | Signs the cropped-copy URLs; `frameImage` needs the same value.                                                                                                                                            |
| `usages`          | `{ [path]: UsageOptions }`                                           | `{}`                                                                     | Upload fields that get their own crop and focus area (see below).                                                                                                                                          |
| `framing`         | `FramingConfig` from `defineFraming`                                 | `base` + `md` from 768 px                                                | The breakpoints the usage drawer previews; pass the same config to `frameImage`.                                                                                                                           |
| `translations`    | `{ [language]: { [key]: string } }`                                  | English and German                                                       | Admin texts to override or add, by key; see Admin translations.                                                                                                                                            |
| `editorPath`      | `string`                                                             | `'@wolffc/payload-image-framing/client#FramingEditor'`                   | Component path of the media editor, to use your own.                                                                                                                                                       |
| `usageEditorPath` | `string`                                                             | `'@wolffc/payload-image-framing/client#UsageFramingField'`               | Component path of the usage editor, to use your own.                                                                                                                                                       |
| `disabled`        | `boolean`                                                            | `false`                                                                  | Turns the plugin off but keeps its fields, so the database stays the same: no hooks, endpoint or editors.                                                                                                  |

`UsageOptions`, per entry in `usages`:

| Option              | Type                                 | Default                  | Description                                                                                                                                 |
| ------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `frames`            | `FrameRule[]`                        | `[]`                     | The frames the usage shows the photo in, per breakpoint: the first rule whose `when` matches the sibling fields. For the drawer's previews. |
| `name`              | `string`                             | `'imageFraming'`         | Name of the group next to the upload field that stores the usage's crop and focus area.                                                     |
| `label`             | `string` or `{ [language]: string }` | 'Framing for this usage' | Title of the usage's drawer.                                                                                                                |
| `admin.description` | `string` or `{ [language]: string }` | none                     | Shown under the usage's framing summary and in its drawer.                                                                                  |
| `access`            | `{ create?, read?, update? }`        | the plugin's `access`    | Field access for the usage's group.                                                                                                         |

The plugin checks its configuration at startup and throws with the reason when a collection in `collections` doesn't exist or isn't an upload collection; a framed collection already has a field named `framing`, `crop` or `focusArea` (the media fields can't be renamed, since `frameImage` reads them); a usage's group name is taken on its level; a usage path matches no upload field, or one with several `relationTo` collections, `hasMany`, or a collection without framing; a frame rule names an undefined breakpoint; or `sharp` or the secret is missing.

The size of a default focus area (30 % of each side, around Payload's focal point) and the smallest crop or focus area (1 %) are fixed: `frameImage` and the editors apply the same defaults without knowing the plugin's options.

## Payload internals this depends on

The admin editors use only exported `@payloadcms/ui` hooks and components: `useField`, `useFormFields`, `useConfig`, `useModal`, `useDrawerSlug`, `Drawer`, `DrawerToggler`, `FieldLabel`, and Payload's `btn` CSS classes. Beyond the public API, the plugin relies on:

- the form state containing the base upload fields `url` and `mimeType` (the editor's preview);
- `payload.db.updateOne` keeping a passed `updatedAt` (the rebuilt sizes are saved without a new version; Payload 3.39 sets a new one, and the plugin then returns the stored value from the save);
- the generated sizes' `filename` in `doc.sizes`, which it overwrites;
- the REST route `<api>/<collection>/<id>?depth=0`, which the usage drawer reads the media document from.

Check these after a Payload upgrade. `test/int/` covers the crop route and the size rebuild; the full integration test from weflyhome.com (`dev/imageFraming.int.spec.ts`) is being ported to the dev app.
