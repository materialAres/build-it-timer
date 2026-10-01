import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  attachStoreSync,
  partialize,
  useAppStore,
  STORE_NAME,
} from '@/store';
import { createReadOnlyStorage } from '@/store/storage-adapter';
import type { Tag } from '@/store/store.types';

const testTag: Tag = { id: 'focus', label: 'Focus' };

/** Serialize a payload the way `zustand/persist` writes it. */
function serialize(state: {
  blocklist: { customTags: ReadonlyArray<Tag> };
}): string {
  return JSON.stringify({ state, version: 1 });
}

describe('read-only store (M1.T9)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('never writes to storage.local when setState is called', async () => {
    const store = createAppStore({ readOnly: true });
    await store.persist.rehydrate();

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await store.setState({
      blocklist: { ...store.getState().blocklist, customTags: [testTag] },
    });

    expect(setSpy).not.toHaveBeenCalled();
    // The in-memory state still changes: only persistence is suppressed.
    expect(store.getState().blocklist.customTags).toEqual([testTag]);
    setSpy.mockRestore();
  });

  it('still hydrates from storage', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({ blocklist: { customTags: [testTag] } }),
    });

    const store = createAppStore({ readOnly: true });
    await store.persist.rehydrate();

    expect(store.getState().blocklist.customTags).toEqual([testTag]);
  });

  it('still receives external updates through attachStoreSync (M1.T8)', async () => {
    const store = createAppStore({ readOnly: true });
    await store.persist.rehydrate();
    attachStoreSync(store);

    await fakeBrowser.storage.local.set({
      [STORE_NAME]: serialize({ blocklist: { customTags: [testTag] } }),
    });

    expect(store.getState().blocklist.customTags).toEqual([testTag]);
  });

  it('a writable store still persists as before', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    await store.setState({
      blocklist: { ...store.getState().blocklist, customTags: [testTag] },
    });

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { blocklist: { customTags: Tag[] } };
    };
    expect(parsed.state.blocklist.customTags).toEqual([testTag]);
  });

  it('the popup-facing useAppStore is read-only', async () => {
    await useAppStore.persist.rehydrate();

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await useAppStore.setState({ ui: { ...useAppStore.getState().ui, activeTab: 'score' } });

    expect(useAppStore.getState().ui.activeTab).toBe('score');
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });
});

describe('createReadOnlyStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('reads through to the wrapped storage', async () => {
    await fakeBrowser.storage.local.set({ key: 'value' });
    const storage = createReadOnlyStorage();

    await expect(storage.getItem('key')).resolves.toBe('value');
  });

  it('makes setItem and removeItem no-ops', async () => {
    const storage = createReadOnlyStorage();
    await storage.setItem('key', 'value');
    await storage.removeItem('key');

    await expect(fakeBrowser.storage.local.get('key')).resolves.toEqual({});
  });

  it('does not throw when writing', async () => {
    const storage = createReadOnlyStorage();
    await expect(storage.setItem('key', 'value')).resolves.toBeUndefined();
    await expect(storage.removeItem('key')).resolves.toBeUndefined();
  });
});

describe('partialize under read-only ownership', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('still excludes the volatile ui slice', () => {
    const store = createAppStore({ readOnly: true });
    const persisted = partialize(store.getState());

    expect(persisted).not.toHaveProperty('ui');
  });
});
