import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  partialize,
  selectRemainingSeconds,
  selectUserPresets,
  selectActiveTab,
  selectSessionHistory,
  DEFAULT_FOCUS_SECONDS,
  STORE_NAME,
} from '@/store';
import type { Preset, SessionSummary } from '@/store/store.types';
import { DEFAULT_SOUND_PREFERENCES } from '@/lib/sound/sound-preferences';
import { createLogger, type LogRecord } from '@/utils/logger';

const testPreset: Preset = { id: 'user:focus', name: 'Focus', domains: [] };

describe('useAppStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('combines the slice stubs with their default state', () => {
    const store = createAppStore();
    const state = store.getState();

    expect(state.timer.status).toBe('idle');
    expect(state.timer.sessionId).toBeNull();
    expect(state.blocklist).toEqual({
      blocklist: [],
      appliedPresetIds: [],
      userPresets: [],
    });
    expect(state.score).toEqual({
      builtCharacters: 0,
      level: 'bad',
      population: 0,
    });
    expect(state.city).toEqual({ sessionId: null });
    expect(state.sessionHistory.sessions).toEqual([]);
    expect(state.ui.activeTab).toBe('timer');
  });

  it('partialize keeps the persisted slices and drops the volatile ui slice', () => {
    const store = createAppStore();
    const persisted = partialize(store.getState());

    expect(Object.keys(persisted).sort()).toEqual(
      ['blocklist', 'city', 'preferences', 'score', 'sessionHistory', 'timer'].sort(),
    );
    expect(persisted).not.toHaveProperty('ui');
  });

  it('persists the session history across a simulated restart (M2.T19)', async () => {
    const ended: SessionSummary = {
      sessionId: 'session-1',
      score: 'good',
      population: 10,
      endedAt: 1_700_000_000_000,
    };
    const first = createAppStore();
    await first.persist.rehydrate();
    first.getState().recordSession(ended);
    // Wait for the persist middleware's async write to land before restarting.
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      expect(raw[STORE_NAME]).toBeTypeOf('string');
    });

    const restarted = createAppStore();
    await restarted.persist.rehydrate();

    expect(selectSessionHistory(restarted.getState())).toEqual([ended]);
  });

  it('recovers a persisted field after a simulated restart', async () => {
    const first = createAppStore();
    await first.persist.rehydrate();
    await first.setState({
      blocklist: { ...first.getState().blocklist, userPresets: [testPreset] },
    });

    // "restart": a brand-new store instance reading the same fake storage.
    const restarted = createAppStore();
    await restarted.persist.rehydrate();

    expect(restarted.getState().blocklist.userPresets).toEqual([testPreset]);
  });

  it('resets a volatile field to its default after a simulated restart', async () => {
    const first = createAppStore();
    await first.persist.rehydrate();
    await first.setState({
      ui: {
        ...first.getState().ui,
        activeTab: 'blocklist',
        liveRemainingSeconds: 42,
      },
    });

    const restarted = createAppStore();
    await restarted.persist.rehydrate();

    expect(restarted.getState().ui.activeTab).toBe('timer');
    expect(restarted.getState().ui.liveRemainingSeconds).toBe(0);
  });

  it('writes the persisted payload under the store key', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    await store.setState({
      blocklist: { ...store.getState().blocklist, userPresets: [testPreset] },
    });

    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      expect(raw[STORE_NAME]).toBeTypeOf('string');
    });
    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: Record<string, unknown>;
      version: number;
    };

    expect(parsed.state).toHaveProperty('blocklist');
    expect(parsed.state).not.toHaveProperty('ui');
    // CR4.T3/CR6.T5a: the persisted payload is at version 4 (the city is only its session id).
    expect(parsed.version).toBe(4);
    expect(parsed.state.blocklist).toEqual({
      blocklist: [],
      appliedPresetIds: [],
      userPresets: [testPreset],
    });
  });

  it('exposes granular per-slice selectors', () => {
    const store = createAppStore();
    const state = store.getState();

    expect(selectRemainingSeconds(state)).toBe(DEFAULT_FOCUS_SECONDS);
    expect(selectUserPresets(state)).toEqual([]);
    expect(selectActiveTab(state)).toBe('timer');
  });

  it('logs a corrupt persisted payload and keeps the default state (M4.T3c)', async () => {
    const records: LogRecord[] = [];
    const logger = createLogger('store-test', {
      sink: (record) => {
        records.push(record);
      },
      minLevel: 'debug',
    });
    const store = createAppStore({ logger });
    await store.persist.rehydrate();

    await fakeBrowser.storage.local.set({
      [STORE_NAME]: 'facebook.com',
    });
    await store.persist.rehydrate();

    expect(store.getState().timer.status).toBe('idle');
    expect(store.getState().timer.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(selectSessionHistory(store.getState())).toEqual([]);

    const failure = records.find(
      (record) => record.message === 'store rehydration failed',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('store-test');
    expect(failure?.details[0]).toBeInstanceOf(Error);
    expect((failure?.details[0] as Error).message).toBe(
      'persisted store JSON is malformed',
    );
    expect(failure?.details[1]).toEqual({ key: STORE_NAME });
    // The diagnostic must not leak the raw persisted payload or a domain.
    expect(JSON.stringify(records)).not.toContain('facebook.com');
  });

  it('logs nothing when a valid persisted payload is rehydrated (M4.T3c)', async () => {
    const records: LogRecord[] = [];
    const logger = createLogger('store-test', {
      sink: (record) => {
        records.push(record);
      },
      minLevel: 'debug',
    });
    const store = createAppStore({ logger });
    await store.persist.rehydrate();

    const persisted = partialize(store.getState());
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          ...persisted,
          blocklist: { ...persisted.blocklist, userPresets: [testPreset] },
        },
        version: 3,
      }),
    });
    await store.persist.rehydrate();

    expect(store.getState().blocklist.userPresets).toEqual([testPreset]);
    expect(records).toEqual([]);
  });

  it('rebuilds a legacy score from builtCharacters and drops distractionRatio (CR3.T5)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          score: {
            level: 'excellent',
            distractionRatio: 0.2,
            population: 3000,
          },
        },
        version: 2,
      }),
    });
    const store = createAppStore();
    await store.persist.rehydrate();

    expect(store.getState().score).toEqual({
      builtCharacters: 0,
      level: 'bad',
      population: 0,
    });
    expect('distractionRatio' in store.getState().score).toBe(false);
  });

  it('derives level and population from a persisted builtCharacters (CR3.T5)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          // The stale level and population are ignored: only the count is trusted.
          score: { builtCharacters: 421, level: 'bad', population: 1 },
        },
        version: 2,
      }),
    });
    const store = createAppStore();
    await store.persist.rehydrate();

    expect(store.getState().score).toEqual({
      builtCharacters: 421,
      level: 'great',
      population: 3320,
    });
  });

  it('fills fields a persisted snapshot predates (slice-aware merge, CI-2)', async () => {
    // A snapshot written before `timer.durationSeconds` existed at all.
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          timer: {
            status: 'idle',
            remainingSeconds: 420,
            sessionStartedAt: null,
            sessionId: null,
            endsAt: null,
            focusedMs: 0,
            distractedMs: 0,
          },
          blocklist: {
            allowlist: [],
            blocklist: [],
            customTags: [{ id: 'focus', label: 'Focus' }],
          },
        },
        version: 1,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    // The added field falls back to the fresh default instead of `undefined`…
    expect(store.getState().timer.durationSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    // …while every persisted value is still restored.
    expect(store.getState().timer.remainingSeconds).toBe(420);
    // The v1 custom tag migrated all the way to a saved preset (CR4.T3).
    expect(store.getState().blocklist.userPresets).toEqual([testPreset]);
  });

  it('migrates a version-1 payload to the single-list shape (CR1.T3)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          blocklist: {
            allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
            blocklist: [
              { domain: { value: 'facebook.com' }, tagIds: ['focus'] },
              { domain: { value: 'x.com' }, tagIds: [] },
            ],
            customTags: [{ id: 'focus', label: 'Focus' }],
          },
        },
        version: 1,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    // The domain was on both lists: it stays unblocked (old allowlist-wins).
    expect(
      store.getState().blocklist.blocklist.map((item) => item.domain.value),
    ).toEqual(['x.com']);
    // The legacy list itself is not resurrected in memory.
    expect('allowlist' in store.getState().blocklist).toBe(false);
    // Allowlist-wins ran first, so the tag's only site is gone from the preset.
    expect(store.getState().blocklist.userPresets).toEqual([testPreset]);
    expect(store.getState().blocklist.appliedPresetIds).toEqual([]);
  });

  it('drops an allowlist-only domain during migration (CR1.T3)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          blocklist: {
            allowlist: [{ domain: { value: 'keep.com' }, tagIds: [] }],
            blocklist: [{ domain: { value: 'x.com' }, tagIds: [] }],
            customTags: [],
          },
        },
        version: 1,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    expect(
      store.getState().blocklist.blocklist.map((item) => item.domain.value),
    ).toEqual(['x.com']);
    expect('allowlist' in store.getState().blocklist).toBe(false);
  });

  it('migrates a version-2 payload: tags become saved presets (CR4.T3)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          blocklist: {
            blocklist: [
              {
                domain: { value: 'facebook.com' },
                tagIds: ['focus', 'social'],
              },
              { domain: { value: 'x.com' }, tagIds: [] },
            ],
            customTags: [{ id: 'focus', label: 'Focus' }],
          },
        },
        version: 2,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    expect(store.getState().blocklist).toEqual({
      blocklist: [
        {
          domain: { value: 'facebook.com' },
          manual: false,
          presetIds: ['user:focus', 'social'],
        },
        { domain: { value: 'x.com' }, manual: true, presetIds: [] },
      ],
      appliedPresetIds: ['user:focus', 'social'],
      userPresets: [
        {
          id: 'user:focus',
          name: 'Focus',
          domains: [{ value: 'facebook.com' }],
        },
      ],
    });
    expect('customTags' in store.getState().blocklist).toBe(false);
  });

  it('passes a version-3 payload through unchanged (CR4.T3)', async () => {
    const persisted = {
      blocklist: [
        { domain: { value: 'x.com' }, manual: false, presetIds: ['social'] },
      ],
      appliedPresetIds: ['social'],
      userPresets: [testPreset],
    };
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: { blocklist: persisted },
        version: 3,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    expect(store.getState().blocklist).toEqual(persisted);
  });

  it('falls back to defaults for a malformed legacy blocklist (CR1.T3)', async () => {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: { blocklist: { allowlist: 'nope', blocklist: 'nope' } },
        version: 1,
      }),
    });

    const store = createAppStore();
    await expect(store.persist.rehydrate()).resolves.toBeUndefined();

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(store.getState().blocklist.userPresets).toEqual([]);
    expect(store.getState().blocklist.appliedPresetIds).toEqual([]);
  });

  it('persists only the source-tracked shape, now at version 4 (CR4.T3, CR6.T5a)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const blocklist = {
      blocklist: [{ domain: { value: 'x.com' }, manual: true, presetIds: [] }],
      appliedPresetIds: [],
      userPresets: [testPreset],
    };
    await store.setState({ blocklist });

    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      expect(raw[STORE_NAME]).toBeTypeOf('string');
    });
    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { blocklist: Record<string, unknown> };
      version: number;
    };

    expect(parsed.version).toBe(4);
    expect(parsed.state.blocklist).toEqual(blocklist);
    expect(Object.keys(parsed.state.blocklist).sort()).toEqual([
      'appliedPresetIds',
      'blocklist',
      'userPresets',
    ]);
  });
  describe('sound preferences persistence (M5.T7)', () => {
    const waitForWrite = async (): Promise<void> => {
      await vi.waitFor(async () => {
        const raw = await fakeBrowser.storage.local.get(STORE_NAME);
        expect(raw[STORE_NAME]).toBeTypeOf('string');
      });
    };

    const seedStorage = async (state: unknown, version = 4): Promise<void> => {
      await fakeBrowser.storage.local.set({
        [STORE_NAME]: JSON.stringify({ state, version }),
      });
    };

    it('keeps the sound preferences across a simulated restart', async () => {
      const first = createAppStore();
      await first.persist.rehydrate();
      const changed = { enabled: false, themeId: 'glitch', volume: 20 } as const;
      first.getState().setSoundPreferences(changed);
      await waitForWrite();

      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: Record<string, unknown>;
        version: number;
      };
      expect(parsed.state.preferences).toEqual({ sound: changed });
      expect(parsed.state).not.toHaveProperty('ui');
      expect(parsed.version).toBe(4);

      const restarted = createAppStore();
      await restarted.persist.rehydrate();
      expect(restarted.getState().preferences.sound).toEqual(changed);
    });

    it('gives the defaults to a version-4 payload saved before preferences existed', async () => {
      await seedStorage({
        blocklist: { blocklist: [], appliedPresetIds: [], userPresets: [] },
      });

      const store = createAppStore();
      await store.persist.rehydrate();

      expect(store.getState().preferences.sound).toEqual(DEFAULT_SOUND_PREFERENCES);
    });

    it('falls back to the default for each corrupt field, without throwing', async () => {
      await seedStorage({
        preferences: {
          sound: { enabled: false, volume: 'loud', themeId: 'bogus' },
        },
      });

      const store = createAppStore();
      await store.persist.rehydrate();

      expect(store.getState().preferences.sound).toEqual({
        enabled: false,
        themeId: DEFAULT_SOUND_PREFERENCES.themeId,
        volume: DEFAULT_SOUND_PREFERENCES.volume,
      });
    });

    it.each([[null], ['loud'], [7], [[]], [{ sound: null }]])(
      'gives the defaults for a malformed preferences value %j',
      async (preferences) => {
        await seedStorage({ preferences });

        const store = createAppStore();
        await store.persist.rehydrate();

        expect(store.getState().preferences.sound).toEqual(DEFAULT_SOUND_PREFERENCES);
      },
    );
  });
});
