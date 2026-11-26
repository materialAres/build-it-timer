import { err, ok, type Result } from '@/utils/result';
import { DEFAULT_SOUND_THEME_ID, isSoundThemeId } from './sound-themes';
import type { SoundThemeId } from './sound.types';

export interface SoundPreferences {
  readonly enabled: boolean;
  readonly themeId: SoundThemeId;
  /** An integer from 0 to 100. */
  readonly volume: number;
}

export type SoundPreferencesPatch = Partial<SoundPreferences>;

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  enabled: true,
  themeId: DEFAULT_SOUND_THEME_ID,
  volume: 50,
};

const PREFERENCE_KEYS: ReadonlyArray<keyof SoundPreferences> = [
  'enabled',
  'themeId',
  'volume',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidVolume(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100;
}

function sanitizeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SOUND_PREFERENCES.volume;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Lenient, for persisted data: a bad or missing field falls back to its own
 * default, so one corrupt value does not reset the others.
 */
export function sanitizeSoundPreferences(value: unknown): SoundPreferences {
  if (!isRecord(value)) return DEFAULT_SOUND_PREFERENCES;
  return {
    enabled:
      typeof value.enabled === 'boolean'
        ? value.enabled
        : DEFAULT_SOUND_PREFERENCES.enabled,
    themeId: isSoundThemeId(value.themeId)
      ? value.themeId
      : DEFAULT_SOUND_PREFERENCES.themeId,
    volume: sanitizeVolume(value.volume),
  };
}

function validatePatch(patch: unknown): Result<SoundPreferencesPatch> {
  if (!isRecord(patch)) return err(new Error('patch must be an object'));
  const keys = Object.keys(patch);
  if (keys.length === 0) return err(new Error('patch is empty'));
  const unknown = keys.find(
    (key) => !PREFERENCE_KEYS.includes(key as keyof SoundPreferences),
  );
  if (unknown !== undefined) return err(new Error(`unknown key: ${unknown}`));
  if ('enabled' in patch && typeof patch.enabled !== 'boolean') {
    return err(new Error('enabled must be a boolean'));
  }
  if ('themeId' in patch && !isSoundThemeId(patch.themeId)) {
    return err(new Error('unknown themeId'));
  }
  if ('volume' in patch && !isValidVolume(patch.volume)) {
    return err(new Error('volume must be an integer from 0 to 100'));
  }
  return ok(patch as SoundPreferencesPatch);
}

/** Strict, for incoming messages: anything invalid rejects the whole patch. */
export function applySoundPreferencesPatch(
  current: SoundPreferences,
  patch: unknown,
): Result<SoundPreferences> {
  const validated = validatePatch(patch);
  if (!validated.ok) return validated;
  return ok({ ...current, ...validated.value });
}

export function isSoundAudible(preferences: SoundPreferences): boolean {
  return preferences.enabled && preferences.volume > 0;
}
