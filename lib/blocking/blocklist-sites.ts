import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import type { BlocklistState } from '@/store/store.types';

// Pure site mutations (M1.T10, normalization M2.T4). The background is the single
// writer (M1.T9); the popup only *requests* a change, so these helpers are
// side-effect-free and run on both sides.
//
// User input is untrusted (M2.T4): every site goes through `normalizeEntry`
// (M2.T21, the single entry/navigation canonicalizer), so only the canonical
// registrable form (`eTLD+1`, subdomains removed — the M1.T2 decision) is ever
// stored. A malformed URL or a bare public suffix (`co.uk`, `github.io`) is
// rejected by returning the *same* state reference, which the background uses to
// skip persisting and the UI to show "Enter a valid URL".

/**
 * Add a site typed by the user (M2.T4). A new domain becomes a manual entry. A
 * domain already listed only because a preset contributed it gains the `manual`
 * source (CR4.T1 §3.4), so switching that preset off keeps the site. A duplicate
 * manual add, like an invalid site, returns the same reference (M1.T10).
 */
export function addBlocklistSite(
  state: BlocklistState,
  site: string,
): BlocklistState {
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const existing = state.blocklist.find(
    (entry) => entry.domain.value === domain,
  );
  if (existing === undefined) {
    return {
      ...state,
      blocklist: [
        ...state.blocklist,
        { domain: { value: domain }, manual: true, presetIds: [] },
      ],
    };
  }
  if (existing.manual) return state;
  return {
    ...state,
    blocklist: state.blocklist.map((entry) =>
      entry === existing ? { ...entry, manual: true } : entry,
    ),
  };
}

/**
 * Remove a site whatever its sources (CR4.T1 §3.4); the presets that
 * contributed it stay applied but no longer cover that domain. The site is
 * normalized too, so a full URL removes the canonical entry instead of silently
 * matching nothing. Same reference when nothing matched (identity pattern of
 * M1.T10/M2.T20).
 */
export function removeBlocklistSite(
  state: BlocklistState,
  site: string,
): BlocklistState {
  const normalized = normalizeEntry(site);
  if (!normalized.ok) return state;

  const domain = normalized.value;
  const next = state.blocklist.filter((entry) => entry.domain.value !== domain);
  return next.length === state.blocklist.length
    ? state
    : { ...state, blocklist: next };
}
