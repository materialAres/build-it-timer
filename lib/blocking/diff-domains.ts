/** What changed between two renderings of the blocklist, by domain. */
export interface DomainDiff {
  readonly added: ReadonlyArray<string>;
  readonly removed: ReadonlyArray<string>;
}

/**
 * Domains that appeared in `next` and domains that left `before` (UI.T6), each
 * in list order. A reorder is not a change. Pure: the popup uses it to highlight
 * new rows and to announce "Added 4 sites" after a preset toggle without
 * knowing which action caused the change.
 */
export function diffDomains(
  before: ReadonlyArray<string>,
  next: ReadonlyArray<string>,
): DomainDiff {
  const had = new Set(before);
  const has = new Set(next);
  return {
    added: next.filter((domain) => !had.has(domain)),
    removed: before.filter((domain) => !has.has(domain)),
  };
}
