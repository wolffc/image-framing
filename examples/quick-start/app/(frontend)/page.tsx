import config from '@payload-config'
import { FramedImage } from '@wolffc80/payload-image-framing/next'
import type { FrameableMedia } from '@wolffc80/payload-image-framing/server'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'posts', depth: 1 })

  return (
    <main>
      <h1>Posts</h1>
      {docs.map((post) => (
        <article key={post.id}>
          <h2>{String(post.title)}</h2>
          {post.image && typeof post.image === 'object' && (
            // The cropped photo in a 16:9 frame, placed around its focus area.
            <FramedImage
              frames={{ base: { aspect: 16 / 9 } }}
              media={post.image as FrameableMedia}
              secret={process.env.PAYLOAD_SECRET!}
              sizes="(min-width: 1100px) 1100px, 100vw"
            />
          )}
        </article>
      ))}
    </main>
  )
}
