'use client'

import {
  type BreakpointInfo,
  DEFAULT_FRAMING,
  type FrameRule,
  matchFrames,
  resolveFrames,
} from '../../core/index.js'

import type { PreviewFrame } from './PreviewStrip.js'

/**
 * The usage drawer's previews: one per breakpoint, labelled from the framing
 * config, for the frames of the first rule that matches the sibling fields. A
 * breakpoint without a frame of its own shows the next smaller one's and says so.
 */
export const usagePreviewFrames = (
  rules: readonly FrameRule<string>[] | undefined,
  siblings: Record<string, unknown>,
  {
    breakpointLabel,
    breakpoints = DEFAULT_FRAMING.breakpoints,
    sameAs,
  }: {
    /** The breakpoint's name in the user's language. */
    breakpointLabel: (breakpoint: BreakpointInfo) => string
    breakpoints?: readonly BreakpointInfo[]
    /** The note on a fallback preview, e.g. `same as Phones`. */
    sameAs: (label: string) => string
  },
): PreviewFrame[] => {
  const frames = matchFrames(rules, siblings)
  if (!frames) return []
  const labels = new Map(
    breakpoints.map((breakpoint) => [breakpoint.name, breakpointLabel(breakpoint)]),
  )
  return resolveFrames({ breakpoints }, frames).map(({ breakpoint, fallbackFrom, frame }) => ({
    frame,
    key: breakpoint.name,
    label: labels.get(breakpoint.name) ?? breakpoint.name,
    ...(fallbackFrom
      ? { fallbackFrom, note: sameAs(labels.get(fallbackFrom) ?? fallbackFrom) }
      : {}),
  }))
}
