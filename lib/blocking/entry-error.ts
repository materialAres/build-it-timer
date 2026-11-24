import { parse } from 'tldts';

/** Why a typed entry cannot be blocked, so the UI can say something useful. */
export type EntryError =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ip' }
  | { readonly kind: 'suffix'; readonly subject: string }
  | { readonly kind: 'invalid' };

/**
 * Classify an entry `normalizeEntry` rejected (UI.T6). The rule itself stays in
 * `normalizeEntry`/`getRegistrableDomain`; this only reads the same parser's
 * answer to tell *why*: nothing typed, an IP address, a bare public suffix
 * (`com`, `co.uk`, `github.io`, named back to the user) or anything else.
 * Pure and total at the untrusted boundary (§1.4): never throws.
 */
export function classifyEntryError(input: string): EntryError {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { kind: 'empty' };
  }
  const parsed = parse(input, { allowPrivateDomains: true });
  if (parsed.isIp === true) return { kind: 'ip' };
  const { hostname, domain, publicSuffix } = parsed;
  const isKnownSuffix = parsed.isIcann === true || parsed.isPrivate === true;
  if (hostname !== null && domain === null && isKnownSuffix && publicSuffix === hostname) {
    return { kind: 'suffix', subject: hostname };
  }
  return { kind: 'invalid' };
}
