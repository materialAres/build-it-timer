import { describe, it, expect } from 'vitest';
import {
  createGrowthEngine,
  growCity,
  GROWTH_TICK_MS,
} from '@/lib/city/growth-engine';
import type { CityGrid, CityLayers } from '@/components/city/city.types';

function emptyGrid(width = 4, height = 3): CityGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ char: null })),
    ),
  };
}

function emptyLayers(width = 4, height = 3): CityLayers {
  return {
    background: emptyGrid(width, height),
    middleground: emptyGrid(width, height),
    foreground: emptyGrid(width, height),
  };
}

function fullGrid(width = 4, height = 3): CityGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ char: '#' })),
    ),
  };
}

function fullLayers(width = 4, height = 3): CityLayers {
  return {
    background: fullGrid(width, height),
    middleground: fullGrid(width, height),
    foreground: fullGrid(width, height),
  };
}

const allGrids = (layers: CityLayers): ReadonlyArray<CityGrid> => [
  layers.background,
  layers.middleground,
  layers.foreground,
];

const occupied = (grid: CityGrid): number =>
  grid.cells.flat().filter((cell) => cell.char !== null).length;

const occupiedTotal = (layers: CityLayers): number =>
  allGrids(layers).reduce((total, grid) => total + occupied(grid), 0);

const capacity = (layers: CityLayers): number =>
  allGrids(layers).reduce((total, grid) => total + grid.width * grid.height, 0);

describe('growth engine (M2.T12)', () => {
  it('is a no-op for a zero time delta (same reference)', () => {
    const city = emptyLayers();

    expect(growCity(city, 0)).toBe(city);
    expect(growCity(city, GROWTH_TICK_MS - 1)).toBe(city);
  });

  it('is a no-op for negative or non-finite deltas', () => {
    const city = emptyLayers();

    expect(growCity(city, -5_000)).toBe(city);
    expect(growCity(city, Number.NaN)).toBe(city);
    expect(growCity(city, Number.NEGATIVE_INFINITY)).toBe(city);
    expect(growCity(city, Number.POSITIVE_INFINITY)).toBe(city);
  });

  it('inserts exactly one character per 2s tick, one at a time', () => {
    let city = emptyLayers();

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(1);

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(2);

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(3);
  });

  it('inserts as many characters as whole ticks in a single larger delta', () => {
    const city = growCity(emptyLayers(), GROWTH_TICK_MS * 2 + 1_999);
    expect(occupiedTotal(city)).toBe(2);
  });

  it('spreads the first characters across the three layers', () => {
    const city = growCity(emptyLayers(), GROWTH_TICK_MS * 3);

    expect(occupied(city.background)).toBe(1);
    expect(occupied(city.middleground)).toBe(1);
    expect(occupied(city.foreground)).toBe(1);
  });

  it('is deterministic for the same state, delta and seed', () => {
    const city = emptyLayers(40, 12);
    const first = growCity(city, GROWTH_TICK_MS * 300, 42);
    const second = growCity(city, GROWTH_TICK_MS * 300, 42);

    expect(second).toEqual(first);
  });

  it('produces different cities for different seeds once modules are unlocked', () => {
    const city = emptyLayers(40, 12);
    const shapes = new Set<string>();
    for (let seed = 0; seed < 16; seed += 1) {
      shapes.add(JSON.stringify(growCity(city, GROWTH_TICK_MS * 300, seed)));
    }

    expect(shapes.size).toBeGreaterThan(1);
  });

  it('never writes a blank or multi-character glyph', () => {
    const city = growCity(emptyLayers(6, 4), GROWTH_TICK_MS * 200, 7);

    for (const grid of allGrids(city)) {
      for (const cell of grid.cells.flat()) {
        if (cell.char !== null) {
          expect(cell.char.length).toBe(1);
          expect(cell.char.trim()).toBe(cell.char);
        }
      }
    }
  });

  it('is pure: the input layers are never mutated', () => {
    const city = emptyLayers();
    const before = JSON.stringify(city);

    growCity(city, GROWTH_TICK_MS * 8, 3);

    expect(JSON.stringify(city)).toBe(before);
  });

  it('leaves an already full grid unchanged (same reference)', () => {
    const city = fullLayers();

    expect(growCity(city, GROWTH_TICK_MS)).toBe(city);
    expect(growCity(city, GROWTH_TICK_MS * 1_000, 9)).toBe(city);
  });

  it('stops at capacity for a very large delta, without exceeding the dimensions', () => {
    const city = emptyLayers(4, 3);
    const limit = capacity(city);

    const grown = growCity(city, GROWTH_TICK_MS * (limit + 50), 1);

    expect(occupiedTotal(grown)).toBe(limit);
    for (const grid of allGrids(grown)) {
      expect(grid.width).toBe(4);
      expect(grid.height).toBe(3);
      expect(grid.cells).toHaveLength(3);
      expect(grid.cells[0]).toHaveLength(4);
    }
    // Further growth on the capped city is still a no-op.
    expect(growCity(grown, GROWTH_TICK_MS * 10, 1)).toBe(grown);
  });

  it('exposes a seeded adapter compatible with the CityGrowthEngine port', () => {
    const engine = createGrowthEngine({ seed: 123 });
    const city = emptyLayers();

    const viaAdapter = engine(city, GROWTH_TICK_MS * 4);
    const viaFunction = growCity(city, GROWTH_TICK_MS * 4, 123);

    expect(viaAdapter).toEqual(viaFunction);
  });
});
