import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'

export const imageFramingPageSlug = 'e2e-image-framing-page'
const mediaAlt = 'e2e image framing panorama'

/**
 * A 3000 x 1000 panorama: a red strip over the left 10%, the rest blue, with a
 * white block at 80-90% as the subject. The e2e test crops the red strip away
 * and checks that it never reaches the browser.
 */
const panorama = () =>
  sharp({ create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 0, b: 200 } } })
    .composite([
      {
        input: { create: { width: 300, height: 1000, channels: 3, background: { r: 255, g: 0, b: 0 } } },
        left: 0,
        top: 0,
      },
      {
        input: { create: { width: 300, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } } },
        left: 2400,
        top: 300,
      },
    ])
    .png()
    .toBuffer()

/** Seeds the panorama and a page with a Full-bleed hero (text on the left) showing it. */
export async function seedImageFramingTestPage(): Promise<number> {
  await cleanupImageFramingTestPage()
  const payload = await getPayload({ config })

  const data = await panorama()
  const media = await payload.create({
    collection: 'media',
    data: { alt: mediaAlt, focusArea: { x: 80, y: 30, width: 10, height: 40 } },
    file: { data, mimetype: 'image/png', name: 'e2e-image-framing.png', size: data.length },
  })

  await payload.create({
    collection: 'pages',
    locale: 'en',
    context: { disableRevalidate: true },
    data: {
      title: 'E2E Image Framing Page',
      slug: imageFramingPageSlug,
      _status: 'published',
      ready: true,
      markets: ['in', 'uk', 'us'],
      hero: { type: 'fullBleed', media: media.id },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: {
                root: {
                  type: 'root',
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                  children: [
                    {
                      type: 'paragraph',
                      direction: 'ltr',
                      format: '',
                      indent: 0,
                      version: 1,
                      children: [{ type: 'text', text: 'Image framing probe.', version: 1 }],
                    },
                  ],
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            },
          ],
        },
      ],
    },
  })

  return media.id as number
}

export async function cleanupImageFramingTestPage(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'pages',
    where: { slug: { equals: imageFramingPageSlug } },
    context: { disableRevalidate: true },
  })
  await payload.delete({ collection: 'media', where: { alt: { equals: mediaAlt } } })
}
