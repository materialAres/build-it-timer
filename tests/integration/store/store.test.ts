import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  partialize,
  selectRemainingSeconds,
  selectCustomTags,
  selectActiveTab,
  STORE_NAME,
} from '@/store';
import type { Tag } from '@/store/store.types';

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
    expect(state.ui.activeTab).toBe('timer');
  });

  it('partialize keeps the persisted slices and drops the volatile ui slice', () => {
    const store = createAppStore();
    const persisted = partialize(store.getState());

    expect(Object.keys(persisted).sort()).toEqual(
      ['blocklist', 'city', 'score', 'timer'].sort(),
    );
    expect(persisted).not.toHaveProperty('ui');
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

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: Record<string, unknown>;
    };

    expect(parsed.state).toHaveProperty('blocklist');
    expect(parsed.state).not.toHaveProperty('ui');
  });

  it('exposes granular per-slice selectors', () => {
    const store = createAppStore();
    const state = store.getState();

    expect(selectRemainingSeconds(state)).toBe(25 * 60);
    expect(selectCustomTags(state)).toEqual([]);
    expect(selectActiveTab(state)).toBe('timer');
  });
});
