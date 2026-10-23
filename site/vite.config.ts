import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.resolve(import.meta.dirname, '..')

/**
 * The showcase page on GitHub Pages (https://wolffc.github.io/image-framing/).
 * The widgets import `@wolffc80/payload-image-framing/core` from source, so
 * they run the plugin's own framing code.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: process.env.SITE_BASE ?? '/image-framing/',
  plugins: [react()],
  resolve: {
    alias: {
      '@wolffc80/payload-image-framing/core': path.join(root, 'src/core/index.ts'),
    },
  },
  build: { outDir: path.join(root, 'site/dist'), emptyOutDir: true },
  server: { host: '0.0.0.0', port: 5173, fs: { allow: [root] } },
  preview: { host: '0.0.0.0', port: 4173 },
})
