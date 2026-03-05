import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['packages/api/src/**/*.ts', 'packages/sdk/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/types.ts'],
    },
  },
})
