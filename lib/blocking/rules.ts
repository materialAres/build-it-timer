import type { Browser } from 'wxt/browser';
import type { BlocklistEntry } from '@/store/store.types';
import { normalizeEntry } from './normalize-entry';

/**
 * A single `declarativeNetRequest` rule. Aliased to the browser's own type so
 * the generated rules are structurally validated against the real API without
 * importing any runtime browser code (this module stays pure — M2.T6).
 */
export type DnrRule = Browser.declarativeNetRequest.Rule;

/**
 * Resource types a blocked domain intercepts: embedded frames only (M2.T8
 * revision). Sub-resources (scripts, images, xhr) are intentionally left alone
 * so a blocked page fails cleanly instead of half-loading.
 *
 * `main_frame` is deliberately **not** blocked: DNR resolves a top-level block
 * before the document exists, so the browser renders its own
 * `ERR_BLOCKED_BY_CLIENT` page — where no content script can run. The overlay
 * (M2.T8) could then never appear and "proceed anyway" would have nothing to
 * proceed to. Top-level navigation is therefore gated by the overlay, which
 * needs the page to load; DNR stays as a secondary layer against embedding.
 */
const BLOCKED_RESOURCE_TYPES: `${Browser.declarativeNetRequest.ResourceType}`[] = [
  'sub_frame',
];

/**
 * Canonicalizes a stored entry's domain before it reaches a rule (M2.T21). An
 * entry is *not* trusted just because it was saved: it may come from an older
 * persisted state, an import, or a hand-edited store. `normalizeEntry` is the
 * same function the entry path uses, so the two can never diverge; an entry that
 * is not a valid registrable domain is dropped (`null`) rather than interpolated.
 */
function toCanonicalDomain(entry: BlocklistEntry): string | null {
  const normalized = normalizeEntry(entry.domain.value);
  return normalized.ok ? normalized.value : null;
}

/**
 * Translates the allow/block state into valid DNR rules (M2.T6).
 *
 * Pure: no `browser.declarativeNetRequest` call, no I/O — the caller (M2.T7)
 * owns applying the result. Each stored domain is canonicalized defensively on
 * consumption (M2.T21); `urlFilter` escaping/validation is M5.T3's job.
 *
 * Precedence (design decision): the **allowlist always wins**. A domain present
 * in both lists is simply not blocked — its block rule is omitted rather than
 * cancelled by a higher-priority allow rule. This keeps the rule set minimal and
 * independent of DNR priority semantics while satisfying the same guarantee. The
 * comparison is on the canonicalized domains, so `www.`/`m.` variants of the
 * same registrable domain still collapse onto one another.
 */
export function buildDnrRules(
  blocklist: ReadonlyArray<BlocklistEntry>,
  allowlist: ReadonlyArray<BlocklistEntry>,
): DnrRule[] {
  const allowed = new Set(
    allowlist.map(toCanonicalDomain).filter((domain): domain is string => domain !== null),
  );
  const blocked = new Set(
    blocklist
      .map(toCanonicalDomain)
      .filter((domain): domain is string => domain !== null && !allowed.has(domain)),
  );

  return [...blocked].map((domain, index) => ({
    id: index + 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: BLOCKED_RESOURCE_TYPES,
    },
  }));
}
