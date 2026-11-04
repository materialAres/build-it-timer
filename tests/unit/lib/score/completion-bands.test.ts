import { describe, it, expect } from 'vitest';
import {
  bandCutoffCharacters,
  calculateCompletion,
  COMPLETION_BANDS,
  COMPLETION_BONUS_SHARE,
} from '@/lib/score/completion-bands';

describe('COMPLETION_BANDS (CR3.T1)', () => {
  it('is strictly ascending, starts at 0 and ends at exactly 1', () => {
    const ratios = COMPLETION_BANDS.map((band) => band.fromRatio);
    expect(ratios[0]).toBe(0);
    expect(ratios.at(-1)).toBe(1);
    ratios.slice(1).forEach((ratio, i) => {
      expect(ratio).toBeGreaterThan(ratios[i] as number);
    });
  });

  it('orders the levels bad, good, great, excellent', () => {
    expect(COMPLETION_BANDS.map((band) => band.level)).toEqual([
      'bad',
      'good',
      'great',
      'excellent',
    ]);
  });

  it('earns 5, 10 and 20 per character and nothing at 100%', () => {
    expect(COMPLETION_BANDS.map((band) => band.populationPerCharacter)).toEqual([
      5, 10, 20, 0,
    ]);
  });

  it('keeps the bonus share at 7%', () => {
    expect(COMPLETION_BONUS_SHARE).toBe(0.07);
  });
});

describe('bandCutoffCharacters (CR3.T1)', () => {
  it.each([
    [600, [0, 180, 420, 600]],
    [601, [0, 181, 421, 601]],
    [700, [0, 210, 490, 700]],
    [1000, [0, 300, 700, 1000]],
  ])('gives the cutoffs for a total of %i', (total, expected) => {
    const cutoffs = COMPLETION_BANDS.map((band) =>
      bandCutoffCharacters(band.fromRatio, total),
    );
    expect(cutoffs).toEqual(expected);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'gives 0 for the invalid total %s',
    (total) => {
      expect(bandCutoffCharacters(0.3, total)).toBe(0);
    },
  );
});

describe('calculateCompletion (CR3.T1)', () => {
  it.each([
    [0, 600, 0],
    [300, 600, 0.5],
    [600, 600, 1],
    [900, 600, 1],
    [-10, 600, 0],
  ])('maps %i of %i characters to %d', (built, total, expected) => {
    expect(calculateCompletion(built, total)).toBe(expected);
  });

  it('degrades invalid input to 0', () => {
    expect(calculateCompletion(Number.NaN, 600)).toBe(0);
    expect(calculateCompletion(10, Number.NaN)).toBe(0);
    expect(calculateCompletion(10, 0)).toBe(0);
    expect(calculateCompletion(Number.NEGATIVE_INFINITY, 600)).toBe(0);
  });
});
