import type { Field, GroupField } from 'payload'

/** A rect group (`x`, `y`, `width`, `height` in percent), edited through the framing editor. */
export const rectField = (name: string, label: string): GroupField => ({
  name,
  type: 'group',
  label,
  admin: { hidden: true },
  fields: (['x', 'y', 'width', 'height'] as const).map((key) => ({
    name: key,
    type: 'number',
    min: 0,
    max: 100,
  })),
})

/** The crop and focus area fields plus the editor that sets them. */
export const mediaFramingFields = (editorPath: string, previewShapes: unknown[]): Field[] => [
  {
    name: 'framing',
    type: 'ui',
    label: 'Crop and focus area',
    admin: { components: { Field: { clientProps: { previewShapes }, path: editorPath } } },
  },
  rectField('crop', 'Crop area'),
  rectField('focusArea', 'Focus area'),
]
