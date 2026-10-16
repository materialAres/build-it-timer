import { describe, it, expect } from 'vitest';
import {
  calculatePopulation,
  POPULATION_PER_TICK,
} from '@/lib/score/calculate-population';
import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';

describe('calculatePopulation (M2.T18)', () => {
  it('uses the same cadence as the city growth tick', () => {
    // The population advances on the city's fine-grained clock (M2.T12); the
    // two constants must not drift apart.
    expect(GROWTH_TICK_MS).toBe(2000);
    expect(POPULATION_PER_TICK).toBe(5);
  });

  it('is zero before a whole tick has elapsed', () => {
    expect(calculatePopulation(0)).toBe(0);
    expect(calculatePopulation(GROWTH_TICK_MS - 1)).toBe(0);
  });

  it('adds 5 inhabitants per completed 2-second tick', () => {
    expect(calculatePopulation(GROWTH_TICK_MS)).toBe(5);
    expect(calculatePopulation(GROWTH_TICK_MS * 2)).toBe(10);
    expect(calculatePopulation(GROWTH_TICK_MS * 3)).toBe(15);
  });

  it('counts only whole ticks (a partial tick contributes nothing)', () => {
    expect(calculatePopulation(GROWTH_TICK_MS * 3 + 1_999)).toBe(15);
    expect(calculatePopulation(GROWTH_TICK_MS * 4 - 1)).toBe(15);
  });

  it('reaches 3750 over a 25-minute session', () => {
    // 750 ticks × 5 inhabitants.
    expect(calculatePopulation(25 * 60_000)).toBe(3_750);
  });

  it('keeps growing linearly with focused time', () => {
    expect(calculatePopulation(60_000)).toBe(150);
    expect(calculatePopulation(120_000)).toBe(300);
    expect(calculatePopulation(600_000)).toBe(1_500);
  });

  it('is monotonic non-decreasing over focused time', () => {
    let previous = 0;
    for (let ms = 0; ms <= 60_000; ms += 500) {
      const population = calculatePopulation(ms);
      expect(population).toBeGreaterThanOrEqual(previous);
      previous = population;
    }
  });

  it('is pure: the same input always yields the same value', () => {
    expect(calculatePopulation(90_000)).toBe(calculatePopulation(90_000));
    expect(calculatePopulation(90_000)).toBe(225);
  });

  it('subtracts 5 inhabitants per completed distraction tick', () => {
    // 6 focus ticks (+30) minus 2 distraction ticks (-10).
    expect(calculatePopulation(GROWTH_TICK_MS * 6, GROWTH_TICK_MS * 2)).toBe(20);
    // 10 focus ticks (+50) minus 10 distraction ticks (-50).
    expect(calculatePopulation(GROWTH_TICK_MS * 10, GROWTH_TICK_MS * 10)).toBe(0);
  });

  it('never goes below zero however long the distraction lasts', () => {
    expect(calculatePopulation(0, GROWTH_TICK_MS * 5)).toBe(0);
    expect(calculatePopulation(GROWTH_TICK_MS, GROWTH_TICK_MS * 100)).toBe(0);
  });

  it('counts only whole distraction ticks', () => {
    expect(calculatePopulation(GROWTH_TICK_MS * 4, GROWTH_TICK_MS - 1)).toBe(20);
    expect(calculatePopulation(GROWTH_TICK_MS * 4, GROWTH_TICK_MS)).toBe(15);
  });

  it('normalizes non-finite distraction input without throwing', () => {
    expect(calculatePopulation(GROWTH_TICK_MS * 2, Number.NaN)).toBe(10);
    expect(calculatePopulation(GROWTH_TICK_MS * 2, -1_000)).toBe(10);
  });

  it('defensively normalizes non-finite and negative input without throwing', () => {
    expect(calculatePopulation(Number.NaN)).toBe(0);
    expect(calculatePopulation(-5)).toBe(0);
    expect(calculatePopulation(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(calculatePopulation(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});