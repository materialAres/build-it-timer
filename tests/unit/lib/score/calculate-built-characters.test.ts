import { describe, it, expect } from 'vitest';
import { calculateBuiltCharacters } from '@/lib/score/calculate-built-characters';
import { PRESET_MINUTES } from '@/lib/timer/focus-presets';

const MINUTE_MS = 60_000;

describe('calculateBuiltCharacters (CR3.T1)', () => {
  it('counts focus characters from the session duration', () => {
    // Half of a 30-minute session is half of the characters.
    expect(calculateBuiltCharacters(15 * MINUTE_MS, 0, 30 * MINUTE_MS, 600)).toBe(300);
  });

  it('subtracts whole distraction characters', () => {
    expect(
      calculateBuiltCharacters(15 * MINUTE_MS, 3 * MINUTE_MS, 30 * MINUTE_MS, 600),
    ).toBe(240);
  });

  it('never goes below 0', () => {
    expect(calculateBuiltCharacters(MINUTE_MS, 20 * MINUTE_MS, 30 * MINUTE_MS, 600)).toBe(0);
  });

  it('caps focus at the total', () => {
    expect(calculateBuiltCharacters(90 * MINUTE_MS, 0, 30 * MINUTE_MS, 600)).toBe(600);
  });

  it('ignores a partial character', () => {
    // One character of a 30-minute / 600 session lasts 3000 ms.
    expect(calculateBuiltCharacters(2999, 0, 30 * MINUTE_MS, 600)).toBe(0);
    expect(calculateBuiltCharacters(3000, 0, 30 * MINUTE_MS, 600)).toBe(1);
  });

  it('returns an integer in [0, total]', () => {
    const built = calculateBuiltCharacters(123_457, 4_321, 30 * MINUTE_MS, 600);
    expect(Number.isInteger(built)).toBe(true);
    expect(built).toBeGreaterThanOrEqual(0);
    expect(built).toBeLessThanOrEqual(600);
  });

  describe('defensive inputs', () => {
    it.each([
      ['NaN focus', Number.NaN, 0, 1000, 600],
      ['negative focus', -500, 0, 1000, 600],
      ['infinite focus', Number.POSITIVE_INFINITY, 0, 1000, 600],
      ['zero duration', 500, 0, 0, 600],
      ['negative duration', 500, 0, -1000, 600],
      ['NaN duration', 500, 0, Number.NaN, 600],
      ['zero total', 500, 0, 1000, 0],
      ['infinite total', 500, 0, 1000, Number.POSITIVE_INFINITY],
    ])('degrades %s to 0', (_label, focused, distracted, duration, total) => {
      expect(calculateBuiltCharacters(focused, distracted, duration, total)).toBe(0);
    });

    it('treats a NaN or negative distraction as none', () => {
      expect(calculateBuiltCharacters(1000, Number.NaN, 1000, 600)).toBe(600);
      expect(calculateBuiltCharacters(1000, -50, 1000, 600)).toBe(600);
    });
  });

  describe('reachability of 100%', () => {
    const totals = [600, 700, 1000];
    const cases = totals.flatMap((total) =>
      PRESET_MINUTES.map((minutes) => [total, minutes] as const),
    );

    it.each(cases)(
      'a perfect session of total %i and %i minutes gives exactly the total',
      (total, minutes) => {
        const durationMs = minutes * MINUTE_MS;
        expect(calculateBuiltCharacters(durationMs, 0, durationMs, total)).toBe(total);
      },
    );
  });
});
