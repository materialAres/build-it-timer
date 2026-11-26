import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createAppStore, attachStoreSync, STORE_NAME } from '@/store';
import {
  BLOCKLIST_MUTATION_TYPES,
  MUTATION_TYPES,
  PREFERENCES_MUTATION_TYPES,
  isBlocklistMutation,
  type RuntimeMessage,
  type MutationMessage,
} from '@/lib/messaging/messages.types';
import { DEFAULT_SOUND_PREFERENCES } from '@/lib/sound/sound-preferences';
import { createLogger, type LogRecord } from '@/utils/logger';

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
    { type: 'PRESET_SAVE', payload: { id: 'work', name: 'Focus' } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:focus', name: 7 } },
    { type: 'PRESET_DELETE', payload: {} },
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 42 } },
    { type: 'BLOCKLIST_REMOVE_SITE', payload: null },
  ])('drops a malformed %j and logs only its type (CR4.T4)', async (forged) => {
    const records: LogRecord[] = [];
    const logger = createLogger('bus-test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store, logger });
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    // Let the seeding write land before spying, so only the forged message is
    // observed.
    await flushAsync();

    const before = store.getState().blocklist;
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage(forged as unknown as RuntimeMessage);

    expect(store.getState().blocklist).toBe(before);
    expect(setSpy).not.toHaveBeenCalled();
    const dropped = records.find(
      (record) => record.message === 'blocklist mutation dropped: malformed payload',
    );
    expect(dropped?.level).toBe('debug');
    expect(dropped?.details).toEqual([{ type: forged.type }]);
    // The diagnostic carries the type only, never a payload field.
    expect(JSON.stringify(records)).not.toContain('user:focus');

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
/**
 * PR5.T2 — the blocklist family is declared as data, so the handler no longer
 * treats "everything that is not a timer command" as a blocklist mutation.
 */
describe('mutation type registry (PR5.T2)', () => {
  const TIMER_COMMANDS = [
    'TIMER_STARTED',
    'TIMER_PAUSED',
    'TIMER_RESET',
    'TIMER_SET_DURATION',
  ];

  it('lists the blocklist and preset types the lock applies to', () => {
    expect([...BLOCKLIST_MUTATION_TYPES]).toEqual([
      'BLOCKLIST_ADD_SITE',
      'BLOCKLIST_REMOVE_SITE',
      'PRESET_TOGGLE',
      'PRESET_SAVE',
      'PRESET_RENAME',
      'PRESET_DELETE',
    ]);
  });

  it('lists the preferences types (M5.T8)', () => {
    expect([...PREFERENCES_MUTATION_TYPES]).toEqual(['PREFERENCES_SOUND_SET']);
  });

  it('composes MUTATION_TYPES from the three families, with no duplicate', () => {
    expect([...MUTATION_TYPES].sort()).toEqual(
      [
        ...BLOCKLIST_MUTATION_TYPES,
        ...TIMER_COMMANDS,
        ...PREFERENCES_MUTATION_TYPES,
      ].sort(),
    );
    expect(new Set(MUTATION_TYPES).size).toBe(MUTATION_TYPES.length);
  });

  it.each([...MUTATION_TYPES])('isBlocklistMutation classifies %s', (type) => {
    const message = { type, payload: {} } as unknown as MutationMessage;
    expect(isBlocklistMutation(message)).toBe(
      (BLOCKLIST_MUTATION_TYPES as ReadonlyArray<string>).includes(type),
    );
  });
});

describe('blocklist lock in the mutation handler (CR2.T2, CR5.T2)', () => {
  /** Everything that loosens or reshapes the list: idle-only (CR2.T2). */
  const LOOSENING: ReadonlyArray<MutationMessage> = [
    { type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'x.com' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: false } },
    { type: 'PRESET_SAVE', payload: { id: 'user:focus', name: 'Focus' } },
    {
      type: 'PRESET_RENAME',
      payload: { presetId: 'user:focus', name: 'Work' },
    },
    { type: 'PRESET_DELETE', payload: { presetId: 'user:focus' } },
  ];

  /** Adding is allowed mid-session (CR5.T2) but never once completed. */
  const ADDING: ReadonlyArray<MutationMessage> = [
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
  ];

  beforeEach(() => {
    fakeBrowser.reset();
  });

  /** A background whose timer is at `status`, with that write already settled. */
  async function backgroundAt(status: 'running' | 'paused' | 'completed') {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });
    await handle.ready;
    store.setState({ timer: { ...store.getState().timer, status } });
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: { timer: { status: string } };
      };
      expect(parsed.state.timer.status).toBe(status);
    });
    await flushAsync();
    return { store, handle };
  }

  it.each(['running', 'paused', 'completed'] as const)(
    'drops every loosening or reshaping mutation while %s',
    async (status) => {
      const { store, handle } = await backgroundAt(status);
      const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
      const before = store.getState().blocklist;

      for (const mutation of LOOSENING) {
        await sendMessage(mutation);
      }

      expect(store.getState().blocklist).toBe(before);
      expect(setSpy).not.toHaveBeenCalled();

      setSpy.mockRestore();
      handle.dispose();
    },
  );

  it('drops the add-direction mutations once the session is completed', async () => {
    const { store, handle } = await backgroundAt('completed');
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    const before = store.getState().blocklist;

    for (const mutation of ADDING) {
      await sendMessage(mutation);
    }

    expect(store.getState().blocklist).toBe(before);
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });

  it('accepts the add-direction mutations while running, then everything after a reset', async () => {
    const { store, handle } = await backgroundAt('running');
    await sendMessage(ADDING[0] as MutationMessage);
    expect(
      store.getState().blocklist.blocklist.map((entry) => entry.domain.value),
    ).toEqual(['facebook.com']);

    await sendMessage({ type: 'TIMER_RESET', payload: {} });
    await flushAsync();
    expect(store.getState().timer.status).toBe('idle');

    await sendMessage({
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { site: 'facebook.com' },
    });
    expect(store.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });
});

describe('sound preferences mutation (M5.T8)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  async function startedBackground() {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });
    await handle.ready;
    return { store, handle };
  }

  it('applies a valid patch and persists it', async () => {
    const { store, handle } = await startedBackground();

    await sendMessage({
      type: 'PREFERENCES_SOUND_SET',
      payload: { enabled: false, themeId: 'glitch', volume: 70 },
    });

    expect(store.getState().preferences.sound).toEqual({
      enabled: false,
      themeId: 'glitch',
      volume: 70,
    });
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: { preferences?: { sound: unknown } };
      };
      expect(parsed.state.preferences?.sound).toEqual({
        enabled: false,
        themeId: 'glitch',
        volume: 70,
      });
    });
    handle.dispose();
  });

  it.each([
    ['an out-of-range volume', { volume: 500 }],
    ['an unknown theme', { themeId: 'x' }],
    ['an empty patch', {}],
    ['a null payload', null],
    ['an unknown key', { loud: true }],
  ])('ignores %s without throwing or persisting', async (_label, payload) => {
    const { store, handle } = await startedBackground();
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');

    const forged = {
      type: 'PREFERENCES_SOUND_SET',
      payload,
    } as unknown as RuntimeMessage;
    await expect(sendMessage(forged)).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(store.getState().preferences.sound).toEqual(DEFAULT_SOUND_PREFERENCES);
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
    handle.dispose();
  });

  it.each(['running', 'paused', 'completed'] as const)(
    'is applied while the timer is %s (never locked)',
    async (status) => {
      const { store, handle } = await startedBackground();
      store.setState({ timer: { ...store.getState().timer, status } });

      await sendMessage({
        type: 'PREFERENCES_SOUND_SET',
        payload: { volume: 10 },
      });

      expect(store.getState().preferences.sound.volume).toBe(10);
      handle.dispose();
    },
  );
});
