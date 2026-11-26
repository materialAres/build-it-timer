import { parse } from 'tldts';
import type { Result } from '@/utils/result';
import { ok, err } from '@/utils/result';

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

// No hostname contains a control character, so they only reach us in hostile
// or mangled input. WHATWG would silently drop tabs and newlines
// (`java\tscript:` becomes `javascript:`); rejecting them keeps the outcome
// independent of that cleanup.
const CONTROL_CHARACTERS = /\p{Cc}/u;

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// `facebook.com:8080` is syntactically a URL whose scheme is `facebook.com`:
// a bare port after the colon is what tells a scheme-less host apart.
const HOST_WITH_PORT = /^[^:/?#]+:\d+(?:[/?#]|$)/;

// The only form a canonical domain takes (M6.T2): ASCII letters, digits,
// hyphens and dots, which is also what a DNR `urlFilter` may safely hold.
const CANONICAL_DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/**
 * Parses untrusted input with the browser's own URL parser, so the host is
 * read exactly as a navigation would read it: userinfo dropped, `\` treated as
 * `/`, case folded and IDN converted to punycode. Scheme-less input is read
 * as `http`; any explicit scheme other than `http`/`https` is rejected.
 */
function parseWebUrl(input: string): Result<URL> {
  if (CONTROL_CHARACTERS.test(input)) {
    return err(new Error('URL contains control characters'));
  }
  const hasScheme = EXPLICIT_SCHEME.test(input) && !HOST_WITH_PORT.test(input);
  let url: URL;
  try {
    url = new URL(hasScheme ? input : `http://${input}`);
  } catch (error: unknown) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return err(new Error(`Unsupported URL scheme "${url.protocol}"`));
  }
  return ok(url);
}

/**
 * Extracts the registrable domain (eTLD+1) from a URL, normalizing
 * subdomains away (e.g. m.facebook.com → facebook.com).
 * Returns a Result<string> so callers handle malformed input explicitly.
 *
 * The result is always canonical (M6.T2): lowercase ASCII, punycode for IDN
 * hosts, no trailing dot. A homograph such as Cyrillic `раypal.com` therefore
 * becomes `xn--ypal-43d9g.com` and can never collide with `paypal.com`.
 */
export function getRegistrableDomain(url: string): Result<string> {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return err(new Error('URL must be a non-empty string'));
  }

  const parsedUrl = parseWebUrl(url.trim());
  if (!parsedUrl.ok) return parsedUrl;

  // `facebook.com.` is the fully qualified spelling of `facebook.com`; a
  // second trailing dot is an empty label and stays invalid.
  const host = parsedUrl.value.hostname.replace(/\.$/, '');
  if (host.split('.').includes('')) {
    return err(new Error(`URL host has an empty label: "${url}"`));
  }

  // `allowPrivateDomains` makes tldts honour the PSL *private* section, so a
  // bare private suffix (`github.io`, `blogspot.com`) is treated like any other
  // public suffix and rejected as not registrable (M2.T21; the M1.T2 card
  // already listed `github.io` among the invalid inputs).
  const parsed = parse(host, { allowPrivateDomains: true });
  const domain = parsed.domain;

  if (!domain || !parsed.publicSuffix || !CANONICAL_DOMAIN.test(domain)) {
    return err(new Error(`Could not extract registrable domain from "${url}"`));
  }

  return ok(domain);
}
