import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      // v8 matches the `@vitest/coverage-v8` package and is fast.
      provider: 'v8',
      // text → CI logs; lcov → Codecov; json-summary → custom tooling;
      // html → local drilling at `coverage/index.html`.
      reporter: ['text', 'lcov', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      // Skip targets the test suite intentionally doesn't unit-cover —
      // app shell, page-level integration components, mock fixtures, and
      // type-only files. Pages and presentational components are validated
      // through manual smoke tests, not Vitest.
      exclude: [
        'src/main.tsx',
        'src/App.tsx',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/index.ts',
        'src/**/pages/**',
        'src/**/components/**',
        'src/**/infrastructure/*.mock.ts',
      ],
    },
  },
});
