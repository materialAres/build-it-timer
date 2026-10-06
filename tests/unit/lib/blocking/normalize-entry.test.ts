import { describe, it, expect } from 'vitest';
import {
  INVALID_URL_MESSAGE,
  normalizeEntry,
} from '@/lib/blocking/normalize-entry';
import { getRegistrableDomain } from '@/lib/url/domain';
import { PRESETS } from '@/lib/blocking/presets';

describe('normalizeEntry (M2.T21)', () => {
  describe('canonical form', () => {
    it('removes subdomains and keeps the registrable domain', () => {
      for (const input of [
        'https://m.facebook.com/foo',
        'https://www.facebook.com',
        'https://facebook.com',
        'facebook.com',
        'http://login.facebook.com/',
        'https://m.facebook.com:443/foo',
      ]) {
        expect(normalizeEntry(input)).toEqual({ ok: true, value: 'facebook.com' });
      }
    });

    it('keeps ccSLD domains intact', () => {
      expect(normalizeEntry('https://www.facebook.co.uk')).toEqual({
        ok: true,
        value: 'facebook.co.uk',
      });
    });

    it('returns the same canonical form for repeated calls (deterministic)', () => {
      const first = normalizeEntry('https://a.b.c.example.com');
      for (let repetition = 0; repetition < 25; repetition += 1) {
        expect(normalizeEntry('https://a.b.c.example.com')).toEqual(first);
      }
      expect(first).toEqual({ ok: true, value: 'example.com' });
    });
  });

  describe('rejection with the user-facing message', () => {
    it('rejects bare public suffixes (including private ones)', () => {
      for (const input of ['co.uk', 'com', 'github.io']) {
        const result = normalizeEntry(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toBe(INVALID_URL_MESSAGE);
      }
    });

    it('rejects a malformed URL, an empty string and an IP', () => {
      for (const input of ['not a url', '', '   ', 'https://192.168.1.1']) {
        const result = normalizeEntry(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toBe(INVALID_URL_MESSAGE);
      }
    });

    it('exposes the exact UI wording ("Enter a valid URL")', () => {
      expect(INVALID_URL_MESSAGE).toBe('Enter a valid URL');
    });

    it('never throws on hostile input', () => {
      const hostile = [
        'https://facebook.com@evil.com',
        'https://foo*bar.com',
        'javascript:alert(1)',
        'data:text/html,<script>',
        'ftp://example.com',
        'facebook.com.',
      ];

      for (const input of hostile) {
        expect(() => normalizeEntry(input)).not.toThrow();
      }
    });
  });

  it('agrees with getRegistrableDomain (single normalization point, DRY)', () => {
    const corpus = [
      'https://m.facebook.com/x',
      'https://www.facebook.co.uk',
      'co.uk',
      'not a url',
      '',
      'https://192.168.1.1',
      'github.io',
    ];

    for (const input of corpus) {
      const direct = getRegistrableDomain(input);
      const wrapped = normalizeEntry(input);
      expect(wrapped.ok).toBe(direct.ok);
      if (direct.ok && wrapped.ok) expect(wrapped.value).toBe(direct.value);
    }
  });

  it('normalizes every preset domain to itself (preset input goes through the same path)', () => {
    for (const preset of PRESETS) {
      for (const domain of preset.domains) {
        expect(normalizeEntry(domain.value)).toEqual({ ok: true, value: domain.value });
      }
    }
  });
});
