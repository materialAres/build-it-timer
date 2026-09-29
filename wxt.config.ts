import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { defineConfig } from 'wxt';

/**
 * `wxt dev` opens a Chromium-based browser through `web-ext` -> `chrome-launcher`,
 * which needs a Chrome/Chromium executable on the machine. Rather than
 * depending on a system Chrome install, reuse the Chromium bundled with
 * Playwright (already installed for the e2e tests, see M0.T4). An explicit
 * `CHROME_PATH` always takes precedence, so developers with their own Chrome
 * can override this.
 */
function resolveChromeBinary(): string | undefined {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  try {
    const bundled = chromium.executablePath();
    return existsSync(bundled) ? bundled : undefined;
  } catch {
    // Playwright browsers are not installed: let `web-ext` auto-detect Chrome.
    return undefined;
  }
}

const chromeBinary = resolveChromeBinary();

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    // `binaries` is keyed by browser name; an empty map keeps web-ext's own
    // auto-detection as the fallback.
    binaries: chromeBinary ? { chrome: chromeBinary } : {},
  },
});
