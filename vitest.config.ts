import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only. The integration and e2e tests in dev/ still target
    // weflyhome.com and are rewritten against the dev app (issue #10).
    include: ['test/**/*.spec.ts'],
  },
})
