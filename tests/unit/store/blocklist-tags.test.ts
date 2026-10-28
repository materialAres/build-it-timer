import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  assignTagToSite,
  createAppStore,
  filterEntriesByTag,
  generateTagId,
  hasTagLabel,
  unassignTagFromSite,
  type BlocklistState,
} from '@/store';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { Tag } from '@/store/store.types';

const empty: BlocklistState = { blocklist: [], customTags: [] };

const focus: Tag = { id: 'focus', label: 'Focus' };

const tagged: BlocklistState = {
  blocklist: [
    { domain: { value: 'instagram.com' }, tagIds: ['focus'] },
    { domain: { value: 'facebook.com' }, tagIds: [] },
    { domain: { value: 'x.com' }, tagIds: ['focus', 'other'] },
  ],
  customTags: [focus, { id: 'other', label: 'Other' }],
};

describe('tag helpers (M3.T2)', () => {
  describe('generateTagId', () => {
    it('is deterministic for the same clock and entropy', () => {
      expect(generateTagId(1000, 0.5)).toBe(generateTagId(1000, 0.5));
    });

    it('differs when the entropy or the clock changes', () => {
      expect(generateTagId(1000, 0.5)).not.toBe(generateTagId(1000, 0.6));
      expect(generateTagId(1000, 0.5)).not.toBe(generateTagId(2000, 0.5));
    });
  });

  describe('hasTagLabel', () => {
    it('matches an existing label case-insensitively and trimmed', () => {
      expect(hasTagLabel([focus], 'Focus')).toBe(true);
      expect(hasTagLabel([focus], '  focus ')).toBe(true);
    });

    it('does not match a different or blank label', () => {
      expect(hasTagLabel([focus], 'Deep work')).toBe(false);
      expect(hasTagLabel([focus], '   ')).toBe(false);
      expect(hasTagLabel([], 'Focus')).toBe(false);
    });
  });

  describe('assignTagToSite', () => {
    it('attaches the tag to the site', () => {
      const next = assignTagToSite(tagged, 'facebook.com', 'focus');

      expect(next.blocklist[1]?.tagIds).toEqual(['focus']);
    });

    it('normalizes a full URL to the canonical entry before assigning', () => {
      const next = assignTagToSite(tagged, 'https://m.facebook.com/x', 'focus');

      expect(next.blocklist[1]?.tagIds).toEqual(['focus']);
    });

    it('is a no-op returning the same reference when already tagged, absent or invalid', () => {
      expect(assignTagToSite(tagged, 'instagram.com', 'focus')).toBe(tagged);
      expect(assignTagToSite(tagged, 'nope.com', 'focus')).toBe(tagged);
      expect(assignTagToSite(tagged, 'co.uk', 'focus')).toBe(tagged);
      expect(assignTagToSite(tagged, 'facebook.com', '')).toBe(tagged);
    });

    it('only ever writes the single blocklist (CR1.T5a)', () => {
      const next = assignTagToSite(tagged, 'facebook.com', 'focus');

      expect(next.blocklist[1]?.tagIds).toEqual(['focus']);
      expect(Object.keys(next).sort()).toEqual(['blocklist', 'customTags']);
    });

    it('does not mutate the input state (pure)', () => {
      const before = structuredClone(tagged);

      assignTagToSite(tagged, 'facebook.com', 'focus');

      expect(tagged).toEqual(before);
    });
  });

  describe('unassignTagFromSite', () => {
    it('detaches the tag from the site', () => {
      const next = unassignTagFromSite(tagged, 'x.com', 'focus');

      expect(next.blocklist[2]?.tagIds).toEqual(['other']);
    });

    it('is a no-op returning the same reference when not tagged or invalid', () => {
      expect(unassignTagFromSite(tagged, 'facebook.com', 'focus')).toBe(tagged);
      expect(unassignTagFromSite(tagged, 'nope.com', 'focus')).toBe(tagged);
      expect(unassignTagFromSite(tagged, 'co.uk', 'focus')).toBe(tagged);
    });
  });

  describe('filterEntriesByTag (custom preset view)', () => {
    it('returns only the entries carrying the tag', () => {
      const only = filterEntriesByTag(tagged.blocklist, 'focus');

      expect(only.map((entry) => entry.domain.value)).toEqual(['instagram.com', 'x.com']);
    });

    it('returns an empty list when no entry carries the tag', () => {
      expect(filterEntriesByTag(tagged.blocklist, 'missing')).toEqual([]);
    });
  });
});

describe('tag store actions (M3.T2)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (sendMutation: (message: MutationMessage) => void) =>
    createAppStore({ dependencies: { sendMutation, now: () => 1000, random: () => 0.5 } });

  it('createTag adds a local tag and sends exactly one TAG_UPSERT', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().createTag('Focus');

    const tags = store.getState().blocklist.customTags;
    expect(tags).toHaveLength(1);
    expect(tags[0]?.label).toBe('Focus');
    expect(typeof tags[0]?.id).toBe('string');
    expect(sendMutation).toHaveBeenCalledTimes(1);
    const sent = sendMutation.mock.calls[0]?.[0];
    expect(sent?.type).toBe('TAG_UPSERT');
    if (sent?.type !== 'TAG_UPSERT') throw new Error('expected a TAG_UPSERT');
    expect(sent.payload.label).toBe('Focus');
    expect(typeof sent.payload.id).toBe('string');
  });

  it('createTag trims the label and rejects blank or duplicate names', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().createTag('  Focus  ');
    store.getState().createTag('   ');
    store.getState().createTag('focus'); // duplicate, case-insensitive

    const tags = store.getState().blocklist.customTags;
    expect(tags).toHaveLength(1);
    expect(tags[0]?.label).toBe('Focus');
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('deleteTag removes the tag, detaches it from sites and sends TAG_REMOVE', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.setState({ blocklist: tagged });

    store.getState().deleteTag('focus');

    expect(store.getState().blocklist.customTags.map((tag) => tag.id)).toEqual(['other']);
    expect(store.getState().blocklist.blocklist[0]?.tagIds).toEqual([]);
    expect(store.getState().blocklist.blocklist[2]?.tagIds).toEqual(['other']);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'TAG_REMOVE',
      payload: { tagId: 'focus' },
    });
  });

  it('deleteTag on an unknown id is a silent no-op', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().deleteTag('missing');

    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('assignTag updates the entry and sends TAG_ASSIGN', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.setState({ blocklist: tagged });

    store.getState().assignTag('facebook.com', 'focus');

    expect(store.getState().blocklist.blocklist[1]?.tagIds).toEqual(['focus']);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'TAG_ASSIGN',
      payload: { site: 'facebook.com', tagId: 'focus' },
    });
  });

  it('assignTag on an already-tagged site sends nothing', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.setState({ blocklist: tagged });

    store.getState().assignTag('instagram.com', 'focus');

    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('unassignTag updates the entry and sends TAG_UNASSIGN', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.setState({ blocklist: tagged });

    store.getState().unassignTag('x.com', 'focus');

    expect(store.getState().blocklist.blocklist[2]?.tagIds).toEqual(['other']);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'TAG_UNASSIGN',
      payload: { site: 'x.com', tagId: 'focus' },
    });
  });
});
