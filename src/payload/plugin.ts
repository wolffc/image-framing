import type { CollectionConfig, CollectionSlug, Config, Plugin } from 'payload'

import type { Frame } from '../core/index.js'

import { clearCacheAfterDelete, rebuildSizesAfterChange, validateFraming } from './hooks.js'
import { cropEndpoint } from './cropEndpoint.js'
import { mediaFramingFields } from './fields.js'
import type { MediaDoc } from './sizes.js'
import { type FramingStorage, localDiskStorage } from './storage.js'
import { addUsages, type UsageOptions } from './usages.js'

/**
 * Where the admin editors live, as Payload component paths. They resolve
 * through the import map, so run `payload generate:importmap` after installing.
 */
export const DEFAULT_EDITOR_PATH = '@wolffc/payload-image-framing/client#FramingEditor'
export const DEFAULT_USAGE_EDITOR_PATH = '@wolffc/payload-image-framing/client#UsageFramingField'

/** The frame shapes the media editor previews: the shapes sites commonly crop to. */
export const DEFAULT_PREVIEW_SHAPES: PreviewShape[] = [
  { key: '16x9', label: '16:9', frame: { aspect: 16 / 9 } },
  { key: '3x2', label: '3:2', frame: { aspect: 3 / 2 } },
  { key: '4x3', label: '4:3', frame: { aspect: 4 / 3 } },
  { key: '21x9', label: '21:9', frame: { aspect: 21 / 9 } },
  { key: '4x5', label: '4:5', frame: { aspect: 4 / 5 } },
  { key: '1x1', label: '1:1', frame: { aspect: 1 } },
  { key: 'og', label: 'Social (1200×630)', frame: { aspect: 1200 / 630 } },
]

export interface PreviewShape {
  key: string
  label: string
  frame: Frame
}

export interface ImageFramingPluginOptions {
  /** Upload collections that get a crop and a focus area. */
  collections: CollectionSlug[]
  /** Signs the cropped-copy URLs. Use the same value for `frameImage`. */
  secret: string
  editorPath?: string
  /** Upload fields that get their own crop and focus area, by path; see `addUsages`. */
  usages?: Record<string, UsageOptions>
  usageEditorPath?: string
  /** Shapes the media editor previews the framing in. */
  previewShapes?: PreviewShape[]
  /** File access per collection; the default reads and writes the collection's `staticDir`. */
  storage?: (collection: CollectionConfig, doc: MediaDoc) => FramingStorage
}

const defaultStorage = (collection: CollectionConfig): FramingStorage => {
  const staticDir =
    collection.upload && typeof collection.upload === 'object' && collection.upload.staticDir
  if (!staticDir) throw new Error(`imageFraming: collection "${collection.slug}" has no staticDir`)
  return localDiskStorage({ staticDir })
}

/**
 * Non-destructive crop and focus areas for upload collections (#316). Replaces
 * Payload's crop tool, which overwrites the original, with crop and focus rects
 * stored as data; generated sizes and cropped copies are made from them.
 */
export const imageFramingPlugin = ({
  collections,
  editorPath = DEFAULT_EDITOR_PATH,
  previewShapes = DEFAULT_PREVIEW_SHAPES,
  secret,
  storage = defaultStorage,
  usageEditorPath = DEFAULT_USAGE_EDITOR_PATH,
  usages = {},
}: ImageFramingPluginOptions): Plugin => {
  const withFraming = (collection: CollectionConfig): CollectionConfig => {
    const slug = collection.slug as CollectionSlug
    if (!collection.upload) {
      throw new Error(`imageFraming: collection "${slug}" is not an upload collection`)
    }
    const upload = typeof collection.upload === 'object' ? collection.upload : {}
    const files = (doc: MediaDoc) => storage(collection, doc)

    return {
      ...collection,
      // The original is never cropped or re-focused by Payload itself.
      upload: { ...upload, crop: false, focalPoint: false },
      fields: [...collection.fields, ...mediaFramingFields(editorPath, previewShapes)],
      endpoints: [
        ...(collection.endpoints || []),
        cropEndpoint({ collection: slug, secret, storage: files }),
      ],
      hooks: {
        ...collection.hooks,
        beforeValidate: [...(collection.hooks?.beforeValidate ?? []), validateFraming(slug)],
        afterChange: [
          ...(collection.hooks?.afterChange ?? []),
          rebuildSizesAfterChange({ imageSizes: upload.imageSizes ?? [], storage: files }),
        ],
        afterDelete: [...(collection.hooks?.afterDelete ?? []), clearCacheAfterDelete(files)],
      },
    }
  }

  return (config: Config): Config =>
    addUsages(
      {
        ...config,
        collections: (config.collections ?? []).map((collection) =>
          collections.includes(collection.slug as CollectionSlug)
            ? withFraming(collection)
            : collection,
        ),
      },
      usages,
      usageEditorPath,
    )
}
