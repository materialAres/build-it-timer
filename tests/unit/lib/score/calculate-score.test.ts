import { describe, it, expect } from 'vitest';
import { calculateScore } from '@/lib/score/calculate-score';

describe('calculateScore (CR3.T3)', () => {
  it.each([
    [0, 'bad'],
    [179, 'bad'],
    [180, 'good'],
    [419, 'good'],
    [420, 'great'],
    [599, 'great'],
    [600, 'excellent'],
  ])('maps %i of 600 characters to %s', (built, expected) => {
    expect(calculateScore(built, 600)).toBe(expected);
  });

  it.each([
    [0, 'bad'],
    [299, 'bad'],
    [300, 'good'],
    [699, 'good'],
    [700, 'great'],
    [999, 'great'],
    [1000, 'excellent'],
  ])('keeps the same percentages for a total of 1000: %i is %s', (built, expected) => {
    expect(calculateScore(built, 1000)).toBe(expected);
  });

  it('starts the good band at ceil(30%) when the total is not a multiple', () => {
    expect(calculateScore(180, 601)).toBe('bad');
    expect(calculateScore(181, 601)).toBe('good');
  });

  it('floors a fractional character count', () => {
    expect(calculateScore(179.9, 600)).toBe('bad');
    expect(calculateScore(599.9, 600)).toBe('great');
  });

  describe('defensive inputs', () => {
    it.each([Number.NaN, -1, Number.NEGATIVE_INFINITY])(
      'maps the invalid count %s to bad',
      (built) => {
        expect(calculateScore(built, 600)).toBe('bad');
      },
    );

    it.each([0, -600, Number.NaN, Number.POSITIVE_INFINITY])(
      'maps the invalid total %s to bad',
      (total) => {
        expect(calculateScore(300, total)).toBe('bad');
      },
    );

    it('clamps a count above the total to excellent', () => {
      expect(calculateScore(900, 600)).toBe('excellent');
      expect(calculateScore(Number.POSITIVE_INFINITY, 600)).toBe('excellent');
    });
  });
});
