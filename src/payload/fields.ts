import type { Field, FieldAccess, GroupField } from 'payload'

/** Field-level access for the fields the plugin adds (`crop`, `focusArea`, a usage's group). */
export interface FramingAccess {
  create?: FieldAccess
  read?: FieldAccess
  update?: FieldAccess
}

/** The names of the fields the plugin adds to a framed upload collection. */
export const MEDIA_FIELD_NAMES = ['framing', 'crop', 'focusArea'] as const

/** A rect group (`x`, `y`, `width`, `height` in percent), edited through the framing editor. */
export const rectField = (name: string, label: string, access?: FramingAccess): GroupField => ({
  name,
  type: 'group',
  label,
  ...(access ? { access } : {}),
  admin: { hidden: true },
  fields: (['x', 'y', 'width', 'height'] as const).map((key) => ({
    name: key,
    type: 'number',
    min: 0,
    max: 100,
  })),
})

/**
 * The crop and focus area fields plus the editor that sets them. Without the
 * editor (`editorPath: null`) only the data fields, e.g. when the plugin is
 * disabled and the schema must stay the same.
 */
export const mediaFramingFields = ({
  access,
  editorPath,
  previewShapes,
}: {
  access?: FramingAccess
  editorPath: string | null
  previewShapes: unknown[]
}): Field[] => [
  ...(editorPath
    ? [
        {
          name: 'framing',
          type: 'ui',
          label: 'Crop and focus area',
          admin: { components: { Field: { clientProps: { previewShapes }, path: editorPath } } },
        } satisfies Field,
      ]
    : []),
  rectField('crop', 'Crop area', access),
  rectField('focusArea', 'Focus area', access),
]

/**
 * The names stored on the same level as `fields`, looking through unnamed
 * rows, collapsibles and tabs, which don't nest the data.
 */
export const dataNames = (fields: Field[]): string[] =>
  fields.flatMap((field): string[] => {
    if ('name' in field && typeof field.name === 'string' && field.name) return [field.name]
    if (field.type === 'tabs') {
      return field.tabs.flatMap((tab) =>
        'name' in tab && tab.name ? [tab.name] : dataNames(tab.fields),
      )
    }
    if ('fields' in field && Array.isArray(field.fields)) return dataNames(field.fields)
    return []
  })
