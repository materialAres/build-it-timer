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

/** When the end sound starts, and how long it lasts, both in milliseconds. */
function calculatePreviewTimings(
  themeId: SoundThemeId,
  volume: number,
): { readonly endDelayMs: number; readonly endDurationMs: number } {
  const theme = findSoundTheme(themeId);
  const startSec = calculatePlaybackPlan(theme.start, volume).durationSec;
  const endSec = calculatePlaybackPlan(theme.end, volume).durationSec;
  return {
    endDelayMs: Math.round((startSec + END_GAP_SEC) * 1000),
    endDurationMs: Math.round(endSec * 1000),
  };
}

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

interface PreviewAudio {
  /** The player, created on first use; `null` when there is no audio here. */
  readonly ensurePlayer: () => SoundPlayer | null;
  /** Cuts off whatever is still sounding. */
  readonly stopAll: () => void;
}

/** The audio behind the preview: created on the first preview, closed on unmount. */
function usePreviewAudio(
  createRenderer: () => SoundRenderer,
  logger: Logger,
): PreviewAudio {
  const rendererRef = useRef<SoundRenderer | null>(null);
  const playerRef = useRef<SoundPlayer | null>(null);

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

  const stopAll = useCallback((): void => {
    rendererRef.current?.stopAll();
  }, []);

  useEffect(
    () => () => {
      const renderer = rendererRef.current;
      rendererRef.current = null;
      playerRef.current = null;
      if (renderer !== null) void renderer.dispose();
    },
    [],
  );

  return { ensurePlayer, stopAll };
}

/**
 * Preview of a sound theme for the Settings panel (M5.T18). The popup plays
 * only this, after a click, so autoplay is allowed; the real start and end
 * sounds come from the background. A new preview cuts the previous one off.
 */
export function useSoundPreview({
  createRenderer = createDefaultRenderer,
  logger = defaultLogger,
}: SoundPreviewOptions = {}): SoundPreview {
  const [previewingThemeId, setPreviewingThemeId] = useState<SoundThemeId | null>(null);
  const { ensurePlayer, stopAll } = usePreviewAudio(createRenderer, logger);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const preview = useCallback(
    (themeId: SoundThemeId, volume: number): void => {
      // Cut off whatever is still playing, and its pending end sound.
      clearTimer();
      stopAll();
      setPreviewingThemeId(null);
      if (!Number.isFinite(volume) || volume <= 0) return;
      const player = ensurePlayer();
      if (player === null) return;

      const { endDelayMs, endDurationMs } = calculatePreviewTimings(themeId, volume);
      setPreviewingThemeId(themeId);
      playCue(player, logger, themeId, 'start', volume);
      timerRef.current = setTimeout(() => {
        playCue(player, logger, themeId, 'end', volume);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setPreviewingThemeId(null);
        }, endDurationMs);
      }, endDelayMs);
    },
    [clearTimer, stopAll, ensurePlayer, logger],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { preview, previewingThemeId };
}
