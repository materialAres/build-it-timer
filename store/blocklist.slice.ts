import type { StateCreator } from 'zustand';
import { getRegistrableDomain } from '@/lib/url/domain';
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

// --- Pure mutation helpers (M1.T10, normalization M2.T4) -------------------
// The background is the single writer (M1.T9); the popup only *requests* a
// change. These helpers are pure and side-effect-free so they can run on the
// background side and be unit-tested without a store or a browser.
//
// User input is untrusted (M2.T4): every site goes through
// `getRegistrableDomain` before it is stored, so only the canonical registrable
// form (`eTLD+1`, subdomains removed — the M1.T2 design decision) ever reaches
// the state. A malformed URL or a "bare" public suffix (`co.uk`, `com`) is
// rejected: the helper returns the *same* state reference, which the background
// uses to skip persisting and the UI to show "Enter a valid URL" (M2.T21/M3.T3).
//
// Allowlist/blocklist mutual exclusion (M2.T20) and the DNR side-effect (M2.T7)
// are owned by those tasks.

const toEntry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

const hasSite = (entries: ReadonlyArray<BlocklistEntry>, domain: string): boolean =>
  entries.some((entry) => entry.domain.value === domain);

export function addSiteToList(
  state: BlocklistState,
  list: BlocklistListName,
  site: string,
): BlocklistState {
  const normalized = getRegistrableDomain(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  if (hasSite(state[list], domain)) return state;
  return { ...state, [list]: [...state[list], toEntry(domain)] };
}

export function removeSiteFromList(
  state: BlocklistState,
  list: BlocklistListName,
  site: string,
): BlocklistState {
  // Normalize on removal too, so a full URL (`https://m.facebook.com/x`) removes
  // the canonical `facebook.com` entry instead of silently matching nothing.
  const normalized = getRegistrableDomain(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  return { ...state, [list]: state[list].filter((entry) => entry.domain.value !== domain) };
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
