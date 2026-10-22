// @vitest-environment node
import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { imageFramingPlugin, translations } from '../../src/index.js'
import { fieldLabel, translate, withTranslations } from '../../src/payload/i18n.js'

/**
 * The admin texts go through Payload's i18n in an `imageFraming` namespace.
 * English and German ship complete; a project can override single texts with
 * the plugin's `translations` option or its own `i18n.translations`.
 */

const english = translations.en as Record<string, string>
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

const config = (i18n?: Config['i18n']): Config =>
  ({
    collections: [{ slug: 'media', upload: { staticDir: '/tmp/media' }, fields: [] }],
    i18n,
    secret: 's',
    sharp: () => {
      throw new Error('not in unit tests')
    },
  }) as unknown as Config

type Tree = Record<string, Record<string, Record<string, string>>>
const texts = (result: Config['i18n']) => result?.translations as unknown as Tree

describe('shipped translations', () => {
  it('ships English and German', () => {
    expect(Object.keys(translations).sort()).toEqual(['de', 'en'])
  })

  it.each(Object.keys(translations))('has every key in %s, filled in', (language) => {
    const own = translations[language as keyof typeof translations] as Record<string, string>

    expect(Object.keys(own).sort()).toEqual(Object.keys(english).sort())
    expect(Object.entries(own).filter(([, text]) => !text.trim())).toEqual([])
  })

  it.each(Object.keys(translations))(
    'keeps the placeholders and bold markers in %s',
    (language) => {
      const own = translations[language as keyof typeof translations] as Record<string, string>

      for (const [name, text] of Object.entries(english)) {
        expect(placeholders(own[name]), name).toEqual(placeholders(text))
        expect(own[name].split('**').length, name).toBe(text.split('**').length)
      }
    },
  )
})

describe('adding the texts to the config', () => {
  it('adds the shipped languages in the imageFraming namespace', () => {
    const result = imageFramingPlugin({ collections: ['media'] })(config()) as Config

    expect(texts(result.i18n).de.imageFraming.done).toBe('Fertig')
    expect(texts(result.i18n).en.imageFraming.done).toBe('Done')
  })

  it("keeps the config's other i18n settings and translations", () => {
    const i18n = {
      fallbackLanguage: 'de',
      translations: { de: { general: { save: 'Sichern' } } },
    } as unknown as Config['i18n']
    const result = withTranslations(config(i18n))

    expect(result?.fallbackLanguage).toBe('de')
    expect(texts(result).de.general.save).toBe('Sichern')
    expect(texts(result).de.imageFraming.done).toBe('Fertig')
  })

  it('lets a project override a single text with the plugin option', () => {
    const result = withTranslations(config(), { de: { done: 'Schließen' } })

    expect(texts(result).de.imageFraming.done).toBe('Schließen')
    expect(texts(result).de.imageFraming.preview).toBe('Vorschau')
    expect(texts(result).en.imageFraming.done).toBe('Done')
  })

  it("lets the config's own imageFraming texts win over the option", () => {
    const i18n = {
      translations: { en: { imageFraming: { done: 'OK' } } },
    } as unknown as Config['i18n']
    const result = withTranslations(config(i18n), { en: { done: 'Close' } })

    expect(texts(result).en.imageFraming.done).toBe('OK')
    expect(texts(result).en.imageFraming.preview).toBe('Preview')
  })

  it('gives a supported language without texts the English ones', () => {
    const i18n = { supportedLanguages: { en: {}, fr: {} } } as unknown as Config['i18n']
    const result = withTranslations(config(i18n), { fr: { done: 'Terminé' } })

    expect(texts(result).fr.imageFraming.done).toBe('Terminé')
    expect(texts(result).fr.imageFraming.preview).toBe('Preview')
  })

  it('adds a language from the option', () => {
    const result = withTranslations(config(), { fr: { done: 'Terminé' } })

    expect(texts(result).fr.imageFraming.done).toBe('Terminé')
  })
})

it('labels fields through the namespaced key', () => {
  const t = (key: string) => `translated ${key}`

  expect(fieldLabel('cropArea')({ t })).toBe('translated imageFraming:cropArea')
})

it('translates server messages in the language of the request', () => {
  const req = { t: (key: string) => `translated ${key}` } as never

  expect(translate(req, 'cropOutside')).toBe('translated imageFraming:cropOutside')
  expect(translate({} as never, 'cropOutside')).toBe('The crop area must lie inside the photo.')
})
