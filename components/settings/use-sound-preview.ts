import { useCallback, useEffect, useRef, useState } from 'react';
import { calculatePlaybackPlan } from '@/lib/sound/playback-plan';
import { createDirectSoundPlayer, type SoundPlayer } from '@/lib/sound/sound-player';
import { findSoundTheme } from '@/lib/sound/sound-themes';
import type { SoundCue, SoundThemeId } from '@/lib/sound/sound.types';
import { createWebAudioRenderer, type SoundRenderer } from '@/lib/sound/web-audio-renderer';
import { createLogger, type Logger } from '@/utils/logger';

export interface SoundPreviewOptions {
  /** Defaults to a Web Audio renderer; injectable so tests need no audio. */
  readonly createRenderer?: () => SoundRenderer;
  readonly logger?: Logger;
}

export interface SoundPreview {
  /** Plays the theme's start sound, then its end sound, at `volume` (0–100). */
  readonly preview: (themeId: SoundThemeId, volume: number) => void;
  /** The theme being previewed right now, or `null`. */
  readonly previewingThemeId: SoundThemeId | null;
}

/** A short pause between the two sounds of a preview. */
const END_GAP_SEC = 0.15;

const defaultLogger = createLogger('settings:preview');

const createDefaultRenderer = (): SoundRenderer =>
  createWebAudioRenderer(() => new AudioContext());

function playCue(
  player: SoundPlayer,
  logger: Logger,
  themeId: SoundThemeId,
  cue: SoundCue,
  volume: number,
): void {
  const failed = (): void => {
    logger.warn('sound preview failed', { cue });
  };
  void player.play({ themeId, cue, volume }).then((result) => {
    if (!result.ok) failed();
  }, failed);
}

/**
 * Preview of a sound theme for the Settings panel (M5.T18). The popup plays
 * only this, after a click, so autoplay is allowed; the real start and end
 * sounds come from the background. The audio context is created on the first
 * preview and closed on unmount, and a new preview cuts the previous one off.
 */
export function useSoundPreview({
  createRenderer = createDefaultRenderer,
  logger = defaultLogger,
}: SoundPreviewOptions = {}): SoundPreview {
  const [previewingThemeId, setPreviewingThemeId] = useState<SoundThemeId | null>(null);
  const rendererRef = useRef<SoundRenderer | null>(null);
  const playerRef = useRef<SoundPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const ensurePlayer = useCallback((): SoundPlayer | null => {
    if (playerRef.current !== null) return playerRef.current;
    try {
      const renderer = createRenderer();
      rendererRef.current = renderer;
      playerRef.current = createDirectSoundPlayer(renderer);
      return playerRef.current;
    } catch (cause) {
      logger.error('sound preview unavailable', cause);
      return null;
    }
  }, [createRenderer, logger]);

  const preview = useCallback(
    (themeId: SoundThemeId, volume: number): void => {
      // Cut off whatever is still playing, and its pending end sound.
      clearTimer();
      rendererRef.current?.stopAll();
      setPreviewingThemeId(null);
      if (!Number.isFinite(volume) || volume <= 0) return;

      const player = ensurePlayer();
      if (player === null) return;
      const theme = findSoundTheme(themeId);
      const endDelaySec = calculatePlaybackPlan(theme.start, volume).durationSec + END_GAP_SEC;
      const endDurationSec = calculatePlaybackPlan(theme.end, volume).durationSec;

      setPreviewingThemeId(themeId);
      playCue(player, logger, themeId, 'start', volume);
      timerRef.current = setTimeout(() => {
        playCue(player, logger, themeId, 'end', volume);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setPreviewingThemeId(null);
        }, Math.round(endDurationSec * 1000));
      }, Math.round(endDelaySec * 1000));
    },
    [clearTimer, ensurePlayer, logger],
  );

  useEffect(
    () => () => {
      clearTimer();
      const renderer = rendererRef.current;
      rendererRef.current = null;
      playerRef.current = null;
      if (renderer !== null) void renderer.dispose();
    },
    [clearTimer],
  );

  return { preview, previewingThemeId };
}
