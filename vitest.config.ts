import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import path from 'node:path';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.wxt/',
        '.output/',
        'tests/',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
        '@': path.resolve(import.meta.dirname, './'),
    },
  },
});
