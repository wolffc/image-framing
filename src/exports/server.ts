/**
 * Server-only helpers: signing cropped-copy URLs and framing a media document
 * for rendering. They use the plugin's secret, so call them on the server only.
 */
export { cropToken, readCropToken } from '../core/cropToken.js'
export {
  cropUrl,
  DEFAULT_ROUTE_PREFIX,
  DEFAULT_VARIABLE,
  type FrameableMedia,
  type FramedImage,
  type FramedResource,
  frameImage,
  type FrameImageOptions,
} from '../next/frameImage.js'
