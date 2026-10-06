import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BUILDING_PALETTE,
  getBuildingColor,
} from '@/lib/city/palette';

describe('building palette (M2.T13)', () => {
  it('returns a color from the default blue/orange/green/yellow palette', () => {
    expect(DEFAULT_BUILDING_PALETTE).toHaveLength(4);

    for (const domain of ['facebook.com', 'youtube.com', 'reddit.com']) {
      expect(DEFAULT_BUILDING_PALETTE).toContain(getBuildingColor(domain));
    }
  });

  it('always returns the same color for the same domain (repeated calls)', () => {
    const first = getBuildingColor('facebook.com');

    for (let repetition = 0; repetition < 50; repetition += 1) {
      expect(getBuildingColor('facebook.com')).toBe(first);
    }
  });

  it('normalizes URLs and subdomains to the registrable domain (M1.T2)', () => {
    const canonical = getBuildingColor('facebook.com');

    expect(getBuildingColor('m.facebook.com')).toBe(canonical);
    expect(getBuildingColor('www.facebook.com')).toBe(canonical);
    expect(getBuildingColor('https://www.facebook.com/profile')).toBe(canonical);
    expect(getBuildingColor('http://m.facebook.com/foo?bar=1')).toBe(canonical);
  });

  it('is deterministic and case-insensitive for Unicode (IDN) domains', () => {
    const upper = getBuildingColor('ESPAÑA.com');
    const lower = getBuildingColor('españa.com');

    expect(lower).toBe(upper);
    expect(DEFAULT_BUILDING_PALETTE).toContain(upper);
    // A punycode spelling of the same host is parsed as its own domain and
    // must still be deterministic, never thrown on.
    expect(getBuildingColor('xn--espaa-rta.com')).toBe(
      getBuildingColor('xn--espaa-rta.com'),
    );
  });

  it('handles empty and malformed input without throwing, deterministically', () => {
    for (const input of ['', '   ', 'not a domain', 'co.uk', 'https://']) {
      const color = getBuildingColor(input);
      expect(DEFAULT_BUILDING_PALETTE).toContain(color);
      expect(getBuildingColor(input)).toBe(color);
    }
  });

  it('accepts a custom palette as a parameter (generic hash → color)', () => {
    const palette = ['#000000', '#ffffff', '#123456'];

    for (const domain of ['a.com', 'b.com', 'c.com', 'd.com']) {
      expect(palette).toContain(getBuildingColor(domain, palette));
    }

    // The custom palette is honored: the result depends only on hash % length.
    expect(getBuildingColor('facebook.com', palette)).toBe(
      getBuildingColor('facebook.com', palette),
    );
  });

  it('falls back to a defined color for a degenerate empty palette', () => {
    expect(getBuildingColor('facebook.com', [])).toBe(
      DEFAULT_BUILDING_PALETTE[0],
    );
  });

  it('distributes sample domains reasonably uniformly (no gross bias)', () => {
    const sampleSize = 400;
    const counts = new Map<string, number>();
    for (let index = 0; index < sampleSize; index += 1) {
      const color = getBuildingColor(`sample-site-${String(index)}.com`);
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }

    // Every color is used at least once…
    expect(counts.size).toBe(DEFAULT_BUILDING_PALETTE.length);
    // …and no single color takes the majority (gross-bias guard). A perfect
    // split would be 25% each; allow generous headroom for the tiny sample.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(sampleSize * 0.1);
      expect(count).toBeLessThan(sampleSize * 0.5);
    }
  });
});
