import { describe, it, expect } from 'vitest';
import {
  applyMalus,
  malusForDistractionTicks,
  MALUS_ESCALATION_SCHEDULE,
} from '@/lib/score/apply-malus';
import type { CityGrid, CityLayers } from '@/components/city/city.types';

const toGrid = (rows: ReadonlyArray<ReadonlyArray<string | null>>): CityGrid => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  cells: rows.map((line) => line.map((char) => ({ char }))),
});

const emptyGrid = (): CityGrid => toGrid([
  [null, null, null],
  [null, null, null],
  [null, null, null],
]);

const emptyLayers = (): CityLayers => ({
  background: emptyGrid(),
  middleground: emptyGrid(),
  foreground: emptyGrid(),
});

const layersWith = (rows: ReadonlyArray<ReadonlyArray<string | null>>): CityLayers => ({
  ...emptyLayers(),
  middleground: toGrid(rows),
});

const occupiedCount = (layers: CityLayers): number =>
  [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );

describe('applyMalus (M2.T10)', () => {
  it('removes one character for each 2s tick of distraction', () => {
    const city = layersWith([
      [null, null, null],
      ['A', null, null],
      ['B', null, null],
    ]);
    expect(occupiedCount(city)).toBe(2);

    const afterOneTick = applyMalus(city, 1);
    expect(occupiedCount(afterOneTick)).toBe(1);

    const afterTwoTicks = applyMalus(city, 2);
    expect(occupiedCount(afterTwoTicks)).toBe(0);
  });

  it('removes characters from the top down (the inverse of upward growth)', () => {
    const city = layersWith([
      [null, 'top', null],
      [null, null, null],
      ['bottom', null, null],
    ]);

    const result = applyMalus(city, 1);

    expect(result.middleground.cells[0]?.[1]).toEqual({ char: null });
    expect(result.middleground.cells[2]?.[0]).toEqual({ char: 'bottom' });
  });

  it('leaves a cell in the explicit empty state (char: null), never undefined', () => {
    const city = layersWith([
      ['A', null, null],
      [null, null, null],
      [null, null, null],
    ]);

    const result = applyMalus(city, 1);
    const cell = result.middleground.cells[0]?.[0];

    expect(cell).toEqual({ char: null });
  });

  it('does not go below zero when there are more ticks than characters', () => {
    const city = layersWith([
      ['A', null, null],
      [null, null, null],
      [null, null, null],
    ]);

    const result = applyMalus(city, 100);

    expect(occupiedCount(result)).toBe(0);
    expect(result.middleground.cells[0]?.[0]).toEqual({ char: null });
  });

  it('treats an already-empty city as an explicit no-op (same reference)', () => {
    const city = emptyLayers();

    expect(() => applyMalus(city, 5)).not.toThrow();
    expect(applyMalus(city, 5)).toBe(city);
  });

  it('is a no-op for zero, negative, or non-finite ticks', () => {
    const city = layersWith([
      ['A', null, null],
      [null, null, null],
      [null, null, null],
    ]);

    expect(applyMalus(city, 0)).toBe(city);
    expect(applyMalus(city, -3)).toBe(city);
    expect(applyMalus(city, Number.NaN)).toBe(city);
    expect(applyMalus(city, Infinity)).toBe(city);
  });

  it('is pure: the input city is never mutated', () => {
    const city = layersWith([
      ['A', null, null],
      [null, null, null],
      [null, null, null],
    ]);

    applyMalus(city, 3);

    expect(city.middleground.cells[0]?.[0]).toEqual({ char: 'A' });
    expect(occupiedCount(city)).toBe(1);
  });

  it('is deterministic: the same input yields a deep-equal city', () => {
    const city = layersWith([
      ['A', 'B', null],
      [null, 'C', null],
      [null, null, 'D'],
    ]);

    expect(applyMalus(city, 2)).toEqual(applyMalus(city, 2));
  });

  it('consumes cells across all three layers, topmost rows first', () => {
    const city: CityLayers = {
      ...emptyLayers(),
      background: toGrid([
        [null, null, null],
        ['bg', null, null],
        [null, null, null],
      ]),
      middleground: toGrid([
        [null, null, 'mg'],
        [null, null, null],
        [null, null, null],
      ]),
      foreground: toGrid([
        [null, null, null],
        [null, null, null],
        ['fg', null, null],
      ]),
    };

    const result = applyMalus(city, 3);

    // Row 0 is consumed before row 1, and the middleground before the
    // background on the same row.
    expect(result.middleground.cells[0]?.[2]).toEqual({ char: null });
    expect(result.background.cells[1]?.[0]).toEqual({ char: null });
    expect(result.foreground.cells[2]?.[0]).toEqual({ char: null });
    expect(occupiedCount(result)).toBe(0);
  });
});

describe('malusForDistractionTicks (M4.T1)', () => {
  it('owes no additional malus before any distraction tick has elapsed', () => {
    expect(malusForDistractionTicks(0)).toBe(0);
  });

  it('grows strictly as soon as time is spent on the blocked site', () => {
    expect(malusForDistractionTicks(1)).toBe(1);
    expect(malusForDistractionTicks(2)).toBeGreaterThan(malusForDistractionTicks(1));
  });

  it('is monotonic non-decreasing over a table of increasing times', () => {
    const cases = [0, 1, 2, 3, 5, 6, 7, 11, 12, 20, 60, 300];

    let previous = -1;
    for (const ticks of cases) {
      const malus = malusForDistractionTicks(ticks);
      expect(malus).toBeGreaterThanOrEqual(previous);
      previous = malus;
    }
  });

  it('never dips over a dense, increasing range (no smaller malus for more time)', () => {
    let previous = 0;
    for (let ticks = 0; ticks <= 240; ticks += 1) {
      const malus = malusForDistractionTicks(ticks);
      expect(malus).toBeGreaterThanOrEqual(previous);
      previous = malus;
    }
  });

  it('escalates: later ticks cost more than earlier ones (not merely linear)', () => {
    // Ticks 1..5 cost 1 (5 total); 6..11 cost 2 (12 more) -> 17; 12+ cost 3.
    expect(malusForDistractionTicks(11)).toBe(17);
    expect(malusForDistractionTicks(17)).toBe(35);

    const firstStep = malusForDistractionTicks(1) - malusForDistractionTicks(0);
    const middleStep = malusForDistractionTicks(6) - malusForDistractionTicks(5);
    const lateStep = malusForDistractionTicks(12) - malusForDistractionTicks(11);

    expect(middleStep).toBeGreaterThan(firstStep);
    expect(lateStep).toBeGreaterThan(middleStep);
  });

  it('is total for non-finite, negative and fractional input', () => {
    expect(malusForDistractionTicks(Number.NaN)).toBe(0);
    expect(malusForDistractionTicks(-3)).toBe(0);
    expect(malusForDistractionTicks(Number.POSITIVE_INFINITY)).toBe(0);
    expect(malusForDistractionTicks(3.9)).toBe(malusForDistractionTicks(3));
  });

  it('is deterministic for the same input', () => {
    expect(malusForDistractionTicks(42)).toBe(malusForDistractionTicks(42));
  });

  it('uses an ordered escalation schedule of positive stages', () => {
    expect(MALUS_ESCALATION_SCHEDULE.length).toBeGreaterThan(0);
    for (const rule of MALUS_ESCALATION_SCHEDULE) {
      expect(rule.fromTicks).toBeGreaterThan(0);
      expect(rule.charactersPerTick).toBeGreaterThan(0);
    }

    const starts = MALUS_ESCALATION_SCHEDULE.map((rule) => rule.fromTicks);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});
