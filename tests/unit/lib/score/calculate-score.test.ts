import { describe, it, expect } from 'vitest';
import { calculateScore, GOOD_MAX_RATIO } from '@/lib/score/calculate-score';

describe('calculateScore (M2.T9)', () => {
  it('maps a ratio of 0 to excellent', () => {
    expect(calculateScore(0)).toBe('excellent');
  });

  it('maps the good upper boundary (0.3) to good', () => {
    expect(calculateScore(0.3)).toBe('good');
  });

  it('maps just above the boundary (0.31) to bad', () => {
    expect(calculateScore(0.31)).toBe('bad');
  });

  it('maps a full distraction ratio (1.0) to bad', () => {
    expect(calculateScore(1.0)).toBe('bad');
  });

  it('covers every threshold boundary parametrically', () => {
    const cases: ReadonlyArray<readonly [number, ReturnType<typeof calculateScore>]> = [
      [0, 'excellent'],
      [0.001, 'good'],
      [0.15, 'good'],
      [0.3, 'good'],
      [0.3000001, 'bad'],
      [0.31, 'bad'],
      [0.75, 'bad'],
      [1.0, 'bad'],
    ];

    for (const [ratio, expected] of cases) {
      expect(calculateScore(ratio), `ratio ${String(ratio)}`).toBe(expected);
    }
  });

  it('treats the exact good boundary as inclusive and the next value as bad', () => {
    expect(calculateScore(GOOD_MAX_RATIO)).toBe('good');
    expect(calculateScore(GOOD_MAX_RATIO + Number.EPSILON)).toBe('bad');
  });

  it('treats only an exact zero as excellent', () => {
    expect(calculateScore(0)).toBe('excellent');
    expect(calculateScore(-0)).toBe('excellent');
    expect(calculateScore(0.0001)).toBe('good');
  });

  it('is defensive with out-of-range input and never throws', () => {
    expect(calculateScore(-0.5)).toBe('excellent');
    expect(calculateScore(-Infinity)).toBe('excellent');
    expect(calculateScore(1.5)).toBe('bad');
    expect(calculateScore(Infinity)).toBe('bad');
    expect(calculateScore(Number.NaN)).toBe('excellent');
  });
});
