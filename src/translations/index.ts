/**
 * The admin texts, in Payload's i18n format: one namespace, `imageFraming`,
 * merged into `config.i18n.translations`. Use them as `t('imageFraming:done')`.
 * German follows Payload's own German texts, which say "du".
 */

const en = {
  adjustHere: 'Adjust the framing here',
  breakpointBase: 'Smallest screens',
  breakpointFrom: '{{name}} (from {{minWidth}} px)',
  cropAndFocusArea: 'Crop and focus area',
  cropArea: 'Crop area',
  cropOutside: 'The crop area must lie inside the photo.',
  customFraming: 'Custom framing',
  defaultFraming: 'Default framing',
  done: 'Done',
  editorIntro:
    'The **crop area** (solid frame) is the part of the photo the site shows, in every size and shape. ' +
    'The **focus area** (dashed frame) is the subject: the site keeps it in view and away from text. ' +
    'The original file stays as it is, so you can widen the crop again later. ' +
    'Where a page sets its own crop for the photo, narrower or wider, that one applies there instead.',
  focusArea: 'Focus area',
  height: 'Height',
  left: 'Left',
  loadingImage: 'Loading the image…',
  percent: '{{label}} (%)',
  preview: 'Preview',
  sameAs: 'same as {{label}}',
  showHere: 'Show the framing here',
  showWholePhoto: 'Show the whole photo',
  top: 'Top',
  uploadFirst: 'Upload and save the photo first, then set its crop and focus area here.',
  usageIntro:
    'Set the crop and focus area for this usage only. The crop can be narrower or wider than the one ' +
    'set on the image (dotted outline), up to the whole photo. The preview shows the frames this usage ' +
    'shows the photo in, with the parts that text covers hatched.',
  usageTitle: 'Framing for this usage',
  usesImage: 'Uses the crop and focus area set on the image.',
  usesOwn: 'Uses its own crop and focus area here.',
  useImageFraming: "Use the image's framing",
  width: 'Width',
}

export type ImageFramingTranslationKey = keyof typeof en

const de: Record<ImageFramingTranslationKey, string> = {
  adjustHere: 'Bildausschnitt hier anpassen',
  breakpointBase: 'Kleinste Bildschirme',
  breakpointFrom: '{{name}} (ab {{minWidth}} px)',
  cropAndFocusArea: 'Zuschnitt und Fokusbereich',
  cropArea: 'Zuschnitt',
  cropOutside: 'Der Zuschnitt muss innerhalb des Fotos liegen.',
  customFraming: 'Eigener Bildausschnitt',
  defaultFraming: 'Standard-Bildausschnitt',
  done: 'Fertig',
  editorIntro:
    'Der **Zuschnitt** (durchgezogener Rahmen) ist der Teil des Fotos, den die Website zeigt, in jeder Größe und Form. ' +
    'Der **Fokusbereich** (gestrichelter Rahmen) ist das Motiv: Die Website hält es im Bild und frei von Text. ' +
    'Die Originaldatei bleibt unverändert, du kannst den Zuschnitt also später wieder erweitern. ' +
    'Wo eine Seite einen eigenen Zuschnitt für das Foto festlegt, enger oder weiter, gilt dort dieser.',
  focusArea: 'Fokusbereich',
  height: 'Höhe',
  left: 'Links',
  loadingImage: 'Bild wird geladen …',
  percent: '{{label}} (%)',
  preview: 'Vorschau',
  sameAs: 'wie {{label}}',
  showHere: 'Bildausschnitt hier ansehen',
  showWholePhoto: 'Ganzes Foto zeigen',
  top: 'Oben',
  uploadFirst:
    'Lade das Foto zuerst hoch und speichere es, dann legst du hier Zuschnitt und Fokusbereich fest.',
  usageIntro:
    'Lege Zuschnitt und Fokusbereich nur für diese Verwendung fest. Der Zuschnitt kann enger oder weiter sein ' +
    'als der am Bild festgelegte (gepunkteter Rahmen), bis hin zum ganzen Foto. Die Vorschau zeigt die Rahmen, ' +
    'in denen diese Verwendung das Foto zeigt; Bereiche, die Text verdeckt, sind schraffiert.',
  usageTitle: 'Bildausschnitt für diese Verwendung',
  usesImage: 'Verwendet den Zuschnitt und Fokusbereich des Bildes.',
  usesOwn: 'Verwendet hier einen eigenen Zuschnitt und Fokusbereich.',
  useImageFraming: 'Bildausschnitt des Bildes verwenden',
  width: 'Breite',
}

/** Texts per language: all keys for a full language, some to override single texts. */
export type ImageFramingTranslations = Partial<
  Record<string, Partial<Record<ImageFramingTranslationKey, string>>>
>

/** The shipped languages. */
export const translations = { de, en } satisfies Record<
  string,
  Record<ImageFramingTranslationKey, string>
>

export const TRANSLATION_NAMESPACE = 'imageFraming'

/** A key as passed to Payload's `t`, e.g. `imageFraming:done`. */
export type ImageFramingTranslationPath = `imageFraming:${ImageFramingTranslationKey}`

export const key = (name: ImageFramingTranslationKey): ImageFramingTranslationPath =>
  `${TRANSLATION_NAMESPACE}:${name}`
