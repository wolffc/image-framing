import type { CollectionConfig, CollectionSlug, Config, Plugin } from 'payload'

import { clearCacheAfterDelete, rebuildSizesAfterChange, validateFraming } from './hooks'
import { cropEndpoint } from './cropEndpoint'
import { mediaFramingFields } from './fields'
import type { MediaDoc } from './sizes'
import { type FramingStorage, localDiskStorage } from './storage'

/**
 * Where the admin editor lives, as a Payload component path relative to
 * `admin.importMap.baseDir`. Pass your own when the module sits elsewhere.
 */
export const DEFAULT_EDITOR_PATH = '/plugins/imageFraming/payload/admin/FramingEditor#FramingEditor'

export interface ImageFramingPluginOptions {
  /** Upload collections that get a crop and a focus area. */
  collections: CollectionSlug[]
  /** Signs the cropped-copy URLs. Use the same value for `frameImage`. */
  secret: string
  editorPath?: string
  /** File access per collection; the default reads and writes the collection's `staticDir`. */
  storage?: (collection: CollectionConfig, doc: MediaDoc) => FramingStorage
}

const defaultStorage = (collection: CollectionConfig): FramingStorage => {
  const staticDir = collection.upload && typeof collection.upload === 'object' && collection.upload.staticDir
  if (!staticDir) throw new Error(`imageFraming: collection "${collection.slug}" has no staticDir`)
  return localDiskStorage({ staticDir })
}

/**
 * Non-destructive crop and focus areas for upload collections (#316). Replaces
 * Payload's crop tool, which overwrites the original, with crop and focus rects
 * stored as data; generated sizes and cropped copies are made from them.
 */
export const imageFramingPlugin =
  ({
    collections,
    editorPath = DEFAULT_EDITOR_PATH,
    secret,
    storage = defaultStorage,
  }: ImageFramingPluginOptions): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: (config.collections ?? []).map((collection) => {
      const slug = collection.slug as CollectionSlug
      if (!collections.includes(slug)) return collection
      if (!collection.upload) {
        throw new Error(`imageFraming: collection "${collection.slug}" is not an upload collection`)
      }
      const upload = typeof collection.upload === 'object' ? collection.upload : {}
      const files = (doc: MediaDoc) => storage(collection, doc)

      return {
        ...collection,
        // The original is never cropped or re-focused by Payload itself.
        upload: { ...upload, crop: false, focalPoint: false },
        fields: [...collection.fields, ...mediaFramingFields(editorPath)],
        endpoints: [
          ...(collection.endpoints || []),
          cropEndpoint({ collection: slug, secret, storage: files }),
        ],
        hooks: {
          ...collection.hooks,
          beforeValidate: [...(collection.hooks?.beforeValidate ?? []), validateFraming(collection.slug)],
          afterChange: [
            ...(collection.hooks?.afterChange ?? []),
            rebuildSizesAfterChange({ imageSizes: upload.imageSizes ?? [], storage: files }),
          ],
          afterDelete: [...(collection.hooks?.afterDelete ?? []), clearCacheAfterDelete(files)],
        },
      }
    }),
  })
