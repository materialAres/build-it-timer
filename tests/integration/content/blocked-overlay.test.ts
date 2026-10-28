import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  startBlockedOverlay,
  createStoreReader,
  type StoreReader,
} from '@/entrypoints/blocked-overlay.content.tsx';
import { onMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import {
  STORE_STORAGE_KEY,
  type StoreSnapshot,
} from '@/lib/blocking/store-snapshot';
import type { BlocklistEntry } from '@/store/store.types';
import { createLogger, type LogRecord } from '@/utils/logger';

const HOST_ID = 'buildit-blocked-overlay';

function captureLogger(): {
  records: LogRecord[];
  logger: ReturnType<typeof createLogger>;
} {
  const records: LogRecord[] = [];
  const logger = createLogger('content-test', {
    sink: (record) => {
      records.push(record);
    },
    minLevel: 'debug',
  });
  return { records, logger };
}

const entry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

/** Store stub, so the tests never depend on the real persist envelope. */
function fakeStoreReader(initial: StoreSnapshot | undefined) {
  let snapshot = initial;
  const listeners = new Set<() => void>();

  return {
    reader: {
      current: () => snapshot,
      refresh: () => Promise.resolve(snapshot),
      subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    /** Simulate a later storage write (e.g. the blocklist being edited). */
    update: async (next: StoreSnapshot | undefined): Promise<void> => {
      snapshot = next;
      for (const listener of [...listeners]) listener();
      // Let the refresh/evaluate microtask chain settle.
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const runningSnapshot = (blocklist: string[]): StoreSnapshot => ({
  timerStatus: 'running',
  blocklist: blocklist.map(entry),
});

function host(): HTMLElement | null {
  return document.getElementById(HOST_ID);
}

function overlayText(): string {
  return host()?.shadowRoot?.textContent ?? '';
}

describe('blocked overlay content script (M2.T8)', () => {
  let ctx: ContentScriptContext;
  let teardown: (() => void) | undefined;

  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
    ctx = new ContentScriptContext('blocked-overlay-test');
  });

  afterEach(() => {
    teardown?.();
    teardown = undefined;
    document.body.innerHTML = '';
  });

  it('mounts the overlay on a blocked domain during a running session', async () => {
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://m.facebook.com/feed',
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    expect(overlayText()).toContain('facebook.com');
  });

  it('isolates the overlay in a shadow root that the page cannot style', async () => {
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    const shadow = host()?.shadowRoot;
    expect(shadow).not.toBeNull();
    // The host itself carries no page-visible content: everything lives inside
    // the shadow root, so no page stylesheet can reach it.
    expect(host()?.childNodes).toHaveLength(0);
    expect(shadow?.querySelector('.blocked-overlay')).not.toBeNull();
    expect(shadow?.querySelector('style')?.textContent).toContain('all: initial');
  });

  it('does not mount when the timer is not running', async () => {
    const { reader } = fakeStoreReader({ ...runningSnapshot(['facebook.com']), timerStatus: 'idle' });

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(host()).toBeNull();
  });

  it('does not mount on a domain that is not blocked', async () => {
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, { storeReader: reader, url: 'https://example.com/' });
    await Promise.resolve();
    await Promise.resolve();

    expect(host()).toBeNull();
  });

  it('does not crash on a URL without a registrable domain', async () => {
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, { storeReader: reader, url: 'about:blank' });
    await Promise.resolve();
    await Promise.resolve();

    expect(host()).toBeNull();
  });

  it('mounts a single overlay when the script runs twice on the same page', async () => {
    const first = fakeStoreReader(runningSnapshot(['facebook.com']));
    const second = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, { storeReader: first.reader, url: 'https://facebook.com/' });
    startBlockedOverlay(ctx, { storeReader: second.reader, url: 'https://facebook.com/' });
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
  });

  it('reacts to a blocklist change that arrives while the page is open', async () => {
    const { reader, update } = fakeStoreReader({ timerStatus: 'running', blocklist: [] });

    teardown = startBlockedOverlay(ctx, { storeReader: reader, url: 'https://facebook.com/' });
    await Promise.resolve();
    await Promise.resolve();
    expect(host()).toBeNull();

    await update(runningSnapshot(['facebook.com']));
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    await update({ timerStatus: 'running', blocklist: [] });
    await vi.waitFor(() => {
      expect(host()).toBeNull();
    });
  });

  it('sends SITE_BLOCKED_ATTEMPT with "proceed" when "Yes" is chosen', async () => {
    const received: RuntimeMessage[] = [];
    const unsubscribe = onMessage('SITE_BLOCKED_ATTEMPT', (message) => {
      received.push(message);
    });
    const sendAttempt = vi.fn(() => Promise.resolve());

    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));
    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');

    expect(sendAttempt).toHaveBeenCalledWith('facebook.com', 'proceed');
    expect(received).toEqual([]); // the injected sender replaces the real bus
    unsubscribe();
  });

  it('closes the overlay after "Yes" and leaves the page usable', async () => {
    const sendAttempt = vi.fn(() => Promise.resolve());
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');
    await vi.waitFor(() => {
      expect(host()).toBeNull();
    });
  });

  it('does not bring the overlay back after "Yes" when the store refreshes', async () => {
    // The attempt itself writes the store (distracted time, malus), so the
    // reader observes a fresh snapshot of the same running session right after
    // the click — the exact sequence that used to re-mount the overlay.
    const sendAttempt = vi.fn(() => Promise.resolve());
    const { reader, update } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');
    await vi.waitFor(() => {
      expect(host()).toBeNull();
    });

    await update(runningSnapshot(['facebook.com']));

    expect(host()).toBeNull();
    expect(sendAttempt).toHaveBeenCalledTimes(1);
  });

  it('reports "go-back" and navigates back when "No" is chosen, without any malus', async () => {
    const sendAttempt = vi.fn(() => Promise.resolve());
    const goBack = vi.fn();
    const malus: RuntimeMessage[] = [];
    const unsubscribe = onMessage('MALUS_APPLIED', (message) => {
      malus.push(message);
    });

    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));
    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
      goBack,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('No');

    expect(sendAttempt).toHaveBeenCalledWith('facebook.com', 'go-back');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(malus).toEqual([]);
    unsubscribe();
  });

  it('keeps the encouragement on screen when there is no history to go back to', async () => {
    const sendAttempt = vi.fn(() => Promise.resolve());
    const goBack = vi.fn(); // stands in for a tab with nothing to return to
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
      goBack,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('No');

    await vi.waitFor(() => {
      expect(overlayText()).toContain('Great! Keep focusing!');
    });
    expect(overlayText()).not.toContain('Are you sure');
  });

  it('logs a failed background send and leaves the page alive', async () => {
    // No listener registered on the bus: `sendMessage` returns `{ ok: false }`.
    const { records, logger } = captureLogger();
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      logger,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');

    await vi.waitFor(() => {
      expect(host()).toBeNull();
      expect(
        records.some(
          (record) => record.message === 'blocked attempt could not be sent',
        ),
      ).toBe(true);
    });
    // The page is untouched and the script is still alive.
    expect(ctx.isValid).toBe(true);
  });

  it('logs a rejected store refresh and leaves the page alive', async () => {
    const { records, logger } = captureLogger();
    const reader: StoreReader = {
      current: () => undefined,
      refresh: () => Promise.reject(new Error('storage unavailable')),
      subscribe: () => () => undefined,
    };

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      logger,
    });

    await vi.waitFor(() => {
      expect(
        records.some((record) => record.message === 'store refresh failed'),
      ).toBe(true);
    });

    const failure = records.find(
      (record) => record.message === 'store refresh failed',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('content-test');
    expect(failure?.details[0]).toBeInstanceOf(Error);
    expect((failure?.details[0] as Error).message).toBe('storage unavailable');
    expect(failure?.details[1]).toEqual({ key: STORE_STORAGE_KEY });
    expect(host()).toBeNull();
    expect(ctx.isValid).toBe(true);
    expect(JSON.stringify(records)).not.toContain('facebook.com');
  });

  it('logs an unreadable persisted snapshot without leaking its contents', async () => {
    const { records, logger } = captureLogger();
    await fakeBrowser.storage.local.set({
      [STORE_STORAGE_KEY]:
        '{"state":{"blocklist":{"blocklist":[{"domain":{"value":"facebook.com"',
    });

    teardown = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(logger),
      url: 'https://facebook.com/',
    });

    await vi.waitFor(() => {
      expect(
        records.some(
          (record) => record.message === 'unreadable persisted snapshot',
        ),
      ).toBe(true);
    });

    const failure = records.find(
      (record) => record.message === 'unreadable persisted snapshot',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('content-test');
    // No cause: V8 can quote the malformed JSON in a SyntaxError message.
    expect(failure?.details).toEqual([{ key: STORE_STORAGE_KEY }]);
    expect(host()).toBeNull();
    expect(JSON.stringify(records)).not.toContain('facebook.com');
  });

  it('does not log when the persisted store is absent', async () => {
    const { records, logger } = captureLogger();
    const reader = createStoreReader(logger);

    await expect(reader.refresh()).resolves.toBeUndefined();

    expect(records).toEqual([]);
  });

  it('logs a rejected attempt and leaves the page alive after the overlay closes', async () => {
    const { records, logger } = captureLogger();
    const sendAttempt = vi.fn(() =>
      Promise.reject(new Error('background unavailable')),
    );
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
      logger,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');

    await vi.waitFor(() => {
      expect(
        records.some(
          (record) => record.message === 'blocked attempt could not be sent',
        ),
      ).toBe(true);
    });

    const failure = records.find(
      (record) => record.message === 'blocked attempt could not be sent',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('content-test');
    expect(failure?.details[0]).toBeInstanceOf(Error);
    expect(failure?.details[1]).toEqual({ choice: 'proceed' });
    expect(host()).toBeNull();
    expect(ctx.isValid).toBe(true);
    expect(JSON.stringify(records)).not.toContain('facebook.com');
  });

  it('uses the real storage reader against the persisted key', async () => {
    await fakeBrowser.storage.local.set({
      'timer-focus-store': JSON.stringify({
        state: {
          timer: { status: 'running' },
          blocklist: { blocklist: [entry('facebook.com')], customTags: [] },
        },
        version: 2,
      }),
    });

    teardown = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(),
      url: 'https://facebook.com/',
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    expect(overlayText()).toContain('facebook.com');
  });

  it('reads a legacy persisted payload through the migration (CR1.T4)', async () => {
    // `facebook.com` was on both lists under the old "allowlist wins" rule, so
    // it must no longer mount; `instagram.com` stays blocked.
    await fakeBrowser.storage.local.set({
      'timer-focus-store': JSON.stringify({
        state: {
          timer: { status: 'running' },
          blocklist: {
            allowlist: [entry('facebook.com')],
            blocklist: [entry('facebook.com'), entry('instagram.com')],
            customTags: [],
          },
        },
        version: 1,
      }),
    });

    teardown = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(),
      url: 'https://facebook.com/',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(host()).toBeNull();

    teardown();
    teardown = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(),
      url: 'https://instagram.com/',
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });
    expect(overlayText()).toContain('instagram.com');
  });

  it('does not mount for a domain present only in the legacy allowlist (CR1.T4)', async () => {
    await fakeBrowser.storage.local.set({
      'timer-focus-store': JSON.stringify({
        state: {
          timer: { status: 'running' },
          blocklist: {
            allowlist: [entry('facebook.com')],
            blocklist: [],
            customTags: [],
          },
        },
        version: 1,
      }),
    });

    teardown = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(),
      url: 'https://facebook.com/',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(host()).toBeNull();
  });

  it('removes the overlay when the content script context is invalidated', async () => {
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    startBlockedOverlay(ctx, { storeReader: reader, url: 'https://facebook.com/' });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    ctx.notifyInvalidated();

    expect(host()).toBeNull();
  });

  it('removes the storage subscription on teardown', () => {
    const addListener = vi.spyOn(browser.storage.onChanged, 'addListener');
    const removeListener = vi.spyOn(browser.storage.onChanged, 'removeListener');

    const teardownReader = startBlockedOverlay(ctx, {
      storeReader: createStoreReader(),
      url: 'https://facebook.com/',
    });
    teardownReader();

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledTimes(1);

    addListener.mockRestore();
    removeListener.mockRestore();
  });
});

/** Clicks a button inside the overlay's shadow root (Testing Library cannot see it). */
function clickShadowButton(label: string): void {
  const button = [...(host()?.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent === label,
  );
  if (button === undefined) throw new Error(`No "${label}" button in the overlay`);
  button.click();
}
