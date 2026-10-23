# Several upload collections and a custom API route

Two framed collections with their own options, an API under `/cms`, and the
crop route that follows them without options:
[`payload.config.ts`](payload.config.ts).

- `collections` as an object: per-collection `previewShapes`, `rebuildSizes`,
  `maxSize`, `storage`, `endpoint` and `access`, over the plugin-wide ones.
- `frameImage` derives the crop route from each media document's `url`:
  `/cms/photos/file/beach.jpg` gives `/cms/photos/crop/…`, an avatar's
  `/cms/avatars/crop/…`. Allow both in `next.config`:

  ```js
  images: {
    localPatterns: [
      { pathname: '/cms/photos/file/**' }, { pathname: '/cms/photos/crop/**' },
      { pathname: '/cms/avatars/file/**' }, { pathname: '/cms/avatars/crop/**' },
    ],
  }
  ```
