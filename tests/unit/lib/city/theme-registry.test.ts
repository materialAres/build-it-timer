import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  getThemeById,
  selectThemeId,
} from '@/lib/city/theme-registry';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe('theme registry (M2.T13b)', () => {
  it('provides at least two biomes with unique ids', () => {
    expect(THEME_REGISTRY.length).toBeGreaterThanOrEqual(2);

    const ids = THEME_REGISTRY.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares a complete, renderable Theme for every biome', () => {
    for (const theme of THEME_REGISTRY) {
      expect(theme.id.length).toBeGreaterThan(0);
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.backgroundColor).toMatch(HEX_COLOR);
      expect(theme.palette.length).toBeGreaterThan(0);
      for (const color of theme.palette) expect(color).toMatch(HEX_COLOR);
    }
  });

  it('keeps the documented default id as a real registry member', () => {
    expect(getThemeById(DEFAULT_THEME_ID)).toBeDefined();
  });

  it('looks a theme up by id and returns undefined for an unknown id', () => {
    const first = THEME_REGISTRY[0];
    if (first === undefined) throw new Error('the registry must not be empty');

    expect(getThemeById(first.id)).toBe(first);

    expect(getThemeById('does-not-exist')).toBeUndefined();
  });

  it('selects the same theme for the same session id (determinism)', () => {
    const first = selectThemeId('1700000000000-abc123');

    for (let repetition = 0; repetition < 50; repetition += 1) {
      expect(selectThemeId('1700000000000-abc123')).toBe(first);
    }
  });

  it('always returns an id that exists in the registry', () => {
    const ids = new Set(THEME_REGISTRY.map((theme) => theme.id));

    for (const sessionId of ['', 'a', '1700000000000-xyz', '42-42', '🎉']) {
      expect(ids.has(selectThemeId(sessionId))).toBe(true);
    }
  });

  it('is total for an empty/whitespace session id (no throw)', () => {
    expect(() => selectThemeId('')).not.toThrow();
    expect(() => selectThemeId('   ')).not.toThrow();
  });

  it('spreads different sessions across more than one biome (no gross bias)', () => {
    const sessionIds = Array.from(
      { length: 60 },
      (_, index) => `17000000${String(index).padStart(5, '0')}-${String(index * 7)}`,
    );
    const chosen = new Set(sessionIds.map(selectThemeId));

    expect(chosen.size).toBeGreaterThan(1);
  });
});
