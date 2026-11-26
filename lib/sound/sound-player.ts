import { err, ok, type Result } from '@/utils/result';
import { calculatePlaybackPlan } from './playback-plan';
import { isSoundVolume } from './sound-preferences';
import { findSoundTheme, isSoundThemeId } from './sound-themes';
import type { SoundCue, SoundThemeId } from './sound.types';
import type { SoundRenderer } from './web-audio-renderer';

export interface SoundPlayRequest {
  readonly themeId: SoundThemeId;
  readonly cue: SoundCue;
  /** A whole number from 0 to 100. */
  readonly volume: number;
}

/**
 * The one interface every context uses to play a cue. Every implementation and
 * every fake honours the same contract: it resolves, never throws (principle L).
 */
export interface SoundPlayer {
  play(request: SoundPlayRequest): Promise<Result<void>>;
}

function isSoundCue(value: unknown): value is SoundCue {
  return value === 'start' || value === 'end';
}

/** The request crosses a message boundary, so it is checked, not trusted. */
export function isSoundPlayRequest(value: unknown): value is SoundPlayRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { themeId, cue, volume } = value as Record<string, unknown>;
  return isSoundThemeId(themeId) && isSoundCue(cue) && isSoundVolume(volume);
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Plays through a renderer in this context (Firefox background, offscreen page). */
export function createDirectSoundPlayer(renderer: SoundRenderer): SoundPlayer {
  return {
    async play(request): Promise<Result<void>> {
      if (!isSoundPlayRequest(request)) {
        return err(new Error('invalid sound request'));
      }
      const recipe = findSoundTheme(request.themeId)[request.cue];
      const plan = calculatePlaybackPlan(recipe, request.volume);
      if (plan.tones.length === 0) return ok(undefined);
      try {
        return await renderer.play(plan);
      } catch (cause) {
        return err(toError(cause));
      }
    },
  };
}

/** For contexts with no audio at all: accepts everything and stays quiet. */
export function createSilentSoundPlayer(): SoundPlayer {
  return {
    play: () => Promise.resolve(ok(undefined)),
  };
}
