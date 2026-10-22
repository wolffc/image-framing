/**
 * `@wolffc/payload-image-framing`: the Payload plugin. The framing model is in
 * `./core`, the render helpers in `./server` and the admin components in
 * `./client`.
 */
export {
  CROP_ENDPOINT_PATH,
  DEFAULT_EDITOR_PATH,
  DEFAULT_PREVIEW_SHAPES,
  DEFAULT_USAGE_EDITOR_PATH,
  type FramingStorage,
  imageFramingPlugin,
  type ImageFramingPluginOptions,
  localDiskStorage,
  type MediaDoc,
  type PreviewShape,
  type UsageOptions,
} from './payload/index.js'
