import { describe, it, expect } from 'vitest';
import { PRESETS, getPresetById } from '@/lib/blocking/presets';
import { getRegistrableDomain } from '@/lib/url/domain';

describe('presets data (M2.T5)', () => {
  it('exposes at least the Social preset with the expected domains', () => {
    const social = getPresetById('social');

    expect(social).toBeDefined();
    const domains = social?.domains.map((domain) => domain.value) ?? [];
    expect(domains).toEqual(
      expect.arrayContaining(['instagram.com', 'facebook.com', 'x.com', 'tiktok.com']),
    );
  });

  it('includes a Video preset', () => {
    expect(getPresetById('video')).toBeDefined();
  });

  it('returns undefined for an unknown preset id', () => {
    expect(getPresetById('does-not-exist')).toBeUndefined();
  });

  it('gives every preset a non-empty id, name and tag', () => {
    for (const preset of PRESETS) {
      expect(preset.id.length).toBeGreaterThan(0);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.tag.id.length).toBeGreaterThan(0);
      expect(preset.tag.label.length).toBeGreaterThan(0);
    }
  });

  it('gives every preset at least one domain', () => {
    for (const preset of PRESETS) {
      expect(preset.domains.length).toBeGreaterThan(0);
    }
  });

  it('uses unique preset ids', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stores every domain already in canonical registrable form', () => {
    for (const preset of PRESETS) {
      for (const domain of preset.domains) {
        const normalized = getRegistrableDomain(domain.value);
        expect(normalized.ok).toBe(true);
        if (normalized.ok) expect(normalized.value).toBe(domain.value);
      }
    }
  });

  it('has no duplicate domain within a single preset', () => {
    for (const preset of PRESETS) {
      const values = preset.domains.map((domain) => domain.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
