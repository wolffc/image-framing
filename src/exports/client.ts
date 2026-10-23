'use client'

/**
 * The admin components. Payload loads them by component path
 * (`@wolffc80/payload-image-framing/client#FramingEditor`), listed in the import
 * map that `payload generate:importmap` writes.
 */
export { FramingCanvas, type FramingCanvasProps } from '../payload/admin/FramingCanvas.js'
export { FramingEditor } from '../payload/admin/FramingEditor.js'
export { type PreviewFrame, PreviewStrip } from '../payload/admin/PreviewStrip.js'
export {
  UsageFramingField,
  type UsageFramingFieldProps,
} from '../payload/admin/UsageFramingField.js'
