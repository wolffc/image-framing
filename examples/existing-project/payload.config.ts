import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: { importMap: { baseDir: dirname } },
  collections: [
    { slug: 'users', auth: true, fields: [] },
    {
      slug: 'media',
      // Public, as on any site: the pages and the crop route serve it to everyone.
      access: { read: () => true },
      fields: [{ name: 'alt', type: 'text' }],
      upload: {
        staticDir: 'media',
        mimeTypes: ['image/*'],
        imageSizes: [
          { name: 'thumbnail', width: 400 },
          { name: 'square', width: 600, height: 600 },
        ],
      },
    },
  ],
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./payload.db' } }),
  plugins: [imageFramingPlugin({ collections: ['media'] })],
  secret: process.env.PAYLOAD_SECRET as string,
  // The plugin crops and resizes with Payload's sharp.
  sharp,
})
