import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The whole-session tests last 5 minutes each: `bun run e2e:sessions` runs them.
  testIgnore: process.env.E2E_SESSIONS === '1' ? [] : ['**/session-long.spec.ts'],
  fullyParallel: true,
  retries: 0,
  workers: 1, // Importante: le estensioni non supportano worker multipli
  reporter: 'html',
  use: {
    headless: false, // Le estensioni richiedono modalità non headless su Chromium
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});