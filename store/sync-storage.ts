import { browser } from 'wxt/browser';
import { STORE_NAME } from './index';
import { SELF_WRITE, type BrowserStateStorage } from './storage-adapter';

/**
 * The minimal slice of a `zustand/persist`-enhanced store that this module
 * needs. Declared structurally (instead of importing `AppStore`) to keep the
 * helper decoupled from the concrete store shape and free of a runtime import
 * cycle with `store/index.ts` (principle D).
 *
 * `rawStorage` is the adapter the store persists through, exposed by
 * `createAppStore` (see `store/index.ts`) because `persist.getOptions().storage`
 * only yields the JSON wrapper around it.
 */
export interface SyncableStore {
  readonly persist: {
    readonly rehydrate: () => Promise<void> | void;
  };
  readonly rawStorage?: BrowserStateStorage;
}

/** Resolve the adapter carrying the self-write tracker, if the store exposes it. */
function resolveStorage(store: SyncableStore): BrowserStateStorage | undefined {
  return store.rawStorage;
}
/**
 * Keep a context's store converged on the persisted state (CI-1, "diverge"
 * half).
 *
 * `zustand/persist` hydrates only once, at store creation, and knows nothing
 * about `browser.storage.onChanged`. Because the popup and the background
 * service worker are separate JS realms, each gets its own in-memory copy of
 * the same persisted key, so a write from one context is invisible to the
 * other until it re-reads. Subscribing here rehydrates whenever another context
 * writes the store key.
 *
 * Self-writes are skipped: the single-writer context (M1.T9) rehydrating from
 * its own write is not only useless, it is harmful — `persist`'s hydration is
 * asynchronous and can land after a newer in-memory mutation, resurrecting the
 * older value. The storage's self-write tracker (see `SELF_WRITE`) identifies
 * the write we just made so it can be ignored.
 *
 * Returns an unsubscribe function; call it to stop syncing.
 */
export function attachStoreSync(store: SyncableStore): () => void {
  const storage = resolveStorage(store);

  const listener = (changes: Record<string, unknown>, areaName: string): void => {
    // Only `storage.local` backs the persisted store; other areas are unrelated.
    if (areaName !== 'local') return;
    const change = changes[STORE_NAME];
    if (change === undefined) return;

    const newValue = (change as { newValue?: unknown }).newValue;
    if (storage?.[SELF_WRITE].isSelfWrite(STORE_NAME, newValue)) return;

    void Promise.resolve(store.persist.rehydrate());
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
