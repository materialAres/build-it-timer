import { existsSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { EXTENSION_PATH, extensionIdOf, launchExtensionContext } from './setup';

/**
 * M5.T20: the sound settings and the offscreen playback on the real, built
 * Chrome extension. Build first (`bun run build`). Playwright cannot hear, so
 * nothing here asserts audio: the end sound is covered by the background
 * integration tests (M5.T15); what only a real browser can prove is that the
 * settings persist and that the hidden offscreen page really gets created.
 */
test.skip(!existsSync(EXTENSION_PATH), 'Build the extension first: bun run build');

// The extension page's own `chrome` API (the e2e has no `@types/chrome`).
declare const chrome: {
  runtime: { getContexts(filter: { contextTypes: string[] }): Promise<unknown[]> };
  storage: { local: { get(key: string): Promise<Record<string, string | undefined>> } };
};

const STORE_KEY = 'timer-focus-store';
const SOUND_LABEL = 'Play a sound when a session starts and ends';

interface StoredSound {
  readonly enabled: boolean;
  readonly themeId: string;
  readonly volume: number;
}

let context: BrowserContext | undefined;

/** A fresh browser with the extension, so no setting or offscreen document leaks between tests. */
async function openPopup(): Promise<Page> {
  context = await launchExtensionContext();
  return openPopupIn(context);
}

async function openPopupIn(browserContext: BrowserContext): Promise<Page> {
  const extensionId = await extensionIdOf(browserContext);
  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('button', { name: 'Start' }).waitFor();
  return page;
}

const showSettings = (page: Page): Promise<void> =>
  page.getByRole('tab', { name: 'Settings' }).click();

// The controls follow the *stored* preference, which reaches the popup through
// the background and the storage a moment after the click. `check()` and
// `uncheck()` verify the state right after clicking, so they fail on that
// round trip; a plain click, then waiting for the stored value, does not.
const turnSoundOff = (page: Page): Promise<void> =>
  page.getByRole('checkbox', { name: SOUND_LABEL }).click();

/** What the background has persisted, read straight from storage. */
const storedSound = (page: Page): Promise<StoredSound | undefined> =>
  page.evaluate(async (key) => {
    const raw = (await chrome.storage.local.get(key))[key];
    if (raw === undefined) return undefined;
    const parsed = JSON.parse(raw) as {
      state?: { preferences?: { sound?: StoredSound } };
    };
    return parsed.state?.preferences?.sound;
  }, STORE_KEY);

/** Hidden offscreen documents of the extension, asked from an extension page. */
const offscreenDocuments = (page: Page): Promise<number> =>
  page.evaluate(
    async () =>
      (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length,
  );

async function startSession(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Timer' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Pause' }).waitFor();
}

test.afterEach(async () => {
  await context?.close();
  context = undefined;
});

test.describe('sound settings and offscreen playback (M5.T20)', () => {
  test('the sound settings are kept when the popup is closed and reopened', async () => {
    const page = await openPopup();
    await showSettings(page);

    await page.getByRole('radio', { name: 'Glitch' }).click();
    const slider = page.getByRole('slider', { name: 'Volume' });
    await slider.fill('20');
    // The value is sent once, when the slider is released.
    await slider.dispatchEvent('pointerup');
    await turnSoundOff(page);

    // A real round trip: popup -> background -> storage.
    await expect
      .poll(() => storedSound(page))
      .toEqual({ enabled: false, themeId: 'glitch', volume: 20 });

    await page.close();
    expect(context).toBeDefined();
    const reopened = await openPopupIn(context as BrowserContext);
    await showSettings(reopened);

    await expect(reopened.getByRole('checkbox', { name: SOUND_LABEL })).not.toBeChecked();
    await expect(reopened.getByRole('radio', { name: 'Glitch' })).toBeChecked();
    await expect(reopened.getByRole('slider', { name: 'Volume' })).toHaveValue('20');
  });

  test('starting a session with sounds on creates the offscreen document', async () => {
    const page = await openPopup();
    expect(await offscreenDocuments(page)).toBe(0);

    await startSession(page);

    // The hidden page is created on demand, shortly after the start.
    await expect.poll(() => offscreenDocuments(page), { timeout: 2_000 }).toBe(1);
  });

  test('starting a session with sounds off creates no offscreen document', async () => {
    const page = await openPopup();
    await showSettings(page);
    await turnSoundOff(page);
    await expect.poll(() => storedSound(page)).toMatchObject({ enabled: false });

    await startSession(page);
    // A negative result needs a pause: give the background time to have created it.
    await page.waitForTimeout(1_500);

    expect(await offscreenDocuments(page)).toBe(0);
  });
});
