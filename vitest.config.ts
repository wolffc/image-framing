import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

const root = import.meta.dirname
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, { import: string }>
  name: string
}

// The package by its name, as the dev app imports it: the entries' sources.
const alias = Object.entries(pkg.exports)
  .map(([entry, { import: source }]) => ({
    find: new RegExp(`^${pkg.name}${entry === '.' ? '' : entry.slice(1)}$`),
    replacement: path.join(root, source),
  }))
  .sort((a, b) => b.find.source.length - a.find.source.length)

// The integration tests run the dev app's config on a fresh SQLite file and
// media folder, unless DATABASE_URI names another database (CI: Postgres, MongoDB).
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'image-framing-int-'))

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['test/unit/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'int',
          include: ['test/int/**/*.spec.ts', 'dev/**/*.int.spec.ts'],
          env: {
            DATA_DIR: path.join(scratch, 'data'),
            MEDIA_DIR: path.join(scratch, 'media'),
            PAYLOAD_SECRET: 'int-test-secret',
          },
          // Payload pushes the schema on the first start, which takes a while on CI.
          hookTimeout: 120_000,
          testTimeout: 60_000,
          // One Payload per file at a time: they share the database.
          fileParallelism: false,
        },
      },
    ],
  },
})
