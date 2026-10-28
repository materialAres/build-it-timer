import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, addPresetToBlocklist, type BlocklistState } from '@/store';
import { PRESETS, getPresetById } from '@/lib/blocking/presets';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { Preset } from '@/store/store.types';

const empty: BlocklistState = { blocklist: [], customTags: [] };

function requirePreset(id: string): Preset {
  const preset = getPresetById(id);
  if (preset === undefined) throw new Error(`missing preset ${id}`);
  return preset;
}

describe('preset expansion (M3.T1)', () => {
  it('adds every domain of a preset to the blocklist', () => {
    const next = addPresetToBlocklist(empty, requirePreset('social'));

    expect(next.blocklist.map((entry) => entry.domain.value)).toEqual([
      'instagram.com',
      'facebook.com',
      'x.com',
      'tiktok.com',
    ]);
  });

  it('attaches the preset tag to every contributed domain', () => {
    const next = addPresetToBlocklist(empty, requirePreset('social'));

    for (const entry of next.blocklist) {
      expect(entry.tagIds).toEqual(['social']);
    }
  });

  it('applies two presets with an overlapping domain without duplicating it', () => {
    const first: Preset = {
      id: 'one',
      name: 'One',
      tag: { id: 'one', label: 'One' },
      domains: [{ value: 'shared.com' }, { value: 'a.com' }],
    };
    const second: Preset = {
      id: 'two',
      name: 'Two',
      tag: { id: 'two', label: 'Two' },
      domains: [{ value: 'shared.com' }, { value: 'b.com' }],
    };

    const next = addPresetToBlocklist(addPresetToBlocklist(empty, first), second);

    expect(next.blocklist.map((entry) => entry.domain.value)).toEqual([
      'shared.com',
      'a.com',
      'b.com',
    ]);
    // The shared domain keeps one entry and gathers both tags.
    expect(next.blocklist[0]?.tagIds).toEqual(['one', 'two']);
  });

  it('keeps an existing tagged entry and adds the preset tag', () => {
    const existing: BlocklistState = {
      blocklist: [{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }],
      customTags: [],
    };

    const next = addPresetToBlocklist(existing, requirePreset('social'));

    expect(next.blocklist.find((entry) => entry.domain.value === 'facebook.com')?.tagIds).toEqual([
      'focus',
      'social',
    ]);
  });

  it('is a no-op returning the same reference for an empty preset', () => {
    const bare: Preset = {
      id: 'bare',
      name: 'Bare',
      tag: { id: 'bare', label: 'Bare' },
      domains: [],
    };

    expect(addPresetToBlocklist(empty, bare)).toBe(empty);
  });

  it('applying the same preset twice returns the same reference and never duplicates', () => {
    const once = addPresetToBlocklist(empty, requirePreset('social'));

    expect(addPresetToBlocklist(once, requirePreset('social'))).toBe(once);
  });

  it('does not mutate the input state (pure)', () => {
    const before = structuredClone(empty);

    addPresetToBlocklist(empty, requirePreset('social'));

    expect(empty).toEqual(before);
  });

  it('every declared preset is canonical and adds without leftovers', () => {
    for (const preset of PRESETS) {
      const next = addPresetToBlocklist(empty, preset);
      expect(next.blocklist).toHaveLength(preset.domains.length);
    }
  });
});

describe('applyPreset store action (M3.T1)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('applies the whole preset in a single update and sends a single mutation', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createAppStore({ dependencies: { sendMutation } });
    const notify = vi.fn();
    store.subscribe(notify);

    store.getState().applyPreset('social');

    expect(store.getState().blocklist.blocklist.map((entry) => entry.domain.value)).toEqual([
      'instagram.com',
      'facebook.com',
      'x.com',
      'tiktok.com',
    ]);
    // One store update (one re-render) for the whole preset.
    expect(notify).toHaveBeenCalledTimes(1);
    // One mutation, not one per domain.
    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'BLOCKLIST_APPLY_PRESET',
      payload: { presetId: 'social' },
    });
  });

  it('ignores an unknown preset id without mutating or sending', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createAppStore({ dependencies: { sendMutation } });

    store.getState().applyPreset('does-not-exist');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).not.toHaveBeenCalled();
  });
});
