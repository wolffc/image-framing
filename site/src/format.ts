import type { Rect } from '@wolffc80/payload-image-framing/core'

const n = (value: number) => String(Math.round(value * 10) / 10)

/** `{ x: 12.5, … }` as `x 12.5 · y 0 · 50 × 100 %`. */
export const formatRect = (rect: Rect): string =>
  `x ${n(rect.x)} · y ${n(rect.y)} · ${n(rect.width)} × ${n(rect.height)} %`

/** An object-position as CSS writes it. */
export const formatPosition = ({ x, y }: { x: number; y: number }): string => `${n(x)}% ${n(y)}%`

/** An aspect ratio as the usual name (16:9) or a decimal. */
export const formatAspect = (aspect: number): string => {
  const names: [number, string][] = [
    [21 / 9, '21:9'],
    [16 / 9, '16:9'],
    [3 / 2, '3:2'],
    [4 / 3, '4:3'],
    [1, '1:1'],
    [4 / 5, '4:5'],
    [9 / 16, '9:16'],
  ]
  return names.find(([value]) => Math.abs(value - aspect) < 0.005)?.[1] ?? `${n(aspect)}:1`
}
