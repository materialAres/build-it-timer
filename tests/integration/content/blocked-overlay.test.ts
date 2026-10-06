import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { startBlockedOverlay, createStoreReader } from '@/entrypoints/blocked-overlay.content.tsx';
import { onMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import type { StoreSnapshot } from '@/lib/blocking/store-snapshot';
import type { BlocklistEntry } from '@/store/store.types';

const HOST_ID = 'buildit-blocked-overlay';

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
  allowlist: [],
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

  it('lets the allowlist win over the blocklist (same rule as M2.T6)', async () => {
    const { reader } = fakeStoreReader({
      timerStatus: 'running',
      allowlist: [entry('facebook.com')],
      blocklist: [entry('facebook.com')],
    });

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
    });
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
    const { reader, update } = fakeStoreReader({ timerStatus: 'running', allowlist: [], blocklist: [] });

    teardown = startBlockedOverlay(ctx, { storeReader: reader, url: 'https://facebook.com/' });
    await Promise.resolve();
    await Promise.resolve();
    expect(host()).toBeNull();

    await update(runningSnapshot(['facebook.com']));
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    await update({ timerStatus: 'running', allowlist: [], blocklist: [] });
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

  it('survives a background that does not respond', async () => {
    // No listener registered on the bus: `sendMessage` resolves with `{ ok: false }`.
    const { reader } = fakeStoreReader(runningSnapshot(['facebook.com']));

    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });

    clickShadowButton('Yes');

    await vi.waitFor(() => {
      expect(host()).toBeNull();
    });
    // The page is untouched and the script is still alive.
    expect(ctx.isValid).toBe(true);
  });

  it('uses the real storage reader against the persisted key', async () => {
    await fakeBrowser.storage.local.set({
      'timer-focus-store': JSON.stringify({
        state: {
          timer: { status: 'running' },
          blocklist: { allowlist: [], blocklist: [entry('facebook.com')], customTags: [] },
        },
        version: 1,
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
