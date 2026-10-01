import { describe, it, expect } from 'vitest';
import {
  addSiteToList,
  removeSiteFromList,
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
