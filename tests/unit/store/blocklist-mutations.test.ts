import { describe, it, expect } from 'vitest';
import {
  addBlocklistSite,
  removeBlocklistSite,
  upsertTag,
  removeTag,
  type BlocklistState,
} from '@/store';
import type { Tag } from '@/store/store.types';

const empty: BlocklistState = { blocklist: [], customTags: [] };

const tag: Tag = { id: 'focus', label: 'Focus' };

describe('blocklist mutation helpers (M1.T10)', () => {
  it('adds a site to the blocklist', () => {
    const next = addBlocklistSite(empty, 'facebook.com');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
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

  it('upserts a new tag', () => {
    const next = upsertTag(empty, tag);

    expect(next.customTags).toEqual([tag]);
  });

  it('updates an existing tag in place', () => {
    const created = upsertTag(empty, tag);
    const renamed: Tag = { id: 'focus', label: 'Deep focus' };
    const next = upsertTag(created, renamed);

    expect(next.customTags).toEqual([renamed]);
  });

  it('removes a tag and detaches it from every blocklisted site', () => {
    const withTag: BlocklistState = {
      blocklist: [
        { domain: { value: 'x.com' }, tagIds: ['focus', 'other'] },
        { domain: { value: 'y.com' }, tagIds: ['focus'] },
      ],
      customTags: [tag, { id: 'other', label: 'Other' }],
    };

    const next = removeTag(withTag, 'focus');

    expect(next.customTags).toEqual([{ id: 'other', label: 'Other' }]);
    expect(next.blocklist[0]?.tagIds).toEqual(['other']);
    expect(next.blocklist[1]?.tagIds).toEqual([]);
  });

  it('does not mutate the input state (pure)', () => {
    const before = structuredClone(empty);
    addBlocklistSite(empty, 'facebook.com');
    upsertTag(empty, tag);

    expect(empty).toEqual(before);
  });
});

describe('blocklist entry normalization (M2.T4)', () => {
  it('normalizes a full URL to its registrable domain', () => {
    const next = addBlocklistSite(empty, 'https://m.facebook.com/something');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
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

describe('single blocklist (CR1.T5a)', () => {
  it('never adds a second list to the state', () => {
    const next = addBlocklistSite(empty, 'facebook.com');

    expect(Object.keys(next).sort()).toEqual(['blocklist', 'customTags']);
    expect('allowlist' in next).toBe(false);
  });

  it('keeps the tags of an entry that is added again', () => {
    const tagged: BlocklistState = {
      blocklist: [{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }],
      customTags: [tag],
    };

    expect(addBlocklistSite(tagged, 'facebook.com')).toBe(tagged);
  });
});
