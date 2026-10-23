import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The e2e tests reach the dev server in Docker under this name; Next blocks
  // its dev resources (and so hydration) for hosts it doesn't know.
  allowedDevOrigins: ['framing-dev'],
  // The source uses NodeNext imports (`./rect.js` for `rect.ts`). Turbopack
  // cannot map those, so `pnpm dev` runs Next with webpack.
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
