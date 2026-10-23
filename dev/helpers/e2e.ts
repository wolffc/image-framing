import sharp from 'sharp'

import { devUser } from './credentials.js'

/**
 * Seeding for the e2e tests through the dev app's REST API, so the test
 * runner needs no Payload of its own: a panorama with a red strip on the left
 * and a white subject at 80-90 %, and a page whose hero shows it.
 */

export const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

const api = (path: string) => `${baseURL}/api${path}`

export const login = async (): Promise<string> => {
  const response = await fetch(api('/users/login'), {
    body: JSON.stringify(devUser),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Login failed: ${response.status}`)
  return ((await response.json()) as { token: string }).token
}

/** 3000 x 1000: a red strip over the left 10 %, the rest blue, a white block at 80-90 %. */
const panorama = () =>
  sharp({ create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 0, b: 200 } } })
    .composite([
      {
        input: {
          create: { width: 300, height: 1000, channels: 3, background: { r: 255, g: 0, b: 0 } },
        },
        left: 0,
        top: 0,
      },
      {
        input: {
          create: { width: 300, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
        },
        left: 2400,
        top: 300,
      },
    ])
    .png()
    .toBuffer()

const send = async (token: string, path: string, init: RequestInit) => {
  const response = await fetch(api(path), {
    ...init,
    headers: { Authorization: `JWT ${token}`, ...init.headers },
  })
  if (!response.ok)
    throw new Error(`${init.method} ${path}: ${response.status} ${await response.text()}`)
  return response.json() as Promise<{ doc: { id: number | string } }>
}

export const seed = async (token: string, title: string) => {
  const form = new FormData()
  form.append(
    'file',
    new Blob([new Uint8Array(await panorama())], { type: 'image/png' }),
    'e2e-framing.png',
  )
  form.append(
    '_payload',
    JSON.stringify({ alt: title, focusArea: { x: 80, y: 30, width: 10, height: 40 } }),
  )
  const media = await send(token, '/media', { body: form, method: 'POST' })
  const page = await send(token, '/pages', {
    body: JSON.stringify({
      title,
      hero: { heading: 'Text on the left', image: media.doc.id, layout: 'fullBleed' },
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  return { mediaId: media.doc.id, pageId: page.doc.id }
}

export const cleanup = async (token: string, title: string) => {
  const where = (field: string) => `?where[${field}][equals]=${encodeURIComponent(title)}`
  await send(token, `/pages${where('title')}`, { method: 'DELETE' })
  await send(token, `/media${where('alt')}`, { method: 'DELETE' })
}
