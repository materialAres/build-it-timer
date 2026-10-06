import { createRoot, type Root } from 'react-dom/client';
import { browser, type Browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { BlockedOverlay } from '@/components/common/BlockedOverlay';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import { parseStoreSnapshot, STORE_STORAGE_KEY, type StoreSnapshot } from '@/lib/blocking/store-snapshot';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { sendMessage } from '@/lib/messaging/bus';

/**
 * Marks the shadow host so a second run of this script on the same page (WXT
 * re-injects on some navigations, and `main` can be invoked twice in tests) can
 * recognise its own overlay instead of stacking a duplicate on top of it.
 */
const HOST_ID = 'buildit-blocked-overlay';

/** Read-only view of the persisted store, kept up to date while the page lives. */
export interface StoreReader {
  /** Latest snapshot, or `undefined` when storage is empty/unreadable. */
  current(): StoreSnapshot | undefined;
  /** Re-read storage; resolves to the fresh snapshot. */
  refresh(): Promise<StoreSnapshot | undefined>;
  /** Subscribe to changes of the persisted key. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * Reads the persisted store straight from `browser.storage.local` (M2.T8).
 *
 * Deliberately *not* the zustand store: the content script needs only two
 * fields (the timer status and the two lists), and pulling the store in would
 * drag `persist`, the alarm adapter, and the whole slice graph into every page
 * the user visits. Storage is the same source of truth the store persists to,
 * so there is no divergence; the key and the envelope shape are owned by
 * `parseStoreSnapshot`.
 */
export function createStoreReader(): StoreReader {
  let snapshot: StoreSnapshot | undefined;

  const refresh = async (): Promise<StoreSnapshot | undefined> => {
    const raw = await browser.storage.local.get(STORE_STORAGE_KEY);
    const parsed = parseStoreSnapshot(raw[STORE_STORAGE_KEY]);
    snapshot = parsed.ok ? parsed.value : undefined;
    return snapshot;
  };

  return {
    current: () => snapshot,
    refresh,
    subscribe(listener: () => void): () => void {
      const handleChange = (
        changes: Record<string, Browser.storage.StorageChange>,
        areaName: string,
      ): void => {
        // Only `storage.local` backs the persisted store; other areas are unrelated.
        if (areaName !== 'local') return;
        if (changes[STORE_STORAGE_KEY] === undefined) return;
        listener();
      };

      browser.storage.onChanged.addListener(handleChange);
      return () => {
        browser.storage.onChanged.removeListener(handleChange);
      };
    },
  };
}

export type BlockedChoice = 'proceed' | 'go-back';

export interface BlockedOverlayDependencies {
  /** Store reader; injectable so tests drive the blocklist without real storage. */
  readonly storeReader?: StoreReader;
  /** URL to evaluate; defaults to the page's current location. */
  readonly url?: string;
  /** Reports the user's choice to the background (M1.T6 bus). */
  readonly sendAttempt?: (domain: string, choice: BlockedChoice) => Promise<void>;
  /** Navigates the tab back after "No"; defaults to `history.back()`. */
  readonly goBack?: () => void;
}

/**
 * Mounts the overlay when the page the user is on is on the blocklist during a
 * running session (M2.T8).
 *
 * This is the gate for top-level navigation: the DNR rules deliberately do not
 * block `main_frame` (see `lib/blocking/rules.ts`), because a blocked
 * navigation never produces a document to overlay.
 *
 * Returns a teardown function. Running the script twice on the same page yields
 * exactly one overlay (idempotence), because the host is found by `HOST_ID`.
 */
export function startBlockedOverlay(
  ctx: ContentScriptContext,
  dependencies: BlockedOverlayDependencies = {},
): () => void {
  const reader = dependencies.storeReader ?? createStoreReader();
  const url = dependencies.url ?? window.location.href;
  const sendAttempt =
    dependencies.sendAttempt ??
    (async (domain: string, choice: BlockedChoice): Promise<void> => {
      await sendMessage({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain, choice } });
    });
  const goBack =
    dependencies.goBack ??
    ((): void => {
      window.history.back();
    });

  let root: Root | undefined;
  let dismissed = false;

  const host = (): HTMLElement | undefined =>
    document.getElementById(HOST_ID) ?? undefined;

  const unmount = (): void => {
    root?.unmount();
    root = undefined;
    host()?.remove();
  };

  const mount = (domain: string): void => {
    if (host() !== undefined) return;

    const element = document.createElement('div');
    element.id = HOST_ID;
    // Open shadow root: the page cannot style the overlay's internals, while
    // the e2e tests can still reach them through `host.shadowRoot`.
    const shadow = element.attachShadow({ mode: 'open' });
    root = createRoot(shadow);
    document.body.append(element);

    render();
    function render(): void {
      root?.render(
        <BlockedOverlay
          domain={domain}
          dismissed={dismissed}
          onProceed={() => {
            unmount();
            void sendAttempt(domain, 'proceed');
          }}
          onGoBack={() => {
            // Reported even though no malus follows: the background learns the
            // user backed off, and the payload is what M2.T10 keys on.
            void sendAttempt(domain, 'go-back');
            // The encouragement replaces the question rather than the overlay
            // disappearing: `goBack` may be a no-op when the tab has no history
            // to return to, and then the message is the only feedback left.
            dismissed = true;
            render();
            goBack();
          }}
        />,
      );
    }
  };

  const evaluate = (): void => {
    const snapshot = reader.current();
    if (snapshot === undefined || snapshot.timerStatus !== 'running') {
      unmount();
      return;
    }

    // The tab URL is untrusted; `normalizeEntry` (M2.T21) is the same
    // canonicalizer the background navigation check and the entry path use.
    const domain = normalizeEntry(url);
    if (!domain.ok) return;
    if (!isDomainBlocked(snapshot, domain.value)) {
      unmount();
      return;
    }

    // Re-evaluating must not resurrect the overlay the user already dismissed.
    if (dismissed) return;
    mount(domain.value);
  };

  void reader.refresh().then(() => {
    if (!ctx.isValid) return;
    evaluate();
  });

  const unsubscribe = reader.subscribe(() => {
    void reader.refresh().then(() => {
      if (!ctx.isValid) return;
      evaluate();
    });
  });

  const detach = (): void => {
    unsubscribe();
    unmount();
  };
  ctx.onInvalidated(detach);

  return detach;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  // The store read is asynchronous, so a decision at `document_start` is not
  // possible; `document_idle` guarantees `document.body` exists for the host
  // element. Trade-off: the page paints briefly before the overlay covers it.
  runAt: 'document_idle',
  main(ctx) {
    startBlockedOverlay(ctx);
  },
});
