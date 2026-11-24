import { describe, it, expect } from 'vitest';
import {
  addBlocklistSite,
  removeBlocklistSite,
} from '@/lib/blocking/blocklist-sites';
import type { BlocklistState } from '@/store/store.types';

const empty: BlocklistState = {
  blocklist: [],
  appliedPresetIds: [],
  userPresets: [],
};

const manual = (domain: string) => ({
  domain: { value: domain },
  manual: true,
  presetIds: [],
});

describe('blocklist site helpers (M1.T10)', () => {
  it('adds a site to the blocklist', () => {
    const next = addBlocklistSite(empty, 'facebook.com');

    expect(next.blocklist).toEqual([manual('facebook.com')]);
  });

  it('does not duplicate an already present site', () => {
    const once = addBlocklistSite(empty, 'facebook.com');
    const twice = addBlocklistSite(once, 'facebook.com');

    expect(twice).toBe(once);
  });

  it('removes a site from the blocklist', () => {
    const withSite = addBlocklistSite(empty, 'facebook.com');
    const next = removeBlocklistSite(withSite, 'facebook.com');

    expect(next.blocklist).toEqual([]);
  });

  it('removing a non-existent site is a no-op on content', () => {
    const next = removeBlocklistSite(empty, 'facebook.com');

    expect(next.blocklist).toEqual([]);
  });

  it('does not mutate the input state (pure)', () => {
    const before = structuredClone(empty);
    addBlocklistSite(empty, 'facebook.com');

    expect(empty).toEqual(before);
  });
});

describe('blocklist entry normalization (M2.T4)', () => {
  it('normalizes a full URL to its registrable domain', () => {
    const next = addBlocklistSite(empty, 'https://m.facebook.com/something');

    expect(next.blocklist).toEqual([manual('facebook.com')]);
  });

  it('collapses subdomain variants to a single entry (no duplicates)', () => {
    const withWww = addBlocklistSite(empty, 'https://www.facebook.com');
    const withMobile = addBlocklistSite(withWww, 'https://m.facebook.com/foo');
    const withBare = addBlocklistSite(withMobile, 'facebook.com');

    expect(withBare.blocklist).toHaveLength(1);
    expect(withBare.blocklist[0]?.domain.value).toBe('facebook.com');
  });

  it('keeps ccSLD domains intact', () => {
    const next = addBlocklistSite(empty, 'https://m.facebook.co.uk/x');

    expect(next.blocklist[0]?.domain.value).toBe('facebook.co.uk');
  });

  it('rejects a bare public suffix without mutating the state', () => {
    for (const input of ['co.uk', 'com']) {
      const next = addBlocklistSite(empty, input);
      expect(next).toBe(empty);
    }
  });

  it('rejects a malformed URL without throwing', () => {
    expect(() => addBlocklistSite(empty, 'not a url')).not.toThrow();
    expect(addBlocklistSite(empty, 'not a url')).toBe(empty);
  });

  it('rejects an empty or whitespace-only input', () => {
    expect(addBlocklistSite(empty, '')).toBe(empty);
    expect(addBlocklistSite(empty, '   ')).toBe(empty);
  });

  it('normalizes on removal so a full URL removes the canonical entry', () => {
    const withSite = addBlocklistSite(empty, 'facebook.com');
    const next = removeBlocklistSite(withSite, 'https://m.facebook.com/x');

    expect(next.blocklist).toEqual([]);
  });

  it('rejects an invalid input on removal without mutating the state', () => {
    const withSite = addBlocklistSite(empty, 'facebook.com');
    const next = removeBlocklistSite(withSite, 'co.uk');

    expect(next).toBe(withSite);
  });
});

describe('single blocklist (CR1.T5a, CR4.T3)', () => {
  it('never adds a second list to the state', () => {
    const next = addBlocklistSite(empty, 'facebook.com');

    expect(Object.keys(next).sort()).toEqual([
      'appliedPresetIds',
      'blocklist',
      'userPresets',
    ]);
    expect('allowlist' in next).toBe(false);
  });

  it('adding an already manual entry again is a no-op', () => {
    const listed: BlocklistState = {
      ...empty,
      blocklist: [{ ...manual('facebook.com'), presetIds: ['social'] }],
    };

    expect(addBlocklistSite(listed, 'facebook.com')).toBe(listed);
  });
});

describe('entries contributed by a preset (CR4.T3)', () => {
  const presetOnly: BlocklistState = {
    blocklist: [
      {
        domain: { value: 'facebook.com' },
        manual: false,
        presetIds: ['social'],
      },
    ],
    appliedPresetIds: ['social'],
    userPresets: [],
  };

  it('typing a preset-only domain makes it manual and keeps its preset source', () => {
    const next = addBlocklistSite(presetOnly, 'https://www.facebook.com');

    expect(next.blocklist).toEqual([
      {
        domain: { value: 'facebook.com' },
        manual: true,
        presetIds: ['social'],
      },
    ]);
    expect(next.appliedPresetIds).toEqual(['social']);
  });

  it('removing a site removes it whatever its sources and keeps presets applied', () => {
    const next = removeBlocklistSite(presetOnly, 'facebook.com');

    expect(next.blocklist).toEqual([]);
    expect(next.appliedPresetIds).toEqual(['social']);
  });
});
