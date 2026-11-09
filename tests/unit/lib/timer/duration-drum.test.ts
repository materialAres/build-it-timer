import { describe, it, expect } from 'vitest';
import {
  MAX_RUBBER_BAND_ROWS,
  accumulateWheel,
  applyRubberBand,
  clampDrumIndex,
  computeKeyTarget,
  DRUM_ROW_REM,
  computeRowColor,
  computeRowGlow,
  computeRowOpacity,
  computeRowScale,
  computeSettleIndex,
  findDrumIndex,
  formatDrumValue,
  normalizeWheelDelta,
  stepDrumIndex,
} from '@/lib/timer/duration-drum';

const VALUES = [5, 10, 20, 30, 45, 60, 90, 120] as const;
const COUNT = VALUES.length;

describe('formatDrumValue (UI.T9)', () => {
  it.each([
    [5, '005'],
    [30, '030'],
    [120, '120'],
  ])('zero-pads %i minutes to three digits', (minutes, text) => {
    expect(formatDrumValue(minutes)).toBe(text);
  });
});

describe('clampDrumIndex / stepDrumIndex', () => {
  it('keeps an index inside the list and rounds a fraction', () => {
    expect(clampDrumIndex(-3, COUNT)).toBe(0);
    expect(clampDrumIndex(99, COUNT)).toBe(COUNT - 1);
    expect(clampDrumIndex(2.4, COUNT)).toBe(2);
    expect(clampDrumIndex(2.6, COUNT)).toBe(3);
  });

  it('is total for a non-finite index and an empty list', () => {
    expect(clampDrumIndex(Number.NaN, COUNT)).toBe(0);
    expect(clampDrumIndex(Number.POSITIVE_INFINITY, COUNT)).toBe(0);
    expect(clampDrumIndex(3, 0)).toBe(0);
  });

  it('steps by a delta and stops at both ends instead of looping', () => {
    expect(stepDrumIndex(3, 1, COUNT)).toBe(4);
    expect(stepDrumIndex(3, -2, COUNT)).toBe(1);
    expect(stepDrumIndex(COUNT - 1, 1, COUNT)).toBe(COUNT - 1);
    expect(stepDrumIndex(0, -1, COUNT)).toBe(0);
  });
});

describe('findDrumIndex', () => {
  it('finds the exact value', () => {
    expect(findDrumIndex(VALUES, 45)).toBe(4);
  });

  it('falls back to the nearest value for an unknown one', () => {
    expect(findDrumIndex(VALUES, 33)).toBe(3);
    expect(findDrumIndex(VALUES, 1000)).toBe(COUNT - 1);
  });

  it('returns 0 for an empty list', () => {
    expect(findDrumIndex([], 30)).toBe(0);
  });
});

describe('row look by distance from the centre', () => {
  it('is fully opaque at the centre and fades with distance', () => {
    expect(computeRowOpacity(0)).toBe(1);
    expect(computeRowOpacity(1)).toBeCloseTo(0.35);
    expect(computeRowOpacity(2)).toBeCloseTo(0.12);
    expect(computeRowOpacity(3)).toBe(0);
    expect(computeRowOpacity(7)).toBe(0);
  });

  it('interpolates continuously between the rows', () => {
    expect(computeRowOpacity(0.5)).toBeCloseTo(0.675);
    expect(computeRowOpacity(1.5)).toBeCloseTo(0.235);
  });

  it('is symmetric for rows above and below', () => {
    expect(computeRowOpacity(-1)).toBe(computeRowOpacity(1));
    expect(computeRowScale(-1)).toBe(computeRowScale(1));
  });

  it('shrinks the numeral to the neighbour size one row away and no further', () => {
    expect(computeRowScale(0)).toBe(1);
    expect(computeRowScale(1)).toBeCloseTo(0.6);
    expect(computeRowScale(0.5)).toBeCloseTo(0.8);
    expect(computeRowScale(4)).toBeCloseTo(0.6);
  });
});

describe('applyRubberBand', () => {
  it('leaves an offset inside the list untouched', () => {
    expect(applyRubberBand(0, COUNT)).toBe(0);
    expect(applyRubberBand(3.4, COUNT)).toBe(3.4);
    expect(applyRubberBand(COUNT - 1, COUNT)).toBe(COUNT - 1);
  });

  it('resists past either end and never exceeds a quarter row', () => {
    const past = applyRubberBand(COUNT - 1 + 2, COUNT);
    expect(past).toBeGreaterThan(COUNT - 1);
    expect(past - (COUNT - 1)).toBeLessThanOrEqual(MAX_RUBBER_BAND_ROWS);
    expect(applyRubberBand(-500, COUNT)).toBeGreaterThanOrEqual(
      -MAX_RUBBER_BAND_ROWS,
    );
  });

  it('is monotonic: pulling further moves it further', () => {
    expect(applyRubberBand(COUNT - 1 + 0.5, COUNT)).toBeLessThan(
      applyRubberBand(COUNT - 1 + 1.5, COUNT),
    );
  });
});

describe('computeSettleIndex', () => {
  it('snaps a resting offset to the nearest row', () => {
    expect(computeSettleIndex(2.4, 0, COUNT)).toBe(2);
    expect(computeSettleIndex(2.6, 0, COUNT)).toBe(3);
  });

  it('carries a flick forward a little, then snaps', () => {
    expect(computeSettleIndex(2.2, 12, COUNT)).toBeGreaterThan(2);
    expect(computeSettleIndex(2.2, -12, COUNT)).toBeLessThan(2);
  });

  it('never leaves the list', () => {
    expect(computeSettleIndex(6.8, 100, COUNT)).toBe(COUNT - 1);
    expect(computeSettleIndex(0.2, -100, COUNT)).toBe(0);
  });
});

describe('wheel input', () => {
  it('turns a mouse notch into exactly one step', () => {
    expect(accumulateWheel(0, 100)).toEqual({ steps: 1, remainder: 40 });
    expect(accumulateWheel(0, -100)).toEqual({ steps: -1, remainder: -40 });
  });

  it('accumulates small trackpad deltas until they add up to a step', () => {
    let state = { steps: 0, remainder: 0 };
    let total = 0;
    for (let i = 0; i < 6; i += 1) {
      state = accumulateWheel(state.remainder, 12);
      total += state.steps;
    }
    expect(total).toBe(1);
  });

  it('normalises line and page deltas to pixels', () => {
    expect(normalizeWheelDelta(3, 0)).toBe(3);
    expect(normalizeWheelDelta(1, 1)).toBeGreaterThan(20);
    expect(normalizeWheelDelta(1, 2)).toBeGreaterThan(normalizeWheelDelta(1, 1));
  });
});

describe('computeKeyTarget', () => {
  it('steps one preset with the arrows (up = longer, like a spinbutton)', () => {
    expect(computeKeyTarget('ArrowUp', 3, COUNT)).toBe(4);
    expect(computeKeyTarget('ArrowDown', 3, COUNT)).toBe(2);
  });

  it('steps two with PageUp/PageDown and clamps', () => {
    expect(computeKeyTarget('PageUp', 3, COUNT)).toBe(5);
    expect(computeKeyTarget('PageDown', 1, COUNT)).toBe(0);
  });

  it('jumps to the first and last preset with Home and End', () => {
    expect(computeKeyTarget('Home', 5, COUNT)).toBe(0);
    expect(computeKeyTarget('End', 2, COUNT)).toBe(COUNT - 1);
  });

  it('ignores any other key', () => {
    expect(computeKeyTarget('a', 3, COUNT)).toBeNull();
    expect(computeKeyTarget('Enter', 3, COUNT)).toBeNull();
  });
});

describe('row colour and glow', () => {
  it('is phosphor green on the selection and screen white from one row away', () => {
    expect(computeRowColor(0)).toBe('rgb(125, 251, 160)');
    expect(computeRowColor(1)).toBe('rgb(230, 230, 230)');
    expect(computeRowColor(5)).toBe('rgb(230, 230, 230)');
    expect(computeRowColor(-1)).toBe(computeRowColor(1));
  });

  it('blends between the two while the drum moves', () => {
    expect(computeRowColor(0.5)).toBe('rgb(178, 241, 195)');
  });

  it('glows only on the selection, fading out within half a row', () => {
    expect(computeRowGlow(0)).toBe(1);
    expect(computeRowGlow(0.25)).toBeCloseTo(0.5);
    expect(computeRowGlow(0.5)).toBe(0);
    expect(computeRowGlow(2)).toBe(0);
  });

  it('gives a row a fixed height in rem', () => {
    expect(DRUM_ROW_REM).toBe(2.5);
  });
});
