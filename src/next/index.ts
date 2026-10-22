/**
 * `@wolffc/payload-image-framing/next`: the place for Next.js-only helpers
 * (a `<FramedImage>` component is planned). `frameImage` has no Next
 * dependency and lives in `./server`; it is re-exported here for convenience.
 */
export {
  type FrameableMedia,
  type FramedImage,
  type FramedResource,
  frameImage,
  type FrameImageOptions,
} from '../server/frameImage.js'
