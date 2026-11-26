import type { Logger } from '@/utils/logger';
import { isSoundAudible, type SoundPreferences } from './sound-preferences';
import type { SoundPlayer } from './sound-player';
import type { SoundCue } from './sound.types';

/**
 * How late a completion may be handled and still earn its sound. Normal alarm
 * jitter and a service-worker wake-up stay well inside it; a machine that was
 * asleep, or a browser that was closed at the deadline, does not.
 */
export const END_SOUND_MAX_LATENESS_MS = 60_000;

/**
 * A session that completes long after `endsAt` (the startup catch-up) still
 * completes, but silently: a chime hours late would be noise. A completion
 * slightly early counts as on time.
 */
export function shouldPlayEndSound(endsAt: number | null, now: number): boolean {
  return endsAt !== null && now - endsAt <= END_SOUND_MAX_LATENESS_MS;
}

export interface SoundCuesDependencies {
  /** Read at call time, so a change of preferences applies to the next cue. */
  readonly getPreferences: () => SoundPreferences;
  readonly player: SoundPlayer;
  readonly now: () => number;
  readonly logger: Logger;
}

export interface SoundCues {
  sessionStarted(): void;
  sessionCompleted(endsAt: number | null): void;
}

export function createSoundCues({
  getPreferences,
  player,
  now,
  logger,
}: SoundCuesDependencies): SoundCues {
  // Fire and forget: a cue must never delay or break the session logic.
  const play = (cue: SoundCue): void => {
    const preferences = getPreferences();
    if (!isSoundAudible(preferences)) return;
    void (async () => {
      try {
        const result = await player.play({
          themeId: preferences.themeId,
          cue,
          volume: preferences.volume,
        });
        if (!result.ok) logger.warn('sound cue failed', { cue });
      } catch (cause) {
        // A player never throws (its contract), so this is a bug: keep the cause.
        logger.error('sound cue failed', cause, { cue });
      }
    })();
  };

  return {
    sessionStarted(): void {
      play('start');
    },
    sessionCompleted(endsAt): void {
      if (shouldPlayEndSound(endsAt, now())) play('end');
    },
  };
}
