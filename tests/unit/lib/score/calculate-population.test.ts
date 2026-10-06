import { describe, it, expect } from 'vitest';
import {
  calculatePopulation,
  POPULATION_PER_HOUSE,
  POPULATION_PER_FLOOR,
} from '@/lib/score/calculate-population';
import { composeBuilding } from '@/lib/city/building-composer';
import { getModuleById } from '@/lib/city/tile-library';
import type { SeededRandom } from '@/components/city/city.types';

const rng = (value: number): SeededRandom => ({ next: () => value });

/** Count the composed building's bases/floors exactly as population defines them. */
function countFromBuilding(minutes: number, value: number): number {
  const building = composeBuilding(minutes, rng(value));
  return building.moduleIds.reduce((total, id) => {
    const module = getModuleById(id);
    if (module?.category === 'base') return total + POPULATION_PER_HOUSE;
    if (module?.category === 'floor') return total + POPULATION_PER_FLOOR;
    return total;
  }, 0);
}

describe('calculatePopulation (M2.T18)', () => {
  it('is zero while the first house is not unlocked (before 5 minutes)', () => {
    expect(calculatePopulation(0)).toBe(0);
    expect(calculatePopulation(4.9)).toBe(0);
  });

  it('adds one house (+5) at the base threshold', () => {
    expect(POPULATION_PER_HOUSE).toBe(5);
    expect(calculatePopulation(5)).toBe(5);
    expect(calculatePopulation(9)).toBe(5);
  });

  it('adds one building floor (+15) at each floor threshold', () => {
    expect(POPULATION_PER_FLOOR).toBe(15);
    expect(calculatePopulation(10)).toBe(20);
    expect(calculatePopulation(19)).toBe(20);
    expect(calculatePopulation(20)).toBe(35);
  });

  it('does not add inhabitants for the decorative top element (25 minutes)', () => {
    expect(calculatePopulation(24)).toBe(35);
    expect(calculatePopulation(25)).toBe(35);
    expect(calculatePopulation(10_000)).toBe(35);
  });

  it('matches the composition schedule: the same focused time always yields the same value', () => {
    for (const minutes of [5, 6, 10, 15, 20, 25, 30, 60]) {
      expect(calculatePopulation(minutes)).toBe(countFromBuilding(minutes, 0.1));
      expect(calculatePopulation(minutes)).toBe(countFromBuilding(minutes, 0.9));
    }
  });

  it('is monotonic non-decreasing over focused time', () => {
    let previous = 0;
    for (let minutes = 0; minutes <= 30; minutes += 0.5) {
      const population = calculatePopulation(minutes);
      expect(population).toBeGreaterThanOrEqual(previous);
      previous = population;
    }
  });

  it('is independent of the module variant (seed does not matter)', () => {
    // Population counts unlocked categories, not the randomly chosen variant.
    expect(calculatePopulation(25)).toBe(countFromBuilding(25, 0));
    expect(calculatePopulation(25)).toBe(countFromBuilding(25, 0.999));
  });

  it('defensively normalizes non-finite and negative input without throwing', () => {
    expect(calculatePopulation(Number.NaN)).toBe(0);
    expect(calculatePopulation(-5)).toBe(0);
    expect(calculatePopulation(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(calculatePopulation(Number.POSITIVE_INFINITY)).toBe(35);
  });
});
