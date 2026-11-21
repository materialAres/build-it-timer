import { i18n } from '#i18n';
import { useEffect, useRef, type RefObject } from 'react';
import { diffDomains, type DomainDiff } from '@/lib/blocking/diff-domains';
import { useExpiringState } from './use-expiring-state';

/** How long a new row stays highlighted. */
const HIGHLIGHT_MS = 1_600;
/** How long an announcement stays in the live region (so a repeat is heard). */
const ANNOUNCE_MS = 3_000;

function describeChange({ added, removed }: DomainDiff): string {
  const parts: string[] = [];
  if (added.length === 1) {
    parts.push(i18n.t('blocklist.added', [added[0] ?? '']));
  } else if (added.length > 1) {
    parts.push(i18n.t('blocklist.addedSites', [String(added.length)]));
  }
  if (removed.length === 1) {
    parts.push(i18n.t('blocklist.removed', [removed[0] ?? '']));
  } else if (removed.length > 1) {
    parts.push(i18n.t('blocklist.removedSites', [String(removed.length)]));
  }
  return parts.join(' ');
}

/**
 * Follow the blocklist's domains between renders (UI.T6): the rows that just
 * appeared (to highlight, the first one to scroll into view) and a sentence
 * describing the change for a live region. It works from the list alone, so a
 * preset toggle, a typed site, a removal and a sync from the background are all
 * covered. `formAdd` holds the one site the add form just submitted: that case
 * already has its own visible feedback and is not announced twice.
 */
export function useListChanges(
  domains: ReadonlyArray<string>,
  formAdd: RefObject<string | null>,
): { readonly added: ReadonlyArray<string>; readonly announcement: string } {
  const previous = useRef<ReadonlyArray<string> | null>(null);
  const [added, setAdded] = useExpiringState<ReadonlyArray<string>>(HIGHLIGHT_MS);
  const [announcement, setAnnouncement] = useExpiringState<string>(ANNOUNCE_MS);

  useEffect(() => {
    const before = previous.current;
    previous.current = domains;
    if (before === null) return;
    const diff = diffDomains(before, domains);
    if (diff.added.length === 0 && diff.removed.length === 0) return;
    if (diff.added.length > 0) setAdded(diff.added);
    const fromForm =
      diff.removed.length === 0 &&
      diff.added.length === 1 &&
      diff.added[0] === formAdd.current;
    formAdd.current = null;
    if (!fromForm) setAnnouncement(describeChange(diff));
  }, [domains, formAdd, setAdded, setAnnouncement]);

  return { added: added ?? [], announcement: announcement ?? '' };
}
