import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the running dev app (`./dev.sh test-e2e` starts it
 * and runs these in Playwright's image). E2E_BASE_URL: where the app runs.
 */
export default defineConfig({
  testDir: './dev',
  testMatch: '**/*.e2e.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
