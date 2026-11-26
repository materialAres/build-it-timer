import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_PREFERENCES,
  applySoundPreferencesPatch,
  isSoundAudible,
  sanitizeSoundPreferences,
  type SoundPreferences,
} from '@/lib/sound/sound-preferences';

const CURRENT: SoundPreferences = Object.freeze({
  enabled: true,
  themeId: 'synthwave',
  volume: 30,
});

describe('DEFAULT_SOUND_PREFERENCES', () => {
  it('is on, glitch, 50%', () => {
    expect(DEFAULT_SOUND_PREFERENCES).toEqual({
      enabled: true,
      themeId: 'glitch',
      volume: 50,
    });
  });
});

describe('sanitizeSoundPreferences (lenient, for persisted data)', () => {
  it.each([undefined, null, 'x', 7, []])('gives the defaults for %j', (value) => {
    expect(sanitizeSoundPreferences(value)).toEqual(DEFAULT_SOUND_PREFERENCES);
  });

  it('keeps a valid value as is', () => {
    const saved = { enabled: false, themeId: 'glitch', volume: 80 };
    expect(sanitizeSoundPreferences(saved)).toEqual(saved);
  });

  it('falls back per field, not for the whole object', () => {
    expect(sanitizeSoundPreferences({ enabled: false })).toEqual({
      ...DEFAULT_SOUND_PREFERENCES,
      enabled: false,
    });
  });

  it('falls back to the default theme for an unknown theme', () => {
    expect(sanitizeSoundPreferences({ themeId: 'bogus' }).themeId).toBe('glitch');
  });

  it('falls back to the default for a non-boolean enabled', () => {
    expect(sanitizeSoundPreferences({ enabled: 'yes' }).enabled).toBe(true);
  });

  it.each([
    [49.6, 50],
    [-3, 0],
    [140, 100],
    [0, 0],
    [100, 100],
  ])('turns volume %s into %s', (volume, expected) => {
    expect(sanitizeSoundPreferences({ volume }).volume).toBe(expected);
  });

  it.each([Number.NaN, '50', null, undefined, Number.POSITIVE_INFINITY])(
    'uses the default volume for %j',
    (volume) => {
      expect(sanitizeSoundPreferences({ volume }).volume).toBe(50);
    },
  );

  it('ignores unknown keys', () => {
    expect(sanitizeSoundPreferences({ extra: 1 })).toEqual(
      DEFAULT_SOUND_PREFERENCES,
    );
  });
});

describe('applySoundPreferencesPatch (strict, for incoming messages)', () => {
  it.each([
    ['a non-object', 'volume'],
    ['null', null],
    ['an array', [{ volume: 10 }]],
    ['an empty patch', {}],
    ['an unknown key', { volume: 10, loud: true }],
    ['a non-boolean enabled', { enabled: 'yes' }],
    ['an unknown theme', { themeId: 'bogus' }],
    ['a fractional volume', { volume: 10.5 }],
    ['a negative volume', { volume: -1 }],
    ['a volume above 100', { volume: 101 }],
    ['a string volume', { volume: '50' }],
    ['a NaN volume', { volume: Number.NaN }],
    ['an undefined value', { enabled: undefined }],
  ])('rejects %s', (_label, patch) => {
    const result = applySoundPreferencesPatch(CURRENT, patch);
    expect(result.ok).toBe(false);
  });

  it('applies a one-key patch', () => {
    const result = applySoundPreferencesPatch(CURRENT, { volume: 80 });
    expect(result).toEqual({ ok: true, value: { ...CURRENT, volume: 80 } });
  });

  it('applies a two-key patch', () => {
    const result = applySoundPreferencesPatch(CURRENT, {
      enabled: false,
      themeId: 'terminal',
    });
    expect(result).toEqual({
      ok: true,
      value: { enabled: false, themeId: 'terminal', volume: 30 },
    });
  });

  it('applies a three-key patch', () => {
    const next = { enabled: false, themeId: 'glitch', volume: 0 };
    expect(applySoundPreferencesPatch(CURRENT, next)).toEqual({
      ok: true,
      value: next,
    });
  });

  it('accepts the volume bounds', () => {
    expect(applySoundPreferencesPatch(CURRENT, { volume: 0 }).ok).toBe(true);
    expect(applySoundPreferencesPatch(CURRENT, { volume: 100 }).ok).toBe(true);
  });

  it('leaves the current preferences untouched', () => {
    applySoundPreferencesPatch(CURRENT, { volume: 99 });
    applySoundPreferencesPatch(CURRENT, { volume: 'bad' });
    expect(CURRENT).toEqual({ enabled: true, themeId: 'synthwave', volume: 30 });
  });
});

describe('isSoundAudible', () => {
  it('is true when enabled with a volume above 0', () => {
    expect(isSoundAudible(DEFAULT_SOUND_PREFERENCES)).toBe(true);
  });

  it('is false when disabled', () => {
    expect(isSoundAudible({ ...DEFAULT_SOUND_PREFERENCES, enabled: false })).toBe(
      false,
    );
  });

  it('is false at volume 0', () => {
    expect(isSoundAudible({ ...DEFAULT_SOUND_PREFERENCES, volume: 0 })).toBe(false);
  });
});
