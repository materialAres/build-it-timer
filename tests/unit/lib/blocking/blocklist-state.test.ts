import { describe, it, expect } from 'vitest';
import {
  EMPTY_BLOCKLIST_STATE,
  sanitizeBlocklistState,
} from '@/lib/blocking/blocklist-state';

const entry = (domain: string, manual: boolean, presetIds: string[]) => ({
  domain: { value: domain },
  manual,
  presetIds,
});

describe('sanitizeBlocklistState (CR4.T3)', () => {
  it('keeps a valid version-3 state unchanged', () => {
    const state = {
      blocklist: [entry('x.com', false, ['social']), entry('a.com', true, [])],
      appliedPresetIds: ['social'],
      userPresets: [{ id: 'user:w', name: 'Work', domains: [{ value: 'a.com' }] }],
    };

    expect(sanitizeBlocklistState(state)).toEqual(state);
  });

  it.each([undefined, null, 'nope', 42, []])(
    'degrades %j to the empty state without throwing',
    (value) => {
      expect(sanitizeBlocklistState(value)).toEqual(EMPTY_BLOCKLIST_STATE);
    },
  );

  it('degrades malformed fields to empty arrays', () => {
    expect(
      sanitizeBlocklistState({ blocklist: 'x', appliedPresetIds: 3, userPresets: {} }),
    ).toEqual(EMPTY_BLOCKLIST_STATE);
  });

  it('drops invalid entries and collapses a repeated domain (first wins)', () => {
    const next = sanitizeBlocklistState({
      blocklist: [
        entry('x.com', true, []),
        entry('x.com', false, []),
        { domain: { value: '' } },
        { domain: 'x.com' },
        null,
      ],
    });

    expect(next.blocklist).toEqual([entry('x.com', true, [])]);
  });

  it('turns a source-less entry into a manual one instead of dropping it', () => {
    const next = sanitizeBlocklistState({
      blocklist: [{ domain: { value: 'x.com' }, manual: false, presetIds: [] }],
    });

    expect(next.blocklist).toEqual([entry('x.com', true, [])]);
  });

  it('only keeps applied ids that name a real preset', () => {
    const next = sanitizeBlocklistState({
      appliedPresetIds: ['social', 'ghost', 'user:w', 'social'],
      userPresets: [{ id: 'user:w', name: 'Work', domains: [] }],
    });

    expect(next.appliedPresetIds).toEqual(['social', 'user:w']);
  });

  it('removes entry sources that are not applied', () => {
    const next = sanitizeBlocklistState({
      blocklist: [entry('x.com', false, ['social', 'video'])],
      appliedPresetIds: ['social'],
    });

    expect(next.blocklist).toEqual([entry('x.com', false, ['social'])]);
  });

  it('rejects user presets that reuse a built-in or repeated id, or lack a name', () => {
    const next = sanitizeBlocklistState({
      userPresets: [
        { id: 'social', name: 'Mine', domains: [] },
        { id: 'user:a', name: 'A', domains: [{ value: 'a.com' }, { value: 3 }] },
        { id: 'user:a', name: 'Again', domains: [] },
        { id: 'user:b', domains: [] },
      ],
    });

    expect(next.userPresets).toEqual([
      { id: 'user:a', name: 'A', domains: [{ value: 'a.com' }] },
    ]);
  });
});
