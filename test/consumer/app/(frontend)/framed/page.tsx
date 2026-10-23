import { defineFraming } from '@wolffc/payload-image-framing/core'
import { FramedImage } from '@wolffc/payload-image-framing/next'

const framing = defineFraming({ breakpoints: { base: {}, lg: { minWidth: 1280 } } })

// <FramedImage> in a server component, as a site would use it.
export default function Framed() {
  return (
    <FramedImage
      framing={framing}
      frames={{ base: { aspect: 4 / 5 }, lg: { aspect: 21 / 9 } }}
      media={{
        id: 1,
        alt: 'Beach',
        filename: 'beach.jpg',
        mimeType: 'image/jpeg',
        url: '/api/media/file/beach.jpg',
        width: 3000,
        height: 1000,
        crop: { x: 10, y: 0, width: 80, height: 100 },
      }}
      secret="consumer-app-secret"
      sizes="100vw"
    />
  )
}
