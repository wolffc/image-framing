/**
 * `@wolffc/payload-image-framing/server`: signing cropped-copy URLs and
 * framing a media document for rendering. Both use the plugin's secret, so
 * import this entry in server code only. It needs `node:crypto`, so a bundle
 * for the browser that pulls it in fails to build instead of leaking the secret.
 */
export { cropToken, readCropToken, type TokenContext } from '../server/cropToken.js'
export {
  cropRoutePrefix,
  cropUrl,
  type CropUrlOptions,
  DEFAULT_VARIABLE,
  type FrameableMedia,
  type FramedImage,
  type FramedResource,
  frameImage,
  type FrameImageOptions,
} from '../server/frameImage.js'
