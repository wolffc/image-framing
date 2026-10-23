# Cloud storage (S3, R2, MinIO)

The media files live in a bucket through `@payloadcms/storage-s3`. The framing
plugin rebuilds the image sizes from the crop and caches cropped copies in the
same bucket with `s3FramingStorage`.

```bash
npm i @payloadcms/storage-s3 @wolffc/payload-image-framing
```

```ts
// payload.config.ts
import { s3Storage } from '@payloadcms/storage-s3'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'
import { s3FramingStorage } from '@wolffc/payload-image-framing/s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

// The same bucket and client config for both plugins.
const s3 = {
  bucket: process.env.S3_BUCKET!,
  config: {
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    // R2, MinIO and other S3-compatible services:
    // endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
  },
}

export default buildConfig({
  sharp,
  collections: [Media],
  plugins: [
    s3Storage({ ...s3, collections: { media: true } }),
    imageFramingPlugin({
      collections: ['media'],
      // With a collection `prefix` in s3Storage, pass it here too: { ...s3, prefix: 'media' }
      storage: s3FramingStorage(s3),
    }),
  ],
  // …
})
```

- The plugin order doesn't matter: the plugin rebuilds the sizes after the
  storage plugin has uploaded the original.
- Cropped copies are cached under `image-framing-cache/<collection>/` in the
  bucket and removed when the media document changes or is deleted.
- With `clientUploads`, the browser uploads the original straight to the
  bucket; the plugin reads it from there.
- `frameImage` works unchanged as long as the media `url` is Payload's file
  route (`/api/media/file/…`, the default). With `disablePayloadAccessControl`
  the `url` points to the bucket: pass `routePrefix: '/api/media/crop'` to
  `frameImage`.
- Other storage adapters (`-gcs`, `-azure`, `-vercel-blob`, `-uploadthing`)
  work without a framing storage: the plugin reads the originals through the
  storage plugin and caches cropped copies on local disk, but it can't rewrite
  the image sizes in the bucket. Use `rebuildSizes: false` to silence the
  warning, or implement `FramingStorage` for the backend.
