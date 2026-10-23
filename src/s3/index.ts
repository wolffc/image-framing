/**
 * `@wolffc/payload-image-framing/s3`: framing storage on an S3-compatible
 * bucket (AWS S3, Cloudflare R2, MinIO, …), next to `@payloadcms/storage-s3`.
 * Needs `@aws-sdk/client-s3`, which `@payloadcms/storage-s3` installs.
 */
import path from 'node:path'

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'

import type { FramingStorage, FramingStorageFactory } from '../payload/storage.js'

export interface S3FramingStorageOptions {
  /** The bucket `@payloadcms/storage-s3` stores the collection in. */
  bucket: string
  /** The S3 client config, as passed to `s3Storage({ config })`. Ignored with `client`. */
  config?: S3ClientConfig
  /** An S3 client to use instead of making one from `config`. */
  client?: S3Client
  /** The collection's `prefix` option of `s3Storage`, if any. */
  prefix?: string
  /** `useCompositePrefixes` of `s3Storage`, if set. */
  useCompositePrefixes?: boolean
  /**
   * Where the cropped copies are cached in the bucket, under the collection's
   * slug. Default: `image-framing-cache`. Set a lifecycle rule on it if you
   * like; the plugin removes a document's copies when it changes or is deleted.
   */
  cachePrefix?: string
  /** ACL for written objects, e.g. 'public-read' as in `s3Storage({ acl })`. */
  acl?: 'private' | 'public-read'
}

const clean = (prefix: unknown) =>
  (typeof prefix === 'string' ? prefix : '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')

type StoredDoc = { _objectKey?: unknown; prefix?: unknown }

/**
 * The object key of a file of `doc`, as `@payloadcms/storage-s3` stores it:
 * the document's `prefix` (and `_objectKey`), or the collection's prefix.
 */
export const objectKey = (
  doc: StoredDoc,
  filename: string,
  {
    prefix,
    useCompositePrefixes,
  }: Pick<S3FramingStorageOptions, 'prefix' | 'useCompositePrefixes'> = {},
): string => {
  const docFolder = [clean(doc.prefix), clean(doc._objectKey)].filter(Boolean).join('/')
  return useCompositePrefixes
    ? path.posix.join(clean(prefix), docFolder, filename)
    : path.posix.join(docFolder || clean(prefix), filename)
}

const clients = new Map<string, S3Client>()

/**
 * Reads originals from and writes rebuilt sizes and cropped copies to the
 * bucket that `@payloadcms/storage-s3` uses, so sizes are rebuilt from the
 * crop with `disableLocalStorage` too.
 *
 * ```ts
 * const s3 = { bucket: process.env.S3_BUCKET!, config: { region, credentials } }
 * plugins: [
 *   s3Storage({ ...s3, collections: { media: true } }),
 *   imageFramingPlugin({ collections: ['media'], storage: s3FramingStorage(s3) }),
 * ]
 * ```
 */
export const s3FramingStorage = ({
  acl,
  bucket,
  cachePrefix = 'image-framing-cache',
  client,
  config = {},
  prefix,
  useCompositePrefixes,
}: S3FramingStorageOptions): FramingStorageFactory => {
  const s3 = () => {
    if (client) return client
    const key = `${bucket}:${JSON.stringify(config.endpoint ?? '')}:${String(config.region ?? '')}`
    if (!clients.has(key)) clients.set(key, new S3Client(config))
    return clients.get(key)!
  }

  const read = async (Key: string): Promise<Buffer | null> => {
    try {
      const { Body } = await s3().send(new GetObjectCommand({ Bucket: bucket, Key }))
      return Body ? Buffer.from(await Body.transformToByteArray()) : null
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name === 'NoSuchKey' || name === 'NotFound') return null
      throw error
    }
  }

  const write = (Key: string, Body: Buffer, ContentType?: string) =>
    s3().send(new PutObjectCommand({ ACL: acl, Body, Bucket: bucket, ContentType, Key }))

  return (collection, doc): FramingStorage => {
    const cache = path.posix.join(clean(cachePrefix), collection.slug)
    const key = (filename: string) =>
      objectKey(doc as StoredDoc, filename, { prefix, useCompositePrefixes })

    return {
      readOriginal: async (filename) => {
        const data = await read(key(filename))
        if (!data) throw new Error(`imageFraming: "${key(filename)}" is not in bucket "${bucket}"`)
        return data
      },
      writeSize: async (filename, data, mimeType) => {
        await write(key(filename), data, mimeType)
      },
      readCached: (name) => read(path.posix.join(cache, name)),
      writeCached: async (name, data) => {
        await write(path.posix.join(cache, name), data, doc.mimeType ?? undefined)
      },
      clearCached: async (namePrefix) => {
        let ContinuationToken: string | undefined
        do {
          const page = await s3().send(
            new ListObjectsV2Command({
              Bucket: bucket,
              ContinuationToken,
              Prefix: path.posix.join(cache, namePrefix),
            }),
          )
          const keys = (page.Contents ?? []).flatMap(({ Key }) => (Key ? [{ Key }] : []))
          if (keys.length) {
            await s3().send(
              new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }),
            )
          }
          ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
        } while (ContinuationToken)
      },
    }
  }
}
