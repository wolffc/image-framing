import { defineConfig, devices } from '@playwright/test'

/**
 * Tests of the showcase page against its production build (`pnpm site:build`),
 * served by `vite preview`: ./dev.sh test-site.
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173/image-framing/', trace: 'retain-on-failure' },
  webServer: {
    command: 'node_modules/.bin/vite preview --config site/vite.config.ts --port 4173 --strictPort',
    cwd: '..',
    url: 'http://localhost:4173/image-framing/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})
