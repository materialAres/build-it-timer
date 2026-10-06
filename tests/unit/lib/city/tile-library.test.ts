import { describe, it, expect } from 'vitest';
import {
  TILE_BASE_WIDTH,
  TILE_LIBRARY,
  getModuleById,
  getModulesByCategory,
  isWidthCompatible,
} from '@/lib/city/tile-library';
import type { BuildingModuleCategory } from '@/components/city/city.types';

const CATEGORIES: ReadonlyArray<BuildingModuleCategory> = ['base', 'floor', 'top'];

describe('tile library (M2.T11b)', () => {
  it('provides at least two variants per category', () => {
    for (const category of CATEGORIES) {
      expect(getModulesByCategory(category).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has a non-empty, compatible width declared on every module', () => {
    for (const module of TILE_LIBRARY) {
      expect(module.widthChars).toBeGreaterThan(0);
      expect(isWidthCompatible(module.widthChars)).toBe(true);
    }
  });

  it('renders every row exactly as wide as the module declares', () => {
    for (const module of TILE_LIBRARY) {
      for (const row of module.rows) {
        expect(row.length).toBe(module.widthChars);
      }
    }
  });

  it('keeps widths mutually compatible within every category', () => {
    for (const category of CATEGORIES) {
      const modules = getModulesByCategory(category);
      // Equal widths are what actually prevents misalignment when modules of the
      // same category are stacked vertically; all must also sit on the grid.
      const widths = new Set(modules.map((module) => module.widthChars));
      expect(widths.size).toBe(1);
      for (const width of widths) {
        expect(isWidthCompatible(width)).toBe(true);
      }
    }
  });

  it('uses unique module ids', () => {
    const ids = TILE_LIBRARY.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filters modules by category, in declaration order', () => {
    const bases = getModulesByCategory('base');
    expect(bases.length).toBeGreaterThan(0);
    for (const module of bases) {
      expect(module.category).toBe('base');
    }
    expect(bases.map((module) => module.id)).toEqual(
      TILE_LIBRARY.filter((module) => module.category === 'base').map((module) => module.id),
    );
  });

  it('looks up a module by id and returns undefined for an unknown id', () => {
    const first = TILE_LIBRARY[0];
    expect(first).toBeDefined();
    if (first) expect(getModuleById(first.id)).toBe(first);
    expect(getModuleById('does-not-exist')).toBeUndefined();
  });
});

describe('isWidthCompatible (M2.T11b)', () => {
  it('accepts positive multiples of the base width', () => {
    expect(isWidthCompatible(TILE_BASE_WIDTH)).toBe(true);
    expect(isWidthCompatible(TILE_BASE_WIDTH * 2)).toBe(true);
    expect(isWidthCompatible(TILE_BASE_WIDTH, 4)).toBe(true);
  });

  it('rejects zero, negatives, non-integers and non-multiples', () => {
    expect(isWidthCompatible(0)).toBe(false);
    expect(isWidthCompatible(-TILE_BASE_WIDTH)).toBe(false);
    expect(isWidthCompatible(TILE_BASE_WIDTH / 2)).toBe(false);
    expect(isWidthCompatible(TILE_BASE_WIDTH + 1)).toBe(false);
    expect(isWidthCompatible(Number.NaN)).toBe(false);
  });
});
