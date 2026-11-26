import { expect, type BrowserContext, type Page } from '@playwright/test';
import { extensionIdOf, launchExtensionContext } from './setup';

// The extension page's own `chrome` API (the e2e has no `@types/chrome`).
declare const chrome: {
  runtime: { onMessage: { addListener(listener: (message: unknown) => void): void } };
  storage: { local: { get(key: string): Promise<Record<string, string | undefined>> } };
};

interface SoundWindow {
  __played?: PlayedSound[];
}

const STORE_KEY = 'timer-focus-store';
const OVERLAY_HOST_ID = 'buildit-blocked-overlay';

export const SESSION_MS = 5 * 60_000;
export const SOUND_LABEL = 'Play a sound when a session starts and ends';

export interface PlayedSound {
  readonly themeId: string;
  readonly cue: string;
  readonly volume: number;
}

export interface StoredState {
  readonly timer: {
    readonly status: string;
    readonly durationSeconds: number;
    readonly focusedMs: number;
    readonly distractedMs: number;
  };
  readonly score: { readonly builtCharacters: number; readonly level: string; readonly population: number };
  readonly blocklist: { readonly appliedPresetIds: string[]; readonly blocklist: unknown[] };
  readonly preferences: { readonly sound: { readonly enabled: boolean; readonly themeId: string; readonly volume: number } };
}

/**
 * A browser with the built extension, and a *spy page*: a bare extension
 * document (`manifest.json`, no app code) that collects every `PLAY_SOUND` the
 * background broadcasts and reads the persisted store. It stands in for "the
 * popup is closed": it never ticks, never writes, never plays.
 */
export interface Harness {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly spy: Page;
}

export async function launchHarness(): Promise<Harness> {
  const context = await launchExtensionContext();
  const extensionId = await extensionIdOf(context);
  const spy = await context.newPage();
  await spy.goto(`chrome-extension://${extensionId}/manifest.json`);
  await spy.evaluate(() => {
    const target = globalThis as unknown as SoundWindow;
    target.__played = [];
    chrome.runtime.onMessage.addListener((message) => {
      const { type, payload } = message as { type?: string; payload?: PlayedSound };
      if (type === 'PLAY_SOUND' && payload) target.__played?.push(payload);
    });
  });
  // Every site below is fake: no test depends on the real internet.
  await context.route(/^https?:\/\/([^/]+\.)?(facebook|example)\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blocked</title><h1>a distraction</h1>' }),
  );
  return { context, extensionId, spy };
}

/**
 * What is read before the extension has written anything (a fresh profile has no
 * stored store yet): neutral values that no expectation matches, so a poll keeps
 * retrying instead of throwing (`expect.poll` does not retry a thrown error).
 */
const NOTHING_STORED: StoredState = {
  timer: { status: 'unknown', durationSeconds: 0, focusedMs: 0, distractedMs: 0 },
  score: { builtCharacters: 0, level: 'unknown', population: 0 },
  blocklist: { appliedPresetIds: [], blocklist: [] },
  preferences: { sound: { enabled: true, themeId: 'unknown', volume: -1 } },
};

export const readState = async (spy: Page): Promise<StoredState> => {
  const raw = await spy.evaluate(async (key) => (await chrome.storage.local.get(key))[key], STORE_KEY);
  return raw === undefined ? NOTHING_STORED : (JSON.parse(raw) as { state: StoredState }).state;
};

export const playedSounds = (spy: Page): Promise<PlayedSound[]> =>
  spy.evaluate(() => [...((globalThis as unknown as SoundWindow).__played ?? [])]);

export async function openPopup(harness: Harness): Promise<Page> {
  const page = await harness.context.newPage();
  await page.goto(`chrome-extension://${harness.extensionId}/popup.html`);
  await page.getByRole('tab', { name: 'Timer' }).waitFor();
  return page;
}

export interface SessionSetup {
  readonly themeId?: string;
  readonly volume?: number;
  readonly social?: boolean;
  readonly site?: string;
}

/** Settings, 5-minute length and blocklist, all through the real popup controls. */
export async function configure(harness: Harness, setup: SessionSetup = {}): Promise<void> {
  const popup = await openPopup(harness);
  if (setup.themeId !== undefined || setup.volume !== undefined) {
    await popup.getByRole('tab', { name: 'Settings' }).click();
  }
  if (setup.themeId !== undefined) {
    const name = `${setup.themeId.slice(0, 1).toUpperCase()}${setup.themeId.slice(1)}`;
    await popup.getByRole('radio', { name }).click();
    await expect.poll(async () => (await readState(harness.spy)).preferences.sound.themeId).toBe(setup.themeId);
  }
  if (setup.volume !== undefined) {
    const slider = popup.getByRole('slider', { name: 'Volume' });
    await slider.fill(String(setup.volume));
    await slider.dispatchEvent('pointerup');
    await expect.poll(async () => (await readState(harness.spy)).preferences.sound.volume).toBe(setup.volume);
  }

  await popup.getByRole('tab', { name: 'Timer' }).click();
  const drum = popup.getByRole('spinbutton', { name: 'Focus duration' });
  await drum.focus();
  await drum.press('Home');
  await expect(drum).toHaveAttribute('aria-valuenow', '5');
  await expect.poll(async () => (await readState(harness.spy)).timer.durationSeconds).toBe(300);

  if (setup.social === true || setup.site !== undefined) {
    await popup.getByRole('tab', { name: 'Blocklist' }).click();
  }
  if (setup.social === true) {
    await popup.getByRole('button', { name: /^Social preset/ }).click();
    await expect.poll(async () => (await readState(harness.spy)).blocklist.appliedPresetIds).toContain('social');
  }
  if (setup.site !== undefined) {
    await popup.getByRole('textbox', { name: 'Add to blocklist' }).fill(setup.site);
    await popup.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.poll(async () => (await readState(harness.spy)).blocklist.blocklist.length).toBeGreaterThan(0);
  }
  await popup.close();
}

/** Starts the session from the popup and closes it, as a user would. */
export async function startSession(harness: Harness): Promise<number> {
  const popup = await openPopup(harness);
  await popup.getByRole('button', { name: 'Start' }).click();
  await popup.getByRole('button', { name: 'Pause' }).waitFor();
  const startedAt = Date.now();
  await popup.close();
  return startedAt;
}

/** Opens a (fake) blocked site, checks the overlay shows, stays, then closes it. */
export async function visitBlockedSite(harness: Harness, url: string, stayMs: number): Promise<void> {
  const tab = await harness.context.newPage();
  await tab.goto(url);
  await expect(tab.locator(`#${OVERLAY_HOST_ID}`)).toBeAttached();
  await tab.waitForTimeout(stayMs);
  await tab.close();
}

/** Waits for the natural end of the session and returns the final state. */
export async function waitForCompletion(harness: Harness, startedAt: number): Promise<StoredState> {
  const remainingMs = Math.max(0, SESSION_MS - (Date.now() - startedAt));
  await expect
    .poll(async () => (await readState(harness.spy)).timer.status, { timeout: remainingMs + 60_000, intervals: [2_000] })
    .toBe('completed');
  return readState(harness.spy);
}
