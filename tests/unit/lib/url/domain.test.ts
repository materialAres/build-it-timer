import { describe, it, expect } from 'vitest';
import { getRegistrableDomain } from '@/lib/url/domain';

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
  });
});
