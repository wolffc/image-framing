import type { Block, Config, Field, FieldHook, GroupField, UploadField } from 'payload'

import {
  type FrameRule,
  type FramingOverride,
  FULL_RECT,
  isCompleteRect,
  normalizeRect,
} from '../core/index.js'

import { rectField } from './fields.js'

/** What the site tells the plugin about one usage of an image. */
export interface UsageOptions {
  /** The frames the usage shows the photo in, for the admin preview. */
  frames?: FrameRule[]
}

const EMPTY = { x: null, y: null, width: null, height: null }

/**
 * Keeps a saved override inside the photo, and its focus area inside its crop.
 * The crop may be narrower or wider than the media's: that is only the default.
 */
const clampOverride: FieldHook = ({ value }) => {
  const override = value as FramingOverride
  if (!override) return value
  const crop = isCompleteRect(override.crop) ? normalizeRect(override.crop) : null
  const focusArea = isCompleteRect(override.focusArea)
    ? normalizeRect(override.focusArea, crop ?? FULL_RECT)
    : null
  return { ...override, crop: crop ?? EMPTY, focusArea: focusArea ?? EMPTY }
}

/** The `imageFraming` group added after a framed upload field. */
const overrideGroup = (
  field: UploadField,
  usage: UsageOptions,
  componentPath: string,
): GroupField => {
  const relationTo = field.relationTo as string
  const uploadCondition = field.admin?.condition
  return {
    name: 'imageFraming',
    type: 'group',
    label: false,
    admin: {
      // Shown with its image: an override without one would be invisible.
      condition: (data, siblingData, context) =>
        Boolean(siblingData?.[field.name]) &&
        (uploadCondition?.(data, siblingData, context) ?? true),
      hideGutter: true,
    },
    hooks: { beforeChange: [clampOverride] },
    fields: [
      {
        name: 'editor',
        type: 'ui',
        admin: {
          components: {
            Field: {
              clientProps: { frames: usage.frames ?? [], relationTo, uploadField: field.name },
              path: componentPath,
            },
          },
        },
      },
      rectField('crop', 'Crop area'),
      rectField('focusArea', 'Focus area'),
    ],
  }
}

/**
 * Adds an `imageFraming` override after every upload field listed in `usages`,
 * found by path: `<collection or global>.<field path>` (e.g. `pages.header.image`)
 * or `block:<block slug>.<field path>` (e.g. `block:card.image`). Unnamed tabs,
 * rows and collapsibles don't count in a path. Throws for a usage it cannot
 * find, so a renamed field doesn't silently lose its overrides.
 */
export const addUsages = (
  config: Config,
  usages: Record<string, UsageOptions>,
  componentPath: string,
): Config => {
  const found = new Set<string>()

  const walkBlock = (block: Block): Block => ({
    ...block,
    fields: walk(block.fields, `block:${block.slug}.`),
  })

  const walk = (fields: Field[], prefix: string): Field[] =>
    fields.flatMap((field): Field[] => {
      const named =
        'name' in field && typeof field.name === 'string' && field.name ? field.name : null
      const inner = named ? `${prefix}${named}.` : prefix

      if (field.type === 'upload' && named && typeof field.relationTo === 'string') {
        const usage = usages[`${prefix}${named}`]
        if (!usage) return [field]
        found.add(`${prefix}${named}`)
        return [field, overrideGroup(field, usage, componentPath)]
      }
      if (field.type === 'tabs') {
        return [
          {
            ...field,
            tabs: field.tabs.map((tab) => ({
              ...tab,
              fields: walk(
                tab.fields,
                'name' in tab && tab.name ? `${prefix}${tab.name}.` : prefix,
              ),
            })),
          },
        ]
      }
      if (field.type === 'blocks') {
        return [{ ...field, blocks: field.blocks.map(walkBlock) }]
      }
      if ('fields' in field && Array.isArray(field.fields)) {
        return [{ ...field, fields: walk(field.fields, inner) } as Field]
      }
      return [field]
    })

  const result: Config = {
    ...config,
    blocks: config.blocks?.map(walkBlock),
    collections: config.collections?.map((collection) => ({
      ...collection,
      fields: walk(collection.fields, `${collection.slug}.`),
    })),
    globals: config.globals?.map((global) => ({
      ...global,
      fields: walk(global.fields, `${global.slug}.`),
    })),
  }

  const missing = Object.keys(usages).filter((path) => !found.has(path))
  if (missing.length) {
    throw new Error(
      `imageFraming: no upload field found for usage ${missing.map((p) => `"${p}"`).join(', ')}`,
    )
  }
  return result
}
