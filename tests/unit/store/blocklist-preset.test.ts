import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  selectAppliedPresetIds,
  selectIsPresetApplied,
  selectPresetCoveredCount,
  selectUserPresets,
  type AppStore,
} from '@/store';
import { PRESETS } from '@/lib/blocking/presets';
import type { MutationMessage } from '@/lib/messaging/messages.types';

function createStore() {
  const sendMutation = vi.fn<(message: MutationMessage) => void>();
  const store = createAppStore({
    dependencies: { sendMutation, now: () => 1_000, random: () => 0.5 },
  });
  return { store, sendMutation };
}

const domainsOf = (store: AppStore): string[] =>
  store.getState().blocklist.blocklist.map((entry) => entry.domain.value);

describe('built-in presets (M2.T5)', () => {
  it('every declared preset is canonical and has a unique id', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(
      PRESETS.length,
    );
    for (const preset of PRESETS) {
      const { store } = createStore();
      store.getState().togglePreset(preset.id, true);
      expect(domainsOf(store)).toHaveLength(preset.domains.length);
    }
  });
});

describe('togglePreset store action (CR4.T3)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('applies the whole preset in a single update and sends a single mutation', () => {
    const { store, sendMutation } = createStore();
    const notify = vi.fn();
    store.subscribe(notify);

    store.getState().togglePreset('social', true);

    expect(domainsOf(store)).toEqual([
      'instagram.com',
      'facebook.com',
      'x.com',
      'tiktok.com',
    ]);
    // One store update (one re-render) and one mutation for the whole preset.
    expect(notify).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: true },
    });
  });

  it('switches the preset off again and removes only what it contributed', () => {
    const { store, sendMutation } = createStore();
    store.getState().addSite('x.com');
    store.getState().togglePreset('social', true);

    store.getState().togglePreset('social', false);

    expect(domainsOf(store)).toEqual(['x.com']);
    expect(selectAppliedPresetIds(store.getState())).toEqual([]);
    expect(sendMutation).toHaveBeenLastCalledWith({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: false },
    });
  });

  it('switching on a preset that is already on sends nothing', () => {
    const { store, sendMutation } = createStore();
    store.getState().togglePreset('social', true);
    sendMutation.mockClear();

    store.getState().togglePreset('social', true);

    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('ignores an unknown preset id without mutating or sending', () => {
    const { store, sendMutation } = createStore();

    store.getState().togglePreset('does-not-exist', true);

    expect(domainsOf(store)).toEqual([]);
    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('exposes the applied state and the covered count through selectors', () => {
    const { store } = createStore();
    const social = PRESETS[0];
    if (social === undefined) throw new Error('missing preset');

    expect(selectIsPresetApplied('social')(store.getState())).toBe(false);
    expect(selectPresetCoveredCount(social)(store.getState())).toBe(0);

    store.getState().togglePreset('social', true);
    expect(selectIsPresetApplied('social')(store.getState())).toBe(true);
    expect(selectPresetCoveredCount(social)(store.getState())).toBe(4);

    store.getState().removeSite('x.com');
    expect(selectIsPresetApplied('social')(store.getState())).toBe(true);
    expect(selectPresetCoveredCount(social)(store.getState())).toBe(3);
  });
});

describe('saved presets store actions (CR4.T3)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('savePreset mints the id from the injected clock and entropy', () => {
    const { store, sendMutation } = createStore();
    store.getState().addSite('x.com');
    sendMutation.mockClear();

    store.getState().savePreset('  Focus ');

    const [preset] = selectUserPresets(store.getState());
    expect(preset?.name).toBe('Focus');
    expect(preset?.id.startsWith('user:')).toBe(true);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'PRESET_SAVE',
      // The raw name is sent; the background trims and validates it again.
      payload: { id: preset?.id, name: '  Focus ' },
    });
    // The domains are not sent: the background snapshots its own list.
    expect(JSON.stringify(sendMutation.mock.calls)).not.toContain('x.com');
  });

  it('savePreset rejects an empty list and duplicate names without sending', () => {
    const { store, sendMutation } = createStore();

    store.getState().savePreset('Focus');
    expect(sendMutation).not.toHaveBeenCalled();

    store.getState().addSite('x.com');
    store.getState().savePreset('social');
    expect(selectUserPresets(store.getState())).toEqual([]);
  });

  it('renames and deletes a saved preset, keeping its sites blocked', () => {
    const { store } = createStore();
    store.getState().addSite('x.com');
    store.getState().savePreset('Focus');
    const id = selectUserPresets(store.getState())[0]?.id ?? '';

    store.getState().renamePreset(id, 'Deep work');
    expect(selectUserPresets(store.getState())[0]?.name).toBe('Deep work');

    store.getState().deletePreset(id);
    expect(selectUserPresets(store.getState())).toEqual([]);
    expect(domainsOf(store)).toEqual(['x.com']);
    expect(store.getState().blocklist.blocklist[0]?.manual).toBe(true);
  });

  it('a saved preset toggles like a built-in one', () => {
    const { store } = createStore();
    store.getState().addSite('x.com');
    store.getState().savePreset('Focus');
    const id = selectUserPresets(store.getState())[0]?.id ?? '';

    store.getState().togglePreset(id, false);
    expect(domainsOf(store)).toEqual([]);

    store.getState().togglePreset(id, true);
    expect(domainsOf(store)).toEqual(['x.com']);
  });

  it('never renames or deletes a built-in preset', () => {
    const { store, sendMutation } = createStore();

    store.getState().renamePreset('social', 'Mine');
    store.getState().deletePreset('social');

    expect(sendMutation).not.toHaveBeenCalled();
  });
});
