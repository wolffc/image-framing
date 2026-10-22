import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * All file access of the plugin. The local-disk version works on the upload
 * collection's `staticDir`; a storage adapter (S3 etc.) only has to implement
 * these five calls.
 */
export interface FramingStorage {
  /** The uploaded original, which the plugin never changes. */
  readOriginal: (filename: string) => Promise<Buffer>
  /** Overwrites a generated image size. */
  writeSize: (filename: string, data: Buffer) => Promise<void>
  readCached: (key: string) => Promise<Buffer | null>
  writeCached: (key: string, data: Buffer) => Promise<void>
  /** Removes the cached copies whose key starts with `prefix`. */
  clearCached: (prefix: string) => Promise<void>
}

/** Keeps the cropped copies in `.crops/` next to the uploads, so a data export takes them along. */
export const localDiskStorage = ({
  cacheDir,
  staticDir,
}: {
  cacheDir?: string
  staticDir: string
}): FramingStorage => {
  const cache = cacheDir ?? path.join(staticDir, '.crops')
  // Names come from Payload or from a validated token, but never let one leave its directory.
  const inside = (dir: string, name: string) => {
    const file = path.resolve(dir, name)
    if (!file.startsWith(path.resolve(dir) + path.sep))
      throw new Error(`Invalid file name: ${name}`)
    return file
  }

  return {
    readOriginal: (filename) => fs.readFile(inside(staticDir, filename)),
    writeSize: (filename, data) => fs.writeFile(inside(staticDir, filename), data),
    readCached: async (key) => {
      try {
        return await fs.readFile(inside(cache, key))
      } catch {
        return null
      }
    },
    writeCached: async (key, data) => {
      await fs.mkdir(cache, { recursive: true })
      // Write and rename, so a parallel request never reads a half-written file.
      const file = inside(cache, key)
      const temp = `${file}.${process.pid}.${Date.now()}.tmp`
      await fs.writeFile(temp, data)
      await fs.rename(temp, file)
    },
    clearCached: async (prefix) => {
      const names = await fs.readdir(cache).catch(() => [] as string[])
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix))
          .map((name) => fs.rm(inside(cache, name), { force: true })),
      )
    },
  }
}
