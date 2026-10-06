import { parse } from 'tldts';
import type { Result } from '@/utils/result';
import { ok, err } from '@/utils/result';

/**
 * Extracts the registrable domain (eTLD+1) from a URL, normalizing
 * subdomains away (e.g. m.facebook.com → facebook.com).
 * Returns a Result<string> so callers handle malformed input explicitly.
 */
export function getRegistrableDomain(url: string): Result<string> {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return err(new Error('URL must be a non-empty string'));
  }

  // `allowPrivateDomains` makes tldts honour the PSL *private* section, so a
  // bare private suffix (`github.io`, `blogspot.com`) is treated like any other
  // public suffix and rejected as not registrable (M2.T21; the M1.T2 card
  // already listed `github.io` among the invalid inputs).
  const parsed = parse(url, { allowPrivateDomains: true });
  const domain = parsed.domain;

  if (!domain || !parsed.publicSuffix) {
    return err(new Error(`Could not extract registrable domain from "${url}"`));
  }

  // getDomain returns the registrable domain (eTLD+1) directly.
  return ok(domain);
}
