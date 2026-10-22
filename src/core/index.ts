/**
 * `@wolffc/payload-image-framing/core`: the framing model and algorithm, in
 * plain TypeScript. No Payload, React, Next or Node imports, so it runs in the
 * browser, on the server and in tests unchanged.
 */
export {
  type CoverArea,
  type Frame,
  type FrameRule,
  type Frames,
  matchFrames,
  objectPosition,
  previewPlacement,
  visibleRect,
  type VisibleRectInput,
} from './frame.js'
export {
  DEFAULT_FOCUS_SIZE,
  defaultFocusArea,
  type Framing,
  type FramingOverride,
  type FramingSource,
  FULL_RECT,
  isCompleteRect,
  isFullRect,
  isRectInside,
  MIN_SIZE,
  normalizeRect,
  type Rect,
  rectCentre,
  relativeRect,
  resolveFraming,
  type StoredRect,
} from './rect.js'
