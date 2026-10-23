# Adding the plugin to an existing project

What changes when you add `imageFramingPlugin` to a project that already has
media, and two optional scripts.

```bash
cp .env.example .env
npm install
npx payload generate:importmap
npm run dev
```

## What happens to existing media

- **Nothing breaks without a backfill.** Media without rects are treated as the
  whole photo, with a focus area of 30 % around Payload's focal point (`focalX`/
  `focalY`, the centre if unset). The rects are stored on the next save.
- **Payload's own crop tool is turned off** (`upload.crop: false`,
  `upload.focalPoint: false`), since it overwrites the original. Photos cropped
  with it before stay cropped: the cut-off parts are gone from the file, and
  the plugin can only crop further.
- **The image sizes are rebuilt from the crop area** when a crop or focus area
  changes. Until then, they stay as Payload made them, from the whole photo,
  which is what the default crop shows anyway.

## Database

The plugin adds the `crop` and `focusArea` groups to the media collection and
an `imageFraming` group after every configured usage. With Postgres or SQLite
in production, create a migration after adding the plugin:

```bash
npx payload migrate:create image-framing
npx payload migrate
```

MongoDB needs no migration.

## Scripts

- `scripts/backfill.ts` stores the default rects on every media document that
  has none (optional): `npx payload run scripts/backfill.ts`.
- `scripts/regenerate-sizes.ts` rebuilds every media document's image sizes
  from its crop, e.g. after adding an image size:
  `npx payload run scripts/regenerate-sizes.ts`. It saves each document with
  `context: { imageFraming: { rebuild: true } }`, which makes the plugin rebuild
  the sizes even though nothing changed.

With many media, run them outside peak hours: each document reads its original
and writes every size.
