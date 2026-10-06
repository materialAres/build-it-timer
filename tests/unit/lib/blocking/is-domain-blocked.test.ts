import { describe, it, expect } from 'vitest';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

describe('isDomainBlocked (M2.T8)', () => {
  it('blocks a domain present in the blocklist', () => {
    expect(isDomainBlocked({ allowlist: [], blocklist: [entry('facebook.com')] }, 'facebook.com')).toBe(
      true,
    );
  });

  it('does not block a domain absent from the blocklist', () => {
    expect(isDomainBlocked({ allowlist: [], blocklist: [entry('facebook.com')] }, 'x.com')).toBe(
      false,
    );
  });

  it('does not block an empty blocklist', () => {
    expect(isDomainBlocked({ allowlist: [], blocklist: [] }, 'facebook.com')).toBe(false);
  });

  it('lets the allowlist win over the blocklist (same precedence as M2.T6)', () => {
    const both = { allowlist: [entry('facebook.com')], blocklist: [entry('facebook.com')] };

    expect(isDomainBlocked(both, 'facebook.com')).toBe(false);
  });

  it('still blocks the domains that are only blocklisted when one is allowlisted', () => {
    const input = {
      allowlist: [entry('facebook.com')],
      blocklist: [entry('facebook.com'), entry('instagram.com')],
    };

    expect(isDomainBlocked(input, 'instagram.com')).toBe(true);
  });

  it('matches the canonical form only (subdomains are normalized upstream, M1.T2)', () => {
    expect(isDomainBlocked({ allowlist: [], blocklist: [entry('facebook.com')] }, 'm.facebook.com')).toBe(
      false,
    );
  });
});
