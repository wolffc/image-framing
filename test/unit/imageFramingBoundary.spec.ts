// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The layers of the package and what each may import, so every entry point
 * stays usable where it is meant to run:
 *
 * - `core/` runs anywhere (browser included): it imports nothing but itself.
 * - `server/` signs URLs with the secret: core and `node:crypto`, nothing that
 *   ties it to Payload, React or Next.
 * - `payload/` (the plugin): core, server, `payload` and Node; not `sharp`
 *   (it uses `config.sharp`), not the admin components, which Payload loads by
 *   path, and not React.
 * - `payload/admin/` (the client entry): core, React and `@payloadcms/ui`;
 *   types from `payload`; nothing from Node, `sharp` or the server layer.
 * - `next/`: core, server, `next` and React.
 */

const srcDir = path.resolve(import.meta.dirname, '../../src')

interface Layer {
  /** Files of the layer, relative to src/. */
  files: (file: string) => boolean
  /** Directories (relative to src/, with a trailing slash) it may import from. */
  local: string[]
  /** Packages it may import at runtime. */
  packages: (spec: string) => boolean
  /** Packages it may import types from. */
  typePackages?: (spec: string) => boolean
}

const isNode = (spec: string) => spec.startsWith('node:')

const layers: Record<string, Layer> = {
  core: { files: (f) => f.startsWith('core/'), local: ['core/'], packages: () => false },
  // The admin texts: plain data.
  translations: {
    files: (f) => f.startsWith('translations/'),
    local: ['translations/'],
    packages: () => false,
  },
  server: {
    files: (f) => f.startsWith('server/') || f === 'exports/server.ts',
    local: ['core/', 'server/'],
    packages: (spec) => spec === 'node:crypto',
  },
  plugin: {
    files: (f) => (f.startsWith('payload/') && !f.startsWith('payload/admin/')) || f === 'index.ts',
    local: ['core/', 'server/', 'payload/', 'translations/'],
    // Not sharp: the plugin uses Payload's instance (`config.sharp`).
    packages: (spec) => spec === 'payload' || isNode(spec),
  },
  client: {
    files: (f) => f.startsWith('payload/admin/') || f === 'exports/client.ts',
    local: ['core/', 'payload/admin/', 'translations/'],
    packages: (spec) => spec === 'react' || spec === '@payloadcms/ui',
    typePackages: (spec) => spec === 'payload',
  },
  next: {
    files: (f) => f.startsWith('next/'),
    local: ['core/', 'server/', 'next/'],
    packages: (spec) => spec === 'react' || spec === 'next' || spec.startsWith('next/'),
  },
}

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })

interface Import {
  spec: string
  typeOnly: boolean
}

const importsOf = (file: string): Import[] =>
  [
    ...fs
      .readFileSync(file, 'utf8')
      .matchAll(
        /(?:^|\n)\s*(import|export)(\s+type)?\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
      ),
  ].map((match) => ({
    spec: match[3] ?? match[4] ?? match[5],
    typeOnly: Boolean(match[2]),
  }))

const files = sourceFiles(srcDir).map((file) =>
  path.relative(srcDir, file).split(path.sep).join('/'),
)

const layerOf = (file: string) => Object.entries(layers).find(([, layer]) => layer.files(file))?.[0]

describe('package layers', () => {
  it('puts every source file in exactly one layer', () => {
    const unassigned = files.filter((file) => !layerOf(file))
    const ambiguous = files.filter(
      (file) => Object.values(layers).filter((layer) => layer.files(file)).length > 1,
    )

    expect(files.length).toBeGreaterThan(0)
    expect(unassigned).toEqual([])
    expect(ambiguous).toEqual([])
  })

  it.each(Object.keys(layers))('keeps the %s layer to its imports', (name) => {
    const layer = layers[name]
    const offending = files
      .filter((file) => layer.files(file))
      .flatMap((file) =>
        importsOf(path.join(srcDir, file))
          .filter(({ spec, typeOnly }) => {
            if (spec.startsWith('.')) {
              const target = path
                .relative(srcDir, path.resolve(srcDir, path.dirname(file), spec))
                .split(path.sep)
                .join('/')
              if (target.startsWith('..')) return true
              return !layer.local.some((dir) => target.startsWith(dir)) || isAdmin(name, target)
            }
            if (layer.packages(spec)) return false
            return !(typeOnly && layer.typePackages?.(spec))
          })
          .map(({ spec }) => `${file}: ${spec}`),
      )

    expect(offending).toEqual([])
  })

  it("marks every client module with 'use client'", () => {
    const missing = files
      .filter((file) => layerOf(file) === 'client')
      .filter(
        (file) => !fs.readFileSync(path.join(srcDir, file), 'utf8').startsWith("'use client'"),
      )

    expect(missing).toEqual([])
  })
})

/** The plugin may import from payload/ but not from payload/admin/. */
const isAdmin = (layer: string, target: string) =>
  layer === 'plugin' && target.startsWith('payload/admin/')
