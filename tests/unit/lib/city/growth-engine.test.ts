import { describe, it, expect } from 'vitest';
import {
  createGrowthEngine,
  growCity,
  GROWTH_TICK_MS,
} from '@/lib/city/growth-engine';
import {
  CITY_WIDTH_CHARS,
  CITY_HEIGHT_ROWS,
} from '@/lib/city/city-size';
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

  it('inserts exactly one character per tick, one at a time', () => {
    let city = emptyLayers();

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(1);

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(2);

    city = growCity(city, GROWTH_TICK_MS);
    expect(occupiedTotal(city)).toBe(3);
  });

  it('inserts as many characters as whole ticks in a single larger delta', () => {
    // "Just under three ticks": the partial remainder must be discarded, so
    // exactly two characters are placed. Expressed in terms of the tick constant
    // rather than a literal millisecond count, so the test keeps its meaning if
    // the cadence is retuned.
    const city = growCity(emptyLayers(), GROWTH_TICK_MS * 3 - 1);
    expect(occupiedTotal(city)).toBe(2);
  });

  it('spreads the first characters across the three layers', () => {
    // The grid must be tall enough to have all three bands: `bandOf` gives the
    // sky a share only from SKY_MIN_GRID_HEIGHT (10 rows) up, so a shorter grid
    // has nowhere to put a star and the rotation never reaches `background`.
    const city = growCity(emptyLayers(12, 12), GROWTH_TICK_MS * 3);

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
    const city = emptyLayers(CITY_WIDTH_CHARS, CITY_HEIGHT_ROWS);
    const limit = capacity(city);

    // A delta far larger than the grid can hold must saturate, not overflow.
    const grown = growCity(city, GROWTH_TICK_MS * (limit + 50), 1);

    // Not every cell is fillable: the band layout reserves a street row and only
    // places structures inside their own band, so the real saturation point is
    // well below `capacity`. What must hold is that growth *stops*.
    expect(occupiedTotal(grown)).toBeLessThanOrEqual(limit);
    for (const grid of allGrids(grown)) {
      expect(grid.width).toBe(CITY_WIDTH_CHARS);
      expect(grid.height).toBe(CITY_HEIGHT_ROWS);
      expect(grid.cells).toHaveLength(CITY_HEIGHT_ROWS);
      expect(grid.cells[0]).toHaveLength(CITY_WIDTH_CHARS);
    }
    // Saturated: further growth is a no-op (same reference).
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

/**
 * Regression guards for the two defects found while enlarging the city grid.
 * They are the tests that would have caught them, so they are deliberately
 * written against the *default* production size rather than a toy grid.
 */
describe('growth engine — band utilization (regression)', () => {
  it('builds houses taller than the old fixed 7-row ceiling', () => {
    // Before the fix `buildHouse` capped floors at FLOORS_RANGE.max (4), so no
    // house could ever exceed top(1) + 4 floors + base(2) = 7 rows of *house*,
    // no matter how tall the grid was.
    //
    // The pavement row is excluded deliberately: it sits directly under the
    // houses and is contiguous with them, so counting it would make the old
    // ceiling look like 8 and the assertion would pass even unfixed.
    const tallestHouse = (grid: CityGrid): number => {
      let tallest = 0;
      for (let col = 0; col < grid.width; col += 1) {
        let run = 0;
        for (let row = 0; row < grid.height; row += 1) {
          const isPavement = grid.cells[row]?.[col]?.char === '_';
          if (grid.cells[row]?.[col]?.char !== null && !isPavement) {
            run += 1;
            tallest = Math.max(tallest, run);
          } else {
            run = 0;
          }
        }
      }
      return tallest;
    };

    // Several seeds: house height is a random draw, so the point is that the
    // ceiling is gone, not that every seed builds the tallest possible house.
    const tallest = [1, 7, 42, 999, 12_345].map((seed) =>
      tallestHouse(
        growCity(
          emptyLayers(CITY_WIDTH_CHARS, CITY_HEIGHT_ROWS),
          GROWTH_TICK_MS * 600,
          seed,
        ).middleground,
      ),
    );

    expect(Math.max(...tallest)).toBeGreaterThan(7);
  });

  it('leaves no permanently empty row in the houses band', () => {
    const grown = growCity(
      emptyLayers(CITY_WIDTH_CHARS, CITY_HEIGHT_ROWS),
      GROWTH_TICK_MS * 5_000,
      1,
    );

    const usedRows = new Set<number>();
    grown.middleground.cells.forEach((row, index) => {
      if (row.some((cell) => cell.char !== null)) usedRows.add(index);
    });

    // The band spans sky..sky+houses; the pavement row and the houses above it
    // must reach the top of the band, otherwise the extra grid height bought by
    // enlarging the city is simply wasted space.
    const sky = Math.round(CITY_HEIGHT_ROWS * 0.2);
    const street = 1 + 2; // one road row + the tallest street prop
    const housesBandHeight = CITY_HEIGHT_ROWS - sky - street;

    expect(usedRows.size).toBeGreaterThanOrEqual(housesBandHeight);
  });

  it('is still growing past the tick count that used to saturate the city', () => {
    // The 40×12 grid used to fill up at tick 201 (6.7 minutes of focus at the
    // production 2s cadence), after which the city was frozen for the remaining
    // ~18 minutes of a session. Enlarging the grid must push that point out.
    //
    // Expressed in *ticks*, not wall-clock minutes, so the guard stays valid
    // whatever `GROWTH_TICK_MS` is set to: `growCity` converts elapsed time to
    // whole ticks, so this is exactly 201 characters placed either way.
    const ticksThatUsedToSaturate = 201;
    const city = emptyLayers(CITY_WIDTH_CHARS, CITY_HEIGHT_ROWS);
    const grown = growCity(city, GROWTH_TICK_MS * ticksThatUsedToSaturate, 1);

    expect(growCity(grown, GROWTH_TICK_MS, 1)).not.toBe(grown);
  });

  it('holds substantially more characters than the previous 40×12 grid', () => {
    // Capacity is what the enlargement was for; the previous default is kept
    // here as the baseline this regression compares against.
    const previousWidth = 40;
    const previousHeight = 12;
    const saturate = (width: number, height: number): number =>
      occupiedTotal(growCity(emptyLayers(width, height), GROWTH_TICK_MS * 5_000, 1));

    const before = saturate(previousWidth, previousHeight);
    const after = saturate(CITY_WIDTH_CHARS, CITY_HEIGHT_ROWS);

    expect(after).toBeGreaterThan(before * 2);
  });
});
