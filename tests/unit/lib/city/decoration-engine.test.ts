import { describe, it, expect } from 'vitest';
import {
  createDecorator,
  decorate,
  DECORATION_GLYPHS,
  LIT_WINDOW_GLYPHS,
} from '@/lib/city/decoration-engine';
import { growCity, GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import type {
  CityGrid,
  CityLayers,
  SeededRandom,
} from '@/components/city/city.types';

/**
 * Minimal deterministic PRNG (mulberry32), the same used by the sibling city
 * tests. The decoration engine only depends on the injected `SeededRandom` port,
 * so a fresh generator with the same seed must reproduce the same result.
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

const toGrid = (rows: ReadonlyArray<ReadonlyArray<string | null>>): CityGrid => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  cells: rows.map((line) => line.map((char) => ({ char }))),
});

const emptyGrid = (width = 3, height = 3): CityGrid =>
  toGrid(
    Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null),
    ),
  );

const emptyLayers = (width = 3, height = 3): CityLayers => ({
  background: emptyGrid(width, height),
  middleground: emptyGrid(width, height),
  foreground: emptyGrid(width, height),
});

const layersWith = (
  rows: ReadonlyArray<ReadonlyArray<string | null>>,
): CityLayers => ({
  ...emptyLayers(),
  middleground: toGrid(rows),
});

const allGrids = (layers: CityLayers): ReadonlyArray<CityGrid> => [
  layers.background,
  layers.middleground,
  layers.foreground,
];

const at = (grid: CityGrid, row: number, col: number) =>
  grid.cells[row]?.[col]?.char ?? null;

const occupiedPositions = (layers: CityLayers): Set<string> => {
  const positions = new Set<string>();
  allGrids(layers).forEach((grid, layerIndex) => {
    grid.cells.forEach((line, row) => {
      line.forEach((cell, col) => {
        if (cell.char !== null) {
          positions.add([layerIndex, row, col].join(':'));
        }
      });
    });
  });
  return positions;
};

const occupiedGlyphsInGrid = (grid: CityGrid): ReadonlyArray<string> =>
  grid.cells.flat().flatMap((cell) => (cell.char === null ? [] : [cell.char]));

const allOccupiedGlyphs = (layers: CityLayers): ReadonlyArray<string> =>
  allGrids(layers).flatMap(occupiedGlyphsInGrid);

const ROWS_WITH_WINDOWS: ReadonlyArray<ReadonlyArray<string | null>> = [
  ['|', '[', ']', '|'],
  ['_', '#', '=', '|'],
];

describe('decoration engine (M2.T12b)', () => {
  it('is a no-op returning the same reference when disabled', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);

    expect(decorate(city, createSeededRandom(1), { enabled: false })).toBe(city);
    expect(createDecorator({ enabled: false })(city, createSeededRandom(1))).toBe(
      city,
    );
  });

  it('is a no-op returning the same reference when nothing is eligible', () => {
    const empty = emptyLayers();
    const noChance = {
      windowLitChance: 0,
      decorationChance: 0,
    };

    expect(decorate(empty, createSeededRandom(7), noChance)).toBe(empty);

    const city = layersWith(ROWS_WITH_WINDOWS);
    expect(decorate(city, createSeededRandom(7), noChance)).toBe(city);
  });

  it('is deterministic: same state + same seed → same result', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const first = decorate(city, createSeededRandom(99));
    const second = decorate(city, createSeededRandom(99));

    expect(second).toEqual(first);
  });

  it('keeps every load-bearing/non-window glyph untouched', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const decorated = decorate(city, createSeededRandom(5), {
      windowLitChance: 1,
      decorationChance: 0,
    });

    // `|`, `_`, `#`, `=` are structure/window-dark glyphs: never replaced.
    expect(at(decorated.middleground, 0, 0)).toBe('|');
    expect(at(decorated.middleground, 1, 0)).toBe('_');
    expect(at(decorated.middleground, 1, 1)).toBe('#');
    expect(at(decorated.middleground, 1, 2)).toBe('=');
    expect(at(decorated.middleground, 1, 3)).toBe('|');
  });

  it('lights window glyphs, replacing them only with brightness glyphs', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const decorated = decorate(city, createSeededRandom(3), {
      windowLitChance: 1,
      decorationChance: 0,
    });

    // Both `[` and `]` were lit.
    expect(LIT_WINDOW_GLYPHS).toContain(at(decorated.middleground, 0, 1));
    expect(LIT_WINDOW_GLYPHS).toContain(at(decorated.middleground, 0, 2));

    // The window glyphs are the only occupied cells allowed to change.
    const positions = occupiedPositions(city);
    expect(occupiedPositions(decorated)).toEqual(positions);
  });

  it('never removes or empties a building cell', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const decorated = decorate(city, createSeededRandom(11), {
      windowLitChance: 0,
      decorationChance: 1,
    });

    for (const position of occupiedPositions(city)) {
      expect(occupiedPositions(decorated).has(position)).toBe(true);
    }
  });

  it('adds decorations only to originally-empty background/foreground cells', () => {
    const city = emptyLayers(4, 2);
    const decorated = decorate(city, createSeededRandom(2), {
      windowLitChance: 0,
      decorationChance: 1,
    });

    // No decorated glyph may be an original building position, and the
    // middleground (no decoration glyphs) stays empty.
    expect(occupiedPositions(city).size).toBe(0);
    expect(occupiedPositions(decorated).size).toBe(16);
    expect(occupiedGlyphsInGrid(decorated.middleground)).toHaveLength(0);

    for (const glyph of occupiedGlyphsInGrid(decorated.background)) {
      expect(DECORATION_GLYPHS.background).toContain(glyph);
    }
    for (const glyph of occupiedGlyphsInGrid(decorated.foreground)) {
      expect(DECORATION_GLYPHS.foreground).toContain(glyph);
    }
  });

  it('never writes a blank or multi-character glyph', () => {
    const decorated = decorate(layersWith(ROWS_WITH_WINDOWS), createSeededRandom(4), {
      windowLitChance: 1,
      decorationChance: 1,
    });

    for (const glyph of allOccupiedGlyphs(decorated)) {
      expect(glyph.length).toBe(1);
      expect(glyph.trim()).toBe(glyph);
    }
  });

  it('is pure: the input layers are never mutated', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const before = JSON.stringify(city);

    decorate(city, createSeededRandom(8), { windowLitChance: 1, decorationChance: 1 });

    expect(JSON.stringify(city)).toBe(before);
  });

  it('is decoupled from growth: decorating a grown city preserves its buildings', () => {
    const grown = growCity(emptyLayers(20, 6), GROWTH_TICK_MS * 30, 42);
    const decorated = decorate(grown, createSeededRandom(42), {
      windowLitChance: 0,
      decorationChance: 0,
    });

    // With both chances at zero only structure would remain, but the important
    // guarantee is that decoration never consumes a grown building cell.
    expect(occupiedPositions(decorated)).toEqual(occupiedPositions(grown));

    const withDetails = decorate(grown, createSeededRandom(42));
    for (const position of occupiedPositions(grown)) {
      expect(occupiedPositions(withDetails).has(position)).toBe(true);
    }
  });

  it('exposes a configured adapter matching the direct call', () => {
    const city = layersWith(ROWS_WITH_WINDOWS);
    const options = { windowLitChance: 1, decorationChance: 0 };
    const decorator = createDecorator(options);

    expect(decorator(city, createSeededRandom(6))).toEqual(
      decorate(city, createSeededRandom(6), options),
    );
  });
});
