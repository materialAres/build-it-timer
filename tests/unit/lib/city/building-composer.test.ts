import { describe, it, expect } from 'vitest';
import {
  BUILDING_UNLOCK_SCHEDULE,
  composeBuilding,
} from '@/lib/city/building-composer';
import { getModuleById, getModulesByCategory } from '@/lib/city/tile-library';
import type { SeededRandom } from '@/components/city/city.types';

/**
 * Minimal deterministic PRNG (mulberry32) used purely to prove the
 * "same seed → same building" guarantee. The composer is agnostic to how the
 * generator is built: it only depends on the injected `SeededRandom` port.
 */
function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

describe('building composer (M2.T11c)', () => {
  it('defines the unlock schedule as ordered, data-driven rules', () => {
    expect(BUILDING_UNLOCK_SCHEDULE.length).toBeGreaterThan(0);
    for (let index = 1; index < BUILDING_UNLOCK_SCHEDULE.length; index += 1) {
      const previous = BUILDING_UNLOCK_SCHEDULE[index - 1];
      const current = BUILDING_UNLOCK_SCHEDULE[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous && current) {
        expect(current.minuteThreshold).toBeGreaterThan(previous.minuteThreshold);
      }
    }
    for (const rule of BUILDING_UNLOCK_SCHEDULE) {
      expect(getModulesByCategory(rule.moduleCategory).length).toBeGreaterThan(0);
    }
  });

  it('represents an unbuilt building at zero minutes, distinct from a base', () => {
    const unbuilt = composeBuilding(0, createSeededRandom(1));
    expect(unbuilt).toEqual({ moduleIds: [], rows: [], widthChars: 0 });

    const base = composeBuilding(5, createSeededRandom(1));
    expect(base.moduleIds).toHaveLength(1);
    expect(base.rows.length).toBeGreaterThan(0);
    expect(base).not.toEqual(unbuilt);
  });

  it('keeps the building unbuilt below the first threshold', () => {
    expect(composeBuilding(4.999, createSeededRandom(7)).moduleIds).toEqual([]);
  });

  it('unlocks one more module at each threshold', () => {
    const baseOnly = composeBuilding(5, createSeededRandom(3));
    const oneFloor = composeBuilding(10, createSeededRandom(3));
    const twoFloors = composeBuilding(20, createSeededRandom(3));
    const topped = composeBuilding(25, createSeededRandom(3));

    expect(baseOnly.moduleIds).toHaveLength(1);
    expect(oneFloor.moduleIds).toHaveLength(2);
    expect(twoFloors.moduleIds).toHaveLength(3);
    expect(topped.moduleIds).toHaveLength(4);
  });

  it('never grows past the last threshold', () => {
    const topped = composeBuilding(25, createSeededRandom(42));
    const longSession = composeBuilding(10_000, createSeededRandom(42));
    expect(longSession).toEqual(topped);
  });

  it('unlocks only modules from the categories declared by the schedule', () => {
    const building = composeBuilding(25, createSeededRandom(9));
    const expectedCategories = BUILDING_UNLOCK_SCHEDULE.map(
      (rule) => rule.moduleCategory,
    );
    const actualCategories = building.moduleIds.map(
      (id) => getModuleById(id)?.category,
    );
    expect(actualCategories).toEqual(expectedCategories);
  });

  it('keeps already-unlocked modules stable as the building grows', () => {
    const seed = 123;
    const baseId = composeBuilding(5, createSeededRandom(seed)).moduleIds[0];
    expect(baseId).toBeDefined();

    for (const minutes of [10, 20, 25]) {
      const building = composeBuilding(minutes, createSeededRandom(seed));
      expect(building.moduleIds[0]).toBe(baseId);
    }
  });

  it('returns the same building for the same minutes and the same seed', () => {
    const first = composeBuilding(25.5, createSeededRandom(2024));
    const second = composeBuilding(25.5, createSeededRandom(2024));
    expect(second).toEqual(first);
  });

  it('produces different variants for different seeds', () => {
    const variants = new Set<string>();
    for (let seed = 0; seed < 32; seed += 1) {
      const baseId = composeBuilding(5, createSeededRandom(seed)).moduleIds[0];
      if (baseId) variants.add(baseId);
    }
    expect(variants.size).toBeGreaterThan(1);
  });

  it('lays rows out in visual top-to-bottom order (top, floors, base)', () => {
    const building = composeBuilding(25, createSeededRandom(77));
    const expectedRows: string[] = [];
    for (const id of [...building.moduleIds].reverse()) {
      const module = getModuleById(id);
      expect(module).toBeDefined();
      if (module) expectedRows.push(...module.rows);
    }
    expect(building.rows).toEqual(expectedRows);
  });

  it('renders every row exactly as wide as the declared building width', () => {
    for (const minutes of [5, 10, 20, 25]) {
      const building = composeBuilding(minutes, createSeededRandom(5));
      expect(building.widthChars).toBeGreaterThan(0);
      for (const row of building.rows) {
        expect(row.length).toBe(building.widthChars);
      }
    }
  });

  it('defensively normalizes negative and non-finite minutes', () => {
    const unbuilt = { moduleIds: [], rows: [], widthChars: 0 };
    expect(composeBuilding(-10, createSeededRandom(1))).toEqual(unbuilt);
    expect(composeBuilding(Number.NaN, createSeededRandom(1))).toEqual(unbuilt);
    expect(composeBuilding(Number.NEGATIVE_INFINITY, createSeededRandom(1))).toEqual(
      unbuilt,
    );
    // +Infinity means "unlocked everything", mirroring calculateScore's clamp.
    const topped = composeBuilding(25, createSeededRandom(1));
    expect(composeBuilding(Number.POSITIVE_INFINITY, createSeededRandom(1))).toEqual(
      topped,
    );
  });
});
