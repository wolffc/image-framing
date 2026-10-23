import type { Frame } from './frame.js'
import type { Label } from './label.js'

/**
 * Responsive breakpoints, mobile first: `base` always applies, every other
 * breakpoint from its `minWidth` up. One definition serves the admin previews
 * (plugin option `framing`) and the rendering (`frameImage({ framing })`), so
 * both show the same frames.
 */

/** One breakpoint as written in `defineFraming`. */
export interface Breakpoint {
  /** Where the breakpoint starts, in CSS pixels. `base` has none: it applies below the first. */
  minWidth?: number
  /**
   * Name of the breakpoint in the admin previews, e.g. 'Tablet' or
   * `{ en: 'Tablet', de: 'Tablet' }`. Without one the admin says "md (from 768 px)".
   */
  label?: Label
}

/** One breakpoint of a `FramingConfig`, as plain data (it is passed to the admin). */
export interface BreakpointInfo<K extends string = string> {
  name: K
  /** 0 for `base`. */
  minWidth: number
  label?: Label
}

/**
 * The breakpoints, `base` first, then by `minWidth`. Made by `defineFraming`;
 * `K` is the union of the breakpoint names, which types the frames.
 */
export interface FramingConfig<K extends string = DefaultBreakpoint> {
  readonly breakpoints: readonly BreakpointInfo<K>[]
}

/** The breakpoint names of the default config. */
export type DefaultBreakpoint = 'base' | 'md'

/**
 * The frame a usage shows the photo in per breakpoint: `base` always, every
 * other breakpoint optionally. A missing one uses the next smaller one's.
 */
export type Frames<K extends string = DefaultBreakpoint> = { base: Frame } & {
  [P in Exclude<K, 'base'>]?: Frame
}

/** The breakpoint names of a `FramingConfig`, e.g. `BreakpointName<typeof framing>`. */
export type BreakpointName<F> = F extends FramingConfig<infer K> ? K : never

const NAME = /^[A-Za-z][\w-]*$/

/**
 * Checks and orders the breakpoints. Names become CSS variable suffixes
 * (`--frame-pos-lg`), so they must be identifiers.
 *
 * ```ts
 * export const framing = defineFraming({
 *   breakpoints: {
 *     base: { label: 'Phone' },
 *     md: { minWidth: 768, label: 'Tablet' },
 *     lg: { minWidth: 1280, label: 'Desktop' },
 *   },
 * })
 * ```
 */
export const defineFraming = <const B extends { base: Breakpoint } & Record<string, Breakpoint>>({
  breakpoints,
}: {
  breakpoints: B
}): FramingConfig<keyof B & string> => {
  const fail = (message: string): never => {
    throw new Error(`defineFraming: ${message}`)
  }
  if (!breakpoints?.base) fail('a `base` breakpoint is required')
  if (breakpoints.base.minWidth)
    fail('`base` has no minWidth: it applies below the first breakpoint')

  const list = Object.entries(breakpoints).map(([name, { label, minWidth }]) => {
    if (!NAME.test(name))
      fail(`breakpoint name "${name}" must be an identifier (letters, digits, - or _)`)
    if (
      name !== 'base' &&
      !(typeof minWidth === 'number' && Number.isFinite(minWidth) && minWidth > 0)
    ) {
      fail(`breakpoint "${name}" needs a minWidth above 0`)
    }
    const width = name === 'base' ? 0 : (minWidth as number)
    return {
      name: name as keyof B & string,
      minWidth: width,
      ...(label ? { label } : {}),
    }
  })

  const widths = list.map((breakpoint) => breakpoint.minWidth)
  const duplicate = widths.find((width, index) => widths.indexOf(width) !== index)
  if (duplicate !== undefined) fail(`two breakpoints start at ${duplicate} px`)

  return { breakpoints: list.sort((a, b) => a.minWidth - b.minWidth) }
}

/** Phones (`base`) and, from 768 px, `md`: the breakpoints before they were configurable. */
export const DEFAULT_FRAMING: FramingConfig = defineFraming({
  breakpoints: {
    base: { label: { en: 'Phones', de: 'Smartphones' } },
    md: { minWidth: 768, label: { en: 'Desktop', de: 'Desktop' } },
  },
})

/** One breakpoint's frame, as `resolveFrames` gives it. */
export interface ResolvedFrame<K extends string = string> {
  breakpoint: BreakpointInfo<K>
  frame: Frame
  /** The smaller breakpoint whose frame this one uses, when it has none of its own. */
  fallbackFrom?: K
}

/** Every breakpoint's frame, smallest first: its own, or the next smaller one's. */
export const resolveFrames = <K extends string>(
  framing: FramingConfig<K>,
  frames: Frames<K>,
): ResolvedFrame<K>[] => {
  const own = frames as Partial<Record<K, Frame>>
  const resolved: ResolvedFrame<K>[] = []
  for (const breakpoint of framing.breakpoints) {
    const frame = own[breakpoint.name]
    const previous = resolved.at(-1)
    if (frame || !previous) {
      resolved.push({ breakpoint, frame: frame ?? frames.base })
    } else {
      resolved.push({
        breakpoint,
        frame: previous.frame,
        fallbackFrom: previous.fallbackFrom ?? previous.breakpoint.name,
      })
    }
  }
  return resolved
}

/** The CSS variable `frameImage` writes for a breakpoint: `--frame-pos`, `--frame-pos-md`, … */
export const frameVariable = (name: string, variable = DEFAULT_VARIABLE): string =>
  name === 'base' ? variable : `${variable}-${name}`

/** Prefix of the CSS variables `frameImage` writes. */
export const DEFAULT_VARIABLE = '--frame-pos'

/** Options of `framePositionCss` and `frameAspectCss`. */
export interface FramePositionCssOptions {
  /** Prefix of the CSS variables, as passed to `frameImage`. */
  variable?: string
  /** `container` writes `@container` queries instead of `@media`. */
  query?: 'media' | 'container'
}

/**
 * CSS that applies the frame positions without Tailwind:
 * `framePositionCss(framing, '.framed')` gives
 * `.framed{object-position:var(--frame-pos)} @media (min-width:768px){.framed{object-position:var(--frame-pos-md)}}`.
 */
export const framePositionCss = (
  framing: FramingConfig<string>,
  selector: string,
  { query = 'media', variable = DEFAULT_VARIABLE }: FramePositionCssOptions = {},
): string => breakpointCss(framing, selector, 'object-position', variable, query)

/** Sets `property` to the breakpoint's variable (`--x`, `--x-md`, …) from each breakpoint up. */
const breakpointCss = (
  framing: FramingConfig<string>,
  selector: string,
  property: string,
  variable: string,
  query: 'media' | 'container',
) =>
  framing.breakpoints
    .map(({ minWidth, name }) => {
      const rule = `${selector}{${property}:var(${frameVariable(name, variable)})}`
      return name === 'base' ? rule : `@${query} (min-width:${minWidth}px){${rule}}`
    })
    .join(' ')

/** Prefix of the CSS variables `frameAspectVariables` writes. */
export const DEFAULT_ASPECT_VARIABLE = '--frame-aspect'

/**
 * The frame's shape per breakpoint as CSS variables (`--frame-aspect`,
 * `--frame-aspect-md`, …), for a box that changes shape with the frames;
 * apply them with `frameAspectCss`.
 */
export const frameAspectVariables = <K extends string>(
  framing: FramingConfig<K>,
  frames: Frames<NoInfer<K>>,
  variable = DEFAULT_ASPECT_VARIABLE,
): Record<string, string> =>
  Object.fromEntries(
    resolveFrames(framing, frames).map(({ breakpoint, frame }) => [
      frameVariable(breakpoint.name, variable),
      String(Math.round(frame.aspect * 10000) / 10000),
    ]),
  )

/**
 * CSS that gives a box the frame's shape per breakpoint, from the variables of
 * `frameAspectVariables`: `.frame{aspect-ratio:var(--frame-aspect)} @media …`.
 */
export const frameAspectCss = (
  framing: FramingConfig<string>,
  selector: string,
  { query = 'media', variable = DEFAULT_ASPECT_VARIABLE }: FramePositionCssOptions = {},
): string => breakpointCss(framing, selector, 'aspect-ratio', variable, query)

/**
 * Tailwind classes that apply the frame positions, e.g.
 * `object-[var(--frame-pos)] min-[768px]:object-[var(--frame-pos-md)]`. They use
 * the configured widths (`min-[…]`), so they don't depend on Tailwind's screens.
 * Tailwind only generates classes it finds in your source: copy the string
 * into your code or safelist it.
 */
export const framedImageClasses = (
  framing: FramingConfig<string>,
  { variable = DEFAULT_VARIABLE }: Pick<FramePositionCssOptions, 'variable'> = {},
): string =>
  framing.breakpoints
    .map(({ minWidth, name }) => {
      const position = `object-[var(${frameVariable(name, variable)})]`
      return name === 'base' ? position : `min-[${minWidth}px]:${position}`
    })
    .join(' ')
