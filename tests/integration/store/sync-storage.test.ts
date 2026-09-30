import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, attachStoreSync, STORE_NAME } from '@/store';
import type { Tag } from '@/store/store.types';

const testTag: Tag = { id: 'focus', label: 'Focus' };

/** Serialize a persisted `partialize` payload the way `zustand/persist` does. */
function serialize(state: {
  blocklist: { customTags: ReadonlyArray<Tag> };
}): string {
  return JSON.stringify({ state, version: 1 });
}

describe('attachStoreSync (M1.T8)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('rehydrates the store when another context writes the store key', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    attachStoreSync(store);

    // "Context A" writes directly to storage.local, simulating the background.
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, customTags: [testTag] },
      }),
    });

    expect(store.getState().blocklist.customTags).toEqual([testTag]);
  });

  it('updates the in-memory store without recreating it', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const stateBefore = store.getState();
    attachStoreSync(store);

    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, customTags: [testTag] },
      }),
    });

    expect(store.getState()).not.toBe(stateBefore);
    expect(store.getState().blocklist.customTags).toEqual([testTag]);
  });

  it('does not re-persist while handling an external change (no echo/loop)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    attachStoreSync(store);

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, customTags: [testTag] },
      }),
    });

    // The first call is the test's own write; rehydration must not add another.
    expect(setSpy).toHaveBeenCalledTimes(1);
    setSpy.mockRestore();
  });

  it('ignores changes to keys other than the store key', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    attachStoreSync(store);

    await fakeBrowser.storage.local.set({ 'some-other-key': 'value' });

    expect(store.getState().blocklist.customTags).toEqual([]);
  });

  it('stops rehydrating after the unsubscribe function is called', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const unsubscribe = attachStoreSync(store);

    unsubscribe();
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, customTags: [testTag] },
      }),
    });

    expect(store.getState().blocklist.customTags).toEqual([]);
  });

  it('exposes the helper from the store barrel', () => {
    expect(typeof attachStoreSync).toBe('function');
  });
});
