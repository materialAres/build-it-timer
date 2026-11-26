import type { SoundTheme, SoundThemeId } from './sound.types';
import { GLITCH_THEME } from './themes/glitch';
import { NEON_THEME } from './themes/neon';
import { SYNTHWAVE_THEME } from './themes/synthwave';
import { TERMINAL_THEME } from './themes/terminal';

export const DEFAULT_SOUND_THEME_ID: SoundThemeId = 'neon';

/**
 * The themes, in the order the Settings panel lists them. Each recipe is data
 * in its own file under `themes/`: adding a theme is a new file plus one entry
 * here (and its id in `SoundThemeId`), with no change to the player.
 */
export const SOUND_THEMES: ReadonlyArray<SoundTheme> = [
  NEON_THEME,
  SYNTHWAVE_THEME,
  GLITCH_THEME,
  TERMINAL_THEME,
];

export function isSoundThemeId(value: unknown): value is SoundThemeId {
  return SOUND_THEMES.some((theme) => theme.id === value);
}

export function findSoundTheme(id: SoundThemeId): SoundTheme {
  const theme = SOUND_THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) {
    throw new Error(`Unknown sound theme: ${id}`);
  }
  return theme;
}
