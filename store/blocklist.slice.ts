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
// The DNR side-effect is owned by M2.T7.

const toEntry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

const hasSite = (entries: ReadonlyArray<BlocklistEntry>, domain: string): boolean =>
  entries.some((entry) => entry.domain.value === domain);

const oppositeList = (list: BlocklistListName): BlocklistListName =>
  list === 'allowlist' ? 'blocklist' : 'allowlist';

/**
 * Enforce the allowlist/blocklist precedence on a state that may already hold
 * the same canonical domain in both lists (a preset expansion, an import, or a
 * pre-existing persisted state — none of which go through `addSiteToList`).
 *
 * **The allowlist always wins** (M2.T6/M2.T8): a domain present in the allowlist
 * is dropped from the blocklist; the allowlist is never touched. Returns the
 * *same* reference when there is no residual conflict, so the caller can skip a
 * write (same identity pattern as M1.T10/M2.T10).
 */
export function resolveListConflicts(state: BlocklistState): BlocklistState {
  const allowed = new Set(state.allowlist.map((entry) => entry.domain.value));
  const blocklist = state.blocklist.filter((entry) => !allowed.has(entry.domain.value));
  if (blocklist.length === state.blocklist.length) return state;
  return { ...state, blocklist };
}

/**
 * Add a site to one list, enforcing **mutual exclusion** (M2.T20): a canonical
 * domain can never live in both lists at once, so adding it to one list *moves*
 * it out of the other (the "move" resolution the UI offers). The comparison is
 * on the already-normalized domain (M1.T2/M2.T4), so `https://m.` and `www.`
 * variants of the same registrable domain collapse onto one another.
 *
 * A duplicate add to the list that already holds the domain, with no residual
 * conflict, is a no-op returning the same reference (M1.T10/M2.T4). Because a
 * moved entry keeps its `tagIds`, an allow/block switch does not silently lose
 * the tags a user attached to the site. A residual conflict present elsewhere in
 * the state is healed in passing (`resolveListConflicts`): every add returns a
 * conflict-free state.
 */
export function addSiteToList(
  state: BlocklistState,
  list: BlocklistListName,
  site: string,
): BlocklistState {
  const normalized = getRegistrableDomain(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const other = oppositeList(list);
  const alreadyInTarget = hasSite(state[list], domain);
  const inOther = state[other].find((entry) => entry.domain.value === domain);

  if (alreadyInTarget && inOther === undefined) return state;

  const target = alreadyInTarget
    ? state[list]
    : [...state[list], inOther ?? toEntry(domain)];

  return resolveListConflicts({
    ...state,
    [other]:
      inOther === undefined
        ? state[other]
        : state[other].filter((entry) => entry.domain.value !== domain),
    [list]: target,
  });
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
