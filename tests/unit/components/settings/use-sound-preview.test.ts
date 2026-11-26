import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSoundPreview } from '@/components/settings/use-sound-preview';
import { calculatePlaybackPlan, type PlaybackPlan } from '@/lib/sound/playback-plan';
import { findSoundTheme } from '@/lib/sound/sound-themes';
import type { SoundThemeId } from '@/lib/sound/sound.types';
import type { SoundRenderer } from '@/lib/sound/web-audio-renderer';
import { createLogger, type LogRecord } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';

const END_GAP_SEC = 0.15;

function fakeRenderer(behavior: () => Promise<Result<void>> = () =>
  Promise.resolve(ok(undefined))) {
  const plans: PlaybackPlan[] = [];
  const stopAll = vi.fn();
  const dispose = vi.fn(() => Promise.resolve());
  const renderer: SoundRenderer = {
    play(plan) {
      plans.push(plan);
      return behavior();
    },
    stopAll,
    dispose,
  };
  return { renderer, plans, stopAll, dispose };
}

function plan(themeId: SoundThemeId, cue: 'start' | 'end', volume: number): PlaybackPlan {
  return calculatePlaybackPlan(findSoundTheme(themeId)[cue], volume);
}

/** Whole milliseconds, like the hook's timers, so the edges are exact. */
const endDelayMs = (themeId: SoundThemeId, volume: number): number =>
  Math.round((plan(themeId, 'start', volume).durationSec + END_GAP_SEC) * 1000);

const endDurationMs = (themeId: SoundThemeId, volume: number): number =>
  Math.round(plan(themeId, 'end', volume).durationSec * 1000);

describe('useSoundPreview (M5.T18)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(behavior?: () => Promise<Result<void>>) {
    const fake = fakeRenderer(behavior);
    const createRenderer = vi.fn(() => fake.renderer);
    const records: LogRecord[] = [];
    const logger = createLogger('test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const hook = renderHook(() => useSoundPreview({ createRenderer, logger }));
    return { ...fake, createRenderer, records, hook };
  }

  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it('creates no renderer before the first preview', () => {
    const { createRenderer, hook } = setup();
    expect(createRenderer).not.toHaveBeenCalled();
    expect(hook.result.current.previewingThemeId).toBeNull();
  });

  it('plays the theme start sound at once, creating the renderer once', async () => {
    const { createRenderer, plans, hook } = setup();

    await act(async () => {
      hook.result.current.preview('neon', 60);
      await Promise.resolve();
    });

    expect(createRenderer).toHaveBeenCalledTimes(1);
    expect(plans).toEqual([plan('neon', 'start', 60)]);
    expect(hook.result.current.previewingThemeId).toBe('neon');
  });

  it('plays the end sound after the start duration plus a short gap, in that order', async () => {
    const { plans, hook } = setup();
    await act(async () => {
      hook.result.current.preview('synthwave', 80);
      await Promise.resolve();
    });

    await advance(endDelayMs('synthwave', 80) - 1);
    expect(plans).toEqual([plan('synthwave', 'start', 80)]);

    await advance(1);
    expect(plans).toEqual([
      plan('synthwave', 'start', 80),
      plan('synthwave', 'end', 80),
    ]);
  });

  it('clears the previewing theme once the end sound has finished', async () => {
    const { hook } = setup();
    await act(async () => {
      hook.result.current.preview('terminal', 100);
      await Promise.resolve();
    });

    await advance(endDelayMs('terminal', 100) + endDurationMs('terminal', 100) - 1);
    expect(hook.result.current.previewingThemeId).toBe('terminal');

    await advance(1);
    expect(hook.result.current.previewingThemeId).toBeNull();
  });

  it('cancels the running preview when another one starts', async () => {
    const { plans, stopAll, hook } = setup();
    await act(async () => {
      hook.result.current.preview('neon', 50);
      await Promise.resolve();
    });
    await advance(100);

    await act(async () => {
      hook.result.current.preview('glitch', 50);
      await Promise.resolve();
    });

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(hook.result.current.previewingThemeId).toBe('glitch');

    await advance(10_000);
    expect(plans).toEqual([
      plan('neon', 'start', 50),
      plan('glitch', 'start', 50),
      plan('glitch', 'end', 50),
    ]);
  });

  it.each([0, -5, Number.NaN])('plays nothing, and creates no renderer, at volume %s', async (volume) => {
    const { createRenderer, plans, hook } = setup();

    await act(async () => {
      hook.result.current.preview('neon', volume);
      await Promise.resolve();
    });

    expect(createRenderer).not.toHaveBeenCalled();
    expect(plans).toEqual([]);
    expect(hook.result.current.previewingThemeId).toBeNull();
  });

  it('stops a running preview when the volume is dragged to 0', async () => {
    const { plans, stopAll, hook } = setup();
    await act(async () => {
      hook.result.current.preview('neon', 50);
      await Promise.resolve();
    });

    await act(async () => {
      hook.result.current.preview('neon', 0);
      await Promise.resolve();
    });
    await advance(10_000);

    expect(stopAll).toHaveBeenCalled();
    expect(plans).toHaveLength(1);
    expect(hook.result.current.previewingThemeId).toBeNull();
  });

  it('disposes the renderer, and drops the pending end sound, on unmount', async () => {
    const { plans, dispose, hook } = setup();
    await act(async () => {
      hook.result.current.preview('neon', 50);
      await Promise.resolve();
    });

    hook.unmount();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(plans).toHaveLength(1);
  });

  it('disposes nothing on unmount when no preview was ever played', () => {
    const { dispose, hook } = setup();
    hook.unmount();
    expect(dispose).not.toHaveBeenCalled();
  });

  it('keeps a stable preview function across renders', () => {
    const { hook } = setup();
    const first = hook.result.current.preview;
    hook.rerender();
    expect(hook.result.current.preview).toBe(first);
  });

  describe('errors never reach React', () => {
    it('logs a failed playback with the cue only', async () => {
      const { records, hook } = setup(() =>
        Promise.resolve(err(new Error('no audio'))),
      );

      await act(async () => {
        hook.result.current.preview('neon', 50);
        await Promise.resolve();
      });

      const warnings = records.filter((record) => record.level === 'warn');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.details).toEqual([{ cue: 'start' }]);
    });

    it('survives a renderer that rejects', async () => {
      const { records, hook } = setup(() => Promise.reject(new Error('boom')));

      await act(async () => {
        hook.result.current.preview('neon', 50);
        await Promise.resolve();
      });

      expect(records.some((record) => record.level === 'warn')).toBe(true);
    });

    it('survives a renderer that cannot be created', async () => {
      const records: LogRecord[] = [];
      const logger = createLogger('test', {
        sink: (record) => records.push(record),
        minLevel: 'debug',
      });
      const hook = renderHook(() =>
        useSoundPreview({
          createRenderer: () => {
            throw new Error('no AudioContext');
          },
          logger,
        }),
      );

      await act(async () => {
        hook.result.current.preview('neon', 50);
        await Promise.resolve();
      });

      expect(hook.result.current.previewingThemeId).toBeNull();
      expect(records.some((record) => record.level === 'error')).toBe(true);
    });
  });
});
