/**
 * A text shown in the admin: one string, or one per language like Payload's
 * own labels, e.g. `{ en: 'Phone', de: 'Smartphone' }`.
 */
export type Label = string | Record<string, string>

/** The text of `label` in `language`, else in English, else in the first language given. */
export const labelText = (label: Label, language: string): string =>
  typeof label === 'string' ? label : (label[language] ?? label.en ?? Object.values(label)[0] ?? '')
