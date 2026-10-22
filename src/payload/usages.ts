import type { Block, Config, Field, FieldHook, GroupField, UploadField } from 'payload'

import {
  type DefaultBreakpoint,
  type FrameRule,
  type FramingConfig,
  type FramingOverride,
  FULL_RECT,
  isCompleteRect,
  normalizeRect,
} from '../core/index.js'

import { dataNames, type FramingAccess, rectField } from './fields.js'

/** What the site tells the plugin about one usage of an image. */
export interface UsageOptions<K extends string = DefaultBreakpoint> {
  /**
   * The frames the usage shows the photo in, per breakpoint, for the admin
   * preview: the first rule whose `when` matches the sibling fields.
   */
  frames?: FrameRule<K>[]
  /**
   * Name of the group that stores the usage's crop and focus area, next to the
   * upload field. Default: `imageFraming`. Pass the group's value to
   * `frameImage({ override })`.
   */
  name?: string
  /** Names the usage in the admin, e.g. 'Header image': the drawer's title. */
  label?: string
  admin?: {
    /** Shown under the usage's framing summary and in its drawer. */
    description?: string
  }
  /** Field access for the usage's group. Default: the plugin's `access`. */
  access?: FramingAccess
}

/** The default name of a usage's group. */
export const DEFAULT_USAGE_FIELD_NAME = 'imageFraming'

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

/** The group added after a framed upload field, `imageFraming` by default. */
const overrideGroup = (
  field: UploadField,
  usage: UsageOptions<string>,
  { access, componentPath, framing }: UsageContext,
): GroupField => {
  const relationTo = field.relationTo as string
  const uploadCondition = field.admin?.condition
  const groupAccess = usage.access ?? access
  return {
    name: usage.name ?? DEFAULT_USAGE_FIELD_NAME,
    type: 'group',
    label: false,
    ...(groupAccess ? { access: groupAccess } : {}),
    admin: {
      // Shown with its image: an override without one would be invisible.
      condition: (data, siblingData, context) =>
        Boolean(siblingData?.[field.name]) &&
        (uploadCondition?.(data, siblingData, context) ?? true),
      hideGutter: true,
    },
    ...(componentPath ? { hooks: { beforeChange: [clampOverride] } } : {}),
    fields: [
      ...(componentPath
        ? [
            {
              name: 'editor',
              type: 'ui',
              admin: {
                components: {
                  Field: {
                    clientProps: {
                      breakpoints: framing.breakpoints,
                      description: usage.admin?.description,
                      frames: usage.frames ?? [],
                      label: usage.label,
                      relationTo,
                      uploadField: field.name,
                    },
                    path: componentPath,
                  },
                },
              },
            } satisfies Field,
          ]
        : []),
      rectField('crop', 'Crop area'),
      rectField('focusArea', 'Focus area'),
    ],
  }
}

interface UsageContext {
  /** Default field access for the groups. */
  access?: FramingAccess
  /** The usage editor; null leaves out the editor and the hooks (plugin disabled). */
  componentPath: string | null
  framing: FramingConfig<string>
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
  usages: Record<string, UsageOptions<string>>,
  {
    framedCollections,
    ...context
  }: UsageContext & {
    /** Slugs of the collections with framing: a usage must upload to one of them. */
    framedCollections: string[]
  },
): Config => {
  const { framing } = context
  const names = framing.breakpoints.map((breakpoint) => breakpoint.name)
  for (const [path, usage] of Object.entries(usages)) {
    for (const rule of usage.frames ?? []) {
      const unknown = Object.keys(rule.frames).filter((name) => !names.includes(name))
      if (unknown.length) {
        throw new Error(
          `imageFraming: usage "${path}" has frames for ${unknown.map((n) => `"${n}"`).join(', ')}, ` +
            `which the framing breakpoints (${names.join(', ')}) don't define`,
        )
      }
    }
  }
  const found = new Set<string>()

  const walkBlock = (block: Block): Block => ({
    ...block,
    fields: walk(block.fields, `block:${block.slug}.`, dataNames(block.fields)),
  })

  /** `level`: the names stored next to `fields`, which a usage's group must not take. */
  const walk = (fields: Field[], prefix: string, level: string[]): Field[] =>
    fields.flatMap((field): Field[] => {
      const named =
        'name' in field && typeof field.name === 'string' && field.name ? field.name : null
      const inner = named ? `${prefix}${named}.` : prefix

      if (field.type === 'upload' && named) {
        const path = `${prefix}${named}`
        const usage = usages[path]
        if (!usage) return [field]
        found.add(path)
        if (typeof field.relationTo !== 'string' || field.hasMany) {
          throw new Error(
            `imageFraming: usage "${path}" must be a single upload field with one relationTo`,
          )
        }
        if (!framedCollections.includes(field.relationTo)) {
          throw new Error(
            `imageFraming: usage "${path}" uploads to "${field.relationTo}", which has no image ` +
              `framing; add it to the plugin's collections`,
          )
        }
        const groupName = usage.name ?? DEFAULT_USAGE_FIELD_NAME
        if (level.includes(groupName)) {
          throw new Error(
            `imageFraming: usage "${path}" adds a field "${groupName}" next to the upload field, ` +
              `but one exists there already; pick another with the usage's \`name\` option`,
          )
        }
        return [field, overrideGroup(field, usage, context)]
      }
      if (field.type === 'tabs') {
        return [
          {
            ...field,
            tabs: field.tabs.map((tab) => ({
              ...tab,
              fields:
                'name' in tab && tab.name
                  ? walk(tab.fields, `${prefix}${tab.name}.`, dataNames(tab.fields))
                  : walk(tab.fields, prefix, level),
            })),
          },
        ]
      }
      if (field.type === 'blocks') {
        return [{ ...field, blocks: field.blocks.map(walkBlock) }]
      }
      if ('fields' in field && Array.isArray(field.fields)) {
        const innerLevel = named ? dataNames(field.fields) : level
        return [{ ...field, fields: walk(field.fields, inner, innerLevel) } as Field]
      }
      return [field]
    })

  const result: Config = {
    ...config,
    blocks: config.blocks?.map(walkBlock),
    collections: config.collections?.map((collection) => ({
      ...collection,
      fields: walk(collection.fields, `${collection.slug}.`, dataNames(collection.fields)),
    })),
    globals: config.globals?.map((global) => ({
      ...global,
      fields: walk(global.fields, `${global.slug}.`, dataNames(global.fields)),
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
