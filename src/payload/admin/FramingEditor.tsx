'use client'

import { FieldLabel, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React from 'react'

import { type Frame, FULL_RECT, isFramable, type Label, resolveFraming } from '../../core/index.js'

import { FramingCanvas } from './FramingCanvas.js'
import { fieldAccess } from './permissions.js'
import { RichText, useFramingTranslation } from './i18n.js'
import { PreviewStrip } from './PreviewStrip.js'
import { useRect } from './useRect.js'

/** A shape the media editor previews, as the plugin's `previewShapes` option gives it. */
interface PreviewShapeProp {
  key: string
  label: Label
  frame: Frame
}

/**
 * Crop and focus area editor for a media document. The crop area is
 * the part of the photo the site may ever show; the focus area is the part
 * every frame keeps in view where it can. Both are data: the original file is
 * never changed, so a crop can be widened again later.
 */
export const FramingEditor: React.FC<{
  previewShapes?: PreviewShapeProp[]
  readOnly?: boolean
}> = ({ previewShapes = [], readOnly: readOnlyProp = false }) => {
  const { docPermissions, id } = useDocumentInfo()
  const { label, t } = useFramingTranslation()
  const url = useFormFields(([fields]) => fields.url?.value as string | undefined)
  const width = useFormFields(([fields]) => fields.width?.value as number | undefined)
  const height = useFormFields(([fields]) => fields.height?.value as number | undefined)
  const focalX = useFormFields(([fields]) => fields.focalX?.value as number | undefined)
  const focalY = useFormFields(([fields]) => fields.focalY?.value as number | undefined)
  const mimeType = useFormFields(([fields]) => fields.mimeType?.value as string | undefined)
  const cropField = useRect('crop')
  const focusField = useRect('focusArea')

  // The editor is a UI field without access of its own: it follows the crop field's.
  const access = fieldAccess(docPermissions, 'crop', { isNew: !id })
  if (!access.read || (mimeType && !mimeType.startsWith('image/'))) return null
  if (!isFramable(mimeType)) {
    return (
      <div
        className="field-type"
        data-image-framing-editor
        style={{ marginBottom: 'var(--spacing-field)' }}
      >
        <FieldLabel label={t('cropAndFocusArea')} />
        <p style={{ color: 'var(--theme-elevation-500)', margin: 0 }}>{t('notFramable')}</p>
      </div>
    )
  }
  const readOnly = readOnlyProp || !access.edit

  const { crop, focus } = resolveFraming({
    crop: cropField.stored,
    focusArea: focusField.stored,
    focalX,
    focalY,
  })

  return (
    <div
      className="field-type"
      data-image-framing-editor
      style={{ marginBottom: 'var(--spacing-field)' }}
    >
      <FieldLabel label={t('cropAndFocusArea')} />
      <p style={{ color: 'var(--theme-elevation-500)', margin: '0 0 12px' }}>
        <RichText text={t('editorIntro')} />
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
            readOnly={readOnly}
            url={url}
          />
          {!readOnly && (
            <button
              className="btn btn--style-secondary btn--size-small"
              onClick={() => {
                cropField.set(FULL_RECT)
                focusField.set(focus)
              }}
              style={{ marginTop: 12 }}
              type="button"
            >
              {t('showWholePhoto')}
            </button>
          )}
          <PreviewStrip
            crop={crop}
            focus={focus}
            frames={previewShapes.map((shape) => ({ ...shape, label: label(shape.label) }))}
            image={{ height: height ?? 0, width: width ?? 0 }}
            url={url}
          />
        </>
      ) : (
        <p>{t('uploadFirst')}</p>
      )}
    </div>
  )
}
