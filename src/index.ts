/**
 * `@wolffc/payload-image-framing`: the Payload plugin. The framing model is in
 * `./core`, the render helpers in `./server` and the admin components in
 * `./client`.
 */
export {
  type CollectionFramingOptions,
  DEFAULT_CACHE_CONTROL,
  DEFAULT_EDITOR_PATH,
  DEFAULT_ENDPOINT_PATH,
  DEFAULT_PREVIEW_SHAPES,
  DEFAULT_USAGE_EDITOR_PATH,
  DEFAULT_USAGE_FIELD_NAME,
  type FramingAccess,
  type FramingStorage,
  imageFramingPlugin,
  type ImageFramingPluginOptions,
  localDiskStorage,
  type MediaDoc,
  type PreviewShape,
  type UsageOptions,
} from './payload/index.js'
