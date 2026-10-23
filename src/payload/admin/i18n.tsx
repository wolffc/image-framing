'use client'

import { useTranslation } from '@payloadcms/ui'
import React from 'react'

import { type BreakpointInfo, type Label, labelText } from '../../core/index.js'
import { type ImageFramingTranslationKey, key } from '../../translations/index.js'

type Translate = (name: ImageFramingTranslationKey, variables?: Record<string, unknown>) => string

/**
 * The plugin's admin texts in the user's language, through Payload's i18n:
 * `t('done')`, `label({ en, de })`, and the name of a breakpoint.
 */
export const useFramingTranslation = () => {
  const { i18n, t } = useTranslation()
  const translate: Translate = (name, variables) =>
    (t as (path: string, variables?: Record<string, unknown>) => string)(key(name), variables)
  const label = (value: Label) => labelText(value, i18n.language)
  const breakpointLabel = (breakpoint: BreakpointInfo) =>
    breakpoint.label
      ? label(breakpoint.label)
      : breakpoint.name === 'base'
        ? translate('breakpointBase')
        : translate('breakpointFrom', { minWidth: breakpoint.minWidth, name: breakpoint.name })
  return { breakpointLabel, label, t: translate }
}

/** A translated text with `**bold**` parts. */
export const RichText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text
      .split(/\*\*(.+?)\*\*/)
      .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
  </>
)
