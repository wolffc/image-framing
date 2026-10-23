# Quick start

One media collection with crop and focus areas, and a page that shows the
posts' photos in a 16:9 frame with `<FramedImage>` (`next/image`).

```bash
cp .env.example .env
npm install
npx payload generate:importmap
npm run dev
```

Open http://localhost:3000/admin, create a user, upload a photo to **Media**,
set its crop area (solid frame) and focus area (dashed frame), and use it in a
**Post**. http://localhost:3000 shows the posts: the photo is cut to the crop
area, and the 16:9 frame keeps the focus area in view.

What it takes, in `payload.config.ts`:

- `sharp` in the config: the plugin crops and resizes with it.
- `imageFramingPlugin({ collections: ['media'] })`: the media get a crop area,
  a focus area and an editor; Payload's own (destructive) crop tool is off.
- `npx payload generate:importmap` after installing, so the admin finds the
  editors.
- With Postgres or another SQL adapter: `npx payload migrate:create` for the
  new fields.

And in `next.config.mjs`, `images.localPatterns` for `/api/media/file/**` and
`/api/media/crop/**`, where the cropped copies come from.
