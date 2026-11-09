import type { BlocklistEntry } from '@/store/store.types';

/**
 * What enforcement reads of an entry: the domain only (CR4). Sources
 * (`manual`, `presetIds`) are presentation and never change what is blocked.
 */
export type BlockedEntry = Pick<BlocklistEntry, 'domain'>;

/** The blocklist as a context needs it to decide whether a domain is blocked. */
export interface BlockDecisionInput {
  readonly blocklist: ReadonlyArray<BlockedEntry>;
}

/**
 * Whether `domain` (already canonical, M1.T2) must be gated for the user.
 *
 * The answer depends on the blocklist alone (CR1.T4): everything else is
 * allowed by default, and there is no second list that could override an entry.
 * The DNR generator and the overlay both answer this question identically, so a
 * domain can never be blocked by one layer and allowed by the other.
 *
 * Pure: the caller owns where the list comes from and whether a session is
 * running at all — this function only answers the membership question.
 */
export function isDomainBlocked(input: BlockDecisionInput, domain: string): boolean {
  return input.blocklist.some((entry) => entry.domain.value === domain);
}
