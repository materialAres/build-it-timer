import { chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

export const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');

/**
 * WebGL needs a GL backend. By default the e2e uses SwiftShader (software), so
 * it runs the same on a machine without a GPU; `E2E_GPU=1` leaves the browser's
 * own choice, which is what the performance budgets are meant for.
 */
const SOFTWARE_GL = process.env.E2E_GPU === '1'
  ? []
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export async function launchExtensionContext(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...SOFTWARE_GL,
    ],
  });
  return context;
}

/** The id of the loaded extension, from its service worker's URL. */
export async function extensionIdOf(context: BrowserContext): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  return new URL(worker.url()).host;
}
