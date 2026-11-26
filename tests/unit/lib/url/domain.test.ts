import { describe, it, expect } from 'vitest';
import { getRegistrableDomain, isCanonicalDomain } from '@/lib/url/domain';

describe('getRegistrableDomain', () => {
  describe('valid URLs', () => {
    it('normalizes subdomains to the registrable domain', () => {
      expect(getRegistrableDomain('https://m.facebook.com/foo')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
      expect(getRegistrableDomain('https://www.facebook.com')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
      expect(getRegistrableDomain('https://facebook.com')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
    });

    it('handles http protocol', () => {
      expect(getRegistrableDomain('http://m.facebook.com/bar')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
    });

    it('handles URLs without protocol (domain only)', () => {
      expect(getRegistrableDomain('m.facebook.com')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
    });

    it('handles URLs with ports', () => {
      expect(getRegistrableDomain('https://m.facebook.com:443/foo')).toEqual({
        ok: true,
        value: 'facebook.com',
      });
    });

    it('handles ccSLD domains correctly', () => {
      const result = getRegistrableDomain('https://www.facebook.co.uk');
      expect(result).toEqual({ ok: true, value: 'facebook.co.uk' });
    });

    it('handles complex subdomains', () => {
      expect(getRegistrableDomain('https://a.b.c.example.com')).toEqual({
        ok: true,
        value: 'example.com',
      });
    });

    it('returns the same result for the same registrable domain', () => {
      const urls = [
        'https://m.facebook.com',
        'https://www.facebook.com',
        'https://facebook.com',
        'http://login.facebook.com/',
      ];
      const results = urls.map(getRegistrableDomain);
      expect(results.every((r) => r.ok)).toBe(true);
      const values = results.map((r) => (r.ok ? r.value : null));
      expect(new Set(values).size).toBe(1);
      expect(values[0]).toBe('facebook.com');
    });
  });

  describe('invalid URLs', () => {
    it('returns a failure for empty string', () => {
      const result = getRegistrableDomain('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('non-empty');
      }
    });

    it('returns a failure for whitespace-only string', () => {
      const result = getRegistrableDomain('   ');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('returns a failure for malformed URL', () => {
      const result = getRegistrableDomain('not a url');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('returns a failure for URL without a registrable domain (IP address)', () => {
      const result = getRegistrableDomain('https://192.168.1.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('returns a failure for a "bare" public suffix, including private ones', () => {
      for (const input of ['co.uk', 'com', 'github.io']) {
        expect(getRegistrableDomain(input).ok).toBe(false);
      }
    });
  });

  describe('hostile corpus (M6.T2)', () => {
    const CANONICAL = /^[a-z0-9.-]+$/;

    it.each([
      'ftp://facebook.com',
      'FTP://FACEBOOK.COM',
      'file:///etc/passwd',
      'file://facebook.com/x',
      'javascript:alert(1)',
      'javascript://facebook.com/%0aalert(1)',
      ' javascript:alert(1)',
      'data:text/html,facebook.com',
      'chrome://facebook.com',
      'chrome-extension://abcdef/facebook.com',
      'mailto:someone@facebook.com',
      'about:blank',
      'blob:https://facebook.com/x',
      'view-source:https://facebook.com',
      'ws://facebook.com',
    ])('rejects the non-http(s) scheme of %j', (input) => {
      expect(getRegistrableDomain(input).ok).toBe(false);
    });

    it.each([
      ['HTTPS://Facebook.com', 'facebook.com'],
      ['http://m.facebook.com', 'facebook.com'],
      ['facebook.com', 'facebook.com'],
      ['facebook.com:8080', 'facebook.com'],
      ['facebook.com:8080/path', 'facebook.com'],
      ['m.facebook.com/path?q=1#top', 'facebook.com'],
    ])('accepts http(s) and scheme-less %j', (input, expected) => {
      expect(getRegistrableDomain(input)).toEqual({ ok: true, value: expected });
    });

    it.each([
      ['facebook.com.', 'facebook.com'],
      ['FACEBOOK.COM', 'facebook.com'],
      ['https://WWW.FaceBook.COM./x', 'facebook.com'],
    ])('canonicalizes the trailing dot and case of %j', (input, expected) => {
      expect(getRegistrableDomain(input)).toEqual({ ok: true, value: expected });
    });

    it.each([
      ['https://facebook.com@evil.com', 'evil.com'],
      ['https://facebook.com:443@evil.com/x', 'evil.com'],
      ['https://user:password@facebook.com', 'facebook.com'],
      // WHATWG treats `\` as `/` in http(s): the host ends before it.
      ['https://evil.com\\@facebook.com', 'evil.com'],
    ])('reads the real host of %j, never the userinfo', (input, expected) => {
      expect(getRegistrableDomain(input)).toEqual({ ok: true, value: expected });
    });

    it.each([
      ['münchen.de', 'xn--mnchen-3ya.de'],
      ['https://www.münchen.de/x', 'xn--mnchen-3ya.de'],
      ['https://xn--mnchen-3ya.de', 'xn--mnchen-3ya.de'],
      ['яндекс.рф', 'xn--d1acpjx3f.xn--p1ai'],
      ['例え.jp', 'xn--r8jz45g.jp'],
      // Full-width letters and the ideographic full stop map to ASCII, as
      // they do in the browser's address bar.
      ['ｆacebook.com', 'facebook.com'],
      ['facebook。com', 'facebook.com'],
    ])('converts the IDN host %j to punycode', (input, expected) => {
      expect(getRegistrableDomain(input)).toEqual({ ok: true, value: expected });
    });

    it('keeps a homograph apart from the Latin domain it imitates', () => {
      // `р` and `а` below are Cyrillic.
      const homograph = getRegistrableDomain('https://раypal.com');
      expect(homograph).toEqual({ ok: true, value: 'xn--ypal-43d9g.com' });
      expect(homograph).not.toEqual(getRegistrableDomain('https://paypal.com'));
    });

    it.each([
      'facebook.com..',
      'https://',
      'http://',
      'https://face book.com',
      'https://facebook.com%40evil.com',
      '*.facebook.com',
      'face*book.com',
      '||facebook.com^',
      'facebook.com|',
      'https://[::1]',
      'http://0x7f.1',
      'localhost:3000',
      'java\tscript:alert(1)',
      'face\nbook.com',
      'https://face\tbook.com',
      'facebook.com\u0000',
    ])('rejects the malformed input %j', (input) => {
      expect(getRegistrableDomain(input).ok).toBe(false);
    });

    it('rejects a non-string input instead of throwing', () => {
      for (const input of [null, undefined, 42, {}] as unknown as string[]) {
        expect(getRegistrableDomain(input).ok).toBe(false);
      }
    });

    it('never throws, is deterministic and only yields [a-z0-9.-]', () => {
      const corpus = [
        'https://раypal.com',
        'münchen.de',
        'https://facebook.com@evil.com',
        'javascript:alert(1)',
        'facebook.com.',
        '%',
        '://',
        'http://%zz',
        `${'a'.repeat(100_000)}.com`,
        'https://' + 'sub.'.repeat(1_000) + 'example.com',
      ];

      for (const input of corpus) {
        const first = getRegistrableDomain(input);
        expect(getRegistrableDomain(input)).toEqual(first);
        if (first.ok) expect(first.value).toMatch(CANONICAL);
      }
    });
  });

  describe('isCanonicalDomain (M6.T3)', () => {
    it.each(['facebook.com', 'a-b.co.uk', 'xn--mnchen-3ya.de', 'a1.b2.example.com'])(
      'accepts %j',
      (value) => {
        expect(isCanonicalDomain(value)).toBe(true);
      },
    );

    it.each([
      '',
      'com',
      'Facebook.com',
      '*.facebook.com',
      'face*book.com',
      '||facebook.com^',
      'facebook.com|',
      'facebook.com^',
      'facebook.com/',
      'facebook.com.',
      '.facebook.com',
      'facebook..com',
      'münchen.de',
      'face book.com',
      'facebook.com\n',
    ])('rejects %j', (value) => {
      expect(isCanonicalDomain(value)).toBe(false);
    });
  });
});
