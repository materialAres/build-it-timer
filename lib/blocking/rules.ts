import type { Browser } from 'wxt/browser';
import type { BlocklistEntry } from '@/store/store.types';

/**
 * A single `declarativeNetRequest` rule. Aliased to the browser's own type so
 * the generated rules are structurally validated against the real API without
 * importing any runtime browser code (this module stays pure — M2.T6).
 */
export type DnrRule = Browser.declarativeNetRequest.Rule;

/**
 * Resource types a blocked domain intercepts: the top-level navigation and
 * embedded frames. Sub-resources (scripts, images, xhr) are intentionally left
 * alone so a blocked page fails cleanly instead of half-loading.
 */
const BLOCKED_RESOURCE_TYPES: `${Browser.declarativeNetRequest.ResourceType}`[] = [
  'main_frame',
  'sub_frame',
];

/**
 * Translates the allow/block state into valid DNR rules (M2.T6).
 *
 * Pure: no `browser.declarativeNetRequest` call, no I/O — the caller (M2.T7)
 * owns applying the result. Entries are assumed to already be in canonical
 * registrable form (M2.T4); `urlFilter` escaping/validation is M5.T3's job.
 *
 * Precedence (design decision): the **allowlist always wins**. A domain present
 * in both lists is simply not blocked — its block rule is omitted rather than
 * cancelled by a higher-priority allow rule. This keeps the rule set minimal and
 * independent of DNR priority semantics while satisfying the same guarantee.
 */
export function buildDnrRules(
  blocklist: ReadonlyArray<BlocklistEntry>,
  allowlist: ReadonlyArray<BlocklistEntry>,
): DnrRule[] {
  const allowed = new Set(allowlist.map((entry) => entry.domain.value));
  const blocked = new Set(
    blocklist.map((entry) => entry.domain.value).filter((domain) => !allowed.has(domain)),
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
