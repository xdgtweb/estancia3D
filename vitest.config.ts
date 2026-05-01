import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**',
        'src/services/**',
        'src/store/**',
      ],
      thresholds: {
        lines: 90,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
