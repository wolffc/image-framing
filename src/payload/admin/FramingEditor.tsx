'use client'

import { FieldLabel, useFormFields } from '@payloadcms/ui'
import React from 'react'

// Not '../../core': its index also exports the URL signing, which needs Node's crypto.
import { FULL_RECT, resolveFraming } from '../../core/rect'

import { FramingCanvas } from './FramingCanvas'
import { type PreviewFrame, PreviewStrip } from './PreviewStrip'
import { useRect } from './useRect'

/**
 * Crop and focus area editor for a media document (#316). The crop area is
 * the part of the photo the site may ever show; the focus area is the part
 * every frame keeps in view where it can. Both are data: the original file is
 * never changed, so a crop can be widened again later.
 */
export const FramingEditor: React.FC<{ previewShapes?: PreviewFrame[] }> = ({ previewShapes = [] }) => {
  const url = useFormFields(([fields]) => fields.url?.value as string | undefined)
  const width = useFormFields(([fields]) => fields.width?.value as number | undefined)
  const height = useFormFields(([fields]) => fields.height?.value as number | undefined)
  const focalX = useFormFields(([fields]) => fields.focalX?.value as number | undefined)
  const focalY = useFormFields(([fields]) => fields.focalY?.value as number | undefined)
  const mimeType = useFormFields(([fields]) => fields.mimeType?.value as string | undefined)
  const cropField = useRect('crop')
  const focusField = useRect('focusArea')

  if (mimeType && !mimeType.startsWith('image/')) return null

  const { crop, focus } = resolveFraming({
    crop: cropField.stored,
    focusArea: focusField.stored,
    focalX,
    focalY,
  })

  return (
    <div className="field-type" data-image-framing-editor style={{ marginBottom: 'var(--spacing-field)' }}>
      <FieldLabel label="Crop and focus area" />
      <p style={{ color: 'var(--theme-elevation-500)', margin: '0 0 12px' }}>
        The <strong>crop area</strong> (solid frame) is the only part of the photo the site
        shows, in every size and shape. The <strong>focus area</strong> (dashed frame) is the
        subject: the site keeps it in view and away from text. The original file stays as it
        is, so you can widen the crop again later. Blocks can narrow this crop for themselves.
      </p>

      {url ? (
        <>
          <FramingCanvas
            crop={crop}
            focus={focus}
            limit={FULL_RECT}
            onChange={(next) => {
              cropField.set(next.crop)
              focusField.set(next.focus)
            }}
            url={url}
          />
          <button
            className="btn btn--style-secondary btn--size-small"
            onClick={() => {
              cropField.set(FULL_RECT)
              focusField.set(focus)
            }}
            style={{ marginTop: 12 }}
            type="button"
          >
            Show the whole photo
          </button>
          <PreviewStrip
            crop={crop}
            focus={focus}
            frames={previewShapes}
            image={{ height: height ?? 0, width: width ?? 0 }}
            url={url}
          />
        </>
      ) : (
        <p>Upload and save the photo first, then set its crop and focus area here.</p>
      )}
    </div>
  )
}
