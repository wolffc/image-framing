import type { Config, PayloadRequest } from 'payload'

import {
  type ImageFramingTranslationKey,
  type ImageFramingTranslations,
  key,
  TRANSLATION_NAMESPACE,
  translations,
} from '../translations/index.js'

type AnyTranslate = (path: string, variables?: Record<string, unknown>) => string

/** A field label in the admin's language, e.g. `label: fieldLabel('cropArea')`. */
export const fieldLabel =
  (name: ImageFramingTranslationKey) =>
  ({ t }: { t: unknown }): string =>
    (t as AnyTranslate)(key(name))

/** A text in every shipped language, for places that take no label function. */
export const staticLabel = (name: ImageFramingTranslationKey): Record<string, string> =>
  Object.fromEntries(
    Object.entries(translations).map(([language, texts]) => [language, texts[name]]),
  )

/** A text in the language of the request, e.g. for a validation error. */
export const translate = (req: PayloadRequest, name: ImageFramingTranslationKey): string =>
  req.t ? (req.t as AnyTranslate)(key(name)) : translations.en[name]

type TranslationTree = Record<string, Record<string, Record<string, string>>>

/**
 * The config's i18n with the plugin's texts: the shipped languages, then the
 * plugin's `translations` option, then whatever the config itself sets for the
 * `imageFraming` namespace, so a project can override single texts either way.
 * A supported language the plugin doesn't ship gets the English texts, so the
 * admin never shows raw keys.
 */
export const withTranslations = (
  config: Config,
  overrides: ImageFramingTranslations = {},
): Config['i18n'] => {
  const existing = (config.i18n?.translations ?? {}) as TranslationTree
  const shipped = translations as Record<string, Record<string, string>>
  const languages = new Set([
    ...Object.keys(translations),
    ...Object.keys(config.i18n?.supportedLanguages ?? {}),
    ...Object.keys(overrides),
    ...Object.keys(existing),
  ])
  const merged: TranslationTree = { ...existing }
  for (const language of languages) {
    merged[language] = {
      ...existing[language],
      [TRANSLATION_NAMESPACE]: {
        ...(shipped[language] ?? shipped.en),
        ...overrides[language],
        ...existing[language]?.[TRANSLATION_NAMESPACE],
      },
    }
  }
  return { ...config.i18n, translations: merged as NonNullable<Config['i18n']>['translations'] }
}
