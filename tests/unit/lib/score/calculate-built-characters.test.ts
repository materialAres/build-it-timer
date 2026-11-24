import { describe, it, expect } from 'vitest';
import { calculateBuiltCharacters } from '@/lib/score/calculate-built-characters';
import { PRESET_MINUTES } from '@/lib/timer/focus-presets';

const MINUTE_MS = 60_000;

describe('calculateBuiltCharacters (CR3.T1)', () => {
  it('counts focus characters from the session duration', () => {
    // Half of a 30-minute session is half of the characters.
    expect(calculateBuiltCharacters(15 * MINUTE_MS, 0, 30 * MINUTE_MS, 600)).toBe(300);
  });

  it('charges distraction on the escalation schedule, not 1 per tick (CR6.T5b)', () => {
    // 3 of 30 minutes is 60 ticks: 5 at 1, 6 at 2, then 49 at 3 = 164 characters
    // (the old linear penalty was 60, so this was 240).
    expect(
      calculateBuiltCharacters(15 * MINUTE_MS, 3 * MINUTE_MS, 30 * MINUTE_MS, 600),
    ).toBe(300 - 164);
  });

  describe('the escalating malus (CR6.T5b, option A)', () => {
    const DURATION = 30 * MINUTE_MS;

    it('keeps the first stage equal to the old linear penalty: 5 ticks cost 5', () => {
      // 5 ticks of a 3 s cadence; every other tick of focus is kept.
      expect(calculateBuiltCharacters(300_000, 15_000, DURATION, 600)).toBe(100 - 5);
    });

    it('costs a worked example: 60 s on a blocked site loses 44 characters, not 20', () => {
      // 20 ticks: 5 at 1 + 6 at 2 + 9 at 3 = 44.
      const built = calculateBuiltCharacters(15 * MINUTE_MS, 60_000, DURATION, 600);
      expect(built).toBe(300 - 44);
    });

    it('makes a long stay cost more than a short one by the schedule', () => {
      const focus = 20 * MINUTE_MS;
      const short = calculateBuiltCharacters(focus, 30_000, DURATION, 600);
      const long = calculateBuiltCharacters(focus, 300_000, DURATION, 600);
      // 10 ticks owe 5 + 10 = 15; 100 ticks owe 5 + 12 + 89 × 3 = 284.
      expect(400 - short).toBe(15);
      expect(400 - long).toBe(284);
    });

    it('never gives more characters for more distraction', () => {
      let previous = Number.POSITIVE_INFINITY;
      for (let seconds = 0; seconds <= 600; seconds += 3) {
        const built = calculateBuiltCharacters(20 * MINUTE_MS, seconds * 1000, DURATION, 600);
        expect(built).toBeLessThanOrEqual(previous);
        previous = built;
      }
    });

    it('is the same share of the session at every preset: the same fraction costs the same', () => {
      for (const minutes of PRESET_MINUTES) {
        const duration = minutes * MINUTE_MS;
        // 10% of the session on blocked sites, the other 90% focused.
        const distracted = Math.round(duration * 0.1);
        expect(calculateBuiltCharacters(duration - distracted, distracted, duration, 600)).toBe(
          540 - 164,
        );
      }
    });

    // The effect on the CR3 bands (docs/features-analysis/city-3d.md §5): a
    // share `d` of the session on blocked sites, the rest focused, 600 total.
    it.each([
      ['1% (a great score stays great)', 0.01, 587],
      ['5% (a great score stays great)', 0.05, 496],
      ['10% (great falls to good because of the escalation)', 0.1, 376],
      ['20% (good falls to bad because of the escalation)', 0.2, 136],
      ['33% (nothing is left)', 1 / 3, 0],
    ])('with %s of the session distracted', (_label, share, expected) => {
      const distracted = Math.round(DURATION * share);
      expect(calculateBuiltCharacters(DURATION - distracted, distracted, DURATION, 600)).toBe(
        expected,
      );
    });

    it('still reaches 100% for an undistracted session', () => {
      expect(calculateBuiltCharacters(DURATION, 0, DURATION, 600)).toBe(600);
    });
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
