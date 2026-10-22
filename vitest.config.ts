import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests and integration tests (Payload on SQLite, no services). The
    // integration and e2e tests in dev/ still target weflyhome.com and are
    // rewritten against the dev app (issue #10).
    include: ['test/**/*.spec.ts'],
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
})
