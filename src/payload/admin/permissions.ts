'use client'

import type { SanitizedDocumentPermissions } from 'payload'

type Flags = { create?: true; read?: true; update?: true }
type FieldPermissions =
  (Flags & { blocks?: Record<string, BlockPermissions>; fields?: FieldsPermissions }) | true
type FieldsPermissions = Record<string, FieldPermissions> | true
type BlockPermissions = { fields?: FieldsPermissions } | true

export interface FieldAccessResult {
  read: boolean
  edit: boolean
}

/**
 * What the user may do with the field at `path` (e.g. `layout.0.imageFraming`),
 * from Payload's sanitized document permissions, where every denied flag is
 * left out and `true` grants everything below. A field can only be edited when
 * the document and every field on the way can. Unknown permissions allow
 * everything: the server enforces access either way.
 *
 * The plugin's editors are UI fields, which have no access of their own, so
 * they follow the fields they edit this way.
 */
export const fieldAccess = (
  permissions: SanitizedDocumentPermissions | null | undefined,
  path: string,
  {
    blockTypeAt = () => undefined,
    isNew,
  }: {
    /** The block type of the blocks row at a path like `layout.0`. */
    blockTypeAt?: (rowPath: string) => string | undefined
    isNew: boolean
  },
): FieldAccessResult => {
  if (!permissions) return { edit: true, read: true }
  // Globals have no `create`: they always exist.
  const doc = permissions as Flags & { fields: FieldsPermissions }
  let edit = Boolean(isNew ? doc.create : doc.update)
  let read = true

  let fields: FieldsPermissions = doc.fields
  let field: FieldPermissions | undefined
  const segments = path.split('.')
  for (const [index, segment] of segments.entries()) {
    if (/^\d+$/.test(segment)) {
      // A row of the array or blocks field just passed.
      if (field && field !== true) {
        const blockType = blockTypeAt(segments.slice(0, index + 1).join('.'))
        const block = blockType ? field.blocks?.[blockType] : undefined
        fields = block === true ? true : (block?.fields ?? field.fields ?? true)
      }
      continue
    }
    if (fields === true) return { edit, read }
    field = fields[segment]
    if (field === true) return { edit, read }
    if (!field) return { edit: false, read: false }
    read &&= Boolean(field.read)
    edit &&= Boolean(isNew ? field.create : field.update)
    fields = field.fields ?? true
  }
  return { edit: edit && read, read }
}
