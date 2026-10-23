import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { cardFrames, framing, heroFrames } from './framing.js'
import { devUser } from './helpers/credentials.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'

// SQLite does not create the directory of its database file.
fs.mkdirSync(path.resolve(dirname, '.data'), { recursive: true })

export default buildConfig({
  admin: {
    autoLogin: process.env.NODE_ENV === 'development' ? devUser : false,
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, 'app/(payload)/admin/importMap.js'),
    },
    user: 'users',
  },
  collections: [
    { slug: 'users', auth: true, fields: [] },
    {
      slug: 'media',
      fields: [{ name: 'alt', type: 'text' }],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
        mimeTypes: ['image/*'],
        imageSizes: [
          { name: 'thumbnail', width: 400 },
          { name: 'square', width: 600, height: 600 },
          { name: 'og', width: 1200, height: 630 },
        ],
      },
    },
    {
      slug: 'pages',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'hero',
          type: 'group',
          fields: [
            {
              name: 'layout',
              type: 'select',
              defaultValue: 'fullBleed',
              options: [
                { label: 'Full bleed, text on the left', value: 'fullBleed' },
                { label: 'Split', value: 'split' },
              ],
            },
            { name: 'heading', type: 'text' },
            { name: 'image', type: 'upload', relationTo: 'media' },
          ],
        },
        {
          name: 'layout',
          type: 'blocks',
          blocks: [
            {
              slug: 'card',
              fields: [
                { name: 'heading', type: 'text' },
                { name: 'image', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
      ],
    },
  ],
  // English and German, the languages the plugin ships: switch in the account settings.
  i18n: { supportedLanguages: { de, en } },
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || `file:${path.resolve(dirname, '.data/dev.db')}` },
  }),
  onInit: seed,
  plugins: [
    imageFramingPlugin({
      collections: ['media'],
      framing,
      usages: {
        'pages.hero.image': { frames: heroFrames },
        'block:card.image': { frames: cardFrames },
      },
    }),
  ],
  secret,
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
