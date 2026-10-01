import type { StateCreator } from 'zustand';
import type { BlocklistEntry, Tag } from './store.types';
import type { AppState } from '.';

export type BlocklistListName = 'allowlist' | 'blocklist';

export interface BlocklistSlice {
  readonly blocklist: BlocklistState;
}

export interface BlocklistState {
  readonly allowlist: ReadonlyArray<BlocklistEntry>;
  readonly blocklist: ReadonlyArray<BlocklistEntry>;
  readonly customTags: ReadonlyArray<Tag>;
}

export const createBlocklistSlice: StateCreator<AppState, [], [], BlocklistSlice> =
  () => ({
    blocklist: { allowlist: [], blocklist: [], customTags: [] },
  });

// --- Pure mutation helpers (M1.T10) ---------------------------------------
// The background is the single writer (M1.T9); the popup only *requests* a
// change. These helpers are pure and side-effect-free so they can run on the
// background side and be unit-tested without a store or a browser.
//
// The transport layer (M1.T10) deliberately keeps them minimal: they do not
// normalize the domain (that is M2.T4/M2.T21) and do not enforce allowlist
// precedence (M2.T20). They are the shared vocabulary the two sides agree on.

const toEntry = (site: string): BlocklistEntry => ({ domain: { value: site }, tagIds: [] });

const hasSite = (entries: ReadonlyArray<BlocklistEntry>, site: string): boolean =>
  entries.some((entry) => entry.domain.value === site);

export function addSiteToList(
  state: BlocklistState,
  list: BlocklistListName,
  site: string,
): BlocklistState {
  if (hasSite(state[list], site)) return state;
  return { ...state, [list]: [...state[list], toEntry(site)] };
}

export function removeSiteFromList(
  state: BlocklistState,
  list: BlocklistListName,
  site: string,
): BlocklistState {
  return { ...state, [list]: state[list].filter((entry) => entry.domain.value !== site) };
}

export function upsertTag(state: BlocklistState, tag: Tag): BlocklistState {
  const existing = state.customTags.some((candidate) => candidate.id === tag.id);
  const customTags = existing
    ? state.customTags.map((candidate) => (candidate.id === tag.id ? tag : candidate))
    : [...state.customTags, tag];
  return { ...state, customTags };
}

export function removeTag(state: BlocklistState, tagId: string): BlocklistState {
  return {
    ...state,
    customTags: state.customTags.filter((tag) => tag.id !== tagId),
    // Detach the tag from every site so no entry keeps a dangling reference.
    allowlist: state.allowlist.map((entry) => withoutTag(entry, tagId)),
    blocklist: state.blocklist.map((entry) => withoutTag(entry, tagId)),
  };
}

function withoutTag(entry: BlocklistEntry, tagId: string): BlocklistEntry {
  return { ...entry, tagIds: entry.tagIds.filter((id) => id !== tagId) };
}

export const selectAllowlist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.allowlist;

export const selectBlocklist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.blocklist;

export const selectCustomTags = (state: BlocklistSlice): ReadonlyArray<Tag> =>
  state.blocklist.customTags;
