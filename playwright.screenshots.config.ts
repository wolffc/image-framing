import { defineConfig, devices } from '@playwright/test'

/**
 * Regenerates the screenshots in docs/images from the dev app:
 * `./dev.sh screenshots` starts the app and runs dev/screenshots.shot.ts.
 */
export default defineConfig({
  testDir: './dev',
  testMatch: '**/*.shot.ts',
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 1100 },
  },
})
