import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FOCUS_PRESET,
  FOCUS_PRESETS,
  PRESET_MINUTES,
  TOTAL_CHARACTERS_PER_SESSION,
  findPresetByDurationSeconds,
  isPresetDurationSeconds,
  tickMsForDurationSeconds,
} from '@/lib/timer/focus-presets';

describe('focus presets (user-selectable duration)', () => {
  it('offers exactly the requested lengths, in order', () => {
    expect(PRESET_MINUTES).toEqual([5, 10, 20, 30, 45, 60, 90, 120]);
    expect(FOCUS_PRESETS.map((preset) => preset.minutes)).toEqual([
      ...PRESET_MINUTES,
    ]);
  });

  it('exposes seconds and cadence for every preset', () => {
    for (const preset of FOCUS_PRESETS) {
      expect(preset.durationSeconds).toBe(preset.minutes * 60);
      expect(preset.tickMs).toBe(
        Math.round((preset.minutes * 60_000) / TOTAL_CHARACTERS_PER_SESSION),
      );
      expect(preset.tickMs).toBeGreaterThan(0);
    }
  });

  it('slows the growth down the longer the session is', () => {
    const ticks = FOCUS_PRESETS.map((preset) => preset.tickMs);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1] ?? 0);
    }
  });

  it('keeps the character total duration-neutral', () => {
    // Every preset is worth the same number of ticks over a full session.
    for (const preset of FOCUS_PRESETS) {
      const ticks = (preset.durationSeconds * 1_000) / preset.tickMs;
      expect(Math.round(ticks)).toBe(TOTAL_CHARACTERS_PER_SESSION);
    }
  });

  it('matches the example mapping (10 min → 1 s, 20 min → 2 s)', () => {
    expect(findPresetByDurationSeconds(10 * 60)?.tickMs).toBe(1_000);
    expect(findPresetByDurationSeconds(20 * 60)?.tickMs).toBe(2_000);
  });

  it('starts on the 30-minute preset by default', () => {
    expect(DEFAULT_FOCUS_PRESET.minutes).toBe(30);
    expect(DEFAULT_FOCUS_PRESET.durationSeconds).toBe(30 * 60);
    expect(tickMsForDurationSeconds(DEFAULT_FOCUS_PRESET.durationSeconds)).toBe(
      DEFAULT_FOCUS_PRESET.tickMs,
    );
  });

  it('recognises only the offered lengths', () => {
    for (const preset of FOCUS_PRESETS) {
      expect(isPresetDurationSeconds(preset.durationSeconds)).toBe(true);
    }
    expect(isPresetDurationSeconds(0)).toBe(false);
    expect(isPresetDurationSeconds(25 * 60)).toBe(false);
    expect(isPresetDurationSeconds(Number.NaN)).toBe(false);
  });

  it('degrades an unknown duration to the default cadence', () => {
    expect(tickMsForDurationSeconds(25 * 60)).toBe(DEFAULT_FOCUS_PRESET.tickMs);
    expect(tickMsForDurationSeconds(0)).toBe(DEFAULT_FOCUS_PRESET.tickMs);
    expect(findPresetByDurationSeconds(0)).toBeUndefined();
  });
});
