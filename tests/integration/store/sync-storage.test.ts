import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, attachStoreSync, STORE_NAME } from '@/store';
import type { Preset } from '@/store/store.types';

const testPreset: Preset = { id: 'user:focus', name: 'Focus', domains: [] };

/** Serialize a persisted `partialize` payload the way `zustand/persist` does. */
function serialize(state: {
  blocklist: { userPresets: ReadonlyArray<Preset> };
}): string {
  // Version 3 (CR4.T3): a matching version keeps hydration read-only. A legacy
  // version would make zustand write the migrated state back once (by design),
  // which would add a second `set` to the no-echo assertions below.
  return JSON.stringify({ state, version: 3 });
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
        blocklist: { ...store.getState().blocklist, userPresets: [testPreset] },
      }),
    });

    expect(store.getState().blocklist.userPresets).toEqual([testPreset]);
  });

  it('updates the in-memory store without recreating it', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const stateBefore = store.getState();
    attachStoreSync(store);

    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, userPresets: [testPreset] },
      }),
    });

    expect(store.getState()).not.toBe(stateBefore);
    expect(store.getState().blocklist.userPresets).toEqual([testPreset]);
  });

  it('does not re-persist while handling an external change (no echo/loop)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    attachStoreSync(store);

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, userPresets: [testPreset] },
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

    expect(store.getState().blocklist.userPresets).toEqual([]);
  });

  it('stops rehydrating after the unsubscribe function is called', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const unsubscribe = attachStoreSync(store);

    unsubscribe();
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({
        blocklist: { ...store.getState().blocklist, userPresets: [testPreset] },
      }),
    });

    expect(store.getState().blocklist.userPresets).toEqual([]);
  });

  it('exposes the helper from the store barrel', () => {
    expect(typeof attachStoreSync).toBe('function');
  });
});
