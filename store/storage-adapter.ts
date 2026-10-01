import { browser } from 'wxt/browser';
import type { StateStorage } from 'zustand/middleware';

// Zustand `persist` storage backed by `browser.storage.local` instead of
// `localStorage`: the MV3 background service worker has no `window`, so
// `localStorage` is unavailable there.
export type BrowserStateStorage = StateStorage<Promise<void>> & {
  readonly [SELF_WRITE]: SelfWriteTracker;
};

/**
 * Records the values this context itself wrote, so a sync listener can tell an
 * external change apart from its own write (see `attachStoreSync`, M1.T10).
 *
 * Why this is needed: `browser.storage.onChanged` does not say who wrote. The
 * single-writer context (the background, M1.T9) would otherwise rehydrate from
 * its own writes, and that rehydration is asynchronous — it can land after a
 * newer in-memory mutation and resurrect the older value.
 */
export interface SelfWriteTracker {
  /** True when `newValue` is exactly what this context last wrote for `name`. */
  isSelfWrite(name: string, newValue: unknown): boolean;
}

/** Symbol key so the tracker travels with the storage without widening its API. */
export const SELF_WRITE: unique symbol = Symbol('self-write-tracker');

export function createBrowserStorage(): BrowserStateStorage {
  // Last value written per key by this context; consumed on the matching
  // `onChanged`. A leftover entry is harmless: it only suppresses a rehydrate
  // when an external write carries the identical value, i.e. when the store
  // already holds that state.
  const selfWrites = new Map<string, string | null>();

  return {
    async getItem(name: string): Promise<string | null> {
      const result = await browser.storage.local.get(name);
      const value = result[name];
      // Persisted values are JSON strings; anything else is treated as absent
      // rather than crashing the rehydration flow.
      return typeof value === 'string' ? value : null;
    },
    async setItem(name: string, value: string): Promise<void> {
      selfWrites.set(name, value);
      await browser.storage.local.set({ [name]: value });
    },
    async removeItem(name: string): Promise<void> {
      selfWrites.set(name, null);
      await browser.storage.local.remove(name);
    },
    [SELF_WRITE]: {
      isSelfWrite(name: string, newValue: unknown): boolean {
        if (!selfWrites.has(name)) return false;
        const expected = selfWrites.get(name);
        const actual = typeof newValue === 'string' ? newValue : null;
        if (expected !== actual) return false;
        selfWrites.delete(name);
        return true;
      },
    },
  };
}

export const browserStorage: BrowserStateStorage = createBrowserStorage();

/**
 * Read-only view over a storage (M1.T9, single-writer ownership).
 *
 * Reads pass through unchanged, so a read-only store still hydrates normally and
 * still reacts to `browser.storage.onChanged` via `attachStoreSync` (M1.T8).
 * Writes become no-ops instead of throwing: a context that is not the owner may
 * still legitimately call `setState` for its own transient/volatile state (e.g.
 * the popup's `ui` slice), and that must not crash the context nor be persisted
 * on top of the owner's copy.
 *
 * The single-writer rule is what prevents last-writer-wins clobbering between
 * the popup and the background service worker (CI-1). A non-owner context
 * changes persisted state by sending a mutation message instead (M1.T10).
 */
export function createReadOnlyStorage(
  inner: BrowserStateStorage = browserStorage,
): BrowserStateStorage {
  // Writes never happen here, so nothing is ever a self-write.
  const noSelfWrites: SelfWriteTracker = { isSelfWrite: () => false };

  return {
    getItem(name: string): Promise<string | null> {
      return Promise.resolve(inner.getItem(name));
    },
    setItem(): Promise<void> {
      return Promise.resolve();
    },
    removeItem(): Promise<void> {
      return Promise.resolve();
    },
    [SELF_WRITE]: noSelfWrites,
  };
}
