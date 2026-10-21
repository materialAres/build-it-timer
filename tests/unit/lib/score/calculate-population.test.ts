import { describe, it, expect } from 'vitest';
import {
  calculatePopulation,
  POPULATION_PER_TICK,
} from '@/lib/score/calculate-population';
import {
  FOCUS_PRESETS,
  TOTAL_CHARACTERS_PER_SESSION,
  DEFAULT_FOCUS_PRESET,
} from '@/lib/timer/focus-presets';

/** An arbitrary session cadence for the duration-agnostic behaviour tests. */
const TICK_MS = 2_000;

describe('calculatePopulation (M2.T18)', () => {
  it('keeps the per-tick inhabitants constant', () => {
    expect(POPULATION_PER_TICK).toBe(5);
  });

  it('is zero before a whole tick has elapsed', () => {
    expect(calculatePopulation(0, 0, TICK_MS)).toBe(0);
    expect(calculatePopulation(TICK_MS - 1, 0, TICK_MS)).toBe(0);
  });

  it('adds 5 inhabitants per completed session tick', () => {
    expect(calculatePopulation(TICK_MS, 0, TICK_MS)).toBe(5);
    expect(calculatePopulation(TICK_MS * 2, 0, TICK_MS)).toBe(10);
    expect(calculatePopulation(TICK_MS * 3, 0, TICK_MS)).toBe(15);
  });

  it('counts only whole ticks (a partial tick contributes nothing)', () => {
    expect(calculatePopulation(TICK_MS * 3 + 1_999, 0, TICK_MS)).toBe(15);
    expect(calculatePopulation(TICK_MS * 4 - 1, 0, TICK_MS)).toBe(15);
  });

  it('keeps growing linearly with focused time', () => {
    expect(calculatePopulation(60_000, 0, TICK_MS)).toBe(150);
    expect(calculatePopulation(120_000, 0, TICK_MS)).toBe(300);
    expect(calculatePopulation(600_000, 0, TICK_MS)).toBe(1_500);
  });

  it('is monotonic non-decreasing over focused time', () => {
    let previous = 0;
    for (let ms = 0; ms <= 60_000; ms += 500) {
      const population = calculatePopulation(ms, 0, TICK_MS);
      expect(population).toBeGreaterThanOrEqual(previous);
      previous = population;
    }
  });

  it('is pure: the same input always yields the same value', () => {
    expect(calculatePopulation(90_000, 0, TICK_MS)).toBe(
      calculatePopulation(90_000, 0, TICK_MS),
    );
    expect(calculatePopulation(90_000, 0, TICK_MS)).toBe(225);
  });

  it('subtracts 5 inhabitants per completed distraction tick', () => {
    // 6 focus ticks (+30) minus 2 distraction ticks (-10).
    expect(calculatePopulation(TICK_MS * 6, TICK_MS * 2, TICK_MS)).toBe(20);
    // 10 focus ticks (+50) minus 10 distraction ticks (-50).
    expect(calculatePopulation(TICK_MS * 10, TICK_MS * 10, TICK_MS)).toBe(0);
  });

  it('never goes below zero however long the distraction lasts', () => {
    expect(calculatePopulation(0, TICK_MS * 5, TICK_MS)).toBe(0);
    expect(calculatePopulation(TICK_MS, TICK_MS * 100, TICK_MS)).toBe(0);
  });

  it('counts only whole distraction ticks', () => {
    expect(calculatePopulation(TICK_MS * 4, TICK_MS - 1, TICK_MS)).toBe(20);
    expect(calculatePopulation(TICK_MS * 4, TICK_MS, TICK_MS)).toBe(15);
  });

  it('normalizes non-finite distraction input without throwing', () => {
    expect(calculatePopulation(TICK_MS * 2, Number.NaN, TICK_MS)).toBe(10);
    expect(calculatePopulation(TICK_MS * 2, -1_000, TICK_MS)).toBe(10);
  });

  it('defensively normalizes non-finite and negative input without throwing', () => {
    expect(calculatePopulation(Number.NaN, 0, TICK_MS)).toBe(0);
    expect(calculatePopulation(-5, 0, TICK_MS)).toBe(0);
    expect(calculatePopulation(Number.NEGATIVE_INFINITY, 0, TICK_MS)).toBe(0);
    expect(calculatePopulation(Number.POSITIVE_INFINITY, 0, TICK_MS)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('degrades to zero on a non-finite or non-positive cadence', () => {
    expect(calculatePopulation(60_000, 0, Number.NaN)).toBe(0);
    expect(calculatePopulation(60_000, 0, 0)).toBe(0);
    expect(calculatePopulation(60_000, 0, -1)).toBe(0);
  });

  it('is duration-neutral: every preset ends on the same population', () => {
    // The whole point of the feature: a longer focus builds the same city, only
    // more slowly. A full session is worth TOTAL_CHARACTERS_PER_SESSION ticks,
    // hence the same inhabitants, whatever the preset.
    const expected = TOTAL_CHARACTERS_PER_SESSION * POPULATION_PER_TICK;
    for (const preset of FOCUS_PRESETS) {
      expect(
        calculatePopulation(preset.durationSeconds * 1_000, 0, preset.tickMs),
      ).toBe(expected);
    }
  });

  it('advances the default preset on the session cadence', () => {
    expect(
      calculatePopulation(
        DEFAULT_FOCUS_PRESET.tickMs,
        0,
        DEFAULT_FOCUS_PRESET.tickMs,
      ),
    ).toBe(POPULATION_PER_TICK);
  });
});
