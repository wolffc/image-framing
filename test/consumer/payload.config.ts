import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { imageFramingPlugin } from '@wolffc80/payload-image-framing'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = 'consumer-app-secret'

// The plugin with its defaults: the editors come from the package's ./client
// entry through the import map, without editorPath options.
export default buildConfig({
  admin: { importMap: { baseDir: dirname } },
  collections: [
    { slug: 'users', auth: true, fields: [] },
    { slug: 'media', fields: [], upload: { staticDir: path.resolve(dirname, 'media') } },
    { slug: 'pages', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
  ],
  db: sqliteAdapter({ client: { url: `file:${path.resolve(dirname, 'consumer.db')}` } }),
  plugins: [imageFramingPlugin({ collections: ['media'], secret, usages: { 'pages.image': {} } })],
  secret,
  sharp,
})
