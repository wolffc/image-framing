/**
 * `@wolffc/payload-image-framing/next`: Next.js helpers. `<FramedImage>`
 * renders a framed image with `next/image` in a server component.
 * `frameImage` has no Next dependency and lives in `./server`; it is
 * re-exported here for convenience.
 */
export { FramedImage, type FramedImageProps } from './FramedImage.js'
export {
  type FrameableMedia,
  type FrameImageResult,
  type FramedResource,
  frameImage,
  type FrameImageOptions,
} from '../server/frameImage.js'
