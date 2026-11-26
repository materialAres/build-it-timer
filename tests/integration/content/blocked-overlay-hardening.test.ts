import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { startBlockedOverlay } from '@/entrypoints/blocked-overlay.content.tsx';
import type { StoreSnapshot } from '@/lib/blocking/store-snapshot';
import type { BlocklistEntry } from '@/store/store.types';

const HOST_ID = 'buildit-blocked-overlay';

const entry = (domain: string): BlocklistEntry => ({
  domain: { value: domain },
  manual: true,
  presetIds: [],
});

const snapshot: StoreSnapshot = {
  timerStatus: 'running',
  blocklist: [entry('facebook.com')],
};

const reader = {
  current: () => snapshot,
  refresh: () => Promise.resolve(snapshot),
  subscribe: () => () => undefined,
};

const host = (): HTMLElement | null => document.getElementById(HOST_ID);

function button(label: string): HTMLButtonElement {
  const found = [...(host()?.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent === label,
  );
  if (found === undefined) throw new Error(`No "${label}" button in the overlay`);
  return found;
}

/** Lets pending mutation observers and microtasks run. */
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

describe('blocked overlay against the host page (M6.T4)', () => {
  let ctx: ContentScriptContext;
  let teardown: (() => void) | undefined;
  const sendAttempt = vi.fn(() => Promise.resolve());
  const goBack = vi.fn();

  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
    sendAttempt.mockClear();
    goBack.mockClear();
    ctx = new ContentScriptContext('blocked-overlay-hardening-test');
  });

  afterEach(() => {
    teardown?.();
    teardown = undefined;
    document.body.innerHTML = '';
  });

  async function mountOverlay(
    overrides: Parameters<typeof startBlockedOverlay>[1] = {},
  ): Promise<void> {
    teardown = startBlockedOverlay(ctx, {
      storeReader: reader,
      url: 'https://facebook.com/',
      sendAttempt,
      goBack,
      ...overrides,
    });
    await vi.waitFor(() => {
      expect(host()).not.toBeNull();
    });
  }

  describe('only real user input answers the overlay', () => {
    // No `isTrustedEvent` injected: `click()` is fired by script, so its event
    // is untrusted, exactly like the page's own `shadowRoot.querySelector(...).click()`.
    it('ignores a script-fired "Open anyway": nothing is sent and the overlay stays', async () => {
      await mountOverlay();

      button('Open anyway').click();
      await settle();

      expect(sendAttempt).not.toHaveBeenCalled();
      expect(host()).not.toBeNull();
    });

    it('ignores a script-fired "Back to work": nothing is sent and the page does not navigate', async () => {
      await mountOverlay();

      button('Back to work').click();
      await settle();

      expect(sendAttempt).not.toHaveBeenCalled();
      expect(goBack).not.toHaveBeenCalled();
      expect(host()?.shadowRoot?.textContent).toContain('Open anyway');
    });

    it('ignores a synthetic event dispatched with the right shape', async () => {
      await mountOverlay();

      button('Open anyway').dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      await settle();

      expect(sendAttempt).not.toHaveBeenCalled();
      expect(host()).not.toBeNull();
    });

    it('still answers when the injected check trusts the event', async () => {
      const isTrustedEvent = vi.fn(() => true);
      await mountOverlay({ isTrustedEvent });

      button('Open anyway').click();

      expect(isTrustedEvent).toHaveBeenCalledTimes(1);
      expect(sendAttempt).toHaveBeenCalledWith('facebook.com', 'proceed');
      await vi.waitFor(() => {
        expect(host()).toBeNull();
      });
    });

    it('asks the check about the click that happened, not a stale event', async () => {
      const seen: boolean[] = [];
      await mountOverlay({
        isTrustedEvent: (event) => {
          seen.push(event.type === 'click');
          return false;
        },
      });

      button('Back to work').click();

      expect(seen).toEqual([true]);
    });
  });

  describe('the page cannot get rid of the overlay', () => {
    it('mounts it again when the page removes the host element', async () => {
      await mountOverlay();

      host()?.remove();
      expect(host()).toBeNull();

      await vi.waitFor(() => {
        expect(host()).not.toBeNull();
      });
      expect(host()?.shadowRoot?.textContent).toContain('facebook.com');
    });

    it('mounts it again when the page replaces document.body', async () => {
      await mountOverlay();

      document.body.replaceWith(document.createElement('body'));
      expect(host()).toBeNull();

      await vi.waitFor(() => {
        expect(host()).not.toBeNull();
      });
      expect(document.body.contains(host())).toBe(true);
    });

    it('keeps a single overlay however often the page removes it', async () => {
      await mountOverlay();

      for (let round = 0; round < 3; round += 1) {
        host()?.remove();
        await vi.waitFor(() => {
          expect(host()).not.toBeNull();
        });
      }

      expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    });

    it('does not bring it back after the user answered "Open anyway"', async () => {
      await mountOverlay({ isTrustedEvent: () => true });
      button('Open anyway').click();
      await vi.waitFor(() => {
        expect(host()).toBeNull();
      });

      await settle();
      document.body.append(document.createElement('div'));
      await settle();

      expect(host()).toBeNull();
    });

    it('does not bring it back after teardown', async () => {
      await mountOverlay();

      teardown?.();
      teardown = undefined;
      await settle();

      expect(host()).toBeNull();
    });

    it('does not mount again when the session is no longer running', async () => {
      let status: StoreSnapshot['timerStatus'] = 'running';
      await mountOverlay({
        storeReader: { ...reader, current: () => ({ ...snapshot, timerStatus: status }) },
      });

      status = 'idle';
      host()?.remove();
      await settle();

      expect(host()).toBeNull();
    });
  });

  describe('the content script reads nothing from the page', () => {
    it('registers no `message` listener on window or document', async () => {
      const onWindow = vi.spyOn(window, 'addEventListener');
      const onDocument = vi.spyOn(document, 'addEventListener');

      await mountOverlay();

      const registered = [...onWindow.mock.calls, ...onDocument.mock.calls].map(
        ([type]) => type,
      );
      expect(registered).not.toContain('message');
      onWindow.mockRestore();
      onDocument.mockRestore();
    });

    it('does not take the domain from the page content', async () => {
      document.body.innerHTML = '<h1>evil.com</h1><a href="https://evil.com">x</a>';

      await mountOverlay();

      expect(host()?.shadowRoot?.textContent).toContain('facebook.com');
      expect(host()?.shadowRoot?.textContent).not.toContain('evil.com');
    });
  });
});
