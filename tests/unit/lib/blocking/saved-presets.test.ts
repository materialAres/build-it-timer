import { describe, it, expect } from 'vitest';
import {
  deleteUserPreset,
  generatePresetId,
  MAX_PRESET_NAME_LENGTH,
  renameUserPreset,
  saveUserPreset,
} from '@/lib/blocking/saved-presets';
import type {
  BlocklistEntry,
  BlocklistState,
  Preset,
} from '@/store/store.types';

const preset = (
  id: string,
  name: string,
  domains: ReadonlyArray<string>,
): Preset => ({ id, name, domains: domains.map((value) => ({ value })) });

const SOCIAL = preset('social', 'Social', ['x.com', 'facebook.com']);
const VIDEO = preset('video', 'Video', ['youtube.com', 'x.com']);
const BUILT_IN: ReadonlyArray<Preset> = [SOCIAL, VIDEO];

const entry = (
  domain: string,
  manual: boolean,
  presetIds: ReadonlyArray<string> = [],
): BlocklistEntry => ({ domain: { value: domain }, manual, presetIds });

const state = (over: Partial<BlocklistState> = {}): BlocklistState => ({
  blocklist: [],
  appliedPresetIds: [],
  userPresets: [],
  ...over,
});

describe('generatePresetId', () => {
  it('prefixes user ids so they never collide with built-in ids', () => {
    expect(generatePresetId(1_700_000_000_000, 0.5).startsWith('user:')).toBe(
      true,
    );
  });

  it('is deterministic for the same clock and entropy', () => {
    expect(generatePresetId(10, 0.25)).toBe(generatePresetId(10, 0.25));
    expect(generatePresetId(10, 0.25)).not.toBe(generatePresetId(11, 0.25));
  });
});

describe('saveUserPreset', () => {
  const listed = state({
    blocklist: [entry('a.com', true), entry('x.com', false, ['social'])],
    appliedPresetIds: ['social'],
  });

  it('snapshots every current entry into a new applied preset and clears manual', () => {
    const next = saveUserPreset(listed, 'user:1', ' Work ', BUILT_IN);
    expect(next.userPresets).toEqual([
      preset('user:1', 'Work', ['a.com', 'x.com']),
    ]);
    expect(next.appliedPresetIds).toEqual(['social', 'user:1']);
    expect(next.blocklist).toEqual([
      entry('a.com', false, ['user:1']),
      entry('x.com', false, ['social', 'user:1']),
    ]);
  });

  it('rejects an empty blocklist', () => {
    expect(saveUserPreset(state(), 'user:1', 'Work', BUILT_IN)).toEqual(
      state(),
    );
    const s = state();
    expect(saveUserPreset(s, 'user:1', 'Work', BUILT_IN)).toBe(s);
  });

  it('rejects blank, too-long and duplicate names (case-insensitive, built-ins too)', () => {
    expect(saveUserPreset(listed, 'user:1', '   ', BUILT_IN)).toBe(listed);
    expect(
      saveUserPreset(
        listed,
        'user:1',
        'x'.repeat(MAX_PRESET_NAME_LENGTH + 1),
        BUILT_IN,
      ),
    ).toBe(listed);
    expect(saveUserPreset(listed, 'user:1', 'social', BUILT_IN)).toBe(listed);
    const saved = saveUserPreset(listed, 'user:1', 'Work', BUILT_IN);
    expect(saveUserPreset(saved, 'user:2', 'WORK', BUILT_IN)).toBe(saved);
  });

  it('rejects an id that is empty or already taken', () => {
    expect(saveUserPreset(listed, '', 'Work', BUILT_IN)).toBe(listed);
    expect(saveUserPreset(listed, 'social', 'Work', BUILT_IN)).toBe(listed);
  });

  it('accepts a name of exactly the maximum length', () => {
    const name = 'x'.repeat(MAX_PRESET_NAME_LENGTH);
    const next = saveUserPreset(listed, 'user:1', name, BUILT_IN);
    expect(next.userPresets[0]?.name).toBe(name);
  });
});

describe('renameUserPreset', () => {
  const saved = saveUserPreset(
    state({ blocklist: [entry('a.com', true)] }),
    'user:1',
    'Work',
    BUILT_IN,
  );

  it('renames a user preset (trimmed)', () => {
    const next = renameUserPreset(saved, 'user:1', '  Study ', BUILT_IN);
    expect(next.userPresets[0]?.name).toBe('Study');
    expect(next.blocklist).toBe(saved.blocklist);
  });

  it('allows changing only the case of its own name', () => {
    const next = renameUserPreset(saved, 'user:1', 'work', BUILT_IN);
    expect(next.userPresets[0]?.name).toBe('work');
  });

  it('is a no-op for the same name, an invalid name or a built-in clash', () => {
    expect(renameUserPreset(saved, 'user:1', 'Work', BUILT_IN)).toBe(saved);
    expect(renameUserPreset(saved, 'user:1', '', BUILT_IN)).toBe(saved);
    expect(renameUserPreset(saved, 'user:1', 'Video', BUILT_IN)).toBe(saved);
  });

  it('never renames a built-in or an unknown preset', () => {
    expect(renameUserPreset(saved, 'social', 'Mine', BUILT_IN)).toBe(saved);
    expect(renameUserPreset(saved, 'user:9', 'Mine', BUILT_IN)).toBe(saved);
  });
});

describe('deleteUserPreset', () => {
  const base = state({
    blocklist: [entry('a.com', true), entry('x.com', false, ['social'])],
    appliedPresetIds: ['social'],
  });
  const saved = saveUserPreset(base, 'user:1', 'Work', BUILT_IN);

  it('removes the preset and its applied flag', () => {
    const next = deleteUserPreset(saved, 'user:1');
    expect(next.userPresets).toEqual([]);
    expect(next.appliedPresetIds).toEqual(['social']);
  });

  it('keeps the sites blocked: entries it alone sourced become manual', () => {
    const next = deleteUserPreset(saved, 'user:1');
    expect(next.blocklist).toEqual([
      entry('a.com', true),
      entry('x.com', false, ['social']),
    ]);
  });

  it('is a no-op for a built-in or unknown preset', () => {
    expect(deleteUserPreset(saved, 'social')).toBe(saved);
    expect(deleteUserPreset(saved, 'user:9')).toBe(saved);
  });
});
