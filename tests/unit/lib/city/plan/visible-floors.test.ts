import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { advanceFall, visibleFloors } from '@/lib/city/plan/visible-floors';

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

describe('advanceFall: characters lost since the city last grew (I015)', () => {
  it('starts with nothing lost, whatever the first count', () => {
    expect(advanceFall(null, 251)).toEqual({ built: 251, lost: 0 });
  });

  it('adds every drop to the current fall', () => {
    const first = advanceFall(advanceFall(null, 300), 290);
    expect(first).toEqual({ built: 290, lost: 10 });
    expect(advanceFall(first, 281)).toEqual({ built: 281, lost: 19 });
  });

  it('ends the fall as soon as the city grows again', () => {
    const fallen = advanceFall(advanceFall(null, 300), 251);
    expect(advanceFall(fallen, 252)).toEqual({ built: 252, lost: 0 });
  });

  it('keeps the state while the count is unchanged', () => {
    const fallen = advanceFall(advanceFall(null, 300), 251);
    expect(advanceFall(fallen, 251)).toBe(fallen);
  });

  it('treats an invalid count as 0', () => {
    expect(advanceFall(advanceFall(null, 10), Number.NaN)).toEqual({ built: 0, lost: 10 });
  });
});
