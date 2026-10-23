import type {
  Block,
  CollectionSlug,
  Config,
  Field,
  FieldHook,
  GroupField,
  UploadField,
} from 'payload'

import {
  type DefaultBreakpoint,
  type FrameRule,
  type FramingConfig,
  type FramingOverride,
  type Label,
  matchFrames,
  type Rect,
  FULL_RECT,
  isCompleteRect,
  normalizeRect,
} from '../core/index.js'

import { type FrameableMedia, frameImage } from '../server/frameImage.js'

import { dataNames, type FramingAccess, rectField } from './fields.js'
import { fieldLabel } from './i18n.js'

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
  /**
   * Names the usage in the admin, e.g. 'Header image' or `{ en: 'Header image',
   * de: 'Kopfbild' }`: the drawer's title.
   */
  label?: Label
  admin?: {
    /** Shown under the usage's framing summary and in its drawer; a string or one per language. */
    description?: Label
  }
  /** Field access for the usage's group. Default: the plugin's `access`. */
  access?: FramingAccess
  /**
   * For frontends that only see the REST or GraphQL API: adds a virtual
   * field next to the upload field (`<field>Framed`, or `expose.name`) with
   * what `frameImage` returns for this usage (`url`, `width`, `height`, `alt`,
   * `style` with the positions, `focus`), computed on the server with the
   * frames of the matching rule, so the secret stays in the CMS. Costs one
   * extra query per read when the upload isn't populated (`depth: 0`).
   */
  expose?: boolean | { name?: string }
}

/** What an exposed usage's virtual field holds. */
export interface ExposedFraming {
  alt?: string | null
  url: string
  width?: number | null
  height?: number | null
  mimeType?: string | null
  /** The `object-position` per breakpoint, as CSS variables. */
  style: Record<string, string>
  /** The focus area in percent of the served image. */
  focus?: Rect
}

/** The virtual field of an exposed usage, filled on read. */
const exposedField = (
  field: UploadField,
  usage: UsageOptions<string>,
  { framing, maxSize, secret }: UsageContext,
  name: string,
  groupName: string,
): Field => {
  const relationTo = field.relationTo as string
  return {
    name,
    type: 'json',
    virtual: true,
    admin: { hidden: true },
    hooks: {
      afterRead: [
        async ({ req, siblingData }): Promise<ExposedFraming | null> => {
          const value = siblingData?.[field.name] as FrameableMedia | number | string | null
          if (!value) return null
          // Not populated (depth 0): read it as the requesting user may.
          const media =
            typeof value === 'object'
              ? value
              : ((await req.payload
                  .findByID({
                    collection: relationTo as CollectionSlug,
                    depth: 0,
                    id: value,
                    overrideAccess: false,
                    req,
                  })
                  .catch(() => null)) as FrameableMedia | null)
          if (!media) return null
          const { focus, resource, style } = frameImage({
            framing,
            frames: matchFrames(usage.frames, siblingData),
            maxSize: maxSize(relationTo),
            media,
            override: siblingData?.[groupName] as FramingOverride,
            secret,
          })
          return { ...resource, focus, style }
        },
      ],
    },
  }
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
  localized: boolean,
): GroupField => {
  const relationTo = field.relationTo as string
  const uploadCondition = field.admin?.condition
  const groupAccess = usage.access ?? access
  return {
    name: usage.name ?? DEFAULT_USAGE_FIELD_NAME,
    type: 'group',
    label: false,
    ...(localized ? { localized: true } : {}),
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
      rectField('crop', fieldLabel('cropArea')),
      rectField('focusArea', fieldLabel('focusArea')),
    ],
  }
}

interface UsageContext {
  /** Default field access for the groups. */
  access?: FramingAccess
  /** Signs the URLs of exposed usages. */
  secret: string
  /** The `maxSize` option of a framed collection. */
  maxSize: (collection: string) => number | undefined
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

  const walkBlock = (block: Block, inLocalized = false): Block => ({
    ...block,
    fields: walk(block.fields, `block:${block.slug}.`, dataNames(block.fields), inLocalized),
  })

  /**
   * `level`: the names stored next to `fields`, which a usage's group must not
   * take. `inLocalized`: a parent is localized, so the group must not be.
   */
  const walk = (fields: Field[], prefix: string, level: string[], inLocalized: boolean): Field[] =>
    fields.flatMap((field): Field[] => {
      const named =
        'name' in field && typeof field.name === 'string' && field.name ? field.name : null
      const inner = named ? `${prefix}${named}.` : prefix
      const localized = inLocalized || Boolean('localized' in field && field.localized)

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
        const exposed = usage.expose
          ? (typeof usage.expose === 'object' && usage.expose.name) || `${field.name}Framed`
          : null
        if (exposed && level.includes(exposed)) {
          throw new Error(
            `imageFraming: usage "${path}" exposes "${exposed}" next to the upload field, but a ` +
              `field of that name exists there already; pick another with \`expose: { name }\``,
          )
        }
        // A localized image gets a localized override, unless a parent already is.
        const localized = Boolean(field.localized) && !inLocalized
        return [
          field,
          overrideGroup(field, usage, context, localized),
          ...(exposed && context.componentPath !== null
            ? [exposedField(field, usage, context, exposed, groupName)]
            : []),
        ]
      }
      if (field.type === 'tabs') {
        return [
          {
            ...field,
            tabs: field.tabs.map((tab) => ({
              ...tab,
              fields:
                'name' in tab && tab.name
                  ? walk(
                      tab.fields,
                      `${prefix}${tab.name}.`,
                      dataNames(tab.fields),
                      inLocalized || Boolean('localized' in tab && tab.localized),
                    )
                  : walk(tab.fields, prefix, level, inLocalized),
            })),
          },
        ]
      }
      if (field.type === 'blocks') {
        // Blocks by slug (`blockReferences`) are the config's `blocks`, walked once
        // below; inline ones are walked here like `blocks`.
        const references = (field as { blockReferences?: (Block | string)[] }).blockReferences
        return [
          {
            ...field,
            blocks: field.blocks.map((block) => walkBlock(block, localized)),
            ...(references
              ? {
                  blockReferences: references.map((block) =>
                    typeof block === 'string' ? block : walkBlock(block, localized),
                  ),
                }
              : {}),
          } as Field,
        ]
      }
      if ('fields' in field && Array.isArray(field.fields)) {
        const innerLevel = named ? dataNames(field.fields) : level
        return [{ ...field, fields: walk(field.fields, inner, innerLevel, localized) } as Field]
      }
      return [field]
    })

  const result: Config = {
    ...config,
    blocks: config.blocks?.map((block) => walkBlock(block)),
    collections: config.collections?.map((collection) => ({
      ...collection,
      fields: walk(collection.fields, `${collection.slug}.`, dataNames(collection.fields), false),
    })),
    globals: config.globals?.map((global) => ({
      ...global,
      fields: walk(global.fields, `${global.slug}.`, dataNames(global.fields), false),
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
