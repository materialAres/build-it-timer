import { createRoot, type Root } from 'react-dom/client';
import { browser, type Browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { BlockedOverlay } from '@/components/common/BlockedOverlay';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import { parseStoreSnapshot, STORE_STORAGE_KEY, type StoreSnapshot } from '@/lib/blocking/store-snapshot';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { createHostWatcher, type HostWatcher } from '@/lib/browser/host-watcher';
import { sendMessage } from '@/lib/messaging/bus';
import { createLogger, type Logger } from '@/utils/logger';

/**
 * Marks the shadow host so a second run of this script on the same page (WXT
 * re-injects on some navigations, and `main` can be invoked twice in tests) can
 * recognise its own overlay instead of stacking a duplicate on top of it.
 */
const HOST_ID = 'buildit-blocked-overlay';

const defaultLogger = createLogger('content:blocked-overlay');

// The page shares the DOM but cannot reach this script's variables, so an id
// can be forged and membership of this set cannot (PR10.T3).
const ownHosts = new WeakSet<HTMLElement>();

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
 * fields (the timer status and the blocklist), and pulling the store in would
 * drag `persist`, the alarm adapter, and the whole slice graph into every page
 * the user visits. Storage is the same source of truth the store persists to,
 * so there is no divergence; the key and the envelope shape are owned by
 * `parseStoreSnapshot`.
 */
export function createStoreReader(
  logger: Logger = createLogger('content:store-reader'),
): StoreReader {
  let snapshot: StoreSnapshot | undefined;

  const refresh = async (): Promise<StoreSnapshot | undefined> => {
    const raw = await browser.storage.local.get(STORE_STORAGE_KEY);
    const rawValue = raw[STORE_STORAGE_KEY];
    const parsed = parseStoreSnapshot(rawValue);
    if (!parsed.ok) {
      // A missing key is the normal pre-onboarding state and stays silent.
      // Only a *present* value that cannot be parsed is a diagnostic. Do not
      // attach the parse cause: V8 can quote the persisted JSON (which holds
      // the user's domains) in a SyntaxError message.
      if (rawValue !== undefined) {
        logger.error('unreadable persisted snapshot', undefined, {
          key: STORE_STORAGE_KEY,
        });
      }
      snapshot = undefined;
      return snapshot;
    }

    snapshot = parsed.value;
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
  /** Diagnostics sink (M4.T3e); defaults to scope `content:blocked-overlay`. */
  readonly logger?: Logger;
  /**
   * Whether a click comes from the user (M6.T4). Defaults to `event.isTrusted`,
   * which is `false` for anything the page's own scripts fire. Injectable
   * because the synthetic events of component tests are untrusted too.
   */
  readonly isTrustedEvent?: (event: Event) => boolean;
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
 * exactly one overlay (idempotence), because the host is found among the
 * elements this module created (`ownHosts`), not by `HOST_ID` alone.
 */
export function startBlockedOverlay(
  ctx: ContentScriptContext,
  dependencies: BlockedOverlayDependencies = {},
): () => void {
  const logger = dependencies.logger ?? defaultLogger;
  const reader =
    dependencies.storeReader ?? createStoreReader(logger.child('store-reader'));
  const url = dependencies.url ?? window.location.href;
  const sendAttempt =
    dependencies.sendAttempt ??
    (async (domain: string, choice: BlockedChoice): Promise<void> => {
      const result = await sendMessage({
        type: 'SITE_BLOCKED_ATTEMPT',
        payload: { domain, choice },
      });
      // `sendMessage` turns a missing listener into a failed Result instead of
      // a rejection. Surface it as a rejection so the caller's boundary logs it.
      if (!result.ok) throw result.error;
    });
  const isTrustedEvent =
    dependencies.isTrustedEvent ?? ((event: Event): boolean => event.isTrusted);
  const goBack =
    dependencies.goBack ??
    ((): void => {
      window.history.back();
    });

  let root: Root | undefined;
  let dismissed = false;
  // "Yes" hands the page over for the rest of the visit. The attempt itself
  // writes the store (distracted time, malus), so the reader fires a refresh
  // right afterwards; without this flag `evaluate` would see a still-blocked
  // running session and mount the overlay again.
  let proceeded = false;

  const host = (): HTMLElement | undefined =>
    [...document.querySelectorAll<HTMLElement>(`#${HOST_ID}`)].find((candidate) =>
      ownHosts.has(candidate),
    );

  // Watches the page while the overlay is up (M6.T4): a page that removes the
  // host, or replaces `document.body`, would otherwise hide the overlay until
  // the next storage change. Only alive while mounted, so a page that is not
  // blocked pays nothing for it.
  let hostWatcher: HostWatcher | undefined;

  const unmount = (): void => {
    hostWatcher?.disconnect();
    hostWatcher = undefined;
    try {
      root?.unmount();
    } catch (error: unknown) {
      // The page emptied the shadow root, so React's nodes are already gone.
      // Keep going: the host must still be removed for the remount to happen.
      logger.error('overlay root could not be unmounted cleanly', error);
    }
    root = undefined;
    host()?.remove();
  };

  const watchHost = (shadow: ShadowRoot): void => {
    hostWatcher = createHostWatcher({
      // The open shadow root is watched too: the page can empty it without
      // touching the host. React's own renders keep `.blocked-overlay`, so they
      // do not count as a loss.
      targets: [document.documentElement, shadow],
      isLost: () =>
        ctx.isValid && (host() === undefined || shadow.querySelector('.blocked-overlay') === null),
      // The page took the overlay away: drop the orphaned React root and let
      // `evaluate` decide again (running, blocked, not yet answered).
      onLost: () => {
        unmount();
        evaluate();
      },
    });
  };

  // The background may be absent, restarting, or rejecting the message. The
  // user's choice is fire-and-forget, but its failure must not become an
  // unhandled rejection. Log the choice only — the domain is user data.
  const reportAttempt = (domain: string, choice: BlockedChoice): void => {
    const onFailure = (error: unknown): void => {
      logger.error('blocked attempt could not be sent', error, { choice });
    };

    try {
      void sendAttempt(domain, choice).catch(onFailure);
    } catch (error: unknown) {
      onFailure(error);
    }
  };

  const mount = (domain: string): void => {
    if (host() !== undefined) return;

    const element = document.createElement('div');
    element.id = HOST_ID;
    // Open shadow root: the page cannot style the overlay's internals, while
    // the e2e tests can still reach them through `host.shadowRoot`.
    const shadow = element.attachShadow({ mode: 'open' });
    root = createRoot(shadow);
    ownHosts.add(element);
    document.body.append(element);
    watchHost(shadow);

    render();
    function render(): void {
      root?.render(
        <BlockedOverlay
          domain={domain}
          dismissed={dismissed}
          onProceed={(event) => {
            if (!isTrustedEvent(event.nativeEvent)) return;
            proceeded = true;
            unmount();
            reportAttempt(domain, 'proceed');
          }}
          onGoBack={(event) => {
            if (!isTrustedEvent(event.nativeEvent)) return;
            // Reported even though no malus follows: the background learns the
            // user backed off, and the payload is what M2.T10 keys on.
            reportAttempt(domain, 'go-back');
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

    // Re-evaluating must not resurrect the overlay the user already answered:
    // "No" keeps the encouragement mounted, "Yes" must leave the page alone.
    if (dismissed || proceeded) return;
    mount(domain.value);
  };

  const onRefreshFailure = (error: unknown): void => {
    logger.error('store refresh failed', error, { key: STORE_STORAGE_KEY });
  };

  const refreshAndEvaluate = (): void => {
    try {
      void reader.refresh().then(() => {
        if (!ctx.isValid) return;
        evaluate();
      }, onRefreshFailure);
    } catch (error: unknown) {
      // A custom reader may throw before returning its promise. Treat it like
      // a rejection so the page and the overlay lifecycle stay alive.
      onRefreshFailure(error);
    }
  };

  refreshAndEvaluate();

  const unsubscribe = reader.subscribe(() => {
    refreshAndEvaluate();
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
