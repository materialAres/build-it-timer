import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createAppStore, attachStoreSync, STORE_NAME } from '@/store';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import type { Tag } from '@/store/store.types';

/** Let the storage event → rehydrate chain (async) settle before asserting. */
const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * M1.T10 — cross-context mutation path. The popup is read-only (M1.T9); it
 * sends a typed mutation and the background, the single writer, applies it.
 * The popup then converges through the M1.T8 sync bridge.
 */
describe('cross-context mutation path (M1.T10)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('applies BLOCKLIST_ADD_SITE to the background store and persists once', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'facebook.com' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, tagIds: [] },
    ]);
    expect(setSpy).toHaveBeenCalledTimes(1);

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { blocklist: { blocklist: Array<{ domain: { value: string } }> } };
    };
    expect(parsed.state.blocklist.blocklist[0]?.domain.value).toBe('facebook.com');

    setSpy.mockRestore();
    handle.dispose();
  });

  it('converges a read-only popup store via the M1.T8 sync bridge', async () => {
    const backgroundStore = createAppStore();
    await backgroundStore.persist.rehydrate();
    const handle = startBackground({ store: backgroundStore });

    // A popup-like context: read-only store + sync attached, as in main.tsx.
    const popupStore = createAppStore({ readOnly: true });
    await popupStore.persist.rehydrate();
    attachStoreSync(popupStore);

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'x.com' },
    });

    // No manual rehydrate call in the test: the sync bridge did it. The
    // `onChanged` → rehydrate chain is asynchronous, so let it settle.
    await flushAsync();
    expect(popupStore.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'x.com' }, tagIds: [] },
    ]);

    handle.dispose();
  });

  it('applies a TAG_UPSERT and a TAG_REMOVE', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const tag: Tag = { id: 'focus', label: 'Focus' };
    await sendMessage({ type: 'TAG_UPSERT', payload: tag });
    expect(store.getState().blocklist.customTags).toEqual([tag]);

    await sendMessage({ type: 'TAG_REMOVE', payload: { tagId: 'focus' } });
    expect(store.getState().blocklist.customTags).toEqual([]);

    handle.dispose();
  });

  it('applies BLOCKLIST_REMOVE_SITE', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'x.com' },
    });
    await sendMessage({
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { list: 'blocklist', site: 'x.com' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });

  it('ignores an invalid payload without throwing or mutating', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    const forged = {
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'nonsense', site: '' },
    } as unknown as RuntimeMessage;

    await expect(sendMessage(forged)).resolves.toEqual({ ok: true, value: undefined });
    expect(store.getState().blocklist).toEqual({
      allowlist: [],
      blocklist: [],
      customTags: [],
    });
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });

  it('ignores an unknown message type without throwing', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const forged = { type: 'NOPE', payload: {} } as unknown as RuntimeMessage;

    await expect(sendMessage(forged)).resolves.toEqual({ ok: true, value: undefined });
    expect(store.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });

  it('accepts BLOCKLIST_APPLY_PRESET as a no-op until M2.T5', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_APPLY_PRESET',
      payload: { presetId: 'social' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });

  it('does not duplicate an already present site', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const message: RuntimeMessage = {
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'facebook.com' },
    };
    await sendMessage(message);
    await sendMessage(message);

    expect(store.getState().blocklist.blocklist).toHaveLength(1);

    handle.dispose();
  });

  it('normalizes a raw URL sent from the popup before storing it (M2.T4)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'https://m.facebook.com/something' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, tagIds: [] },
    ]);

    handle.dispose();
  });

  it('rejects an invalid site sent from the popup without persisting (M2.T4)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'co.uk' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });
});
