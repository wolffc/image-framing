/**
 * The Payload side of image framing: the plugin, its options and the storage
 * interface. The admin components are in `../exports/client.ts`.
 */
export { CROP_ENDPOINT_PATH } from './cropEndpoint.js'
export {
  DEFAULT_EDITOR_PATH,
  DEFAULT_PREVIEW_SHAPES,
  DEFAULT_USAGE_EDITOR_PATH,
  imageFramingPlugin,
  type ImageFramingPluginOptions,
  type PreviewShape,
} from './plugin.js'
export type { MediaDoc } from './sizes.js'
export { type FramingStorage, localDiskStorage } from './storage.js'
export type { UsageOptions } from './usages.js'
