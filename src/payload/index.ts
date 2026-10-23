/**
 * The Payload side of image framing: the plugin, its options and the storage
 * interface. The admin components are in `../exports/client.ts`.
 */
export { DEFAULT_CACHE_CONTROL, DEFAULT_ENDPOINT_PATH } from './cropEndpoint.js'
export { type FramingAccess } from './fields.js'
export {
  type CollectionFramingOptions,
  DEFAULT_EDITOR_PATH,
  DEFAULT_PREVIEW_SHAPES,
  DEFAULT_USAGE_EDITOR_PATH,
  imageFramingPlugin,
  type ImageFramingPluginOptions,
  type PreviewShape,
} from './plugin.js'
export type { MediaDoc } from './sizes.js'
export {
  diskCache,
  type FramingStorage,
  type FramingStorageFactory,
  handlerStorage,
  localDiskStorage,
} from './storage.js'
export { DEFAULT_USAGE_FIELD_NAME, type ExposedFraming, type UsageOptions } from './usages.js'
