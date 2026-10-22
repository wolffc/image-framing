'use client'

import { Button, Drawer, useConfig, useDrawerSlug, useFormFields, useModal } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import {
  type BreakpointInfo,
  type FrameRule,
  FULL_RECT,
  isCompleteRect,
  resolveFraming,
  type StoredRect,
} from '../../core/index.js'

import { FramingCanvas } from './FramingCanvas.js'
import { usagePreviewFrames } from './previewFrames.js'
import { PreviewStrip } from './PreviewStrip.js'
import { useRect } from './useRect.js'

interface MediaDoc {
  crop?: StoredRect
  focalX?: number | null
  focalY?: number | null
  focusArea?: StoredRect
  height?: number | null
  url?: string | null
  width?: number | null
}

export interface UsageFramingFieldProps {
  /** Frame rules of this usage, matched against its sibling fields. */
  frames?: FrameRule<string>[]
  /** The breakpoints to preview, from the plugin's `framing` option. */
  breakpoints?: BreakpointInfo[]
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
 * One usage's own crop and focus area: a summary, and a drawer with the
 * editor (the whole photo, with the media's crop outlined as the default) and
 * a preview in the usage's frames.
 * Empty means "as on the media".
 */
export const UsageFramingField: React.FC<UsageFramingFieldProps> = ({
  breakpoints,
  frames: rules,
  path = '',
  relationTo,
  uploadField,
}) => {
  const groupPath = path.replace(/\.[^.]+$/, '')
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

  if (!mediaId) return null

  const custom = isCompleteRect(cropField.stored) || isCompleteRect(focusField.stored)
  const mediaFraming = media ? resolveFraming(media) : null
  const framing = media
    ? resolveFraming(media, { crop: cropField.stored, focusArea: focusField.stored })
    : null
  const previewFrames = usagePreviewFrames(rules, siblings, breakpoints)

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
          Adjust the framing here
        </Button>
        <span>
          <strong>{custom ? 'Custom framing' : 'Default framing'}</strong>{' '}
          <span style={{ color: 'var(--theme-elevation-500)' }}>
            {custom
              ? 'Uses its own crop and focus area here.'
              : 'Uses the crop and focus area set on the image.'}
          </span>
        </span>
      </div>

      <Drawer slug={drawerSlug} title="Framing for this usage">
        {/* Room below the buttons, so they don't sit on the window's edge when the drawer scrolls. */}
        <div data-image-framing-drawer style={{ paddingBottom: 48 }}>
          <p style={{ color: 'var(--theme-elevation-500)', marginTop: 0 }}>
            Set the crop and focus area for this usage only. The crop can be narrower or wider than
            the one set on the image (dotted outline), up to the whole photo. The preview shows the
            frames this usage shows the photo in, with the parts that text covers hatched.
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
            <p>Loading the image…</p>
          )}
          <div data-framing-actions style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="btn btn--style-primary btn--size-medium"
              onClick={() => closeModal(drawerSlug)}
              style={{ margin: 0 }}
              type="button"
            >
              Done
            </button>
            <button
              className="btn btn--style-secondary btn--size-medium"
              onClick={() => {
                cropField.clear()
                focusField.clear()
              }}
              style={{ margin: 0 }}
              type="button"
            >
              Use the image&apos;s framing
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
