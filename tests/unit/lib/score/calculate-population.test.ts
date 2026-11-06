import { describe, it, expect } from 'vitest';
import { calculatePopulation } from '@/lib/score/calculate-population';

describe('calculatePopulation (CR3.T3)', () => {
  it.each([
    [0, 0],
    [1, 5],
    [179, 895],
    [180, 900],
    [181, 910],
    [420, 3300],
    [421, 3320],
    [599, 6880],
    [600, 7383],
  ])('gives the reference value for %i of 600 characters: %i', (built, expected) => {
    expect(calculatePopulation(built, 600)).toBe(expected);
  });

  it('applies the marginal rate: the 180th character earns 5 and the 181st earns 10', () => {
    expect(calculatePopulation(180, 600) - calculatePopulation(179, 600)).toBe(5);
    expect(calculatePopulation(181, 600) - calculatePopulation(180, 600)).toBe(10);
    expect(calculatePopulation(421, 600) - calculatePopulation(420, 600)).toBe(20);
  });

  it('never decreases as characters are added', () => {
    let previous = -1;
    for (let built = 0; built <= 600; built++) {
      const population = calculatePopulation(built, 600);
      expect(population).toBeGreaterThanOrEqual(previous);
      previous = population;
    }
  });

  it('adds the bonus only at 100%', () => {
    expect(calculatePopulation(599, 600)).toBe(6880);
    expect(calculatePopulation(600, 600) - 6900).toBe(483);
  });

  it('scales the bands and the 7% bonus with another total', () => {
    // 300 x 5 + 400 x 10 + 300 x 20 = 11500; the bonus is 7% of it.
    expect(calculatePopulation(999, 1000)).toBe(11480);
    expect(calculatePopulation(1000, 1000)).toBe(12305);
  });

  it('floors a fractional character count', () => {
    expect(calculatePopulation(180.9, 600)).toBe(900);
  });

  it('clamps a count above the total to a complete session', () => {
    expect(calculatePopulation(900, 600)).toBe(7383);
  });

  describe('defensive inputs', () => {
    it.each([Number.NaN, -5, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])(
      'degrades the invalid count %s to 0',
      (built) => {
        expect(calculatePopulation(built, 600)).toBe(0);
      },
    );

    it.each([0, -600, Number.NaN, Number.POSITIVE_INFINITY])(
      'degrades the invalid total %s to 0',
      (total) => {
        expect(calculatePopulation(300, total)).toBe(0);
      },
    );
  });
});
