// @vitest-environment node
import type { Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { imageFramingPlugin } from '../../src/payload/index.js'

/**
 * How the plugin attaches per-usage overrides (#316, part 2): an
 * `imageFraming` group right after each configured upload field, found by its
 * path through collections, unnamed tabs and rows, groups and (nested) blocks.
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
              { label: 'Hero', fields: [{ name: 'hero', type: 'group', fields: [{ name: 'type', type: 'text' }, upload('media')] }] },
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
const tabs = (result: Config) =>
  (pages(result).fields[0] as Extract<Field, { type: 'tabs' }>).tabs
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
    const editor = group.fields.find((field) => field.type === 'ui') as Extract<Field, { type: 'ui' }>
    const component = editor.admin!.components!.Field as { clientProps: Record<string, unknown> }
    expect(component.clientProps).toMatchObject({ frames: heroRules, uploadField: 'media' })
  })

  it('fails loudly when a configured usage does not exist, e.g. after a rename', () => {
    expect(() => apply({ 'block:cta.photo': {} })).toThrow(/block:cta\.photo/)
    expect(() => apply({ 'pages.hero.image': {} })).toThrow(/pages\.hero\.image/)
  })
})
