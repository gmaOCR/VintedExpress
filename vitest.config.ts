import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests-e2e/**'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      all: false, // instrumente uniquement les fichiers importés par les tests
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'release/**',
        'scripts/**',
        'tests/**',
        'public/**',
        'vite.config.*',
        'vitest.config.*',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 10,
        statements: 20,
      },
    },
  },
});
