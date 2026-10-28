import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  partialize,
  selectRemainingSeconds,
  selectCustomTags,
  selectActiveTab,
  selectSessionHistory,
  DEFAULT_FOCUS_SECONDS,
  STORE_NAME,
} from '@/store';
import type { SessionSummary, Tag } from '@/store/store.types';
import { createLogger, type LogRecord } from '@/utils/logger';

const testTag: Tag = { id: 'focus', label: 'Focus' };

describe('useAppStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('combines the slice stubs with their default state', () => {
    const store = createAppStore();
    const state = store.getState();

    expect(state.timer.status).toBe('idle');
    expect(state.timer.sessionId).toBeNull();
    expect(state.blocklist.blocklist).toEqual([]);
    expect(state.blocklist.allowlist).toEqual([]);
    expect(state.score.level).toBe('excellent');
    expect(state.city.layers.background.width).toBeGreaterThan(0);
    expect(state.sessionHistory.sessions).toEqual([]);
    expect(state.ui.activeTab).toBe('timer');
  });

  it('partialize keeps the persisted slices and drops the volatile ui slice', () => {
    const store = createAppStore();
    const persisted = partialize(store.getState());

    expect(Object.keys(persisted).sort()).toEqual(
      ['blocklist', 'city', 'score', 'sessionHistory', 'timer'].sort(),
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
      blocklist: { ...first.getState().blocklist, customTags: [testTag] },
    });

    // "restart": a brand-new store instance reading the same fake storage.
    const restarted = createAppStore();
    await restarted.persist.rehydrate();

    expect(restarted.getState().blocklist.customTags).toEqual([testTag]);
  });

  it('resets a volatile field to its default after a simulated restart', async () => {
    const first = createAppStore();
    await first.persist.rehydrate();
    await first.setState({
      ui: { ...first.getState().ui, activeTab: 'blocklist', liveRemainingSeconds: 42 },
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
      blocklist: { ...store.getState().blocklist, customTags: [testTag] },
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
    // CR1.T3: the persisted payload carries the single-list shape at version 2.
    expect(parsed.version).toBe(2);
    expect(parsed.state.blocklist).toEqual({ blocklist: [], customTags: [testTag] });
  });

  it('exposes granular per-slice selectors', () => {
    const store = createAppStore();
    const state = store.getState();

    expect(selectRemainingSeconds(state)).toBe(DEFAULT_FOCUS_SECONDS);
    expect(selectCustomTags(state)).toEqual([]);
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
          blocklist: { ...persisted.blocklist, customTags: [testTag] },
        },
        version: 2,
      }),
    });
    await store.persist.rehydrate();

    expect(store.getState().blocklist.customTags).toEqual([testTag]);
    expect(records).toEqual([]);
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
            customTags: [testTag],
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
    expect(store.getState().blocklist.customTags).toEqual([testTag]);
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
            customTags: [testTag],
          },
        },
        version: 1,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    // The domain was on both lists: it stays unblocked (old allowlist-wins).
    expect(store.getState().blocklist.blocklist.map((item) => item.domain.value)).toEqual([
      'x.com',
    ]);
    // The legacy list itself is not resurrected in memory.
    expect(store.getState().blocklist.allowlist).toEqual([]);
    expect(store.getState().blocklist.customTags).toEqual([testTag]);
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

    expect(store.getState().blocklist.blocklist.map((item) => item.domain.value)).toEqual([
      'x.com',
    ]);
    expect(store.getState().blocklist.allowlist).toEqual([]);
  });

  it('passes a version-2 payload through unchanged (CR1.T3)', async () => {
    const persistedBlocklist = {
      blocklist: [{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }],
      customTags: [testTag],
    };
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: { blocklist: persistedBlocklist },
        version: 2,
      }),
    });

    const store = createAppStore();
    await store.persist.rehydrate();

    expect(store.getState().blocklist.blocklist).toEqual(persistedBlocklist.blocklist);
    expect(store.getState().blocklist.customTags).toEqual(persistedBlocklist.customTags);
    expect(store.getState().blocklist.allowlist).toEqual([]);
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
    expect(store.getState().blocklist.customTags).toEqual([]);
  });

  it('persists only the single-list shape at version 2 (CR1.T3)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    await store.setState({
      blocklist: {
        allowlist: [{ domain: { value: 'keep.com' }, tagIds: [] }],
        blocklist: [{ domain: { value: 'x.com' }, tagIds: [] }],
        customTags: [testTag],
      },
    });

    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      expect(raw[STORE_NAME]).toBeTypeOf('string');
    });
    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { blocklist: Record<string, unknown> };
      version: number;
    };

    expect(parsed.version).toBe(2);
    expect(parsed.state.blocklist).toEqual({
      blocklist: [{ domain: { value: 'x.com' }, tagIds: [] }],
      customTags: [testTag],
    });
  });
});
