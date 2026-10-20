import { createHmac, timingSafeEqual } from 'node:crypto'

import type { Rect } from './rect'

/**
 * The path segment that names a cropped copy: the rect in hundredths of a
 * percent, then a signature over the media id, the rect and the media's
 * version, e.g. `5000-0-5000-10000.Xy3…`. Only the server can make one, so the
 * route never crops on request of a made-up URL, and the URL changes when the
 * crop or the media changes.
 */

const SIGNATURE_LENGTH = 22
const TOKEN = /^(\d{1,5})-(\d{1,5})-(\d{1,5})-(\d{1,5})\.([\w-]{22})$/

interface TokenContext {
  id: number | string
  secret: string
  updatedAt?: string | null
}

const encodeRect = (rect: Rect) =>
  [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100)).join('-')

const sign = (rect: string, { id, secret, updatedAt }: TokenContext) =>
  createHmac('sha256', secret)
    .update(`image-framing:${id}:${rect}:${updatedAt ?? ''}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH)

export const cropToken = ({ rect, ...context }: TokenContext & { rect: Rect }): string => {
  const encoded = encodeRect(rect)
  return `${encoded}.${sign(encoded, context)}`
}

/** The rect a token names, or null when it is malformed or not signed for this media version. */
export const readCropToken = (token: string, context: TokenContext): Rect | null => {
  const match = TOKEN.exec(token)
  if (!match) return null
  const encoded = match.slice(1, 5).join('-')
  const expected = Buffer.from(sign(encoded, context))
  const actual = Buffer.from(match[5])
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  const [x, y, width, height] = match.slice(1, 5).map((value) => Number(value) / 100)
  if (width <= 0 || height <= 0 || x + width > 100 || y + height > 100) return null
  return { x, y, width, height }
}
