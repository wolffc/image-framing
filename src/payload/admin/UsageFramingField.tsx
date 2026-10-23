'use client'

import {
  Button,
  Drawer,
  useConfig,
  useDocumentInfo,
  useDrawerSlug,
  useFormFields,
  useModal,
} from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import {
  type BreakpointInfo,
  type Label,
  type FrameRule,
  FULL_RECT,
  isCompleteRect,
  isFramable,
  resolveFraming,
  type StoredRect,
} from '../../core/index.js'

import { FramingCanvas } from './FramingCanvas.js'
import { fieldAccess } from './permissions.js'
import { RichText, useFramingTranslation } from './i18n.js'
import { usagePreviewFrames } from './previewFrames.js'
import { PreviewStrip } from './PreviewStrip.js'
import { useRect } from './useRect.js'

interface MediaDoc {
  crop?: StoredRect
  focalX?: number | null
  focalY?: number | null
  focusArea?: StoredRect
  height?: number | null
  mimeType?: string | null
  url?: string | null
  width?: number | null
}

/** Props of `UsageFramingField`, set by the plugin (`clientProps`) and by Payload. */
export interface UsageFramingFieldProps {
  /** Frame rules of this usage, matched against its sibling fields. */
  frames?: FrameRule<string>[]
  /** The breakpoints to preview, from the plugin's `framing` option. */
  breakpoints?: BreakpointInfo[]
  /** The usage's `label` option: the drawer's title. */
  label?: Label
  /** The usage's `admin.description`. */
  description?: Label
  /** Set by Payload, e.g. for a locked document. */
  readOnly?: boolean
  /** The upload collection the image comes from. */
  relationTo: string
  /** Name of the sibling upload field. */
  uploadField: string
  /** Set by Payload: this field's path, e.g. `header.imageFraming.editor`. */
  path?: string
}

/**
 * The values of the fields directly under `prefix`, e.g. a `layout` select next to the image.
 * Selected as a string, so the field only re-renders when one of them changes.
 */
const useSiblingValues = (prefix: string): Record<string, unknown> => {
  const json = useFormFields(([fields]) => {
    const values: Record<string, unknown> = {}
    for (const [path, field] of Object.entries(fields)) {
      const name = path.startsWith(prefix) ? path.slice(prefix.length) : ''
      if (name && !name.includes('.')) values[name] = field.value
    }
    return JSON.stringify(values)
  })
  return JSON.parse(json) as Record<string, unknown>
}

/**
 * The block types of the rows on `path` (e.g. `layout.0` in
 * `layout.0.imageFraming`), for looking up block permissions. Selected as a
 * string, so the field only re-renders when one changes.
 */
const useBlockTypes = (path: string): Record<string, string | undefined> => {
  const segments = path.split('.')
  const rows = segments.flatMap((segment, index) =>
    /^\d+$/.test(segment) ? [segments.slice(0, index + 1).join('.')] : [],
  )
  const json = useFormFields(([fields]) =>
    JSON.stringify(
      Object.fromEntries(rows.map((row) => [row, fields[`${row}.blockType`]?.value as string])),
    ),
  )
  return JSON.parse(json) as Record<string, string | undefined>
}

/**
 * One usage's own crop and focus area: a summary, and a drawer with the
 * editor (the whole photo, with the media's crop outlined as the default) and
 * a preview in the usage's frames.
 * Empty means "as on the media".
 */
export const UsageFramingField: React.FC<UsageFramingFieldProps> = ({
  breakpoints,
  description,
  frames: rules,
  label,
  path = '',
  readOnly: readOnlyProp = false,
  relationTo,
  uploadField,
}) => {
  const groupPath = path.replace(/\.[^.]+$/, '')
  // The editor is a UI field without access of its own: it follows its group's.
  const { docPermissions, id } = useDocumentInfo()
  const { breakpointLabel, label: text, t } = useFramingTranslation()
  const blockTypes = useBlockTypes(groupPath)
  const access = fieldAccess(docPermissions, groupPath, {
    blockTypeAt: (rowPath) => blockTypes[rowPath],
    isNew: !id,
  })
  const readOnly = readOnlyProp || !access.edit
  const siblingPrefix = groupPath.includes('.') ? groupPath.replace(/[^.]+$/, '') : ''
  const cropField = useRect(`${groupPath}.crop`)
  const focusField = useRect(`${groupPath}.focusArea`)
  const mediaId = useFormFields(([fields]) => {
    const value = fields[`${siblingPrefix}${uploadField}`]?.value as
      { id?: unknown } | number | string | null
    return value && typeof value === 'object' ? value.id : value
  })
  const siblings = useSiblingValues(siblingPrefix)
  const { config } = useConfig()
  const { closeModal, openModal } = useModal()
  const drawerSlug = useDrawerSlug(`image-framing-${groupPath}`)
  // Keyed by id, so a stale document never shows after the image was swapped.
  const [loaded, setLoaded] = useState<{ doc: MediaDoc | null; id: unknown } | null>(null)
  const media = loaded && loaded.id === mediaId ? loaded.doc : null

  useEffect(() => {
    if (!mediaId) return
    let cancelled = false
    fetch(`${config.serverURL}${config.routes.api}/${relationTo}/${mediaId}?depth=0`, {
      credentials: 'include',
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((doc: MediaDoc | null) => {
        if (!cancelled) setLoaded({ doc, id: mediaId })
      })
    return () => {
      cancelled = true
    }
  }, [config.routes.api, config.serverURL, mediaId, relationTo])

  if (!mediaId || !access.read) return null
  if (media && !isFramable(media.mimeType)) {
    return (
      <p className="field-description" data-image-framing-usage style={{ margin: 0 }}>
        {t('notFramable')}
      </p>
    )
  }

  const custom = isCompleteRect(cropField.stored) || isCompleteRect(focusField.stored)
  const mediaFraming = media ? resolveFraming(media) : null
  const framing = media
    ? resolveFraming(media, { crop: cropField.stored, focusArea: focusField.stored })
    : null
  const previewFrames = usagePreviewFrames(rules, siblings, {
    breakpointLabel,
    breakpoints,
    sameAs: (name) => t('sameAs', { label: name }),
  })

  return (
    // Pulled up by half a field gap, so the row reads as part of the image above it.
    <div
      className="field-type"
      data-image-framing-usage
      style={{ marginTop: 'calc(var(--spacing-field) / -2)' }}
    >
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
        <Button
          buttonStyle="pill"
          margin={false}
          onClick={() => openModal(drawerSlug)}
          size="small"
        >
          {t(readOnly ? 'showHere' : 'adjustHere')}
        </Button>
        <span>
          <strong>{t(custom ? 'customFraming' : 'defaultFraming')}</strong>{' '}
          <span style={{ color: 'var(--theme-elevation-500)' }}>
            {t(custom ? 'usesOwn' : 'usesImage')}
          </span>
        </span>
      </div>
      {description && (
        <p className="field-description" style={{ margin: '4px 0 0' }}>
          {text(description)}
        </p>
      )}

      <Drawer slug={drawerSlug} title={label ? text(label) : t('usageTitle')}>
        {/* Room below the buttons, so they don't sit on the window's edge when the drawer scrolls. */}
        <div data-image-framing-drawer style={{ paddingBottom: 48 }}>
          {description && <p style={{ marginTop: 0 }}>{text(description)}</p>}
          <p style={{ color: 'var(--theme-elevation-500)', marginTop: 0 }}>
            <RichText text={t('usageIntro')} />
          </p>
          {media?.url && framing && mediaFraming ? (
            <>
              <FramingCanvas
                crop={framing.crop}
                focus={framing.focus}
                limit={FULL_RECT}
                reference={mediaFraming.crop}
                onChange={(next) => {
                  cropField.set(next.crop)
                  focusField.set(next.focus)
                }}
                readOnly={readOnly}
                url={media.url}
              />
              <PreviewStrip
                crop={framing.crop}
                focus={framing.focus}
                frames={previewFrames}
                image={{ height: media.height ?? 0, width: media.width ?? 0 }}
                url={media.url}
              />
            </>
          ) : (
            <p>{t('loadingImage')}</p>
          )}
          <div data-framing-actions style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="btn btn--style-primary btn--size-medium"
              onClick={() => closeModal(drawerSlug)}
              style={{ margin: 0 }}
              type="button"
            >
              {t('done')}
            </button>
            {!readOnly && (
              <button
                className="btn btn--style-secondary btn--size-medium"
                onClick={() => {
                  cropField.clear()
                  focusField.clear()
                }}
                style={{ margin: 0 }}
                type="button"
              >
                {t('useImageFraming')}
              </button>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  )
}
