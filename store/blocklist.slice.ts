import type { StateCreator } from 'zustand';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { getPresetById } from '@/lib/blocking/presets';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { MessagingDependencies } from '@/lib/messaging/mutation-sender';
import type { BlocklistEntry, Preset, Tag } from './store.types';
import type { AppState } from '.';

export interface BlocklistSlice {
  readonly blocklist: BlocklistState;
  /**
   * Apply a preset's whole domain list to the blocklist as a **single** action
   * (M3.T1): the expansion happens in one state update, so the UI does not
   * dispatch N mutations / cause N re-renders or persists. The same mutation is
   * forwarded to the background — the single writer (M1.T9) — so the change is
   * persisted and propagates back through the M1.T8 sync bridge.
   */
  readonly applyPreset: (presetId: string) => void;
  /**
   * Add a single site to the blocklist (M3.T3). Normalization (M2.T4/M2.T21)
   * and dedup live in the pure helper; the action only applies it and forwards
   * one mutation. A duplicate add or an invalid site is a silent no-op (same
   * reference), so nothing is persisted.
   */
  readonly addSite: (site: string) => void;
  /** Remove a single site from the blocklist (M3.T3). */
  readonly removeSite: (site: string) => void;
  /**
   * Create a custom tag (M3.T2) after a case-insensitive duplicate-label check.
   * The id is minted from the injected clock/entropy (never in the component),
   * so the UI stays presentational. Locally optimistic update + one mutation.
   */
  readonly createTag: (label: string) => void;
  /** Delete a tag and detach it from every blocklisted site (M3.T2). */
  readonly deleteTag: (tagId: string) => void;
  /** Assign an existing tag to a single site (M3.T2). */
  readonly assignTag: (site: string, tagId: string) => void;
  /** Remove a tag from a single site (M3.T2). */
  readonly unassignTag: (site: string, tagId: string) => void;
}

/**
 * The blocklist state (CR1.T5a): exactly one list of blocked sites plus the
 * user's custom tags. It is also the persisted shape from version 2 onward, so
 * the in-memory state and the stored payload cannot drift apart.
 */
export interface BlocklistState {
  readonly blocklist: ReadonlyArray<BlocklistEntry>;
  readonly customTags: ReadonlyArray<Tag>;
}

/**
 * Collaborators required to change the blocklist from a non-owner context
 * (M1.T10). Injectable (principle D) so the slice stays unit-testable without
 * the message bus; the store barrel supplies the real `sendMessage`.
 */
export interface BlocklistDependencies extends MessagingDependencies {
  /** Clock used to mint tag ids (M3.T2); injectable for determinism. */
  readonly now?: () => number;
  /** Entropy source for tag ids (M3.T2); injectable for determinism. */
  readonly random?: () => number;
}

export const createBlocklistSlice =
  (
    dependencies: BlocklistDependencies = {},
  ): StateCreator<AppState, [], [], BlocklistSlice> =>
  (set, get) => ({
    blocklist: { blocklist: [], customTags: [] },
    applyPreset(presetId) {
      const preset = getPresetById(presetId);
      if (preset === undefined) return;

      // One transformation, one `set`: the whole preset is expanded at once.
      const current = get().blocklist;
      const next = addPresetToBlocklist(current, preset);
      if (next !== current) set({ blocklist: next });

      // One message, not one per domain: the background applies the identical
      // idempotent expansion and persists it exactly once.
      dependencies.sendMutation?.({
        type: 'BLOCKLIST_APPLY_PRESET',
        payload: { presetId },
      });
    },
    addSite(site) {
      applyBlocklistMutation(
        set,
        get,
        dependencies,
        { type: 'BLOCKLIST_ADD_SITE', payload: { site } },
        (current) => addBlocklistSite(current, site),
      );
    },
    removeSite(site) {
      applyBlocklistMutation(
        set,
        get,
        dependencies,
        { type: 'BLOCKLIST_REMOVE_SITE', payload: { site } },
        (current) => removeBlocklistSite(current, site),
      );
    },
    createTag(label) {
      const trimmed = label.trim();
      const current = get().blocklist;
      // Reject blank and case-insensitive duplicate labels with no write and no
      // mutation: the label is the tag's user-facing identity (M3.T2).
      if (trimmed.length === 0 || hasTagLabel(current.customTags, trimmed))
        return;

      const now = dependencies.now ?? Date.now;
      const random = dependencies.random ?? Math.random;
      const tag: Tag = { id: generateTagId(now(), random()), label: trimmed };
      set({ blocklist: upsertTag(current, tag) });
      dependencies.sendMutation?.({ type: 'TAG_UPSERT', payload: tag });
    },
    deleteTag(tagId) {
      const current = get().blocklist;
      if (!current.customTags.some((tag) => tag.id === tagId)) return;
      set({ blocklist: removeTag(current, tagId) });
      dependencies.sendMutation?.({ type: 'TAG_REMOVE', payload: { tagId } });
    },
    assignTag(site, tagId) {
      applyBlocklistMutation(
        set,
        get,
        dependencies,
        {
          type: 'TAG_ASSIGN',
          payload: { site, tagId },
        },
        (current) => assignTagToSite(current, site, tagId),
      );
    },
    unassignTag(site, tagId) {
      applyBlocklistMutation(
        set,
        get,
        dependencies,
        {
          type: 'TAG_UNASSIGN',
          payload: { site, tagId },
        },
        (current) => unassignTagFromSite(current, site, tagId),
      );
    },
  });

/**
 * Shared optimistic-update plumbing for the blocklist mutations (M3.T2):
 * apply the pure transformation, `set` only when something actually changed
 * (identity check, the same no-op discipline as M1.T10/M3.T1) and forward the
 * mutation to the background only in that case.
 */
function applyBlocklistMutation(
  set: (partial: { blocklist: BlocklistState }) => void,
  get: () => AppState,
  dependencies: BlocklistDependencies,
  message: MutationMessage,
  transform: (state: BlocklistState) => BlocklistState,
): void {
  const current = get().blocklist;
  const next = transform(current);
  if (next === current) return;
  set({ blocklist: next });
  dependencies.sendMutation?.(message);
}

// --- Pure mutation helpers (M1.T10, normalization M2.T4) -------------------
// The background is the single writer (M1.T9); the popup only *requests* a
// change. These helpers are pure and side-effect-free so they can run on the
// background side and be unit-tested without a store or a browser.
//
// User input is untrusted (M2.T4): every site goes through `normalizeEntry`
// (M2.T21, the single entry/navigation canonicalizer) before it is stored, so
// only the canonical registrable form (`eTLD+1`, subdomains removed — the M1.T2
// design decision) ever reaches the state. A malformed URL or a "bare" public
// suffix (`co.uk`, `com`, `github.io`) is rejected: the helper returns the *same*
// state reference, which the background uses to skip persisting and the UI to
// show "Enter a valid URL" (M2.T21/M3.T3).
//
// The DNR side-effect is owned by M2.T7.

const toEntry = (domain: string): BlocklistEntry => ({
  domain: { value: domain },
  tagIds: [],
});

const hasSite = (
  entries: ReadonlyArray<BlocklistEntry>,
  domain: string,
): boolean => entries.some((entry) => entry.domain.value === domain);

/**
 * Add a site to the blocklist (M2.T4), comparing on the already-normalized
 * domain so `https://m.` and `www.` variants of the same registrable domain
 * collapse onto one entry. A duplicate, like an invalid site, is a no-op that
 * returns the same reference (M1.T10).
 */
export function addBlocklistSite(
  state: BlocklistState,
  site: string,
): BlocklistState {
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  if (hasSite(state.blocklist, domain)) return state;
  return { ...state, blocklist: [...state.blocklist, toEntry(domain)] };
}

/**
 * Expand a whole preset (M2.T5) into the blocklist in one pass (M3.T1).
 *
 * Each domain goes through `addBlocklistSite`, so normalization (M2.T4) and
 * dedup are reused rather than reimplemented — applying two presets with an
 * overlapping domain yields a single entry, never a duplicate. The preset's
 * `tag` is attached to every domain it contributes (the purpose M2.T5 gave that
 * field), so a preset's sites can later be filtered like any other tagged entry
 * (M3.T2).
 *
 * Returns the *same* reference when nothing changes (an unknown/empty preset or
 * an already-applied one), so callers can skip a write/re-render.
 */
export function addPresetToBlocklist(
  state: BlocklistState,
  preset: Preset,
): BlocklistState {
  let next = state;
  for (const domain of preset.domains) {
    next = addBlocklistSite(next, domain.value);
  }
  return attachPresetTag(next, preset);
}

function attachPresetTag(
  state: BlocklistState,
  preset: Preset,
): BlocklistState {
  const values = new Set(preset.domains.map((domain) => domain.value));
  const entries = state.blocklist.map((entry) => {
    if (!values.has(entry.domain.value) || entry.tagIds.includes(preset.tag.id))
      return entry;
    return { ...entry, tagIds: [...entry.tagIds, preset.tag.id] };
  });
  const changed = entries.some(
    (entry, index) => entry !== state.blocklist[index],
  );
  return changed ? { ...state, blocklist: entries } : state;
}

export function removeBlocklistSite(
  state: BlocklistState,
  site: string,
): BlocklistState {
  // Normalize on removal too, so a full URL (`https://m.facebook.com/x`) removes
  // the canonical `facebook.com` entry instead of silently matching nothing.
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const next = state.blocklist.filter((entry) => entry.domain.value !== domain);
  // Same reference when nothing matched, so a removal of an absent site skips
  // the write/mutation (identity pattern of M1.T10/M2.T20) instead of persisting
  // a new-but-equal state.
  return next.length === state.blocklist.length
    ? state
    : { ...state, blocklist: next };
}

export function upsertTag(state: BlocklistState, tag: Tag): BlocklistState {
  const existing = state.customTags.some(
    (candidate) => candidate.id === tag.id,
  );
  const customTags = existing
    ? state.customTags.map((candidate) =>
        candidate.id === tag.id ? tag : candidate,
      )
    : [...state.customTags, tag];
  return { ...state, customTags };
}

export function removeTag(
  state: BlocklistState,
  tagId: string,
): BlocklistState {
  return {
    ...state,
    customTags: state.customTags.filter((tag) => tag.id !== tagId),
    // Detach the tag from every site so no entry keeps a dangling reference.
    blocklist: state.blocklist.map((entry) => withoutTag(entry, tagId)),
  };
}

function withoutTag(entry: BlocklistEntry, tagId: string): BlocklistEntry {
  return { ...entry, tagIds: entry.tagIds.filter((id) => id !== tagId) };
}

/**
 * Mint a tag id from the injected clock and entropy (M3.T2). Kept in the store
 * layer, never in the component, so the UI remains presentational (coupling
 * rule §1.3) and tags stay deterministic under an injected seed in tests.
 */
export function generateTagId(now: number, random: number): string {
  return `tag-${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

/**
 * Whether a tag with the same label already exists, compared
 * **case-insensitively** on trimmed labels (M3.T2): "Focus" and "focus" are the
 * same category to a user, so the editor must not create a second one.
 */
export function hasTagLabel(tags: ReadonlyArray<Tag>, label: string): boolean {
  const target = label.trim().toLowerCase();
  return (
    target.length > 0 &&
    tags.some((tag) => tag.label.trim().toLowerCase() === target)
  );
}

/**
 * Attach a tag to a single site (M3.T2). The site is normalized with the shared
 * `normalizeEntry` (M2.T4/M2.T21), so a full URL and a canonical domain address
 * the same entry. Returns the *same* reference when the site is invalid, absent,
 * or already carries the tag — the caller then skips the write/mutation.
 */
export function assignTagToSite(
  state: BlocklistState,
  site: string,
  tagId: string,
): BlocklistState {
  if (tagId.length === 0) return state;
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const entries = state.blocklist.map((entry) =>
    entry.domain.value === domain && !entry.tagIds.includes(tagId)
      ? { ...entry, tagIds: [...entry.tagIds, tagId] }
      : entry,
  );
  const changed = entries.some(
    (entry, index) => entry !== state.blocklist[index],
  );
  return changed ? { ...state, blocklist: entries } : state;
}

/**
 * Detach a tag from a single site (M3.T2). Symmetric to `assignTagToSite`:
 * normalizes the site and returns the same reference when nothing changes.
 */
export function unassignTagFromSite(
  state: BlocklistState,
  site: string,
  tagId: string,
): BlocklistState {
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const entries = state.blocklist.map((entry) =>
    entry.domain.value === domain && entry.tagIds.includes(tagId)
      ? withoutTag(entry, tagId)
      : entry,
  );
  const changed = entries.some(
    (entry, index) => entry !== state.blocklist[index],
  );
  return changed ? { ...state, blocklist: entries } : state;
}

/**
 * The "custom preset" view of a tag (M3.T2): the sites that carry it. Pure, so
 * the filter can be asserted without mounting the component.
 */
export function filterEntriesByTag(
  entries: ReadonlyArray<BlocklistEntry>,
  tagId: string,
): ReadonlyArray<BlocklistEntry> {
  return entries.filter((entry) => entry.tagIds.includes(tagId));
}

export const selectBlocklist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.blocklist;

export const selectCustomTags = (state: BlocklistSlice): ReadonlyArray<Tag> =>
  state.blocklist.customTags;
