import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import {
  calculateLostCharacters,
  visibleFloors,
} from '@/lib/city/plan/visible-floors';

const TOTAL = 600;
const plan = generateCityPlan(hashString('session-visible'));
const NOTHING = { complete: 0, partialFraction: 0, damaged: false };
const exact = (built: number): number => (built * plan.totalFloors) / TOTAL;

describe('visibleFloors (CR6.T4)', () => {
  it('shows nothing at 0 characters', () => {
    expect(visibleFloors(plan, 0, TOTAL, 0)).toEqual(NOTHING);
  });

  it('shows every floor, complete, at the total', () => {
    expect(visibleFloors(plan, TOTAL, TOTAL, 0)).toEqual({
      complete: plan.totalFloors,
      partialFraction: 0,
      damaged: false,
    });
  });

  it('follows built / total × floors', () => {
    for (const built of [1, 7, 150, 299, 300, 451, 599]) {
      const { complete, partialFraction } = visibleFloors(plan, built, TOTAL, 0);
      expect(complete + partialFraction).toBeCloseTo(exact(built), 9);
      expect(complete).toBe(Math.floor(exact(built)));
      expect(partialFraction).toBeGreaterThanOrEqual(0);
      expect(partialFraction).toBeLessThan(1);
    }
  });

  it('is monotonic: more characters never show less', () => {
    let previous = 0;
    for (let built = 0; built <= TOTAL; built += 1) {
      const { complete, partialFraction } = visibleFloors(plan, built, TOTAL, 0);
      const value = complete + partialFraction;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('removes the newest floors first: fewer characters show a prefix', () => {
    for (let built = 1; built <= TOTAL; built += 1) {
      const lower = visibleFloors(plan, built - 1, TOTAL, 0);
      const higher = visibleFloors(plan, built, TOTAL, 0);
      expect(lower.complete).toBeLessThanOrEqual(higher.complete);
    }
  });

  it('changes the output for every single character lost', () => {
    for (let built = 1; built <= TOTAL; built += 1) {
      const lower = visibleFloors(plan, built - 1, TOTAL, 1);
      const higher = visibleFloors(plan, built, TOTAL, 1);
      expect(lower).not.toEqual(higher);
    }
  });

  it('shows a partly paid top floor as under construction while nothing is lost', () => {
    const view = visibleFloors(plan, 301, TOTAL, 0);
    expect(view.partialFraction).toBeGreaterThan(0);
    expect(view.damaged).toBe(false);
  });

  it('shows a partly paid top floor as damaged once a character is lost', () => {
    const view = visibleFloors(plan, 301, TOTAL, 1);
    expect(view.partialFraction).toBeGreaterThan(0);
    expect(view.damaged).toBe(true);
  });

  it('has no damaged floor when there is no partial floor', () => {
    expect(visibleFloors(plan, 0, TOTAL, 40).damaged).toBe(false);
    expect(visibleFloors(plan, TOTAL, TOTAL, 40).damaged).toBe(false);
  });

  it('is total: invalid input shows nothing, too many characters clamp', () => {
    for (const [built, total] of [[Number.NaN, TOTAL], [-5, TOTAL], [10, 0], [10, -1], [10, Number.NaN], [Number.POSITIVE_INFINITY, TOTAL]] as const) {
      expect(visibleFloors(plan, built, total, 0)).toEqual(NOTHING);
    }
    expect(visibleFloors(plan, 9_999, TOTAL, 0).complete).toBe(plan.totalFloors);
    expect(visibleFloors(plan, 100, TOTAL, Number.NaN).damaged).toBe(false);
  });

  it('scales to any total, not only 600', () => {
    expect(visibleFloors(plan, 500, 1000, 0).complete).toBe(Math.floor(plan.totalFloors / 2));
  });
});

describe('calculateLostCharacters (CR6.T4)', () => {
  const duration = 30 * 60_000;

  it('is the focus characters not kept: focus minus built', () => {
    expect(calculateLostCharacters(duration / 2, duration, 250, TOTAL)).toBe(50);
  });

  it('is 0 when nothing was lost or built exceeds focus', () => {
    expect(calculateLostCharacters(duration / 2, duration, 300, TOTAL)).toBe(0);
    expect(calculateLostCharacters(duration / 2, duration, 400, TOTAL)).toBe(0);
    expect(calculateLostCharacters(0, duration, 0, TOTAL)).toBe(0);
  });

  it('caps focus at the total and ignores invalid time', () => {
    expect(calculateLostCharacters(duration * 2, duration, 500, TOTAL)).toBe(100);
    expect(calculateLostCharacters(Number.NaN, duration, 0, TOTAL)).toBe(0);
    expect(calculateLostCharacters(-1, duration, 0, TOTAL)).toBe(0);
    expect(calculateLostCharacters(duration, 0, 0, TOTAL)).toBe(0);
    expect(calculateLostCharacters(duration, duration, 0, 0)).toBe(0);
  });
});
