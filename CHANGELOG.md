# Changelog

All notable changes to `@wolffc80/payload-image-framing` are listed here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
package uses [Semantic Versioning](https://semver.org/).

## 0.1.0-beta.0

The first pre-release, published under the `next` tag for testing.

- The package is published as `@wolffc80/payload-image-framing` (the npm
  scope `@wolffc` belongs to someone else). Component paths in import maps
  change accordingly: run `payload generate:importmap`.
- Extracted from weflyhome.com (`src/plugins/imageFraming`) with its history.
- Package layout after Payload's plugin template, with a Docker-based dev app.
- Entry points `.`, `./core`, `./server`, `./client` and `./next`.
- Supports Payload `^3.39.0`.
- `./core` has no Node imports and works in the browser; the crop token
  signing moved to `./server`, together with `frameImage`.
- Every entry point lists its exports explicitly; `./next` re-exports
  `frameImage` until it gets Next-only helpers.
- `frameImage` derives the crop route from the media `url`, so any collection
  slug, `routes.api` or `serverURL` works without options; new `baseUrl`
  option; `DEFAULT_ROUTE_PREFIX` is gone.
- The plugin uses Payload's `config.sharp` (and fails at startup without it);
  `sharp` is no longer a peer dependency.
- The plugin's `secret` defaults to the Payload config's `secret`.
- Neutral admin wording instead of "block".
- Configurable breakpoints: `defineFraming({ breakpoints })`, shared by the
  plugin (`framing` option; the usage drawer previews each breakpoint and
  marks fallbacks) and `frameImage({ framing })` (one CSS variable per
  breakpoint). `Frames` and `FrameRule` are typed from the config. New
  helpers `framePositionCss` and `framedImageClasses`. Without a config the
  output is the same as before (`base` and `md` from 768 px).
- `DEFAULT_VARIABLE` moved from `./server` to `./core`.
- Plugin options: `collections` as an object with per-collection options;
  `previewShapes`, `storage`, `rebuildSizes`, `endpoint` (`path`,
  `cacheControl`, or `false`) and `access` plugin-wide or per collection;
  per-usage `name`, `label`, `admin.description` and `access`; `disabled`.
  The editors follow field access. Startup errors for unknown collections,
  taken field names, usages on collections without framing and usages on
  polymorphic or `hasMany` upload fields. `CROP_ENDPOINT_PATH` is now
  `DEFAULT_ENDPOINT_PATH` (`'/crop'`).
- Admin texts through Payload's i18n (`imageFraming` namespace), in English
  and German; `translations` option to override texts or add languages.
  Breakpoint, preview shape and usage labels take one string per language.
- Cloud storage: `s3FramingStorage` (`./s3`) rebuilds sizes and caches
  cropped copies in the bucket of `@payloadcms/storage-s3`; with any other
  storage plugin the plugin reads originals through its handlers. The size
  rebuild runs after the storage plugins' uploads, whatever the plugin order.
  `FramingStorage.writeSize` is optional; storage factories also get `req`.
- Edge cases: localized upload fields get a localized override (not inside
  localized parents); SVGs aren't framed; animated GIFs and WebPs stay
  animated; cropped copies are capped at `maxSize` (4000 px); quick saves
  write their sizes in save order; blocks in `blockReferences` are found.
- Tests without the site: integration tests against the dev app on SQLite,
  Postgres and MongoDB (latest and lowest Payload), Playwright e2e tests,
  a weekly run against Payload's latest release. Localized usages need
  Payload 3.80+ (a Payload bug before).
- Rendering: `<FramedImage>` in `./next` (around `next/image`); helpers
  `frameAspectVariables` and `frameAspectCss` for the frame shape per
  breakpoint; `frameImage`'s result type is now `FrameImageResult`. Usage
  option `expose` returns the computed framing to headless frontends.
- Examples: runnable apps (quick start, per-usage overrides, breakpoints, an
  existing project) built in CI, and snippets (cloud storage, without Next.js,
  several collections, headless). `context: { imageFraming: { rebuild: true } }`
  on an update forces the size rebuild, e.g. to regenerate existing sizes.
- README for the published package (concepts with a diagram, every option,
  rendering, storage, security, migrations, compatibility, troubleshooting,
  screenshots), CONTRIBUTING.md, and a doc comment on every export.
