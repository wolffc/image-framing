// @vitest-environment node
import type {
  CollectionAfterChangeHook,
  CollectionConfig,
  Config,
  Endpoint,
  Field,
  PayloadRequest,
} from 'payload'
import { describe, expect, it } from 'vitest'

import { DEFAULT_FRAMING, defineFraming } from '../../src/core/index.js'
import { cropToken } from '../../src/exports/server.js'
import { fieldAccess } from '../../src/payload/admin/permissions.js'
import {
  DEFAULT_CACHE_CONTROL,
  DEFAULT_PREVIEW_SHAPES,
  type FramingStorage,
  imageFramingPlugin,
  type ImageFramingPluginOptions,
} from '../../src/payload/index.js'

/**
 * How the plugin changes the Payload config: the media fields, hooks and
 * endpoint, and per-usage overrides, an `imageFraming` group right after each
 * configured upload field, found by its path through collections, unnamed tabs
 * and rows, groups and (nested) blocks. Plus every plugin option.
 */

const upload = (name: string): Field => ({ name, type: 'upload', relationTo: 'media' })

const config = (): Config =>
  ({
    collections: [
      {
        slug: 'media',
        upload: { staticDir: '/tmp/media', imageSizes: [] },
        fields: [{ name: 'alt', type: 'text' }],
      },
      {
        slug: 'pages',
        fields: [
          {
            type: 'tabs',
            tabs: [
              {
                label: 'Hero',
                fields: [
                  {
                    name: 'hero',
                    type: 'group',
                    fields: [{ name: 'type', type: 'text' }, upload('media')],
                  },
                ],
              },
              {
                label: 'Content',
                fields: [
                  {
                    name: 'layout',
                    type: 'blocks',
                    blocks: [
                      { slug: 'cta', fields: [{ type: 'row', fields: [upload('media')] }] },
                      {
                        slug: 'cards',
                        fields: [
                          {
                            name: 'cards',
                            type: 'blocks',
                            blocks: [{ slug: 'editorialCard', fields: [upload('media')] }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { name: 'meta', type: 'group', fields: [upload('image')] },
        ],
      },
    ],
    // Never called: these tests only transform the config.
    sharp: () => {
      throw new Error('not in unit tests')
    },
  }) as unknown as Config

const heroRules = [{ when: { type: 'fullBleed' }, frames: { base: { aspect: 16 / 9 } } }]

const apply = (usages: Record<string, { frames?: typeof heroRules }>) =>
  imageFramingPlugin({ collections: ['media'], secret: 's', usages })(config()) as Config

/** Names of the fields in `fields` (and inside unnamed rows), in order. */
const names = (fields: Field[]): string[] =>
  fields.flatMap((field) =>
    'name' in field ? [field.name] : 'fields' in field ? names(field.fields as Field[]) : [],
  )

const pages = (result: Config) => result.collections!.find((c) => c.slug === 'pages')!
const tabs = (result: Config) => (pages(result).fields[0] as Extract<Field, { type: 'tabs' }>).tabs
const heroFields = (result: Config) =>
  (tabs(result)[0].fields[0] as Extract<Field, { type: 'group' }>).fields
const layoutBlocks = (result: Config) =>
  (tabs(result)[1].fields[0] as Extract<Field, { type: 'blocks' }>).blocks

describe('imageFramingPlugin usages', () => {
  const result = apply({
    'pages.hero.media': { frames: heroRules },
    'block:cta.media': {},
    'block:editorialCard.media': {},
  })

  it('adds an imageFraming group right after the hero image', () => {
    expect(names(heroFields(result))).toEqual(['type', 'media', 'imageFraming'])
  })

  it('finds upload fields inside rows of a block', () => {
    const cta = layoutBlocks(result).find((block) => block.slug === 'cta')!

    expect(names(cta.fields)).toEqual(['media', 'imageFraming'])
  })

  it('finds upload fields in nested blocks', () => {
    const cards = layoutBlocks(result).find((block) => block.slug === 'cards')!
    const editorial = (cards.fields[0] as Extract<Field, { type: 'blocks' }>).blocks[0]

    expect(names(editorial.fields)).toEqual(['media', 'imageFraming'])
  })

  it('leaves other upload fields alone', () => {
    const meta = pages(result).fields[1] as Extract<Field, { type: 'group' }>

    expect(names(meta.fields)).toEqual(['image'])
  })

  it('stores a crop and a focus area and hands the frame rules to the admin field', () => {
    const group = heroFields(result).find(
      (field) => 'name' in field && field.name === 'imageFraming',
    ) as Extract<Field, { type: 'group' }>

    expect(names(group.fields)).toEqual(expect.arrayContaining(['crop', 'focusArea']))
    const editor = group.fields.find((field) => field.type === 'ui') as Extract<
      Field,
      { type: 'ui' }
    >
    const component = editor.admin!.components!.Field as { clientProps: Record<string, unknown> }
    expect(component.clientProps).toMatchObject({ frames: heroRules, uploadField: 'media' })
  })

  it('fails loudly when a configured usage does not exist, e.g. after a rename', () => {
    expect(() => apply({ 'block:cta.photo': {} })).toThrow(/block:cta\.photo/)
    expect(() => apply({ 'pages.hero.image': {} })).toThrow(/pages\.hero\.image/)
  })
})

describe('imageFramingPlugin requirements', () => {
  it('fails at startup without sharp in the Payload config', () => {
    const withoutSharp = { ...config(), sharp: undefined }

    expect(() => imageFramingPlugin({ collections: ['media'], secret: 's' })(withoutSharp)).toThrow(
      /set `sharp` in the Payload config/,
    )
  })

  it("uses the Payload config's secret by default and fails without any", () => {
    expect(() =>
      imageFramingPlugin({ collections: ['media'] })({ ...config(), secret: 'config-secret' }),
    ).not.toThrow()
    expect(() =>
      imageFramingPlugin({ collections: ['media'] })({ ...config(), secret: '' }),
    ).toThrow(/no secret/)
  })
})

describe('imageFramingPlugin framing', () => {
  const usageEditor = (result: Config) => {
    const group = heroFields(result).find(
      (field) => 'name' in field && field.name === 'imageFraming',
    ) as Extract<Field, { type: 'group' }>
    const editor = group.fields.find((field) => field.type === 'ui') as Extract<
      Field,
      { type: 'ui' }
    >
    return (editor.admin!.components!.Field as { clientProps: Record<string, unknown> }).clientProps
  }

  it('hands the breakpoints to the usage editor, the default ones without a config', () => {
    const framing = defineFraming({
      breakpoints: { base: { label: 'Phone' }, lg: { minWidth: 1280, label: 'Desktop' } },
    })
    const result = imageFramingPlugin({
      collections: ['media'],
      secret: 's',
      framing,
      usages: {
        'pages.hero.media': {
          frames: [{ when: {}, frames: { base: { aspect: 1 }, lg: { aspect: 2 } } }],
        },
      },
    })(config()) as Config

    expect(usageEditor(result).breakpoints).toEqual(framing.breakpoints)
    expect(usageEditor(apply({ 'pages.hero.media': {} })).breakpoints).toEqual(
      DEFAULT_FRAMING.breakpoints,
    )
  })

  it('fails at startup when a frame rule names a breakpoint the config lacks', () => {
    const framing = defineFraming({ breakpoints: { base: {} } })
    // Not an inline literal, so TypeScript can't flag `md` (see the next test): the plugin does.
    const frames = { base: { aspect: 1 }, md: { aspect: 2 } }
    const usages = { 'pages.hero.media': { frames: [{ when: {}, frames }] } }

    expect(() =>
      imageFramingPlugin({ collections: ['media'], framing, secret: 's', usages })(config()),
    ).toThrow(/usage "pages\.hero\.media" has frames for "md"/)
  })

  it('types the usage frames from the framing config', () => {
    const framing = defineFraming({ breakpoints: { base: {} } })
    const plugin = () =>
      imageFramingPlugin({
        collections: ['media'],
        framing,
        usages: {
          'pages.hero.media': {
            frames: [
              {
                when: {},
                // @ts-expect-error md is not a breakpoint of this config
                frames: { base: { aspect: 1 }, md: { aspect: 2 } },
              },
            ],
          },
        },
      })

    expect(plugin).not.toThrow()
  })
})

// --- Options ---------------------------------------------------------------

type Options = ImageFramingPluginOptions<'base' | 'md'>

const run = (options: Partial<Options>, base: Config = config()): Config =>
  imageFramingPlugin({ collections: ['media'], secret: 's', ...options } as Options)(base) as Config

const collection = (result: Config, slug = 'media'): CollectionConfig =>
  result.collections!.find((c) => c.slug === slug)!

const field = (fields: Field[], name: string) =>
  fields.find((f) => 'name' in f && f.name === name) as Extract<Field, { type: 'group' }>

const clientProps = (f: Field) =>
  (f.admin as { components: { Field: { clientProps: Record<string, unknown> } } }).components.Field
    .clientProps

const withMediaSizes = (): Config => {
  const base = config()
  collection(base).upload = {
    staticDir: '/tmp/media',
    imageSizes: [
      { name: 'thumbnail', width: 400 },
      { name: 'square', width: 600, height: 600 },
    ],
  }
  return base
}

/** Runs the media collection's afterChange hooks with a stub sharp and database. */
const rebuilt = async (result: Config) => {
  const sharp = () => {
    const chain = {
      rotate: () => chain,
      extract: () => chain,
      resize: () => chain,
      toBuffer: async () => ({ data: Buffer.from('x'), info: { size: 1, width: 1, height: 1 } }),
    }
    return chain
  }
  const req = {
    payload: { config: { sharp }, db: { updateOne: async () => ({ updatedAt: 'now' }) } },
  } as unknown as PayloadRequest
  const doc = {
    id: 1,
    filename: 'a.jpg',
    mimeType: 'image/jpeg',
    width: 3000,
    height: 1000,
    sizes: { thumbnail: { filename: 'a-400.jpg' }, square: { filename: 'a-600.jpg' } },
  }
  const media = collection(result)
  for (const hook of media.hooks?.afterChange ?? []) {
    await (hook as CollectionAfterChangeHook)({
      collection: { slug: 'media' },
      context: {},
      doc,
      operation: 'update',
      previousDoc: undefined,
      req,
    } as unknown as Parameters<CollectionAfterChangeHook>[0])
  }
}

describe('imageFramingPlugin options', () => {
  it('takes collections as a list or as an object, with the same result for the defaults', () => {
    const asList = collection(run({ collections: ['media'] }))
    const asObject = collection(run({ collections: { media: true } }))

    expect(names(asObject.fields)).toEqual(names(asList.fields))
    expect(asObject.endpoints).toHaveLength((asList.endpoints as Endpoint[]).length)
    expect(Object.keys(asObject.hooks!)).toEqual(Object.keys(asList.hooks!))
  })

  it('fails for a collection that does not exist', () => {
    expect(() => run({ collections: ['photos'] })).toThrow(/no collection "photos"/)
  })

  it('previews per-collection shapes, falling back to the plugin-wide ones', () => {
    const square = [{ key: 'sq', label: 'Square', frame: { aspect: 1 } }]
    const wide = [{ key: 'w', label: 'Wide', frame: { aspect: 3 } }]

    const editor = (result: Config) => clientProps(field(collection(result).fields, 'framing'))
    expect(editor(run({})).previewShapes).toEqual(DEFAULT_PREVIEW_SHAPES)
    expect(editor(run({ previewShapes: wide })).previewShapes).toEqual(wide)
    expect(
      editor(run({ previewShapes: wide, collections: { media: { previewShapes: square } } }))
        .previewShapes,
    ).toEqual(square)
  })

  it('uses the per-collection storage', async () => {
    const reads: string[] = []
    const storage = (): FramingStorage => ({
      readOriginal: async (name) => (reads.push(name), Buffer.from('x')),
      writeSize: async () => {},
      readCached: async () => null,
      writeCached: async () => {},
      clearCached: async () => {},
    })
    await rebuilt(run({ collections: { media: { storage } } }, withMediaSizes()))

    expect(reads).toEqual(['a.jpg'])
  })

  it('rebuilds all sizes by default, none with rebuildSizes: false, or only the listed ones', async () => {
    const written = async (rebuildSizes?: boolean | string[]) => {
      const reads: string[] = []
      const storage = (): FramingStorage => ({
        readOriginal: async () => Buffer.from('x'),
        writeSize: async (name) => void reads.push(name),
        readCached: async () => null,
        writeCached: async () => {},
        clearCached: async () => {},
      })
      await rebuilt(run({ collections: { media: { storage, rebuildSizes } } }, withMediaSizes()))
      return reads
    }

    expect(await written(undefined)).toEqual(['a-400.jpg', 'a-600.jpg'])
    expect(await written(true)).toEqual(['a-400.jpg', 'a-600.jpg'])
    expect(await written(false)).toEqual([])
    expect(await written(['square'])).toEqual(['a-600.jpg'])
  })

  describe('endpoint', () => {
    const endpoints = (result: Config) => (collection(result).endpoints || []) as Endpoint[]

    /** Calls the crop endpoint for a cached copy and returns the response. */
    const call = async (endpoint: Endpoint) => {
      const doc = {
        id: 1,
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        width: 100,
        height: 100,
        updatedAt: 't',
      }
      const token = cropToken({
        id: 1,
        rect: { x: 0, y: 0, width: 50, height: 50 },
        secret: 's',
        updatedAt: 't',
      })
      return endpoint.handler({
        payload: { findByID: async () => doc },
        routeParams: { id: '1', token, filename: 'a.jpg' },
      } as unknown as PayloadRequest)
    }

    it('adds the crop endpoint with the default path and caching', async () => {
      const [endpoint] = endpoints(
        run({
          storage: () =>
            ({ readCached: async () => Buffer.from('c') }) as unknown as FramingStorage,
        }),
      )

      expect(endpoint.path).toBe('/crop/:id/:token/:filename')
      expect((await call(endpoint)).headers.get('Cache-Control')).toBe(DEFAULT_CACHE_CONTROL)
    })

    it('moves the endpoint and changes its Cache-Control', async () => {
      const [endpoint] = endpoints(
        run({
          collections: {
            media: { endpoint: { path: '/framed/', cacheControl: 'public, max-age=60' } },
          },
          storage: () =>
            ({ readCached: async () => Buffer.from('c') }) as unknown as FramingStorage,
        }),
      )

      expect(endpoint.path).toBe('/framed/:id/:token/:filename')
      expect((await call(endpoint)).headers.get('Cache-Control')).toBe('public, max-age=60')
    })

    it('leaves the endpoint out with endpoint: false', () => {
      expect(endpoints(run({ endpoint: false }))).toEqual([])
    })
  })

  describe('field access', () => {
    const access = { update: () => false }
    const usageGroup = (result: Config) => field(heroFields(result), 'imageFraming')

    it('passes access to the crop and focus area fields and to usage groups', () => {
      const result = run({ access, usages: { 'pages.hero.media': {} } })

      expect(field(collection(result).fields, 'crop').access).toBe(access)
      expect(field(collection(result).fields, 'focusArea').access).toBe(access)
      expect(usageGroup(result).access).toBe(access)
    })

    it('takes per-collection and per-usage access over the plugin-wide one', () => {
      const own = { read: () => true }
      const result = run({
        access,
        collections: { media: { access: own } },
        usages: { 'pages.hero.media': { access: own } },
      })

      expect(field(collection(result).fields, 'crop').access).toBe(own)
      expect(usageGroup(result).access).toBe(own)
    })

    it('adds no access by default', () => {
      const result = run({ usages: { 'pages.hero.media': {} } })

      expect(field(collection(result).fields, 'crop').access).toBeUndefined()
      expect(usageGroup(result).access).toBeUndefined()
    })

    it('reads what the user may do with a field from the document permissions', () => {
      const ok = { create: true, read: true, update: true }
      const readOnly = { read: true }
      const permissions = (fields: unknown, doc: Record<string, true> = { update: true }) =>
        ({ ...doc, fields }) as never
      const at = (
        fields: unknown,
        path: string,
        options: Parameters<typeof fieldAccess>[2] = { isNew: false },
        doc?: Record<string, true>,
      ) => fieldAccess(permissions(fields, doc), path, options)

      // Unknown permissions: allowed; the server enforces access anyway.
      expect(fieldAccess(undefined, 'crop', { isNew: false })).toEqual({ edit: true, read: true })
      // Top level.
      expect(at({ crop: ok }, 'crop')).toEqual({ edit: true, read: true })
      expect(at({ crop: readOnly }, 'crop')).toEqual({ edit: false, read: true })
      expect(at({}, 'crop')).toEqual({ edit: false, read: false })
      expect(at(true, 'crop')).toEqual({ edit: true, read: true })
      // The document decides first: update for existing ones, create for new ones.
      expect(at(true, 'crop', { isNew: false }, {})).toEqual({ edit: false, read: true })
      expect(
        at({ crop: { read: true, create: true } }, 'crop', { isNew: true }, { create: true }),
      ).toEqual({ edit: true, read: true })
      // Nested in a group: every level must allow it.
      expect(
        at({ hero: { ...ok, fields: { imageFraming: readOnly } } }, 'hero.imageFraming'),
      ).toEqual({ edit: false, read: true })
      expect(
        at({ hero: { ...readOnly, fields: { imageFraming: ok } } }, 'hero.imageFraming'),
      ).toEqual({ edit: false, read: true })
      expect(at({ hero: { ...ok, fields: { imageFraming: true } } }, 'hero.imageFraming')).toEqual({
        edit: true,
        read: true,
      })
      // In a blocks row: by the row's block type.
      const layout = { ...ok, blocks: { card: { fields: { imageFraming: readOnly } }, hero: true } }
      const options = (blockType: string) => ({ blockTypeAt: () => blockType, isNew: false })
      expect(at({ layout }, 'layout.0.imageFraming', options('card'))).toEqual({
        edit: false,
        read: true,
      })
      expect(at({ layout }, 'layout.3.imageFraming', options('hero'))).toEqual({
        edit: true,
        read: true,
      })
      // In an array row.
      expect(
        at({ items: { ...ok, fields: { imageFraming: readOnly } } }, 'items.2.imageFraming'),
      ).toEqual({ edit: false, read: true })
    })
  })

  describe('field names', () => {
    it('fails when the media collection already has a crop, focusArea or framing field', () => {
      const base = config()
      collection(base).fields.push({ type: 'row', fields: [{ name: 'crop', type: 'text' }] })

      expect(() => run({}, base)).toThrow(/collection "media" already has a field "crop"/)
    })

    it('renames a usage group with its name option', () => {
      const result = run({ usages: { 'pages.hero.media': { name: 'heroFraming' } } })

      expect(names(heroFields(result))).toEqual(['type', 'media', 'heroFraming'])
    })

    it('fails when a usage group would take a name used on the same level', () => {
      const base = config()
      const hero = heroFields(base)
      hero.push({
        type: 'collapsible',
        label: 'More',
        fields: [{ name: 'imageFraming', type: 'text' }],
      })

      expect(() => run({ usages: { 'pages.hero.media': {} } }, base)).toThrow(
        /usage "pages\.hero\.media" adds a field "imageFraming"/,
      )
      expect(() =>
        run({ usages: { 'pages.hero.media': { name: 'framingOverride' } } }, base),
      ).not.toThrow()
    })

    it('does not count names of other levels as taken', () => {
      const base = config()
      heroFields(base).push({
        name: 'nested',
        type: 'group',
        fields: [{ name: 'imageFraming', type: 'text' }],
      })

      expect(() => run({ usages: { 'pages.hero.media': {} } }, base)).not.toThrow()
    })
  })

  it('hands the usage label and description to the usage editor', () => {
    const result = run({
      usages: {
        'pages.hero.media': { label: 'Hero image', admin: { description: 'Shown on top.' } },
      },
    })
    const editor = field(heroFields(result), 'imageFraming').fields.find(
      (f) => 'name' in f && f.name === 'editor',
    )!

    expect(clientProps(editor)).toMatchObject({ label: 'Hero image', description: 'Shown on top.' })
  })

  it('fails for a usage whose upload field points to a collection without framing', () => {
    const base = config()
    base.collections!.push({ slug: 'docs', upload: { staticDir: '/tmp/docs' }, fields: [] })
    ;(heroFields(base)[1] as { relationTo: string }).relationTo = 'docs'

    expect(() => run({ usages: { 'pages.hero.media': {} } }, base)).toThrow(
      /usage "pages\.hero\.media" uploads to "docs", which has no image framing/,
    )
  })

  it('fails for a usage on an upload field with several collections or many uploads', () => {
    const base = config()
    ;(heroFields(base)[1] as { hasMany?: boolean }).hasMany = true

    expect(() => run({ usages: { 'pages.hero.media': {} } }, base)).toThrow(
      /must be a single upload field/,
    )
  })

  describe('disabled', () => {
    /** Data fields, recursively, as `name:type`: what the database schema is made of. */
    const schema = (fields: Field[]): string[] =>
      fields.flatMap((f): string[] => {
        if (f.type === 'ui') return []
        const own = 'name' in f && f.name ? [`${f.name}:${f.type}`] : []
        if (f.type === 'tabs') return f.tabs.flatMap((tab) => schema(tab.fields))
        if (f.type === 'blocks') return [...own, ...f.blocks.flatMap((b) => schema(b.fields))]
        return 'fields' in f && Array.isArray(f.fields) ? [...own, ...schema(f.fields)] : own
      })

    const usages = { 'pages.hero.media': {}, 'block:cta.media': {} }

    it('keeps the fields, so the database stays the same', () => {
      const on = run({ usages })
      const off = run({ disabled: true, usages })

      expect(schema(collection(off).fields)).toEqual(schema(collection(on).fields))
      expect(schema(pages(off).fields)).toEqual(schema(pages(on).fields))
      expect(collection(off).upload).toEqual(collection(on).upload)
    })

    it('adds no hooks, endpoint or editors, and needs neither sharp nor a secret', () => {
      const base = { ...config(), sharp: undefined, secret: '' }
      const off = imageFramingPlugin({ collections: ['media'], disabled: true, usages })(
        base,
      ) as Config

      expect(collection(off).hooks).toBeUndefined()
      expect(collection(off).endpoints).toBeUndefined()
      expect(collection(off).fields.some((f) => f.type === 'ui')).toBe(false)
      const group = field(heroFields(off), 'imageFraming')
      expect((group as { hooks?: unknown }).hooks).toBeUndefined()
      expect(group.fields.some((f) => f.type === 'ui')).toBe(false)
    })
  })
})
