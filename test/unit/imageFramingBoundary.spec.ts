// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The image framing module (#316) is meant to become a package of its own, so
 * it may not reach into the site: no `@/…` imports and no relative imports out
 * of the module. Its `core/` layer is plain TypeScript that runs anywhere, so
 * it imports nothing but itself and Node's crypto.
 */

const moduleDir = path.resolve(__dirname, '../../src/plugins/imageFraming')

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })

const importsOf = (file: string): string[] =>
  [
    ...fs
      .readFileSync(file, 'utf8')
      .matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1] ?? match[2])

const files = fs.existsSync(moduleDir) ? sourceFiles(moduleDir) : []

describe('image framing module boundary', () => {
  it('has the core, payload and next layers', () => {
    for (const layer of ['core', 'payload', 'next']) {
      expect(fs.existsSync(path.join(moduleDir, layer, 'index.ts')), layer).toBe(true)
    }
  })

  it('imports nothing from the site', () => {
    const offending = files.flatMap((file) =>
      importsOf(file)
        .filter(
          (spec) =>
            spec.startsWith('@/') ||
            (spec.startsWith('.') &&
              !path.resolve(path.dirname(file), spec).startsWith(moduleDir + path.sep)),
        )
        .map((spec) => `${path.relative(moduleDir, file)}: ${spec}`),
    )

    expect(offending).toEqual([])
  })

  it('keeps core free of Payload, React and Next', () => {
    const coreDir = path.join(moduleDir, 'core') + path.sep
    const offending = files
      .filter((file) => file.startsWith(coreDir))
      .flatMap((file) =>
        importsOf(file)
          .filter((spec) => !spec.startsWith('.') && spec !== 'node:crypto')
          .map((spec) => `${path.relative(moduleDir, file)}: ${spec}`),
      )

    expect(files.length).toBeGreaterThan(0)
    expect(offending).toEqual([])
  })

  it('keeps next free of Payload', () => {
    const nextDir = path.join(moduleDir, 'next') + path.sep
    const offending = files
      .filter((file) => file.startsWith(nextDir))
      .flatMap((file) =>
        importsOf(file)
          .filter((spec) => spec === 'payload' || spec.startsWith('@payloadcms/'))
          .map((spec) => `${path.relative(moduleDir, file)}: ${spec}`),
      )

    expect(offending).toEqual([])
  })
})
