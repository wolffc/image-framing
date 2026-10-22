'use client'

import { useField } from '@payloadcms/ui'

import type { Rect, StoredRect } from '../../core/index.js'

const KEYS = ['x', 'y', 'width', 'height'] as const

/** The four number fields of a rect group at `path`, as a stored rect, plus setters. */
export const useRect = (path: string) => {
  const fields = {
    x: useField<number | null>({ path: `${path}.x` }),
    y: useField<number | null>({ path: `${path}.y` }),
    width: useField<number | null>({ path: `${path}.width` }),
    height: useField<number | null>({ path: `${path}.height` }),
  }
  const stored: StoredRect = {
    x: fields.x.value,
    y: fields.y.value,
    width: fields.width.value,
    height: fields.height.value,
  }
  const write = (rect: Rect | null) => {
    for (const key of KEYS) {
      const value = rect ? rect[key] : null
      if (fields[key].value !== value) fields[key].setValue(value)
    }
  }
  return { clear: () => write(null), set: (rect: Rect) => write(rect), stored }
}
