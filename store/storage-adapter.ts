import { browser } from 'wxt/browser';
import type { StateStorage } from 'zustand/middleware';

// Zustand `persist` storage backed by `browser.storage.local` instead of
// `localStorage`: the MV3 background service worker has no `window`, so
// `localStorage` is unavailable there.
export type BrowserStateStorage = StateStorage<Promise<void>>;

export function createBrowserStorage(): BrowserStateStorage {
  return {
    async getItem(name: string): Promise<string | null> {
      const result = await browser.storage.local.get(name);
      const value = result[name];
      // Persisted values are JSON strings; anything else is treated as absent
      // rather than crashing the rehydration flow.
      return typeof value === 'string' ? value : null;
    },
    async setItem(name: string, value: string): Promise<void> {
      await browser.storage.local.set({ [name]: value });
    },
    async removeItem(name: string): Promise<void> {
      await browser.storage.local.remove(name);
    },
  };
}

export const browserStorage: BrowserStateStorage = createBrowserStorage();
