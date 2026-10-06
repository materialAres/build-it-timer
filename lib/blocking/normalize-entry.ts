import { getRegistrableDomain } from '@/lib/url/domain';
import type { Result } from '@/utils/result';
import { err } from '@/utils/result';

/**
 * The single user-facing rejection message for an input that cannot be turned
 * into a canonical registrable domain (M2.T4/M2.T21). Exported so the entry
 * validator and the UI (M3.T3) can never disagree on the wording.
 */
export const INVALID_URL_MESSAGE = 'Enter a valid URL';

/**
 * Canonicalizes any *untrusted* domain input to its single canonical registrable
 * form (`eTLD+1`, subdomains removed — the M1.T2 design decision), or rejects it.
 *
 * This is the one function shared by the two untrusted boundaries of the
 * blocking system (M2.T21):
 *  - **entry**: a hand-typed site or a preset domain before it is stored
 *    (`store/blocklist.slice.ts`, M2.T4);
 *  - **navigation check**: a tab URL arriving from the browser before it is
 *    matched against the lists (`entrypoints/background.ts`, M2.T6/M2.T8; the
 *    content-script overlay gate uses it too).
 *
 * Delegating to `getRegistrableDomain` (DRY, §1.1) guarantees the two points
 * always agree: the same input normalizes to the same domain whichever boundary
 * it crosses. An already-saved entry or a browser URL is therefore never trusted
 * as canonical.
 *
 * Pure and total at the untrusted boundary (§1.4): an invalid input — a "bare"
 * public suffix (`co.uk`, `com`, `github.io`), a malformed URL, an IP, an empty
 * string — yields `{ ok: false }` carrying {@link INVALID_URL_MESSAGE} instead of
 * throwing. A rejected *entry* is what the UI turns into "Enter a valid URL"; a
 * rejected *navigation* URL simply does not match any list (no crash, no block).
 */
export function normalizeEntry(input: string): Result<string> {
  const result = getRegistrableDomain(input);
  if (!result.ok) return err(new Error(INVALID_URL_MESSAGE));
  return result;
}
