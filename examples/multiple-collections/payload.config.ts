import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'
import { buildConfig } from 'payload'
import sharp from 'sharp'

const square = { key: '1x1', label: { en: 'Square', de: 'Quadrat' }, frame: { aspect: 1 } }

export default buildConfig({
  routes: { api: '/cms' },
  collections: [
    {
      slug: 'photos',
      access: { read: () => true },
      fields: [{ name: 'alt', type: 'text' }],
      upload: {
        staticDir: 'photos',
        imageSizes: [
          { name: 'card', width: 800, height: 600 },
          { name: 'wide', width: 1600 },
        ],
      },
    },
    {
      slug: 'avatars',
      access: { read: () => true },
      fields: [],
      upload: { staticDir: 'avatars', imageSizes: [{ name: 'small', width: 96, height: 96 }] },
    },
    {
      slug: 'people',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'avatar', type: 'upload', relationTo: 'avatars' },
        { name: 'portrait', type: 'upload', relationTo: 'photos' },
      ],
    },
  ],
  plugins: [
    imageFramingPlugin({
      collections: {
        // The defaults: Payload's sizes rebuilt from the crop, the usual preview shapes.
        photos: true,
        avatars: {
          // Only square avatars: preview that shape, and keep cropped copies small.
          previewShapes: [square],
          maxSize: 512,
        },
      },
      usages: {
        'people.portrait': { frames: [{ when: {}, frames: { base: { aspect: 3 / 4 } } }] },
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET as string,
  sharp,
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./payload.db' } }),
})
