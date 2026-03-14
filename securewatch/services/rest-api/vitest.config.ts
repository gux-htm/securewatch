import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  75,
      },
    },
  },
});
