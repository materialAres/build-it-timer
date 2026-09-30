import { browser } from 'wxt/browser';
import { STORE_NAME } from './index';

/**
 * The minimal slice of a `zustand/persist`-enhanced store that this module
 * needs. Declared structurally (instead of importing `AppStore`) to keep the
 * helper decoupled from the concrete store shape and free of a runtime import
 * cycle with `store/index.ts` (principle D).
 */
export interface SyncableStore {
  readonly persist: {
    readonly rehydrate: () => Promise<void> | void;
  };
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
 * Why this cannot loop: `persist` rehydrates through the raw store `set`, not
 * the persisting wrapper, so handling an external change does **not** write
 * back to storage and therefore cannot echo.
 *
 * Returns an unsubscribe function; call it to stop syncing.
 */
export function attachStoreSync(store: SyncableStore): () => void {
  const listener = (changes: Record<string, unknown>, areaName: string): void => {
    // Only `storage.local` backs the persisted store; other areas are unrelated.
    if (areaName !== 'local') return;
    if (!(STORE_NAME in changes)) return;

    void Promise.resolve(store.persist.rehydrate());
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
