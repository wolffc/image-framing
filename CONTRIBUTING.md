# Contributing

Thanks for helping. Issues and pull requests are welcome at
[github.com/wolffc/image-framing](https://github.com/wolffc/image-framing).

## Setup

Everything runs in Docker; the host needs only Docker with the compose plugin.

```bash
./dev.sh start        # dev app on http://localhost:3000 (admin: /admin, logs in automatically)
./dev.sh test         # unit tests (no services)
./dev.sh test-int     # integration tests on SQLite; `./dev.sh test-int postgres` or `mongodb` starts that database
./dev.sh test-e2e     # Playwright against the dev app (starts it)
./dev.sh test-s3      # cloud storage tests against an S3-compatible server
./dev.sh typecheck    # tsc on src/, test/, dev/ and the example snippets
./dev.sh build        # dist/ (SWC + tsc declarations)
./dev.sh pnpm lint    # ESLint; `pnpm format` / `pnpm format:check` for Prettier
./dev.sh pnpm test:pack       # pack, install into scratch projects, build an app with it
./dev.sh pnpm build:examples  # build and start every runnable example against the packed package
./dev.sh shell        # a shell in the container; ./dev.sh <cmd> runs any command
./dev.sh reset        # remove containers and volumes
```

`PORT=3100 ./dev.sh start` uses another host port. After changing the plugin's admin components or paths, run `./dev.sh pnpm generate:importmap`; after changing the dev collections, `./dev.sh pnpm generate:types`.

## The dev app

`dev/` is a Payload + Next app that uses the package by its name. It has a public `media` collection with three image sizes (one of a fixed shape), a `pages` collection with framed usages in a group (`hero`, exposed for headless use), an array (`gallery`), a block (`card`) and a localized upload field (`social`), and a `header` global with a framed `logo`; framed for three breakpoints (`dev/framing.ts`), in English and German. `DATABASE_URI` picks the database: SQLite (default, `dev/.data/`), `postgres://…` or `mongodb://…`. The frontend at `/` renders the pages with `frameImage()`, a plain `<img>` and the CSS helpers.

## Layout

| Path                 | Contents                                                                                                                        | May import                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/core/`          | Rects, `resolveFraming`, the framing algorithm (`visibleRect`, `objectPosition`), frame rules, breakpoints, labels, CSS helpers | Nothing but itself: runs in the browser              |
| `src/server/`        | `frameImage` and the signed crop tokens                                                                                         | `core/`, `node:crypto`                               |
| `src/payload/`       | `imageFramingPlugin`, fields, hooks, the crop endpoint, storages, i18n                                                          | `core/`, `server/`, `translations/`, `payload`, Node |
| `src/payload/admin/` | The admin components (`'use client'`)                                                                                           | `core/`, `translations/`, `react`, `@payloadcms/ui`  |
| `src/next/`          | `<FramedImage>`                                                                                                                 | `core/`, `server/`, `next`, `react`                  |
| `src/s3/`            | `s3FramingStorage`                                                                                                              | `@aws-sdk/client-s3`, `payload/storage` types        |
| `src/translations/`  | The admin texts (en, de)                                                                                                        | Nothing                                              |
| `src/exports/`       | Entry points that only re-export (`./server`, `./client`)                                                                       |                                                      |
| `dev/`               | The dev app, its integration and e2e tests                                                                                      | the package by its name                              |
| `test/unit/`         | Unit tests                                                                                                                      |                                                      |
| `test/int/`          | Integration tests with focused Payload configs (SQLite, an S3 server)                                                           |                                                      |
| `test/consumer/`     | A fresh Payload + Next app the pack test builds against the packed package                                                      |                                                      |
| `examples/`          | Example apps and snippets                                                                                                       | the package by its name                              |
| `site/`              | The showcase page on GitHub Pages: a Vite + React app with widgets that run `core`                                              | `core/` (from source)                                |
| `docs/images/`       | Screenshots and diagrams for the README and the showcase page                                                                   |                                                      |
| `scripts/`           | `pack-smoke.sh` (pack test), `build-examples.sh`                                                                                |                                                      |

`test/unit/imageFramingBoundary.spec.ts` checks the import rules above and that every admin module starts with `'use client'`. `test/unit/publicApi.spec.ts` snapshots every exported name of every entry point, so a change to the public API shows up in review, and checks that each has a doc comment.

The entry points are `.` (the plugin), `./core` (browser-safe), `./server` (uses the secret), `./client` (admin components, loaded through Payload's import map), `./next` and `./s3`. `./server` doesn't import `server-only`: it throws outside Next's server bundles, which would break the helpers in plain Node, tests or other frameworks.

## Tests

| Command               | What                                                                                                                                                          | Where                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `pnpm test`           | Unit tests                                                                                                                                                    | `test/unit/`                              |
| `pnpm test:int`       | Integration tests against a real Payload: the dev app's config on the database `DATABASE_URI` names (SQLite in a temp folder by default), and focused configs | `dev/framing.int.spec.ts`, `test/int/`    |
| `pnpm test:e2e`       | Playwright against the running dev app (`E2E_BASE_URL`, default `http://localhost:3000`)                                                                      | `dev/framing.e2e.spec.ts`                 |
| `pnpm test:pack`      | Pack, install into scratch projects (one without Next or Payload), build a Payload + Next app with it                                                         | `scripts/pack-smoke.sh`, `test/consumer/` |
| `pnpm build:examples` | Build and start every runnable example against the packed package                                                                                             | `scripts/build-examples.sh`               |
| `./dev.sh test-site`  | Build the showcase page and run Playwright against it, on a desktop and a phone                                                                               | `site/e2e/`                               |

CI (`.github/workflows/ci.yml`) runs on every pull request: lint, format check, typecheck, unit and SQLite integration tests and the build; unit tests on Node 20 and 22 too; the integration tests on SQLite, Postgres and MongoDB, each on the latest and the lowest supported Payload; the e2e tests; the cloud storage tests; the pack test on the latest and the lowest Payload; and the examples. `.github/workflows/pages.yml` builds and tests the showcase page on every pull request and deploys it from `main`. A weekly workflow runs the tests against Payload's latest release.

## The showcase page and screenshots

`site/` is the page at <https://wolffc.github.io/image-framing/>. `./dev.sh site` serves it on <http://localhost:5173/image-framing/> with hot reload. Its widgets import `@wolffc80/payload-image-framing/core` from `src/core/`, so they always show the current algorithm. The sample photos in `site/public/photos/` are drawings made for the project (CC0).

`./dev.sh screenshots` regenerates `docs/images/media-editor.png`, `usage-drawer.png` and `focus-editing.gif` from the dev app (`dev/screenshots.shot.ts`), with the sailboat drawing. Run it after a change to the admin UI.

## Pull requests

- One issue per pull request, on a branch `issue-<nr>-<short-description>`.
- Add tests for what you change.
- Add a changeset for anything a user of the package notices: `pnpm changeset` asks for the kind of change and a sentence for the changelog. Changes to tests, CI, the dev app or the docs site need none.
- Keep `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and the tests green.

## Releases

Releases are [Changesets](https://github.com/changesets/changesets) plus one workflow (`.github/workflows/release.yml`):

1. Pull requests bring changesets (`.changeset/*.md`).
2. On `main`, the release workflow opens or updates a **"Version packages"** pull request: it bumps the version, writes the changesets into `CHANGELOG.md` and deletes them. Pull requests opened by the workflow don't trigger CI (a GitHub rule); every change in it was tested in its own pull request.
3. Merging that pull request runs the workflow again, which publishes the new version (`pnpm release`, `scripts/release.mjs`): `changeset pack` builds and packs it with pnpm (which points the entry points at `dist/`), `npm publish` uploads the tarball. npm authenticates the workflow through **trusted publishing** (configured on npmjs.com for `release.yml`), so there is no npm token, and every version gets provenance. The workflow then tags the version and creates a GitHub release.

Until 1.0 the repository is in Changesets' pre mode (`.changeset/pre.json`): versions are `0.1.0-next.N` under the npm dist-tag `next`. For 1.0: `pnpm changeset pre exit`, then a changeset for 1.0.0.

Publishing by hand is only for emergencies: `pnpm publish` (never `npm publish` from the folder: npm ignores `publishConfig.exports`, and `prepublishOnly` refuses it), with the maintainer's 2FA.

The supported Payload versions and how they change are under "Compatibility" in the README.
