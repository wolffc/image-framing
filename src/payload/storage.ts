import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { CollectionConfig, PayloadRequest } from 'payload'

import type { MediaDoc } from './sizes.js'

/**
 * All file access of the plugin: reading the original, overwriting the
 * generated sizes and caching cropped copies. `localDiskStorage` works on the
 * collection's `staticDir`, `s3FramingStorage` (`./s3`) on an S3-compatible
 * bucket; other backends implement these calls.
 */
export interface FramingStorage {
  /** The uploaded original, which the plugin never changes. */
  readOriginal: (filename: string) => Promise<Buffer>
  /**
   * Overwrites a generated image size. Without it the plugin can't rebuild
   * the sizes from the crop: it leaves them as Payload made them and warns.
   */
  writeSize?: (filename: string, data: Buffer, mimeType?: string) => Promise<void>
  readCached: (key: string) => Promise<Buffer | null>
  writeCached: (key: string, data: Buffer) => Promise<void>
  /** Removes the cached copies whose key starts with `prefix`. */
  clearCached: (prefix: string) => Promise<void>
}

/**
 * Makes the storage for one media document. `collection` is the collection's
 * config as Payload runs it, so it includes what storage plugins added
 * (`upload.handlers`, `disableLocalStorage`), whatever the plugin order.
 */
export type FramingStorageFactory = (
  collection: CollectionConfig,
  doc: MediaDoc,
  req: PayloadRequest,
) => FramingStorage

// Names come from Payload or from a validated token, but never let one leave its directory.
const inside = (dir: string, name: string) => {
  const file = path.resolve(dir, name)
  if (!file.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Invalid file name: ${name}`)
  return file
}

/** The cropped-copy cache in a local directory. */
export const diskCache = (
  dir: string,
): Pick<FramingStorage, 'clearCached' | 'readCached' | 'writeCached'> => ({
  readCached: async (key) => {
    try {
      return await fs.readFile(inside(dir, key))
    } catch {
      return null
    }
  },
  writeCached: async (key, data) => {
    await fs.mkdir(dir, { recursive: true })
    // Write and rename, so a parallel request never reads a half-written file.
    const file = inside(dir, key)
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(temp, data)
    await fs.rename(temp, file)
  },
  clearCached: async (prefix) => {
    const names = await fs.readdir(dir).catch(() => [] as string[])
    await Promise.all(
      names
        .filter((name) => name.startsWith(prefix))
        .map((name) => fs.rm(inside(dir, name), { force: true })),
    )
  },
})

/** Keeps the cropped copies in `.crops/` next to the uploads, so a data export takes them along. */
export const localDiskStorage = ({
  cacheDir,
  staticDir,
}: {
  cacheDir?: string
  staticDir: string
}): FramingStorage => ({
  readOriginal: (filename) => fs.readFile(inside(staticDir, filename)),
  writeSize: (filename, data) => fs.writeFile(inside(staticDir, filename), data),
  ...diskCache(cacheDir ?? path.join(staticDir, '.crops')),
})

type UploadHandler = (
  req: PayloadRequest,
  args: { doc?: unknown; params: { collection: string; filename: string } },
) => Promise<Response | void> | Response | void

/**
 * Reads originals through the collection's upload handlers, the way Payload
 * serves them: works with every storage adapter (`@payloadcms/storage-*`
 * registers its `staticHandler` there). It can't write, so the sizes aren't
 * rebuilt; cropped copies are cached on local disk, by default in the
 * system's temp directory.
 */
export const handlerStorage = ({
  cacheDir,
  collection,
  doc,
  req,
}: {
  cacheDir?: string
  collection: CollectionConfig
  doc?: MediaDoc
  req: PayloadRequest
}): FramingStorage => ({
  readOriginal: async (filename) => {
    const upload = typeof collection.upload === 'object' ? collection.upload : {}
    for (const handler of (upload.handlers ?? []) as UploadHandler[]) {
      const response = await handler(req, {
        doc,
        params: { collection: collection.slug, filename },
      })
      if (response instanceof Response && response.ok) {
        return Buffer.from(await response.arrayBuffer())
      }
    }
    throw new Error(`imageFraming: no upload handler of "${collection.slug}" serves "${filename}"`)
  },
  ...diskCache(cacheDir ?? path.join(os.tmpdir(), 'payload-image-framing', collection.slug)),
})

/**
 * The default: the collection's `staticDir`, or, when a storage plugin keeps
 * the files elsewhere (`disableLocalStorage`), reading through its handlers.
 */
export const defaultStorage: FramingStorageFactory = (collection, doc, req) => {
  const upload = typeof collection.upload === 'object' ? collection.upload : {}
  if (upload.disableLocalStorage) return handlerStorage({ collection, doc, req })
  const staticDir = upload.staticDir
  if (!staticDir) throw new Error(`imageFraming: collection "${collection.slug}" has no staticDir`)
  return localDiskStorage({ staticDir })
}
