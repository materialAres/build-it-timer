import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
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