import { describe, it, expect } from 'vitest';
import {
  addSiteToList,
  removeSiteFromList,
  resolveListConflicts,
  upsertTag,
  removeTag,
  type BlocklistState,
} from '@/store';
import type { Tag } from '@/store/store.types';

const empty: BlocklistState = { allowlist: [], blocklist: [], customTags: [] };

const tag: Tag = { id: 'focus', label: 'Focus' };

describe('blocklist mutation helpers (M1.T10)', () => {
  it('adds a site to the addressed list only', () => {
    const next = addSiteToList(empty, 'blocklist', 'facebook.com');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
    expect(next.allowlist).toEqual([]);
  });

  it('adds a site to the allowlist when addressed', () => {
    const next = addSiteToList(empty, 'allowlist', 'facebook.com');

    expect(next.allowlist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
    expect(next.blocklist).toEqual([]);
  });

  it('does not duplicate an already present site', () => {
    const once = addSiteToList(empty, 'blocklist', 'facebook.com');
    const twice = addSiteToList(once, 'blocklist', 'facebook.com');

    expect(twice).toBe(once);
  });

  it('removes a site from the addressed list', () => {
    const withSite = addSiteToList(empty, 'blocklist', 'facebook.com');
    const next = removeSiteFromList(withSite, 'blocklist', 'facebook.com');

    expect(next.blocklist).toEqual([]);
  });

  it('removing a non-existent site is a no-op on content', () => {
    const next = removeSiteFromList(empty, 'blocklist', 'facebook.com');

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

  it('removes a tag and detaches it from every site', () => {
    const withTag: BlocklistState = {
      ...empty,
      blocklist: [{ domain: { value: 'x.com' }, tagIds: ['focus', 'other'] }],
      allowlist: [{ domain: { value: 'y.com' }, tagIds: ['focus'] }],
      customTags: [tag, { id: 'other', label: 'Other' }],
    };

    const next = removeTag(withTag, 'focus');

    expect(next.customTags).toEqual([{ id: 'other', label: 'Other' }]);
    expect(next.blocklist[0]?.tagIds).toEqual(['other']);
    expect(next.allowlist[0]?.tagIds).toEqual([]);
  });

  it('does not mutate the input state (pure)', () => {
    const before = structuredClone(empty);
    addSiteToList(empty, 'blocklist', 'facebook.com');
    upsertTag(empty, tag);

    expect(empty).toEqual(before);
  });
});

describe('blocklist entry normalization (M2.T4)', () => {
  it('normalizes a full URL to its registrable domain', () => {
    const next = addSiteToList(empty, 'blocklist', 'https://m.facebook.com/something');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
  });

  it('collapses subdomain variants to a single entry (no duplicates)', () => {
    const withWww = addSiteToList(empty, 'blocklist', 'https://www.facebook.com');
    const withMobile = addSiteToList(withWww, 'blocklist', 'https://m.facebook.com/foo');
    const withBare = addSiteToList(withMobile, 'blocklist', 'facebook.com');

    expect(withBare.blocklist).toHaveLength(1);
    expect(withBare.blocklist[0]?.domain.value).toBe('facebook.com');
  });

  it('keeps ccSLD domains intact', () => {
    const next = addSiteToList(empty, 'blocklist', 'https://m.facebook.co.uk/x');

    expect(next.blocklist[0]?.domain.value).toBe('facebook.co.uk');
  });

  it('rejects a bare public suffix without mutating the state', () => {
    for (const input of ['co.uk', 'com']) {
      const next = addSiteToList(empty, 'blocklist', input);
      expect(next).toBe(empty);
    }
  });

  it('rejects a malformed URL without throwing', () => {
    expect(() => addSiteToList(empty, 'blocklist', 'not a url')).not.toThrow();
    expect(addSiteToList(empty, 'blocklist', 'not a url')).toBe(empty);
  });

  it('rejects an empty or whitespace-only input', () => {
    expect(addSiteToList(empty, 'blocklist', '')).toBe(empty);
    expect(addSiteToList(empty, 'blocklist', '   ')).toBe(empty);
  });

  it('normalizes on removal so a full URL removes the canonical entry', () => {
    const withSite = addSiteToList(empty, 'blocklist', 'facebook.com');
    const next = removeSiteFromList(withSite, 'blocklist', 'https://m.facebook.com/x');

    expect(next.blocklist).toEqual([]);
  });

  it('rejects an invalid input on removal without mutating the state', () => {
    const withSite = addSiteToList(empty, 'blocklist', 'facebook.com');
    const next = removeSiteFromList(withSite, 'blocklist', 'co.uk');

    expect(next).toBe(withSite);
  });
});

describe('blocklist mutual exclusion (M2.T20)', () => {
  const facebook: BlocklistState = {
    allowlist: [{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }],
    blocklist: [],
    customTags: [],
  };

  it('moving a domain from the allowlist to the blocklist never creates a double entry', () => {
    const next = addSiteToList(facebook, 'blocklist', 'facebook.com');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }]);
    expect(next.allowlist).toEqual([]);
  });

  it('moving a domain from the blocklist to the allowlist never creates a double entry', () => {
    const blocked = addSiteToList(empty, 'blocklist', 'x.com');

    const next = addSiteToList(blocked, 'allowlist', 'x.com');

    expect(next.allowlist).toEqual([{ domain: { value: 'x.com' }, tagIds: [] }]);
    expect(next.blocklist).toEqual([]);
  });

  it('preserves the tags of a moved entry', () => {
    const next = addSiteToList(facebook, 'blocklist', 'facebook.com');

    expect(next.blocklist[0]?.tagIds).toEqual(['focus']);
  });

  it('compares already-normalized domains across the two lists', () => {
    const next = addSiteToList(facebook, 'blocklist', 'https://m.facebook.com/something');

    expect(next.allowlist).toEqual([]);
    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: ['focus'] }]);
  });

  it('does not move anything when the input is invalid', () => {
    expect(addSiteToList(facebook, 'blocklist', 'co.uk')).toBe(facebook);
  });

  it('keeps the target entry and clears the allowlist when the domain is in both lists', () => {
    const conflict: BlocklistState = {
      allowlist: [{ domain: { value: 'facebook.com' }, tagIds: ['a'] }],
      blocklist: [{ domain: { value: 'facebook.com' }, tagIds: ['b'] }],
      customTags: [],
    };

    const next = addSiteToList(conflict, 'blocklist', 'facebook.com');

    expect(next.blocklist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: ['b'] }]);
    expect(next.allowlist).toEqual([]);
  });

  it('heals a residual conflict elsewhere while adding a new domain (allowlist wins)', () => {
    const residual: BlocklistState = {
      allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
      blocklist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
      customTags: [],
    };

    const next = addSiteToList(residual, 'blocklist', 'x.com');

    expect(next.allowlist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
    expect(next.blocklist).toEqual([{ domain: { value: 'x.com' }, tagIds: [] }]);
  });

  describe('resolveListConflicts', () => {
    it('drops the blocklisted copy when a domain is on both lists (allowlist wins)', () => {
      const conflicted: BlocklistState = {
        allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        blocklist: [
          { domain: { value: 'facebook.com' }, tagIds: [] },
          { domain: { value: 'x.com' }, tagIds: [] },
        ],
        customTags: [],
      };

      const resolved = resolveListConflicts(conflicted);

      expect(resolved.allowlist).toEqual([{ domain: { value: 'facebook.com' }, tagIds: [] }]);
      expect(resolved.blocklist).toEqual([{ domain: { value: 'x.com' }, tagIds: [] }]);
    });

    it('is a no-op returning the same reference when nothing conflicts', () => {
      const clean: BlocklistState = {
        allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        blocklist: [{ domain: { value: 'x.com' }, tagIds: [] }],
        customTags: [],
      };

      expect(resolveListConflicts(clean)).toBe(clean);
      expect(resolveListConflicts(empty)).toBe(empty);
    });

    it('does not mutate the input state (pure)', () => {
      const conflicted: BlocklistState = {
        allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        blocklist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        customTags: [],
      };
      const before = structuredClone(conflicted);

      resolveListConflicts(conflicted);

      expect(conflicted).toEqual(before);
    });
  });
});
