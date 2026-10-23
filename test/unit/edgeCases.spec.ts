// @vitest-environment node
import type {
  Block,
  CollectionAfterChangeHook,
  CollectionConfig,
  Config,
  Endpoint,
  Field,
  PayloadRequest,
} from 'payload'
import { describe, expect, it } from 'vitest'

import { croppedSize, DEFAULT_MAX_SIZE, isFramable } from '@wolffc80/payload-image-framing/core'
import { cropToken, frameImage } from '@wolffc80/payload-image-framing/server'
import { type FramingStorage, imageFramingPlugin } from '@wolffc80/payload-image-framing'

/**
 * What a single site never hit: SVGs, very large originals, quick saves,
 * localized images and the ways a usage's upload field can be nested.
 */

const secret = 's'
const upload = (name: string, extra: Partial<Field> = {}) =>
  ({ name, type: 'upload', relationTo: 'media', ...extra }) as Field

const base = (fields: Field[] = [], extra: Partial<Config> = {}): Config =>
  ({
    collections: [
      {
        slug: 'media',
        fields: [],
        upload: { staticDir: '/tmp/media', imageSizes: [{ name: 'thumbnail', width: 400 }] },
      },
      { slug: 'pages', fields },
    ],
    secret,
    sharp: () => {
      throw new Error('not in unit tests')
    },
    ...extra,
  }) as unknown as Config

const media = {
  id: 7,
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  url: '/api/media/file/beach.jpg',
  width: 3000,
  height: 1000,
  updatedAt: 't',
  crop: { x: 10, y: 0, width: 80, height: 100 },
}

describe('SVG', () => {
  const svg = {
    ...media,
    filename: 'logo.svg',
    mimeType: 'image/svg+xml',
    url: '/api/media/file/logo.svg',
  }

  it('is not framed', () => {
    expect(isFramable('image/svg+xml')).toBe(false)
    expect(isFramable('image/jpeg')).toBe(true)
    expect(isFramable('application/pdf')).toBe(false)
  })

  it('renders the original, without a crop URL or positions', () => {
    const framed = frameImage({ frames: { base: { aspect: 1 } }, media: svg, secret })

    expect(framed.resource.url).toBe('/api/media/file/logo.svg')
    expect(framed.style).toEqual({})
  })

  it('gets no cropped copy from the endpoint', async () => {
    const result = imageFramingPlugin({ collections: ['media'] })(base()) as Config
    const [endpoint] = result.collections!.find((c) => c.slug === 'media')!.endpoints as Endpoint[]
    const token = cropToken({
      id: 7,
      rect: { x: 0, y: 0, width: 50, height: 50 },
      secret,
      updatedAt: 't',
    })
    const response = await endpoint.handler({
      payload: { findByID: async () => svg },
      routeParams: { id: '7', token, filename: 'logo.svg' },
    } as unknown as PayloadRequest)

    expect(response.status).toBe(404)
  })
})

describe('very large originals', () => {
  it('caps the cropped copy at 4000 px on the long side by default', () => {
    expect(DEFAULT_MAX_SIZE).toBe(4000)
    expect(croppedSize(12000, 6000)).toEqual({ width: 4000, height: 2000 })
    expect(croppedSize(1200, 600)).toEqual({ width: 1200, height: 600 })
    expect(croppedSize(12000, 6000, 1000)).toEqual({ width: 1000, height: 500 })
  })

  it('reports the capped size from frameImage', () => {
    const large = { ...media, width: 12000, height: 8000 }

    // 80 % of 12000 x 8000 is 9600 x 8000, capped to 4000 x 3333.
    expect(frameImage({ media: large, secret }).resource).toMatchObject({
      width: 4000,
      height: 3333,
    })
    expect(frameImage({ maxSize: 2400, media: large, secret }).resource).toMatchObject({
      width: 2400,
      height: 2000,
    })
  })
})

describe('quick saves', () => {
  /** Runs the size rebuild hook with a sharp stub whose speed depends on the crop. */
  const setup = () => {
    const written: string[] = []
    const storage = (): FramingStorage => ({
      readOriginal: async () => Buffer.from('original'),
      writeSize: async (_name, data) => void written.push(data.toString()),
      readCached: async () => null,
      writeCached: async () => {},
      clearCached: async () => {},
    })
    const result = imageFramingPlugin({ collections: { media: { storage } } })(base()) as Config
    const collection = result.collections!.find((c) => c.slug === 'media') as CollectionConfig
    const hook = collection.hooks!.afterChange!.at(-1) as CollectionAfterChangeHook

    const sharp = () => {
      let region = { width: 0 }
      const chain = {
        metadata: async () => ({ pages: 1 }),
        rotate: () => chain,
        extract: (r: { width: number }) => ((region = r), chain),
        resize: () => chain,
        // The first save's crop is slow to render: it finishes after the second.
        toBuffer: async () => {
          await new Promise((resolve) => setTimeout(resolve, region.width > 2000 ? 50 : 0))
          return {
            data: Buffer.from(`crop ${region.width}`),
            info: { size: 1, width: 1, height: 1 },
          }
        },
      }
      return chain
    }
    const req = {
      payload: {
        config: { sharp },
        db: { updateOne: async () => ({ updatedAt: 't' }) },
        logger: console,
      },
    } as unknown as PayloadRequest
    const save = (cropWidth: number) =>
      hook({
        collection: { slug: 'media' },
        context: {},
        doc: {
          ...media,
          crop: { x: 0, y: 0, width: cropWidth, height: 100 },
          sizes: { thumbnail: { filename: 'beach-400.jpg' } },
        },
        operation: 'update',
        previousDoc: { ...media, sizes: { thumbnail: { filename: 'beach-400.jpg' } } },
        req,
      } as unknown as Parameters<CollectionAfterChangeHook>[0])
    return { save, written }
  }

  it('keeps the sizes of the last save when an earlier one finishes later', async () => {
    const { save, written } = setup()

    // 90 % then 50 % of 3000 px: 2700 px (slow), then 1500 px (fast).
    await Promise.all([save(90), save(50)])

    expect(written).toEqual(['crop 1500'])
  })

  it('writes every save when they come one after another', async () => {
    const { save, written } = setup()

    await save(90)
    await save(50)

    expect(written).toEqual(['crop 2700', 'crop 1500'])
  })
})

describe('usages', () => {
  const run = (config: Config, usages: Record<string, object>) =>
    imageFramingPlugin({ collections: ['media'], usages })(config) as Config

  /** The field named `name`, searching through every nested field, tab and block. */
  const find = (fields: (Block | Field)[], name: string): Field | undefined => {
    for (const item of fields) {
      const field = item as Field & {
        blocks?: Block[]
        blockReferences?: (Block | string)[]
        tabs?: { fields: Field[] }[]
      }
      if ('name' in field && field.name === name) return field
      const inner = [
        ...('fields' in field && Array.isArray(field.fields) ? field.fields : []),
        ...(field.tabs ?? []).flatMap((tab) => tab.fields),
        ...(field.blocks ?? []).flatMap((block) => block.fields),
        ...(field.blockReferences ?? []).flatMap((block) =>
          typeof block === 'string' ? [] : block.fields,
        ),
        ...('slug' in item && 'fields' in item ? [] : []),
      ]
      const found = find(inner, name)
      if (found) return found
    }
    return undefined
  }
  const pages = (config: Config) => config.collections!.find((c) => c.slug === 'pages')!.fields

  describe('localized upload fields', () => {
    it('get a localized override', () => {
      const result = run(base([upload('image', { localized: true })]), { 'pages.image': {} })

      expect(find(pages(result), 'imageFraming')).toMatchObject({ localized: true })
    })

    it('leave the override unlocalized when the image is not', () => {
      const result = run(base([upload('image')]), { 'pages.image': {} })

      expect(find(pages(result), 'imageFraming')).not.toHaveProperty('localized')
    })

    it.each([
      [
        'a localized group',
        {
          name: 'hero',
          type: 'group',
          localized: true,
          fields: [upload('image', { localized: true })],
        },
        'pages.hero.image',
      ],
      [
        'a localized array',
        {
          name: 'items',
          type: 'array',
          localized: true,
          fields: [upload('image', { localized: true })],
        },
        'pages.items.image',
      ],
      [
        'a localized named tab',
        {
          type: 'tabs',
          tabs: [{ name: 'hero', localized: true, fields: [upload('image', { localized: true })] }],
        },
        'pages.hero.image',
      ],
      [
        'localized blocks',
        {
          name: 'layout',
          type: 'blocks',
          localized: true,
          blocks: [{ slug: 'card', fields: [upload('image', { localized: true })] }],
        },
        'block:card.image',
      ],
    ])('are not localized again inside %s', (_name, field, path) => {
      const result = run(base([field as Field]), { [path]: {} })

      expect(find(pages(result), 'imageFraming')).not.toHaveProperty('localized')
    })
  })

  describe('path forms', () => {
    it.each([
      ['a field of the collection', [upload('image')], 'pages.image'],
      ['a group', [{ name: 'hero', type: 'group', fields: [upload('image')] }], 'pages.hero.image'],
      [
        'an array',
        [{ name: 'items', type: 'array', fields: [upload('image')] }],
        'pages.items.image',
      ],
      [
        'a named tab',
        [{ type: 'tabs', tabs: [{ name: 'hero', fields: [upload('image')] }] }],
        'pages.hero.image',
      ],
      [
        'an unnamed tab, row and collapsible',
        [
          {
            type: 'tabs',
            tabs: [
              {
                label: 'A',
                fields: [
                  {
                    type: 'row',
                    fields: [{ type: 'collapsible', label: 'B', fields: [upload('image')] }],
                  },
                ],
              },
            ],
          },
        ],
        'pages.image',
      ],
      [
        'a block',
        [{ name: 'layout', type: 'blocks', blocks: [{ slug: 'card', fields: [upload('image')] }] }],
        'block:card.image',
      ],
      [
        'a block nested in a block',
        [
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'cards',
                fields: [
                  {
                    name: 'cards',
                    type: 'blocks',
                    blocks: [{ slug: 'card', fields: [upload('image')] }],
                  },
                ],
              },
            ],
          },
        ],
        'block:card.image',
      ],
      [
        'an array in a block',
        [
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'gallery',
                fields: [{ name: 'items', type: 'array', fields: [upload('image')] }],
              },
            ],
          },
        ],
        'block:gallery.items.image',
      ],
      [
        'an inline block reference',
        [
          {
            name: 'layout',
            type: 'blocks',
            blocks: [],
            blockReferences: [{ slug: 'card', fields: [upload('image')] }],
          },
        ],
        'block:card.image',
      ],
    ])('finds an upload field in %s', (_name, fields, path) => {
      const result = run(base(fields as Field[]), { [path]: {} })

      expect(find(pages(result), 'imageFraming')).toBeDefined()
    })

    it('finds an upload field in a config block used by reference (config.blocks)', () => {
      const config = base(
        [{ name: 'layout', type: 'blocks', blocks: [], blockReferences: ['card'] } as Field],
        {
          blocks: [{ slug: 'card', fields: [upload('image')] }],
        },
      )
      const result = run(config, { 'block:card.image': {} })

      expect(find(result.blocks!, 'imageFraming')).toBeDefined()
    })

    it('finds an upload field in a global', () => {
      const config = base([], { globals: [{ slug: 'header', fields: [upload('logo')] }] })
      const result = run(config, { 'header.logo': {} })

      expect(find(result.globals![0].fields, 'imageFraming')).toBeDefined()
    })
  })

  it('fails for a polymorphic upload field, naming it', () => {
    const config = base([upload('image', { relationTo: ['media', 'pages'] } as Partial<Field>)])

    expect(() => run(config, { 'pages.image': {} })).toThrow(
      /usage "pages\.image" must be a single upload field with one relationTo/,
    )
  })
})

describe('forced rebuild', () => {
  it('rebuilds the sizes of an unchanged document when the context asks for it', async () => {
    const written: string[] = []
    const storage = (): FramingStorage => ({
      readOriginal: async () => Buffer.from('original'),
      writeSize: async (name) => void written.push(name),
      readCached: async () => null,
      writeCached: async () => {},
      clearCached: async () => {},
    })
    const result = imageFramingPlugin({ collections: { media: { storage } } })(base()) as Config
    const collection = result.collections!.find((c) => c.slug === 'media') as CollectionConfig
    const hook = collection.hooks!.afterChange!.at(-1) as CollectionAfterChangeHook
    const chain = {
      metadata: async () => ({ pages: 1 }),
      rotate: () => chain,
      extract: () => chain,
      resize: () => chain,
      toBuffer: async () => ({ data: Buffer.from('x'), info: { size: 1, width: 1, height: 1 } }),
    }
    const doc = { ...media, sizes: { thumbnail: { filename: 'beach-400.jpg' } } }
    const save = (context: object) =>
      hook({
        collection: { slug: 'media' },
        context,
        doc,
        operation: 'update',
        previousDoc: doc,
        req: {
          payload: {
            config: { sharp: () => chain },
            db: { updateOne: async () => ({}) },
            logger: console,
          },
        },
      } as unknown as Parameters<CollectionAfterChangeHook>[0])

    await save({})
    expect(written).toEqual([])
    await save({ imageFraming: { rebuild: true } })
    expect(written).toEqual(['beach-400.jpg'])
  })
})
