import type { BlocklistEntry } from '@/store/store.types';

/** The two lists as a context needs them to decide whether a domain is blocked. */
export interface BlockDecisionInput {
  readonly allowlist: ReadonlyArray<BlocklistEntry>;
  readonly blocklist: ReadonlyArray<BlocklistEntry>;
}

/**
 * Whether `domain` (already canonical, M1.T2) must be gated for the user.
 *
 * Precedence is the same first-class rule as in the DNR generator (M2.T6): the
 * **allowlist always wins**. Both the rule generator and the overlay therefore
 * answer this question identically, so a domain can never be blocked by DNR but
 * allowed by the overlay (or the other way around).
 *
 * Pure: the caller owns where the lists come from and whether a session is
 * running at all — this function only answers the membership question.
 */
export function isDomainBlocked(input: BlockDecisionInput, domain: string): boolean {
  const isAllowed = input.allowlist.some((entry) => entry.domain.value === domain);
  if (isAllowed) return false;

  return input.blocklist.some((entry) => entry.domain.value === domain);
}
