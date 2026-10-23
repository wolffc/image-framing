import type {
  CollectionAfterChangeHook,
  CollectionConfig,
  CollectionSlug,
  Config,
  ImageSize,
  PayloadRequest,
  Plugin,
} from 'payload'

import {
  DEFAULT_FRAMING,
  type DefaultBreakpoint,
  type Frame,
  type FramingConfig,
  type Label,
} from '../core/index.js'
import type { ImageFramingTranslations } from '../translations/index.js'

import { clearCacheAfterDelete, rebuildSizesAfterChange, validateFraming } from './hooks.js'
import { cropEndpoint } from './cropEndpoint.js'
import { dataNames, type FramingAccess, MEDIA_FIELD_NAMES, mediaFramingFields } from './fields.js'
import { withTranslations } from './i18n.js'
import { assertSharp } from './sharp.js'
import type { MediaDoc } from './sizes.js'
import { defaultStorage, type FramingStorageFactory } from './storage.js'
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
  {
    key: 'og',
    label: { en: 'Social (1200×630)', de: 'Social Media (1200×630)' },
    frame: { aspect: 1200 / 630 },
  },
]

export interface PreviewShape {
  key: string
  /** A string, or one per language: `{ en: 'Square', de: 'Quadrat' }`. */
  label: Label
  frame: Frame
}

/** Options that can be set for all framed collections and per collection. */
export interface CollectionFramingOptions {
  /** Shapes the media editor previews the framing in. Default: `DEFAULT_PREVIEW_SHAPES`. */
  previewShapes?: PreviewShape[]
  /**
   * File access for the size rebuild and the cropped copies. Default: the
   * collection's `staticDir` on local disk (`localDiskStorage`), or, with a
   * storage plugin (`disableLocalStorage`), reading through its handlers
   * without rebuilding sizes (`handlerStorage`). For S3, R2 or MinIO use
   * `s3FramingStorage` from `@wolffc/payload-image-framing/s3`.
   */
  storage?: FramingStorageFactory
  /**
   * Which generated image sizes are rebuilt from the crop after a change:
   * `true` all of them (default), `false` none (Payload's sizes stay made from
   * the whole photo, e.g. when only `frameImage` is used), or a list of size names.
   */
  rebuildSizes?: boolean | string[]
  /**
   * The cropped-copy endpoint, at `<api>/<collection>/crop/:id/:token/:filename`
   * by default. `false` leaves it out, e.g. when an image service crops from the
   * signed rect; `path` moves it (then pass `routePrefix` to `frameImage`), and
   * `cacheControl` replaces its `Cache-Control` header.
   */
  endpoint?: false | { path?: string; cacheControl?: string }
  /**
   * The longest side of a cropped copy in pixels; larger crops are scaled
   * down. Pass the same value to `frameImage`. Default: 4000.
   */
  maxSize?: number
  /** Field access for the added fields (crop, focus area, usage groups). Default: none. */
  access?: FramingAccess
}

export interface ImageFramingPluginOptions<
  K extends string = DefaultBreakpoint,
> extends CollectionFramingOptions {
  /**
   * Upload collections that get a crop and a focus area: a list of slugs, or
   * an object with per-collection options (`true` for the defaults), e.g.
   * `{ media: true, avatars: { previewShapes: [square], rebuildSizes: false } }`.
   * Per-collection options replace the plugin-wide ones.
   */
  collections: CollectionSlug[] | Partial<Record<CollectionSlug, true | CollectionFramingOptions>>
  /**
   * Signs the cropped-copy URLs. Defaults to the Payload config's `secret`;
   * pass the same value to `frameImage`. Changing it invalidates every cropped
   * URL rendered before: pages pick up new ones on their next render.
   */
  secret?: string
  /** Payload component path of the media editor. Default: the package's `FramingEditor`. */
  editorPath?: string
  /**
   * Upload fields that get their own crop and focus area, by path:
   * `<collection or global>.<field path>` or `block:<block slug>.<field path>`.
   */
  // NoInfer: only `framing` decides the breakpoint names, so a frame for an
  // undefined breakpoint is a type error rather than a new name.
  usages?: Record<string, UsageOptions<NoInfer<K>>>
  /**
   * The responsive breakpoints (`defineFraming`) the usage drawer previews,
   * one preview each. Pass the same config to `frameImage`. Default: `base`
   * and `md` from 768 px.
   */
  framing?: FramingConfig<K>
  /** Payload component path of the usage editor. Default: the package's `UsageFramingField`. */
  usageEditorPath?: string
  /**
   * Admin texts per language, merged over the shipped English and German
   * ones: override single texts, e.g. `{ en: { done: 'Close' } }`, or add a
   * language. Texts set in the Payload config's `i18n.translations` under
   * `imageFraming` win over both.
   */
  translations?: ImageFramingTranslations
  /**
   * Turns the plugin off but keeps its fields, so the database schema stays
   * the same (Payload plugin convention): no hooks, endpoint or editors.
   * Default: `false`.
   */
  disabled?: boolean
}

const withSizes = (imageSizes: ImageSize[], rebuild: boolean | string[]): ImageSize[] =>
  rebuild === true
    ? imageSizes
    : rebuild === false
      ? []
      : imageSizes.filter((size) => rebuild.includes(size.name))

/**
 * Non-destructive crop and focus areas for upload collections. Replaces
 * Payload's crop tool, which overwrites the original, with crop and focus rects
 * stored as data; generated sizes and cropped copies are made from them.
 */
export const imageFramingPlugin = <K extends string = DefaultBreakpoint>({
  collections,
  disabled = false,
  editorPath = DEFAULT_EDITOR_PATH,
  framing = DEFAULT_FRAMING as unknown as FramingConfig<K>,
  secret: secretOption,
  translations,
  usageEditorPath = DEFAULT_USAGE_EDITOR_PATH,
  usages = {},
  ...defaults
}: ImageFramingPluginOptions<K>): Plugin => {
  const perCollection: Record<string, CollectionFramingOptions> = Array.isArray(collections)
    ? Object.fromEntries(collections.map((slug) => [slug, {}]))
    : Object.fromEntries(
        Object.entries(collections).map(([slug, options]) => [
          slug,
          options === true ? {} : (options ?? {}),
        ]),
      )

  /** The size rebuild hook per collection, to move after the storage plugins' hooks. */
  const rebuildHooks = new Map<string, CollectionAfterChangeHook>()

  const withFraming = (collection: CollectionConfig, secret: string): CollectionConfig => {
    const slug = collection.slug as CollectionSlug
    if (!collection.upload) {
      throw new Error(`imageFraming: collection "${slug}" is not an upload collection`)
    }
    const taken = dataNames(collection.fields).filter((name) =>
      (MEDIA_FIELD_NAMES as readonly string[]).includes(name),
    )
    if (taken.length) {
      throw new Error(
        `imageFraming: collection "${slug}" already has a field ${taken.map((n) => `"${n}"`).join(', ')}; ` +
          `the plugin adds ${MEDIA_FIELD_NAMES.join(', ')}`,
      )
    }
    const {
      access,
      endpoint = {},
      maxSize,
      previewShapes = DEFAULT_PREVIEW_SHAPES,
      rebuildSizes = true,
      storage = defaultStorage,
    } = { ...defaults, ...perCollection[slug] }
    const upload = typeof collection.upload === 'object' ? collection.upload : {}
    // The collection as Payload runs it, with what storage plugins added after us.
    const files = (doc: MediaDoc, req: PayloadRequest) =>
      storage(req.payload.collections?.[slug]?.config ?? collection, doc, req)
    const rebuild = rebuildSizesAfterChange({
      imageSizes: withSizes(upload.imageSizes ?? [], rebuildSizes),
      storage: files,
    })
    rebuildHooks.set(slug, rebuild)

    const framed: CollectionConfig = {
      ...collection,
      // The original is never cropped or re-focused by Payload itself. Kept when
      // disabled: without image sizes, `focalPoint: false` drops focalX/focalY.
      upload: { ...upload, crop: false, focalPoint: false },
      fields: [
        ...collection.fields,
        ...mediaFramingFields({ access, editorPath: disabled ? null : editorPath, previewShapes }),
      ],
    }
    if (disabled) return framed

    return {
      ...framed,
      endpoints: [
        ...(collection.endpoints || []),
        ...(endpoint
          ? [cropEndpoint({ ...endpoint, collection: slug, maxSize, secret, storage: files })]
          : []),
      ],
      hooks: {
        ...collection.hooks,
        beforeValidate: [...(collection.hooks?.beforeValidate ?? []), validateFraming(slug)],
        afterChange: [...(collection.hooks?.afterChange ?? []), rebuild],
        afterDelete: [...(collection.hooks?.afterDelete ?? []), clearCacheAfterDelete(files)],
      },
    }
  }

  return (config: Config): Config => {
    const slugs = Object.keys(perCollection)
    const missing = slugs.filter((slug) => !config.collections?.some((c) => c.slug === slug))
    if (missing.length) {
      throw new Error(`imageFraming: no collection ${missing.map((s) => `"${s}"`).join(', ')}`)
    }
    if (!disabled) assertSharp(config)
    const secret = secretOption ?? config.secret
    if (!secret && !disabled) {
      throw new Error(
        'imageFraming: no secret; set `secret` in the plugin options or the Payload config',
      )
    }

    return addUsages(
      {
        ...config,
        i18n: withTranslations(config, translations),
        onInit: async (payload) => {
          // Storage plugins upload the original in their own afterChange hook,
          // which they add after ours when they come later in `plugins`. The
          // sizes must be rebuilt from the uploaded original, so run last.
          for (const [slug, hook] of rebuildHooks) {
            const hooks = payload.collections[slug as CollectionSlug]?.config.hooks?.afterChange
            const index = hooks?.indexOf(hook) ?? -1
            if (hooks && index >= 0 && index < hooks.length - 1) {
              hooks.splice(index, 1)
              hooks.push(hook)
            }
          }
          await config.onInit?.(payload)
        },
        collections: (config.collections ?? []).map((collection) =>
          slugs.includes(collection.slug) ? withFraming(collection, secret ?? '') : collection,
        ),
      },
      usages,
      {
        access: defaults.access,
        componentPath: disabled ? null : usageEditorPath,
        framedCollections: slugs,
        framing,
      },
    )
  }
}
