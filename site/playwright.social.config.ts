import { defineConfig } from '@playwright/test'

import base from './playwright.config'

/** Screenshots site/social.html into site/public/social-preview.png: ./dev.sh social-preview. */
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'social.shot.ts',
  retries: 0,
  projects: [
    {
      name: 'social',
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        deviceScaleFactor: 1,
        viewport: { width: 1280, height: 640 },
      },
    },
  ],
})
