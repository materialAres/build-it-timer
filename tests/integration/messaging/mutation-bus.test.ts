import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createAppStore, attachStoreSync, STORE_NAME } from '@/store';
import type {
  RuntimeMessage,
  MutationMessage,
} from '@/lib/messaging/messages.types';

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
      payload: { site: 'facebook.com' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, manual: true, presetIds: [] },
    ]);
    expect(setSpy).toHaveBeenCalledTimes(1);

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { blocklist: { blocklist: Array<{ domain: { value: string } }> } };
    };
    expect(parsed.state.blocklist.blocklist[0]?.domain.value).toBe(
      'facebook.com',
    );

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
      payload: { site: 'x.com' },
    });

    // No manual rehydrate call in the test: the sync bridge did it. The
    // `onChanged` → rehydrate chain is asynchronous, so let it settle.
    await flushAsync();
    expect(popupStore.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'x.com' }, manual: true, presetIds: [] },
    ]);

    handle.dispose();
  });

  it('applies PRESET_TOGGLE on and off (CR4.T3)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    await sendMessage({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: true },
    });
    expect(store.getState().blocklist.appliedPresetIds).toEqual(['social']);
    expect(store.getState().blocklist.blocklist).toHaveLength(4);

    await sendMessage({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: false },
    });
    expect(store.getState().blocklist.appliedPresetIds).toEqual([]);
    // The manually added site survives the preset being switched off.
    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'x.com' }, manual: true, presetIds: [] },
    ]);

    handle.dispose();
  });

  it('applies PRESET_SAVE, PRESET_RENAME and PRESET_DELETE (CR4.T3)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    await sendMessage({
      type: 'PRESET_SAVE',
      payload: { id: 'user:focus', name: 'Focus' },
    });
    // The background snapshots its own list: the message carries no domains.
    expect(store.getState().blocklist.userPresets).toEqual([
      { id: 'user:focus', name: 'Focus', domains: [{ value: 'x.com' }] },
    ]);
    expect(store.getState().blocklist.appliedPresetIds).toEqual(['user:focus']);

    await sendMessage({
      type: 'PRESET_RENAME',
      payload: { presetId: 'user:focus', name: 'Deep work' },
    });
    expect(store.getState().blocklist.userPresets[0]?.name).toBe('Deep work');

    await sendMessage({
      type: 'PRESET_DELETE',
      payload: { presetId: 'user:focus' },
    });
    expect(store.getState().blocklist.userPresets).toEqual([]);
    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'x.com' }, manual: true, presetIds: [] },
    ]);

    handle.dispose();
  });

  it.each([
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: 'yes' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 42, applied: true } },
    { type: 'PRESET_SAVE', payload: { id: '', name: 'Focus' } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:focus', name: 7 } },
    { type: 'PRESET_DELETE', payload: {} },
  ])('ignores a malformed %j without persisting (CR4.T3)', async (forged) => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });

    const before = store.getState().blocklist;
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage(forged as unknown as RuntimeMessage);

    expect(store.getState().blocklist).toBe(before);
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });

  it('applies BLOCKLIST_REMOVE_SITE', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    await sendMessage({
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { site: 'x.com' },
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
      payload: { site: '' },
    } as unknown as RuntimeMessage;

    await expect(sendMessage(forged)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(store.getState().blocklist).toEqual({
      blocklist: [],
      appliedPresetIds: [],
      userPresets: [],
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

    await expect(sendMessage(forged)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(store.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });

  it('applies a whole preset in one mutation and persists once (M3.T1)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: true },
    });

    // The whole preset is expanded in a single store action...
    expect(
      store.getState().blocklist.blocklist.map((entry) => entry.domain.value),
    ).toEqual(['instagram.com', 'facebook.com', 'x.com', 'tiktok.com']);
    // ...so the background persists exactly once, not once per domain.
    expect(setSpy).toHaveBeenCalledTimes(1);

    setSpy.mockRestore();
    handle.dispose();
  });

  it('ignores an unknown preset id without mutating (M3.T1)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    await sendMessage({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'does-not-exist', applied: true },
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
      payload: { site: 'facebook.com' },
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
      payload: { site: 'https://m.facebook.com/something' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, manual: true, presetIds: [] },
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
      payload: { site: 'co.uk' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });

  // CR1.T2/CR1.T5a: the protocol has no `list` discriminator anymore and the
  // store has no second collection. A legacy sender that still includes the
  // field must not be able to select one: the site mutations always land on the
  // single blocklist.
  it('ignores a legacy `list` field and always mutates the blocklist (CR1.T2)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const legacy = (
      type: 'BLOCKLIST_ADD_SITE' | 'BLOCKLIST_REMOVE_SITE',
      payload: Record<string, unknown>,
    ): RuntimeMessage =>
      ({
        type,
        payload: { list: 'allowlist', ...payload },
      }) as unknown as RuntimeMessage;

    await sendMessage(
      legacy('BLOCKLIST_ADD_SITE', { site: 'https://www.facebook.com' }),
    );
    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, manual: true, presetIds: [] },
    ]);

    await sendMessage(
      legacy('BLOCKLIST_REMOVE_SITE', { site: 'facebook.com' }),
    );
    expect(store.getState().blocklist.blocklist).toEqual([]);

    expect('allowlist' in store.getState().blocklist).toBe(false);

    handle.dispose();
  });
});

/**
 * CR2.T2 — the background is the single writer, so the blocklist lock must be
 * enforced here too: a message that bypasses the UI/store guard (stale tab,
 * forged sender) must not change or persist anything.
 */
describe('blocklist lock in the mutation handler (CR2.T2)', () => {
  const MUTATIONS: ReadonlyArray<MutationMessage> = [
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } },
    { type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'x.com' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: false } },
    { type: 'PRESET_SAVE', payload: { id: 'user:focus', name: 'Focus' } },
    {
      type: 'PRESET_RENAME',
      payload: { presetId: 'user:focus', name: 'Work' },
    },
    { type: 'PRESET_DELETE', payload: { presetId: 'user:focus' } },
  ];

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it.each(['running', 'paused', 'completed'] as const)(
    'drops every blocklist/preset mutation while %s',
    async (status) => {
      const store = createAppStore();
      await store.persist.rehydrate();
      const handle = startBackground({ store });
      await handle.ready;

      store.setState({ timer: { ...store.getState().timer, status } });
      const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
      const before = store.getState().blocklist;

      for (const mutation of MUTATIONS) {
        await sendMessage(mutation);
      }

      expect(store.getState().blocklist).toBe(before);
      expect(setSpy).not.toHaveBeenCalled();

      setSpy.mockRestore();
      handle.dispose();
    },
  );

  it('accepts the same mutations again after a reset', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });
    await handle.ready;

    store.setState({ timer: { ...store.getState().timer, status: 'running' } });
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'facebook.com' },
    });
    expect(store.getState().blocklist.blocklist).toEqual([]);

    await sendMessage({ type: 'TIMER_RESET', payload: {} });
    await flushAsync();
    expect(store.getState().timer.status).toBe('idle');

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'facebook.com' },
    });
    expect(store.getState().blocklist.blocklist).toEqual([
      { domain: { value: 'facebook.com' }, manual: true, presetIds: [] },
    ]);

    handle.dispose();
  });
});
