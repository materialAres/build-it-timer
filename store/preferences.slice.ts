import type { StateCreator } from 'zustand';
import {
  DEFAULT_SOUND_PREFERENCES,
  applySoundPreferencesPatch,
  type SoundPreferences,
} from '@/lib/sound/sound-preferences';
import type { SoundThemeId } from '@/lib/sound/sound.types';
import type { AppState } from '.';

export interface PreferencesState {
  readonly sound: SoundPreferences;
}

export interface PreferencesSlice {
  readonly preferences: PreferencesState;
  /**
   * Apply a change to the sound preferences. Background-side only: the popup
   * asks through `requestSetSoundPreferences` (M5.T9). The patch is untrusted,
   * so it is validated here; an invalid or unchanged one writes nothing.
   * Never locked by the timer status.
   */
  setSoundPreferences(patch: unknown): void;
}

const initialPreferencesState: PreferencesState = {
  sound: DEFAULT_SOUND_PREFERENCES,
};

function isSameSound(a: SoundPreferences, b: SoundPreferences): boolean {
  return a.enabled === b.enabled && a.themeId === b.themeId && a.volume === b.volume;
}

export const createPreferencesSlice =
  (): StateCreator<AppState, [], [], PreferencesSlice> => (set, get) => ({
    preferences: initialPreferencesState,

    setSoundPreferences(patch: unknown): void {
      const current = get().preferences.sound;
      const result = applySoundPreferencesPatch(current, patch);
      if (!result.ok || isSameSound(current, result.value)) return;
      set({ preferences: { sound: result.value } });
    },
  });

export const selectSoundEnabled = (state: PreferencesSlice): boolean =>
  state.preferences.sound.enabled;

export const selectSoundThemeId = (state: PreferencesSlice): SoundThemeId =>
  state.preferences.sound.themeId;

export const selectSoundVolume = (state: PreferencesSlice): number =>
  state.preferences.sound.volume;
