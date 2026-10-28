import { describe, it, expect } from 'vitest';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

describe('isDomainBlocked (M2.T8, CR1.T4)', () => {
  it('blocks a domain present in the blocklist', () => {
    expect(isDomainBlocked({ blocklist: [entry('facebook.com')] }, 'facebook.com')).toBe(true);
  });

  it('does not block a domain absent from the blocklist', () => {
    expect(isDomainBlocked({ blocklist: [entry('facebook.com')] }, 'x.com')).toBe(false);
  });

  it('does not block an empty blocklist', () => {
    expect(isDomainBlocked({ blocklist: [] }, 'facebook.com')).toBe(false);
  });

  it('still blocks a blocked domain when one of the entries is another domain', () => {
    const input = { blocklist: [entry('facebook.com'), entry('instagram.com')] };

    expect(isDomainBlocked(input, 'instagram.com')).toBe(true);
  });

  it('ignores a residual allowlist field from a pre-migration state', () => {
    // The store may still carry the obsolete field until CR1.T5, but it must
    // never influence the decision anymore (CR1.T4).
    const legacy = {
      allowlist: [entry('facebook.com')],
      blocklist: [entry('facebook.com')],
    };

    expect(isDomainBlocked(legacy, 'facebook.com')).toBe(true);
  });

  it('matches the canonical form only (subdomains are normalized upstream, M1.T2)', () => {
    expect(isDomainBlocked({ blocklist: [entry('facebook.com')] }, 'm.facebook.com')).toBe(false);
  });
});
