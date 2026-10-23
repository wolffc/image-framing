import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image may load the originals and the cropped copies.
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/api/media/crop/**' }],
  },
}

export default withPayload(nextConfig)
