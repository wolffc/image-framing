import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import { imageFramingPlugin } from '@wolffc/payload-image-framing'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { database } from './db.js'
import { cardFrames, framing, heroFrames } from './framing.js'
import { devUser } from './helpers/credentials.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET || 'dev-secret-change-me'

// The integration tests point these at a temporary directory.
const dataDir = process.env.DATA_DIR || path.resolve(dirname, '.data')
const mediaDir = process.env.MEDIA_DIR || path.resolve(dirname, 'media')

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
      // Public, as on a site: the frontend and the crop route serve it to anyone.
      access: { read: () => true },
      fields: [{ name: 'alt', type: 'text' }],
      upload: {
        staticDir: mediaDir,
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
        // An image per locale, with its own framing per locale.
        {
          name: 'social',
          type: 'group',
          fields: [{ name: 'image', type: 'upload', relationTo: 'media', localized: true }],
        },
        {
          name: 'gallery',
          type: 'array',
          fields: [
            { name: 'caption', type: 'text' },
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
  globals: [{ slug: 'header', fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }] }],
  // English and German, the languages the plugin ships: switch in the account settings.
  i18n: { supportedLanguages: { de, en } },
  localization: { defaultLocale: 'en', locales: ['en', 'de'] },
  db: database(dataDir),
  onInit: seed,
  plugins: [
    imageFramingPlugin({
      collections: ['media'],
      framing,
      usages: {
        'pages.hero.image': { frames: heroFrames },
        'block:card.image': { frames: cardFrames },
        'pages.gallery.image': { frames: cardFrames },
        'pages.social.image': { frames: [{ when: {}, frames: { base: { aspect: 1200 / 630 } } }] },
        'header.logo': {},
      },
    }),
  ],
  secret,
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
